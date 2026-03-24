"""
Stock portfolio watchlist monitor.
Fetches latest prices via yfinance and sends dip-buy alerts.

Cron entries:
    30 9  * * 1-5  cd /path && python portfolio.py >> logs/cron.log 2>&1  # market open
    00 16 * * 1-5  cd /path && python portfolio.py >> logs/cron.log 2>&1  # market close
"""

import logging
import sys
from datetime import date
from typing import List, Optional

from config import load_config
import notifier

logger = logging.getLogger(__name__)


def _setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
    )


def check_portfolio(cfg) -> List[dict]:
    """
    Fetch current prices for all watchlist tickers.
    Returns list of dicts: {ticker, price, prev_close, change_pct, alert}
    """
    try:
        import yfinance as yf
    except ImportError:
        logger.error("yfinance not installed. Run: pip install yfinance")
        return []

    results = []
    for ticker in cfg.portfolio.watchlist:
        try:
            data = yf.download(ticker, period="2d", progress=False, auto_adjust=True)
            if data is None or data.empty or len(data) < 2:
                logger.warning(f"No data for {ticker}")
                continue

            prev_close = float(data["Close"].iloc[-2])
            current = float(data["Close"].iloc[-1])
            change_pct = (current - prev_close) / prev_close

            alert = abs(change_pct) >= cfg.portfolio.dip_threshold_pct

            results.append({
                "ticker": ticker,
                "price": round(current, 2),
                "prev_close": round(prev_close, 2),
                "change_pct": round(change_pct * 100, 2),  # as percentage
                "alert": alert,
            })

        except Exception as e:
            logger.warning(f"Failed to fetch data for {ticker}: {e}")
            continue

    return results


def format_portfolio_report(holdings: List[dict]) -> str:
    """Format holdings as a compact text table."""
    if not holdings:
        return "No portfolio data available."

    lines = [f"Portfolio Check — {date.today().isoformat()}", ""]
    for h in holdings:
        arrow = "▲" if h["change_pct"] > 0 else "▼"
        alert_marker = " ← ALERT" if h["alert"] else ""
        lines.append(
            f"  {h['ticker']:8s}  ${h['price']:>8.2f}  {arrow}{abs(h['change_pct']):.2f}%{alert_marker}"
        )
    return "\n".join(lines)


def main():
    _setup_logging()
    cfg = load_config()

    if not cfg.portfolio.watchlist:
        logger.info("Watchlist is empty. Nothing to check.")
        return

    logger.info(f"Checking {len(cfg.portfolio.watchlist)} tickers: {cfg.portfolio.watchlist}")
    holdings = check_portfolio(cfg)

    if not holdings:
        logger.warning("No holdings data returned.")
        return

    report = format_portfolio_report(holdings)
    print(report)

    alerts = [h for h in holdings if h["alert"]]
    if alerts:
        alert_lines = []
        for h in alerts:
            direction = "DIP" if h["change_pct"] < 0 else "SURGE"
            alert_lines.append(f"{h['ticker']}: {h['change_pct']:+.2f}% ({direction})")

        title = f"Portfolio Alert — {len(alerts)} ticker(s) moved >{cfg.portfolio.dip_threshold_pct * 100:.0f}%"
        message = report
        notifier.send(
            cfg.ntfy_topic,
            title,
            message,
            priority="high" if any(h["change_pct"] < 0 for h in alerts) else "default",
            tags=["chart_with_downwards_trend" if any(h["change_pct"] < 0 for h in alerts) else "chart_with_upwards_trend"],
            server=cfg.ntfy_server,
        )
    else:
        logger.info("No significant moves today.")


if __name__ == "__main__":
    main()
