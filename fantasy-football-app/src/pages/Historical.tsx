import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSeasonLeaders } from "../lib/data";
import type { SeasonLeaders } from "../lib/types";
import PositionBadge from "../components/PositionBadge";
import TeamTag from "../components/TeamTag";
import Loading from "../components/Loading";
import { fmt0, fmt1 } from "../lib/format";

const SEASONS = Array.from({ length: 2025 - 2010 + 1 }, (_, i) => 2025 - i);
type Tab = "QB" | "RB" | "WR" | "TE" | "K" | "DST";
const TABS: Tab[] = ["QB", "RB", "WR", "TE", "K", "DST"];

export default function Historical() {
  const [allLeaders, setAllLeaders] = useState<Record<string, SeasonLeaders> | null>(null);
  const [season, setSeason] = useState(2025);
  const [tab, setTab] = useState<Tab>("QB");

  useEffect(() => {
    getSeasonLeaders().then(setAllLeaders);
  }, []);

  const leaders = allLeaders?.[String(season)];
  const mvp = leaders?.OVERALL[0];

  const rows = useMemo(() => leaders?.[tab] ?? [], [leaders, tab]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historical Seasons</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">League leaders at every position, {SEASONS[SEASONS.length - 1]}–{SEASONS[0]}.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={season}
          onChange={(e) => setSeason(Number(e.target.value))}
          className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] text-sm font-medium"
        >
          {SEASONS.map((y) => (
            <option key={y} value={y}>
              {y} Season
            </option>
          ))}
        </select>
        {mvp && (
          <div className="flex items-center gap-2 text-sm bg-[var(--surface-1)] border border-[var(--border)] rounded-lg px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--series-4)]">Fantasy MVP</span>
            {mvp.player_id ? (
              <Link to={`/players/${mvp.player_id}`} className="font-semibold hover:underline">
                {mvp.name}
              </Link>
            ) : (
              <span className="font-semibold">{mvp.name}</span>
            )}
            {mvp.position && <PositionBadge position={mvp.position} />}
            <span className="tabular text-[var(--text-secondary)]">{mvp.fpts_ppr?.toFixed(1)} pts</span>
          </div>
        )}
      </div>

      <div className="flex rounded-lg border border-[var(--border)] p-0.5 bg-[var(--surface-1)] w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 text-sm font-semibold rounded-md ${
              tab === t ? "bg-[var(--series-1)] text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {!allLeaders ? (
        <Loading />
      ) : (
        <section className="card overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-[var(--text-muted)] text-xs uppercase tracking-wide border-b border-[var(--border)]">
                <th className="py-2.5 pl-4 pr-2 w-10">#</th>
                <th className="py-2.5 px-2">{tab === "DST" ? "Team" : "Player"}</th>
                {tab !== "DST" && <th className="py-2.5 px-2">Team</th>}
                <th className="py-2.5 px-2 text-right">GP</th>
                {tab === "DST" ? (
                  <>
                    <th className="py-2.5 px-2 text-right">Sacks</th>
                    <th className="py-2.5 px-2 text-right">INT</th>
                    <th className="py-2.5 px-2 text-right">Def TD</th>
                  </>
                ) : tab === "QB" ? (
                  <>
                    <th className="py-2.5 px-2 text-right">Pass Yds</th>
                    <th className="py-2.5 px-2 text-right">Pass TD</th>
                    <th className="py-2.5 px-2 text-right">Rush Yds</th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 px-2 text-right">Rec</th>
                    <th className="py-2.5 px-2 text-right">Rec Yds</th>
                    <th className="py-2.5 px-2 text-right">Rush Yds</th>
                  </>
                )}
                <th className="py-2.5 px-2 pr-4 text-right">Fantasy Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.player_id ?? r.team} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-3)]">
                  <td className="py-2 pl-4 pr-2 text-xs tabular text-[var(--text-muted)]">{i + 1}</td>
                  <td className="py-2 px-2 font-medium">
                    {r.player_id ? (
                      <Link to={`/players/${r.player_id}`} className="hover:underline">
                        {r.name}
                      </Link>
                    ) : (
                      r.name ?? r.team
                    )}
                  </td>
                  {tab !== "DST" && (
                    <td className="py-2 px-2">
                      <TeamTag team={r.team} />
                    </td>
                  )}
                  <td className="py-2 px-2 text-right tabular">{r.games ?? 17}</td>
                  {tab === "DST" ? (
                    <>
                      <td className="py-2 px-2 text-right tabular">{fmt1(r.sacks ?? 0)}</td>
                      <td className="py-2 px-2 text-right tabular">{r.ints ?? 0}</td>
                      <td className="py-2 px-2 text-right tabular">{r.def_td ?? 0}</td>
                    </>
                  ) : tab === "QB" ? (
                    <>
                      <td className="py-2 px-2 text-right tabular">{fmt0(r.pass_yds ?? 0)}</td>
                      <td className="py-2 px-2 text-right tabular">{r.pass_td ?? 0}</td>
                      <td className="py-2 px-2 text-right tabular">{fmt0(r.rush_yds ?? 0)}</td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-2 text-right tabular">{r.rec ?? 0}</td>
                      <td className="py-2 px-2 text-right tabular">{fmt0(r.rec_yds ?? 0)}</td>
                      <td className="py-2 px-2 text-right tabular">{fmt0(r.rush_yds ?? 0)}</td>
                    </>
                  )}
                  <td className="py-2 px-2 pr-4 text-right tabular font-semibold">{fmt1(tab === "K" ? (r.fpts ?? 0) : (r.fpts_ppr ?? r.fpts ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
