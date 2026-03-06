"""
Backtest GBM and Empirical models for Kalshi binary options on BTCUSDT.

For each horizon H and moneyness level K/P0, we estimate:
  P(P_H > K | P_0)
using two models fit on a rolling 30-day window of 1s kline closes, then
compute Brier score, log loss, and calibration vs actual outcomes.

Output is an ASCII table printed to stdout, suitable for reading via docker logs.
"""

from __future__ import annotations

import io
import os
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import numpy.typing as npt
import scipy.stats  # type: ignore[import-untyped]

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

HORIZONS_SEC: dict[str, int] = {
    "5min": 300,
    "15min": 900,
    "30min": 1800,
    "1hr": 3600,
    "4hr": 14400,
    "1day": 86400,
}

MONEYNESS_LEVELS: list[float] = [0.96, 0.97, 0.98, 0.99, 1.00, 1.01, 1.02, 1.03, 1.04]

LOOKBACK_DAYS: int = 30
LOOKBACK_SEC: int = LOOKBACK_DAYS * 86400

# Minimum data points required in the window to make a prediction
MIN_WINDOW_POINTS: int = 1000

# Step size between evaluation points (every 5 minutes to keep runtime manageable)
EVAL_STEP_SEC: int = 300

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def load_closes(data_dir: str) -> npt.NDArray[np.float64]:
    """
    Read all BTCUSDT-1s-*.zip files from data_dir and return a sorted
    (N, 2) array of [timestamp_sec, close_price].

    Kline CSV columns (no header):
      open_time_ms, open, high, low, close, volume, close_time_ms,
      quote_vol, count, taker_buy_vol, taker_buy_quote_vol, ignore
    """
    path = Path(data_dir)
    zip_files = sorted(path.glob("BTCUSDT-1s-*.zip"))
    if not zip_files:
        raise FileNotFoundError(f"No BTCUSDT-1s-*.zip files found in {data_dir}")

    print(f"Loading {len(zip_files)} zip files from {data_dir} ...", flush=True)

    chunks: list[npt.NDArray[np.float64]] = []
    for zf_path in zip_files:
        with zipfile.ZipFile(zf_path) as zf:
            csv_names = [n for n in zf.namelist() if n.endswith(".csv")]
            if not csv_names:
                continue
            with zf.open(csv_names[0]) as f:
                data = np.loadtxt(
                    io.TextIOWrapper(f, encoding="utf-8"),
                    delimiter=",",
                    usecols=(0, 4),  # open_time_ms, close
                    dtype=np.float64,
                )
                if data.ndim == 1:
                    data = data.reshape(1, -1)
                # Convert ms → sec
                data[:, 0] /= 1000.0
                chunks.append(data)

    if not chunks:
        raise ValueError("No data loaded from zip files")

    combined = np.concatenate(chunks, axis=0)
    combined = combined[combined[:, 0].argsort()]
    print(f"Loaded {len(combined):,} 1s kline rows", flush=True)
    return combined


# ---------------------------------------------------------------------------
# Prediction functions
# ---------------------------------------------------------------------------


def gbm_prob(p0: float, k: float, mu: float, sigma: float, h_sec: float) -> float:
    """
    P(P_H > K | P_0) under GBM with drift mu (per sec) and vol sigma (per sec^0.5).
    Uses the log-normal CDF: Phi((log(P0/K) + (mu - sigma^2/2)*H) / (sigma*sqrt(H)))
    """
    if sigma <= 0 or h_sec <= 0:
        return float("nan")
    log_ratio = np.log(p0 / k)
    drift_term = (mu - 0.5 * sigma**2) * h_sec
    denom = sigma * np.sqrt(h_sec)
    z = (log_ratio + drift_term) / denom
    return float(scipy.stats.norm.cdf(z))


def empirical_prob(log_returns_h: npt.NDArray[np.float64], log_threshold: float) -> float:
    """
    P(P_H > K | P_0) = fraction of historical H-period log returns > log(K/P0).
    log_threshold = log(K/P0), so we want returns > log_threshold.
    """
    if len(log_returns_h) == 0:
        return float("nan")
    return float(np.mean(log_returns_h > log_threshold))


# ---------------------------------------------------------------------------
# Backtesting
# ---------------------------------------------------------------------------


