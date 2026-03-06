# binance-modeling/CLAUDE.md

Python service for Binance market data modeling.

## Commands

All commands use `mise run` from within `binance-modeling/` (or `mise run //binance-modeling:<task>` from the monorepo root).

**Install dependencies:**
```bash
mise run install
```

**Format/lint/typecheck:**
```bash
mise run format:check
mise run lint:check
mise run typecheck
mise run check        # runs all three
```

**Auto-fix:**
```bash
mise run format
mise run lint
```

**Run locally:**
```bash
mise run run
```

## Architecture

Standalone analysis tool — not deployed. Run manually against data collected by the ingest server.

- `src/main.py`: Entry point. Reads `BTCUSDT-1s-*.zip` kline files, backtests GBM and Empirical pricing models across multiple horizons and moneyness levels, and prints a comparison table of Brier score, log loss, and calibration to stdout.
