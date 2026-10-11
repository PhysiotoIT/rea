/**
 * Verify the machine-assisted review registry.
 *
 * Structure is always checked. With `--captions DIR` the private caption store
 * is checked too: every entry is re-hashed and every finding is re-validated
 * against the exact bytes it claims to describe, which is the only check that
 * makes the registry meaningful rather than merely well-formed.
 *
 * Usage:
 *   node examples/hartman-pl/verify-automatic-review.mjs \
 *     [--review examples/hartman-pl/przeglad-automatyczny.json] \
 *     [--captions /path/to/private/captions]
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCaptions, validateFindings, videoIdentity } from "./youtube.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KINDS = ["author_claim", "educational_interpretation", "unknown"];
const VISUAL = ["not_required", "pending", "reviewed"];
// Filler the project has explicitly rejected. A finding that only restates one of these
// says nothing about the film, so it is treated as an error rather than a style nit.
const FILLER = [
  /sluchaj swojego ciala|słuchaj swojego ciała/i,
  /kluczem jest regularnosc|kluczem jest regularność/i,
  /najwazniejsza jest indywidualizacja|najważniejsza jest indywidualizacja/i,
  /kazdy jest inny|każdy jest inny/i,
  /nie ma jednej odpowiedzi/i,
  /wszystko zalezy od pacjenta|wszystko zależy od pacjenta/i,
];

function options(args, allowed) {
  const parsed = {};
  const set = new Set(allowed);
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key?.startsWith("--")) throw new Error("Expected --option.");
    const name = key.slice(2);
    if (!set.has(name) || Object.hasOwn(parsed, name))
      throw new Error("Unknown or duplicate option: " + key);
    const value = args[index + 1];
    if (value === undefined) throw new Error("Expected --option value.");
    parsed[name] = value;
    index += 1;
  }
  return parsed;
}

const args = options(process.argv.slice(2), ["review", "captions"]);
const reviewPath = resolve(args.review ?? join(HERE, "przeglad-automatyczny.json"));
const corpus = JSON.parse(readFileSync(join(HERE, "korpus.json"), "utf8"));
const urlById = new Map(corpus.films.map((film) => [film.video_id, film.url]));
const curated = new Set(
  JSON.parse(readFileSync(join(HERE, "przeglad-korpusu.json"), "utf8")).map((r) => r.video_id),
);

const review = JSON.parse(readFileSync(reviewPath, "utf8"));
assert.ok(Array.isArray(review), "registry must be an array");

const seen = new Set();
let findings = 0;
let curatedOverlap = 0;
let captionFilesChecked = 0;

for (const entry of review) {
  assert.ok(!seen.has(entry.video_id), "duplicate video: " + entry.video_id);
  seen.add(entry.video_id);
  if (curated.has(entry.video_id)) curatedOverlap += 1;

  assert.ok(/^[\w-]{11}$/u.test(entry.video_id), "bad identity: " + entry.video_id);
  assert.equal(typeof entry.transcript_sha256, "string");
  assert.equal(entry.transcript_sha256.length, 64, "digest length: " + entry.video_id);
  assert.equal(entry.scope, "selected_windows", "unexpected scope: " + entry.video_id);
  assert.ok(Array.isArray(entry.findings) && entry.findings.length > 0, "no findings: " + entry.video_id);
  assert.equal(typeof entry.summary_pl, "string");
  assert.ok(/[ąćęłńóśźż]/u.test(entry.summary_pl), "summary without Polish diacritics: " + entry.video_id);

  // A film whose captions had to come from a different variant must say so, and must
  // still record the digest the corpus pinned, so the difference is auditable.
  if (entry.caption_variant_differs_from_corpus) {
    assert.equal(typeof entry.corpus_transcript_sha256, "string", "missing corpus digest: " + entry.video_id);
    assert.notEqual(entry.corpus_transcript_sha256, entry.transcript_sha256);
    assert.ok(entry.caption_variant_note, "missing variant note: " + entry.video_id);
  }

  const ids = new Set();
  for (const finding of entry.findings) {
    findings += 1;
    assert.ok(!ids.has(finding.id), "duplicate finding id: " + finding.id);
    ids.add(finding.id);
    assert.ok(Number.isFinite(finding.start) && finding.start >= 0, "bad start: " + finding.id);
    assert.ok(Number.isFinite(finding.end) && finding.end > finding.start, "bad interval: " + finding.id);
    assert.ok(KINDS.includes(finding.kind), "bad kind: " + finding.id);
    assert.ok(VISUAL.includes(finding.visual_review), "bad visual status: " + finding.id);
    // This registry was produced by reading text only. A claim of visual review
    // would be false, so it is rejected outright rather than merely discouraged.
    assert.notEqual(finding.visual_review, "reviewed", "visual review claimed without one: " + finding.id);
    assert.ok(finding.summary_pl?.trim(), "empty summary: " + finding.id);
    assert.ok(finding.summary_pl.length >= 40, "summary too short to be specific: " + finding.id);
    // A ceiling wide enough for a dense finding (observed p90 is about 580 characters)
    // but tight enough to catch a rambling wall of text instead of a summary.
    assert.ok(finding.summary_pl.length <= 1200, "summary is a wall of text, not a finding: " + finding.id);
    for (const pattern of FILLER)
      assert.ok(!pattern.test(finding.summary_pl), "generic filler in " + finding.id + ": " + pattern);
    assert.equal(finding.clinical_validation, "not_performed", "clinical validation claimed: " + finding.id);
    assert.ok(Array.isArray(finding.cue_ids) && finding.cue_ids.length > 0, "no supporting cues: " + finding.id);

    const url = urlById.get(entry.video_id);
    assert.ok(url, "video not in corpus: " + entry.video_id);
    assert.equal(
      finding.source_url,
      url + "&t=" + Math.floor(finding.start) + "s",
      "unexpected source url: " + finding.id,
    );
  }

  if (args.captions) {
    const file = join(resolve(args.captions), entry.video_id + ".txt");
    if (!existsSync(file)) throw new Error("missing caption file for " + entry.video_id);
    const bytes = readFileSync(file);
    const digest = createHash("sha256").update(bytes).digest("hex");
    assert.equal(digest, entry.transcript_sha256, "caption bytes changed for " + entry.video_id);
    const parsed = parseCaptions(bytes.toString("utf8"), videoIdentity(urlById.get(entry.video_id)));
    // Re-runs the project's own interval, cue and digest checks.
    validateFindings(
      { video_id: entry.video_id, transcript_sha256: digest, findings: entry.findings },
      { video_id: entry.video_id, transcript_sha256: digest, cues: parsed.cues, duration: null },
    );
    captionFilesChecked += 1;
  }
}

console.log(
  JSON.stringify({
    status: "passed",
    review: reviewPath,
    videos: review.length,
    findings,
    caption_files_checked: captionFilesChecked,
    curated_overlap: curatedOverlap,
    scope: args.captions
      ? "structure plus exact caption bytes and cue intervals"
      : "structure only; pass --captions to verify the caption bytes",
  }),
);
