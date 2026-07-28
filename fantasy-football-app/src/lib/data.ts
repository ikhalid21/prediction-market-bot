import type {
  PlayerIndexEntry,
  TeamInfo,
  DefenseStrengthMap,
  Schedule2026,
  SosMap,
  WeeklyMatchupsMap,
  DstByTeam,
  DraftPoolPlayer,
  SeasonLeaders,
  SeasonStatLine,
  WeeklyStatLine,
} from "./types";

const cache = new Map<string, Promise<unknown>>();

function load<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(`${import.meta.env.BASE_URL}data/${path}`).then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`);
        return r.json();
      })
    );
  }
  return cache.get(path) as Promise<T>;
}

export const getPlayersIndex = () => load<PlayerIndexEntry[]>("players_index.json");
export const getTeams = () => load<TeamInfo[]>("teams.json");
export const getDefenseStrength = () => load<DefenseStrengthMap>("defense_strength.json");
export const getSchedule2026 = () => load<Schedule2026>("schedule_2026.json");
export const getSos2026 = () => load<SosMap>("sos_2026.json");
export const getWeeklyMatchups2026 = () => load<WeeklyMatchupsMap>("weekly_matchups_2026.json");
export const getDstByTeam = () => load<DstByTeam>("dst_by_team.json");
export const getDraftPool = () => load<DraftPoolPlayer[]>("draft_pool.json");
export const getSeasonLeaders = () => load<Record<string, SeasonLeaders>>("season_leaders.json");

let seasonStatsPromise: Promise<Record<string, SeasonStatLine[]>> | null = null;
export function getAllSeasonStats() {
  if (!seasonStatsPromise) {
    seasonStatsPromise = load<Record<string, SeasonStatLine[]>>("season_stats_by_player.json");
  }
  return seasonStatsPromise;
}

export async function getPlayerSeasonStats(playerId: string): Promise<SeasonStatLine[]> {
  const all = await getAllSeasonStats();
  return all[playerId] ?? [];
}

const weeklySeasonCache = new Map<number, Promise<Record<string, WeeklyStatLine[]>>>();
export function getWeeklyForSeason(season: number) {
  if (!weeklySeasonCache.has(season)) {
    weeklySeasonCache.set(season, load<Record<string, WeeklyStatLine[]>>(`weekly/${season}.json`));
  }
  return weeklySeasonCache.get(season)!;
}

export async function getPlayerWeeklyStats(playerId: string, seasons: number[]): Promise<WeeklyStatLine[]> {
  const results = await Promise.all(seasons.map((s) => getWeeklyForSeason(s)));
  const out: WeeklyStatLine[] = [];
  results.forEach((byPlayer, i) => {
    const rows = byPlayer[playerId];
    if (rows) {
      rows.forEach((r) => out.push({ ...r, season: seasons[i] }));
    }
  });
  return out;
}

const TEAM_MAP_CACHE: { map?: Map<string, TeamInfo> } = {};
export async function getTeamMap() {
  if (!TEAM_MAP_CACHE.map) {
    const teams = await getTeams();
    TEAM_MAP_CACHE.map = new Map(teams.map((t) => [t.abbr, t]));
  }
  return TEAM_MAP_CACHE.map;
}
