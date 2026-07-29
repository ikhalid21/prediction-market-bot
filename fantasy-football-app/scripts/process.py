# Turns raw nflverse CSVs into the static JSON files served from public/data/.
#
# Before running, download the raw source files into this script's directory:
#   curl -sSL -o games.csv \
#     https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv
#   mkdir -p seasonal weekly
#   for y in $(seq 2010 2025); do
#     curl -sSL -o seasonal/stats_player_reg_$y.csv \
#       https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_$y.csv
#   done
#   for y in $(seq 2018 2025); do
#     curl -sSL -o weekly/stats_player_week_$y.csv \
#       https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_$y.csv
#   done
#
# Then: python3 process.py   (writes ./out/*.json — copy into public/data/)
import pandas as pd
import numpy as np
import json
import os

DATA = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(DATA, "out")
os.makedirs(OUT, exist_ok=True)

SEASONS = list(range(2010, 2026))
WEEKLY_SEASONS = list(range(2018, 2026))
LATEST_SEASON = 2025
UPCOMING_SEASON = 2026

FANTASY_POS = ["QB", "RB", "WR", "TE", "K"]

TEAM_INFO = {
    "ARI": ("Arizona Cardinals", "NFC", "West", "#97233F"),
    "ATL": ("Atlanta Falcons", "NFC", "South", "#A71930"),
    "BAL": ("Baltimore Ravens", "AFC", "North", "#241773"),
    "BUF": ("Buffalo Bills", "AFC", "East", "#00338D"),
    "CAR": ("Carolina Panthers", "NFC", "South", "#0085CA"),
    "CHI": ("Chicago Bears", "NFC", "North", "#0B162A"),
    "CIN": ("Cincinnati Bengals", "AFC", "North", "#FB4F14"),
    "CLE": ("Cleveland Browns", "AFC", "North", "#311D00"),
    "DAL": ("Dallas Cowboys", "NFC", "East", "#003594"),
    "DEN": ("Denver Broncos", "AFC", "West", "#FB4F14"),
    "DET": ("Detroit Lions", "NFC", "North", "#0076B6"),
    "GB":  ("Green Bay Packers", "NFC", "North", "#203731"),
    "HOU": ("Houston Texans", "AFC", "South", "#03202F"),
    "IND": ("Indianapolis Colts", "AFC", "South", "#002C5F"),
    "JAX": ("Jacksonville Jaguars", "AFC", "South", "#101820"),
    "KC":  ("Kansas City Chiefs", "AFC", "West", "#E31837"),
    "LA":  ("Los Angeles Rams", "NFC", "West", "#003594"),
    "LAC": ("Los Angeles Chargers", "AFC", "West", "#0080C6"),
    "LV":  ("Las Vegas Raiders", "AFC", "West", "#000000"),
    "MIA": ("Miami Dolphins", "AFC", "East", "#008E97"),
    "MIN": ("Minnesota Vikings", "NFC", "North", "#4F2683"),
    "NE":  ("New England Patriots", "AFC", "East", "#002244"),
    "NO":  ("New Orleans Saints", "NFC", "South", "#D3BC8D"),
    "NYG": ("New York Giants", "NFC", "East", "#0B2265"),
    "NYJ": ("New York Jets", "AFC", "East", "#125740"),
    "PHI": ("Philadelphia Eagles", "NFC", "East", "#004C54"),
    "PIT": ("Pittsburgh Steelers", "AFC", "North", "#FFB612"),
    "SF":  ("San Francisco 49ers", "NFC", "West", "#AA0000"),
    "SEA": ("Seattle Seahawks", "NFC", "West", "#002244"),
    "TB":  ("Tampa Bay Buccaneers", "NFC", "South", "#D50A0A"),
    "TEN": ("Tennessee Titans", "AFC", "South", "#0C2340"),
    "WAS": ("Washington Commanders", "NFC", "East", "#5A1414"),
}
ALIAS = {"LAR": "LA", "WSH": "WAS", "OAK": "LV", "SD": "LAC", "STL": "LA"}


