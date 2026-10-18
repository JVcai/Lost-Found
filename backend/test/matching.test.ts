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
test("matching uses the specified weights and reaches strong-match threshold", () => {
  const s = score(lost, found)!;
  assert.ok(s.total_score >= 99 && s.total_score <= 100);
  assert.equal(s.visual_score, 40);
  assert.equal(s.location_score, 30);
  assert.equal(s.feature_score, 10);
  assert.equal(
    s.total_score,
    Math.round(
      (s.visual_score + s.location_score + s.time_score + s.feature_score) *
        100,
    ) / 100,
  );
});
test("same report types and category mismatches are excluded", () => {
  assert.equal(score(lost, lost), null);
  assert.equal(score(lost, { ...found, category: "Keys" }), null);
});
test("location radius is geographic and excludes distant reports", () => {
  const distant = { ...found, location_id: "another", latitude: 52 };
  assert.ok(distance(lost, distant) > 100000);
  assert.equal(score(lost, distant), null);
});
test("unknown coordinates do not become a nearby match", () => {
  assert.equal(
    score(
      { ...lost, latitude: undefined },
      { ...found, location_id: "other", latitude: undefined },
    ),
    null,
  );
});
test("old and invalid event times are excluded", () => {
  assert.equal(
    score(lost, { ...found, event_at: "2026-02-01T00:00:00Z" }),
    null,
  );
  assert.equal(score(lost, { ...found, event_at: "invalid" }), null);
});
test("no unique evidence earns zero feature points", () => {
  assert.equal(
    score({ ...lost, unique_features: [] }, { ...found, unique_features: [] })
      ?.feature_score,
    0,
  );
  assert.equal(similarity("", ""), 0);
});
test("Unicode matching is case insensitive", () =>
  assert.equal(similarity("Синий РЮКЗАК", "синий рюкзак"), 1));
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
test("unrelated objects in Other cannot match from place/time/features alone", () => {
  const cat = {
    ...lost,
    category: "Other",
    item_name: "Tishka",
    brand: "",
    color: "yellow",
    description: "",
    unique_features: ["small scratch"],
  };
  const diamond = {
    ...found,
    category: "Other",
    item_name: "yellow diamond",
    brand: "",
    color: "yellow",
    description: "",
    unique_features: ["small scratch"],
  };
  assert.equal(score(cat, diamond), null);
  assert.equal(
    score({ ...cat, item_name: "yellow bag" }, diamond),
    null,
    "A shared color is not object identity",
  );
});
test("a common venue never overrides far-apart GPS positions", () => {
  assert.equal(score(lost, { ...found, latitude: 52 }), null);
});
test("GPS-only reports match nearby, never globally through null place IDs", () => {
  assert.ok(
    score({ ...lost, location_id: null }, { ...found, location_id: null })!
      .total_score >= 90,
  );
  assert.equal(
    score(
      { ...lost, location_id: null, latitude: undefined, longitude: undefined },
      {
        ...found,
        location_id: null,
        latitude: undefined,
        longitude: undefined,
      },
    ),
    null,
  );
});
test("a GPS report does not require a registered location, but needs complete coordinates", () => {
  const gps = { ...lost, location_id: null, location_label: "Near the park" };
  assert.equal(reportSchema.safeParse(gps).success, true);
  assert.equal(
    reportSchema.safeParse({
      ...gps,
      latitude: undefined,
      longitude: undefined,
    }).success,
    false,
  );
  assert.equal(
    reportSchema.safeParse({ ...gps, longitude: undefined }).success,
    false,
  );
});
