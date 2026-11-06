import type { Match } from "@lostnet/shared";
export function groupMatches(matches: Match[]): Record<string, Match[]> {
  const groups: Record<string, Match[]> = {};
  const seen = new Set<string>();
  for (const match of matches) {
    if (match.status === "REJECTED" || seen.has(match.id)) continue;
    seen.add(match.id);
    const own = match.viewer_is_owner
      ? match.lost_report_id
      : match.found_report_id;
    (groups[own] ??= []).push(match);
  }
  return groups;
}
export function counterpart(match: Match) {
  return match.viewer_is_owner ? match.found : match.lost;
}
