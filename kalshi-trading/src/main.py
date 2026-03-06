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
import base64
import json
import logging
import os
import signal
import time
from dataclasses import dataclass, field

import websockets
import websockets.asyncio.client
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

WEBSOCKET_URL = "wss://api.elections.kalshi.com/trade-api/ws/v2"
WEBSOCKET_PATH = "/trade-api/ws/v2"


def require_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return value


def make_auth_headers(kalshi_id: str, private_key_pem: str) -> dict[str, str]:
    timestamp = str(int(time.time() * 1000))
    message = (timestamp + "GET" + WEBSOCKET_PATH).encode()

    loaded = serialization.load_pem_private_key(private_key_pem.encode(), password=None)
    if not isinstance(loaded, RSAPrivateKey):
        raise RuntimeError("KALSHI_KEY must be an RSA private key")
    signature = loaded.sign(
        message,
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=32,
        ),
        hashes.SHA256(),
    )

    return {
        "KALSHI-ACCESS-KEY": kalshi_id,
        "KALSHI-ACCESS-SIGNATURE": base64.b64encode(signature).decode(),
        "KALSHI-ACCESS-TIMESTAMP": timestamp,
    }


@dataclass
class Orderbook:
    """Tracks orderbook state for a single market."""

    ticker: str
    # price (1-99 cents) -> quantity
    yes: dict[int, int] = field(default_factory=dict)
    no: dict[int, int] = field(default_factory=dict)
    initialized: bool = False

    def apply_snapshot(self, msg: dict) -> None:  # type: ignore[type-arg]
        self.yes = {price: qty for price, qty in msg.get("yes", [])}
        self.no = {price: qty for price, qty in msg.get("no", [])}
        self.initialized = True

    def apply_delta(self, msg: dict) -> None:  # type: ignore[type-arg]
        if not self.initialized:
            raise RuntimeError(f"Delta received before snapshot for ticker {self.ticker!r}")
        side = self.yes if msg["side"] == "yes" else self.no
        price: int = msg["price"]
        delta: int = msg["delta"]
        new_qty = side.get(price, 0) + delta
        if new_qty <= 0:
            side.pop(price, None)
        else:
            side[price] = new_qty

    def top_of_book(self) -> tuple[int | None, int | None]:
        """Returns (best_yes_bid, best_no_bid) in cents."""
        best_yes = max(self.yes) if self.yes else None
        best_no = max(self.no) if self.no else None
        return best_yes, best_no


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
