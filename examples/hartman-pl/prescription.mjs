import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function record(value, label, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(label + ": expected an object.");
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (unknown.length)
    throw new Error(label + ": unsupported fields: " + unknown.join(", "));
}

function text(value, label) {
  if (typeof value !== "string" || !value.trim() || /[\r\n]/u.test(value))
    throw new Error(label + ": expected non-empty single-line text.");
}

function texts(value, label) {
  if (!Array.isArray(value) || !value.length)
    throw new Error(label + ": expected a non-empty text array.");
  value.forEach((item, index) => text(item, label + "[" + index + "]"));
}

function video(value, label) {
  record(value, label, ["label_pl", "url"]);
  text(value.label_pl, label + ".label_pl");
  text(value.url, label + ".url");
  const url = new URL(value.url);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error(label + ": expected an HTTPS URL without credentials.");
}

const exerciseFields = [
  "id",
  "name_pl",
  "side_pl",
  "setup_pl",
  "cues_pl",
  "dose_pl",
  "frequency_pl",
  "progression_pl",
  "regression_pl",
  "video",
];

function exercise(value, index, ids) {
  const label = "exercises[" + index + "]";
  record(value, label, exerciseFields);
  const requiredText = exerciseFields.filter(
    (key) => !["cues_pl", "video"].includes(key),
  );
  for (const field of requiredText)
    text(value[field], label + "." + field);
  texts(value.cues_pl, label + ".cues_pl");
  if (ids.has(value.id)) throw new Error(label + ": duplicate exercise id.");
  ids.add(value.id);
  if (value.video !== undefined) video(value.video, label + ".video");
}

/** Validate a clinician-authored plan without supplying exercises or doses. */
export function validatePrescription(value) {
  record(value, "plan", [
    "schema_version",
    "title_pl",
    "goal_pl",
    "monitoring_pl",
    "review_pl",
    "exercises",
    "clinical_notes_pl",
  ]);
  if (value.schema_version !== 1)
    throw new Error("plan.schema_version: expected 1.");
  for (const key of ["title_pl", "goal_pl", "monitoring_pl", "review_pl"])
    text(value[key], "plan." + key);
  if (!Array.isArray(value.exercises) || !value.exercises.length)
    throw new Error("plan.exercises: expected at least one explicit exercise.");
  const ids = new Set();
  value.exercises.forEach((item, index) => exercise(item, index, ids));
  if (value.clinical_notes_pl !== undefined)
    texts(value.clinical_notes_pl, "plan.clinical_notes_pl");
  return value;
}

function inline(value) {
  return value.replace(/[\\`*_{}\[\]()<>#!|]/gu, "\\$&");
}

function link(value) {
  return new URL(value).href.replace(/[()\\]/gu, (character) =>
    "%" + character.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function renderExercise(value, index) {
  const lines = [
    "## " + (index + 1) + ". " + inline(value.name_pl),
    "", "**Strona:** " + inline(value.side_pl),
    "", "**Ustawienie:** " + inline(value.setup_pl),
    "", "**Wykonanie:**", "",
    ...value.cues_pl.map((cue) => "- " + inline(cue)),
    "", "**Dawka:** " + inline(value.dose_pl),
    "", "**Częstotliwość:** " + inline(value.frequency_pl),
    "", "**Kiedy zwiększyć:** " + inline(value.progression_pl),
    "", "**Kiedy ułatwić:** " + inline(value.regression_pl),
  ];
  if (value.video)
    lines.push(
      "",
      "[" + inline(value.video.label_pl) + "](" + link(value.video.url) + ")",
    );
  return lines.join("\n");
}

/** Render exactly the supplied exercise list; clinician notes are opt-in. */
export function renderPrescription(value, options = {}) {
  record(options, "options", ["includeClinicalNotes"]);
  if (
    options.includeClinicalNotes !== undefined &&
    typeof options.includeClinicalNotes !== "boolean"
  )
    throw new Error("options.includeClinicalNotes: expected a boolean.");
  const plan = validatePrescription(value);
  const parts = [
    "# " + inline(plan.title_pl),
    "**Cel:** " + inline(plan.goal_pl),
    "**Obserwacja reakcji:** " + inline(plan.monitoring_pl),
    ...plan.exercises.map(renderExercise),
    "**Sprawdzenie planu:** " + inline(plan.review_pl),
  ];
  if (options.includeClinicalNotes && plan.clinical_notes_pl)
    parts.push(
      "## Uwagi terapeuty\n\n" +
        plan.clinical_notes_pl.map((note) => "- " + inline(note)).join("\n"),
    );
  return parts.join("\n\n") + "\n";
}

async function main(args) {
  if (
    args.length < 2 || args.length > 3 ||
    (args[2] && args[2] !== "--include-clinical-notes")
  )
    throw new Error(
      "Usage: node prescription.mjs INPUT.json OUTPUT.md [--include-clinical-notes]",
    );
  const source = JSON.parse(await readFile(resolve(args[0]), "utf8"));
  const output = renderPrescription(source, {
    includeClinicalNotes: Boolean(args[2]),
  });
  const target = resolve(args[1]);
  try {
    await writeFile(target, output, { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        "Output already exists; choose a new output filename: " + target,
      );
    throw error;
  }
  process.stdout.write(
    JSON.stringify({ exercise_count: source.exercises.length, output: target }) +
      "\n",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  });
}