def norm_team(t):
    if pd.isna(t):
        return t
    return ALIAS.get(t, t)


def r2(x):
    if pd.isna(x):
        return 0.0
    return round(float(x), 2)


print("Loading games/schedules...")
games = pd.read_csv(os.path.join(DATA, "games.csv"), low_memory=False)
games["home_team"] = games["home_team"].map(norm_team)
games["away_team"] = games["away_team"].map(norm_team)

print("Loading seasonal stats 2010-2025...")
season_frames = []
for y in SEASONS:
    df = pd.read_csv(os.path.join(DATA, "seasonal", f"stats_player_reg_{y}.csv"), low_memory=False)
    df["season"] = y
    season_frames.append(df)
season_all = pd.concat(season_frames, ignore_index=True, sort=False)
season_all["recent_team"] = season_all["recent_team"].map(norm_team)


def kicker_points(row):
    made_short = (row.get("fg_made_0_19", 0) or 0) + (row.get("fg_made_20_29", 0) or 0) + (row.get("fg_made_30_39", 0) or 0)
    made_mid = row.get("fg_made_40_49", 0) or 0
    made_long = (row.get("fg_made_50_59", 0) or 0) + (row.get("fg_made_60_", 0) or 0)
    pts = made_short * 3 + made_mid * 4 + made_long * 5 + (row.get("pat_made", 0) or 0) * 1
    missed = (row.get("fg_missed", 0) or 0) + (row.get("fg_blocked", 0) or 0)
    pts -= missed * 1
    return round(pts, 2)


is_k = season_all["position"] == "K"
season_all.loc[is_k, "fantasy_points"] = season_all.loc[is_k].apply(kicker_points, axis=1)
season_all.loc[is_k, "fantasy_points_ppr"] = season_all.loc[is_k, "fantasy_points"]

fp = season_all["fantasy_points"].fillna(0)
fppr = season_all["fantasy_points_ppr"].fillna(0)
season_all["fantasy_points_half"] = np.where(is_k, fp, (fp + fppr) / 2.0)

# ---------------- Fantasy-relevant filter ----------------
rel = season_all[season_all["position"].isin(FANTASY_POS)].copy()
rel = rel[(rel["fantasy_points_ppr"].fillna(0) > 10) | (rel["position"] == "K")]
rel = rel[rel["games"].fillna(0) > 0]

KEEP_COLS = [
    "player_id", "player_name", "player_display_name", "position", "recent_team", "season", "games",
    "completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions",
    "carries", "rushing_yards", "rushing_tds",
    "receptions", "targets", "receiving_yards", "receiving_tds",
    "fantasy_points", "fantasy_points_ppr", "fantasy_points_half",
]
rel_small = rel[[c for c in KEEP_COLS if c in rel.columns]].copy()
for c in rel_small.columns:
    if rel_small[c].dtype.kind in "fc":
        rel_small[c] = rel_small[c].fillna(0)

# position rank within season (by ppr, or fantasy_points for K)
rel_small["rank_metric"] = np.where(rel_small["position"] == "K", rel_small["fantasy_points"], rel_small["fantasy_points_ppr"])
rel_small["pos_rank"] = rel_small.groupby(["season", "position"])["rank_metric"].rank(ascending=False, method="first").astype(int)
rel_small["overall_rank"] = rel_small.groupby("season")["fantasy_points_ppr"].rank(ascending=False, method="first").astype(int)

