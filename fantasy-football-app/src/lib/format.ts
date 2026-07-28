import type { Position, ScoringFormat, SeasonStatLine, WeeklyStatLine } from "./types";

export const POSITION_COLORS: Record<Position, string> = {
  QB: "var(--series-1)",
  RB: "var(--series-3)",
  WR: "var(--series-2)",
  TE: "var(--series-7)",
  K: "var(--series-4)",
  DST: "var(--series-8)",
};

export const SERIES_ORDER = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

export function fptsField(format: ScoringFormat): "fpts" | "fpts_ppr" | "fpts_half" {
  if (format === "ppr") return "fpts_ppr";
  if (format === "half") return "fpts_half";
  return "fpts";
}

export function statFpts(row: SeasonStatLine | WeeklyStatLine, format: ScoringFormat): number {
  return row[fptsField(format)];
}

export function fmt1(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function fmt0(n: number): string {
  return Math.round(n).toLocaleString();
}

export function perGame(total: number, games: number): number {
  if (!games) return 0;
  return total / games;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function scoringLabel(format: ScoringFormat): string {
  if (format === "ppr") return "PPR";
  if (format === "half") return "Half-PPR";
  return "Standard";
}
