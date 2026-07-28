import { useEffect, useMemo, useState } from "react";
import { getTeams, getSos2026, getWeeklyMatchups2026, getSchedule2026 } from "../lib/data";
import type { TeamInfo, SosMap, WeeklyMatchupsMap, Schedule2026 } from "../lib/types";
import Loading from "../components/Loading";

type Pos = "QB" | "RB" | "WR" | "TE";
const POSITIONS: Pos[] = ["QB", "RB", "WR", "TE"];

function rankColor(rank: number | null | undefined) {
  if (rank == null) return { bg: "var(--surface-3)", fg: "var(--text-muted)" };
  // rank 1 = easiest matchup (defense allows the most) -> favorable/green
  // rank 32 = hardest -> unfavorable/red
  const t = (rank - 1) / 31; // 0 easy -> 1 hard
  if (t <= 0.2) return { bg: "color-mix(in oklab, var(--good) 22%, transparent)", fg: "var(--good)" };
  if (t <= 0.45) return { bg: "color-mix(in oklab, var(--series-3) 18%, transparent)", fg: "var(--series-3)" };
  if (t <= 0.65) return { bg: "var(--surface-3)", fg: "var(--text-secondary)" };
  if (t <= 0.85) return { bg: "color-mix(in oklab, var(--serious) 20%, transparent)", fg: "var(--serious)" };
  return { bg: "color-mix(in oklab, var(--critical) 20%, transparent)", fg: "var(--critical)" };
}

export default function Schedule() {
  const [teams, setTeams] = useState<TeamInfo[] | null>(null);
  const [sos, setSos] = useState<SosMap | null>(null);
  const [matchups, setMatchups] = useState<WeeklyMatchupsMap | null>(null);
  const [schedule, setSchedule] = useState<Schedule2026 | null>(null);
  const [pos, setPos] = useState<Pos>("RB");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  useEffect(() => {
    getTeams().then(setTeams);
    getSos2026().then(setSos);
    getWeeklyMatchups2026().then(setMatchups);
    getSchedule2026().then(setSchedule);
  }, []);

  const ranked = useMemo(() => {
    if (!teams || !sos) return [];
    return [...teams]
      .map((t) => ({ team: t, entry: sos[t.abbr]?.[pos] }))
      .filter((r) => r.entry)
      .sort((a, b) => a.entry!.sos_rank - b.entry!.sos_rank);
  }, [teams, sos, pos]);

  const activeTeam = selectedTeam ?? ranked[0]?.team.abbr ?? null;

  const weeks = schedule?.weeks ?? [];
  const teamWeeks = activeTeam && matchups ? matchups[activeTeam] : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Schedule Difficulty</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          2026 rest-of-season strength of schedule, derived from how many fantasy points each defense allowed
          per position during the 2025 season. Rank 1 = easiest matchups, 32 = hardest.
        </p>
      </div>

      <div className="flex rounded-lg border border-[var(--border)] p-0.5 bg-[var(--surface-1)] w-fit">
        {POSITIONS.map((p) => (
          <button
            key={p}
            onClick={() => setPos(p)}
            className={`px-3.5 py-1.5 text-sm font-semibold rounded-md ${
              pos === p ? "bg-[var(--series-1)] text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {!teams || !sos ? (
        <Loading />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] font-semibold text-[15px]">
              League SOS Ranking — {pos}
            </div>
            <div className="max-h-[560px] overflow-y-auto scrollbar-thin">
              {ranked.map((r) => {
                const c = rankColor(r.entry!.sos_rank);
                return (
                  <button
                    key={r.team.abbr}
                    onClick={() => setSelectedTeam(r.team.abbr)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-3)] ${
                      activeTeam === r.team.abbr ? "bg-[var(--surface-3)]" : ""
                    }`}
                  >
                    <span
                      className="w-7 h-6 rounded flex items-center justify-center text-[11px] font-bold tabular"
                      style={{ background: c.bg, color: c.fg }}
                    >
                      {r.entry!.sos_rank}
                    </span>
                    <span className="font-medium">{r.team.abbr}</span>
                    <span className="text-[var(--text-muted)] text-xs truncate flex-1 text-left">{r.team.name}</span>
                    <span className="tabular text-xs text-[var(--text-secondary)]">
                      {r.entry!.avg_opp_pts_allowed.toFixed(1)} pts/g
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5 flex flex-col gap-4">
            {activeTeam && teams && (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="font-semibold text-[15px]">
                    {teams.find((t) => t.abbr === activeTeam)?.name} — Week-by-Week ({pos})
                  </h2>
                  <span className="text-xs text-[var(--text-muted)]">
                    Bye: Week {schedule?.bye_weeks[activeTeam] ?? "—"}
                  </span>
                </div>
                {!teamWeeks ? (
                  <Loading />
                ) : (
                  <div className="flex gap-1.5 flex-wrap">
                    {weeks.map((w) => {
                      const info = teamWeeks[String(w)];
                      const isBye = !info;
                      const rank = info ? info[`${pos}_rank` as keyof typeof info] : null;
                      const c = rankColor(isBye ? null : (rank as number | null));
                      return (
                        <div
                          key={w}
                          className="flex flex-col items-center gap-1 rounded-lg px-2.5 py-2 min-w-[58px]"
                          style={{ background: isBye ? "var(--surface-3)" : c.bg }}
                          title={isBye ? "Bye week" : `vs/@ ${info!.opp} — defense rank ${rank}`}
                        >
                          <span className="text-[10px] text-[var(--text-muted)] font-medium">W{w}</span>
                          {isBye ? (
                            <span className="text-[11px] text-[var(--text-muted)]">BYE</span>
                          ) : (
                            <>
                              <span className="text-xs font-semibold" style={{ color: c.fg }}>
                                {info!.home ? "" : "@"}
                                {info!.opp}
                              </span>
                              <span className="text-[10px] tabular" style={{ color: c.fg }}>
                                #{rank}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)] pt-1 flex-wrap">
                  <LegendDot color="var(--good)" label="Easiest matchups" />
                  <LegendDot color="var(--series-3)" label="Favorable" />
                  <LegendDot color="var(--text-muted)" label="Neutral" />
                  <LegendDot color="var(--serious)" label="Tough" />
                  <LegendDot color="var(--critical)" label="Hardest matchups" />
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
