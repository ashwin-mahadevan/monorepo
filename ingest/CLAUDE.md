# ingest/CLAUDE.md

TypeScript pnpm workspace providing data ingestion services for Kalshi and Binance.

## Commands

All commands use `mise run` from within `ingest/` (or `mise run //ingest:<task>` from the monorepo root).

**Install dependencies:**
```bash
mise run install
```

**Build all packages:**
```bash
mise run build
```

**Type check:**
```bash
mise run typecheck
```

**Format/lint:**
```bash
mise run format:check   # check formatting
mise run format         # auto-fix formatting
mise run lint:check     # check linting
mise run lint           # auto-fix linting
mise run check          # run all checks (format + lint + typecheck)
```

**Run a service locally (development):**
```bash
mise run dev:binance-archive
mise run dev:kalshi-trades
mise run dev:kalshi-orderbooks
```

## Architecture

### @firm/common (common/)

Shared utilities package:
- `env.ts`: Environment variable validation (`requireEnv`, `requireInt`)

### binance/archive

Batch downloader of historical Binance market data (KLINE and aggregated trades) from the Binance Vision public data API:
- Iterates over configurable date range (`START_DATE`/`END_DATE`, defaulting to 2017–yesterday)
- Downloads monthly then daily files for three trading pairs (BTCUSDT, ETHUSDT, SOLUSDT)
- Verifies SHA256 checksums and deletes them after
- Uses system `curl --parallel` with `--parallel-max` sized by `CURL_CONCURRENCY`
- Organizes files into `BINANCE_INGEST_DIR/{klines,trades}/` subdirectories

Required env vars: `BINANCE_INGEST_DIR`, `CURL_CONCURRENCY` (defaults to 16 in Docker Compose)

Output structure:
- `klines/{SYMBOL}-1s-{YYYY}-{MM}[-{DD}].zip`
- `trades/{SYMBOL}-aggTrades-{YYYY}-{MM}[-{DD}].zip`

### kalshi/trades

Batch downloader of historical Kalshi trades via REST API:
- Cursor-based pagination to fetch complete trade history
- Archives to timestamped gzip-compressed JSONL
- Public endpoint (no authentication)

Required env vars: `KALSHI_TRADES_DIR`

Output structure: `{YYYY-MM-DD}_{HH-MM-SS.mmm}/trades.jsonl.gz`

### kalshi/orderbooks

Real-time streaming ingestion from Kalshi WebSocket API (`wss://api.elections.kalshi.com/trade-api/ws/v2`):
- **RSA-SHA256 authentication** with PSS padding (MGF1-SHA256, salt=32) using `KALSHI_ID` + `KALSHI_KEY` PEM private key
- Subscribes to `trade` channel; dynamically subscribes to `orderbook_delta` for new tickers
- Three concurrent tasks: receive loop, resubscribe loop (1s interval), rate logger (1s interval)
- Graceful shutdown on SIGINT/SIGTERM

Required env vars: `KALSHI_ID`, `KALSHI_KEY`, `KALSHI_INGEST_DIR`

Output structure: `{YYYY-MM-DD}_{HH-MM-SS.mmm}/{series}/{event}/{market}.jsonl.gz`
