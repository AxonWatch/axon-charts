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