season_stats_records = []
for row in rel_small.itertuples(index=False):
    d = row._asdict()
    season_stats_records.append({
        "player_id": d["player_id"],
        "season": int(d["season"]),
        "team": d["recent_team"],
        "games": int(d["games"]),
        "pass_yds": r2(d.get("passing_yards", 0)), "pass_td": int(d.get("passing_tds", 0) or 0), "pass_int": int(d.get("passing_interceptions", 0) or 0),
        "rush_att": int(d.get("carries", 0) or 0), "rush_yds": r2(d.get("rushing_yards", 0)), "rush_td": int(d.get("rushing_tds", 0) or 0),
        "rec": int(d.get("receptions", 0) or 0), "tgt": int(d.get("targets", 0) or 0), "rec_yds": r2(d.get("receiving_yards", 0)), "rec_td": int(d.get("receiving_tds", 0) or 0),
        "fpts": r2(d.get("fantasy_points", 0)), "fpts_ppr": r2(d.get("fantasy_points_ppr", 0)), "fpts_half": r2(d.get("fantasy_points_half", 0)),
        "pos_rank": int(d["pos_rank"]), "ovr_rank": int(d["overall_rank"]),
    })

print("season_stats rows:", len(season_stats_records))

# ---------------- Player index (name/position/team/headshot) ----------------
headshots = season_all.dropna(subset=["headshot_url"]).sort_values("season")
headshot_map = headshots.groupby("player_id")["headshot_url"].last().to_dict()

player_seasons = {}
for r in season_stats_records:
    player_seasons.setdefault(r["player_id"], []).append(r["season"])

latest_info = rel_small.sort_values("season").groupby("player_id").last()

players_index = []
for pid, seasons_list in player_seasons.items():
    row = latest_info.loc[pid]
    players_index.append({
        "id": pid,
        "name": row["player_display_name"] if isinstance(row["player_display_name"], str) else row["player_name"],
        "position": row["position"],
        "team": row["recent_team"],
        "headshot": headshot_map.get(pid, None),
        "seasons": sorted(seasons_list),
        "last_season": max(seasons_list),
        "best_ppr": r2(max(r["fpts_ppr"] for r in season_stats_records if r["player_id"] == pid)),
    })

print("players_index count:", len(players_index))

with open(os.path.join(OUT, "players_index.json"), "w") as f:
    json.dump(players_index, f, separators=(",", ":"))

season_by_player = {}
for r in season_stats_records:
    season_by_player.setdefault(r["player_id"], []).append({k: v for k, v in r.items() if k != "player_id"})
for pid in season_by_player:
    season_by_player[pid].sort(key=lambda x: x["season"])

with open(os.path.join(OUT, "season_stats_by_player.json"), "w") as f:
    json.dump(season_by_player, f, separators=(",", ":"))

print("Wrote players_index.json and season_stats_by_player.json")

# ---------------- Teams.json ----------------
teams_out = []
for abbr, (name, conf, div, color) in TEAM_INFO.items():
    teams_out.append({"abbr": abbr, "name": name, "conference": conf, "division": div, "color": color})
with open(os.path.join(OUT, "teams.json"), "w") as f:
    json.dump(teams_out, f, separators=(",", ":"))
print("Wrote teams.json")

# ---------------- Weekly stats (2018-2025) for trend charts ----------------
print("Loading weekly stats 2018-2025...")
weekly_frames = []
for y in WEEKLY_SEASONS:
    df = pd.read_csv(os.path.join(DATA, "weekly", f"stats_player_week_{y}.csv"), low_memory=False)
    df = df[df["season_type"] == "REG"]
    weekly_frames.append(df)
weekly_all = pd.concat(weekly_frames, ignore_index=True, sort=False)
weekly_all["team"] = weekly_all["team"].map(norm_team)
weekly_all["opponent_team"] = weekly_all["opponent_team"].map(norm_team)

is_k_w = weekly_all["position"] == "K"
weekly_all.loc[is_k_w, "fantasy_points"] = weekly_all.loc[is_k_w].apply(kicker_points, axis=1)
weekly_all.loc[is_k_w, "fantasy_points_ppr"] = weekly_all.loc[is_k_w, "fantasy_points"]
wfp = weekly_all["fantasy_points"].fillna(0)
wfppr = weekly_all["fantasy_points_ppr"].fillna(0)
weekly_all["fantasy_points_half"] = np.where(is_k_w, wfp, (wfp + wfppr) / 2.0)

