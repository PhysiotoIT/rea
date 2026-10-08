import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  videoIdentity,
  seconds,
  parseCaptions,
  validateFindings,
} from "./youtube.mjs";

const video = videoIdentity("https://youtu.be/PQZRlndm4cw?t=225");
assert.equal(video.video_id, "PQZRlndm4cw");
assert.equal(
  videoIdentity("https://www.youtube.com/embed/PQZRlndm4cw").video_id,
  video.video_id,
);
for (const bad of [
  "https://youtube.com.evil.example/watch?v=PQZRlndm4cw",
  "http://youtu.be/PQZRlndm4cw",
  "https://youtube.com/playlist?list=test",
])
  assert.throws(() => videoIdentity(bad));
assert.equal(seconds("01:02:03,500"), 3723.5);
assert.throws(() => seconds("1:70"));

// Self-authored captions: no third-party transcript is used as a test fixture.
const fixture =
  "YouTube transcript\nVideo ID: PQZRlndm4cw\nLanguage: en\nCaptions: auto-generated\n\n[0:00] Move one block.\n[0:04] Move both blocks.\n";
const parsed = parseCaptions(fixture, video, { duration: 8 });
assert.deepEqual(
  parsed.cues.map(({ start, end, text }) => ({ start, end, text })),
  [
    { start: 0, end: 4, text: "Move one block." },
    { start: 4, end: 8, text: "Move both blocks." },
  ],
);
assert.throws(() =>
  parseCaptions(fixture, { ...video, video_id: "N0GDdA0MPCo" }),
);
assert.throws(() => parseCaptions("Only a video description", video));
assert.throws(() => parseCaptions("[0:04] First\n[0:01] Second", video));
const vtt =
  "WEBVTT\n\n00:00:01.000 --> 00:00:03.000 align:start\n<c>One &amp; two.</c>\n\n";
const srt = "1\n00:00:01,000 --> 00:00:03,000\nOne & two.\n\n";
for (const captions of [vtt, srt]) {
  const cue = parseCaptions(captions, video).cues[0];
  assert.equal(cue.start, 1);
  assert.equal(cue.end, 3);
  assert.equal(cue.text, "One & two.");
}
const json3 = JSON.stringify({
  events: [
    { tStartMs: 1000, dDurationMs: 2000, segs: [{ utf8: "One & two." }] },
  ],
});
assert.equal(parseCaptions(json3, video).cues[0].end, 3);
assert.equal(parseCaptions(json3, video).cues[0].text, "One & two.");

const transcript = {
  ...video,
  duration: 8,
  transcript_sha256: "fixture-digest",
  ...parsed,
};
const annotation = {
  video_id: video.video_id,
  transcript_sha256: "fixture-digest",
  findings: [
    {
      id: "F1",
      start: 0,
      end: 4,
      kind: "educational_interpretation",
      summary_pl: "Przesuń jeden klocek.",
      visual_review: "pending",
    },
  ],
};
assert.deepEqual(validateFindings(annotation, transcript)[0].cue_ids, [
  "cue-0001",
]);
assert.throws(() =>
  validateFindings({ ...annotation, transcript_sha256: "changed" }, transcript),
);
assert.throws(() =>
  validateFindings(
    { ...annotation, findings: [{ ...annotation.findings[0], end: 12 }] },
    transcript,
  ),
);

const temporary = await mkdtemp(resolve(tmpdir(), "hartman-youtube-check-"));
const cli = fileURLToPath(new URL("./youtube.mjs", import.meta.url));
function run(args) {
  return execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}
try {
  const captionPath = resolve(temporary, "captions.txt");
  const importedPath = resolve(temporary, "transcript.json");
  const packedPath = resolve(temporary, "pack.json");
  const findingsPath = resolve(temporary, "findings.json");
  const analyzedPath = resolve(temporary, "analysis.json");
  await writeFile(captionPath, fixture);
  run([
    "import",
    "--url",
    video.url,
    "--transcript",
    captionPath,
    "--duration",
    "8",
    "--out",
    importedPath,
  ]);
  const imported = JSON.parse(await readFile(importedPath, "utf8"));
  assert.equal(
    imported.transcript_sha256,
    createHash("sha256").update(fixture).digest("hex"),
  );
  const search = JSON.parse(
    run(["search", "--input", importedPath, "--query", "both"]),
  );
  assert.equal(search.results[0].url, video.url + "&t=4s");
  run(["pack", "--input", importedPath, "--window", "4", "--out", packedPath]);
  assert.equal(
    JSON.parse(await readFile(packedPath, "utf8")).windows.length,
    2,
  );
  await writeFile(
    findingsPath,
    JSON.stringify({
      ...annotation,
      transcript_sha256: imported.transcript_sha256,
    }),
  );
  run([
    "annotate",
    "--input",
    importedPath,
    "--findings",
    findingsPath,
    "--out",
    analyzedPath,
  ]);
  const analyzed = JSON.parse(await readFile(analyzedPath, "utf8"));
  assert.equal(analyzed.findings[0].visual_review, "pending");
  assert.equal(analyzed.findings[0].clinical_validation, "not_performed");
  assert.throws(() =>
    run([
      "pack",
      "--input",
      importedPath,
      "--window",
      "0",
      "--out",
      resolve(temporary, "invalid.json"),
    ]),
  );
  console.log(
    JSON.stringify({
      status: "passed",
      formats: ["timestamped-text", "vtt", "srt", "json3"],
      workflows: ["import", "search", "pack", "annotate"],
      youtube_fetch: "optional yt-dlp; not verified by this fixture",
      video_frames: "separate real ffmpeg check",
    }),
  );
} finally {
  await rm(temporary, { recursive: true });
}
