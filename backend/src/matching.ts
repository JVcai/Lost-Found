import { samePhoto } from "./imageEvidence";
export interface MatchItem {
  type: string;
  category: string;
  brand: string;
  color: string;
  description: string;
  item_name: string;
  unique_features: string[];
  ai_features?: string[];
  location_id: string | null;
  ai_analysis?: {
    object_type?: string;
    image_sha256?: string;
    image_signature?: string;
  } | null;
  latitude?: number;
  longitude?: number;
  event_at: string;
}
const words = (s: string) =>
  new Set(s.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
export function similarity(a: string, b: string): number {
  const x = words(a),
    y = words(b);
  if (!x.size || !y.size) return 0;
  return [...x].filter((v) => y.has(v)).length / new Set([...x, ...y]).size;
}
export function distance(a: MatchItem, b: MatchItem): number {
  if (
    a.latitude == null ||
    a.longitude == null ||
    b.latitude == null ||
    b.longitude == null
  )
    return Infinity;
  const rad = Math.PI / 180;
  const dlat = (b.latitude - a.latitude) * rad,
    dlon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function score(a: MatchItem, b: MatchItem) {
  if (a.type === b.type || a.category !== b.category) return null;
  const hours =
    Math.abs(Date.parse(a.event_at) - Date.parse(b.event_at)) / 3600000;
  if (hours > 168 || !Number.isFinite(hours)) return null;
  const meters = distance(a, b);
  const samePlace = Boolean(
    a.location_id && b.location_id && a.location_id === b.location_id,
  );
  if (Number.isFinite(meters) ? meters > 500 : !samePlace) return null;
  // Location/time are context, never evidence that two different objects are the same.
  const meaningful = (value: string) =>
    [...words(value)]
      .filter(
        (w) =>
          !new Set([
            "a",
            "an",
            "the",
            "my",
            "i",
            "and",
            "with",
            "lost",
            "found",
            "item",
            "thing",
            "near",
            "at",
            "in",
            "on",
            "black",
            "white",
            "yellow",
            "blue",
            "red",
            "green",
            "grey",
            "gray",
            "потерял",
            "потерян",
            "найден",
            "нашел",
            "мой",
            "моя",
            "в",
            "на",
            "и",
            "у",
          ]).has(w),
      )
      .join(" ");
  const names = similarity(meaningful(a.item_name), meaningful(b.item_name));
  const text = similarity(
    meaningful(a.item_name + " " + a.description),
    meaningful(b.item_name + " " + b.description),
  );
  const sameImage = Boolean(
    (a.ai_analysis?.image_sha256 &&
      a.ai_analysis.image_sha256 === b.ai_analysis?.image_sha256) ||
    samePhoto(a.ai_analysis?.image_signature, b.ai_analysis?.image_signature),
  );
  const objectA = a.ai_analysis?.object_type || "",
    objectB = b.ai_analysis?.object_type || "";
  const visualObject = Boolean(
    objectA && objectB && similarity(objectA, objectB) >= 0.5,
  );
  const brandColor =
    !["Other", "Pets"].includes(a.category) &&
    Boolean(
      a.brand.trim() &&
      a.color.trim() &&
      a.brand.trim().toLowerCase() === b.brand.trim().toLowerCase() &&
      a.color.trim().toLowerCase() === b.color.trim().toLowerCase(),
    );
  if (names < 0.2 && text < 0.2 && !visualObject && !brandColor && !sameImage)
    return null;
  // AI object labels are descriptive text, not a reliable exclusion rule.
  const equal = (x: string, y: string) =>
    x.trim() && y.trim() && x.toLowerCase() === y.toLowerCase() ? 1 : 0;
  // Missing brand/color is unknown, rather than evidence of a mismatch.
  const textEvidence = Math.max(
    names,
    text,
    visualObject ? similarity(objectA, objectB) : 0,
    similarity(
      (a.ai_features || []).join(" "),
      (b.ai_features || []).join(" "),
    ),
  );
  const colorWeight = a.color.trim() && b.color.trim() ? 0.25 : 0;
  const brandWeight = a.brand.trim() && b.brand.trim() ? 0.2 : 0;
  const visual = sameImage
    ? 40
    : (40 *
        (0.3 * textEvidence +
          colorWeight * equal(a.color, b.color) +
          brandWeight * equal(a.brand, b.brand) +
          0.25 * textEvidence)) /
      (0.55 + colorWeight + brandWeight);
  const location =
    30 * (Number.isFinite(meters) ? 1 - meters / 500 / 3 : samePlace ? 1 : 0);
  // Eligibility already caps time/radius. A duplicate photo within those bounds
  // must not become impossible to match merely because optional features are empty.
  const time = 10 + 10 * Math.exp(-hours / 48);
  const feature =
    10 * similarity(a.unique_features.join(" "), b.unique_features.join(" "));
  const round = (n: number) => Math.round(n * 100) / 100;
  const parts = {
    visual_score: round(visual),
    location_score: round(location),
    time_score: round(time),
    feature_score: round(feature),
  };
  return {
    ...parts,
    total_score: round(Object.values(parts).reduce((x, y) => x + y, 0)),
  };
}

export function matchReasons(a: MatchItem, b: MatchItem): string[] {
  const reasons: string[] = [];
  if (a.type === b.type) reasons.push("Reports must be LOST and FOUND.");
  if (a.category !== b.category)
    reasons.push(`Different categories: ${a.category} / ${b.category}.`);
  const hours =
    Math.abs(Date.parse(a.event_at) - Date.parse(b.event_at)) / 3600000;
  if (!Number.isFinite(hours) || hours > 168)
    reasons.push("Event dates are more than 7 days apart or invalid.");
  const meters = distance(a, b);
  if (
    Number.isFinite(meters)
      ? meters > 500
      : !(a.location_id && a.location_id === b.location_id)
  )
    reasons.push(
      Number.isFinite(meters)
        ? "Locations are more than 500 m apart."
        : "No shared venue or pair of GPS positions to compare.",
    );
  if (!reasons.length) {
    const s = score(a, b);
    if (!s) reasons.push("Not enough evidence that these are the same object.");
    else if (s.total_score < 70)
      reasons.push(`Similarity score ${s.total_score}/100 is below 70.`);
  }
  return reasons;
}