relevant_ids = set(rel_small["player_id"].unique())
weekly_rel = weekly_all[weekly_all["player_id"].isin(relevant_ids) & weekly_all["position"].isin(FANTASY_POS)].copy()

WEEKLY_KEEP = [
    "player_id", "season", "week", "team", "opponent_team",
    "completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions",
    "carries", "rushing_yards", "rushing_tds",
    "receptions", "targets", "receiving_yards", "receiving_tds",
    "fantasy_points", "fantasy_points_ppr", "fantasy_points_half",
]
weekly_small = weekly_rel[[c for c in WEEKLY_KEEP if c in weekly_rel.columns]].copy()
for c in weekly_small.columns:
    if weekly_small[c].dtype.kind in "fc":
        weekly_small[c] = weekly_small[c].fillna(0)

weekly_by_season = {}
for row in weekly_small.itertuples(index=False):
    d = row._asdict()
    pid = d["player_id"]
    yr = int(d["season"])
    entry = {
        "week": int(d["week"]), "opp": d["opponent_team"], "team": d["team"],
        "pass_yds": r2(d.get("passing_yards", 0)), "pass_td": int(d.get("passing_tds", 0) or 0), "pass_int": int(d.get("passing_interceptions", 0) or 0),
        "rush_att": int(d.get("carries", 0) or 0), "rush_yds": r2(d.get("rushing_yards", 0)), "rush_td": int(d.get("rushing_tds", 0) or 0),
        "rec": int(d.get("receptions", 0) or 0), "tgt": int(d.get("targets", 0) or 0), "rec_yds": r2(d.get("receiving_yards", 0)), "rec_td": int(d.get("receiving_tds", 0) or 0),
        "fpts": r2(d.get("fantasy_points", 0)), "fpts_ppr": r2(d.get("fantasy_points_ppr", 0)), "fpts_half": r2(d.get("fantasy_points_half", 0)),
    }
    weekly_by_season.setdefault(yr, {}).setdefault(pid, []).append(entry)

os.makedirs(os.path.join(OUT, "weekly"), exist_ok=True)
for yr, players_dict in weekly_by_season.items():
    for pid in players_dict:
        players_dict[pid].sort(key=lambda x: x["week"])
    with open(os.path.join(OUT, "weekly", f"{yr}.json"), "w") as f:
        json.dump(players_dict, f, separators=(",", ":"))
print("Wrote per-season weekly files for:", sorted(weekly_by_season.keys()))

# ---------------- Defense strength: avg fantasy pts allowed by position, per team (2025) ----------------
latest_weekly = weekly_all[(weekly_all["season"] == LATEST_SEASON) & (weekly_all["position"].isin(["QB", "RB", "WR", "TE"]))]
def_strength = latest_weekly.groupby(["opponent_team", "position"]).agg(
    total_ppr=("fantasy_points_ppr", "sum"),
    games=("week", "nunique"),
).reset_index()
# games played by that team in the season (weeks with a recorded matchup)
team_games = games[(games.season == LATEST_SEASON) & (games.game_type == "REG")]
team_week_count = {}
for _, g in team_games.iterrows():
    team_week_count[g.home_team] = team_week_count.get(g.home_team, 0) + 1
    team_week_count[g.away_team] = team_week_count.get(g.away_team, 0) + 1

def_strength_map = {}
for row in def_strength.itertuples(index=False):
    team = row.opponent_team
    pos = row.position
    gp = team_week_count.get(team, row.games)
    avg = row.total_ppr / gp if gp else 0
    def_strength_map.setdefault(team, {})[pos] = r2(avg)

# rank 1 = allows the MOST points (easiest matchup / worst defense) ... rank 32 = allows fewest (toughest)
def_strength_ranked = {}
for pos in ["QB", "RB", "WR", "TE"]:
    vals = [(t, def_strength_map.get(t, {}).get(pos, 0)) for t in TEAM_INFO.keys()]
    vals.sort(key=lambda x: -x[1])
    for i, (t, v) in enumerate(vals, start=1):
        def_strength_ranked.setdefault(t, {})[pos] = {"avg_allowed": v, "rank": i}

