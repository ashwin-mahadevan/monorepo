"""Kalshi REST API client: market discovery and order placement."""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

import aiohttp

from auth import make_auth_headers

log = logging.getLogger(__name__)

BASE_URL = "https://api.elections.kalshi.com/trade-api/v2"
SERIES_TICKER = "KXBTCD"


@dataclass
class MarketInfo:
    ticker: str
    event_ticker: str
    floor_strike: float  # price threshold for YES settlement
    close_time: datetime  # when trading closes
    strike_type: str  # "greater" means YES if price > floor_strike


class KalshiApi:
    def __init__(self, kalshi_id: str, private_key_pem: str) -> None:
        self._id = kalshi_id
        self._key = private_key_pem

    def _auth_headers(self, method: str, path: str) -> dict[str, str]:
        return make_auth_headers(self._id, self._key, method=method, path=path)

    async def fetch_btcusd_markets(self, session: aiohttp.ClientSession) -> list[MarketInfo]:
        """Return all active KXBTCD binary markets."""
        path = "/trade-api/v2/markets"
        markets: list[MarketInfo] = []
        cursor: str | None = None

        while True:
            params: dict[str, str] = {
                "series_ticker": SERIES_TICKER,
                "status": "active",
                "limit": "200",
            }
            if cursor:
                params["cursor"] = cursor

            headers = self._auth_headers("GET", path)
            async with session.get(BASE_URL + "/markets", headers=headers, params=params) as resp:
                resp.raise_for_status()
                data = await resp.json()

            for m in data.get("markets", []):
                if m.get("market_type") != "binary":
                    continue
                floor = m.get("floor_strike")
                close_raw = m.get("close_time")
                if floor is None or not close_raw:
                    continue
                close_time = datetime.fromisoformat(close_raw.replace("Z", "+00:00"))
                markets.append(
                    MarketInfo(
                        ticker=m["ticker"],
                        event_ticker=m["event_ticker"],
                        floor_strike=float(floor),
                        close_time=close_time,
                        strike_type=m.get("strike_type", "greater"),
                    )
                )

            cursor = data.get("cursor") or None
            if not cursor:
                break

        log.info("Discovered %d active KXBTCD markets.", len(markets))
        return markets

    async def place_order(
        self,
        session: aiohttp.ClientSession,
        ticker: str,
        side: str,
        count: int,
        yes_price: int,
        dry_run: bool = True,
    ) -> dict | None:
        """
        Place a limit buy order. side is 'yes' or 'no'.
        yes_price is in cents (1-99).
        Returns the order response dict, or None in dry-run mode.
        """
        path = "/trade-api/v2/portfolio/orders"
        body = {
            "ticker": ticker,
            "side": side,
            "action": "buy",
            "count": count,
            "yes_price": yes_price,
            "time_in_force": "good_till_canceled",
        }

        if dry_run:
            log.info(
                "[DRY RUN] Would place order: ticker=%s side=%s count=%d yes_price=%d¢",
                ticker,
                side,
                count,
                yes_price,
            )
            return None

        headers = self._auth_headers("POST", path)
        async with session.post(BASE_URL + "/orders", headers=headers, json=body) as resp:
            resp.raise_for_status()
            result: dict = await resp.json()
        log.info("Order placed: %s", result)
        return result

    async def get_positions(self, session: aiohttp.ClientSession) -> dict[str, int]:
        """Return {ticker: net_position} for all current positions."""
        path = "/trade-api/v2/portfolio/positions"
        headers = self._auth_headers("GET", path)
        positions: dict[str, int] = {}
        cursor: str | None = None

        while True:
            params: dict[str, str] = {"limit": "200"}
            if cursor:
                params["cursor"] = cursor

            async with session.get(
                BASE_URL + "/portfolio/positions", headers=headers, params=params
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()

            for p in data.get("market_positions", []):
                ticker = p.get("ticker", "")
                net = int(p.get("position", 0))
                if net != 0:
                    positions[ticker] = net

            cursor = data.get("cursor") or None
            if not cursor:
                break

        return positions

    async def get_balance(self, session: aiohttp.ClientSession) -> float:
        """Return available balance in dollars."""
        path = "/trade-api/v2/portfolio/balance"
        headers = self._auth_headers("GET", path)
        async with session.get(BASE_URL + "/portfolio/balance", headers=headers) as resp:
            resp.raise_for_status()
            data = await resp.json()
        balance_str: str = data.get("balance", "0.0000")
        return float(balance_str)

    @staticmethod
    def seconds_until_close(market: MarketInfo) -> float:
        now = datetime.now(tz=timezone.utc)
        return (market.close_time - now).total_seconds()
