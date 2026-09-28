import type { Bar } from '../types/index.js';

/**
 * Derived metrics for LLM context.
 *
 * Pre-computed scalars that LLMs cannot reliably derive from raw arrays
 * (arithmetic on long number arrays is error-prone) — normalized ratios,
 * percentage deviations, and visible-window summary statistics.
 *
 * All functions are pure. The caller (chart.getContext()) computes them
 * over the visible slice only, and only for indicators that are active.
 *
 * Design rules:
 *  - Normalized ratios over absolute values (percentB, not "band distance in USD")
 *  - Window scalars over per-bar fields (token efficiency)
 *  - Numbers only — no textual interpretation ("downtrend", "overbought") —
 *    bucketing/interpretation belongs to the consuming application
 */

/**
 * Bollinger %B — position of close within the bands.
 * 0 at the lower band, 1 at the upper band, >1 = breakout above,
 * <0 = breakdown below. Returns null when the band range is zero/invalid.
 */
export function percentB(close: number, upper: number, lower: number): number | null {
  if (close == null || upper == null || lower == null) return null;
  if (isNaN(close) || isNaN(upper) || isNaN(lower)) return null;
  const range = upper - lower;
  if (!isFinite(range) || range === 0) return null;
  return (close - lower) / range;
}

/**
 * Bollinger Bandwidth — normalized band width (squeeze detector).
 * (upper - lower) / middle. With default 20/2 params this equals
 * 4x the coefficient of variation. Returns null when middle is 0/invalid.
 */
export function bandwidth(upper: number, lower: number, middle: number): number | null {
  if (upper == null || lower == null || middle == null) return null;
  if (isNaN(upper) || isNaN(lower) || isNaN(middle)) return null;
  if (middle === 0) return null;
  return (upper - lower) / middle;
}

/**
 * Price deviation from a moving average (or any reference line), in percent.
 * Positive = price above the line (e.g. bullish bias for MAs).
 * Returns null when ma is 0/invalid.
 */
export function priceVsMA(close: number, ma: number): number | null {
  if (close == null || ma == null) return null;
  if (isNaN(close) || isNaN(ma)) return null;
  if (ma === 0) return null;
  return ((close - ma) / ma) * 100;
}

/**
 * MACD histogram trend — sign of the last histogram change.
 * 1 = histogram rising (bullish momentum accelerating),
 * -1 = histogram falling (bearish momentum accelerating),
 * 0 = flat. Takes the sliced (visible) values array; returns null
 * when either of the last two slots is null (warmup / no data).
 */
export function macdHistogramTrend(values: (number | null)[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  const last = values[n - 1];
  const prev = values[n - 2];
  if (last == null || prev == null) return null;
  return last > prev ? 1 : (last < prev ? -1 : 0);
}

/**
 * RSI distance from the 50 midline — signed normalized momentum.
 * +30 = strongly bullish, -30 = strongly bearish. Never buckets
 * into "overbought/oversold" — the consumer applies thresholds.
 */
export function rsiDistanceFromMid(rsi: number): number | null {
  if (rsi == null || isNaN(rsi)) return null;
  return rsi - 50;
}

/**
 * Stochastic %K minus %D — the cross signal.
 * Positive = %K above %D (bullish), negative = %K below %D (bearish).
 */
export function stochKMinusD(k: number, d: number): number | null {
  if (k == null || d == null || isNaN(k) || isNaN(d)) return null;
  return k - d;
}

/**
 * Latest bar's move size normalized by ATR — "how many ATRs did the
 * last bar move". Volatility-agnostic move magnitude.
 * Returns null when atr is 0/invalid.
 */
export function closeVsATR(close: number, prevClose: number, atr: number): number | null {
  if (close == null || prevClose == null || atr == null) return null;
  if (isNaN(close) || isNaN(prevClose) || isNaN(atr)) return null;
  if (atr === 0) return null;
  return Math.abs(close - prevClose) / atr;
}

// ── Tier 3: per-bar derived fields (opt-in via context.derived.perBar) ──

/**
 * Per-bar return: (close − prevClose) / prevClose × 100.
 * Normalized per-bar move — asset- and timeframe-agnostic.
 */
export function returnPct(close: number, prevClose: number): number | null {
  if (close == null || prevClose == null || isNaN(close) || isNaN(prevClose) || prevClose === 0) return null;
  return ((close - prevClose) / prevClose) * 100;
}

/**
 * Candle body ratio: (close − open) / (high − low).
 * 0 = doji (body is nothing), +1 = bullish marubozu, −1 = bearish marubozu.
 * Null when the bar has zero range (high === low).
 */
export function bodyRatio(open: number, high: number, low: number, close: number): number | null {
  if (open == null || high == null || low == null || close == null) return null;
  if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) return null;
  const range = high - low;
  if (range === 0) return null;
  return (close - open) / range;
}

/**
 * Candle wick sizes (rejection legs): distance from body edges to extremes.
 * upperWick = high − max(open, close); lowerWick = min(open, close) − low.
 */
export function wicks(open: number, high: number, low: number, close: number): { upperWick: number; lowerWick: number } {
  const top = Math.max(open, close);
  const bottom = Math.min(open, close);
  return { upperWick: high - top, lowerWick: bottom - low };
}

// ── Tier 4: window/local-derived metrics (opt-in via context.derived) ──

