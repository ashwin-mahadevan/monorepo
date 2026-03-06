"""
Kalshi BTCUSD binary options trading service.

Streams live Binance 1s klines, auto-discovers KXBTCD markets, monitors
Kalshi orderbooks, and places orders when GBM fair value diverges from
market price by more than MIN_EDGE.

Required env vars:
  KALSHI_ID    - Kalshi access key ID
  KALSHI_KEY   - RSA private key PEM
  DRY_RUN      - "true" (default) to log without placing orders; "false" to trade
  MIN_EDGE     - minimum edge threshold 0-1 (default 0.05)
  MAX_POSITION_PER_MARKET - max net contracts per market (default 100)
  MAX_ORDER_SIZE          - max contracts per order (default 10)
  WINDOW_SIZE             - rolling window in data points (default 86400 = 1 day)
"""

import asyncio
import json
import logging
import os
import signal

import aiohttp
import websockets
import websockets.asyncio.client

from auth import WEBSOCKET_PATH, make_auth_headers
from binance import BinanceStream
from kalshi_api import KalshiApi
from orderbook import Orderbook
from trader import Trader, TradingConfig

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

KALSHI_WS_URL = "wss://api.elections.kalshi.com/trade-api/ws/v2"
MARKET_REFRESH_INTERVAL = 300.0  # seconds between market discovery
POSITION_SYNC_INTERVAL = 30.0  # seconds between position sync


def require_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return value


def load_config() -> TradingConfig:
    return TradingConfig(
        min_edge=float(os.environ.get("MIN_EDGE", "0.05")),
        max_position_per_market=int(os.environ.get("MAX_POSITION_PER_MARKET", "100")),
        max_order_size=int(os.environ.get("MAX_ORDER_SIZE", "10")),
        dry_run=os.environ.get("DRY_RUN", "true").lower() != "false",
    )


async def kalshi_ws_loop(trader: Trader, kalshi_id: str, private_key_pem: str) -> None:
    """Connect to Kalshi WebSocket and feed orderbook updates into trader.orderbooks."""
    while True:
        tickers = list(trader.markets.keys())
        if not tickers:
            await asyncio.sleep(5)
            continue

        # Reset orderbooks for the current set of tickers
        trader.orderbooks = {t: Orderbook(ticker=t) for t in tickers}

        try:
            headers = make_auth_headers(kalshi_id, private_key_pem, "GET", WEBSOCKET_PATH)
            async with websockets.asyncio.client.connect(
                KALSHI_WS_URL, additional_headers=headers
            ) as ws:
                log.info("Connected to Kalshi WebSocket (%d tickers).", len(tickers))
                cmd = {
                    "id": 1,
                    "cmd": "subscribe",
                    "params": {"channels": ["orderbook_delta"], "market_tickers": tickers},
                }
                await ws.send(json.dumps(cmd))
                raw = await ws.recv()
                resp = json.loads(raw)
                if resp.get("type") != "subscribed":
                    raise RuntimeError(f"Unexpected subscribe response: {resp}")
                log.info("Subscribed to orderbook_delta.")

                async for raw_msg in ws:
                    msg = json.loads(raw_msg)
                    msg_type = msg.get("type")
                    payload = msg.get("msg", {})
                    ticker = payload.get("market_ticker")

                    if msg_type == "orderbook_snapshot":
                        ob = trader.orderbooks.get(ticker)
                        if ob:
                            ob.apply_snapshot(payload)
                    elif msg_type == "orderbook_delta":
                        ob = trader.orderbooks.get(ticker)
                        if ob:
                            ob.apply_delta(payload)
        except Exception as e:
            log.warning("Kalshi WS error: %s. Reconnecting in 5s.", e)
            await asyncio.sleep(5)


async def market_refresh_loop(
    trader: Trader, api: KalshiApi, session: aiohttp.ClientSession
) -> None:
    """Periodically refresh the set of active KXBTCD markets."""
    while True:
        try:
            markets = await api.fetch_btcusd_markets(session)
            trader.markets = {m.ticker: m for m in markets}
        except Exception as e:
            log.warning("Market refresh failed: %s", e)
        await asyncio.sleep(MARKET_REFRESH_INTERVAL)


async def position_sync_loop(
    trader: Trader, api: KalshiApi, session: aiohttp.ClientSession
) -> None:
    """Periodically sync positions from the REST API."""
    while True:
        await asyncio.sleep(POSITION_SYNC_INTERVAL)
        try:
            trader.positions = await api.get_positions(session)
            log.debug("Position sync: %d positions.", len(trader.positions))
        except Exception as e:
            log.warning("Position sync failed: %s", e)


async def main() -> None:
    kalshi_id = require_env("KALSHI_ID")
    private_key_pem = require_env("KALSHI_KEY")
    config = load_config()
    window_size = int(os.environ.get("WINDOW_SIZE", "86400"))

    log.info(
        "Starting: dry_run=%s min_edge=%.2f max_order_size=%d",
        config.dry_run,
        config.min_edge,
        config.max_order_size,
    )

    binance = BinanceStream(window_size=window_size)
    api = KalshiApi(kalshi_id, private_key_pem)
    trader = Trader(binance=binance, api=api, config=config)

    loop = asyncio.get_running_loop()
    stop = loop.create_future()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set_result, None)

    async with aiohttp.ClientSession() as session:
        # Initial market discovery before starting other tasks
        try:
            markets = await api.fetch_btcusd_markets(session)
            trader.markets = {m.ticker: m for m in markets}
        except Exception as e:
            log.error("Initial market discovery failed: %s", e)

        tasks = [
            asyncio.create_task(binance.run()),
            asyncio.create_task(kalshi_ws_loop(trader, kalshi_id, private_key_pem)),
            asyncio.create_task(market_refresh_loop(trader, api, session)),
            asyncio.create_task(position_sync_loop(trader, api, session)),
            asyncio.create_task(trader.run(session)),
        ]

        done, pending = await asyncio.wait(
            [*tasks, asyncio.ensure_future(stop)],
            return_when=asyncio.FIRST_COMPLETED,
        )

        log.info("Shutting down...")
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)

        # Re-raise if a task crashed
        for task in done:
            if task != stop and not task.cancelled():
                task.result()


if __name__ == "__main__":
    asyncio.run(main())
