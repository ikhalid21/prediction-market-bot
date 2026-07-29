import { useEffect, useMemo, useState } from "react";
import { getPlayersIndex, getAllSeasonStats } from "../lib/data";
import type { PlayerIndexEntry, SeasonStatLine } from "../lib/types";
import { useScoring } from "../lib/ScoringContext";
import { fptsField, perGame, fmt1, fmt0, scoringLabel, ordinal, SERIES_ORDER } from "../lib/format";
import PlayerAvatar from "../components/PlayerAvatar";
import PositionBadge from "../components/PositionBadge";
import Loading from "../components/Loading";
import RadarCompareChart from "../components/RadarCompareChart";

const MAX_PLAYERS = 4;

interface Selected {
  player: PlayerIndexEntry;
  seasons: SeasonStatLine[];
}

interface Career {
  games: number;
  fpts: number;
  rushYds: number;
  recYds: number;
  passYds: number;
  rec: number;
  td: number;
  ppg: number;
  seasonsPlayed: number;
  bestSeason: SeasonStatLine;
}

function careerOf(seasons: SeasonStatLine[], field: "fpts" | "fpts_ppr" | "fpts_half"): Career {
  const games = seasons.reduce((a, s) => a + s.games, 0);
  const fpts = seasons.reduce((a, s) => a + s[field], 0);
  const bestSeason = seasons.reduce((best, s) => (s[field] > best[field] ? s : best), seasons[0]);
  return {
    games,
    fpts,
    rushYds: seasons.reduce((a, s) => a + s.rush_yds, 0),
    recYds: seasons.reduce((a, s) => a + s.rec_yds, 0),
    passYds: seasons.reduce((a, s) => a + s.pass_yds, 0),
    rec: seasons.reduce((a, s) => a + s.rec, 0),
    td: seasons.reduce((a, s) => a + s.rush_td + s.rec_td + s.pass_td, 0),
    ppg: perGame(fpts, games),
    seasonsPlayed: seasons.length,
    bestSeason,
  };
}

