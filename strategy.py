"""
Quantitative trading strategy engine.
Pure computation — no I/O. All functions are unit-testable with synthetic data.
"""

import math
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional

from config import Config


@dataclass
class TradeCandidate:
    ticker: str
    series: str
    side: str            # "yes" or "no"
    tier: str            # "HIGH_PROB" | "VALUE" | "TAIL"
    implied_prob: float
    bid_cents: int
    ask_cents: int
    spread_cents: int
    volume: int
    ev: float            # expected value per dollar risked
    score: float
    expiry: datetime
    label: str           # human-readable market description
    count: int = 0       # filled in by select_trades
    entry_price_cents: int = 0  # filled in by select_trades


def _extract_orderbook_prices(orderbook: dict) -> Optional[tuple]:
    """
    Extract best bid and ask from Kalshi orderbook_fp response.
    Prices are decimal strings (0.0 - 1.0); we convert to cents (0-100).
    Returns (yes_bid_cents, yes_ask_cents) or None if orderbook is unusable.
    """
    ob = orderbook.get("orderbook_fp", {})
    yes_dollars = ob.get("yes_dollars", [])  # YES bids: [[price_str, qty_str], ...]
    no_dollars = ob.get("no_dollars", [])    # NO bids: [[price_str, qty_str], ...]

    # Best YES bid (highest price someone pays for YES)
    best_yes_bid: Optional[int] = None
    if yes_dollars:
        try:
            best_yes_bid = round(float(yes_dollars[0][0]) * 100)
        except (ValueError, IndexError):
            pass

    # Best NO bid → implies YES ask price (YES ask = 1 - best NO bid)
    best_yes_ask: Optional[int] = None
    if no_dollars:
        try:
            best_no_bid = float(no_dollars[0][0])
            best_yes_ask = round((1.0 - best_no_bid) * 100)
        except (ValueError, IndexError):
            pass

    # Need at least one side to compute mid-price
    if best_yes_bid is None and best_yes_ask is None:
        return None

    # Fill in missing side for one-sided markets
    if best_yes_bid is None:
        best_yes_bid = max(best_yes_ask - 1, 0)
    if best_yes_ask is None:
        best_yes_ask = min(best_yes_bid + 1, 99)

    if best_yes_bid >= best_yes_ask:
        return None

    return int(best_yes_bid), int(best_yes_ask)


def _classify_tier(
    implied_prob: float,
    spread_cents: int,
    volume: int,
    cfg: Config,
) -> Optional[str]:
    """Return the matching tier string or None if market fails all filters."""
    hp = cfg.filters.high_prob
    if (implied_prob >= hp.min_implied_prob
            and volume >= hp.min_volume
            and spread_cents <= hp.max_spread_cents):
        return "HIGH_PROB"

    v = cfg.filters.value
    if (v.min_implied_prob <= implied_prob < v.max_implied_prob
            and volume >= v.min_volume
            and spread_cents <= v.max_spread_cents):
        return "VALUE"

    t = cfg.filters.tail
    if (t.min_implied_prob <= implied_prob < t.max_implied_prob
            and volume >= t.min_volume):
        return "TAIL"

    return None


def _compute_ev(
    implied_prob: float,
    entry_cents: int,
    tier: str,
) -> float:
    """
    Expected value per dollar risked.
    EV = p * (100 - entry) - (1-p) * entry, normalized to per-dollar.
    Positive EV means edge over the market price.
    """
    win_payout = 100 - entry_cents
    loss_cost = entry_cents
    ev_cents = implied_prob * win_payout - (1 - implied_prob) * loss_cost
    return ev_cents / entry_cents if entry_cents > 0 else 0.0


def _score(
    implied_prob: float,
    spread_cents: int,
    volume: int,
    ev: float,
    tier: str,
) -> float:
    """Composite ranking score. Higher is better."""
    spread_factor = 1.0 / max(spread_cents, 0.5)  # avoid div-by-zero on tight spreads
    vol_factor = math.log(max(volume, 1))

    if tier == "HIGH_PROB":
        return 0.5 * implied_prob + 0.3 * spread_factor + 0.2 * vol_factor
    elif tier == "VALUE":
        return 0.6 * max(ev, 0) + 0.2 * spread_factor + 0.2 * vol_factor
    else:  # TAIL
        return 0.5 * max(ev, 0) + 0.3 * vol_factor + 0.2 * spread_factor


