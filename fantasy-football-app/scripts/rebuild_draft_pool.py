# Rebuilds public/data/draft_pool.json from the already-generated static JSON
# (season_stats_by_player.json, players_index.json, dst_by_team.json,
# schedule_2026.json) using Half-PPR (0.5 pt/reception) scoring, capped at a
# realistic 300-player pool with K/DST clustered near the bottom the way most
# published cheat sheets rank them, instead of by raw season point totals.
import json
import os

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")
LATEST_SEASON = 2025

TEAM_NAMES = {t["abbr"]: t["name"] for t in json.load(open(os.path.join(DATA, "teams.json")))}
players_index = {p["id"]: p for p in json.load(open(os.path.join(DATA, "players_index.json")))}
season_stats = json.load(open(os.path.join(DATA, "season_stats_by_player.json")))
dst_by_team = json.load(open(os.path.join(DATA, "dst_by_team.json")))
bye_weeks = json.load(open(os.path.join(DATA, "schedule_2026.json")))["bye_weeks"]

skill = []
kickers = []
for pid, rows in season_stats.items():
    row = next((r for r in rows if r["season"] == LATEST_SEASON), None)
    if not row:
        continue
    p = players_index.get(pid)
    if not p:
        continue
    entry = {
        "id": pid, "name": p["name"], "position": p["position"], "team": row["team"],
        "last_season_fpts_half": row["fpts_half"], "last_season_fpts": row["fpts"],
        "games": row["games"], "headshot": p["headshot"], "bye_week": bye_weeks.get(row["team"]),
    }
    (kickers if p["position"] == "K" else skill).append(entry)

dst = []
for team, seasons in dst_by_team.items():
    r = seasons.get(str(LATEST_SEASON)) or seasons.get(LATEST_SEASON)
    if not r:
        continue
    dst.append({
        "id": f"DST_{team}", "name": f"{TEAM_NAMES[team]} D/ST", "position": "DST", "team": team,
        "last_season_fpts_half": r["fpts"], "last_season_fpts": r["fpts"],
        "games": 17, "headshot": None, "bye_week": bye_weeks.get(team),
    })

skill.sort(key=lambda x: -x["last_season_fpts_half"])
kickers.sort(key=lambda x: -x["last_season_fpts_half"])
dst.sort(key=lambda x: -x["last_season_fpts_half"])

SKILL_CAP, K_CAP, DST_CAP = 244, 24, 32
draft_pool = skill[:SKILL_CAP] + kickers[:K_CAP] + dst[:DST_CAP]

# pos_rank_last_season: rank within position among the *drafted pool*, by half-PPR pts
by_pos: dict[str, list] = {}
for p in draft_pool:
    by_pos.setdefault(p["position"], []).append(p)
for pos, rows in by_pos.items():
    rows.sort(key=lambda x: -x["last_season_fpts_half"])
    for i, r in enumerate(rows, start=1):
        r["pos_rank_last_season"] = i

for i, p in enumerate(draft_pool, start=1):
    p["adp_rank"] = i

out_path = os.path.join(DATA, "draft_pool.json")
with open(out_path, "w") as f:
    json.dump(draft_pool, f, separators=(",", ":"))
print(f"Wrote {out_path}, size: {len(draft_pool)} (skill={len(skill[:SKILL_CAP])}, K={len(kickers[:K_CAP])}, DST={len(dst[:DST_CAP])})")
