import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { parseCaptions, videoIdentity, validateFindings } from "./youtube.mjs";

export const TOPICS = {
  relative_motion:
    /\brelative (?:motion|movement|motions|movements)\b|ruch\w* (?:względn|relatywn)/iu,
  orientation: /\b(?:orientation|oriented|orienting)\b|orientacj|zorientowan/iu,
  compression_expansion:
    /\b(?:compress\w*|expand\w*|expansion)\b|kompresj|ekspansj|rozpręż|rozszerz|ścisk/iu,
  breathing_pressure:
    /\b(?:breath\w*|respirat\w*|inhal\w*|exhal\w*|pressure|diaphragm)\b|oddych|oddech|wdech|wydech|ciśnien|przepon/iu,
  propulsion:
    /\b(?:propuls\w*|gait|midstance|mid stance)\b|propulsj|napęd|chód|chodu/iu,
  isa_archetypes:
    /\b(?:infrasternal|infra sternal|isa|archetype|narrow|wide)\b|archetyp|podmostkow|wąsk|szerok/iu,
  constraints:
    /\b(?:constraint\w*|constrain\w*|contact\w*|gravity|ground)\b|ogranicz|kontakt|grawitacj|podłoż/iu,
  intervention_learning:
    /\b(?:retest\w*|reassess\w*|learn\w*|adapt\w*|intervention\w*|representation\w*)\b|uczen|uczy|adaptacj|interwencj|reprezentacj|ponown\w* test/iu,
  tradeoffs:
    /\b(?:trade[ -]?offs?|compensat\w*|strateg\w*)\b|kompromis|kompensacj|strateg/iu,
  speed_force:
    /\b(?:speed|velocity|force|athlet\w*|sprint\w*|decelerat\w*)\b|prędkoś|szybkoś|sił|sportow|hamowan/iu,
};

const digest = (text) => createHash("sha256").update(text).digest("hex");

/** Validate identities before joining the observed inventory to caption files. */
export function validateCatalog(catalog) {
  if (!Array.isArray(catalog.entries))
    throw new Error("Missing catalog entries.");
  const seen = new Set();
  for (const entry of catalog.entries) {
    const identity = videoIdentity(entry.url);
    if (identity.video_id !== entry.video_id || seen.has(entry.video_id))
      throw new Error(
        "Duplicate or mismatched catalog identity: " + entry.video_id,
      );
    seen.add(entry.video_id);
  }
  return catalog;
}

/** Compare text presence, never infer clinical rules from lexical matches. */
export function topicWindows(cues, windowSeconds = 60) {
  if (!Number.isFinite(windowSeconds) || windowSeconds <= 0)
    throw new Error("Window must be positive finite seconds.");
  const buckets = new Map();
  for (const cue of cues) {
    const start = Math.floor(cue.start / windowSeconds) * windowSeconds;
    const bucket = buckets.get(start) ?? { start, cue_ids: [], text: "" };
    bucket.cue_ids.push(cue.id);
    bucket.text += " " + cue.text;
    buckets.set(start, bucket);
  }
  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    topics: Object.entries(TOPICS)
      .filter(([, pattern]) => pattern.test(bucket.text))
      .map(([name]) => name),
  }));
}

function captionRecord(entry, bytes) {
  const raw = bytes.toString("utf8");
  if (!raw.match(/^Video ID:\s*(\S+)/mu))
    throw new Error(
      "Bulk text import requires a Video ID header: " + entry.video_id,
    );
  const parsed = parseCaptions(raw, videoIdentity(entry.url));
  const windows = topicWindows(parsed.cues);
  const topics = [...new Set(windows.flatMap((window) => window.topics))];
  return {
    ...entry,
    status: "indexed",
    transcript_sha256: digest(bytes),
    text_sha256: digest(parsed.cues.map((cue) => cue.text).join("\n")),
    language: parsed.language,
    caption_kind: parsed.caption_kind,
    cue_count: parsed.cues.length,
    last_caption_start: parsed.cues.at(-1).start,
    duration_seconds: null,
    duration_basis: "Unknown; last caption start is not video duration",
    word_count_with_caption_overlap: parsed.cues.reduce(
      (total, cue) =>
        total +
        (cue.text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0),
      0,
    ),
    topics,
    cues: parsed.cues,
    windows,
    semantic_review: "not_reviewed",
    visual_review: "not_reviewed",
  };
}

