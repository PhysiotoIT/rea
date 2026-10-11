/**
 * Rebuild the observed-video catalog that `corpus.mjs --catalog` consumes.
 *
 * The corpus pipeline requires a catalog JSON with the channel inventory, but
 * nothing in this directory could produce one: it was originally harvested by
 * `browser-corpus.mjs` inside a browser session, and only the resulting report
 * was committed. That left the pipeline unable to re-index an existing corpus.
 *
 * This tool reconstructs the catalog from a committed report, so a re-index
 * needs nothing but the repository and a private caption store.
 *
 * Ordering: the true channel order is not recoverable from a report, because a
 * report lists indexed films and unavailable videos separately. Indexed films
 * keep their recorded relative order and unavailable videos follow, which is
 * the closest faithful reconstruction. The reconstructed catalog is therefore
 * equivalent in content, not in sequence.
 *
 * Usage:
 *   node examples/hartman-pl/catalog-from-report.mjs \
 *     --report examples/hartman-pl/korpus.json --out work/catalog.json
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ENTRY_FIELDS = [
  "video_id",
  "url",
  "title",
  "duration_label",
  "title_language",
];

/**
 * Project a corpus report onto the catalog shape, keeping only the fields a
 * catalog entry contributes to a film record.
 */
export function catalogFromReport(report) {
  const films = report.films ?? [];
  const unavailable = report.unavailable ?? [];
  if (films.length + unavailable.length === 0)
    throw new Error("Report contains no films and no unavailable videos.");
  const entries = [...films, ...unavailable].map((record) => {
    const entry = {};
    for (const field of ENTRY_FIELDS)
      if (record[field] !== undefined) entry[field] = record[field];
    if (!/^[\w-]{11}$/u.test(entry.video_id ?? "") || !entry.url)
      throw new Error("Report record lacks a usable identity: " + entry.video_id);
    return entry;
  });
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.video_id))
      throw new Error("Duplicate video identity in report: " + entry.video_id);
    seen.add(entry.video_id);
  }
  const inventory = report.inventory ?? {};
  return {
    header_video_count:
      inventory.reported_header_count ?? inventory.observed_unique_ids ?? entries.length,
    inventory_complete: inventory.complete === true,
    source:
      "Reconstructed from a committed corpus report by examples/hartman-pl/catalog-from-report.mjs; " +
      "indexed films keep their recorded order and unavailable videos follow.",
    entries,
  };
}

function options(args, allowed) {
  const parsed = {};
  const set = new Set(allowed);
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined)
      throw new Error("Expected --option value.");
    const name = key.slice(2);
    if (!set.has(name) || Object.hasOwn(parsed, name))
      throw new Error("Unknown or duplicate option: " + key);
    parsed[name] = value;
  }
  return parsed;
}

export function main(args = process.argv.slice(2)) {
  const parsed = options(args, ["report", "out"]);
  if (!parsed.report || !parsed.out)
    throw new Error("Missing --report or --out");
  const catalog = catalogFromReport(
    JSON.parse(readFileSync(resolve(parsed.report), "utf8")),
  );
  writeFileSync(resolve(parsed.out), JSON.stringify(catalog, null, 2) + "\n", {
    flag: "wx",
  });
  console.log(
    JSON.stringify({
      entries: catalog.entries.length,
      header_video_count: catalog.header_video_count,
      inventory_complete: catalog.inventory_complete,
    }),
  );
  return catalog;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
