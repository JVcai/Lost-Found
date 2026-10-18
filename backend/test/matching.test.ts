import { test } from "node:test";
import assert from "node:assert/strict";
import { score, qualifies, similarity, MatchItem } from "../src/matching";
import { reportSchema, registerSchema } from "@lostnet/shared";
const lost: MatchItem = {
  type: "LOST",
  category: "Bags",
  item_name: "Black Nike backpack",
  brand: "Nike",
  color: "Black",
  description: "Black backpack",
  unique_features: ["blue keychain"],
  location_id: "b1000000-0000-4000-8000-000000000001",
  latitude: 51.09,
  longitude: 71.41,
  event_at: "2026-01-01T10:00:00Z",
};
const found = { ...lost, type: "FOUND", event_at: "2026-01-01T10:25:00Z" };
test("name, description and color each contribute to the score", () => {
  const s = score(lost, found)!;
  assert.equal(s.total_score, 100);
  assert.equal(s.visual_score, 50);
  assert.equal(s.location_score, 30);
  assert.equal(s.time_score, 20);
  assert.ok(qualifies(s));
  assert.equal(score(lost, { ...found, color: "White" })?.total_score, 80);
  assert.ok(!qualifies(score(lost, { ...found, item_name: "Tishka" })));
});
test("75 exactly is excluded, strictly above 75 is admitted", () => {
  const a = {
    ...lost,
    item_name: "stone ring",
    description: "faceted gemstone",
    color: "yellow",
  };
  const b = {
    ...found,
    item_name: "stone pendant",
    description: a.description,
    color: "yellow",
  };
  assert.equal(score(a, b)?.total_score, 75);
  assert.equal(qualifies(score(a, b)), false);
  assert.ok(qualifies(score(a, { ...b, item_name: a.item_name })));
});
test("Tishka cannot match a diamond through shared color or generic description", () => {
  const a = {
    ...lost,
    item_name: "Tishka",
    description: "small yellow cat",
    color: "yellow",
    category: "Other",
  };
  const b = {
    ...found,
    item_name: "Yellow diamond",
    description: "small yellow stone",
    color: "yellow",
    category: "Other",
  };
  assert.equal(qualifies(score(a, b)), false);
  assert.equal(
    qualifies(score({ ...a, description: "" }, { ...b, description: "" })),
    false,
  );
  assert.equal(
    qualifies(
      score(
        { ...a, item_name: "yellow bag", description: "" },
        { ...b, description: "" },
      ),
    ),
    false,
  );
});
test("same names and colors work without descriptions, independently of GPS and date", () => {
  const a = {
    ...lost,
    item_name: "Yellow diamond",
    description: "",
    color: "Yellow",
  };
  const b = {
    ...found,
    item_name: "yellow diamond",
    description: "",
    color: "yellow",
    latitude: 52,
    location_id: null,
    event_at: "2026-04-01T00:00:00Z",
  };
  assert.equal(score(a, b)?.total_score, 100);
  assert.ok(qualifies(score(a, b)));
  assert.equal(score(a, a), null);
});
test("generic reporting words and empty fields never add similarity", () => {
  assert.equal(
    score(
      { ...lost, item_name: "Lost cat", description: "my item" },
      { ...found, item_name: "Found diamond", description: "my item" },
    ),
    null,
  );
  assert.equal(
    qualifies(
      score(
        { ...lost, item_name: "", description: "", color: "" },
        { ...found, item_name: "", description: "", color: "" },
      ),
    ),
    false,
  );
});
test("word order, punctuation and additional details do not erase matching words", () => {
  assert.equal(
    similarity("yellow diamond", "Diamond, yellow shiny faceted stone"),
    1,
  );
  const a = {
    ...lost,
    item_name: "Yellow diamond",
    description: "bright yellow gemstone",
    color: "yellow",
  };
  const b = {
    ...found,
    item_name: "found yellow stone",
    description: "yellow gemstone bright and shiny",
    color: "Yellow",
  };
  assert.ok(qualifies(score(a, b)));
});
test("small typos and supported Russian/English object names still match", () => {
  assert.ok(similarity("backpack", "backpak") >= 0.8);
  assert.equal(similarity("diamond", "dimond"), 1);
  assert.equal(similarity("diamond", "diamnod"), 1);
  assert.equal(similarity("diamond", "stove"), 0);
  assert.equal(similarity("бриллиант", "diamond"), 1);
  assert.equal(similarity("камня", "stone"), 1);
  assert.equal(similarity("cat", "car"), 0);
  assert.equal(similarity("Tishka", "diamond"), 0);
});
test("Unicode text remains case insensitive", () =>
  assert.equal(similarity("Синий РЮКЗАК", "синий рюкзак"), 1));
test("GPS-only schema still requires paired coordinates", () => {
  const gps = { ...lost, location_id: null };
  assert.equal(reportSchema.safeParse(gps).success, true);
  assert.equal(
    reportSchema.safeParse({ ...gps, longitude: undefined }).success,
    false,
  );
});
test("schema validates coordinates, paired GPS, dates and required fields", () => {
  const good = { ...lost, event_at: "2026-01-01T10:00:00Z" };
  assert.equal(reportSchema.safeParse(good).success, true);
  for (const patch of [
    { latitude: 91 },
    { longitude: 181 },
    { event_at: "yesterday" },
    { item_name: "" },
    { location_id: "x" },
    { type: "STOLEN" },
    { latitude: undefined },
    { event_at: "2099-01-01T00:00:00Z" },
  ])
    assert.equal(reportSchema.safeParse({ ...good, ...patch }).success, false);
});
test("registration validates email, password and name", () => {
  assert.equal(
    registerSchema.safeParse({
      full_name: "Sam",
      email: "sam@example.com",
      password: "StrongPass9",
    }).success,
    true,
  );
  assert.equal(
    registerSchema.safeParse({
      full_name: "S",
      email: "wrong",
      password: "short",
    }).success,
    false,
  );
});