/** Import the complete available text while keeping full captions private. */
export function indexCorpus(catalog, captions, acquisition = [], reviews = []) {
  validateCatalog(catalog);
  const states = new Map(acquisition.map((row) => [row.video_id, row]));
  const indexed = [];
  const unavailable = [];
  for (const entry of catalog.entries) {
    const bytes = captions.get(entry.video_id);
    if (bytes !== undefined) indexed.push(captionRecord(entry, bytes));
    else
      unavailable.push({
        ...entry,
        status: states.get(entry.video_id)?.status ?? "not_attempted",
        reason: states.get(entry.video_id)?.reason ?? null,
      });
  }
  const known = new Set(catalog.entries.map((entry) => entry.video_id));
  if ([...captions.keys()].some((id) => !known.has(id)))
    throw new Error("Caption directory contains a video outside this catalog.");
  const corpus = { indexed, unavailable };
  applyReviews(corpus, reviews);
  return corpus;
}

function applyReviews(corpus, reviews) {
  const reviewed = new Set();
  for (const review of reviews) {
    if (!["selected_windows", "whole_caption_text"].includes(review.scope))
      throw new Error("Explicit review scope is required.");
    if (reviewed.has(review.video_id))
      throw new Error("Duplicate review identity.");
    const film = corpus.indexed.find(
      (candidate) => candidate.video_id === review.video_id,
    );
    if (!film)
      throw new Error("Reviewed transcript is absent from the corpus.");
    film.findings = validateFindings(review, film);
    film.semantic_review = review.scope;
    reviewed.add(review.video_id);
  }
}

/** Publish hashes, coverage and search locations; exclude third-party full text. */
export function publicReport(catalog, corpus) {
  const topics = Object.keys(TOPICS).map((topic) => ({
    topic,
    films: corpus.indexed.filter((film) => film.topics.includes(topic)).length,
    windows: corpus.indexed.reduce(
      (count, film) =>
        count +
        film.windows.filter((window) => window.topics.includes(topic)).length,
      0,
    ),
  }));
  const pairs = new Map();
  for (const film of corpus.indexed) {
    const filmPairs = new Set();
    for (const window of film.windows) {
      const names = [...window.topics].sort();
      for (let i = 0; i < names.length; i += 1)
        for (let j = i + 1; j < names.length; j += 1)
          filmPairs.add(names[i] + "+" + names[j]);
    }
    for (const pair of filmPairs) pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
  }
  const duplicateGroups = new Map();
  for (const film of corpus.indexed) {
    const group = duplicateGroups.get(film.text_sha256) ?? [];
    group.push(film.video_id);
    duplicateGroups.set(film.text_sha256, group);
  }
  return {
    schema_version: 1,
    generated_on: new Date().toISOString(),
    inventory: {
      reported_header_count: catalog.header_video_count ?? null,
      observed_unique_ids: catalog.entries.length,
      complete: catalog.inventory_complete === true,
      source: catalog.source,
    },
    coverage: {
      indexed_transcripts: corpus.indexed.length,
      pending_or_unavailable: corpus.unavailable.length,
      cues: corpus.indexed.reduce((count, film) => count + film.cue_count, 0),
      words_with_caption_overlap: corpus.indexed.reduce(
        (count, film) => count + film.word_count_with_caption_overlap,
        0,
      ),
      analyst_reviewed: corpus.indexed.filter(
        (film) => film.semantic_review === "whole_caption_text",
      ).length,
      selected_windows_reviewed: corpus.indexed.filter(
        (film) => film.semantic_review === "selected_windows",
      ).length,
      visual_reviewed: 0,
    },
    languages: [...new Set(corpus.indexed.map((film) => film.language))].map(
      (language) => ({
        language,
        films: corpus.indexed.filter((film) => film.language === language)
          .length,
      }),
    ),
    method:
      "Lexical presence in full available captions; pair counts mean co-occurrence within a 60-second bucket in distinct films, not a causal relationship or clinical validation. Exact-text duplicates are flagged but counts include them. ASR false positives and false negatives remain possible.",
    topics,
    cooccurrence: [...pairs]
      .map(([pair, films]) => ({ pair, films }))
      .sort((a, b) => b.films - a.films),
    exact_text_duplicates: [...duplicateGroups.values()].filter(
      (group) => group.length > 1,
    ),
    films: corpus.indexed.map(({ cues: _cues, windows, ...film }) => ({
      ...film,
      topic_first_locations: Object.fromEntries(
        film.topics.map((topic) => {
          const window = windows.find((candidate) =>
            candidate.topics.includes(topic),
          );
          return [
            topic,
            { start: window.start, first_cue_id: window.cue_ids[0] },
          ];
        }),
      ),
    })),
    unavailable: corpus.unavailable,
  };
}