def _extract_series(ticker: str) -> str:
    """
    Extract series prefix from ticker.
    e.g. "KXBTCD-24MAR26-T68800" -> "KXBTCD-24MAR26"
    """
    parts = ticker.split("-")
    if len(parts) >= 2:
        return "-".join(parts[:2])
    return ticker


def _parse_expiry(market: dict) -> Optional[datetime]:
    """Parse market close time to UTC datetime."""
    close_time = market.get("close_time") or market.get("expiration_time")
    if not close_time:
        return None
    try:
        # Kalshi returns ISO 8601; strip trailing Z and parse
        if close_time.endswith("Z"):
            close_time = close_time[:-1] + "+00:00"
        return datetime.fromisoformat(close_time)
    except (ValueError, AttributeError):
        return None


def _build_label(market: dict) -> str:
    """Build a human-readable description from market data."""
    title = market.get("title", market.get("ticker", "Unknown"))
    return title[:60]  # cap length for notification readability


def analyze_markets(
    markets: List[dict],
    orderbooks: Dict[str, dict],
    cfg: Config,
) -> List[TradeCandidate]:
    """
    Score all markets and return ranked TradeCandidate list.
    Markets that fail filters are silently dropped.
    """
    now = datetime.now(timezone.utc)
    min_expiry = now.timestamp() + cfg.markets.min_expiry_hours * 3600
    max_expiry = now.timestamp() + cfg.markets.max_expiry_days * 86400

    candidates = []

    for market in markets:
        ticker = market.get("ticker", "")
        if not ticker:
            continue

        # Status: Kalshi returns "active" for open markets
        if market.get("status") not in ("open", "active"):
            continue

        # Expiry window check
        expiry = _parse_expiry(market)
        if expiry is None:
            continue
        expiry_ts = expiry.timestamp()
        if expiry_ts < min_expiry or expiry_ts > max_expiry:
            continue

        # Prices: use market-level fields (faster than fetching orderbooks)
        try:
            bid_cents = round(float(market.get("yes_bid_dollars") or 0) * 100)
            ask_cents = round(float(market.get("yes_ask_dollars") or 1) * 100)
        except (ValueError, TypeError):
            continue

        if bid_cents <= 0 or ask_cents <= 0 or bid_cents >= ask_cents:
            continue

        # Volume: use volume_fp from market object; fall back to open_interest_fp
        try:
            volume = int(float(market.get("volume_fp") or market.get("open_interest_fp") or 0))
        except (ValueError, TypeError):
            volume = 0

        # Augment volume with orderbook size if available
        ob = orderbooks.get(ticker)
        if ob:
            ob_fp = ob.get("orderbook_fp", {})
            try:
                yes_qty = sum(float(x[1]) for x in ob_fp.get("yes_dollars", []) if len(x) >= 2)
                no_qty = sum(float(x[1]) for x in ob_fp.get("no_dollars", []) if len(x) >= 2)
                volume = max(volume, int(yes_qty + no_qty))
            except (ValueError, TypeError):
                pass

        implied_prob = (bid_cents + ask_cents) / 200.0
        spread_cents = ask_cents - bid_cents

        tier = _classify_tier(implied_prob, spread_cents, volume, cfg)
        if tier is None:
            continue

        # Entry price: HIGH_PROB and TAIL buy at bid; VALUE accepts ask
        entry_cents = bid_cents if tier in ("HIGH_PROB", "TAIL") else ask_cents

        ev = _compute_ev(implied_prob, entry_cents, tier)

        # VALUE tier: enforce minimum EV edge
        if tier == "VALUE" and ev < cfg.filters.value.min_ev_edge:
            continue

        score = _score(implied_prob, spread_cents, volume, ev, tier)
        series = _extract_series(ticker)
        label = _build_label(market)

        candidates.append(TradeCandidate(
            ticker=ticker,
            series=series,
            side="yes",  # always buy YES (positive exposure)
            tier=tier,
            implied_prob=implied_prob,
            bid_cents=bid_cents,
            ask_cents=ask_cents,
            spread_cents=spread_cents,
            volume=volume,
            ev=ev,
            score=score,
            expiry=expiry,
            label=label,
        ))

    # Sort by tier priority then score
    tier_order = {"HIGH_PROB": 0, "VALUE": 1, "TAIL": 2}
    candidates.sort(key=lambda c: (tier_order[c.tier], -c.score))
    return candidates


