import { useEffect, useMemo, useRef, useState } from "react";
import { getDraftPool } from "../lib/data";
import type { DraftPoolPlayer, Position } from "../lib/types";
import {
  ROUNDS,
  ROSTER_SLOTS,
  TEAM_COUNT_OPTIONS,
  DEFAULT_TEAM_COUNT,
  type TeamCount,
  buildSnakeOrder,
  cpuSelect,
  gradeGrade,
  type DraftPick,
} from "../lib/draft";
import PlayerAvatar from "../components/PlayerAvatar";
import PositionBadge from "../components/PositionBadge";
import TeamTag from "../components/TeamTag";
import Loading from "../components/Loading";

const POS_FILTERS: (Position | "ALL")[] = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];

export default function Draft() {
  const [pool, setPool] = useState<DraftPoolPlayer[] | null>(null);
  const [started, setStarted] = useState(false);
  const [teamCount, setTeamCount] = useState<TeamCount>(DEFAULT_TEAM_COUNT);
  const [userSlot, setUserSlot] = useState(4);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [posFilter, setPosFilter] = useState<Position | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    getDraftPool().then(setPool);
  }, []);

  const order = useMemo(() => buildSnakeOrder(teamCount, ROUNDS), [teamCount]);
  const totalPicks = order.length;

  const draftedIds = useMemo(() => new Set(picks.map((p) => p.player.id)), [picks]);
  const available = useMemo(() => {
    if (!pool) return [];
    return pool.filter((p) => !draftedIds.has(p.id)).sort((a, b) => a.adp_rank - b.adp_rank);
  }, [pool, draftedIds]);

  const currentPickNumber = picks.length;
  const draftComplete = currentPickNumber >= totalPicks;
  const currentTeam = draftComplete ? null : order[currentPickNumber];
  const isUserTurn = currentTeam === userSlot;
  const currentRound = Math.floor(currentPickNumber / teamCount) + 1;

  const myPicks = useMemo(() => picks.filter((p) => p.teamIndex === userSlot).map((p) => p.player), [picks, userSlot]);

  useEffect(() => {
    if (!started || draftComplete || isUserTurn || !pool) return;
    timeoutRef.current = window.setTimeout(() => {
      const teamPicks = picks.filter((p) => p.teamIndex === currentTeam).map((p) => p.player);
      const chosen = cpuSelect(available, teamPicks, currentRound);
      if (chosen) {
        setPicks((prev) => [...prev, { overall: prev.length + 1, round: currentRound, teamIndex: currentTeam!, player: chosen }]);
      }
    }, 300);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [started, draftComplete, isUserTurn, pool, available, picks, currentTeam, currentRound]);

  function draftPlayer(p: DraftPoolPlayer) {
    if (!isUserTurn || draftComplete) return;
    setPicks((prev) => [...prev, { overall: prev.length + 1, round: currentRound, teamIndex: userSlot, player: p }]);
  }

  function reset() {
    setStarted(false);
    setPicks([]);
  }

  function changeTeamCount(n: TeamCount) {
    setTeamCount(n);
    if (userSlot >= n) setUserSlot(0);
  }

  const filteredAvailable = useMemo(() => {
    let rows = available;
    if (posFilter !== "ALL") rows = rows.filter((p) => p.position === posFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((p) => p.name.toLowerCase().includes(q));
    }
    return rows.slice(0, 60);
  }, [available, posFilter, query]);

  if (!pool) return <Loading label="Loading draft pool…" />;

  if (!started) {
    return (
      <div className="max-w-lg mx-auto flex flex-col gap-5 py-10 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Mock Draft</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Snake draft against {teamCount - 1} CPU teams · {ROUNDS} rounds. Rankings are our own 2026 Half-PPR
          (0.5 pt/reception) projections — built from multi-year trends and aging curves, not just last year's
          totals — Top-300, value-based. Not a live ADP feed.
        </p>
        <div className="card p-6 flex flex-col gap-5 items-center">
          <div className="flex flex-col gap-2 items-center">
            <label className="text-sm font-medium">League size</label>
            <div className="flex rounded-lg border border-[var(--border)] p-0.5">
              {TEAM_COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => changeTeamCount(n)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                    teamCount === n ? "brand-gradient text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {n} teams
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <label className="text-sm font-medium">Your draft slot</label>
            <div className="flex flex-wrap gap-2 justify-center max-w-xs">
              {Array.from({ length: teamCount }, (_, i) => i).map((i) => (
                <button
                  key={i}
                  onClick={() => setUserSlot(i)}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-colors ${
                    userSlot === i
                      ? "brand-gradient text-white border-transparent"
                      : "border-[var(--border)] hover:bg-[var(--surface-3)]"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setStarted(true)}
            className="mt-1 px-6 py-2.5 rounded-lg text-sm font-semibold text-white brand-gradient shadow-[0_4px_16px_-4px_color-mix(in_oklab,var(--series-1)_55%,transparent)]"
          >
            Start Draft
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mock Draft</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            You are Team {userSlot + 1} of {teamCount}
          </p>
        </div>
        <button onClick={reset} className="text-sm font-medium px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-3)]">
          Reset Draft
        </button>
      </div>

      {!draftComplete ? (
        <div
          className={`rounded-xl border p-4 flex items-center justify-between flex-wrap gap-2 ${
            isUserTurn ? "border-[var(--series-1)] bg-[color-mix(in_oklab,var(--series-1)_10%,transparent)]" : "border-[var(--border)] bg-[var(--surface-1)]"
          }`}
        >
          <span className="font-semibold text-sm">
            Round {currentRound} · Pick {currentPickNumber + 1} of {totalPicks}
          </span>
          <span className="text-sm">
            {isUserTurn ? (
              <span className="font-bold" style={{ color: "var(--series-1)" }}>
                You're on the clock
              </span>
            ) : (
              <span className="text-[var(--text-secondary)]">Team {currentTeam! + 1} is picking…</span>
            )}
          </span>
        </div>
      ) : (
        <DraftResults picks={picks} userSlot={userSlot} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <section className="card overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] flex flex-wrap gap-2 items-center">
            <h2 className="font-semibold text-[15px] mr-auto">Available Players</h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] text-xs w-32"
            />
            <div className="flex rounded-lg border border-[var(--border)] p-0.5">
              {POS_FILTERS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPosFilter(p)}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-md ${
                    posFilter === p ? "bg-[var(--surface-3)]" : "text-[var(--text-secondary)]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[560px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--surface-1)]">
                <tr className="text-left text-[var(--text-muted)] text-xs uppercase border-b border-[var(--border)]">
                  <th className="py-2 pl-4 pr-2 w-10">Rk</th>
                  <th className="py-2 px-2">Player</th>
                  <th className="py-2 px-2 text-right">Proj '26</th>
                  <th className="py-2 px-2 text-right">'25 Actual</th>
                  <th className="py-2 px-2 pr-4 text-right w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filteredAvailable.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-3)]">
                    <td className="py-1.5 pl-4 pr-2 tabular text-xs text-[var(--text-muted)]">{p.adp_rank}</td>
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <PlayerAvatar src={p.headshot} name={p.name} position={p.position} size={26} />
                        <span className="truncate font-medium">{p.name}</span>
                        <PositionBadge position={p.position} />
                        <span className="text-xs text-[var(--text-muted)]">{p.team}</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular font-semibold">{p.proj_fpts_half.toFixed(1)}</td>
                    <td className="py-1.5 px-2 text-right tabular text-[var(--text-muted)]">{p.last_season_fpts_half.toFixed(1)}</td>
                    <td className="py-1.5 px-2 pr-4 text-right">
                      <button
                        disabled={!isUserTurn || draftComplete}
                        onClick={() => draftPlayer(p)}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold text-white disabled:opacity-30 disabled:cursor-not-allowed brand-gradient"
                      >
                        Draft
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <MyRoster picks={myPicks} />
      </div>

      <DraftBoard picks={picks} order={order} teamCount={teamCount} userSlot={userSlot} currentPickNumber={currentPickNumber} />
    </div>
  );
}

function MyRoster({ picks }: { picks: DraftPoolPlayer[] }) {
  const remaining = [...picks];
  const assigned: { slot: string; player: DraftPoolPlayer | null }[] = [];
  for (const slotDef of ROSTER_SLOTS) {
    for (let i = 0; i < slotDef.count; i++) {
      const idx = remaining.findIndex((p) => slotDef.positions.includes(p.position));
      if (idx >= 0) {
        assigned.push({ slot: slotDef.slot, player: remaining[idx] });
        remaining.splice(idx, 1);
      } else {
        assigned.push({ slot: slotDef.slot, player: null });
      }
    }
  }
  return (
    <section className="card p-4 h-fit">
      <h2 className="font-semibold text-[15px] mb-3">My Roster</h2>
      <div className="flex flex-col gap-1">
        {assigned.map((a, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[var(--border)] last:border-0 text-sm">
            <span className="w-11 text-[11px] font-semibold text-[var(--text-muted)]">{a.slot}</span>
            {a.player ? (
              <>
                <PlayerAvatar src={a.player.headshot} name={a.player.name} position={a.player.position} size={22} />
                <span className="truncate flex-1">{a.player.name}</span>
                <PositionBadge position={a.player.position} />
              </>
            ) : (
              <span className="text-[var(--text-muted)] text-xs">—</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DraftResults({ picks, userSlot }: { picks: DraftPick[]; userSlot: number }) {
  const myPicks = picks.filter((p) => p.teamIndex === userSlot);
  const values = myPicks.map((p) => p.overall - p.player.adp_rank);
  const avgValue = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const grade = gradeGrade(avgValue);
  const sortedByValue = [...myPicks].sort((a, b) => b.overall - b.player.adp_rank - (a.overall - a.player.adp_rank));
  const steal = sortedByValue[0];
  const reach = sortedByValue[sortedByValue.length - 1];
  return (
    <section className="rounded-xl border p-5 flex flex-col gap-3" style={{ borderColor: grade.color }}>
      <div className="flex items-center gap-4">
        <span className="text-4xl font-bold" style={{ color: grade.color }}>
          {grade.letter}
        </span>
        <div>
          <div className="font-semibold text-[15px]">Draft Complete</div>
          <div className="text-xs text-[var(--text-secondary)]">
            Average value: {avgValue >= 0 ? "+" : ""}
            {avgValue.toFixed(1)} picks vs. ranking
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {steal && (
          <div className="rounded-lg bg-[var(--surface-3)] p-3">
            <div className="text-xs text-[var(--good)] font-semibold mb-1">Best Value</div>
            {steal.player.name} — picked #{steal.overall}, ranked #{steal.player.adp_rank}
          </div>
        )}
        {reach && reach !== steal && (
          <div className="rounded-lg bg-[var(--surface-3)] p-3">
            <div className="text-xs text-[var(--serious)] font-semibold mb-1">Biggest Reach</div>
            {reach.player.name} — picked #{reach.overall}, ranked #{reach.player.adp_rank}
          </div>
        )}
      </div>
    </section>
  );
}

function DraftBoard({
  picks,
  order,
  teamCount,
  userSlot,
  currentPickNumber,
}: {
  picks: DraftPick[];
  order: number[];
  teamCount: number;
  userSlot: number;
  currentPickNumber: number;
}) {
  const rounds = Math.ceil(order.length / teamCount);
  const currentRound = Math.floor(currentPickNumber / teamCount) + 1;
  const currentTeam = currentPickNumber < order.length ? order[currentPickNumber] : null;
  return (
    <section className="card overflow-hidden">
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-[15px]">Draft Board</h2>
        <span className="text-xs text-[var(--text-muted)]">Every pick, every team — updates live as the draft goes.</span>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="text-xs min-w-[1100px] w-full border-collapse">
          <thead>
            <tr>
              <th className="py-2.5 px-2 sticky left-0 z-10 bg-[var(--surface-1)] w-10">Rd</th>
              {Array.from({ length: teamCount }, (_, i) => (
                <th
                  key={i}
                  className={`py-2.5 px-2 font-semibold border-l border-[var(--border)] ${
                    i === userSlot ? "text-[var(--series-1)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  Team {i + 1}
                  {i === userSlot && <span className="ml-1 text-[9px] font-bold uppercase tracking-wide">(You)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rounds }, (_, r) => (
              <tr key={r} className="border-t border-[var(--border)]">
                <td className="py-2 px-2 sticky left-0 z-10 bg-[var(--surface-1)] font-bold tabular text-[var(--text-secondary)]">{r + 1}</td>
                {Array.from({ length: teamCount }, (_, t) => {
                  const pickIndexInRound = r % 2 === 0 ? t : teamCount - 1 - t;
                  const overall = r * teamCount + pickIndexInRound + 1;
                  const pick = picks.find((p) => p.round === r + 1 && p.teamIndex === t);
                  const isOnClock = currentTeam === t && currentRound === r + 1;
                  return (
                    <td
                      key={t}
                      className={`p-1.5 border-l border-[var(--border)] align-top ${
                        t === userSlot ? "bg-[color-mix(in_oklab,var(--series-1)_7%,transparent)]" : ""
                      } ${isOnClock ? "bg-[color-mix(in_oklab,var(--series-4)_18%,transparent)] ring-1 ring-inset ring-[var(--series-4)]" : ""}`}
                    >
                      {pick ? (
                        <div className="flex items-center gap-1.5 min-w-[110px]">
                          <PlayerAvatar src={pick.player.headshot} name={pick.player.name} position={pick.player.position} size={22} />
                          <div className="min-w-0 flex flex-col leading-tight">
                            <span className="flex items-center gap-1">
                              <span className="text-[9px] text-[var(--text-muted)] tabular">#{overall}</span>
                              <span className="truncate max-w-[86px] font-medium">{pick.player.name}</span>
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                              <PositionBadge position={pick.player.position} />
                              <TeamTag team={pick.player.team} />
                            </span>
                          </div>
                        </div>
                      ) : isOnClock ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--series-4)" }}>
                          On the clock
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] px-1">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