with open(os.path.join(OUT, "defense_strength.json"), "w") as f:
    json.dump(def_strength_ranked, f, separators=(",", ":"))
print("Wrote defense_strength.json")

# ---------------- 2026 schedule + bye weeks ----------------
sched_2026 = games[(games.season == UPCOMING_SEASON) & (games.game_type == "REG")].copy()
team_schedule = {t: {} for t in TEAM_INFO.keys()}
for _, g in sched_2026.iterrows():
    wk = int(g.week)
    if g.home_team in team_schedule:
        team_schedule[g.home_team][wk] = {"opp": g.away_team, "home": True}
    if g.away_team in team_schedule:
        team_schedule[g.away_team][wk] = {"opp": g.home_team, "home": False}

all_weeks = sorted(sched_2026["week"].unique().tolist())
bye_weeks = {}
for t in TEAM_INFO.keys():
    played = set(team_schedule[t].keys())
    byes = [w for w in all_weeks if w not in played]
    bye_weeks[t] = byes[0] if byes else None

with open(os.path.join(OUT, "schedule_2026.json"), "w") as f:
    json.dump({"weeks": all_weeks, "teams": team_schedule, "bye_weeks": bye_weeks}, f, separators=(",", ":"))
print("Wrote schedule_2026.json")

# ---------------- Rest-of-season style SOS per team per position (based on 2026 schedule + 2025 def strength) ----------------
sos = {}
for t in TEAM_INFO.keys():
    sos[t] = {}
    for pos in ["QB", "RB", "WR", "TE"]:
        opp_ranks = []
        for wk, info in team_schedule[t].items():
            opp = info["opp"]
            r = def_strength_ranked.get(opp, {}).get(pos, {}).get("avg_allowed")
            if r is not None:
                opp_ranks.append(r)
        avg = sum(opp_ranks) / len(opp_ranks) if opp_ranks else 0
        sos[t][pos] = {"avg_opp_pts_allowed": r2(avg)}

for pos in ["QB", "RB", "WR", "TE"]:
    vals = sorted(TEAM_INFO.keys(), key=lambda tt: -sos[tt][pos]["avg_opp_pts_allowed"])
    for i, tt in enumerate(vals, start=1):
        sos[tt][pos]["sos_rank"] = i

with open(os.path.join(OUT, "sos_2026.json"), "w") as f:
    json.dump(sos, f, separators=(",", ":"))
print("Wrote sos_2026.json")

# ---------------- Weekly matchup difficulty (per team per week per position rank) ----------------
weekly_matchups = {}
for t in TEAM_INFO.keys():
    weekly_matchups[t] = {}
    for wk, info in team_schedule[t].items():
        opp = info["opp"]
        entry = {"week": wk, "opp": opp, "home": info["home"]}
        for pos in ["QB", "RB", "WR", "TE"]:
            dr = def_strength_ranked.get(opp, {}).get(pos)
            entry[f"{pos}_rank"] = dr["rank"] if dr else None
        weekly_matchups[t][wk] = entry

with open(os.path.join(OUT, "weekly_matchups_2026.json"), "w") as f:
    json.dump(weekly_matchups, f, separators=(",", ":"))
print("Wrote weekly_matchups_2026.json")

print("PART 2 DONE")

# ---------------- DST (team defense) fantasy scoring, all seasons ----------------
def points_allowed_score(pa):
    if pa == 0:
        return 10
    if pa <= 6:
        return 7
    if pa <= 13:
        return 4
    if pa <= 20:
        return 1
    if pa <= 27:
        return 0
    if pa <= 34:
        return -1
    return -4


DEF_POS = ["LB", "CB", "DE", "DT", "SAF", "S", "FS", "SS", "ILB", "OLB", "MLB", "DB", "NT", "DL", "OL"]

