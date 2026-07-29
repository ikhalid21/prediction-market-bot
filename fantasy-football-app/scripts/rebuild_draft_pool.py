# Rebuilds public/data/draft_pool.json from the already-generated static JSON
# (season_stats_by_player.json, players_index.json, dst_by_team.json,
# schedule_2026.json).
#
# Rankings are our OWN 2026 half-PPR projections, not last season's raw
# totals and not a copy of any licensed rankings/projections feed (CBS,
# ESPN, Yahoo, FantasyPros, etc — those are each site's proprietary
# compiled product; scraping and republishing them here would violate their
# terms). The model:
#
#   1. Per-game half-PPR rate, weighted across a player's last up to 3
#      seasons (55/30/15), so one outlier year doesn't dominate.
#   2. An empirical, position-specific aging curve: for every pair of
#      consecutive seasons in our real 2010-2025 data, we measure the
#      year-over-year change in per-game rate and bucket it by position and
#      "which season of their career" the earlier year was. The median
#      per bucket is a real, data-derived aging multiplier (e.g. RBs decay
#      fast after year 3-4, QBs barely decay at all) — this reproduces the
#      well-known positional aging patterns without copying anyone's
#      proprietary projections. Multipliers are shrunk 70% toward 1.0 to
#      avoid small-sample buckets producing wild single-player swings.
#   3. Projected games = weighted average games played over the same
#      seasons, capped at 17.
#   4. QB/RB/WR/TE are then ranked by Value-Based Drafting (points above a
#      per-position replacement baseline) rather than raw projected points,
#      same as before — otherwise QBs (highest, flattest-scoring position)
#      would still dominate round 1. Baseline ranks were tuned against
#      current ADP data (FantasyPros/RotoWire/Underdog) so round 1 comes out
#      RB/WR/elite-TE only, with the first QB in the back half of round 2.
#
# Kickers and team defenses use the same recency-weighted average (no aging
# curve — not a meaningful concept for a team stat, and the K sample is too
# thin to fit one reliably) and are appended after the skill-position pool,
# same as real cheat sheets rank them.
#
# Rookies with zero prior NFL seasons aren't in this data at all (nflverse
# only has stats for players who've actually played), so incoming 2026
# rookies won't appear in the pool — a pre-existing limitation, not new.
import json
import os
from collections import defaultdict

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")
LATEST_SEASON = 2025
RECENT_WEIGHTS = [0.55, 0.30, 0.15]
GROWTH_SHRINK = 0.3  # how much of the empirical median growth swing to actually apply (0=none, 1=full)
MAX_EXP_BUCKET = 10
MIN_GAMES_FOR_GROWTH_SAMPLE = 6
VBD_BASELINE_RANK = {"QB": 8, "RB": 27, "WR": 32, "TE": 15}

TEAM_NAMES = {t["abbr"]: t["name"] for t in json.load(open(os.path.join(DATA, "teams.json")))}
players_index = {p["id"]: p for p in json.load(open(os.path.join(DATA, "players_index.json")))}
season_stats = json.load(open(os.path.join(DATA, "season_stats_by_player.json")))
dst_by_team = json.load(open(os.path.join(DATA, "dst_by_team.json")))
bye_weeks = json.load(open(os.path.join(DATA, "schedule_2026.json")))["bye_weeks"]


def median(xs):
    xs = sorted(xs)
    n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


# ---- 1. empirical aging-curve multiplier table, from real year-over-year data ----
growth_samples = defaultdict(list)
for pid, rows in season_stats.items():
    p = players_index.get(pid)
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
        rate2 = s2["fpts_half"] / s2["games"]
        exp_year = min(i + 1, MAX_EXP_BUCKET)
        growth_samples[(p["position"], exp_year)].append(rate2 / rate1)

growth_table = {key: 1 + (median(vals) - 1) * GROWTH_SHRINK for key, vals in growth_samples.items()}


