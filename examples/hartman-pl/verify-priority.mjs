import assert from "node:assert/strict";
import { displayedDuration, prioritizeCatalog } from "./prioritize-videos.mjs";

assert.equal(displayedDuration("1:04:34"), 3874);
assert.equal(displayedDuration("59:47"), 3587);
assert.equal(displayedDuration("9:59"), 599);
for (const label of [undefined, "LIVE", "1:60:00", "5:99", "-1:02", "0:00"])
  assert.equal(displayedDuration(label), null);
const entry = (id, duration_label) => ({
  video_id: id,
  url: "https://www.youtube.com/watch?v=" + id,
  duration_label,
});
const catalog = {
  entries: [
    entry("00000000001", "9:59"),
    entry("00000000002", "10:00"),
    entry("00000000003", "1:04:34"),
    entry("00000000004", "LIVE"),
  ],
};
assert.deepEqual(
  prioritizeCatalog(catalog).map((x) => x.video_id),
  ["00000000003", "00000000002", "00000000001", "00000000004"],
);
assert.equal(catalog.entries[0].video_id, "00000000001");
const tracked = entry("00000000005", "12:00");
tracked.url += "&pp=observed-tracking";
const normalized = prioritizeCatalog({ entries: [tracked] })[0];
assert.equal(normalized.url, "https://www.youtube.com/watch?v=00000000005");
assert.equal(normalized.observed_url, tracked.url);
assert.throws(
  () =>
    prioritizeCatalog({ entries: [catalog.entries[0], catalog.entries[0]] }),
  /Duplicate/u,
);
console.log(
  "Priority checks passed: numeric hour/minute ordering, unknown labels, unchanged inventory and identity rejection.",
);
