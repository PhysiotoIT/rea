/**
 * Bulk, resumable YouTube caption acquisition for the Hartman corpus.
 *
 * `youtube.mjs fetch` downloads captions for one URL and refuses to reuse its
 * output directory, and `corpus.mjs` requires a video list from outside the
 * repository. This tool fills the gap between them: it walks a catalog of
 * observed videos, acquires every missing caption, converts it to the exact
 * canonical transcript format the corpus pipeline consumes, and reports what
 * happened per video.
 *
 * The canonical format is byte-compatible with the browser exports the corpus
 * was originally built from, so a re-acquired transcript hashes identically to
 * the recorded one. `--expect` turns that into a fidelity check: every video
 * whose digest disagrees is reported instead of silently replacing the source.
 *
 * Usage:
 *   node examples/hartman-pl/fetch-captions.mjs \
 *     --catalog work/catalog.json \
 *     --out work/captions \
 *     --work work/scratch \
 *     [--manifest work/acquisition.json] \
 *     [--expect examples/hartman-pl/korpus.json] \
 *     [--report work/acquisition-report.json] \
 *     [--limit 20] [--only id1,id2] [--lang "en.*"] \
 *     [--delay 1200] [--retries 3] [--force] [--verbose]
 *
 * `--expect` accepts any artifact holding `films[]` with `video_id` and
 * `transcript_sha256` (korpus.json and korpus-dlugich-filmow.json both qualify).
 *
 * yt-dlp is the acquisition engine and stays bring-your-own. `--ytdlp-py`
 * selects `python -m yt_dlp` instead of a `yt-dlp` executable, which is the
 * only working option inside a sandbox that denies the PyInstaller one-file
 * bootloader a writable extraction directory.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Seconds as `m:ss`, matching the timestamps browser exports contain. */
export function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new Error("Timestamp must be a finite non-negative number.");
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * Turn YouTube JSON3 events into the corpus cue list.
 *
 * Verified against the committed corpus: keeping every event that carries
 * `segs` and dropping whitespace-only ones reproduces both the cue count and
 * the word count of all four sampled films exactly. Newline-only events are
 * separators, not captions.
 */
export function json3Cues(text) {
  const json = JSON.parse(text);
  if (!Array.isArray(json.events))
    throw new Error("Expected YouTube JSON3 events.");
  const cues = [];
  for (const event of json.events) {
    if (!Array.isArray(event.segs)) continue;
    const body = event.segs.map((segment) => segment.utf8 ?? "").join("");
    if (body.trim() === "") continue;
    cues.push({ start: Math.floor(event.tStartMs / 1000), text: body });
  }
  if (cues.length === 0)
    throw new Error("No timestamped captions found in JSON3 input.");
  return cues;
}

/**
 * Render the canonical transcript: header, blank line, `[m:ss] text` rows,
 * LF endings, no trailing newline. Any deviation changes the file digest and
 * breaks the review registry pinned to the recorded hashes.
 */
export function canonicalTranscript(videoId, language, captionKind, cues) {
  const head =
    `YouTube transcript\nVideo ID: ${videoId}\n` +
    `Language: ${language}\nCaptions: ${captionKind}\n\n`;
  return head + cues.map((cue) => `[${clock(cue.start)}] ${cue.text}`).join("\n");
}

export const digest = (text) => createHash("sha256").update(text).digest("hex");

/** Strict `--name value` pairs, as the other tools in this directory use. */
function options(args, allowed, flags = new Set()) {
  const parsed = {};
  const set = new Set(allowed);
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key?.startsWith("--")) throw new Error("Expected --option.");
    const name = key.slice(2);
    if (!set.has(name) || Object.hasOwn(parsed, name))
      throw new Error("Unknown or duplicate option: " + key);
    if (flags.has(name)) {
      parsed[name] = true;
      continue;
    }
    const value = args[index + 1];
    if (value === undefined) throw new Error("Expected --option value.");
    parsed[name] = value;
    index += 1;
  }
  return parsed;
}

function required(parsed, keys) {
  for (const key of keys)
    if (!parsed[key]) throw new Error("Missing --" + key);
}

