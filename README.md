# Automated Prediction Market Trading Bot

A fully autonomous trading system that connects to the Kalshi prediction market API, analyzes market data in real-time, and executes trades using a quantitative strategy — all without human intervention.

## What It Does

- **Scans 500+ markets** across crypto (BTC, ETH, SOL), equities (S&P 500), and commodities (Gold, Oil)
- **Quantitative scoring engine** evaluates each market on implied probability, spread tightness, volume, and expected value
- **Automated trade execution** with position sizing, diversification rules, and daily budget caps
- **Real-time settlement monitoring** checks positions every 5 minutes
- **Push notifications** to mobile via ntfy.sh — instant alerts on wins, losses, and daily summaries
- **Portfolio tracker** monitors stock holdings and scans a watchlist for dip-buy opportunities
- **DCA reminder system** with Roth IRA contribution tracking

## Tech Stack

- **Python 3** — core application
- **RSA-PSS cryptographic authentication** — secure API signing (no passwords stored)
- **REST API integration** — full Kalshi v2 API client with rate limiting
- **cron scheduling** — multiple automated jobs running 24/7
- **Push notifications** — real-time mobile alerts via ntfy.sh
- **Yahoo Finance API** — stock price tracking and analysis

## Architecture

```
├── kalshi_client.py     # API client with RSA-PSS auth
├── strategy.py          # Quantitative trading strategy engine
├── bot.py               # Main trading bot (daily execution)
├── monitor.py           # Settlement monitor (runs every 5 min)
├── portfolio.py         # Stock portfolio tracker
├── dca_tracker.py       # Dollar-cost averaging reminder system
├── notifier.py          # Push notification system
└── logs/                # Trade logs, P&L history
```

## Strategy Engine

The bot uses a three-tier approach:

1. **High-Probability (55% of budget)** — 90%+ implied probability contracts with 1000+ volume and <2c spreads. Buys at bid for optimal entry. Consistent small wins.

2. **Value Zone (30% of budget)** — 30-55% implied probability with ultra-tight spreads (<2c) and 500+ volume. Only enters when expected value is clearly positive.

3. **Asymmetric Tails (15% of budget)** — 8-20% implied probability with high volume. Small position sizes with 5-10x payoff potential. One hit covers weeks of losses.

### Risk Management
- Daily budget cap with automatic scaling based on account balance
- Maximum position size per trade
- Per-series diversification limits
- Minimum candidate threshold — skips trading on low-edge days
- No contradictory positions (won't bet both sides)

## Sample Output

```
=== Daily Trading Run: 2026-03-24 ===
Available balance: $215.20
Today's budget: $50.00
Scanning for crypto & prediction markets...
Found 510 tradeable short-term markets

Selected 6 trades (total: $25.60):
  [HIGH_PROB] YES 5x BTC above $68.8K by 5pm @ 91c ($4.55) | win%=90%
  [HIGH_PROB] YES 5x BTC above $69.4K by 3pm @ 85c ($4.25) | win%=84%
  [HIGH_PROB] YES 6x ETH above $2,120 by 3pm @ 75c ($4.50) | win%=74%
  [VALUE]     YES 15x S&P 500 range 6550-6575 @ 32c ($4.80) | win%=32%
  [TAIL]      YES 22x SOL above $95 by Mar 27 @ 22c ($4.84) | win%=26%
  [TAIL]      YES 14x SOL above $96 by Mar 27 @ 19c ($2.66) | win%=21%

Trades placed: 6/6 | Failed: 0 | Total spent: $25.60
```

## Built For

This project demonstrates:
- Financial API integration with cryptographic authentication
- Quantitative analysis and automated decision-making
- Production-grade scheduling and monitoring
- Real-time notification systems
- Clean, maintainable Python architecture

---

*Built by Isa Khalid — available for custom automation, bot development, and API integration projects.*