dst_by_team_season = {}
for y in SEASONS:
    reg = games[(games.season == y) & (games.game_type == "REG")]
    pa_score = {}
    for _, g in reg.iterrows():
        if pd.isna(g.home_score):
            continue
        pa_score[g.home_team] = pa_score.get(g.home_team, 0) + points_allowed_score(g.away_score)
        pa_score[g.away_team] = pa_score.get(g.away_team, 0) + points_allowed_score(g.home_score)

    yr_def = season_all[(season_all.season == y) & (season_all.position.isin(DEF_POS))]
    grouped = yr_def.groupby("recent_team").agg(
        sacks=("def_sacks", "sum"), ints=("def_interceptions", "sum"),
        fum=("fumble_recovery_opp", "sum"), tds=("def_tds", "sum"),
        st_tds=("special_teams_tds", "sum"), safeties=("def_safeties", "sum"),
    )
    for team in TEAM_INFO.keys():
        pa = pa_score.get(team, 0)
        row = grouped.loc[team] if team in grouped.index else None
        sacks = float(row["sacks"]) if row is not None else 0
        ints = float(row["ints"]) if row is not None else 0
        fum = float(row["fum"]) if row is not None else 0
        tds = float((row["tds"] if row is not None else 0) + (row["st_tds"] if row is not None else 0))
        safeties = float(row["safeties"]) if row is not None else 0
        total = pa + sacks * 1 + ints * 2 + fum * 2 + tds * 6 + safeties * 2
        dst_by_team_season.setdefault(team, {})[y] = {
            "fpts": r2(total), "sacks": r2(sacks), "ints": int(ints), "fum_rec": int(fum),
            "def_td": int(tds), "safeties": int(safeties), "pts_allowed_score": pa,
        }

# position rank per season for DST
for y in SEASONS:
    vals = sorted(TEAM_INFO.keys(), key=lambda t: -dst_by_team_season[t][y]["fpts"])
    for i, t in enumerate(vals, start=1):
        dst_by_team_season[t][y]["pos_rank"] = i

with open(os.path.join(OUT, "dst_by_team.json"), "w") as f:
    json.dump(dst_by_team_season, f, separators=(",", ":"))
print("Wrote dst_by_team.json")

# ---------------- Draft pool / rankings (our own 2026 projections, Half-PPR) ----------------
# NOT last season's raw totals, and NOT a copy of any licensed rankings or
# projections feed (CBS, ESPN, Yahoo, FantasyPros, etc — those are each
# site's proprietary compiled product; scraping and republishing them here
# would violate their terms). Instead we build our own forward-looking
# projection from real historical data:
#
#   1. Per-game half-PPR rate, weighted across a player's last up to 3
#      seasons (55/30/15), so one outlier year doesn't dominate.
#   2. An empirical, position-specific aging curve: for every pair of
#      consecutive seasons in our real 2010-2025 data, measure the
#      year-over-year change in per-game rate, bucketed by position and
#      "which season of their career" the earlier year was. The median per
#      bucket is a real, data-derived aging multiplier (RBs decay fast after
#      year 3-4, QBs barely decay at all) — this reproduces well-known
#      positional aging patterns without copying anyone's projections.
#      Multipliers are shrunk 70% toward 1.0 so small-sample buckets can't
#      swing a single player wildly.
#   3. Projected games = weighted average games played, capped at 17.
#   4. QB/RB/WR/TE are then ranked by Value-Based Drafting (VBD) — points
#      above a per-position replacement baseline — not raw projected points.
#      Otherwise QBs (highest, flattest-scoring position) would still
#      dominate round 1. Baseline ranks were tuned against current ADP
#      patterns (FantasyPros/RotoWire/Underdog) so round 1 comes out
#      RB/WR/elite-TE only, first QB in the back half of round 2.
#
# Kickers and DST use the same recency-weighted average with no aging curve
# (not a meaningful concept for a team stat, and the K sample's too thin to
# fit one reliably), appended after the skill pool like real cheat sheets.
RECENT_WEIGHTS = [0.55, 0.30, 0.15]
GROWTH_SHRINK = 0.3
MAX_EXP_BUCKET = 10
MIN_GAMES_FOR_GROWTH_SAMPLE = 6
VBD_BASELINE_RANK = {"QB": 8, "RB": 27, "WR": 32, "TE": 15}

