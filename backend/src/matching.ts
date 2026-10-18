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
// MVP: one shared word in user-written names/descriptions is enough for a
// suggestion. Generic reporting words alone are not evidence of an object.
const filler = new Set(
  "a an the my i and with lost found item thing near at in on of is it this was have has please потерял потерян потеряна найден найдена нашел нашёл мой моя это вещь предмет в на и у с из для".split(
    " ",
  ),
);
export function textOverlap(a: MatchItem, b: MatchItem): number {
  const meaningful = (r: MatchItem) =>
    [...words(`${r.item_name} ${r.description}`)].filter((w) => !filler.has(w));
  const x = new Set(meaningful(a)),
    y = new Set(meaningful(b));
  if (!x.size || !y.size) return 0;
  return [...x].filter((w) => y.has(w)).length / new Set([...x, ...y]).size;
}
export function score(a: MatchItem, b: MatchItem) {
  if (a.type === b.type || !textOverlap(a, b)) return null;
  const equal = (x: string, y: string) =>
    x.trim() && y.trim() && x.trim().toLowerCase() === y.trim().toLowerCase()
      ? 1
      : 0;
  const hours =
    Math.abs(Date.parse(a.event_at) - Date.parse(b.event_at)) / 3600000;
  const meters = distance(a, b);
  const samePlace = Boolean(a.location_id && a.location_id === b.location_id);
  // Restore the original 40/30/20/10 ranking. The score orders suggestions;
  // it is not an admission threshold and is not a probability of ownership.
  const parts = {
    visual_score:
      40 *
      (0.3 +
        0.25 * equal(a.color, b.color) +
        0.2 * equal(a.brand, b.brand) +
        0.25 *
          similarity(
            `${a.item_name} ${a.description}`,
            `${b.item_name} ${b.description}`,
          )),
    location_score:
      30 *
      (samePlace
        ? 1
        : Number.isFinite(meters)
          ? Math.max(0, 1 - meters / 500)
          : 0),
    time_score: Number.isFinite(hours) ? 20 * Math.exp(-hours / 48) : 0,
    feature_score:
      10 * similarity(a.unique_features.join(" "), b.unique_features.join(" ")),
  };
  const round = (n: number) => Math.round(n * 100) / 100;
  const rounded = Object.fromEntries(
    Object.entries(parts).map(([k, v]) => [k, round(v)]),
  ) as typeof parts;
  return {
    ...rounded,
    total_score: round(Object.values(rounded).reduce((x, y) => x + y, 0)),
  };
}
export function matchReasons(a: MatchItem, b: MatchItem): string[] {
  if (a.type === b.type) return ["Reports must be LOST and FOUND."];
  if (!textOverlap(a, b))
    return [
      "No shared words in the names or descriptions. The lost item remains Searching.",
    ];
  return [];
}
