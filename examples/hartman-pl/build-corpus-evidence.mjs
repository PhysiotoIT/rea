import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--rea-root"))
  throw new Error(
    "Usage: node build-corpus-evidence.mjs [--rea-root /path/to/built/rea]",
  );
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
const bytes = await readFile(resolve(here, "korpus.json"));
const report = JSON.parse(bytes.toString("utf8"));
const target = {
  path: "examples/hartman-pl/korpus.json",
  sha256: createHash("sha256").update(bytes).digest("hex"),
  format: "file",
};
const provider = {
  id: "hartman-caption-corpus",
  name: "Caption indexing and explicitly scoped analyst review",
  version: "1.0",
};
const records = [];
function record(
  predicateType,
  result,
  evidenceLinks = [],
  confidence = "observed",
) {
  const evidence = createEvidence(target, provider, {
    predicateType,
    operation: "record-caption-corpus-result",
    parameters: {},
    result,
    confidence,
    authority:
      confidence === "observed" ? "historical-reference" : "analyst-inference",
    limitations: [
      "REA preserves evidence identity and links; it does not validate clinical mechanisms.",
      "Full third-party captions remain private. Metadata, matching counts and manual interpretations have different scopes.",
    ],
    evidenceLinks,
  });
  records.push(evidence);
  return evidence.evidence_id;
}
const inventoryId = record("hartman-pl.corpus-inventory", report.inventory);
const summaryId = record(
  "hartman-pl.corpus-processing",
  {
    coverage: report.coverage,
    method: report.method,
    languages: report.languages,
    generator: report.generator,
  },
  [inventoryId],
);
for (const topic of report.topics)
  record(
    "hartman-pl.lexical-presence",
    {
      ...topic,
      meaning:
        "Matching search vocabulary, not a verified author rule or independent corroboration",
    },
    [summaryId],
  );
for (const film of report.films.filter(
  (candidate) => candidate.findings?.length,
)) {
  const provenanceId = record(
    "hartman-pl.corpus-review-provenance",
    {
      video_id: film.video_id,
      url: film.url,
      transcript_sha256: film.transcript_sha256,
      cue_count: film.cue_count,
      language: film.language,
      caption_kind: film.caption_kind,
      semantic_review: film.semantic_review,
      visual_review: film.visual_review,
    },
    [summaryId],
  );
  for (const finding of film.findings)
    record(
      "hartman-pl.corpus-interpretation",
      { video_id: film.video_id, ...finding },
      [provenanceId],
      "inferred",
    );
}
const questions = [
  {
    question:
      "Which unindexed films have captions that can actually be obtained?",
    rationale:
      "Export-unavailable is a transport result, not proof of permanent absence; preserve per-video status and use only permitted access.",
    severity: "medium",
  },
  {
    question:
      "Which ASR or translated terms change the interpretation of important rules?",
    rationale:
      "Compare original-language speech and captions for disputed terminology before strengthening a claim.",
    severity: "medium",
  },
  {
    question:
      "Which verbal explanations require visual or independent clinical verification?",
    rationale:
      "Review demonstrations separately; use independent primary studies for claims of mechanism, diagnosis or efficacy.",
    severity: "high",
  },
];
const unknowns = questions.map((question) => {
  const mutationId = record(
    "rea.residual-unknown-mutation",
    question,
    [summaryId],
    "inferred",
  );
  return createResidualUnknown(
    {
      question: question.question,
      domain: "Public caption reconstruction of UHPC",
      severity: question.severity,
      supporting_evidence_ids: [summaryId],
      contradicting_evidence_ids: [],
      required_authority: "external-service",
      required_confidence: "observed",
      required_environment: null,
      recommended_probes: [
        { operation: "manual-source-review", rationale: question.rationale },
      ],
      relationships: [],
    },
    mutationId,
    null,
  );
});
const bundle = parseEvidenceBundle(createEvidenceBundle(records, unknowns));
await writeFile(
  resolve(here, "rea-corpus-evidence.json"),
  serializeEvidenceBundle(bundle) + "\n",
);
console.log(
  JSON.stringify({
    records: records.length,
    unknowns: unknowns.length,
    indexed: report.coverage.indexed_transcripts,
    reviewed_sources: report.films.filter((film) => film.findings?.length)
      .length,
  }),
);