@dataclass
class Cell:
    """Accumulates predictions and outcomes for one (model, horizon, moneyness)."""

    preds: list[float] = field(default_factory=list)
    actuals: list[float] = field(default_factory=list)

    def add(self, pred: float, actual: float) -> None:
        self.preds.append(pred)
        self.actuals.append(float(actual))

    def brier(self) -> float:
        if not self.preds:
            return float("nan")
        p = np.array(self.preds)
        a = np.array(self.actuals)
        return float(np.mean((p - a) ** 2))

    def log_loss(self) -> float:
        if not self.preds:
            return float("nan")
        p = np.clip(self.preds, 1e-7, 1 - 1e-7)
        a = np.array(self.actuals)
        return float(-np.mean(a * np.log(p) + (1 - a) * np.log(1 - p)))

    def calibration(self) -> tuple[float, float, int]:
        """Returns (mean_pred, actual_win_rate, count)."""
        if not self.preds:
            return float("nan"), float("nan"), 0
        return float(np.mean(self.preds)), float(np.mean(self.actuals)), len(self.preds)


def backtest(
    closes: npt.NDArray[np.float64],
    horizons: dict[str, int],
    moneyness_levels: list[float],
    lookback_sec: int = LOOKBACK_SEC,
    eval_step_sec: int = EVAL_STEP_SEC,
    min_window_points: int = MIN_WINDOW_POINTS,
) -> dict[str, dict[str, dict[float, Cell]]]:
    """
    Slide through closes, fit models on a rolling lookback window, predict
    at each eval point, and record outcomes.

    Returns: results[model_name][horizon_name][moneyness] -> Cell
    """
    timestamps = closes[:, 0]
    prices = closes[:, 1]
    n = len(closes)

    model_names = ["gbm", "empirical"]
    horizon_names = list(horizons.keys())

    results: dict[str, dict[str, dict[float, Cell]]] = {
        m: {h: {km: Cell() for km in moneyness_levels} for h in horizon_names} for m in model_names
    }

    t_start = timestamps[0]
    t_end = timestamps[-1]
    max_horizon = max(horizons.values())

    # We can only evaluate up to t_end - max_horizon
    eval_end = t_end - max_horizon
    if eval_end <= t_start + lookback_sec:
        raise ValueError("Not enough data for even one evaluation window")

    eval_times = np.arange(t_start + lookback_sec, eval_end, eval_step_sec)
    total_evals = len(eval_times)
    print(f"Running {total_evals:,} evaluation steps ...", flush=True)

    # Precompute index mapping: for each eval time, find the index in timestamps
    # Use searchsorted for efficiency
    eval_indices = np.searchsorted(timestamps, eval_times, side="right") - 1
    # Filter to valid indices
    valid_mask = eval_indices >= 0
    eval_times = eval_times[valid_mask]
    eval_indices = eval_indices[valid_mask]

    # For progress reporting
    report_every = max(1, total_evals // 20)

    for step_i, (t_eval, idx_eval) in enumerate(zip(eval_times, eval_indices)):
        if step_i % report_every == 0:
            pct = 100.0 * step_i / total_evals
            print(f"  {pct:5.1f}% done ({step_i:,}/{total_evals:,})", flush=True)

        p0 = prices[idx_eval]

        # --- Window: all points in [t_eval - lookback_sec, t_eval] ---
        win_start = t_eval - lookback_sec
        idx_win_start = int(np.searchsorted(timestamps, win_start, side="left"))
        win_prices = prices[idx_win_start : idx_eval + 1]

        if len(win_prices) < min_window_points:
            continue

        # 1s log returns for GBM parameter estimation
        win_log_returns_1s = np.diff(np.log(win_prices))
        if len(win_log_returns_1s) < 2:
            continue

        mu_1s = float(np.mean(win_log_returns_1s))
        sigma_1s = float(np.std(win_log_returns_1s, ddof=1))

        for h_name, h_sec in horizons.items():
            # Actual outcome: did price go above K?
            t_outcome = t_eval + h_sec
            if t_outcome > t_end:
                continue
            idx_outcome = int(np.searchsorted(timestamps, t_outcome, side="right")) - 1
            if idx_outcome < 0 or idx_outcome >= n:
                continue
            p_outcome = prices[idx_outcome]
            # Empirical H-period returns from window
            # Collect all non-overlapping H-step returns within the window
            win_timestamps = timestamps[idx_win_start : idx_eval + 1]
            # Step through window with stride h_sec to get non-overlapping returns
            h_returns: list[float] = []
            t_cursor = win_timestamps[0] + h_sec
            while t_cursor <= win_timestamps[-1]:
                idx_h_end = int(np.searchsorted(win_timestamps, t_cursor, side="right")) - 1
                idx_h_start = int(np.searchsorted(win_timestamps, t_cursor - h_sec, side="left"))
                if idx_h_end > idx_h_start:
                    lr = np.log(win_prices[idx_h_end] / win_prices[idx_h_start])
                    h_returns.append(float(lr))
                t_cursor += h_sec
            emp_returns = np.array(h_returns, dtype=np.float64)

            for km in moneyness_levels:
                k_price = p0 * km
                log_threshold = np.log(km)  # = log(K/P0)
                actual = float(p_outcome > k_price)

                # GBM
                p_gbm = gbm_prob(p0, k_price, mu_1s, sigma_1s, float(h_sec))
                if not np.isnan(p_gbm):
                    results["gbm"][h_name][km].add(p_gbm, actual)

                # Empirical
                p_emp = empirical_prob(emp_returns, log_threshold)
                if not np.isnan(p_emp):
                    results["empirical"][h_name][km].add(p_emp, actual)

    return results


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------


def print_results(
    results: dict[str, dict[str, dict[float, Cell]]],
    horizons: dict[str, int],
    moneyness_levels: list[float],
) -> None:
    """Print ASCII comparison table of Brier score, log loss, and calibration."""

    h_names = list(horizons.keys())
    models = ["gbm", "empirical"]

    # ---- Brier Score Table ----
    print("\n" + "=" * 90)
    print("BRIER SCORE (lower = better)")
    print("=" * 90)

    col_w = 10
    mono_w = 8
    h_col_w = col_w * len(models)

    header = f"{'Moneyness':>{mono_w}}"
    for h in h_names:
        header += f"  {h:^{h_col_w}}"
    print(header)

    sub = " " * mono_w
    for h in h_names:
        for m in models:
            sub += f"  {m:>{col_w}}"
    print(sub)
    print("-" * len(sub))

    for km in moneyness_levels:
        row = f"{km:>{mono_w}.2f}"
        for h in h_names:
            for m in models:
                cell = results[m][h][km]
                b = cell.brier()
                row += f"  {b:>{col_w}.4f}" if not np.isnan(b) else f"  {'N/A':>{col_w}}"
        print(row)

    # ---- Log Loss Table ----
    print("\n" + "=" * 90)
    print("LOG LOSS (lower = better)")
    print("=" * 90)
    print(header)
    print(sub)
    print("-" * len(sub))

    for km in moneyness_levels:
        row = f"{km:>{mono_w}.2f}"
        for h in h_names:
            for m in models:
                cell = results[m][h][km]
                ll = cell.log_loss()
                row += f"  {ll:>{col_w}.4f}" if not np.isnan(ll) else f"  {'N/A':>{col_w}}"
        print(row)

    # ---- Calibration Table (ATM only for brevity, then all) ----
    print("\n" + "=" * 90)
    print("CALIBRATION: predicted avg vs actual win rate (count) — ATM (1.00) only")
    print("=" * 90)

    km_atm = 1.00
    cal_header = f"{'Horizon':>10}  {'Model':>10}  {'Pred':>8}  {'Actual':>8}  {'Count':>8}"
    print(cal_header)
    print("-" * len(cal_header))
    for h in h_names:
        for m in models:
            cell = results[m][h][km_atm]
            pred_avg, actual_rate, cnt = cell.calibration()
            if np.isnan(pred_avg):
                print(f"{h:>10}  {m:>10}  {'N/A':>8}  {'N/A':>8}  {cnt:>8}")
            else:
                print(f"{h:>10}  {m:>10}  {pred_avg:>8.4f}  {actual_rate:>8.4f}  {cnt:>8}")

    print("\n" + "=" * 90)
    print("Done.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    data_dir = os.environ.get("BINANCE_MODELING_DIR")
    if not data_dir:
        raise RuntimeError("BINANCE_MODELING_DIR environment variable is required")

    closes = load_closes(data_dir)
    results = backtest(closes, HORIZONS_SEC, MONEYNESS_LEVELS)
    print_results(results, HORIZONS_SEC, MONEYNESS_LEVELS)


if __name__ == "__main__":
    main()
