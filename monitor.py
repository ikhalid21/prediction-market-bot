"""
Settlement monitor — runs every 5 minutes via cron.
Checks open positions for wins/losses and sends push notifications.

Cron entry:
    */5 * * * * cd /path/to/bot && python monitor.py >> logs/cron.log 2>&1
"""

import csv
import json
import logging
import logging.handlers
import os
import sys
from datetime import date

import requests

from config import load_config
from kalshi_client_demo import KalshiClient
import notifier

POSITIONS_STATE_FILE = "logs/positions_state.json"

PNL_HEADER = [
    "settlement_date", "ticker", "tier", "side",
    "count", "entry_price_cents", "result", "pnl_cents", "pnl_usd",
]


def _setup_logging(cfg) -> logging.Logger:
    os.makedirs(cfg.logging.log_dir, exist_ok=True)
    logger = logging.getLogger("monitor")
    logger.setLevel(logging.INFO)

    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S")

    fh = logging.handlers.RotatingFileHandler(
        os.path.join(cfg.logging.log_dir, "monitor.log"),
        maxBytes=5_000_000,
        backupCount=5,
    )
    fh.setFormatter(fmt)

    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)

    logger.addHandler(fh)
    logger.addHandler(sh)
    return logger


def _load_state() -> dict:
    if not os.path.exists(POSITIONS_STATE_FILE):
        return {}
    try:
        with open(POSITIONS_STATE_FILE) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def _save_state(state: dict):
    os.makedirs("logs/", exist_ok=True)
    with open(POSITIONS_STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def _ensure_pnl_csv(cfg):
    if not os.path.exists(cfg.logging.pnl_log_file):
        os.makedirs(cfg.logging.log_dir, exist_ok=True)
        with open(cfg.logging.pnl_log_file, "w", newline="") as f:
            csv.writer(f).writerow(PNL_HEADER)


def _log_pnl(cfg, ticker: str, pos: dict, result: str, pnl_cents: int):
    _ensure_pnl_csv(cfg)
    pnl_usd = pnl_cents / 100.0
    row = [
        date.today().isoformat(),
        ticker,
        pos.get("tier", ""),
        pos.get("side", ""),
        pos.get("count", 0),
        pos.get("entry_price_cents", 0),
        result,
        pnl_cents,
        f"{pnl_usd:.4f}",
    ]
    with open(cfg.logging.pnl_log_file, "a", newline="") as f:
        csv.writer(f).writerow(row)


def _compute_pnl(pos: dict, result: str, filled_count: int) -> int:
    """Return P&L in cents (positive = profit, negative = loss)."""
    entry_cents = pos.get("entry_price_cents", 0)
    count = filled_count or pos.get("count", 0)
    if result == "win":
        return count * (100 - entry_cents)
    else:
        return -(count * entry_cents)


def main():
    cfg = load_config()
    logger = _setup_logging(cfg)

    # Load known positions state
    state = _load_state()
    if not state:
        logger.debug("No tracked positions. Nothing to monitor.")
        return

    # Fetch current positions from API
    try:
        client = KalshiClient(cfg.api_key_id, cfg.private_key_path)
        positions_resp = client.get_positions(limit=200)
    except requests.HTTPError as e:
        logger.error(f"Failed to fetch positions: {e}")
        notifier.send_error(cfg, "monitor.py", f"Failed to fetch positions: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error fetching positions: {e}")
        sys.exit(1)

    api_positions = positions_resp.get("market_positions", [])

    # Build a lookup: ticker -> position data from API
    api_by_ticker = {}
    for pos in api_positions:
        ticker = pos.get("ticker", "")
        if ticker:
            api_by_ticker[ticker] = pos

    # Check each tracked position for settlement
    updated_state = dict(state)

    for order_id, pos in state.items():
        ticker = pos.get("ticker", "")
        current_status = pos.get("status", "open")

        if current_status == "settled":
            continue  # already processed

        api_pos = api_by_ticker.get(ticker)

        if api_pos is None:
            # Position no longer in API — may be settled and cleared
            # Check if it was recently placed; if so, mark as settled-unknown
            logger.info(f"Position {ticker} no longer in API response (may have settled/expired)")
            continue

        # Check settlement result
        result = api_pos.get("settlement_result")  # "win", "lose", or null
        if result is None:
            continue  # still open

        # Map "lose" -> "loss" for our records
        result_label = "win" if result == "win" else "loss"

        # Use filled count if available
        filled_count = api_pos.get("quantity", pos.get("count", 0))
        pnl_cents = _compute_pnl(pos, result, filled_count)
        pnl_usd = pnl_cents / 100.0

        logger.info(
            f"SETTLED: {ticker} | result={result_label.upper()} | "
            f"count={filled_count} | entry={pos.get('entry_price_cents')}c | "
            f"P&L=${pnl_usd:+.2f}"
        )

        # Log to CSV
        _log_pnl(cfg, ticker, pos, result_label, pnl_cents)

        # Send notification
        notifier.send_settlement(cfg, ticker, result_label, pnl_cents)

        # Mark as settled in state
        updated_state[order_id] = {**pos, "status": "settled", "result": result_label, "pnl_cents": pnl_cents}

    _save_state(updated_state)
    logger.debug("Monitor run complete.")


if __name__ == "__main__":
    main()
