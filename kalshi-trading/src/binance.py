"""Binance WebSocket 1s kline stream for BTCUSDT."""

import asyncio
import json
import logging
from collections import deque

import numpy as np
import numpy.typing as npt
import websockets
import websockets.asyncio.client

log = logging.getLogger(__name__)

BINANCE_WS_URL = "wss://stream.binance.com:9443/ws/btcusdt@kline_1s"
RECONNECT_DELAY_MAX = 60.0


class BinanceStream:
    """Streams live 1s BTCUSDT klines from Binance WebSocket."""

    def __init__(self, window_size: int = 86400) -> None:
        self.closes: deque[float] = deque(maxlen=window_size)
        self.latest_price: float | None = None

    def get_closes_array(self) -> npt.NDArray[np.float64]:
        """Return current rolling window as a numpy array."""
        return np.array(self.closes, dtype=np.float64)

    async def run(self) -> None:
        delay = 1.0
        while True:
            try:
                async with websockets.asyncio.client.connect(BINANCE_WS_URL) as ws:
                    log.info("Connected to Binance kline stream.")
                    delay = 1.0
                    async for raw in ws:
                        msg = json.loads(raw)
                        kline = msg.get("k", {})
                        close = float(kline["c"])
                        self.latest_price = close
                        if kline.get("x"):
                            # Kline is closed — append to rolling window
                            self.closes.append(close)
            except Exception as e:
                log.warning("Binance stream disconnected: %s. Reconnecting in %.1fs.", e, delay)
                await asyncio.sleep(delay)
                delay = min(delay * 2, RECONNECT_DELAY_MAX)
