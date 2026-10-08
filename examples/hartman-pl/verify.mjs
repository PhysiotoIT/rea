import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--rea-root")) {
  throw new Error("Usage: node verify.mjs [--rea-root /path/to/rea]");
}
const reaRoot = args.length === 0 ? resolve(here, "../..") : resolve(args[1]);
const { parseEvidenceBundle } = await import(
  pathToFileURL(resolve(reaRoot, "dist/domain/evidenceBundle.js")).href
);
async function json(name) {
  return JSON.parse(await readFile(resolve(here, name), "utf8"));
}
const sourceData = await json("zrodla.json");
const findingData = await json("wnioski.json");
const unknownData = await json("niewiadome.json");
const videoData = await json("analizy-filmow.json");
const bundle = parseEvidenceBundle(await json("rea-evidence.json"));
const sourceIds = new Set(sourceData.sources.map((item) => item.id));
assert.equal(sourceIds.size, sourceData.sources.length, "Duplicate source IDs");
assert.equal(
  new Set(findingData.findings.map((item) => item.id)).size,
  findingData.findings.length,
);
assert.equal(
  new Set(unknownData.unknowns.map((item) => item.id)).size,
  unknownData.unknowns.length,
);
for (const source of sourceData.sources) {
  assert.ok(new URL(source.url).protocol === "https:");
  assert.ok(source.read_level && source.limitation);
  if (source.published_on !== null)
    assert.ok(/^\d{4}-\d{2}(?:-\d{2})?$/u.test(source.published_on));
}
const sourceById = new Map(
  sourceData.sources.map((source) => [source.id, source]),
);
const allowedKinds = new Set([
  "opis_autora",
  "badanie_podstawowe",
  "interpretacja_dydaktyczna",
]);
for (const finding of findingData.findings) {
  assert.ok(allowedKinds.has(finding.kind));
  assert.ok(finding.text && finding.clinical_status);
  for (const id of finding.source_ids)
    assert.ok(sourceIds.has(id), "Dangling source " + id);
  if (finding.kind !== "interpretacja_dydaktyczna")
    assert.ok(finding.source_ids.length > 0);
  if (finding.kind === "badanie_podstawowe") {
    assert.ok(
      finding.source_ids.every(
        (id) => sourceById.get(id).kind === "primary_research",
      ),
    );
  }
}
for (const unknown of unknownData.unknowns) {
  assert.ok(unknown.question && unknown.needed);
  for (const id of unknown.source_ids) assert.ok(sourceIds.has(id));
}
let sourceReferences = 0;
let localLinks = 0;
const documents = (await readdir(here)).filter((name) => name.endsWith(".md"));
for (const name of documents) {
  const content = await readFile(resolve(here, name), "utf8");
  for (const match of content.matchAll(/\bS\d{2}\b/gu)) {
    assert.ok(
      sourceIds.has(match[0]),
      "Unknown reference in " + name + ": " + match[0],
    );
    sourceReferences += 1;
  }
  for (const match of content.matchAll(/\]\(([^)]+)\)/gu)) {
    const link = match[1].split("#")[0];
    if (/^(?:https?:|mailto:)/u.test(link) || link === "") continue;
    await access(resolve(here, link));
    localLinks += 1;
  }
}
for (const name of ["zrodla.json", "wnioski.json", "analizy-filmow.json"]) {
  const sha = createHash("sha256")
    .update(await readFile(resolve(here, name)))
    .digest("hex");
  const matching = bundle.records.filter(
    (record) => record.subject?.name === name,
  );
  assert.ok(matching.length > 0);
  assert.ok(
    matching.every((record) => record.subject.digest.sha256 === sha),
    "Stale evidence for " + name,
  );
}
const observed = bundle.records.filter(
  (record) => record.confidence === "observed",
);
assert.ok(
  observed.every((record) =>
    ["hartman-pl.source-metadata", "hartman-pl.caption-provenance"].includes(
      record.predicate_type,
    ),
  ),
);
const interpretations = bundle.records.filter(
  (record) => record.predicate_type === "hartman-pl.interpretation",
);
assert.equal(interpretations.length, findingData.findings.length);
assert.ok(
  interpretations.every(
    (record) =>
      record.confidence === "inferred" &&
      record.authority === "analyst-inference",
  ),
);
assert.equal(bundle.unknowns.length, unknownData.unknowns.length);
assert.ok(
  bundle.unknowns.every(
    (unknown) => unknown.status === "open" && unknown.resolution === null,
  ),
);
let videoFindings = 0;
let videoCues = 0;
for (const video of videoData.videos) {
  assert.ok(sourceIds.has(video.source_id));
  assert.equal(
    sourceById.get(video.source_id).transcript_sha256,
    video.transcript_sha256,
  );
  assert.equal(sourceById.get(video.source_id).caption_cues, video.cue_count);
  assert.ok(/^[a-f0-9]{64}$/u.test(video.transcript_sha256));
  assert.ok(
    video.findings.every(
      (finding) =>
        finding.cue_ids.length > 0 &&
        finding.confidence === "analyst-inference" &&
        finding.clinical_validation === "not_performed",
    ),
  );
  videoFindings += video.findings.length;
  videoCues += video.cue_count;
}
assert.equal(
  bundle.records.filter(
    (record) => record.predicate_type === "hartman-pl.video-interpretation",
  ).length,
  videoFindings,
);
assert.equal(
  bundle.records.filter(
    (record) => record.predicate_type === "hartman-pl.caption-provenance",
  ).length,
  videoData.videos.length,
);

const result = {
  status: "passed",
  sources: sourceIds.size,
  findings: findingData.findings.length,
  videos: videoData.videos.length,
  video_findings: videoFindings,
  video_cues: videoCues,
  open_unknowns: unknownData.unknowns.length,
  evidence_records: bundle.records.length,
  documents: documents.length,
  source_references_checked: sourceReferences,
  local_links_checked: localLinks,
  clinical_validation: "not_performed",
  scope:
    "Local structure, source references, evidence integrity and explicit uncertainty; not a clinical effectiveness test.",
};
await writeFile(
  resolve(here, "verification.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result));
