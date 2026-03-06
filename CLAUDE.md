# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## General Rules

Always use shared project configurations (stored in git) rather than personal settings unless explicitly told otherwise.

The Bash working directory should stay at the monorepo root. Use relative paths instead of `cd`. Do not use compound commands like `cd subdir && command`; instead, run subdir commands from the root (e.g. `pnpm --dir ghactivity run typecheck`). If a command unavoidably changes the working directory, run a separate follow-up `cd` back to the monorepo root.

## Version Control

Commit every logical change atomically so that `git log` stays clean and any change can be cleanly reverted with `git revert`. Do not bundle unrelated changes into a single commit, and do not leave a series of changes uncommitted until the end of a task.

Use the `/git-commit` skill when committing. It defines the canonical workflow and must be followed every time without exception.

When deleting files, use `rm` (not `git rm`). Staging is a separate concern handled by `git add` inside the skill invocation.

## Architecture

This is a monorepo containing:

- **`ingest/`** — TypeScript pnpm workspace; data ingestion services for Kalshi and Binance.
- **`kalshi-trading/`** — Python; Kalshi trading service.
- **`binance-modeling/`** — Python; backtesting tool for model selection, run manually.
- **`agents/`** — TypeScript; AI agents application.
- **`portfolio/`** — TypeScript; portfolio website.

## mise Tasks

Each subproject has a `mise.toml` with tasks. Run tasks from within the project directory:

```bash
mise run <task>
```

Or from the monorepo root using `//subdir:task` (no `run`):

```bash
mise //kalshi-trading:check
mise //binance-modeling:run
mise //ingest:dev:kalshi-orderbooks
mise //agents:dev
mise //portfolio:dev
```

Run all tasks of the same name across every project at once:

```bash
mise //...:check
```

Common tasks available in each project: `install`, `build`, `run`, `dev`, `check`, `format`, `format:check`, `lint`, `lint:check`, `typecheck` (where applicable).

## Docker & Deployment

Deployed services use a `debian:12-slim` base image, installing toolchains via mise at build time. Build contexts are always the monorepo root.

- **Ingest server:** `docker compose -f ingest/compose.yaml --env-file=.env up -d`
- **Trading server:** `docker compose -f kalshi-trading/compose.yaml --env-file=.env up -d`

Images are built and pushed to `ghcr.io/ashwin-mahadevan/monorepo/{service}:{sha}` on merge to master, then deployed via SSH to Hetzner VMs.

`binance-modeling` is not deployed — run it manually with `BINANCE_MODELING_DIR` pointing at your ingest data.

## ingest/

TypeScript pnpm workspace providing data ingestion services for Kalshi and Binance.

### Commands

All commands use `mise run` from within `ingest/` (or `mise //ingest:<task>` from the monorepo root).

```bash
mise run install
mise run build
mise run typecheck
mise run format:check   # check formatting
mise run format         # auto-fix formatting
mise run lint:check     # check linting
mise run lint           # auto-fix linting
mise run check          # run all checks (format + lint + typecheck)
mise run dev:binance-archive
mise run dev:kalshi-trades
mise run dev:kalshi-orderbooks
```

### Architecture

**@firm/common** (`common/`): Shared utilities — `env.ts` provides `requireEnv`, `requireInt`.

**binance/archive**: Batch downloader of historical Binance market data (KLINE and aggregated trades) from the Binance Vision public data API.
- Iterates over configurable date range (`START_DATE`/`END_DATE`, defaulting to 2017–yesterday)
- Downloads monthly then daily files for BTCUSDT, ETHUSDT, SOLUSDT
- Verifies SHA256 checksums and deletes them after
- Uses system `curl --parallel` with `--parallel-max` sized by `CURL_CONCURRENCY`
- Output: `BINANCE_INGEST_DIR/{klines,trades}/`
- Required env: `BINANCE_INGEST_DIR`, `CURL_CONCURRENCY` (defaults to 16 in Docker Compose)

**kalshi/trades**: Batch downloader of historical Kalshi trades via REST API.
- Cursor-based pagination; archives to timestamped gzip-compressed JSONL
- Required env: `KALSHI_TRADES_DIR`
- Output: `{YYYY-MM-DD}_{HH-MM-SS.mmm}/trades.jsonl.gz`

**kalshi/orderbooks**: Real-time streaming ingestion from Kalshi WebSocket API.
- RSA-SHA256 authentication with PSS padding using `KALSHI_ID` + `KALSHI_KEY` PEM private key
- Subscribes to `trade` channel; dynamically subscribes to `orderbook_delta` for new tickers
- Three concurrent tasks: receive loop, resubscribe loop (1s), rate logger (1s)
- Graceful shutdown on SIGINT/SIGTERM
- Required env: `KALSHI_ID`, `KALSHI_KEY`, `KALSHI_INGEST_DIR`
- Output: `{YYYY-MM-DD}_{HH-MM-SS.mmm}/{series}/{event}/{market}.jsonl.gz`

## kalshi-trading/

Python service for Kalshi binary options trading.

### Commands

All commands use `mise run` from within `kalshi-trading/` (or `mise //kalshi-trading:<task>` from the monorepo root).

```bash
mise run install
mise run format:check
mise run lint:check
mise run typecheck
mise run check        # runs all three
mise run format
mise run lint
mise run run
```

### Architecture

Standalone Python package (not a uv workspace). Dependencies managed via `pyproject.toml` + `uv.lock`.

- `src/main.py`: Orchestrator — runs 5 concurrent asyncio tasks (Binance stream, Kalshi WS, market refresh, position sync, trading loop)
- `src/auth.py`: RSA-SHA256 PSS signing for Kalshi WebSocket and REST requests
- `src/orderbook.py`: Kalshi orderbook state (snapshot + delta application)
- `src/binance.py`: Binance.US WebSocket 1s kline stream into a rolling price deque
- `src/pricing.py`: GBM binary option pricing (`gbm_prob`, `estimate_params`)
- `src/kalshi_api.py`: Kalshi REST client — discovers KXBTCD markets, places orders, syncs positions
- `src/trader.py`: Edge detection and order sizing logic
- Dependencies: `websockets`, `cryptography`, `numpy`, `scipy`, `aiohttp`

## binance-modeling/

Python service for Binance market data modeling. Not deployed — run manually against data collected by the ingest server.

### Commands

All commands use `mise run` from within `binance-modeling/` (or `mise //binance-modeling:<task>` from the monorepo root).

```bash
mise run install
mise run format:check
mise run lint:check
mise run typecheck
mise run check        # runs all three
mise run format
mise run lint
mise run run
```

### Architecture

- `src/main.py`: Entry point. Reads `BTCUSDT-1s-*.zip` kline files, backtests GBM and Empirical pricing models across multiple horizons and moneyness levels, and prints a comparison table of Brier score, log loss, and calibration to stdout.
