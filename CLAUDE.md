# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## General Rules

Always use shared project configurations (stored in git) rather than personal settings unless explicitly told otherwise.

## Version Control

Commit every logical change atomically so that `git log` stays clean and any change can be cleanly reverted with `git revert`. Do not bundle unrelated changes into a single commit, and do not leave a series of changes uncommitted until the end of a task.

Use the `/git-commit` skill when committing. It defines the canonical workflow.

## Architecture

This is a monorepo containing:

- **`ingest/`** — TypeScript pnpm workspace; data ingestion services for Kalshi and Binance. See `ingest/CLAUDE.md`.
- **`kalshi-trading/`** — Python; Kalshi trading service. See `kalshi-trading/CLAUDE.md`.
- **`binance-modeling/`** — Python; backtesting tool for model selection, run manually. See `binance-modeling/CLAUDE.md`.
- **`agents/`** — TypeScript; AI agents application.
- **`portfolio/`** — TypeScript; portfolio website.

## mise Tasks

Each subproject has a `mise.toml` with tasks. Run tasks from within the project directory:

```bash
mise run <task>
```

Or from the monorepo root using namespaced paths:

```bash
mise run //kalshi-trading:check
mise run //binance-modeling:run
mise run //ingest:dev:kalshi-orderbooks
mise run //agents:dev
mise run //portfolio:dev
```

Common tasks available in each project: `install`, `build`, `run`, `dev`, `check`, `format`, `format:check`, `lint`, `lint:check`, `typecheck` (where applicable).

## Docker & Deployment

Deployed services use a `debian:12-slim` base image, installing toolchains via mise at build time. Build contexts are always the monorepo root.

- **Ingest server:** `docker compose -f ingest/compose.yaml --env-file=.env up -d`
- **Trading server:** `docker compose -f kalshi-trading/compose.yaml --env-file=.env up -d`

Images are built and pushed to `ghcr.io/ashwin-mahadevan/monorepo/{service}:{sha}` on merge to master, then deployed via SSH to Hetzner VMs.

`binance-modeling` is not deployed — run it manually with `BINANCE_MODELING_DIR` pointing at your ingest data.
