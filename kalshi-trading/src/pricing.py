"""GBM binary option pricing model."""

import numpy as np
import numpy.typing as npt
import scipy.stats


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


def estimate_params(closes: npt.NDArray[np.float64]) -> tuple[float, float]:
    """
    Estimate GBM mu (drift/sec) and sigma (vol/sec^0.5) from a window of 1s close prices.
    Requires at least 2 data points.
    """
    if len(closes) < 2:
        return float("nan"), float("nan")
    log_returns = np.diff(np.log(closes))
    mu = float(np.mean(log_returns))
    sigma = float(np.std(log_returns, ddof=1))
    return mu, sigma
