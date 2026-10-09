import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { videoIdentity } from "./youtube-identity.mjs";
import { parseCaptions, validateFindings } from "./youtube.mjs";
import { prioritizeCatalog } from "./prioritize-videos.mjs";

const here = new URL("./", import.meta.url);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === "--captions"));
const bytes = await readFile(new URL("korpus-dlugich-filmow.json", here));
const report = JSON.parse(bytes);
const reviews = JSON.parse(
  await readFile(new URL("dlugie-filmy.json", here), "utf8"),
);
const historical = JSON.parse(
  await readFile(new URL("korpus.json", here), "utf8"),
);
const ranked = prioritizeCatalog({
  entries: [...historical.films, ...historical.unavailable],
});
assert.deepEqual(
  report.films.map((x) => x.video_id),
  ranked.slice(0, 24).map((x) => x.video_id),
);
assert.equal(
  report.generator.sha256,
  digest(await readFile(new URL("corpus.mjs", here))),
);
assert.equal(report.coverage.indexed_transcripts, report.films.length);
assert.equal(report.films.length, 24);
assert.equal(report.unavailable.length, 0);
assert.equal(report.coverage.analyst_reviewed, 0);
assert.equal(report.coverage.selected_windows_reviewed, reviews.length);
assert.equal(report.coverage.visual_reviewed, 0);
assert.equal(
  report.coverage.cues,
  report.films.reduce((n, x) => n + x.cue_count, 0),
);
const findingIds = new Set();
const sourceIds = new Set();
const privateTranscripts = new Map();
for (const film of report.films) {
  assert.match(film.transcript_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(Object.hasOwn(film, "cues"), false);
  assert.equal(Object.hasOwn(film, "windows"), false);
  if (args.length === 0) continue;
  const identity = videoIdentity(film.url);
  const raw = await readFile(join(args[1], identity.video_id + ".txt"));
  assert.equal(digest(raw), film.transcript_sha256);
  const parsed = parseCaptions(raw.toString("utf8"), identity);
  assert.equal(parsed.cues.length, film.cue_count);
  privateTranscripts.set(film.video_id, {
    ...identity,
    ...parsed,
    duration: null,
    transcript_sha256: digest(raw),
  });
}

function intervalWasRead(finding, intervals) {
  let through = finding.start;
  for (const interval of [...intervals].sort((a, b) => a.start - b.start)) {
    if (interval.end <= through) continue;
    if (interval.start > through) break;
    through = interval.end;
    if (through >= finding.end) return true;
  }
  return false;
}

async function checkReview(review) {
  assert.ok(!sourceIds.has(review.video_id));
  sourceIds.add(review.video_id);
  assert.equal(review.scope, "selected_windows");
  const film = report.films.find((x) => x.video_id === review.video_id);
  assert.ok(film);
  assert.equal(review.transcript_sha256, film.transcript_sha256);
  assert.deepEqual(review.findings, film.findings);
  assert.equal(film.semantic_review, review.scope);
  assert.equal(Object.hasOwn(film, "cues"), false);
  assert.equal(Object.hasOwn(film, "windows"), false);
  for (const interval of review.reviewed_intervals) {
    assert.ok(Number.isFinite(interval.start) && Number.isFinite(interval.end));
    assert.ok(interval.start >= 0 && interval.end > interval.start);
  }
  for (const finding of review.findings) {
    assert.ok(!findingIds.has(finding.id));
    findingIds.add(finding.id);
    assert.match(finding.id, /^L\d{2}$/u);
    assert.ok(intervalWasRead(finding, review.reviewed_intervals));
    assert.equal(videoIdentity(finding.source_url).video_id, review.video_id);
    assert.equal(finding.clinical_validation, "not_performed");
    assert.equal(finding.confidence, "analyst-inference");
    assert.notEqual(finding.visual_review, "reviewed");
    assert.ok(finding.cue_ids.length > 0);
  }
  if (args.length === 0) return;
  const transcript = privateTranscripts.get(film.video_id);
  assert.deepEqual(validateFindings(review, transcript), review.findings);
}

for (const review of reviews) await checkReview(review);
for (const name of ["dlugie-filmy.md", "model-po-ludzku.md"]) {
  const text = await readFile(new URL(name, here), "utf8");
  for (const match of text.matchAll(/\bL\d{2}\b/gu))
    assert.ok(
      findingIds.has(match[0]),
      "Unknown source reference: " + match[0],
    );
}
const result = {
  status: "passed",
  validation:
    args.length === 0
      ? "public_metadata"
      : "public_metadata_and_private_caption_bytes",
  priority_catalog: report.films.length,
  selected_sources: sourceIds.size,
  findings: findingIds.size,
  reviewed_caption_interval_seconds: reviews.reduce(
    (n, x) => n + x.reviewed_intervals.reduce((m, y) => m + y.end - y.start, 0),
    0,
  ),
  report_sha256: digest(bytes),
  reviews_sha256: digest(await readFile(new URL("dlugie-filmy.json", here))),
  visual_reviewed: 0,
  clinical_validation: "not_performed",
};
await writeFile(
  new URL("long-films-verification.json", here),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result));
