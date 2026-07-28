import type { DraftPoolPlayer, Position } from "./types";

export const TEAM_COUNT = 10;
export const ROSTER_SLOTS: { slot: string; positions: Position[]; count: number }[] = [
  { slot: "QB", positions: ["QB"], count: 1 },
  { slot: "RB", positions: ["RB"], count: 2 },
  { slot: "WR", positions: ["WR"], count: 2 },
  { slot: "TE", positions: ["TE"], count: 1 },
  { slot: "FLEX", positions: ["RB", "WR", "TE"], count: 1 },
  { slot: "K", positions: ["K"], count: 1 },
  { slot: "DST", positions: ["DST"], count: 1 },
  { slot: "BENCH", positions: ["QB", "RB", "WR", "TE", "K", "DST"], count: 6 },
];
export const ROUNDS = ROSTER_SLOTS.reduce((a, s) => a + s.count, 0);

export interface DraftPick {
  overall: number;
  round: number;
  teamIndex: number;
  player: DraftPoolPlayer;
}

export function buildSnakeOrder(teamCount: number, rounds: number): number[] {
  const order: number[] = [];
  for (let r = 0; r < rounds; r++) {
    const roundOrder = Array.from({ length: teamCount }, (_, i) => i);
    if (r % 2 === 1) roundOrder.reverse();
    order.push(...roundOrder);
  }
  return order;
}

export function teamPositionCounts(picks: DraftPoolPlayer[]): Record<Position, number> {
  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  picks.forEach((p) => {
    counts[p.position] += 1;
  });
  return counts;
}

// how many of a slot's positions are already satisfied by a roster, ignoring bench
function startersFilled(picks: DraftPoolPlayer[], targetPositions: Position[]): number {
  return picks.filter((p) => targetPositions.includes(p.position)).length;
}

/** CPU picks the best available player weighted toward positional need + ADP value. */
export function cpuSelect(available: DraftPoolPlayer[], myPicks: DraftPoolPlayer[], round: number): DraftPoolPlayer {
  const startersNeeded = ROSTER_SLOTS.filter((s) => s.slot !== "BENCH");
  const need = new Set<Position>();
  for (const s of startersNeeded) {
    const filled = s.slot === "FLEX" ? 0 : startersFilled(myPicks, s.positions);
    if (filled < s.count) s.positions.forEach((p) => need.add(p));
  }
  // Early rounds: best player available. Later rounds: fill needs, avoid QB/K/DST too early.
  const pool = available.slice(0, 40);
  let candidates = pool;
  if (round <= 2) {
    candidates = pool.filter((p) => p.position !== "K" && p.position !== "DST");
  } else if (need.size > 0) {
    const needMatches = pool.filter((p) => need.has(p.position));
    if (needMatches.length > 0) candidates = needMatches;
  }
  if (round < 10) {
    candidates = candidates.filter((p) => p.position !== "K" && p.position !== "DST");
    if (candidates.length === 0) candidates = pool;
  }
  const top = candidates.slice(0, 5);
  const weights = top.map((_, i) => 1 / (i + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) return top[i];
  }
  return top[0] ?? available[0];
}

export function gradeGrade(deltaAvg: number): { letter: string; color: string } {
  if (deltaAvg >= 8) return { letter: "A+", color: "var(--good)" };
  if (deltaAvg >= 4) return { letter: "A", color: "var(--good)" };
  if (deltaAvg >= 1.5) return { letter: "B+", color: "var(--series-3)" };
  if (deltaAvg >= -1.5) return { letter: "B", color: "var(--series-3)" };
  if (deltaAvg >= -4) return { letter: "C", color: "var(--warning)" };
  if (deltaAvg >= -8) return { letter: "D", color: "var(--serious)" };
  return { letter: "F", color: "var(--critical)" };
}
