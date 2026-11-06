import { test } from "node:test";
import assert from "node:assert/strict";
import { groupMatches, counterpart } from "../../mobile/src/reportPresentation";
import type { Match, Report } from "@lostnet/shared";
const found = { id: "found", type: "FOUND", item_name: "Diamond" } as Report;
const cat = { id: "cat", type: "LOST", item_name: "Tishka" } as Report;
const diamond = {
  id: "diamond",
  type: "LOST",
  item_name: "Lost diamond",
} as Report;
const first = {
  id: "m1",
  lost_report_id: cat.id,
  found_report_id: found.id,
  status: "PROPOSED",
  viewer_is_owner: false,
  lost: cat,
  found,
} as Match;
const second = {
  ...first,
  id: "m2",
  lost_report_id: diamond.id,
  lost: diamond,
};
test("finder sees distinct candidate lost reports, not their same found item twice", () => {
  const groups = groupMatches([
    first,
    second,
    first,
    { ...second, id: "rejected", status: "REJECTED" },
  ]);
  assert.deepEqual(Object.keys(groups), ["found"]);
  assert.equal(groups.found.length, 2);
  assert.deepEqual(
    groups.found.map((m) => counterpart(m)?.item_name),
    ["Tishka", "Lost diamond"],
  );
});
test("owner sees found candidates grouped under the correct lost report", () => {
  const groups = groupMatches([
    { ...first, viewer_is_owner: true },
    { ...second, viewer_is_owner: true },
  ]);
  assert.deepEqual(Object.keys(groups), ["cat", "diamond"]);
  assert.equal(counterpart(groups.cat[0])?.type, "FOUND");
  assert.equal(cat.type, "LOST");
});
