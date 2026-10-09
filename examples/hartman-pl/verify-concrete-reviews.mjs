import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCaptions, validateFindings, videoIdentity } from "./youtube.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const followup = args[0] === "--followup";
if (followup) args.shift();
assert(args.length === 0 || (args.length === 2 && args[0] === "--captions"));
const captions = args[1] ? resolve(args[1]) : null;
const prefix = followup ? "M" : "K";
const ledgerFile = followup ? "progresje-filmy.json" : "konkretne-filmy.json";
const documentFile = followup
  ? "progresje-i-pomiary.md"
  : "konkretne-przypadki.md";
const verificationFile = followup
  ? "followup-reviews-verification.json"
  : "concrete-reviews-verification.json";
const data = JSON.parse(await readFile(resolve(directory, ledgerFile), "utf8"));
const document = await readFile(resolve(directory, documentFile), "utf8");

function checkAcquisition(records, summary) {
  assert.equal(
    new Set(records.map((record) => record.video_id)).size,
    records.length,
  );
  assert.equal(records.length, summary.new_videos_requested);
  assert.equal(
    records.filter((record) => record.transcript_sha256).length,
    summary.new_caption_texts_obtained,
  );
  for (const record of records) {
    assert.equal(videoIdentity(record.url).video_id, record.video_id);
    if (record.transcript_sha256)
      assert.match(record.transcript_sha256, /^[a-f0-9]{64}$/u);
  }
  const countScope = (scope) =>
    records.filter((record) => record.analysis_scope === scope).length;
  assert.equal(
    countScope("whole_available_caption_text"),
    summary.new_whole_caption_reads,
  );
  assert.equal(
    countScope("selected_caption_intervals"),
    summary.new_selected_caption_reads,
  );
  assert.equal(
    countScope("machine_index_only"),
    summary.new_machine_index_only,
  );
}

function documentReferences(text) {
  const ids = new Set(text.match(new RegExp(prefix + "\\d{2}", "gu")));
  for (const match of text.matchAll(
    new RegExp(prefix + "(\\d{2})–" + prefix + "(\\d{2})", "gu"),
  )) {
    for (let id = Number(match[1]); id <= Number(match[2]); id += 1)
      ids.add(prefix + String(id).padStart(2, "0"));
  }
  return ids;
}

function checkFinding(finding, review, ids) {
  assert(!ids.has(finding.id), "Duplicate finding " + finding.id);
  ids.add(finding.id);
  assert.match(finding.id, new RegExp("^" + prefix + "\\d{2}$", "u"));
  assert(finding.end > finding.start && finding.start >= 0);
  assert(
    review.read_intervals.some(
      ([start, end]) => start <= finding.start && end >= finding.end,
    ),
  );
  assert(finding.cue_ids.length > 0);
  assert.equal(
    finding.source_url,
    review.url + "&t=" + Math.floor(finding.start) + "s",
  );
  assert.equal(finding.visual_review, "pending");
  assert.equal(finding.clinical_validation, "not_performed");
  assert(finding.summary_pl.trim().length > 0);
}

async function checkExactSource(review) {
  const bytes = await readFile(resolve(captions, review.video_id + ".txt"));
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    review.transcript_sha256,
  );
  const identity = videoIdentity(review.url);
  const parsed = parseCaptions(bytes.toString("utf8"), identity);
  const transcript = {
    ...identity,
    ...parsed,
    transcript_sha256: review.transcript_sha256,
  };
  assert.deepEqual(validateFindings(review, transcript), review.findings);
  const lastTimedEnd = Math.max(
    ...parsed.cues.map((cue) => cue.end ?? cue.start),
  );
  for (const [start, end] of review.read_intervals) {
    assert(start >= 0 && end > start && end <= lastTimedEnd);
  }
}

async function checkLongestCohort() {
  const checkpoint = JSON.parse(
    await readFile(resolve(directory, "korpus-dlugich-filmow.json"), "utf8"),
  );
  const previous = JSON.parse(
    await readFile(resolve(directory, "dlugie-filmy.json"), "utf8"),
  );
  const reviews = new Map(
    [...previous, ...data.reviews].map((review) => [review.video_id, review]),
  );
  for (const film of checkpoint.films) {
    const review = reviews.get(film.video_id);
    assert(review, "Missing review for longest cohort: " + film.video_id);
    assert.equal(review.transcript_sha256, film.transcript_sha256);
  }
  assert.equal(checkpoint.films.length, 24);
  return checkpoint.films.length;
}

checkAcquisition(data.acquisition, data.summary);
assert.equal(data.reviews.length, data.summary.reviewed_sources);
assert.equal(
  new Set(data.reviews.map((review) => review.video_id)).size,
  data.reviews.length,
);
const findingIds = new Set();
for (const review of data.reviews) {
  assert.equal(videoIdentity(review.url).video_id, review.video_id);
  assert.match(review.transcript_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(review.video_review, "not_performed");
  for (const finding of review.findings)
    checkFinding(finding, review, findingIds);
  if (captions) await checkExactSource(review);
}
assert.equal(findingIds.size, data.summary.findings);
if (data.summary.selected_read_seconds !== undefined) {
  const seconds = data.reviews
    .flatMap((review) => review.read_intervals)
    .reduce((sum, [start, end]) => sum + end - start, 0);
  assert.equal(seconds, data.summary.selected_read_seconds);
}
const sourceIds = new Set(data.acquisition.map((record) => record.video_id));
assert.equal(
  data.reviews.filter((review) => !sourceIds.has(review.video_id)).length,
  data.summary.revisited_existing_sources,
);
assert.deepEqual(documentReferences(document), findingIds);
for (const match of document.matchAll(/\]\(([^)]+)\)/gu)) {
  if (match[1].startsWith("https://www.youtube.com/")) {
    const identity = videoIdentity(match[1]);
    assert(
      data.reviews.some((review) => review.video_id === identity.video_id),
    );
  } else if (match[1].startsWith("https://")) {
    assert.equal(new URL(match[1]).protocol, "https:");
  } else {
    await readFile(resolve(directory, match[1]));
  }
}
const result = {
  status: "passed",
  checked_on: data.captured_on,
  scope: captions
    ? "exact_caption_bytes_cues_and_document_references"
    : "public_metadata_and_document_references_only",
  source_count: data.reviews.length,
  finding_count: findingIds.size,
  acquisition_count: data.acquisition.length,
  source_semantics:
    "Analyst reading; timing/hash checks do not establish clinical validity or visual accuracy.",
  ...(followup
    ? {
        longest_cohort_sources_with_selected_reviews:
          await checkLongestCohort(),
      }
    : {}),
};
if (captions)
  await writeFile(
    resolve(directory, verificationFile),
    JSON.stringify(result, null, 2) + "\n",
  );
console.log(JSON.stringify(result));
