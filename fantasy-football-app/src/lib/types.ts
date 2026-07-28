export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export interface PlayerIndexEntry {
  id: string;
  name: string;
  position: Position;
  team: string;
  headshot: string | null;
  seasons: number[];
  last_season: number;
  best_ppr: number;
}

export interface SeasonStatLine {
  season: number;
  team: string;
  games: number;
  pass_yds: number;
  pass_td: number;
  pass_int: number;
  rush_att: number;
  rush_yds: number;
  rush_td: number;
  rec: number;
  tgt: number;
  rec_yds: number;
  rec_td: number;
  fpts: number;
  fpts_ppr: number;
  fpts_half: number;
  pos_rank: number;
  ovr_rank: number;
}

export interface WeeklyStatLine {
  season?: number;
  week: number;
  opp: string;
  team: string;
  pass_yds: number;
  pass_td: number;
  pass_int: number;
  rush_att: number;
  rush_yds: number;
  rush_td: number;
  rec: number;
  tgt: number;
  rec_yds: number;
  rec_td: number;
  fpts: number;
  fpts_ppr: number;
  fpts_half: number;
}

export interface TeamInfo {
  abbr: string;
  name: string;
  conference: "AFC" | "NFC";
  division: string;
  color: string;
}

export interface DefenseStrengthEntry {
  avg_allowed: number;
  rank: number;
}

export type DefenseStrengthMap = Record<string, Partial<Record<"QB" | "RB" | "WR" | "TE", DefenseStrengthEntry>>>;

export interface ScheduleGameInfo {
  opp: string;
  home: boolean;
}

export interface Schedule2026 {
  weeks: number[];
  teams: Record<string, Record<string, ScheduleGameInfo>>;
  bye_weeks: Record<string, number | null>;
}

export interface SosEntry {
  avg_opp_pts_allowed: number;
  sos_rank: number;
}

export type SosMap = Record<string, Partial<Record<"QB" | "RB" | "WR" | "TE", SosEntry>>>;

export interface WeeklyMatchupEntry {
  week: number;
  opp: string;
  home: boolean;
  QB_rank: number | null;
  RB_rank: number | null;
  WR_rank: number | null;
  TE_rank: number | null;
}

export type WeeklyMatchupsMap = Record<string, Record<string, WeeklyMatchupEntry>>;

export interface DstSeasonStat {
  fpts: number;
  sacks: number;
  ints: number;
  fum_rec: number;
  def_td: number;
  safeties: number;
  pts_allowed_score: number;
  pos_rank: number;
}

export type DstByTeam = Record<string, Record<string, DstSeasonStat>>;

export interface DraftPoolPlayer {
  id: string;
  name: string;
  position: Position;
  team: string;
  last_season_fpts_ppr: number;
  last_season_fpts: number;
  pos_rank_last_season: number;
  games: number;
  headshot: string | null;
  bye_week: number | null;
  adp_rank: number;
}

export interface SeasonLeaderEntry {
  player_id?: string;
  team?: string;
  name?: string;
  position?: Position;
  fpts_ppr?: number;
  fpts?: number;
  games?: number;
  rush_yds?: number;
  rec_yds?: number;
  pass_yds?: number;
  rush_td?: number;
  rec_td?: number;
  pass_td?: number;
  rec?: number;
  sacks?: number;
  ints?: number;
  fum_rec?: number;
  def_td?: number;
  safeties?: number;
}

export interface SeasonLeaders {
  QB: SeasonLeaderEntry[];
  RB: SeasonLeaderEntry[];
  WR: SeasonLeaderEntry[];
  TE: SeasonLeaderEntry[];
  K: SeasonLeaderEntry[];
  DST: SeasonLeaderEntry[];
  OVERALL: SeasonLeaderEntry[];
}

export type ScoringFormat = "ppr" | "half" | "standard";
