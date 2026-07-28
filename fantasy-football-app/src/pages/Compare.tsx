import { useEffect, useMemo, useState } from "react";
import { getPlayersIndex, getAllSeasonStats } from "../lib/data";
import type { PlayerIndexEntry, SeasonStatLine } from "../lib/types";
import { useScoring } from "../lib/ScoringContext";
import { fptsField, perGame, fmt1, fmt0, scoringLabel, SERIES_ORDER } from "../lib/format";
import PlayerAvatar from "../components/PlayerAvatar";
import PositionBadge from "../components/PositionBadge";
import Loading from "../components/Loading";
import RadarCompareChart from "../components/RadarCompareChart";

const MAX_PLAYERS = 4;
const SEASON = 2025;

interface Selected {
  player: PlayerIndexEntry;
  stat: SeasonStatLine;
}

export default function Compare() {
  const { format } = useScoring();
  const [index, setIndex] = useState<PlayerIndexEntry[] | null>(null);
  const [seasonStats, setSeasonStats] = useState<Record<string, SeasonStatLine[]> | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getPlayersIndex().then(setIndex);
    getAllSeasonStats().then(setSeasonStats);
  }, []);

  const selected: Selected[] = useMemo(() => {
    if (!index || !seasonStats) return [];
    const byId = new Map(index.map((p) => [p.id, p]));
    return selectedIds
      .map((id) => {
        const player = byId.get(id);
        const stat = seasonStats[id]?.find((s) => s.season === SEASON) ?? seasonStats[id]?.[seasonStats[id].length - 1];
        return player && stat ? { player, stat } : null;
      })
      .filter((x): x is Selected => !!x);
  }, [selectedIds, index, seasonStats]);

  const searchResults = useMemo(() => {
    if (!index || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    return index
      .filter((p) => p.name.toLowerCase().includes(q) && !selectedIds.includes(p.id))
      .sort((a, b) => b.best_ppr - a.best_ppr)
      .slice(0, 8);
  }, [index, query, selectedIds]);

  const field = fptsField(format);

  const radarData = useMemo(() => {
    if (selected.length === 0) return [];
    const metrics: { key: string; label: string; get: (s: Selected) => number }[] = [
      { key: "fpts", label: "Fantasy Pts", get: (s) => s.stat[field] },
      { key: "ppg", label: "Pts / Game", get: (s) => perGame(s.stat[field], s.stat.games) },
      { key: "yds", label: "Total Yards", get: (s) => s.stat.rush_yds + s.stat.rec_yds + s.stat.pass_yds },
      { key: "td", label: "Total TD", get: (s) => s.stat.rush_td + s.stat.rec_td + s.stat.pass_td },
      { key: "vol", label: "Touches/Targets", get: (s) => s.stat.rush_att + s.stat.tgt },
    ];
    return metrics
      .map((m) => {
        const values = selected.map((s) => m.get(s));
        const max = Math.max(...values, 1);
        const row: Record<string, unknown> = { metric: m.label };
        selected.forEach((s) => {
          row[s.player.id] = Math.round((m.get(s) / max) * 100);
        });
        return row;
      });
  }, [selected, field]);

  function addPlayer(id: string) {
    if (selectedIds.length >= MAX_PLAYERS) return;
    setSelectedIds((ids) => [...ids, id]);
    setQuery("");
  }
  function removePlayer(id: string) {
    setSelectedIds((ids) => ids.filter((x) => x !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compare Players</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Add up to {MAX_PLAYERS} players to compare their {SEASON} season head to head.
        </p>
      </div>

      {!index || !seasonStats ? (
        <Loading />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            {selected.map((s, i) => (
              <div
                key={s.player.id}
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full border"
                style={{ borderColor: SERIES_ORDER[i % SERIES_ORDER.length] }}
              >
                <PlayerAvatar src={s.player.headshot} name={s.player.name} position={s.player.position} size={22} />
                <span className="text-sm font-medium">{s.player.name}</span>
                <button
                  onClick={() => removePlayer(s.player.id)}
                  className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-[var(--surface-3)] text-[var(--text-muted)]"
                  aria-label={`Remove ${s.player.name}`}
                >
                  ×
                </button>
              </div>
            ))}
            {selectedIds.length < MAX_PLAYERS && (
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Add a player…"
                  className="px-3 py-1.5 rounded-full border border-dashed border-[var(--border-strong)] bg-[var(--surface-1)] text-sm w-44 focus:outline-none focus:border-[var(--series-1)]"
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-64 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] shadow-lg overflow-hidden">
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addPlayer(p.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-3)] text-left"
                      >
                        <PlayerAvatar src={p.headshot} name={p.name} position={p.position} size={24} />
                        <span className="text-sm flex-1 truncate">{p.name}</span>
                        <PositionBadge position={p.position} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {selected.length === 0 ? (
            <div className="text-center py-16 text-sm text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-xl">
              Search for players above to start comparing.
            </div>
          ) : (
            <>
              <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5">
                <h2 className="font-semibold text-[15px] mb-1">Relative Performance ({SEASON})</h2>
                <p className="text-xs text-[var(--text-muted)] mb-2">Each axis scaled to the group's max — 100 = best in group.</p>
                <RadarCompareChart
                  data={radarData}
                  entities={selected.map((s) => ({ key: s.player.id, label: s.player.name }))}
                />
              </section>

              <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-[var(--text-muted)] text-xs uppercase tracking-wide border-b border-[var(--border)]">
                      <th className="py-3 pl-5 pr-2">Stat</th>
                      {selected.map((s) => (
                        <th key={s.player.id} className="py-3 px-2 text-right">
                          {s.player.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <CompareRow label="Team" values={selected.map((s) => s.stat.team)} />
                    <CompareRow label="Games" values={selected.map((s) => String(s.stat.games))} />
                    <CompareRow label="Rush Yds" values={selected.map((s) => fmt0(s.stat.rush_yds))} />
                    <CompareRow label="Rec / Rec Yds" values={selected.map((s) => `${s.stat.rec} / ${fmt0(s.stat.rec_yds)}`)} />
                    <CompareRow label="Pass Yds" values={selected.map((s) => fmt0(s.stat.pass_yds))} />
                    <CompareRow label="Total TD" values={selected.map((s) => String(s.stat.rush_td + s.stat.rec_td + s.stat.pass_td))} />
                    <CompareRow
                      label={`${scoringLabel(format)} Pts`}
                      values={selected.map((s) => fmt1(s.stat[field]))}
                      highlight
                    />
                    <CompareRow label="Pts / Game" values={selected.map((s) => fmt1(perGame(s.stat[field], s.stat.games)))} highlight />
                    <CompareRow label={`${SEASON} Position Rank`} values={selected.map((s) => `#${s.stat.pos_rank}`)} />
                  </tbody>
                </table>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

function CompareRow({ label, values, highlight }: { label: string; values: string[]; highlight?: boolean }) {
  return (
    <tr className="border-b border-[var(--border)] last:border-0">
      <td className="py-2 pl-5 pr-2 text-[var(--text-secondary)]">{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`py-2 px-2 text-right tabular ${highlight ? "font-semibold" : ""}`}>
          {v}
        </td>
      ))}
    </tr>
  );
}
