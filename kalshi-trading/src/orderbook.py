"""Orderbook state management for a single Kalshi market."""

from dataclasses import dataclass, field


@dataclass
class Orderbook:
    """Tracks orderbook state for a single market."""

    ticker: str
    # price (1-99 cents) -> quantity
    yes: dict[int, int] = field(default_factory=dict)
    no: dict[int, int] = field(default_factory=dict)
    initialized: bool = False

    def apply_snapshot(self, msg: dict) -> None:
        self.yes = {price: qty for price, qty in msg.get("yes", [])}
        self.no = {price: qty for price, qty in msg.get("no", [])}
        self.initialized = True

    def apply_delta(self, msg: dict) -> None:
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
