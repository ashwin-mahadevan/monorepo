"""Trading evaluation loop: edge detection, position management, order decisions."""

import asyncio
import logging
import math
from dataclasses import dataclass, field

import aiohttp

from binance import BinanceStream
from kalshi_api import KalshiApi, MarketInfo
from orderbook import Orderbook
from pricing import estimate_params, gbm_prob

log = logging.getLogger(__name__)


@dataclass
class TradingConfig:
    min_edge: float = 0.05  # minimum edge (0-1 scale) to place an order
    max_position_per_market: int = 100  # max net contracts per market
    max_order_size: int = 10  # max contracts per single order
    min_window_points: int = 3600  # min 1s closes before trading (1 hour)
    eval_interval_sec: float = 1.0
    dry_run: bool = True


@dataclass
class Trader:
    binance: BinanceStream
    api: KalshiApi
    config: TradingConfig
    # Shared state updated by kalshi_ws_loop and market_refresh_loop
    markets: dict[str, MarketInfo] = field(default_factory=dict)
    orderbooks: dict[str, Orderbook] = field(default_factory=dict)
    positions: dict[str, int] = field(default_factory=dict)

    async def run(self, session: aiohttp.ClientSession) -> None:
        """Periodic evaluation loop."""
        while True:
            await asyncio.sleep(self.config.eval_interval_sec)
            try:
                await self._evaluate(session)
            except Exception as e:
                log.warning("Evaluation error: %s", e)

    async def _evaluate(self, session: aiohttp.ClientSession) -> None:
        p0 = self.binance.latest_price
        if p0 is None:
            return

        closes = self.binance.get_closes_array()
        if len(closes) < self.config.min_window_points:
            log.debug(
                "Window too small (%d/%d), not trading yet.",
                len(closes),
                self.config.min_window_points,
            )
            return

        mu, sigma = estimate_params(closes)
        if math.isnan(mu) or math.isnan(sigma) or sigma <= 0:
            return

        for ticker, market in list(self.markets.items()):
            h_sec = KalshiApi.seconds_until_close(market)
            if h_sec <= 0:
                continue  # expired

            ob = self.orderbooks.get(ticker)
            if ob is None or not ob.initialized:
                continue

            # P(BTC > floor_strike at close_time)
            fair_value = gbm_prob(p0, market.floor_strike, mu, sigma, h_sec)
            if math.isnan(fair_value):
                continue

            best_yes_bid, best_no_bid = ob.top_of_book()

            # YES edge: buy YES if market is cheap vs fair value
            if best_no_bid is not None:
                best_yes_ask = 100 - best_no_bid  # cents
                yes_edge = fair_value - best_yes_ask / 100.0
                if yes_edge >= self.config.min_edge:
                    net_pos = self.positions.get(ticker, 0)
                    room = self.config.max_position_per_market - net_pos
                    order_size = min(self.config.max_order_size, room)
                    if order_size > 0:
                        log.info(
                            "[EDGE] %s YES  fair=%.3f market=%d¢ edge=%.3f size=%d",
                            ticker,
                            fair_value,
                            best_yes_ask,
                            yes_edge,
                            order_size,
                        )
                        await self.api.place_order(
                            session,
                            ticker,
                            side="yes",
                            count=order_size,
                            yes_price=best_yes_ask,
                            dry_run=self.config.dry_run,
                        )

            # NO edge: buy NO if market is cheap vs fair value
            if best_yes_bid is not None:
                best_no_ask = 100 - best_yes_bid  # cents
                no_fair = 1.0 - fair_value
                no_edge = no_fair - best_no_ask / 100.0
                if no_edge >= self.config.min_edge:
                    net_pos = self.positions.get(ticker, 0)
                    room = self.config.max_position_per_market + net_pos  # NO reduces YES position
                    order_size = min(self.config.max_order_size, room)
                    if order_size > 0:
                        log.info(
                            "[EDGE] %s NO   fair=%.3f market=%d¢ edge=%.3f size=%d",
                            ticker,
                            no_fair,
                            best_no_ask,
                            no_edge,
                            order_size,
                        )
                        await self.api.place_order(
                            session,
                            ticker,
                            side="no",
                            count=order_size,
                            yes_price=best_yes_bid,
                            dry_run=self.config.dry_run,
                        )
