import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPrescription, validatePrescription } from "./prescription.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(await readFile(join(directory, "prescription-przyklad.json"), "utf8"));
const clone = () => structuredClone(plan);

const output = renderPrescription(plan);
assert.equal((output.match(/^## \d+\./gmu) ?? []).length, plan.exercises.length);
assert(!output.includes("Uwagi terapeuty"));
assert(!output.includes(plan.clinical_notes_pl[0]));
assert(renderPrescription(plan, { includeClinicalNotes: true }).includes("Uwagi terapeuty"));

const one = clone();
one.exercises = one.exercises.slice(0, 1);
assert.equal((renderPrescription(one).match(/^## \d+\./gmu) ?? []).length, 1);
assert(!renderPrescription(one).includes(plan.exercises[1].name_pl));

const five = clone();
five.exercises = Array.from({ length: 5 }, (_, index) => ({
  ...structuredClone(plan.exercises[index % plan.exercises.length]),
  id: "chosen-" + index,
  name_pl: "Wybrane ćwiczenie " + (index + 1),
}));
assert.equal((renderPrescription(five).match(/^## \d+\./gmu) ?? []).length, 5);

const missingDose = clone();
delete missingDose.exercises[0].dose_pl;
assert.throws(() => validatePrescription(missingDose), /dose_pl/u);
const duplicate = clone();
duplicate.exercises.push(duplicate.exercises[0]);
assert.throws(() => validatePrescription(duplicate), /duplicate/u);
const unexpectedSelection = clone();
unexpectedSelection.exercises[0].selected = false;
assert.throws(() => validatePrescription(unexpectedSelection), /unsupported fields/u);
const badLink = clone();
badLink.exercises[0].video = { label_pl: "Film", url: "javascript:alert(1)" };
assert.throws(() => validatePrescription(badLink), /HTTPS/u);

const injection = clone();
injection.exercises[0].name_pl = "[Nazwa](javascript:alert(1)) <script>";
injection.exercises[0].video = { label_pl: "Film [opis]", url: "https://example.org/demo_(1)" };
const escaped = renderPrescription(injection);
assert(!escaped.includes("[Nazwa](javascript:"));
assert(!escaped.includes("<script>"));
assert(escaped.includes("demo_%281%29"));

const temporary = await mkdtemp(join(tmpdir(), "rea-prescription-"));
try {
  const input = join(temporary, "plan.json");
  const target = join(temporary, "plan.md");
  await writeFile(input, JSON.stringify(one));
  const cli = execFileSync(process.execPath, [join(directory, "prescription.mjs"), input, target], { encoding: "utf8" });
  assert.equal(JSON.parse(cli).exercise_count, 1);
  assert.equal(await readFile(target, "utf8"), renderPrescription(one));
  const retry = spawnSync(process.execPath, [join(directory, "prescription.mjs"), input, target], { encoding: "utf8" });
  assert.equal(retry.status, 1);
  assert.match(retry.stderr, /already exists/u);
  assert.equal(await readFile(target, "utf8"), renderPrescription(one));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
process.stdout.write("Passed: exact exercise selection, explicit doses, note visibility, link/text escaping and CLI file preservation.\n");
