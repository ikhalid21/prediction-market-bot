"""
Central configuration module. Load config.json once at startup.
All other modules import load_config() from here.
"""

import json
import sys
from dataclasses import dataclass, field
from typing import List


@dataclass
class HighProbFilterConfig:
    min_implied_prob: float
    min_volume: int
    max_spread_cents: int


@dataclass
class ValueFilterConfig:
    min_implied_prob: float
    max_implied_prob: float
    min_volume: int
    max_spread_cents: int
    min_ev_edge: float


@dataclass
class TailFilterConfig:
    min_implied_prob: float
    max_implied_prob: float
    min_volume: int


@dataclass
class FilterConfig:
    high_prob: HighProbFilterConfig
    value: ValueFilterConfig
    tail: TailFilterConfig


@dataclass
class BudgetConfig:
    daily_cap_usd: float
    balance_pct: float
    tier_high_prob_pct: float
    tier_value_pct: float
    tier_tail_pct: float
    max_position_usd: float
    min_candidates: int
    max_per_series: int


@dataclass
class MarketsConfig:
    event_series: List[str]
    max_expiry_days: int
    min_expiry_hours: float


@dataclass
class PortfolioConfig:
    watchlist: List[str]
    dip_threshold_pct: float


@dataclass
class DcaConfig:
    monthly_amount_usd: float
    roth_ira_annual_limit: float
    roth_ira_contributed: float


@dataclass
class LoggingConfig:
    log_dir: str
    trade_log_file: str
    pnl_log_file: str
    run_log_file: str


@dataclass
class Config:
    api_key_id: str
    private_key_path: str
    ntfy_topic: str
    ntfy_server: str
    budget: BudgetConfig
    filters: FilterConfig
    markets: MarketsConfig
    portfolio: PortfolioConfig
    dca: DcaConfig
    logging: LoggingConfig


def load_config(path: str = "config.json") -> Config:
    """Load and validate config.json. Fails fast with a clear error."""
    try:
        with open(path, "r") as f:
            d = json.load(f)
    except FileNotFoundError:
        sys.exit(f"[config] ERROR: {path} not found. Copy config.json.example and fill in your credentials.")
    except json.JSONDecodeError as e:
        sys.exit(f"[config] ERROR: {path} is not valid JSON: {e}")

    try:
        flt = d["filters"]
        cfg = Config(
            api_key_id=d["api_key_id"],
            private_key_path=d["private_key_path"],
            ntfy_topic=d["ntfy_topic"],
            ntfy_server=d.get("ntfy_server", "https://ntfy.sh"),
            budget=BudgetConfig(**d["budget"]),
            filters=FilterConfig(
                high_prob=HighProbFilterConfig(**flt["high_prob"]),
                value=ValueFilterConfig(**flt["value"]),
                tail=TailFilterConfig(**flt["tail"]),
            ),
            markets=MarketsConfig(**d["markets"]),
            portfolio=PortfolioConfig(**d["portfolio"]),
            dca=DcaConfig(**d["dca"]),
            logging=LoggingConfig(**d["logging"]),
        )
    except KeyError as e:
        sys.exit(f"[config] ERROR: Missing required config field: {e}")
    except TypeError as e:
        sys.exit(f"[config] ERROR: Invalid config structure: {e}")

    return cfg