function seasonInsight(s: SeasonStatLine, seasons: SeasonStatLine[], field: "fpts" | "fpts_ppr" | "fpts_half", position: string): string {
  const idx = seasons.findIndex((x) => x.season === s.season);
  const ppg = perGame(s[field], s.games);
  const totalGames = seasons.reduce((a, x) => a + x.games, 0);
  const totalFpts = seasons.reduce((a, x) => a + x[field], 0);
  const careerPpg = perGame(totalFpts, totalGames);
  const isBest = s[field] === Math.max(...seasons.map((x) => x[field]));
  const isDebut = idx === 0 && seasons.length > 1;
  const parts: string[] = [];
  if (isDebut) parts.push("Debut season");
  if (isBest) parts.push("career-best fantasy output");
  else if (careerPpg > 0 && ppg >= careerPpg * 1.15) parts.push("well above career average");
  else if (careerPpg > 0 && ppg <= careerPpg * 0.7 && s.games >= 6) parts.push("down year vs. career average");
  if (s.games <= 10) parts.push(`limited to ${s.games} games`);
  if (s.pos_rank <= 12) parts.push(`finished ${position}${s.pos_rank} overall`);
  if (parts.length === 0) parts.push("in line with career norms");
  return parts.join(" — ");
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
        const seasons = seasonStats[id];
        return player && seasons?.length ? { player, seasons } : null;
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

  const careers = useMemo(() => selected.map((s) => ({ s, career: careerOf(s.seasons, field) })), [selected, field]);

  const radarData = useMemo(() => {
    if (careers.length === 0) return [];
    const metrics: { key: string; label: string; get: (c: Career) => number }[] = [
      { key: "fpts", label: "Career Pts", get: (c) => c.fpts },
      { key: "ppg", label: "Pts / Game", get: (c) => c.ppg },
      { key: "yds", label: "Career Yards", get: (c) => c.rushYds + c.recYds + c.passYds },
      { key: "td", label: "Career TD", get: (c) => c.td },
      { key: "seasons", label: "Seasons Played", get: (c) => c.seasonsPlayed },
    ];
    return metrics.map((m) => {
      const values = careers.map(({ career }) => m.get(career));
      const max = Math.max(...values, 1);
      const row: Record<string, unknown> = { metric: m.label };
      careers.forEach(({ s, career }) => {
        row[s.player.id] = Math.round((m.get(career) / max) * 100);
      });
      return row;
    });
  }, [careers]);

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
          Add up to {MAX_PLAYERS} players to compare their entire careers, season by season.
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
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {careers.map(({ s, career }, i) => (
                  <div key={s.player.id} className="card p-4 flex flex-col gap-2" style={{ borderColor: SERIES_ORDER[i % SERIES_ORDER.length] }}>
                    <div className="flex items-center gap-2">
                      <PlayerAvatar src={s.player.headshot} name={s.player.name} position={s.player.position} size={28} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{s.player.name}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {career.seasonsPlayed} season{career.seasonsPlayed > 1 ? "s" : ""} · {s.seasons[0].season}–{s.seasons[s.seasons.length - 1].season}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <MiniStat label={`Career ${scoringLabel(format)}`} value={fmt0(career.fpts)} />
                      <MiniStat label="Career Pts/G" value={fmt1(career.ppg)} />
                      <MiniStat label="Best Season" value={`${career.bestSeason.season} · ${fmt1(career.bestSeason[field])}`} span />
                    </div>
                  </div>
                ))}
              </section>

              <section className="card p-5">
                <h2 className="font-semibold text-[15px] mb-1">Career Profile</h2>
                <p className="text-xs text-[var(--text-muted)] mb-2">Each axis scaled to the group's max — 100 = best in group, across full careers.</p>
                <RadarCompareChart
                  data={radarData}
                  entities={selected.map((s) => ({ key: s.player.id, label: s.player.name }))}
                />
              </section>

              <section className="card overflow-x-auto scrollbar-thin">
                <div className="p-4 pb-0">
                  <h2 className="font-semibold text-[15px]">Career Totals</h2>
                </div>
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
                    <CompareRow label="Seasons" values={careers.map(({ career }) => String(career.seasonsPlayed))} />
                    <CompareRow label="Games" values={careers.map(({ career }) => String(career.games))} />
                    <CompareRow label="Rush Yds" values={careers.map(({ career }) => fmt0(career.rushYds))} />
                    <CompareRow label="Rec / Rec Yds" values={careers.map(({ career }) => `${career.rec} / ${fmt0(career.recYds)}`)} />
                    <CompareRow label="Pass Yds" values={careers.map(({ career }) => fmt0(career.passYds))} />
                    <CompareRow label="Total TD" values={careers.map(({ career }) => String(career.td))} />
                    <CompareRow label={`Career ${scoringLabel(format)} Pts`} values={careers.map(({ career }) => fmt0(career.fpts))} highlight />
                    <CompareRow label="Career Pts / Game" values={careers.map(({ career }) => fmt1(career.ppg))} highlight />
                    <CompareRow
                      label="Best Season"
                      values={careers.map(({ career }) => `${career.bestSeason.season} (${fmt1(career.bestSeason[field])} pts)`)}
                    />
                  </tbody>
                </table>
              </section>

              <section className="flex flex-col gap-4">
                <h2 className="font-semibold text-[15px]">Season by Season</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {selected.map((s, i) => (
                    <div key={s.player.id} className="card overflow-hidden">
                      <div
                        className="p-3 border-b border-[var(--border)] flex items-center gap-2"
                        style={{ borderTop: `3px solid ${SERIES_ORDER[i % SERIES_ORDER.length]}` }}
                      >
                        <PlayerAvatar src={s.player.headshot} name={s.player.name} position={s.player.position} size={22} />
                        <span className="font-semibold text-sm">{s.player.name}</span>
                        <PositionBadge position={s.player.position} />
                      </div>
                      <div className="max-h-[340px] overflow-y-auto scrollbar-thin">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-[var(--surface-1)]">
                            <tr className="text-left text-[var(--text-muted)] uppercase tracking-wide border-b border-[var(--border)]">
                              <th className="py-2 pl-4 pr-2">Yr</th>
                              <th className="py-2 px-2 text-right">GP</th>
                              <th className="py-2 px-2 text-right">{scoringLabel(format)}</th>
                              <th className="py-2 px-2 text-right">Rk</th>
                              <th className="py-2 px-2 pr-4">Insight</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...s.seasons].reverse().map((season) => (
                              <tr key={season.season} className="border-b border-[var(--border)] last:border-0">
                                <td className="py-1.5 pl-4 pr-2 font-medium tabular">{season.season}</td>
                                <td className="py-1.5 px-2 text-right tabular">{season.games}</td>
                                <td className="py-1.5 px-2 text-right tabular font-semibold">{fmt1(season[field])}</td>
                                <td className="py-1.5 px-2 text-right tabular">{ordinal(season.pos_rank)}</td>
                                <td className="py-1.5 px-2 pr-4 text-[var(--text-secondary)] leading-snug">
                                  {seasonInsight(season, s.seasons, field, s.player.position)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
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

function MiniStat({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{label}</div>
      <div className="text-sm font-semibold tabular truncate">{value}</div>
    </div>
  );
}