/**
 * Position within a channel: (close − bottom) / (top − bottom), 0..1.
 * Used for `donchianPosition` (top/bottom = rolling highest-high/
 * lowest-low over N bars) and `cloudPosition` (Ichimoku Kumo edges).
 * Null when the channel has zero height.
 */
export function positionInChannel(close: number, top: number, bottom: number): number | null {
  if (close == null || top == null || bottom == null) return null;
  if (isNaN(close) || isNaN(top) || isNaN(bottom)) return null;
  if (top === bottom) return null;
  return (close - bottom) / (top - bottom);
}

/**
 * Window pivots (classic floor-trader math anchored to the VISIBLE window —
 * no session inference; the anchor is the window itself):
 *   P  = (winHigh + winLow + winOpen) / 3
 *   R1 = 2P − winLow    S1 = 2P − winHigh
 *   R2 = P + (winHigh − winLow)    S2 = P − (winHigh − winLow)
 */
export function windowPivots(winHigh: number, winLow: number, winOpen: number): {
  p: number; r1: number; r2: number; s1: number; s2: number;
} {
  const p = (winHigh + winLow + winOpen) / 3;
  const range = winHigh - winLow;
  return {
    p,
    r1: 2 * p - winLow,
    r2: p + range,
    s1: 2 * p - winHigh,
    s2: p - range
  };
}

/**
 * MACD cross signal over the last window: +1 if the MACD line crossed ABOVE
 * the signal within the last `lookback` bars, −1 if it crossed BELOW, 0 if
 * no cross in the window. Null when either line is not defined in the window.
 *
 * @param macd / signal arrays of visible-slice values (null where undefined)
 * @param lookback how many trailing bars to inspect (default 5)
 */
/**
 * MACD cross signal over the last window: +1 if the MACD line crossed ABOVE
 * the signal within the last `lookback` bars, −1 if it crossed BELOW, 0 if
 * no cross in the window. Null when either line is not defined in the window.
 *
 * @param macd / signal arrays of visible-slice values (null where undefined)
 * @param lookback how many trailing bars to inspect (default 5)
 */
export function macdCrossedSignal(
  macd: (number | null)[],
  signal: (number | null)[],
  lookback: number = 5
): number | null {
  const n = Math.min(macd.length, signal.length);
  const from = Math.max(1, n - lookback);   // exclusive lower bound
  for (let i = n - 1; i >= from; i--) {
    const m1 = macd[i], s1 = signal[i], m0 = macd[i - 1], s0 = signal[i - 1];
    if (m1 == null || s1 == null || m0 == null || s0 == null) continue;
    const diff1 = m1 - s1;
    const diff0 = m0 - s0;
    if (diff0 <= 0 && diff1 > 0) return 1;    // bullish cross (prev below/at, now above)
    if (diff0 >= 0 && diff1 < 0) return -1;   // bearish cross
  }
  return 0;
}

/**
 * Summary statistics over the visible window.
 * Collapses the whole visible range into ~10 numbers the LLM cannot
 * reliably compute itself (extreme-finding, stdev across arrays).
 *
 * - highIndex / lowIndex are 0-based indices into the visibleBars array
 *   the caller provides (NOT absolute dataset indices).
 * - volatilityPct is the population stdev of per-bar close returns, ×100.
 * - positionInRange: (lastClose - low) / (high - low); 0 = at the low,
 *   1 = at the high, null when the range is zero.
 */
export function windowStats(bars: Bar[]): Record<string, number | null> {
  const n = bars.length;
  if (n === 0) return {};

  const first = bars[0];
  const last = bars[n - 1];

  let high = -Infinity, low = Infinity;
  let highIndex = -1, lowIndex = -1;
  let volumeSum = 0, volumeCount = 0;

  for (let i = 0; i < n; i++) {
    const bar = bars[i];
    if (bar.high > high) { high = bar.high; highIndex = i; }
    if (bar.low < low) { low = bar.low; lowIndex = i; }
    if (bar.volume != null && !isNaN(bar.volume)) {
      volumeSum += bar.volume;
      volumeCount++;
    }
  }

  const changeAbs = last.close - first.close;
  const changePct = first.close !== 0 ? (changeAbs / first.close) * 100 : null;
  const mean = (high + low) / 2;
  const rangePct = mean !== 0 ? ((high - low) / mean) * 100 : null;
  const positionInRange = high !== low ? (last.close - low) / (high - low) : null;

  // Volatility: population stdev of per-bar close-to-close returns
  let volatilityPct: number | null = null;
  if (n >= 3) {
    const returns: number[] = [];
    for (let i = 1; i < n; i++) {
      const prev = bars[i - 1].close;
      if (prev !== 0) returns.push((bars[i].close - prev) / prev);
    }
    if (returns.length > 1) {
      const meanRet = returns.reduce((a, r) => a + r, 0) / returns.length;
      const variance = returns.reduce((a, r) => a + (r - meanRet) * (r - meanRet), 0) / returns.length;
      volatilityPct = Math.sqrt(variance) * 100;
    }
  }

  return {
    changePct,
    changeAbs,
    high: isFinite(high) ? high : null,
    highIndex: highIndex >= 0 ? highIndex : null,
    low: isFinite(low) ? low : null,
    lowIndex: lowIndex >= 0 ? lowIndex : null,
    rangePct,
    volatilityPct,
    avgVolume: volumeCount > 0 ? volumeSum / volumeCount : null,
    positionInRange
  };
}