async function readCaptions(directory) {
  const captions = new Map();
  for (const file of (await readdir(directory)).sort()) {
    if (!/^[\w-]{11}\.txt$/u.test(file)) continue;
    captions.set(file.slice(0, -4), await readFile(join(directory, file)));
  }
  return captions;
}

function options(args, allowedKeys) {
  const parsed = {};
  const allowed = new Set(allowedKeys);
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!key.startsWith("--") || !args[index + 1])
      throw new Error("Expected --option value.");
    if (!allowed.has(key.slice(2)) || Object.hasOwn(parsed, key.slice(2)))
      throw new Error("Unknown or duplicate option: " + key);
    parsed[key.slice(2)] = args[index + 1];
  }
  return parsed;
}

function required(options, keys) {
  for (const key of keys)
    if (!options[key]) throw new Error("Missing --" + key);
}

/** Return every matching 60-second source window with identity and cue references. */
export function queryCorpus(corpus, query) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) throw new Error("Query must not be empty.");
  return corpus.indexed.flatMap((film) =>
    film.windows
      .filter((window) => window.text.toLocaleLowerCase().includes(needle))
      .map((window) => ({
        video_id: film.video_id,
        url: film.url,
        title: film.title,
        language: film.language,
        transcript_sha256: film.transcript_sha256,
        ...window,
      })),
  );
}

async function searchCorpus(options) {
  required(options, ["index", "query", "out"]);
  const index = JSON.parse(await readFile(resolve(options.index), "utf8"));
  const matches = queryCorpus(index, options.query);
  await writeFile(
    resolve(options.out),
    JSON.stringify(
      {
        query: options.query,
        method:
          "Substring matching in 60-second buckets; source text is untrusted and requires interpretation in context.",
        matches,
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({
      matches: matches.length,
      films: new Set(matches.map((match) => match.video_id)).size,
    }),
  );
}

/** Run reproducible offline corpus analysis; never overwrite a previous run. */
export async function main(args = process.argv.slice(2)) {
  if (args[0] === "search") {
    await searchCorpus(options(args.slice(1), ["index", "query", "out"]));
    return;
  }
  const opt = options(args, [
    "catalog",
    "captions",
    "out",
    "manifest",
    "reviews",
  ]);
  required(opt, ["catalog", "captions", "out"]);
  const catalog = JSON.parse(await readFile(resolve(opt.catalog), "utf8"));
  const manifest = opt.manifest
    ? JSON.parse(await readFile(resolve(opt.manifest), "utf8"))
    : { results: [] };
  const reviews = opt.reviews
    ? JSON.parse(await readFile(resolve(opt.reviews), "utf8"))
    : [];
  const corpus = indexCorpus(
    catalog,
    await readCaptions(resolve(opt.captions)),
    manifest.results,
    reviews,
  );
  await mkdir(resolve(opt.out));
  await writeFile(
    join(resolve(opt.out), "private-index.json"),
    JSON.stringify(corpus),
    {
      flag: "wx",
    },
  );
  const report = publicReport(catalog, corpus);
  report.generator = {
    script: "examples/hartman-pl/corpus.mjs",
    sha256: digest(await readFile(fileURLToPath(import.meta.url))),
    topic_patterns: Object.fromEntries(
      Object.entries(TOPICS).map(([name, pattern]) => [name, pattern.source]),
    ),
    word_count_method:
      "Unicode letters/numbers with internal apostrophes/hyphens; overlaps retained",
  };
  await writeFile(
    join(resolve(opt.out), "report.json"),
    JSON.stringify(report, null, 2) + "\n",
    {
      flag: "wx",
    },
  );
  console.log(JSON.stringify(report.coverage));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
