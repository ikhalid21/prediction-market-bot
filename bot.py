"""
Main daily trading bot.
Run once per day via cron, or manually with --dry-run for testing.

Usage:
    python bot.py              # live trading
    python bot.py --dry-run    # simulate without placing orders
"""

import argparse
import csv
import json
import logging
import logging.handlers
import os
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone

import requests

from config import load_config
from kalshi_client_demo import KalshiClient
import github_sync
import notifier
import strategy as strat


# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

def _setup_logging(cfg) -> logging.Logger:
    os.makedirs(cfg.logging.log_dir, exist_ok=True)
    logger = logging.getLogger("bot")
    logger.setLevel(logging.INFO)

    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S")

    fh = logging.handlers.RotatingFileHandler(
        cfg.logging.run_log_file, maxBytes=5_000_000, backupCount=10
    )
    fh.setFormatter(fmt)

    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)

    logger.addHandler(fh)
    logger.addHandler(sh)
    return logger


# ---------------------------------------------------------------------------
# Lock file (idempotency guard)
# ---------------------------------------------------------------------------

LOCK_FILE = "logs/bot.lock"


def _acquire_lock(logger: logging.Logger, runs_per_day: int = 1):
    """
    Return (acquired, run_num).
    Allows up to runs_per_day runs per calendar day.
    run_num is 1 for the first run of the day, 2 for the second, etc.
    """
    today = str(date.today())
    run_num = 1

    if os.path.exists(LOCK_FILE):
        try:
            with open(LOCK_FILE) as f:
                content = f.read().strip()
            parts = content.split(":")
            if parts[0] == today:
                count = int(parts[1]) if len(parts) > 1 else 1
                if count >= runs_per_day:
                    logger.info(f"Already ran {count}/{runs_per_day} times today. Exiting.")
                    return False, 0
                run_num = count + 1
        except (OSError, ValueError):
            pass

    os.makedirs("logs/", exist_ok=True)
    with open(LOCK_FILE, "w") as f:
        f.write(f"{today}:{run_num}")
    return True, run_num


def _release_lock():
    pass  # lock persists so run count is preserved across runs within the same day


# ---------------------------------------------------------------------------
# CSV logging helpers
# ---------------------------------------------------------------------------

TRADE_HEADER = [
    "run_date", "ticker", "series", "tier", "side",
    "count", "entry_price_cents", "cost_usd",
    "implied_prob", "ev", "order_id", "status",
]

PNL_HEADER = [
    "settlement_date", "ticker", "tier", "side",
    "count", "entry_price_cents", "result", "pnl_cents", "pnl_usd",
]


def _ensure_csv(path: str, header: list):
    if not os.path.exists(path):
        with open(path, "w", newline="") as f:
            csv.writer(f).writerow(header)


def _log_trade(cfg, trade, order_id: str, status: str):
    _ensure_csv(cfg.logging.trade_log_file, TRADE_HEADER)
    cost = trade.count * trade.entry_price_cents / 100.0
    row = [
        date.today().isoformat(),
        trade.ticker, trade.series, trade.tier, trade.side,
        trade.count, trade.entry_price_cents, f"{cost:.4f}",
        f"{trade.implied_prob:.4f}", f"{trade.ev:.4f}",
        order_id, status,
    ]
    with open(cfg.logging.trade_log_file, "a", newline="") as f:
        csv.writer(f).writerow(row)


# ---------------------------------------------------------------------------
# Market pagination
# ---------------------------------------------------------------------------

def _fetch_all_markets(client: KalshiClient, cfg, logger: logging.Logger) -> list:
    """
    Paginate through all open markets for the configured event series.
    Applies server-side filters where the API supports them.
    """
    now = datetime.now(timezone.utc)
    min_close_ts = int(now.timestamp() + cfg.markets.min_expiry_hours * 3600)
    max_close_ts = int(now.timestamp() + cfg.markets.max_expiry_days * 86400)

    all_markets = []
    for series in cfg.markets.event_series:
        cursor = None
        page = 0
        while True:
            params = {
                "status": "open",
                "series_ticker": series,
                "min_close_ts": min_close_ts,
                "max_close_ts": max_close_ts,
                "limit": 200,
            }
            if cursor:
                params["cursor"] = cursor

            try:
                resp = client.get_markets(**params)
            except requests.HTTPError as e:
                logger.warning(f"Failed to fetch markets for series {series}: {e}")
                break

            markets = resp.get("markets", [])
            all_markets.extend(markets)
            cursor = resp.get("cursor")
            page += 1

            if not cursor or not markets:
                break

        series_count = len([m for m in all_markets if m.get('event_ticker', '').startswith(series)])
        if series_count > 0:
            logger.info(f"Series {series}: {series_count} markets")

    logger.info(f"Total markets fetched: {len(all_markets)}")
    return all_markets


