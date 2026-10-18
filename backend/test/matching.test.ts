import { test } from "node:test";
import assert from "node:assert/strict";
import { score, distance, similarity, MatchItem } from "../src/matching";
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
test("original score weights still rank identical text strongly", () => {
  const s = score(lost, found)!;
  assert.ok(s.total_score >= 99);
  assert.equal(s.visual_score, 40);
  assert.equal(s.location_score, 30);
  assert.equal(s.feature_score, 10);
});
test("any shared word in name or description is enough, regardless of category or distance", () => {
  const b = {
    ...found,
    item_name: "backpack",
    description: "",
    category: "Other",
    location_id: null,
    latitude: 52,
    event_at: "2026-04-01T00:00:00Z",
    brand: "",
    color: "",
    unique_features: [],
  };
  const s = score(lost, b);
  assert.ok(s);
  assert.ok(s.total_score < 70, "Low rank does not exclude an MVP suggestion");
  assert.ok(
    score(
      { ...lost, item_name: "Tishka", description: "striped cat" },
      { ...b, item_name: "Kitten", description: "striped fur" },
    ),
  );
});
test("a single shared color word in user text counts for the permissive MVP", () => {
  assert.ok(
    score(
      { ...lost, item_name: "yellow bag", description: "" },
      { ...found, item_name: "yellow diamond", description: "" },
    ),
  );
});
test("completely different names and descriptions remain Searching despite shared metadata or photos", () => {
  const a = {
    ...lost,
    item_name: "Tishka",
    description: "cat",
    brand: "",
    color: "yellow",
    ai_analysis: { image_sha256: "same-photo", object_type: "object" },
  };
  const b = {
    ...found,
    item_name: "yellow diamond",
    description: "gemstone",
    brand: "",
    color: "yellow",
    ai_analysis: a.ai_analysis,
  };
  assert.equal(score(a, b), null);
});
test("generic reporting words alone do not connect unrelated objects", () => {
  assert.equal(
    score(
      { ...lost, item_name: "Lost cat", description: "my item" },
      { ...found, item_name: "Found diamond", description: "my item" },
    ),
    null,
  );
});
test("same types never match and unknown coordinates do not block shared text", () => {
  assert.equal(score(lost, lost), null);
  assert.ok(
    score(
      { ...lost, location_id: null, latitude: undefined, longitude: undefined },
      {
        ...found,
        location_id: null,
        latitude: undefined,
        longitude: undefined,
      },
    ),
  );
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