idx_by_id = {p["id"]: p for p in players_index}
records_by_id = {}
for r in season_stats_records:
    records_by_id.setdefault(r["player_id"], []).append(r)


def median(xs):
    xs = sorted(xs)
    n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


growth_samples = {}
for pid, rows in records_by_id.items():
    p = idx_by_id.get(pid)
    if not p or p["position"] not in ("QB", "RB", "WR", "TE"):
        continue
    rows_sorted = sorted(rows, key=lambda r: r["season"])
    for i in range(len(rows_sorted) - 1):
        s1, s2 = rows_sorted[i], rows_sorted[i + 1]
        if s2["season"] != s1["season"] + 1:
            continue
        if s1["games"] < MIN_GAMES_FOR_GROWTH_SAMPLE or s2["games"] < MIN_GAMES_FOR_GROWTH_SAMPLE:
            continue
        rate1 = s1["fpts_half"] / s1["games"]
        if rate1 <= 0:
            continue
        key = (p["position"], min(i + 1, MAX_EXP_BUCKET))
        growth_samples.setdefault(key, []).append((s2["fpts_half"] / s2["games"]) / rate1)

growth_table = {key: 1 + (median(vals) - 1) * GROWTH_SHRINK for key, vals in growth_samples.items()}


def project_player(rows, position):
    recent = sorted(rows, key=lambda r: -r["season"])[:3]
    recent = [r for r in recent if r["games"] > 0]
    if not recent:
        return None
    w = RECENT_WEIGHTS[: len(recent)]
    wsum = sum(w)
    w = [x / wsum for x in w]
    weighted_rate = sum((r["fpts_half"] / r["games"]) * wi for r, wi in zip(recent, w))
    weighted_games = sum(r["games"] * wi for r, wi in zip(recent, w))
    proj_games = min(17, round(weighted_games))
    mult = growth_table.get((position, min(len(rows), MAX_EXP_BUCKET)), 1.0) if position in VBD_BASELINE_RANK else 1.0
    return weighted_rate * mult * proj_games, proj_games


skill_pool, kicker_pool, dst_pool = [], [], []
for pid, rows in records_by_id.items():
    p = idx_by_id.get(pid)
    if not p or p["last_season"] != LATEST_SEASON:
        continue
    latest_row = next((r for r in rows if r["season"] == LATEST_SEASON), None)
    if not latest_row:
        continue
    result = project_player(rows, p["position"])
    if not result:
        continue
    proj_fpts, proj_games = result
    entry = {
        "id": pid, "name": p["name"], "position": p["position"], "team": latest_row["team"],
        "proj_fpts_half": round(proj_fpts, 2), "proj_games": proj_games,
        "last_season_fpts_half": latest_row["fpts_half"], "games": latest_row["games"],
        "headshot": p["headshot"],
        "bye_week": bye_weeks.get(latest_row["team"]),
    }
    (kicker_pool if p["position"] == "K" else skill_pool).append(entry)

for team, seasons in dst_by_team_season.items():
    recent = [seasons[y] for y in range(LATEST_SEASON, LATEST_SEASON - 3, -1) if y in seasons]
    if not recent:
        continue
    w = RECENT_WEIGHTS[: len(recent)]
    wsum = sum(w)
    w = [x / wsum for x in w]
    proj_fpts = sum(r["fpts"] * wi for r, wi in zip(recent, w))
    latest = recent[0]
    name, conf, div, color = TEAM_INFO[team]
    dst_pool.append({
        "id": f"DST_{team}", "name": f"{name} D/ST", "position": "DST", "team": team,
        "proj_fpts_half": round(proj_fpts, 2), "proj_games": 17,
        "last_season_fpts_half": latest["fpts"], "games": 17, "headshot": None,
        "bye_week": bye_weeks.get(team),
    })

