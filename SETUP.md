# Kalshi Bot — Setup & Status

## What's Been Built

The full trading bot is implemented and pushed to branch `claude/check-kalshi-bot-diXmJ`.

| File | Status | Purpose |
|---|---|---|
| `kalshi_client_demo.py` | ✅ Existing | Kalshi API client (RSA-PSS auth) |
| `config.py` | ✅ Built | Typed config loader |
| `config.json` | ⚠️ Needs credentials | All tunable parameters |
| `strategy.py` | ✅ Built | Three-tier scoring engine |
| `bot.py` | ✅ Built | Main daily trading loop |
| `monitor.py` | ✅ Built | 5-min settlement monitor |
| `notifier.py` | ✅ Built | ntfy.sh push notifications |
| `portfolio.py` | ✅ Built | Stock watchlist alerts |
| `dca_tracker.py` | ✅ Built | Roth IRA DCA reminders |
| `requirements.txt` | ✅ Built | Python dependencies |

---

## To Go Live — 3 Steps

### Step 1: Fill in config.json

Open `config.json` and set:
```json
"api_key_id": "your-kalshi-api-key-id",
"private_key_path": "/path/to/your/private_key.pem",
"ntfy_topic": "your-ntfy-topic"
```

Also copy your `.pem` file into this directory (it's gitignored — safe).

### Step 2: Install dependencies

```bash
pip install -r requirements.txt
```

### Step 3: Test with dry run first

```bash
python bot.py --dry-run
```

This runs the full strategy against live Kalshi data without placing any orders.
Check the output looks reasonable, then go live.

---

## Go Live

```bash
# Single run now
python bot.py

# Add to crontab (crontab -e) for full automation
31 9  * * 1-5  cd /home/user/prediction-market-bot && python bot.py >> logs/cron.log 2>&1
*/5  * * * *   cd /home/user/prediction-market-bot && python monitor.py >> logs/cron.log 2>&1
30 9  * * 1-5  cd /home/user/prediction-market-bot && python portfolio.py >> logs/cron.log 2>&1
00 16 * * 1-5  cd /home/user/prediction-market-bot && python portfolio.py >> logs/cron.log 2>&1
00 8  1 * *    cd /home/user/prediction-market-bot && python dca_tracker.py >> logs/cron.log 2>&1
```

---

## Strategy Summary

Three-tier budget allocation per day:

| Tier | Budget | Target | Entry |
|---|---|---|---|
| HIGH_PROB | 55% | 90%+ win probability, 1000+ volume, <2c spread | Buy at bid |
| VALUE | 30% | 30-55% probability, positive EV edge | Buy at ask |
| TAIL | 15% | 8-20% probability, high volume, 5-10x payoff | Buy at bid |

Default daily budget: `min(balance × 23%, $50)`.

All parameters are tunable in `config.json`.

---

## Key Files to Know

- `logs/trades.csv` — every trade placed
- `logs/pnl.csv` — settled P&L history
- `logs/positions_state.json` — open positions state (written by bot.py, read by monitor.py)
- `logs/bot_runs.log` — one JSON line per daily run