# ---------------------------------------------------------------------------
# Orderbook fetching (parallel)
# ---------------------------------------------------------------------------

def _fetch_orderbook(client: KalshiClient, ticker: str, logger: logging.Logger):
    """Fetch a single orderbook. Returns (ticker, data) or (ticker, None) on error."""
    try:
        data = client.get_orderbook(ticker, depth=3)
        return ticker, data
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 429:
            time.sleep(5)
            try:
                data = client.get_orderbook(ticker, depth=3)
                return ticker, data
            except Exception:
                pass
        logger.debug(f"Orderbook fetch failed for {ticker}: {e}")
        return ticker, None
    except Exception as e:
        logger.debug(f"Orderbook fetch error for {ticker}: {e}")
        return ticker, None


def _fetch_all_orderbooks(
    client: KalshiClient, tickers: list, logger: logging.Logger
) -> dict:
    """Fetch orderbooks in parallel. Returns dict of ticker -> orderbook data."""
    orderbooks = {}
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(_fetch_orderbook, client, t, logger): t for t in tickers}
        for future in as_completed(futures):
            ticker, data = future.result()
            if data is not None:
                orderbooks[ticker] = data
    logger.info(f"Fetched {len(orderbooks)}/{len(tickers)} orderbooks")
    return orderbooks


# ---------------------------------------------------------------------------
# Positions state (for monitor.py)
# ---------------------------------------------------------------------------

POSITIONS_STATE_FILE = "logs/positions_state.json"