# ---- 2. project 2026 half-PPR points for every player active in LATEST_SEASON ----
def project_player(pid, rows, position):
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
    proj_rate = weighted_rate * mult
    return proj_rate * proj_games, proj_games


skill, kickers = [], []
for pid, rows in season_stats.items():
    p = players_index.get(pid)
    if not p or p["last_season"] != LATEST_SEASON:
        continue
    latest_row = next((r for r in rows if r["season"] == LATEST_SEASON), None)
    if not latest_row:
        continue
    result = project_player(pid, rows, p["position"])
    if not result:
        continue
    proj_fpts, proj_games = result
    entry = {
        "id": pid, "name": p["name"], "position": p["position"], "team": latest_row["team"],
        "proj_fpts_half": round(proj_fpts, 2), "proj_games": proj_games,
        "last_season_fpts_half": latest_row["fpts_half"], "games": latest_row["games"],
        "headshot": p["headshot"], "bye_week": bye_weeks.get(latest_row["team"]),
    }
    (kickers if p["position"] == "K" else skill).append(entry)

dst = []
for team, seasons in dst_by_team.items():
    recent = [seasons[str(y)] for y in range(LATEST_SEASON, LATEST_SEASON - 3, -1) if str(y) in seasons]
    if not recent:
        continue
    w = RECENT_WEIGHTS[: len(recent)]
    wsum = sum(w)
    w = [x / wsum for x in w]
    proj_fpts = sum(r["fpts"] * wi for r, wi in zip(recent, w))
    latest = recent[0]
    dst.append({
        "id": f"DST_{team}", "name": f"{TEAM_NAMES[team]} D/ST", "position": "DST", "team": team,
        "proj_fpts_half": round(proj_fpts, 2), "proj_games": 17,
        "last_season_fpts_half": latest["fpts"], "games": 17,
        "headshot": None, "bye_week": bye_weeks.get(team),
    })

# ---- 3. Value-Based Drafting order for skill positions ----
skill_by_pos = defaultdict(list)
for p in skill:
    skill_by_pos[p["position"]].append(p)
for rows in skill_by_pos.values():
    rows.sort(key=lambda x: -x["proj_fpts_half"])

baseline_pts = {
    pos: rows[min(VBD_BASELINE_RANK[pos], len(rows)) - 1]["proj_fpts_half"]
    for pos, rows in skill_by_pos.items() if pos in VBD_BASELINE_RANK
}
for p in skill:
    p["_vbd_value"] = p["proj_fpts_half"] - baseline_pts.get(p["position"], 0)

skill.sort(key=lambda x: -x["_vbd_value"])
kickers.sort(key=lambda x: -x["proj_fpts_half"])
dst.sort(key=lambda x: -x["proj_fpts_half"])

SKILL_CAP, K_CAP, DST_CAP = 244, 24, 32
draft_pool = skill[:SKILL_CAP] + kickers[:K_CAP] + dst[:DST_CAP]
for p in draft_pool:
    p.pop("_vbd_value", None)

# pos_rank_last_season uses actual last-season points, not the projection —
# "best RB by production last year" is a different question from "best pick".
by_pos = defaultdict(list)
for p in draft_pool:
    by_pos[p["position"]].append(p)
for rows in by_pos.values():
    rows.sort(key=lambda x: -x["last_season_fpts_half"])
    for i, r in enumerate(rows, start=1):
        r["pos_rank_last_season"] = i

for i, p in enumerate(draft_pool, start=1):
    p["adp_rank"] = i

out_path = os.path.join(DATA, "draft_pool.json")
with open(out_path, "w") as f:
    json.dump(draft_pool, f, separators=(",", ":"))
print(f"Wrote {out_path}, size: {len(draft_pool)} (skill={len(skill[:SKILL_CAP])}, K={len(kickers[:K_CAP])}, DST={len(dst[:DST_CAP])})")
