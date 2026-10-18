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
  new Set(
    s
      .replace(/([a-zа-я])([A-ZА-Я])/g, "$1 $2")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/ё/g, "е")
      .match(/[\p{L}\p{N}]+/gu) || [],
  );
const aliases: Record<string, string> = {
  diamond: "gemstone",
  diamonds: "gemstone",
  gem: "gemstone",
  gemstone: "gemstone",
  stone: "gemstone",
  stones: "gemstone",
  алмаз: "gemstone",
  алмаза: "gemstone",
  бриллиант: "gemstone",
  бриллианта: "gemstone",
  камень: "gemstone",
  камня: "gemstone",
  камнем: "gemstone",
  камню: "gemstone",
  cat: "cat",
  cats: "cat",
  кот: "cat",
  кота: "cat",
  кошка: "cat",
  кошки: "cat",
};
// Bounded edit distance handles small typos, not arbitrary common prefixes.
function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const length = Math.max(a.length, b.length),
    limit = Math.min(2, Math.floor(length * 0.2));
  if (
    Math.min(a.length, b.length) < 4 ||
    length > 40 ||
    Math.abs(a.length - b.length) > limit ||
    !limit
  )
    return 0;
  if (a.length === b.length) {
    const mismatch = [...a]
      .map((c, i) => (c !== b[i] ? i : -1))
      .filter((i) => i >= 0);
    if (
      mismatch.length === 2 &&
      mismatch[1] === mismatch[0] + 1 &&
      a[mismatch[0]] === b[mismatch[1]] &&
      a[mismatch[1]] === b[mismatch[0]]
    )
      return 1 - 1 / length;
  }
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
    if (Math.min(...next) > limit) return 0;
    row = next;
  }
  return row[b.length] <= limit ? 1 - row[b.length] / length : 0;
}
const canonicalCache = new Map<string, string>();
function canonical(word: string): string {
  const cached = canonicalCache.get(word);
  if (cached) return cached;
  if (aliases[word]) return aliases[word];
  // A typo in "diamond" must still compare with the canonical gemstone label.
  const possible = new Set(
    Object.entries(aliases)
      .filter(
        ([key]) =>
          Math.min(word.length, key.length) >= 6 &&
          wordSimilarity(word, key) >= 0.8,
      )
      .map(([, value]) => value),
  );
  const value = possible.size === 1 ? [...possible][0] : word;
  if (canonicalCache.size >= 4096) canonicalCache.clear();
  canonicalCache.set(word, value);
  return value;
}
export function similarity(a: string, b: string): number {
  let x = [...new Set([...words(a)].map(canonical))],
    y = [...new Set([...words(b)].map(canonical))];
  if (!x.length || !y.length) return 0;
  if (x.length > y.length) [x, y] = [y, x];
  // Each word can be used once. Exact matches first, then typo matches.
  const used = new Set<number>();
  let matched = 0;
  const pending: string[] = [];
  for (const word of x) {
    const i = y.findIndex((other, i) => !used.has(i) && other === word);
    if (i >= 0) {
      used.add(i);
      matched++;
    } else pending.push(word);
  }
  for (const word of pending) {
    let best = 0,
      index = -1;
    y.forEach((other, i) => {
      if (!used.has(i)) {
        const value = wordSimilarity(word, other);
        if (value > best) {
          best = value;
          index = i;
        }
      }
    });
    if (index >= 0) {
      used.add(index);
      matched += best;
    }
  }
  // Extra details do not dilute a shorter description whose words all match.
  return matched / x.length;
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
  grey: "grey",
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
      `Name, color and description similarity is ${s.total_score}%. A suggestion requires strictly more than 75%. Contributions: name ${s.visual_score}, description ${s.location_score}, color ${s.time_score} points.`,
    ];
  return [];
}
