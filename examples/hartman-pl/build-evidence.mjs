import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--rea-root")) {
  throw new Error("Usage: node build-evidence.mjs [--rea-root /path/to/rea]");
}
const reaRoot = args.length === 0 ? resolve(here, "../..") : resolve(args[1]);
const [
  { createEvidence },
  { createEvidenceBundle, parseEvidenceBundle, serializeEvidenceBundle },
  { createResidualUnknown },
] = await Promise.all([
  import(pathToFileURL(resolve(reaRoot, "dist/domain/evidence.js")).href),
  import(pathToFileURL(resolve(reaRoot, "dist/domain/evidenceBundle.js")).href),
  import(
    pathToFileURL(resolve(reaRoot, "dist/domain/residualUnknown.js")).href
  ),
]);

const inputs = new Map();
for (const name of [
  "zrodla.json",
  "wnioski.json",
  "niewiadome.json",
  "analizy-filmow.json",
]) {
  const bytes = await readFile(resolve(here, name));
  inputs.set(name, {
    data: JSON.parse(bytes.toString("utf8")),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const sourceInput = inputs.get("zrodla.json");
const findingInput = inputs.get("wnioski.json");
const unknownInput = inputs.get("niewiadome.json");
const videoInput = inputs.get("analizy-filmow.json");
const provider = {
  id: "hartman-pl-curation",
  name: "Manual annotations of public sources; not a clinical measurement provider",
  version: "1.0",
};
const records = [];
const sourceEvidence = new Map();
const findingsEvidence = new Map();
function target(name, input) {
  return {
    path: "examples/hartman-pl/" + name,
    sha256: input.sha256,
    format: "file",
  };
}

for (const source of sourceInput.data.sources) {
  if (sourceEvidence.has(source.id))
    throw new Error("Duplicate source: " + source.id);
  const evidence = createEvidence(
    target("zrodla.json", sourceInput),
    provider,
    {
      predicateType: "hartman-pl.source-metadata",
      operation: "annotate-public-source",
      parameters: { source_id: source.id, url: source.url },
      result: source,
      confidence: "observed",
      authority: "historical-reference",
      limitations: [
        "Manually recorded metadata after source reading; REA did not fetch this URL.",
        "Observation concerns the source metadata and reading scope, not a measured clinical mechanism.",
        source.limitation,
      ],
      locations: [{ kind: "artifact-path", path: source.url }],
    },
  );
  records.push(evidence);
  sourceEvidence.set(source.id, evidence.evidence_id);
}
function links(ids) {
  return ids.map((id) => {
    const evidenceId = sourceEvidence.get(id);
    if (evidenceId === undefined) throw new Error("Missing source: " + id);
    return evidenceId;
  });
}
for (const finding of findingInput.data.findings) {
  if (findingsEvidence.has(finding.id))
    throw new Error("Duplicate finding: " + finding.id);
  const evidence = createEvidence(
    target("wnioski.json", findingInput),
    provider,
    {
      predicateType: "hartman-pl.interpretation",
      operation: "record-source-interpretation",
      parameters: { finding_id: finding.id, kind: finding.kind },
      result: finding,
      confidence: "inferred",
      authority: "analyst-inference",
      limitations: [
        "This record is a paraphrase or educational interpretation, not independent clinical validation.",
        finding.clinical_status,
      ],
      locations: [
        {
          kind: "artifact-path",
          path: "examples/hartman-pl/wnioski.json#" + finding.id,
        },
      ],
      evidenceLinks: links(finding.source_ids),
    },
  );
  records.push(evidence);
  findingsEvidence.set(finding.id, evidence.evidence_id);
}

for (const video of videoInput.data.videos) {
  const provenance = createEvidence(
    target("analizy-filmow.json", videoInput),
    provider,
    {
      predicateType: "hartman-pl.caption-provenance",
      operation: "record-caption-analysis-provenance",
      parameters: { video_id: video.video_id },
      result: {
        video_id: video.video_id,
        transcript_sha256: video.transcript_sha256,
        cue_count: video.cue_count,
        caption_kind: video.caption_kind,
        acquisition: videoInput.data.acquisition,
        coverage: videoInput.data.coverage,
      },
      confidence: "observed",
      authority: "historical-reference",
      limitations: [
        "Metadata captured from the actual local caption import and annotation workflow.",
        "The private full caption artifact is identified by digest but is not included in this public bundle.",
        "Automatic caption accuracy and clinical mechanisms have not been independently validated.",
      ],
      evidenceLinks: links([video.source_id]),
    },
  );
  records.push(provenance);
  for (const finding of video.findings) {
    records.push(
      createEvidence(target("analizy-filmow.json", videoInput), provider, {
        predicateType: "hartman-pl.video-interpretation",
        operation: "record-timestamped-interpretation",
        parameters: { video_id: video.video_id, finding_id: finding.id },
        result: finding,
        confidence: "inferred",
        authority: "analyst-inference",
        limitations: [
          "Manual interpretation of automatic captions; not an automatic clinical inference.",
          "Visual review status: " + finding.visual_review,
          finding.limitation ??
            "Author's statement; not independent clinical validation.",
        ],
        locations: [{ kind: "artifact-path", path: finding.source_url }],
        evidenceLinks: [provenance.evidence_id, ...links([video.source_id])],
      }),
    );
  }
}

const unknowns = [];
const unknownIds = new Set();
for (const unknown of unknownInput.data.unknowns) {
  if (unknownIds.has(unknown.id))
    throw new Error("Duplicate unknown: " + unknown.id);
  unknownIds.add(unknown.id);
  const supporting = links(unknown.source_ids);
  const mutation = createEvidence(undefined, provider, {
    predicateType: "rea.residual-unknown-mutation",
    operation: "record-unknown",
    parameters: { local_id: unknown.id },
    result: { question: unknown.question, needed: unknown.needed },
    confidence: "inferred",
    authority: "analyst-inference",
    limitations: [
      "An open review question; no resolution or clinical verification is claimed.",
    ],
    evidenceLinks: supporting,
  });
  records.push(mutation);
  unknowns.push(
    createResidualUnknown(
      {
        question: unknown.question,
        domain: "Public-source reconstruction of UHPC",
        severity: unknown.severity,
        supporting_evidence_ids: supporting,
        contradicting_evidence_ids: [],
        required_authority: "external-service",
        required_confidence: "observed",
        required_environment: null,
        recommended_probes: [
          { operation: "manual-source-review", rationale: unknown.needed },
        ],
        relationships: [],
      },
      mutation.evidence_id,
      null,
    ),
  );
}

const bundle = parseEvidenceBundle(createEvidenceBundle(records, unknowns));
await writeFile(
  resolve(here, "rea-evidence.json"),
  serializeEvidenceBundle(bundle) + "\n",
);
console.log(
  JSON.stringify({
    sources: sourceEvidence.size,
    findings: findingsEvidence.size,
    video_findings: videoInput.data.videos.reduce(
      (count, video) => count + video.findings.length,
      0,
    ),
    unknowns: unknowns.length,
    records: records.length,
    output: "examples/hartman-pl/rea-evidence.json",
  }),
);
