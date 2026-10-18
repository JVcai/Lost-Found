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
export const MATCH_THRESHOLD = 75;
const filler = new Set(
  "a an the my i and with lost found item thing near at in on of is it this was have has please потерял потерян потеряна найден найдена нашел нашёл мой моя это вещь предмет в на и у с из для".split(
    " ",
  ),
);
const colors: Record<string, string> = {
  gray: "grey",
  серый: "grey",
  серая: "grey",
  white: "white",
  белый: "white",
  белая: "white",
  yellow: "yellow",
  желтый: "yellow",
  жёлтый: "yellow",
  желтая: "yellow",
  жёлтая: "yellow",
  black: "black",
  черный: "black",
  чёрный: "black",
  blue: "blue",
  синий: "blue",
  red: "red",
  красный: "red",
  green: "green",
  зеленый: "green",
  зелёный: "green",
};
const text = (value: string) =>
  [...words(value)].filter((w) => !filler.has(w) && !colors[w]).join(" ");
const color = (value: string) =>
  [...words(value)].map((w) => colors[w] || w).join(" ");
export function score(a: MatchItem, b: MatchItem) {
  if (a.type === b.type) return null;
  const name = similarity(text(a.item_name), text(b.item_name));
  const description = similarity(text(a.description), text(b.description));
  if (!name && !description) return null;
  const hasDescription = Boolean(text(a.description) || text(b.description));
  // Empty descriptions are unknown, not identical evidence. If both are empty,
  // distribute the available weight between the name and the color.
  const scale = hasDescription ? 1 : 100 / 70;
  const round = (n: number) => Math.round(n * 100) / 100;
  const parts = {
    visual_score: round(50 * name * scale),
    location_score: round(hasDescription ? 30 * description : 0),
    time_score: round(20 * similarity(color(a.color), color(b.color)) * scale),
    feature_score: 0,
  };
  return {
    ...parts,
    total_score: Math.min(
      100,
      round(Object.values(parts).reduce((x, y) => x + y, 0)),
    ),
    score_version: 2,
  };
}
export function qualifies(s: ReturnType<typeof score>) {
  return Boolean(s && s.total_score > MATCH_THRESHOLD);
}
export function matchReasons(a: MatchItem, b: MatchItem): string[] {
  if (a.type === b.type) return ["Reports must be LOST and FOUND."];
  const s = score(a, b);
  if (!s)
    return [
      "Names and descriptions do not match. Shared color alone is not enough; the lost item remains Searching.",
    ];
  if (!qualifies(s))
    return [
      `Name, color and description similarity is ${s.total_score}%. A suggestion requires strictly more than 75%.`,
    ];
  return [];
}