def _load_positions_state() -> dict:
    if os.path.exists(POSITIONS_STATE_FILE):
        try:
            with open(POSITIONS_STATE_FILE) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_positions_state(state: dict):
    os.makedirs("logs/", exist_ok=True)
    with open(POSITIONS_STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


# ---------------------------------------------------------------------------
# Placing orders with error handling
# ---------------------------------------------------------------------------

def _place_order_safe(
    client: KalshiClient,
    trade,
    dry_run: bool,
    logger: logging.Logger,
) -> tuple:
    """
    Place a single order. Returns (order_id, status).
    In dry_run mode, returns a fake order_id.
    """
    if dry_run:
        fake_id = f"DRY-{trade.ticker}-{int(time.time())}"
        return fake_id, "dry_run"

    try:
        resp = client.place_order(
            ticker=trade.ticker,
            action="buy",
            side=trade.side,
            count=trade.count,
            price_cents=trade.entry_price_cents,
        )
        order_id = resp.get("order", {}).get("order_id", "unknown")
        return order_id, "placed"

    except requests.HTTPError as e:
        status_code = e.response.status_code if e.response is not None else 0

        if status_code == 429:
            logger.warning(f"Rate limited placing {trade.ticker}. Backing off 60s...")
            time.sleep(60)
            try:
                resp = client.place_order(
                    ticker=trade.ticker,
                    action="buy",
                    side=trade.side,
                    count=trade.count,
                    price_cents=trade.entry_price_cents,
                )
                order_id = resp.get("order", {}).get("order_id", "unknown")
                return order_id, "placed"
            except Exception as retry_err:
                logger.error(f"Retry failed for {trade.ticker}: {retry_err}")
                return "", "failed"

        elif status_code >= 500:
            raise  # let caller handle 5xx — abort the run

        else:
            error_body = ""
            try:
                error_body = e.response.text
            except Exception:
                pass
            logger.error(f"Order failed for {trade.ticker} (HTTP {status_code}): {error_body}")
            return "", "failed"

    except Exception as e:
        logger.error(f"Unexpected error placing {trade.ticker}: {e}")
        return "", "failed"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Kalshi prediction market trading bot")
    parser.add_argument("--dry-run", action="store_true", help="Simulate trades without placing orders")
    args = parser.parse_args()

    # Bootstrap logging before config (in case config fails)
    os.makedirs("logs/", exist_ok=True)
    logging.basicConfig(level=logging.INFO)

    cfg = load_config()
    logger = _setup_logging(cfg)

    if args.dry_run:
        logger.info("=== DRY RUN MODE — no orders will be placed ===")

    # Idempotency guard (skip in dry-run)
    run_num = 1
    if not args.dry_run:
        acquired, run_num = _acquire_lock(logger, cfg.budget.runs_per_day)
        if not acquired:
            sys.exit(0)

    run_start = time.time()

    try:
        _run(cfg, logger, dry_run=args.dry_run, run_num=run_num)
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Fatal error:\n{tb}")
        notifier.send_error(cfg, "Fatal error in bot.py", tb)
        sys.exit(1)

    duration = time.time() - run_start
    logger.info(f"Run complete in {duration:.1f}s")


def _run(cfg, logger, dry_run: bool, run_num: int = 1):
    # --- Init client ---
    client = KalshiClient(cfg.api_key_id, cfg.private_key_path)

    # --- Balance ---
    balance_resp = client.get_balance()
    balance_cents = balance_resp.get("balance", 0)
    balance_usd = balance_cents / 100.0
    per_run_cap = cfg.budget.daily_cap_usd / cfg.budget.runs_per_day
    today_budget = min(balance_usd * cfg.budget.balance_pct, per_run_cap)
    logger.info(f"Balance: ${balance_usd:.2f} | Run {run_num}/{cfg.budget.runs_per_day} budget: ${today_budget:.2f}")

    # --- Existing positions (seed series counter) ---
    existing_positions = client.get_positions().get("market_positions", [])
    existing_series_count = {}
    for pos in existing_positions:
        ticker = pos.get("ticker", "")
        series = strat._extract_series(ticker)
        existing_series_count[series] = existing_series_count.get(series, 0) + 1

    # --- Fetch markets ---
    today = date.today().isoformat()
    logger.info(f"=== Trading Run {run_num}: {today} ===")
    logger.info(f"Scanning {len(cfg.markets.event_series)} series for open markets...")

    markets = _fetch_all_markets(client, cfg, logger)
    if not markets:
        msg = "No open markets found."
        logger.info(msg)
        notifier.send_no_trade(cfg, msg)
        return

    logger.info(f"Found {len(markets)} tradeable short-term markets")

    # --- Deep scan: first pass to identify top candidates, then enrich with orderbooks ---
    first_pass = strat.analyze_markets(markets, {}, cfg)
    top_tickers = [c.ticker for c in first_pass[:150]]
    if top_tickers:
        logger.info(f"Fetching orderbooks for top {len(top_tickers)} candidates...")
        orderbooks = _fetch_all_orderbooks(client, top_tickers, logger)
    else:
        orderbooks = {}
    candidates = strat.analyze_markets(markets, orderbooks, cfg)
    logger.info(f"Qualified candidates: {len(candidates)}")

    selected = strat.select_trades(candidates, today_budget, cfg)

    if not selected:
        msg = f"No qualifying trades (found {len(candidates)} candidates, need {cfg.budget.min_candidates})."
        logger.info(msg)
        notifier.send_no_trade(cfg, msg)
        return

    # --- Print selection table ---
    logger.info(f"\nSelected {len(selected)} trades:")
    for t in selected:
        cost = t.count * t.entry_price_cents / 100.0
        logger.info(
            f"  [{t.tier}] {'YES' if t.side == 'yes' else 'NO'} {t.count}x "
            f"{t.label} @ {t.entry_price_cents}c (${cost:.2f}) | win%={int(t.implied_prob * 100)}%"
        )

    # --- Place orders ---
    positions_state = _load_positions_state()
    placed_count = 0
    failed_count = 0
    budget_used = 0.0

    for trade in selected:
        order_id, status = _place_order_safe(client, trade, dry_run, logger)

        if status in ("placed", "dry_run"):
            placed_count += 1
            cost = trade.count * trade.entry_price_cents / 100.0
            budget_used += cost
            positions_state[order_id] = {
                "ticker": trade.ticker,
                "series": trade.series,
                "tier": trade.tier,
                "side": trade.side,
                "count": trade.count,
                "entry_price_cents": trade.entry_price_cents,
                "implied_prob": trade.implied_prob,
                "placed_date": today,
                "status": "open",
            }
            logger.info(f"Order placed: {trade.ticker} x{trade.count} @ {trade.entry_price_cents}c [{order_id}]")
        else:
            failed_count += 1

        _log_trade(cfg, trade, order_id, status)

    if not dry_run:
        _save_positions_state(positions_state)

    logger.info(f"\nTrades placed: {placed_count}/{len(selected)} | Failed: {failed_count} | Total spent: ${budget_used:.2f}")

    # --- Notifications ---
    notifier.send_daily_summary(cfg, selected, budget_used, failed_count)

    # --- Run log ---
    run_record = {
        "date": today,
        "budget_usd": today_budget,
        "budget_used": round(budget_used, 2),
        "trades": placed_count,
        "failed": failed_count,
        "candidates": len(candidates),
        "dry_run": dry_run,
    }
    with open(cfg.logging.run_log_file, "a") as f:
        f.write(json.dumps(run_record) + "\n")

    # Sync logs to GitHub
    github_sync.sync_logs(cfg)


if __name__ == "__main__":
    main()
