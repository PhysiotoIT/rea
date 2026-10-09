import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const here = new URL("./", import.meta.url);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const reportBytes = await readFile(new URL("korpus.json", here));
const report = JSON.parse(reportBytes);
const reviews = JSON.parse(
  await readFile(new URL("przeglad-korpusu.json", here), "utf8"),
);
const bundle = JSON.parse(
  await readFile(new URL("rea-corpus-evidence.json", here), "utf8"),
);
assert.equal(
  report.generator.sha256,
  digest(await readFile(new URL("corpus.mjs", here))),
);
assert.equal(report.films.length, report.coverage.indexed_transcripts);
assert.equal(report.unavailable.length, report.coverage.pending_or_unavailable);
const ids = [...report.films, ...report.unavailable].map(
  (film) => film.video_id,
);
assert.equal(new Set(ids).size, ids.length);
assert.equal(ids.length, report.inventory.observed_unique_ids);
assert.equal(
  report.languages.reduce((count, row) => count + row.films, 0),
  report.films.length,
);
assert.equal(
  report.coverage.cues,
  report.films.reduce((count, film) => count + film.cue_count, 0),
);
assert.equal(
  report.coverage.analyst_reviewed,
  reviews.filter((row) => row.scope === "whole_caption_text").length,
);
assert.equal(
  report.coverage.selected_windows_reviewed,
  reviews.filter((row) => row.scope === "selected_windows").length,
);
assert.equal(report.coverage.visual_reviewed, 0);
for (const film of report.films) {
  assert.match(film.transcript_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(film.duration_seconds, null);
  assert.equal(Object.hasOwn(film, "cues"), false);
  assert.equal(Object.hasOwn(film, "windows"), false);
}
for (const review of reviews) {
  const film = report.films.find((row) => row.video_id === review.video_id);
  assert.ok(film);
  assert.equal(film.transcript_sha256, review.transcript_sha256);
  assert.equal(film.semantic_review, review.scope);
  assert.deepEqual(film.findings, review.findings);
  for (const finding of film.findings) {
    assert.equal(finding.clinical_validation, "not_performed");
    assert.equal(finding.confidence, "analyst-inference");
    assert.ok(finding.cue_ids.length > 0);
  }
}
assert.equal(bundle.artifacts[0].digest.sha256, digest(reportBytes));
assert.equal(bundle.unknowns.length, 3);
const interpretations = bundle.records.filter(
  (row) => row.predicate_type === "hartman-pl.corpus-interpretation",
);
assert.equal(
  interpretations.length,
  reviews.reduce((count, row) => count + row.findings.length, 0),
);
assert.equal(
  bundle.records.filter(
    (row) => row.predicate_type === "hartman-pl.corpus-review-provenance",
  ).length,
  reviews.length,
);
const result = {
  status: "passed",
  catalog: ids.length,
  indexed: report.films.length,
  reviewed_sources: reviews.length,
  findings: interpretations.length,
  rea_records: bundle.records.length,
  rea_unknowns: bundle.unknowns.length,
  report_sha256: digest(reportBytes),
  clinical_validation: "not_performed",
};
await writeFile(
  fileURLToPath(new URL("corpus-verification.json", here)),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result));
