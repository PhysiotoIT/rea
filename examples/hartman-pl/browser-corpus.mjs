import { readFile, writeFile, copyFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { videoIdentity } from "./youtube-identity.mjs";

const blockPattern =
  /confirm you.re not a bot|verify you are human|unusual traffic|automated queries|nie jeste[śs] botem|nietypow\w* ruch/iu;

async function exportOne(tab, job) {
  const id = videoIdentity(await tab.url()).video_id;
  const entry = job.inventory.get(id);
  if (
    !entry ||
    entry.video_id !== id ||
    videoIdentity(entry.url).video_id !== id
  )
    throw new Error("Current video is outside the validated inventory: " + id);
  if (
    job.records.some(
      (row) => row.video_id === id && row.status === "captions_obtained",
    )
  )
    return null;
  try {
    const path = await tab.content.exportYouTubeTranscript();
    const body = await readFile(path, "utf8");
    if (!body.includes("Video ID: " + id))
      throw new Error("Video identity mismatch: " + id);
    return {
      ...entry,
      status: "captions_obtained",
      export_path: path,
      observed_url: await tab.url(),
    };
  } catch (error) {
    const row = {
      ...entry,
      video_id: id,
      status: /No transcript is available/iu.test(error.message)
        ? "export_unavailable"
        : "error",
      reason: error.message,
    };
    try {
      const dom = await tab.getAXState({ emit: false });
      if (blockPattern.test(dom)) {
        job.halt = true;
        row.status = "blocked";
      }
    } catch (uiError) {
      row.ui_error = uiError.message;
    }
    return row;
  }
}

async function saveExports(tabs, job) {
  const results = await Promise.allSettled(
    tabs.map((tab) => exportOne(tab, job)),
  );
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const row =
      result.status === "fulfilled"
        ? result.value
        : {
            video_id: videoIdentity(await tabs[index].url()).video_id,
            status: "error",
            reason: result.reason.message,
          };
    if (row === null) continue;
    if (row.status === "captions_obtained") {
      row.file = row.video_id + ".txt";
      const destination = join(job.directory, row.file);
      try {
        await copyFile(row.export_path, destination, constants.COPYFILE_EXCL);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        if (
          !(await readFile(destination)).equals(await readFile(row.export_path))
        )
          throw new Error(
            "Caption version conflict; preserve the existing file and choose a new directory: " +
              row.video_id,
          );
      }
      row.bytes = (await stat(destination)).size;
      if (row.bytes === 0) throw new Error("Empty export: " + row.video_id);
    }
    const previous = job.records.findIndex(
      (candidate) => candidate.video_id === row.video_id,
    );
    if (previous < 0) job.records.push(row);
    else job.records[previous] = row;
  }
  await writeFile(
    job.manifestPath,
    JSON.stringify(
      { captured_on: job.capturedOn, results: job.records },
      null,
      2,
    ),
  );
}

async function navigateNext(tabs, job) {
  const batch = job.queue.slice(job.cursor, job.cursor + tabs.length);
  for (const entry of batch)
    if (videoIdentity(entry.url).video_id !== entry.video_id)
      throw new Error("Queue identity mismatch.");
  job.cursor += batch.length;
  const navigations = await Promise.allSettled(
    batch.map((entry, index) => tabs[index].goto(videoIdentity(entry.url).url)),
  );
  const snapshots = await Promise.allSettled(
    batch.map((_, index) => tabs[index].getAXState({ emit: false })),
  );
  for (const snapshot of snapshots)
    if (snapshot.status === "fulfilled" && blockPattern.test(snapshot.value))
      job.halt = true;
  await writeFile(
    job.statePath,
    JSON.stringify(
      {
        cursor: job.cursor,
        halt: job.halt,
        queue: job.queue,
        pending: await Promise.all(tabs.map((tab) => tab.url())),
      },
      null,
      2,
    ),
  );
  return {
    navigation_errors: navigations
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason.message),
    snapshot_errors: snapshots
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason.message),
  };
}

/** Use only inside cua_repl with documented, already selected tab bindings. */
export async function harvestBatch(tabs, job) {
  if (job.halt)
    throw new Error("Acquisition halted; do not bypass the observed block.");
  await saveExports(tabs, job);
  const navigation = job.halt ? {} : await navigateNext(tabs, job);
  return {
    attempted: job.records.length,
    captions_obtained: job.records.filter(
      (row) => row.status === "captions_obtained",
    ).length,
    cursor: job.cursor,
    halt: job.halt,
    ...navigation,
  };
}

/** Repair missing local copies from retained exports, without new site requests. */
export async function restoreCopies(records, directory) {
  let restored = 0;
  for (const row of records) {
    if (row.status !== "captions_obtained" || !row.export_path) continue;
    try {
      await stat(join(directory, row.video_id + ".txt"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const body = await readFile(row.export_path, "utf8");
      if (!body.includes("Video ID: " + row.video_id))
        throw new Error("Retained export identity mismatch.");
      await copyFile(
        row.export_path,
        join(directory, row.video_id + ".txt"),
        constants.COPYFILE_EXCL,
      );
      restored += 1;
    }
  }
  return { restored };
}