/** Load the observed video list that corpus.mjs --catalog also consumes. */
export function readCatalog(file) {
  const catalog = JSON.parse(readFileSync(file, "utf8"));
  const entries = catalog.entries ?? catalog.films;
  if (!Array.isArray(entries) || entries.length === 0)
    throw new Error("Catalog has no entries.");
  for (const entry of entries)
    if (!/^[\w-]{11}$/u.test(entry.video_id ?? "") || !entry.url)
      throw new Error("Catalog entry lacks a usable identity.");
  return entries;
}

/** Recorded transcript digests, for optional fidelity checking. */
function readExpected(file) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  const films = data.films ?? data.reviews ?? [];
  const map = new Map();
  for (const film of films)
    if (film.video_id && film.transcript_sha256)
      map.set(film.video_id, film.transcript_sha256);
  return map;
}

/** Pick the acquired caption file: exact language first, never the -orig variant. */
export function pickCaption(files, videoId, preferredLanguage) {
  const mine = files.filter((file) => file.startsWith(videoId + "."));
  const base = preferredLanguage.replace(/\.\*$/u, "");
  const exact = mine.find((file) => file === `${videoId}.${base}.json3`);
  if (exact) return exact;
  const plain = mine.filter(
    (file) => file.endsWith(".json3") && !file.includes("-orig"),
  );
  if (plain.length) return plain.sort()[0];
  const any = mine.filter((file) => file.endsWith(".json3"));
  return any.length ? any.sort()[0] : null;
}

/** Map a yt-dlp log to the corpus acquisition vocabulary. */
export function classify(log, produced) {
  if (produced) return { status: "captions_obtained", reason: null };
  const text = log ?? "";
  if (/429|Too Many Requests/u.test(text))
    return { status: "rate_limited", reason: "YouTube returned HTTP 429" };
  if (/Sign in to confirm|not a bot/u.test(text))
    return { status: "blocked", reason: "YouTube bot check" };
  if (/no subtitles|There are no subtitles/iu.test(text))
    return { status: "unavailable", reason: "No transcript is available for this YouTube video" };
  if (/Private video|members-only|Video unavailable|has been removed/iu.test(text))
    return { status: "unavailable", reason: "Video is not publicly available" };
  if (/requested format|Unable to download video subtitles/iu.test(text))
    return { status: "export_unavailable", reason: "Caption download rejected by YouTube" };
  return { status: "error", reason: "yt-dlp did not produce a caption file" };
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function ytdlpCommand(parsed) {
  if (parsed["ytdlp-py"]) return { command: parsed["ytdlp-py"], prefix: ["-m", "yt_dlp"] };
  return { command: parsed.ytdlp ?? "yt-dlp", prefix: [] };
}

function attempt({ command, prefix }, args, logPath) {
  const fd = openSync(logPath, "w");
  try {
    execFileSync(command, [...prefix, ...args], {
      stdio: ["ignore", fd, fd],
      env: process.env,
    });
    return true;
  } catch {
    return false;
  } finally {
    closeSync(fd);
  }
}

/** Acquire one video; returns the transcript text or null. */
function acquireOne(engine, entry, parsed, workDir, outDir, language) {
  const videoId = entry.video_id;
  for (const name of readdirSync(workDir))
    if (name.startsWith(videoId + ".")) rmSync(join(workDir, name), { force: true });

  const langs = entry.language ? entry.language : language;
  const logPath = join(workDir, videoId + ".log");
  const args = [
    "--ignore-config",
    "--no-playlist",
    "--skip-download",
    "--write-subs",
    "--write-auto-subs",
    "--sub-langs",
    langs,
    "--sub-format",
    "json3",
    "--cache-dir",
    join(workDir, "cache"),
    "--output",
    join(workDir, "%(id)s.%(ext)s"),
    "--",
    entry.url,
  ];
  attempt(engine, args, logPath);

  const file = pickCaption(readdirSync(workDir), videoId, entry.language ?? "en");
  const log = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
  if (!file) return { transcript: null, ...classify(log, false) };

  const raw = readFileSync(join(workDir, file), "utf8");
  const trackLanguage = file.slice(videoId.length + 1, -".json3".length);
  const cues = json3Cues(raw);
  const transcript = canonicalTranscript(
    videoId,
    trackLanguage,
    parsed["caption-kind"] ?? "auto-generated",
    cues,
  );
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, videoId + ".txt"), transcript);
  return {
    transcript,
    status: "captions_obtained",
    reason: null,
    cues: cues.length,
    language: trackLanguage,
  };
}