skill_by_pos = {}
for p in skill_pool:
    skill_by_pos.setdefault(p["position"], []).append(p)
for pos, rows in skill_by_pos.items():
    rows.sort(key=lambda x: -x["proj_fpts_half"])

baseline_pts = {
    pos: rows[min(VBD_BASELINE_RANK[pos], len(rows)) - 1]["proj_fpts_half"]
    for pos, rows in skill_by_pos.items() if pos in VBD_BASELINE_RANK
}
for p in skill_pool:
    p["vbd_value"] = p["proj_fpts_half"] - baseline_pts.get(p["position"], 0)

skill_pool.sort(key=lambda x: -x["vbd_value"])
kicker_pool.sort(key=lambda x: -x["proj_fpts_half"])
dst_pool.sort(key=lambda x: -x["proj_fpts_half"])

SKILL_CAP, K_CAP, DST_CAP = 244, 24, 32
draft_pool = skill_pool[:SKILL_CAP] + kicker_pool[:K_CAP] + dst_pool[:DST_CAP]
for p in draft_pool:
    p.pop("vbd_value", None)

# pos_rank_last_season uses actual last-season points, not the projection —
# "best RB by production last year" is a different question from "best pick".
by_pos = {}
for p in draft_pool:
    by_pos.setdefault(p["position"], []).append(p)
for pos, rows in by_pos.items():
    rows.sort(key=lambda x: -x["last_season_fpts_half"])
    for i, r in enumerate(rows, start=1):
        r["pos_rank_last_season"] = i

for i, p in enumerate(draft_pool, start=1):
    p["adp_rank"] = i

with open(os.path.join(OUT, "draft_pool.json"), "w") as f:
    json.dump(draft_pool, f, separators=(",", ":"))
print("Wrote draft_pool.json, size:", len(draft_pool))

# ---------------- Historical season leaders (top N per position per season) ----------------
leaders = {}
for y in SEASONS:
    yr_rows = [r for r in season_stats_records if r["season"] == y]
    leaders[y] = {}
    for pos in ["QB", "RB", "WR", "TE", "K"]:
        pos_rows = sorted([r for r in yr_rows if idx_by_id.get(r["player_id"], {}).get("position") == pos],
                           key=lambda r: -(r["fpts"] if pos == "K" else r["fpts_ppr"]))[:15]
        leaders[y][pos] = [{
            "player_id": r["player_id"], "name": idx_by_id[r["player_id"]]["name"],
            "team": r["team"], "fpts_ppr": r["fpts_ppr"], "fpts": r["fpts"], "games": r["games"],
            "rush_yds": r["rush_yds"], "rec_yds": r["rec_yds"], "pass_yds": r["pass_yds"],
            "rush_td": r["rush_td"], "rec_td": r["rec_td"], "pass_td": r["pass_td"], "rec": r["rec"],
        } for r in pos_rows]
    dst_rows = sorted([(t, s[y]) for t, s in dst_by_team_season.items()], key=lambda x: -x[1]["fpts"])[:10]
    leaders[y]["DST"] = [{"team": t, **stats} for t, stats in dst_rows]
    overall = sorted(yr_rows, key=lambda r: -r["fpts_ppr"])[:10]
    leaders[y]["OVERALL"] = [{
        "player_id": r["player_id"], "name": idx_by_id[r["player_id"]]["name"],
        "position": idx_by_id[r["player_id"]]["position"], "team": r["team"], "fpts_ppr": r["fpts_ppr"],
    } for r in overall]

with open(os.path.join(OUT, "season_leaders.json"), "w") as f:
    json.dump(leaders, f, separators=(",", ":"))
print("Wrote season_leaders.json")

print("ALL DONE")
