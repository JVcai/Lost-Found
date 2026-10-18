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
  ai_analysis?: { object_type?: string } | null;
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
  if (names < 0.2 && text < 0.2 && !visualObject && !brandColor) return null;
  if (objectA && objectB && similarity(objectA, objectB) === 0 && names < 0.5)
    return null;
  const equal = (x: string, y: string) =>
    x.trim() && y.trim() && x.toLowerCase() === y.toLowerCase() ? 1 : 0;
  const visual =
    40 *
    (0.3 +
      0.25 * equal(a.color, b.color) +
      0.2 * equal(a.brand, b.brand) +
      0.25 *
        similarity(
          [a.item_name, a.description, ...(a.ai_features || [])].join(" "),
          [b.item_name, b.description, ...(b.ai_features || [])].join(" "),
        ));
  const location =
    30 *
    (Number.isFinite(meters)
      ? Math.max(0, 1 - meters / 500)
      : samePlace
        ? 1
        : 0);
  const time = 20 * Math.exp(-hours / 48);
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
