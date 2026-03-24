"""
Push notification system via ntfy.sh.
Never raises — notification failures must never crash the bot.
"""

import logging
from typing import List, Optional

import requests

logger = logging.getLogger(__name__)


def send(
    topic: str,
    title: str,
    message: str,
    priority: str = "default",
    tags: Optional[List[str]] = None,
    server: str = "https://ntfy.sh",
) -> bool:
    """Send a push notification. Returns False on failure, never raises."""
    try:
        headers = {
            "Title": title,
            "Priority": priority,
            "Content-Type": "text/plain",
        }
        if tags:
            headers["Tags"] = ",".join(tags)

        resp = requests.post(
            f"{server}/{topic}",
            data=message.encode("utf-8"),
            headers=headers,
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.warning(f"Notification failed: {e}")
        return False


def send_daily_summary(cfg, trades: list, budget_used: float, failed_count: int) -> None:
    """Send the daily trading summary notification."""
    from datetime import date

    if not cfg.ntfy_topic:
        return

    today = date.today().strftime("%Y-%m-%d")
    lines = [f"=== Daily Trading Run: {today} ==="]
    lines.append(f"Budget used: ${budget_used:.2f} | Trades: {len(trades)} | Failed: {failed_count}")
    lines.append("")

    for t in trades:
        cost = (t.count * t.entry_price_cents) / 100
        lines.append(
            f"  [{t.tier}] {'YES' if t.side == 'yes' else 'NO'} {t.count}x {t.label} "
            f"@ {t.entry_price_cents}c (${cost:.2f}) | win%={int(t.implied_prob * 100)}%"
        )

    if not trades:
        lines.append("  No trades placed today (no qualifying candidates).")

    message = "\n".join(lines)
    title = f"Kalshi Bot — {len(trades)} trades, ${budget_used:.2f} deployed"
    send(cfg.ntfy_topic, title, message, priority="default", tags=["chart_with_upwards_trend"], server=cfg.ntfy_server)


def send_settlement(cfg, ticker: str, result: str, pnl_cents: int) -> None:
    """Send a win/loss settlement notification."""
    if not cfg.ntfy_topic:
        return

    pnl_usd = pnl_cents / 100
    if result == "win":
        title = f"WIN: {ticker} +${pnl_usd:.2f}"
        priority = "high"
        tags = ["white_check_mark"]
    else:
        title = f"LOSS: {ticker} -${abs(pnl_usd):.2f}"
        priority = "default"
        tags = ["x"]

    message = f"Settled: {ticker}\nResult: {result.upper()}\nP&L: ${pnl_usd:+.2f}"
    send(cfg.ntfy_topic, title, message, priority=priority, tags=tags, server=cfg.ntfy_server)


def send_error(cfg, context: str, error: str) -> None:
    """Send an urgent error notification."""
    if not cfg.ntfy_topic:
        return

    title = f"Kalshi Bot ERROR: {context}"
    message = f"Context: {context}\n\nError:\n{error}"
    send(cfg.ntfy_topic, title, message, priority="urgent", tags=["warning"], server=cfg.ntfy_server)


def send_no_trade(cfg, reason: str) -> None:
    """Notify that no trades were placed today."""
    if not cfg.ntfy_topic:
        return

    from datetime import date
    today = date.today().strftime("%Y-%m-%d")
    title = f"Kalshi Bot — No trades ({today})"
    send(cfg.ntfy_topic, title, reason, priority="low", tags=["zzz"], server=cfg.ntfy_server)
