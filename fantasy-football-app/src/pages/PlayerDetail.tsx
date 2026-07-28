import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPlayersIndex, getPlayerSeasonStats, getPlayerWeeklyStats } from "../lib/data";
import type { PlayerIndexEntry, SeasonStatLine, WeeklyStatLine } from "../lib/types";
import { useScoring } from "../lib/ScoringContext";
import { fptsField, perGame, fmt1, fmt0, scoringLabel, ordinal } from "../lib/format";
import PlayerAvatar from "../components/PlayerAvatar";
import PositionBadge from "../components/PositionBadge";
import Loading from "../components/Loading";
import TrendChart from "../components/TrendChart";

const WEEKLY_AVAILABLE_FROM = 2018;

export default function PlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const { format } = useScoring();
  const [player, setPlayer] = useState<PlayerIndexEntry | null | undefined>(undefined);
  const [seasons, setSeasons] = useState<SeasonStatLine[] | null>(null);
  const [weekly, setWeekly] = useState<WeeklyStatLine[] | null>(null);
  const [weeklySeason, setWeeklySeason] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    setPlayer(undefined);
    setSeasons(null);
    setWeekly(null);
    getPlayersIndex().then((idx) => setPlayer(idx.find((p) => p.id === id) ?? null));
    getPlayerSeasonStats(id).then((s) => setSeasons(s));
  }, [id]);

  const weeklySeasons = useMemo(
    () => (player ? player.seasons.filter((s) => s >= WEEKLY_AVAILABLE_FROM) : []),
    [player]
  );

  useEffect(() => {
    if (weeklySeasons.length && weeklySeason === null) {
      setWeeklySeason(weeklySeasons[weeklySeasons.length - 1]);
    }
  }, [weeklySeasons, weeklySeason]);

  useEffect(() => {
    if (!id || weeklySeason === null) return;
    getPlayerWeeklyStats(id, [weeklySeason]).then(setWeekly);
  }, [id, weeklySeason]);

  if (player === undefined || !seasons) return <Loading label="Loading player…" />;
  if (player === null) {
    return (
      <div className="text-center py-20 text-[var(--text-secondary)]">
        Player not found. <Link to="/players" className="text-[var(--series-1)] font-medium">Back to players</Link>
      </div>
    );
  }

  const field = fptsField(format);
  const latest = seasons[seasons.length - 1];
  const careerFpts = seasons.reduce((a, s) => a + s[field], 0);
  const careerGames = seasons.reduce((a, s) => a + s.games, 0);
  const bestSeason = seasons.reduce((best, s) => (s[field] > best[field] ? s : best), seasons[0]);
  const isPasser = player.position === "QB";

  const chartData = weekly?.map((w) => ({ week: `W${w.week}`, pts: w[field] })) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <PlayerAvatar src={player.headshot} name={player.name} position={player.position} size={64} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{player.name}</h1>
            <PositionBadge position={player.position} size="md" />
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {latest.team} · Active {player.seasons[0]}–{player.last_season} · {player.seasons.length} season
            {player.seasons.length > 1 ? "s" : ""} of data
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label={`Career ${scoringLabel(format)} Pts`} value={fmt0(careerFpts)} />
        <StatTile label="Career Games" value={String(careerGames)} />
        <StatTile label={`Best Season (${bestSeason.season})`} value={fmt1(bestSeason[field])} />
        <StatTile label={`${latest.season} Pos. Rank`} value={ordinal(latest.pos_rank)} />
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold text-[15px]">Weekly Trend — {scoringLabel(format)} Points</h2>
          {weeklySeasons.length > 0 && (
            <select
              value={weeklySeason ?? ""}
              onChange={(e) => setWeeklySeason(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] text-xs"
            >
              {weeklySeasons.map((s) => (
                <option key={s} value={s}>
                  {s} Season
                </option>
              ))}
            </select>
          )}
        </div>
        {weeklySeasons.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-8 text-center">
            Weekly game logs are available from {WEEKLY_AVAILABLE_FROM} onward; this player only has data before then.
          </p>
        ) : !weekly ? (
          <Loading />
        ) : (
          <TrendChart data={chartData} xKey="week" series={[{ key: "pts", label: `${scoringLabel(format)} pts`, color: "var(--series-1)" }]} />
        )}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] overflow-x-auto scrollbar-thin">
        <div className="p-5 pb-3">
          <h2 className="font-semibold text-[15px]">Season by Season</h2>
        </div>
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[var(--text-muted)] text-xs uppercase tracking-wide border-b border-[var(--border)]">
              <th className="py-2 pl-5 pr-2">Season</th>
              <th className="py-2 px-2">Team</th>
              <th className="py-2 px-2 text-right">GP</th>
              {isPasser ? (
                <>
                  <th className="py-2 px-2 text-right">Pass Yds</th>
                  <th className="py-2 px-2 text-right">Pass TD</th>
                  <th className="py-2 px-2 text-right">INT</th>
                  <th className="py-2 px-2 text-right">Rush Yds</th>
                </>
              ) : (
                <>
                  <th className="py-2 px-2 text-right">Rec</th>
                  <th className="py-2 px-2 text-right">Rec Yds</th>
                  <th className="py-2 px-2 text-right">Rush Yds</th>
                  <th className="py-2 px-2 text-right">Total TD</th>
                </>
              )}
              <th className="py-2 px-2 text-right">{scoringLabel(format)}</th>
              <th className="py-2 px-2 pr-5 text-right">Pts/G</th>
              <th className="py-2 px-2 pr-5 text-right">Pos Rank</th>
            </tr>
          </thead>
          <tbody>
            {[...seasons].reverse().map((s) => (
              <tr key={s.season} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-3)]">
                <td className="py-2 pl-5 pr-2 font-medium tabular">{s.season}</td>
                <td className="py-2 px-2">{s.team}</td>
                <td className="py-2 px-2 text-right tabular">{s.games}</td>
                {isPasser ? (
                  <>
                    <td className="py-2 px-2 text-right tabular">{fmt0(s.pass_yds)}</td>
                    <td className="py-2 px-2 text-right tabular">{s.pass_td}</td>
                    <td className="py-2 px-2 text-right tabular">{s.pass_int}</td>
                    <td className="py-2 px-2 text-right tabular">{fmt0(s.rush_yds)}</td>
                  </>
                ) : (
                  <>
                    <td className="py-2 px-2 text-right tabular">{s.rec}</td>
                    <td className="py-2 px-2 text-right tabular">{fmt0(s.rec_yds)}</td>
                    <td className="py-2 px-2 text-right tabular">{fmt0(s.rush_yds)}</td>
                    <td className="py-2 px-2 text-right tabular">{s.rush_td + s.rec_td}</td>
                  </>
                )}
                <td className="py-2 px-2 text-right tabular font-semibold">{fmt1(s[field])}</td>
                <td className="py-2 px-2 pr-5 text-right tabular">{fmt1(perGame(s[field], s.games))}</td>
                <td className="py-2 px-2 pr-5 text-right tabular">{ordinal(s.pos_rank)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-4">
      <div className="text-xs text-[var(--text-muted)] mb-1">{label}</div>
      <div className="text-xl font-bold tabular">{value}</div>
    </div>
  );
}
