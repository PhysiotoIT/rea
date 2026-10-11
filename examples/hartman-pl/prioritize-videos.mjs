import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateCatalog } from "./corpus.mjs";
import { videoIdentity } from "./youtube-identity.mjs";

/** Read the observed display label; this is priority metadata, not measured duration. */
export function displayedDuration(label) {
  if (typeof label !== "string" || !/^\d+:\d{2}(?::\d{2})?$/u.test(label))
    return null;
  const parts = label.split(":").map(Number);
  if (parts.slice(1).some((part) => part > 59)) return null;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}

/** Sort all validated IDs numerically, retaining unknown lengths at the end. */
export function prioritizeCatalog(catalog) {
  validateCatalog(catalog);
  return catalog.entries
    .map((entry) => ({
      ...entry,
      observed_url: entry.observed_url ?? entry.url,
      url: videoIdentity(entry.url).url,
      priority_duration_seconds: displayedDuration(entry.duration_label),
      priority_basis:
        "Observed channel duration label; not independently timed",
    }))
    .sort(
      (left, right) =>
        (right.priority_duration_seconds ?? -1) -
          (left.priority_duration_seconds ?? -1) ||
        left.video_id.localeCompare(right.video_id, "en"),
    );
}

/** Produce a reusable queue without replacing an existing capture. */
export async function main(args) {
  if (args.length !== 4 || args[0] !== "--catalog" || args[2] !== "--out")
    throw new Error(
      "Usage: node prioritize-videos.mjs --catalog FILE --out NEW_FILE",
    );
  const catalog = JSON.parse(await readFile(args[1], "utf8"));
  const queue = prioritizeCatalog(catalog);
  await writeFile(args[3], JSON.stringify(queue, null, 2) + "\n", {
    flag: "wx",
  });
  console.log(
    JSON.stringify({
      videos: queue.length,
      known_lengths: queue.filter((x) => x.priority_duration_seconds !== null)
        .length,
    }),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
