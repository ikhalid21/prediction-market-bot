import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSeasonLeaders, getPlayersIndex } from "../lib/data";
import type { SeasonLeaders, PlayerIndexEntry } from "../lib/types";
import PlayerAvatar from "../components/PlayerAvatar";
import PositionBadge from "../components/PositionBadge";
import TeamTag from "../components/TeamTag";
import Loading from "../components/Loading";

const LATEST_SEASON = 2025;

const FEATURES = [
  {
    to: "/players",
    title: "Players & Trends",
    desc: "Search 1,900+ players since 2010. Career stat lines, weekly game logs, and rolling performance trends.",
    color: "var(--series-1)",
  },
  {
    to: "/compare",
    title: "Compare Players",
    desc: "Put up to 4 players side by side — season totals, per-game rates, and a head-to-head radar chart.",
    color: "var(--series-2)",
  },
  {
    to: "/schedule",
    title: "Schedule Difficulty",
    desc: "2026 rest-of-season strength of schedule by position, built from real 2025 defensive performance.",
    color: "var(--series-3)",
  },
  {
    to: "/draft",
    title: "Mock Draft",
    desc: "Run a snake draft against 9 CPU teams using rankings from actual 2025 season production.",
    color: "var(--series-4)",
  },
  {
    to: "/historical",
    title: "Historical Seasons",
    desc: "Browse league leaders and champions at every position, season by season back to 2010.",
    color: "var(--series-7)",
  },
];

export default function Home() {
  const [leaders, setLeaders] = useState<SeasonLeaders | null>(null);
  const [players, setPlayers] = useState<Map<string, PlayerIndexEntry> | null>(null);

  useEffect(() => {
    getSeasonLeaders().then((all) => setLeaders(all[String(LATEST_SEASON)]));
    getPlayersIndex().then((list) => setPlayers(new Map(list.map((p) => [p.id, p]))));
  }, []);

  return (
    <div className="flex flex-col gap-10">
      <section className="pt-6 pb-2 text-center flex flex-col items-center gap-4">
        <span className="text-xs font-semibold tracking-wide uppercase text-[var(--series-3)]">
          Real NFL data · 2010–2026
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)] max-w-2xl">
          Your fantasy football command center
        </h1>
        <p className="text-[var(--text-secondary)] max-w-xl text-[15px]">
          Stats, trends, schedule difficulty, and mock drafts — all built on real historical NFL
          player data, not guesswork.
        </p>
        <div className="flex gap-3 flex-wrap justify-center pt-1">
          <Link
            to="/draft"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm"
            style={{ background: "var(--series-1)" }}
          >
            Start a Mock Draft
          </Link>
          <Link
            to="/players"
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-[var(--border)] bg-[var(--surface-1)] hover:bg-[var(--surface-3)]"
          >
            Explore Players
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <Link
            key={f.to}
            to={f.to}
            className="group rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5 flex flex-col gap-2 hover:border-[var(--border-strong)] transition-colors"
          >
            <span className="w-9 h-9 rounded-lg" style={{ background: `color-mix(in oklab, ${f.color} 18%, transparent)` }} />
            <h3 className="font-semibold text-[15px] text-[var(--text-primary)]">{f.title}</h3>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{f.desc}</p>
            <span className="text-[13px] font-medium mt-auto pt-2" style={{ color: f.color }}>
              Open →
            </span>
          </Link>
        ))}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[15px]">{LATEST_SEASON} Season — Top 10 Overall (PPR)</h2>
          <Link to="/historical" className="text-xs font-medium text-[var(--series-1)]">
            View all seasons →
          </Link>
        </div>
        {!leaders || !players ? (
          <Loading />
        ) : (
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
            {leaders.OVERALL.map((r, i) => {
              const p = players.get(r.player_id!);
              return (
                <li key={r.player_id} className="flex items-center gap-3 py-1.5 border-b border-[var(--border)] last:border-0">
                  <span className="w-5 text-right text-xs tabular text-[var(--text-muted)]">{i + 1}</span>
                  <PlayerAvatar src={p?.headshot} name={r.name!} position={r.position!} size={30} />
                  <Link to={`/players/${r.player_id}`} className="flex-1 min-w-0 truncate text-sm font-medium hover:underline">
                    {r.name}
                  </Link>
                  <PositionBadge position={r.position!} />
                  <TeamTag team={r.team} />
                  <span className="tabular text-sm font-semibold w-14 text-right">{r.fpts_ppr?.toFixed(1)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