def compute_position_size(
    entry_cents: int,
    budget_remaining: float,
    max_position_usd: float,
) -> int:
    """
    Compute contract count for a trade.
    Returns 0 if we can't afford even 1 contract.
    """
    alloc_usd = min(budget_remaining, max_position_usd)
    cost_per_contract = entry_cents / 100.0
    if cost_per_contract <= 0:
        return 0
    count = int(alloc_usd / cost_per_contract)
    # Ensure we can actually afford this many
    while count > 0 and (count * cost_per_contract) > budget_remaining:
        count -= 1
    return count


def select_trades(
    candidates: List[TradeCandidate],
    budget_usd: float,
    cfg: Config,
) -> List[TradeCandidate]:
    """
    Apply budget split, position limits, series diversification, and
    anti-contradictory-position rules. Returns the final trade list.
    Returns [] if total qualifying candidates < min_candidates.
    """
    if len(candidates) < cfg.budget.min_candidates:
        return []

    tier_budgets = {
        "HIGH_PROB": budget_usd * cfg.budget.tier_high_prob_pct,
        "VALUE": budget_usd * cfg.budget.tier_value_pct,
        "TAIL": budget_usd * cfg.budget.tier_tail_pct,
    }
    tier_remaining = dict(tier_budgets)

    series_count: Counter = Counter()
    selected_sides: Dict[str, str] = {}  # series -> side already selected
    selected: List[TradeCandidate] = []

    # Group by tier, sorted by score desc (already sorted by analyze_markets)
    by_tier: Dict[str, List[TradeCandidate]] = {"HIGH_PROB": [], "VALUE": [], "TAIL": []}
    for c in candidates:
        by_tier[c.tier].append(c)

    tier_sequence = ("HIGH_PROB", "VALUE", "TAIL")
    for i, tier in enumerate(tier_sequence):
        for candidate in by_tier[tier]:
            if tier_remaining[tier] < 0.01:
                break

            series = candidate.series

            # Per-series cap
            if series_count[series] >= cfg.budget.max_per_series:
                continue

            # No contradictory positions
            existing_side = selected_sides.get(series)
            if existing_side is not None and existing_side != candidate.side:
                continue

            # Entry price
            entry_cents = candidate.bid_cents if tier in ("HIGH_PROB", "TAIL") else candidate.ask_cents

            # Position size
            count = compute_position_size(
                entry_cents,
                tier_remaining[tier],
                cfg.budget.max_position_usd,
            )
            if count == 0:
                continue

            cost_usd = count * entry_cents / 100.0

            # Clone candidate with filled-in count and entry price
            trade = TradeCandidate(
                ticker=candidate.ticker,
                series=series,
                side=candidate.side,
                tier=tier,
                implied_prob=candidate.implied_prob,
                bid_cents=candidate.bid_cents,
                ask_cents=candidate.ask_cents,
                spread_cents=candidate.spread_cents,
                volume=candidate.volume,
                ev=candidate.ev,
                score=candidate.score,
                expiry=candidate.expiry,
                label=candidate.label,
                count=count,
                entry_price_cents=entry_cents,
            )
            selected.append(trade)
            tier_remaining[tier] -= cost_usd
            series_count[series] += 1
            selected_sides[series] = candidate.side

        # Roll any unused budget from this tier into the next
        if i < len(tier_sequence) - 1 and tier_remaining[tier] > 0.01:
            next_tier = tier_sequence[i + 1]
            tier_remaining[next_tier] += tier_remaining[tier]
            tier_remaining[tier] = 0.0

    return selected
