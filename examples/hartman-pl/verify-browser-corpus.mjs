import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { harvestBatch, restoreCopies } from "./browser-corpus.mjs";

const root = await mkdtemp(join(tmpdir(), "hartman-driver-test-"));
const directory = join(root, "copies");
await mkdir(directory);
const entry = {
  video_id: "00000000001",
  url: "https://www.youtube.com/watch?v=00000000001",
};
const exportPath = join(root, "export.txt");
const body =
  "Video ID: 00000000001\nLanguage: en\n[0:00] self-authored fixture\n[0:10] end";
await writeFile(exportPath, body);
let exports = 0;
let navigations = 0;
const tab = {
  url: async () => entry.url,
  content: {
    exportYouTubeTranscript: async () => {
      exports += 1;
      return exportPath;
    },
  },
  goto: async () => {
    navigations += 1;
  },
  getAXState: async () => "Self-authored test page without challenge",
};
const job = {
  inventory: new Map([[entry.video_id, entry]]),
  queue: [],
  cursor: 0,
  records: [],
  directory,
  manifestPath: join(root, "manifest.json"),
  statePath: join(root, "state.json"),
  capturedOn: "fixture",
  halt: false,
};
assert.equal((await harvestBatch([tab], job)).captions_obtained, 1);
assert.equal(
  await readFile(join(directory, entry.video_id + ".txt"), "utf8"),
  body,
);
await harvestBatch([tab], job);
assert.equal(exports, 1);
await unlink(join(directory, entry.video_id + ".txt"));
assert.equal((await restoreCopies(job.records, directory)).restored, 1);
assert.equal((await restoreCopies(job.records, directory)).restored, 0);

const fresh = { ...job, records: [] };
await writeFile(exportPath, "Video ID: 00000000002\n[0:00] wrong identity");
await harvestBatch([tab], fresh);
assert.match(fresh.records[0].reason, /identity mismatch/u);
assert.equal(
  await readFile(join(directory, entry.video_id + ".txt"), "utf8"),
  body,
);
await writeFile(exportPath, body + "\n[0:20] different source version");
await assert.rejects(
  harvestBatch([tab], { ...job, records: [] }),
  /different|version|conflict/iu,
);
assert.equal(
  await readFile(join(directory, entry.video_id + ".txt"), "utf8"),
  body,
);

const blocked = {
  ...tab,
  content: {
    exportYouTubeTranscript: async () => {
      throw Error("Fixture export failure");
    },
  },
  getAXState: async () =>
    "Verify you are human — self-authored blocking fixture",
};
const halted = { ...job, records: [], queue: [entry] };
assert.equal((await harvestBatch([blocked], halted)).halt, true);
assert.equal(halted.records[0].status, "blocked");
assert.equal(navigations, 0);
await assert.rejects(harvestBatch([tab], halted), /halted/u);
const outside = { ...job, records: [], inventory: new Map() };
await harvestBatch([tab], outside);
assert.equal(outside.records[0].status, "error");
assert.match(outside.records[0].reason, /validated inventory|outside/iu);
console.log(
  "Browser driver fixture checks passed: source identity, resume, restore, no overwrite and stop on observed challenge. Actual browser acquisition is recorded separately.",
);
