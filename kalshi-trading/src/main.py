"""
Kalshi trading service.

Connects to the Kalshi WebSocket API, subscribes to orderbook_delta for
configured tickers, tracks current orderbook state, and logs the top-of-book
quote to the console on every incoming message.

Required env vars:
  KALSHI_ID    - Kalshi access key ID
  KALSHI_KEY   - RSA private key PEM
  KALSHI_TICKERS - comma-separated list of market tickers to track
"""

import asyncio
import json
import logging
import os
import signal

import websockets
import websockets.asyncio.client

from auth import make_auth_headers
from orderbook import Orderbook

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

WEBSOCKET_URL = "wss://api.elections.kalshi.com/trade-api/ws/v2"


def require_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return value


async def run(tickers: list[str], kalshi_id: str, private_key_pem: str) -> None:
    headers = make_auth_headers(kalshi_id, private_key_pem)
    orderbooks: dict[str, Orderbook] = {t: Orderbook(ticker=t) for t in tickers}
    command_id = 1

    async with websockets.asyncio.client.connect(WEBSOCKET_URL, additional_headers=headers) as ws:
        log.info("Connected to Kalshi WebSocket.")

        # Subscribe to orderbook_delta for our tickers
        subscribe_cmd = {
            "id": command_id,
            "cmd": "subscribe",
            "params": {"channels": ["orderbook_delta"], "market_tickers": tickers},
        }
        command_id += 1
        await ws.send(json.dumps(subscribe_cmd))

        # Wait for subscribed ack
        raw = await ws.recv()
        resp = json.loads(raw)
        if resp.get("type") != "subscribed":
            raise RuntimeError(f"Unexpected response to subscribe: {resp}")
        log.info("Subscribed to orderbook_delta for %d tickers.", len(tickers))

        async for raw_msg in ws:
            msg = json.loads(raw_msg)
            msg_type = msg.get("type")
            payload = msg.get("msg", {})
            ticker = payload.get("market_ticker")

            if msg_type == "orderbook_snapshot":
                if ticker not in orderbooks:
                    log.warning("Snapshot for unknown ticker %r — ignoring.", ticker)
                    continue
                orderbooks[ticker].apply_snapshot(payload)

            elif msg_type == "orderbook_delta":
                if ticker not in orderbooks:
                    log.warning("Delta for unknown ticker %r — ignoring.", ticker)
                    continue
                orderbooks[ticker].apply_delta(payload)

            else:
                log.debug("Ignoring message type %r", msg_type)
                continue

            ob = orderbooks[ticker]
            best_yes, best_no = ob.top_of_book()
            log.info(
                "[%s] best_yes=%s best_no=%s",
                ticker,
                f"{best_yes}¢" if best_yes is not None else "—",
                f"{best_no}¢" if best_no is not None else "—",
            )


async def main() -> None:
    kalshi_id = require_env("KALSHI_ID")
    private_key_pem = require_env("KALSHI_KEY")
    tickers = [t.strip() for t in require_env("KALSHI_TICKERS").split(",") if t.strip()]

    if not tickers:
        raise RuntimeError("KALSHI_TICKERS must contain at least one ticker")

    log.info("Tracking %d tickers: %s", len(tickers), tickers)

    loop = asyncio.get_running_loop()
    stop = loop.create_future()

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set_result, None)

    task = asyncio.create_task(run(tickers, kalshi_id, private_key_pem))

    done, _ = await asyncio.wait(
        [task, asyncio.ensure_future(stop)],
        return_when=asyncio.FIRST_COMPLETED,
    )

    if task in done:
        task.result()  # re-raise any exception
    else:
        log.info("Shutdown signal received.")
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


if __name__ == "__main__":
    asyncio.run(main())