export async function main(args = process.argv.slice(2)) {
  const parsed = options(
    args,
    [
      "catalog",
      "out",
      "work",
      "manifest",
      "expect",
      "report",
      "limit",
      "only",
      "lang",
      "delay",
      "retries",
      "force",
      "verbose",
      "caption-kind",
      "ytdlp",
      "ytdlp-py",
    ],
    new Set(["force", "verbose"]),
  );
  required(parsed, ["catalog", "out", "work"]);

  const outDir = resolve(parsed.out);
  const workDir = resolve(parsed.work);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(workDir, { recursive: true });

  const language = parsed.lang ?? "en.*";
  const delay = Number(parsed.delay ?? 1200);
  const retries = Number(parsed.retries ?? 3);
  const only = parsed.only ? new Set(parsed.only.split(",")) : null;
  const expected = parsed.expect ? readExpected(parsed.expect) : new Map();
  const engine = ytdlpCommand(parsed);

  let entries = readCatalog(parsed.catalog);
  if (only) entries = entries.filter((entry) => only.has(entry.video_id));
  if (parsed.limit) entries = entries.slice(0, Number(parsed.limit));

  const results = [];
  const fidelity = [];
  let acquired = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of entries) {
    const videoId = entry.video_id;
    const target = join(outDir, videoId + ".txt");
    if (existsSync(target) && !parsed.force) {
      const text = readFileSync(target, "utf8");
      const want = expected.get(videoId);
      if (want) fidelity.push({ video_id: videoId, match: digest(text) === want });
      skipped += 1;
      results.push({ video_id: videoId, status: "already_present", reason: null });
      continue;
    }

    let outcome = null;
    for (let round = 0; round <= retries; round += 1) {
      outcome = acquireOne(engine, entry, parsed, workDir, outDir, language);
      if (outcome.transcript !== null) break;
      if (outcome.status !== "rate_limited" && outcome.status !== "blocked") break;
      await sleep(delay * 4 * (round + 1));
    }

    if (outcome.transcript !== null) {
      acquired += 1;
      const want = expected.get(videoId);
      const got = digest(outcome.transcript);
      if (want) fidelity.push({ video_id: videoId, match: got === want, got, want });
      results.push({
        video_id: videoId,
        status: outcome.status,
        reason: outcome.reason,
        cues: outcome.cues,
        language: outcome.language,
        digest: got,
        digest_matches_recorded: want ? got === want : null,
      });
      if (parsed.verbose)
        console.log(`ok    ${videoId}  cues=${outcome.cues}  ${outcome.language}`);
    } else {
      failed += 1;
      results.push({
        video_id: videoId,
        status: outcome.status,
        reason: outcome.reason,
        digest_matches_recorded: null,
      });
      if (parsed.verbose)
        console.log(`fail  ${videoId}  ${outcome.status}: ${outcome.reason}`);
    }
    if (delay > 0) await sleep(delay);
  }

  if (parsed.manifest)
    writeFileSync(
      resolve(parsed.manifest),
      JSON.stringify({ results }, null, 2) + "\n",
    );

  const checked = fidelity.filter((row) => row.want !== undefined || row.match !== undefined);
  const report = {
    catalog: parsed.catalog,
    language,
    requested: entries.length,
    acquired,
    already_present: skipped,
    failed,
    fidelity: {
      compared: fidelity.length,
      matched: fidelity.filter((row) => row.match).length,
      mismatched: fidelity.filter((row) => !row.match).map((row) => row.video_id),
    },
    results,
  };
  if (parsed.report)
    writeFileSync(resolve(parsed.report), JSON.stringify(report, null, 2) + "\n");

  console.log(
    JSON.stringify({
      requested: report.requested,
      acquired,
      already_present: skipped,
      failed,
      fidelity_compared: report.fidelity.compared,
      fidelity_matched: report.fidelity.matched,
      fidelity_mismatched: report.fidelity.mismatched.length,
    }),
  );
  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
