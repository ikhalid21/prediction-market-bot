"""
Dollar-cost averaging reminder system.
Tracks Roth IRA contribution schedule and sends monthly reminders.

Cron entry:
    00 8 1 * * cd /path && python dca_tracker.py >> logs/cron.log 2>&1
"""

import logging
import sys
from datetime import date

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


def check_dca(cfg) -> None:
    today = date.today()
    months_elapsed = today.month  # January = 1 month elapsed after Jan 1

    expected_contribution = months_elapsed * (cfg.dca.roth_ira_annual_limit / 12)
    actual_contribution = cfg.dca.roth_ira_contributed
    gap = expected_contribution - actual_contribution
    remaining_limit = cfg.dca.roth_ira_annual_limit - actual_contribution

    logger.info(f"DCA Check — {today.isoformat()}")
    logger.info(f"  Roth IRA annual limit: ${cfg.dca.roth_ira_annual_limit:,.2f}")
    logger.info(f"  Expected YTD (month {months_elapsed}): ${expected_contribution:,.2f}")
    logger.info(f"  Actual contributed:    ${actual_contribution:,.2f}")
    logger.info(f"  Gap:                   ${gap:+,.2f}")
    logger.info(f"  Remaining limit:       ${remaining_limit:,.2f}")

    lines = [
        f"DCA Reminder — {today.strftime('%B %Y')}",
        "",
        f"Roth IRA",
        f"  Annual limit:   ${cfg.dca.roth_ira_annual_limit:,.2f}",
        f"  Contributed:    ${actual_contribution:,.2f}",
        f"  Remaining:      ${remaining_limit:,.2f}",
    ]

    if gap > 0:
        lines.append(f"  ⚠ Behind by:    ${gap:,.2f} (catch up!)")
        priority = "high"
        tags = ["calendar", "warning"]
    elif gap < 0:
        lines.append(f"  ✓ Ahead by:     ${abs(gap):,.2f}")
        priority = "default"
        tags = ["calendar", "white_check_mark"]
    else:
        lines.append(f"  ✓ On track")
        priority = "default"
        tags = ["calendar", "white_check_mark"]

    lines.append("")
    lines.append(f"Monthly DCA (taxable): ${cfg.dca.monthly_amount_usd:,.2f}")
    lines.append(f"Suggested this month: ${cfg.dca.monthly_amount_usd:,.2f}")

    message = "\n".join(lines)
    title = f"DCA Reminder — {today.strftime('%B %Y')}"

    if cfg.ntfy_topic:
        notifier.send(
            cfg.ntfy_topic,
            title,
            message,
            priority=priority,
            tags=tags,
            server=cfg.ntfy_server,
        )

    print(message)


def main():
    _setup_logging()
    cfg = load_config()
    check_dca(cfg)


if __name__ == "__main__":
    main()
