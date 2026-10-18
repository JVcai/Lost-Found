export interface MatchItem {
  type: string;
  category: string;
  brand: string;
  color: string;
  description: string;
  item_name: string;
  unique_features: string[];
  ai_features?: string[];
  location_id: string;
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
  if (a.location_id !== b.location_id && meters > 500) return null;
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
    30 * (a.location_id === b.location_id ? 1 : Math.max(0, 1 - meters / 500));
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
