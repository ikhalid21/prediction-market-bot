import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getPlayersIndex, getAllSeasonStats } from "../lib/data";
import type { PlayerIndexEntry, Position, SeasonStatLine } from "../lib/types";
import { useScoring } from "../lib/ScoringContext";
import { fptsField, perGame, fmt1, fmt0 } from "../lib/format";
import PlayerAvatar from "../components/PlayerAvatar";
import PositionBadge from "../components/PositionBadge";
import TeamTag from "../components/TeamTag";
import Loading from "../components/Loading";

const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K"];
const SEASONS = Array.from({ length: 2025 - 2010 + 1 }, (_, i) => 2025 - i);

type SortKey = "fpts" | "ppg" | "yds" | "td" | "name";

export default function Players() {
  const { format } = useScoring();
  const [index, setIndex] = useState<PlayerIndexEntry[] | null>(null);
  const [seasonStats, setSeasonStats] = useState<Record<string, SeasonStatLine[]> | null>(null);
  const [season, setSeason] = useState(2025);
  const [pos, setPos] = useState<Position | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fpts");

  useEffect(() => {
    getPlayersIndex().then(setIndex);
    getAllSeasonStats().then(setSeasonStats);
  }, []);

  const rows = useMemo(() => {
    if (!index || !seasonStats) return [];
    const byId = new Map(index.map((p) => [p.id, p]));
    const field = fptsField(format);
    const out: { player: PlayerIndexEntry; stat: SeasonStatLine }[] = [];
    for (const [pid, seasons] of Object.entries(seasonStats)) {
      const stat = seasons.find((s) => s.season === season);
      const player = byId.get(pid);
      if (stat && player) out.push({ player, stat });
    }
    let filtered = out;
    if (pos !== "ALL") filtered = filtered.filter((r) => r.player.position === pos);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      filtered = filtered.filter((r) => r.player.name.toLowerCase().includes(q));
    }
    filtered.sort((a, b) => {
      if (sortKey === "name") return a.player.name.localeCompare(b.player.name);
      if (sortKey === "ppg") return perGame(b.stat[field], b.stat.games) - perGame(a.stat[field], a.stat.games);
      if (sortKey === "yds") {
        const ya = a.stat.rush_yds + a.stat.rec_yds + a.stat.pass_yds;
        const yb = b.stat.rush_yds + b.stat.rec_yds + b.stat.pass_yds;
        return yb - ya;
      }
      if (sortKey === "td") {
        const ta = a.stat.rush_td + a.stat.rec_td + a.stat.pass_td;
        const tb = b.stat.rush_td + b.stat.rec_td + b.stat.pass_td;
        return tb - ta;
      }
      return b.stat[field] - a.stat[field];
    });
    return filtered;
  }, [index, seasonStats, season, pos, query, sortKey, format]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Players</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Season stats for every fantasy-relevant player, {SEASONS[SEASONS.length - 1]}–{SEASONS[0]}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players…"
          className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] text-sm focus:outline-none focus:border-[var(--series-1)]"
        />
        <select
          value={season}
          onChange={(e) => setSeason(Number(e.target.value))}
          className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] text-sm"
        >
          {SEASONS.map((y) => (
            <option key={y} value={y}>
              {y} Season
            </option>
          ))}
        </select>
        <div className="flex rounded-lg border border-[var(--border)] p-0.5 bg-[var(--surface-1)]">
          <button
            onClick={() => setPos("ALL")}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-md ${pos === "ALL" ? "bg-[var(--surface-3)]" : "text-[var(--text-secondary)]"}`}
          >
            All
          </button>
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPos(p)}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md ${pos === p ? "bg-[var(--surface-3)]" : "text-[var(--text-secondary)]"}`}
            >
              {p}
            </button>
          ))}
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] text-sm"
        >
          <option value="fpts">Sort: Fantasy Pts</option>
          <option value="ppg">Sort: Pts / Game</option>
          <option value="yds">Sort: Total Yards</option>
          <option value="td">Sort: Total TDs</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {!index || !seasonStats ? (
        <Loading />
      ) : (
        <div className="card overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[var(--text-muted)] text-xs uppercase tracking-wide border-b border-[var(--border)]">
                <th className="py-2.5 pl-4 pr-2 w-10">#</th>
                <th className="py-2.5 px-2">Player</th>
                <th className="py-2.5 px-2">Team</th>
                <th className="py-2.5 px-2 text-right">GP</th>
                <th className="py-2.5 px-2 text-right">Yds</th>
                <th className="py-2.5 px-2 text-right">TD</th>
                <th className="py-2.5 px-2 text-right">Pts</th>
                <th className="py-2.5 px-2 pr-4 text-right">Pts/G</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 150).map((r, i) => {
                const field = fptsField(format);
                const yds = r.stat.rush_yds + r.stat.rec_yds + r.stat.pass_yds;
                const td = r.stat.rush_td + r.stat.rec_td + r.stat.pass_td;
                return (
                  <tr key={r.player.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-3)]">
                    <td className="py-2 pl-4 pr-2 text-xs tabular text-[var(--text-muted)]">{i + 1}</td>
                    <td className="py-2 px-2">
                      <Link to={`/players/${r.player.id}`} className="flex items-center gap-2.5 min-w-0">
                        <PlayerAvatar src={r.player.headshot} name={r.player.name} position={r.player.position} size={28} />
                        <span className="truncate font-medium hover:underline">{r.player.name}</span>
                        <PositionBadge position={r.player.position} />
                      </Link>
                    </td>
                    <td className="py-2 px-2">
                      <TeamTag team={r.stat.team} />
                    </td>
                    <td className="py-2 px-2 text-right tabular">{r.stat.games}</td>
                    <td className="py-2 px-2 text-right tabular">{fmt0(yds)}</td>
                    <td className="py-2 px-2 text-right tabular">{td}</td>
                    <td className="py-2 px-2 text-right tabular font-semibold">{fmt1(r.stat[field])}</td>
                    <td className="py-2 px-2 pr-4 text-right tabular">{fmt1(perGame(r.stat[field], r.stat.games))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > 150 && (
            <div className="text-center text-xs text-[var(--text-muted)] py-3 border-t border-[var(--border)]">
              Showing top 150 of {rows.length} — refine your search to narrow further.
            </div>
          )}
          {rows.length === 0 && <div className="text-center text-sm text-[var(--text-muted)] py-10">No players match your filters.</div>}
        </div>
      )}
    </div>
  );
}
