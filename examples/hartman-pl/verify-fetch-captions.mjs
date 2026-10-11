/**
 * Deterministic checks for the caption acquisition tooling.
 *
 * Everything here runs offline on self-authored fixtures: no third-party
 * transcript is used, and no child process is started, so the checks also work
 * where yt-dlp is missing or spawning a captured child is not permitted.
 *
 * The format locked below is the one the committed corpus was built from. A
 * transcript written by `canonicalTranscript` must be byte-identical to the
 * browser exports, because the review registry pins itself to those digests.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  canonicalTranscript,
  clock,
  classify,
  json3Cues,
  pickCaption,
} from "./fetch-captions.mjs";
import { catalogFromReport } from "./catalog-from-report.mjs";
import { parseCaptions, videoIdentity } from "./youtube.mjs";

const digest = (text) => createHash("sha256").update(text).digest("hex");

/* --- clock ---------------------------------------------------------------- */

assert.equal(clock(0), "0:00");
assert.equal(clock(65), "1:05");
assert.equal(clock(1533), "25:33");
assert.equal(clock(3723), "62:03"); // over an hour: minutes keep counting, as browser exports do
assert.equal(clock(119.9), "1:59"); // truncates, never rounds up
assert.throws(() => clock(-1));
assert.throws(() => clock(Number.NaN));

/* --- json3Cues ------------------------------------------------------------ */

const json3 = JSON.stringify({
  events: [
    { tStartMs: 0, dDurationMs: 4200, segs: [{ utf8: "Move" }, { utf8: " one", tOffsetMs: 320 }] },
    { tStartMs: 2270, dDurationMs: 1930, segs: [{ utf8: "\n" }] }, // separator, not a caption
    { tStartMs: 2280, dDurationMs: 3360, segs: [{ utf8: "block." }] },
    { tStartMs: 4200, dDurationMs: 1000, segs: [{ utf8: "  " }] }, // whitespace-only
    { tStartMs: 9999, dDurationMs: 10 }, // no segs at all
    { tStartMs: 5000, dDurationMs: 1000, segs: [{ utf8: "End" }] },
  ],
});
assert.deepEqual(json3Cues(json3), [
  { start: 0, text: "Move one" },
  { start: 2, text: "block." },
  { start: 5, text: "End" },
]);
assert.throws(() => json3Cues('{"events":[]}'));
assert.throws(() => json3Cues('{"events":[{"segs":[{"utf8":"\\n"}]}]}'));
assert.throws(() => json3Cues('{"nope":1}'));

/* --- canonicalTranscript: the byte contract ------------------------------- */

const identity = videoIdentity("https://youtu.be/PQZRlndm4cw");
const cues = json3Cues(json3);
const transcript = canonicalTranscript(identity.video_id, "en", "auto-generated", cues);

assert.equal(
  transcript,
  "YouTube transcript\nVideo ID: PQZRlndm4cw\nLanguage: en\nCaptions: auto-generated\n\n" +
    "[0:00] Move one\n[0:02] block.\n[0:05] End",
);
assert.ok(!transcript.endsWith("\n"), "no trailing newline");
assert.ok(!transcript.includes("\r"), "LF only");
// Locked so a silent change to spacing or the header breaks the check.
assert.equal(digest(transcript), "3c6bca545ac5fb8056d93e02f90af6579841d1c4d2a23f773befbe6b3b281deb");

/* --- written format must round-trip through the pipeline reader ----------- */

const parsed = parseCaptions(transcript, identity, { duration: 6 });
assert.equal(parsed.format, "timestamped-text");
assert.equal(parsed.language, "en");
assert.equal(parsed.caption_kind, "auto-generated");
assert.deepEqual(
  parsed.cues.map(({ start, end, text }) => ({ start, end, text })),
  [
    { start: 0, end: 2, text: "Move one" },
    { start: 2, end: 5, text: "block." },
    { start: 5, end: 6, text: "End" },
  ],
);

/* --- pickCaption ---------------------------------------------------------- */

const files = ["abc.json3", "PQZRlndm4cw.en-orig.json3", "PQZRlndm4cw.en.json3", "PQZRlndm4cw.log"];
assert.equal(pickCaption(files, "PQZRlndm4cw", "en"), "PQZRlndm4cw.en.json3");
assert.equal(pickCaption(files, "PQZRlndm4cw", "en.*"), "PQZRlndm4cw.en.json3");
assert.equal(pickCaption(["PQZRlndm4cw.en-orig.json3"], "PQZRlndm4cw", "en"), "PQZRlndm4cw.en-orig.json3");
assert.equal(pickCaption(["other.en.json3"], "PQZRlndm4cw", "en"), null);
assert.equal(pickCaption([], "PQZRlndm4cw", "en"), null);

/* --- classify: honest acquisition reasons --------------------------------- */

assert.deepEqual(classify("", true), { status: "captions_obtained", reason: null });
assert.equal(classify("ERROR: HTTP Error 429: Too Many Requests", false).status, "rate_limited");
assert.equal(classify("Sign in to confirm you're not a bot", false).status, "blocked");
assert.equal(classify("There are no subtitles for the requested languages", false).status, "unavailable");
assert.equal(classify("ERROR: Private video. Sign in if you've been granted access", false).status, "unavailable");
assert.equal(classify("something unexpected", false).status, "error");
// A reason is always reported for a failure and never invented for a success.
for (const log of ["429", "no subtitles", "Private video", "unknown"])
  assert.ok(classify(log, false).reason, `no reason for: ${log}`);

/* --- catalogFromReport ---------------------------------------------------- */

const catalog = catalogFromReport({
  inventory: { reported_header_count: 937, complete: true },
  films: [{ video_id: "PQZRlndm4cw", url: "https://www.youtube.com/watch?v=PQZRlndm4cw", title: "T", duration_label: "1:00", title_language: "x", cue_count: 5 }],
  unavailable: [{ video_id: "N0GDdA0MPCo", url: "https://www.youtube.com/watch?v=N0GDdA0MPCo", title: "U", duration_label: "2:00", title_language: "x", status: "not_attempted", reason: null }],
});
assert.equal(catalog.header_video_count, 937);
assert.equal(catalog.inventory_complete, true);
assert.deepEqual(catalog.entries.map((entry) => entry.video_id), ["PQZRlndm4cw", "N0GDdA0MPCo"]);
// Catalog entries carry only what a film record needs — no corpus counts leak in.
assert.deepEqual(Object.keys(catalog.entries[0]), ["video_id", "url", "title", "duration_label", "title_language"]);
assert.throws(() => catalogFromReport({ films: [], unavailable: [] }));
assert.throws(() =>
  catalogFromReport({ films: [{ video_id: "PQZRlndm4cw", url: "u" }, { video_id: "PQZRlndm4cw", url: "u" }] }),
);
assert.throws(() => catalogFromReport({ films: [{ video_id: "too-short", url: "u" }] }));

console.log(
  JSON.stringify({
    checks: [
      "clock",
      "json3Cues",
      "canonicalTranscript format",
      "canonicalTranscript digest",
      "round-trip through parseCaptions",
      "pickCaption",
      "classify",
      "catalogFromReport",
    ],
    fixtures: "self-authored only; no child process started",
    transcript_sha256: digest(transcript),
  }),
);
