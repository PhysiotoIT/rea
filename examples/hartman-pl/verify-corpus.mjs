import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  indexCorpus,
  publicReport,
  topicWindows,
  queryCorpus,
  main,
} from "./corpus.mjs";

const entries = Array.from({ length: 1000 }, (_, index) => {
  const video_id = String(index).padStart(11, "0");
  return { video_id, url: "https://www.youtube.com/watch?v=" + video_id };
});
const catalog = { entries, header_video_count: 1000, inventory_complete: true };
const captions = new Map(
  entries
    .slice(0, 998)
    .map((entry) => [
      entry.video_id,
      Buffer.from(
        "Video ID: " +
          entry.video_id +
          "\nLanguage: en\nCaptions: self-authored fixture\n\n[0:00] relative motion and pressure\n[0:10] relative motion and pressure\n[1:10] orientation",
      ),
    ]),
);
const corpus = indexCorpus(catalog, captions, [
  {
    video_id: entries[998].video_id,
    status: "export_unavailable",
    reason: "fixture transport failure",
  },
]);
const report = publicReport(catalog, corpus);
assert.equal(report.coverage.indexed_transcripts, 998);
assert.equal(report.coverage.pending_or_unavailable, 2);
assert.equal(report.coverage.analyst_reviewed, 0);
assert.equal(
  report.topics.find((topic) => topic.topic === "relative_motion").films,
  998,
);
assert.equal(
  report.cooccurrence.find(
    (pair) => pair.pair === "breathing_pressure+relative_motion",
  ).films,
  998,
);
assert.equal(
  report.cooccurrence.some(
    (pair) => pair.pair === "orientation+relative_motion",
  ),
  false,
);
assert.equal(report.exact_text_duplicates.length, 1);
assert.equal(report.exact_text_duplicates[0].length, 998);
assert.equal(report.unavailable[0].status, "export_unavailable");
assert.equal(report.unavailable[1].status, "not_attempted");
assert.equal(
  JSON.stringify(report).includes("relative motion and pressure"),
  false,
);
assert.equal(
  topicWindows([
    { id: "cue-1", start: 59, text: "pressure" },
    { id: "cue-2", start: 60, text: "relative motion" },
  ]).length,
  2,
);
assert.throws(
  () => indexCorpus({ entries: [entries[0], entries[0]] }, captions),
  /Duplicate/u,
);
assert.throws(
  () =>
    indexCorpus(
      { entries: [entries[0]] },
      new Map([
        [
          entries[0].video_id,
          Buffer.from("Video ID: 00000000001\n[0:00] wrong identity"),
        ],
      ]),
    ),
  /does not match/u,
);
assert.throws(
  () =>
    indexCorpus(
      { entries: [entries[0]] },
      new Map([[entries[0].video_id, Buffer.from("[0:00] unidentified")]]),
    ),
  /requires a Video ID/u,
);
assert.throws(
  () => indexCorpus({ entries: [entries[0]] }, captions),
  /outside this catalog/u,
);

assert.equal(queryCorpus(corpus, "RELATIVE MOTION").length, 998);
assert.throws(() => queryCorpus(corpus, "  "), /empty/u);
assert.throws(() => topicWindows([], 0), /positive/u);
const baseReview = {
  video_id: entries[0].video_id,
  transcript_sha256: corpus.indexed[0].transcript_sha256,
  scope: "selected_windows",
  findings: [
    {
      id: "fixture-note",
      start: 0,
      end: 10,
      kind: "author_claim",
      summary_pl: "Samodzielnie napisany materiał testowy.",
      visual_review: "not_required",
    },
  ],
};
assert.equal(
  indexCorpus(catalog, captions, [], [baseReview]).indexed[0].semantic_review,
  "selected_windows",
);
assert.throws(
  () =>
    indexCorpus(
      catalog,
      captions,
      [],
      [{ ...baseReview, transcript_sha256: "stale" }],
    ),
  /digest/u,
);
assert.throws(
  () => indexCorpus(catalog, captions, [], [{ ...baseReview, scope: "all" }]),
  /scope/u,
);
assert.throws(
  () => indexCorpus(catalog, captions, [], [baseReview, baseReview]),
  /Duplicate review/u,
);

const scratch = await mkdtemp(join(tmpdir(), "hartman-corpus-test-"));
const input = join(scratch, "captions");
await mkdir(input);
await writeFile(
  join(input, entries[0].video_id + ".txt"),
  captions.get(entries[0].video_id),
);
await writeFile(
  join(scratch, "catalog.json"),
  JSON.stringify({ entries: [entries[0], entries[999]] }),
);
const args = [
  "--catalog",
  join(scratch, "catalog.json"),
  "--captions",
  input,
  "--out",
  join(scratch, "run"),
];
await main(args);
const actual = JSON.parse(
  await readFile(join(scratch, "run/report.json"), "utf8"),
);
assert.equal(actual.coverage.indexed_transcripts, 1);
assert.equal(actual.coverage.pending_or_unavailable, 1);
await assert.rejects(main(args), /EEXIST/u);
await assert.rejects(main([...args, "--index", "unused"]), /Unknown/u);
await assert.rejects(main([...args, "--out", "duplicate"]), /duplicate/u);
const searchArgs = [
  "search",
  "--index",
  join(scratch, "run/private-index.json"),
  "--query",
  "relative motion",
  "--out",
  join(scratch, "packet.json"),
];
await main(searchArgs);
assert.equal(
  JSON.parse(await readFile(join(scratch, "packet.json"), "utf8")).matches
    .length,
  1,
);
await assert.rejects(main(searchArgs), /EEXIST/u);
await assert.rejects(main([...searchArgs, "--catalog", "unused"]), /Unknown/u);
console.log(
  "Corpus checks passed: 1000 self-authored fixture identities; 998 imported, exact duplicates, co-occurrence, identity rejection, private text exclusion, CLI and no overwrite.",
);
