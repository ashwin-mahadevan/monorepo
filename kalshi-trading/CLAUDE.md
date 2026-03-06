# kalshi-trading/CLAUDE.md

Python service for Kalshi binary options trading.

## Commands

All commands use `mise run` from within `kalshi-trading/` (or `mise run //kalshi-trading:<task>` from the monorepo root).

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

Standalone Python package (not a uv workspace). Dependencies managed via `pyproject.toml` + `uv.lock`.

- `src/main.py`: Entry point
- Dependencies: `websockets`, `cryptography`
