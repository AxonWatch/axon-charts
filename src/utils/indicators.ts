import type { Bar } from '../types/index.js';

/**
 * Technical indicator math utilities.
 *
 * All functions take a Bar array + parameters and return a number[]
 * aligned with the input (one value per bar, NaN where the indicator
 * is not yet defined — e.g. before the lookback period is reached).
 *
 * Used by sub-pane indicators (RSI, MACD, Stochastic, etc.) and by
 * overlay indicators (SMA, EMA, Bollinger Bands, etc.).
 *
 * Functions are pure (no chart dependency) so they can be unit-tested
 * in isolation and reused by external code (e.g. a Web Worker plugin
 * that pre-computes values and injects them via SubPane.setData()).
 */

/**
 * Simple Moving Average.
 * @param values  Bar array OR a number[] of pre-extracted values
 * @param period  Lookback window (e.g. 14, 20, 50, 200)
 * @param field  Which bar field to average: 'close' (default), 'open', 'high', 'low', 'volume'
 * @returns number[] aligned with input; NaN for indices < period-1
 */
export function sma(values: Bar[] | number[], period: number, field: keyof Bar = 'close'): number[] {
  const result = new Array(values.length).fill(NaN);
  if (period < 1) return result;
  const getVal = (i: number): number =>
    Array.isArray(values) && values.length > 0 && typeof values[0] === 'object'
      ? (values[i] as Bar)[field] as number
      : values[i] as number;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += getVal(i);
    if (i >= period) sum -= getVal(i - period);
    if (i >= period - 1) result[i] = sum / period;
  }
  return result;
}

/**
 * Exponential Moving Average.
 * Uses the standard seeding: SMA of the first `period` values, then
 * EMA = (close - prevEMA) * k + prevEMA, where k = 2/(period+1).
 * @returns number[] aligned with bars; NaN for indices < period-1
 */
export function ema(bars: Bar[], period: number, field: keyof Bar = 'close'): number[] {
  const result = new Array(bars.length).fill(NaN);
  if (period < 1 || bars.length < period) return result;
  const k = 2 / (period + 1);
  // Seed with SMA of the first `period` values
  let sum = 0;
  for (let i = 0; i < period; i++) sum += bars[i][field] as number;
  let prevEma = sum / period;
  result[period - 1] = prevEma;
  for (let i = period; i < bars.length; i++) {
    prevEma = (bars[i][field] as number - prevEma) * k + prevEma;
    result[i] = prevEma;
  }
  return result;
}

/**
 * Weighted Moving Average (linear weighting — most recent bar has the highest weight).
 * @returns number[] aligned with bars; NaN for indices < period-1
 */
export function wma(bars: Bar[], period: number, field: keyof Bar = 'close'): number[] {
  const result = new Array(bars.length).fill(NaN);
  if (period < 1) return result;
  const denom = period * (period + 1) / 2;
  for (let i = period - 1; i < bars.length; i++) {
    let weighted = 0;
    for (let j = 0; j < period; j++) {
      weighted += (bars[i - j][field] as number) * (period - j);
    }
    result[i] = weighted / denom;
  }
  return result;
}

/**
 * Rolling standard deviation (population, not sample — matches the
 * Bollinger Bands convention).
 * @returns number[] aligned with bars; NaN for indices < period-1
 */
export function rollingStdDev(bars: Bar[] | number[], period: number, field: keyof Bar = 'close'): number[] {
  const result = new Array(bars.length).fill(NaN);
  if (period < 2) return result;
  const means = sma(bars, period, field);
  const getVal = (i: number): number =>
    Array.isArray(bars) && bars.length > 0 && typeof bars[0] === 'object'
      ? (bars[i] as Bar)[field] as number
      : bars[i] as number;
  for (let i = period - 1; i < bars.length; i++) {
    const mean = means[i];
    let sumSq = 0;
    for (let j = 0; j < period; j++) {
      const diff = getVal(i - j) - mean;
      sumSq += diff * diff;
    }
    result[i] = Math.sqrt(sumSq / period);
  }
  return result;
}

/**
 * True Range for a single bar.
 * TR = max(high - low, |high - prevClose|, |low - prevClose|)
 * For the first bar (no prevClose), TR = high - low.
 */
export function trueRange(bar: Bar, prevClose: number | null): number {
  if (prevClose == null) return bar.high - bar.low;
  return Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - prevClose),
    Math.abs(bar.low - prevClose)
  );
}

/**
 * Relative Strength Index (Wilder's smoothing).
 * @param period  Lookback window (default 14)
 * @returns number[] aligned with bars; NaN for indices < period
 */
export function rsi(bars: Bar[], period: number = 14): number[] {
  const result = new Array(bars.length).fill(NaN);
  if (bars.length <= period) return result;

  // Compute initial gains/losses
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = bars[i].close - bars[i - 1].close;
    if (change >= 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Wilder's smoothing for subsequent bars
  for (let i = period + 1; i < bars.length; i++) {
    const change = bars[i].close - bars[i - 1].close;
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

/**
 * MACD (Moving Average Convergence Divergence).
 * @param fastPeriod   default 12
 * @param slowPeriod   default 26
 * @param signalPeriod default 9
 * @returns { macd, signal, histogram } — each aligned with bars; NaN where not yet defined
 */
export function macd(
  bars: Bar[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const fastEma = ema(bars, fastPeriod);
  const slowEma = ema(bars, slowPeriod);
  const macdLine = bars.map((_, i) =>
    isNaN(fastEma[i]) || isNaN(slowEma[i]) ? NaN : fastEma[i] - slowEma[i]
  );
  // Signal line = EMA of the MACD line. EMA needs valid values, so we
  // build a sub-array starting from the first non-NaN MACD value.
  const firstValid = macdLine.findIndex(v => !isNaN(v));
  const signalLine = new Array(bars.length).fill(NaN);
  if (firstValid >= 0) {
    const validMacd = macdLine.slice(firstValid);
    const k = 2 / (signalPeriod + 1);
    // Seed with SMA of the first `signalPeriod` valid MACD values
    if (validMacd.length >= signalPeriod) {
      let seed = 0;
      for (let i = 0; i < signalPeriod; i++) seed += validMacd[i];
      let prev = seed / signalPeriod;
      signalLine[firstValid + signalPeriod - 1] = prev;
      for (let i = signalPeriod; i < validMacd.length; i++) {
        prev = (validMacd[i] - prev) * k + prev;
        signalLine[firstValid + i] = prev;
      }
    }
  }
  const histogram = bars.map((_, i) =>
    isNaN(macdLine[i]) || isNaN(signalLine[i]) ? NaN : macdLine[i] - signalLine[i]
  );
  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Stochastic Oscillator (%K and %D).
 * @param kPeriod   %K lookback (default 14)
 * @param dPeriod   %D smoothing of %K (default 3)
 * @param smoothK   slow %K smoothing (default 1; set to 3 for slow stochastic)
 * @returns { k, d } — each aligned with bars; NaN where not yet defined
 */
export function stochastic(
  bars: Bar[],
  kPeriod: number = 14,
  dPeriod: number = 3,
  smoothK: number = 1
): { k: number[]; d: number[] } {
  const rawK = new Array(bars.length).fill(NaN);
  for (let i = kPeriod - 1; i < bars.length; i++) {
    let highest = -Infinity, lowest = Infinity;
    for (let j = 0; j < kPeriod; j++) {
      const b = bars[i - j];
      if (b.high > highest) highest = b.high;
      if (b.low < lowest) lowest = b.low;
    }
    const range = highest - lowest;
    rawK[i] = range === 0 ? 50 : (bars[i].close - lowest) / range * 100;
  }
  // Smooth %K if smoothK > 1 (slow stochastic).
  // Require a full window of valid raw %K values before emitting a
  // smoothed value — do NOT zero-pad NaN entries (which would pull the
  // first smoothK-1 values toward zero during warmup).
  let k: number[];
  if (smoothK > 1) {
    k = new Array(bars.length).fill(NaN);
    for (let i = smoothK - 1; i < bars.length; i++) {
      let sum = 0;
      let allValid = true;
      for (let j = 0; j < smoothK; j++) {
        const v = rawK[i - j];
        if (isNaN(v)) { allValid = false; break; }
        sum += v;
      }
      if (allValid) k[i] = sum / smoothK;
    }
  } else {
    k = rawK;
  }
  // %D = SMA of %K
  const d = new Array(bars.length).fill(NaN);
  for (let i = 0; i < bars.length; i++) {
    if (i < kPeriod - 1 + dPeriod - 1) continue;
    let sum = 0, count = 0;
    for (let j = 0; j < dPeriod; j++) {
      if (!isNaN(k[i - j])) { sum += k[i - j]; count++; }
    }
    if (count === dPeriod) d[i] = sum / dPeriod;
  }
  return { k, d };
}

/**
 * Williams %R.
 * @param period  Lookback window (default 14)
 * @returns number[] aligned with bars; values in [-100, 0]; NaN where not yet defined
 */
export function williamsR(bars: Bar[], period: number = 14): number[] {
  const result = new Array(bars.length).fill(NaN);
  for (let i = period - 1; i < bars.length; i++) {
    let highest = -Infinity, lowest = Infinity;
    for (let j = 0; j < period; j++) {
      const b = bars[i - j];
      if (b.high > highest) highest = b.high;
      if (b.low < lowest) lowest = b.low;
    }
    const range = highest - lowest;
    result[i] = range === 0 ? -50 : ((highest - bars[i].close) / range) * -100;
  }
  return result;
}

/**
 * Commodity Channel Index.
 * @param period  Lookback window (default 20)
 * @returns number[] aligned with bars; NaN where not yet defined
 */
export function cci(bars: Bar[], period: number = 20): number[] {
  const result = new Array(bars.length).fill(NaN);
  const tp = bars.map(b => (b.high + b.low + b.close) / 3);
  const smaTp = sma(tp, period);
  const meanDev = new Array(bars.length).fill(NaN);
  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += Math.abs(tp[i - j] - smaTp[i]);
    meanDev[i] = sum / period;
  }
  for (let i = period - 1; i < bars.length; i++) {
    const md = meanDev[i];
    result[i] = md === 0 ? 0 : (tp[i] - smaTp[i]) / (0.015 * md);
  }
  return result;
}

/**
 * Money Flow Index (uses volume).
 * @param period  Lookback window (default 14)
 * @returns number[] aligned with bars; 0-100; NaN where not yet defined
 */
export function mfi(bars: Bar[], period: number = 14): number[] {
  const result = new Array(bars.length).fill(NaN);
  if (bars.length <= period) return result;
  const tp = bars.map(b => (b.high + b.low + b.close) / 3);
  const mf = bars.map((b, i) => tp[i] * (b.volume ?? 0));

  for (let i = period; i < bars.length; i++) {
    let posFlow = 0, negFlow = 0;
    for (let j = 0; j < period; j++) {
      const idx = i - j;
      if (tp[idx] > tp[idx - 1]) posFlow += mf[idx];
      else if (tp[idx] < tp[idx - 1]) negFlow += mf[idx];
    }
    result[i] = negFlow === 0 ? 100 : 100 - 100 / (1 + posFlow / negFlow);
  }
  return result;
}

/**
 * Average True Range (Wilder's smoothing).
 * @param period  Lookback window (default 14)
 * @returns number[] aligned with bars; NaN where not yet defined
 */
export function atr(bars: Bar[], period: number = 14): number[] {
  const result = new Array(bars.length).fill(NaN);
  if (bars.length <= period) return result;
  const tr = new Array(bars.length).fill(0);
  tr[0] = bars[0].high - bars[0].low;
  for (let i = 1; i < bars.length; i++) {
    tr[i] = trueRange(bars[i], bars[i - 1].close);
  }
  // Wilder's smoothing
  let prevAtr = 0;
  for (let i = 1; i <= period; i++) prevAtr += tr[i];
  prevAtr /= period;
  result[period] = prevAtr;
  for (let i = period + 1; i < bars.length; i++) {
    prevAtr = (prevAtr * (period - 1) + tr[i]) / period;
    result[i] = prevAtr;
  }
  return result;
}

/**
 * ADX + DI+ / DI- (Directional Movement System).
 * @param period  Lookback window (default 14)
 * @returns { adx, plusDI, minusDI } — each aligned with bars; NaN where not yet defined
 */
export function adx(
  bars: Bar[],
  period: number = 14
): { adx: number[]; plusDI: number[]; minusDI: number[] } {
  const len = bars.length;
  const adx = new Array(len).fill(NaN);
  const plusDI = new Array(len).fill(NaN);
  const minusDI = new Array(len).fill(NaN);
  if (len <= period * 2) return { adx, plusDI, minusDI };

  const plusDM = new Array(len).fill(0);
  const minusDM = new Array(len).fill(0);
  const tr = new Array(len).fill(0);
  tr[0] = bars[0].high - bars[0].low;
  for (let i = 1; i < len; i++) {
    const upMove = bars[i].high - bars[i - 1].high;
    const downMove = bars[i - 1].low - bars[i].low;
    plusDM[i] = (upMove > downMove && upMove > 0) ? upMove : 0;
    minusDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0;
    tr[i] = trueRange(bars[i], bars[i - 1].close);
  }
  // Wilder smoothing of TR, +DM, -DM
  const smoothTR = new Array(len).fill(0);
  const smoothPlusDM = new Array(len).fill(0);
  const smoothMinusDM = new Array(len).fill(0);
  let trSum = 0, plusSum = 0, minusSum = 0;
  for (let i = 1; i <= period; i++) {
    trSum += tr[i]; plusSum += plusDM[i]; minusSum += minusDM[i];
  }
  smoothTR[period] = trSum;
  smoothPlusDM[period] = plusSum;
  smoothMinusDM[period] = minusSum;
  for (let i = period + 1; i < len; i++) {
    smoothTR[i] = smoothTR[i - 1] - smoothTR[i - 1] / period + tr[i];
    smoothPlusDM[i] = smoothPlusDM[i - 1] - smoothPlusDM[i - 1] / period + plusDM[i];
    smoothMinusDM[i] = smoothMinusDM[i - 1] - smoothMinusDM[i - 1] / period + minusDM[i];
  }
  // DI+ and DI-
  const dx = new Array(len).fill(NaN);
  for (let i = period; i < len; i++) {
    plusDI[i] = smoothTR[i] === 0 ? 0 : (smoothPlusDM[i] / smoothTR[i]) * 100;
    minusDI[i] = smoothTR[i] === 0 ? 0 : (smoothMinusDM[i] / smoothTR[i]) * 100;
    const sum = plusDI[i] + minusDI[i];
    dx[i] = sum === 0 ? 0 : (Math.abs(plusDI[i] - minusDI[i]) / sum) * 100;
  }
  // ADX = Wilder's smoothing of DX
  let adxSum = 0;
  for (let i = period; i < period * 2; i++) adxSum += dx[i];
  let prevAdx = adxSum / period;
  adx[period * 2 - 1] = prevAdx;
  for (let i = period * 2; i < len; i++) {
    prevAdx = (prevAdx * (period - 1) + dx[i]) / period;
    adx[i] = prevAdx;
  }
  return { adx, plusDI, minusDI };
}

/**
 * On-Balance Volume (OBV).
 * Cumulative volume that adds when close > prevClose, subtracts when
 * close < prevClose, and stays unchanged when close === prevClose.
 * @returns number[] aligned with bars; first value is 0
 */
export function obv(bars: Bar[]): number[] {
  const result = new Array(bars.length).fill(NaN);
  if (bars.length === 0) return result;
  result[0] = 0;
  for (let i = 1; i < bars.length; i++) {
    const vol = bars[i].volume ?? 0;
    if (bars[i].close > bars[i - 1].close) {
      result[i] = result[i - 1] + vol;
    } else if (bars[i].close < bars[i - 1].close) {
      result[i] = result[i - 1] - vol;
    } else {
      result[i] = result[i - 1];
    }
  }
  return result;
}

/**
 * Rate of Change (ROC).
 * ROC = (close[i] - close[i - period]) / close[i - period] * 100
 * @param period  Lookback window (default 12)
 * @returns number[] aligned with bars; NaN for indices < period
 */
export function roc(bars: Bar[], period: number = 12): number[] {
  const result = new Array(bars.length).fill(NaN);
  for (let i = period; i < bars.length; i++) {
    const prev = bars[i - period].close;
    if (prev !== 0) {
      result[i] = ((bars[i].close - prev) / prev) * 100;
    }
  }
  return result;
}

/**
 * Awesome Oscillator (AO).
 * AO = SMA(median, fastPeriod) - SMA(median, slowPeriod)
 * where median = (high + low) / 2.
 * @param fastPeriod  Default 5
 * @param slowPeriod  Default 34
 * @returns number[] aligned with bars; NaN where not yet defined
 */
export function awesomeOscillator(
  bars: Bar[],
  fastPeriod: number = 5,
  slowPeriod: number = 34
): number[] {
  const median = bars.map(b => (b.high + b.low) / 2);
  const fast = sma(median, fastPeriod);
  const slow = sma(median, slowPeriod);
  return bars.map((_, i) =>
    isNaN(fast[i]) || isNaN(slow[i]) ? NaN : fast[i] - slow[i]
  );
}

/**
 * Donchian Channel.
 * Upper = highest high over period; Lower = lowest low over period;
 * Middle = (upper + lower) / 2.
 * @param period  Lookback window (default 20)
 * @returns { upper, middle, lower } — each aligned with bars; NaN for indices < period - 1
 */
export function donchian(
  bars: Bar[],
  period: number = 20
): { upper: number[]; middle: number[]; lower: number[] } {
  const len = bars.length;
  const upper = new Array(len).fill(NaN);
  const middle = new Array(len).fill(NaN);
  const lower = new Array(len).fill(NaN);
  for (let i = period - 1; i < len; i++) {
    let highest = -Infinity, lowest = Infinity;
    for (let j = 0; j < period; j++) {
      const b = bars[i - j];
      if (b.high > highest) highest = b.high;
      if (b.low < lowest) lowest = b.low;
    }
    upper[i] = highest;
    lower[i] = lowest;
    middle[i] = (highest + lowest) / 2;
  }
  return { upper, middle, lower };
}

/**
 * SuperTrend.
 * ATR-based trend-following overlay. The line sits below price during
 * an uptrend (bullish/green) and above price during a downtrend
 * (bearish/red), flipping when price closes beyond the band.
 *
 * @param period      ATR lookback (default 10)
 * @param multiplier  ATR multiplier for band width (default 3)
 * @returns { values, direction } — values is the SuperTrend line;
 *          direction is 1 (uptrend) or -1 (downtrend). NaN before ATR warmup.
 */
export function superTrend(
  bars: Bar[],
  period: number = 10,
  multiplier: number = 3
): { values: number[]; direction: number[] } {
  const len = bars.length;
  const values = new Array(len).fill(NaN);
  const direction = new Array(len).fill(0);
  const atrArr = atr(bars, period);

  let prevFinalUpper = NaN;
  let prevFinalLower = NaN;
  let prevST = NaN;

  for (let i = 0; i < len; i++) {
    if (isNaN(atrArr[i])) continue;
    const hl2 = (bars[i].high + bars[i].low) / 2;
    const basicUpper = hl2 + multiplier * atrArr[i];
    const basicLower = hl2 - multiplier * atrArr[i];

    // Final upper band: only moves down (or resets up after being breached)
    const finalUpper = (isNaN(prevFinalUpper) || basicUpper < prevFinalUpper || (i > 0 && bars[i - 1].close > prevFinalUpper))
      ? basicUpper : prevFinalUpper;
    // Final lower band: only moves up (or resets down after being breached)
    const finalLower = (isNaN(prevFinalLower) || basicLower > prevFinalLower || (i > 0 && bars[i - 1].close < prevFinalLower))
      ? basicLower : prevFinalLower;

    if (isNaN(prevST)) {
      // Seed: pick the band closer to the close
      const isUp = bars[i].close >= hl2;
      values[i] = isUp ? finalLower : finalUpper;
      direction[i] = isUp ? 1 : -1;
    } else if (prevST === prevFinalUpper) {
      // Was downtrend (ST at upper band)
      if (bars[i].close <= finalUpper) {
        values[i] = finalUpper;
        direction[i] = -1;
      } else {
        values[i] = finalLower;
        direction[i] = 1;
      }
    } else {
      // Was uptrend (ST at lower band)
      if (bars[i].close >= finalLower) {
        values[i] = finalLower;
        direction[i] = 1;
      } else {
        values[i] = finalUpper;
        direction[i] = -1;
      }
    }

    prevFinalUpper = finalUpper;
    prevFinalLower = finalLower;
    prevST = values[i];
  }

  return { values, direction };
}

/**
 * Parabolic SAR (Stop and Reverse).
 * Places dots below price during an uptrend and above during a downtrend.
 * The Acceleration Factor (AF) starts at `step` and increments by `step`
 * on each new extreme, up to `maxStep`.
 *
 * @param step     AF increment (default 0.02)
 * @param maxStep  AF cap (default 0.2)
 * @returns { values, direction } — values is the SAR dot position;
 *          direction is 1 (uptrend, dot below) or -1 (downtrend, dot above).
 */
export function parabolicSAR(
  bars: Bar[],
  step: number = 0.02,
  maxStep: number = 0.2
): { values: number[]; direction: number[] } {
  const len = bars.length;
  const values = new Array(len).fill(NaN);
  const direction = new Array(len).fill(0);
  if (len < 2) return { values, direction };

  let trend = 1;
  let af = step;
  let ep = bars[0].high;
  values[0] = bars[0].low;
  direction[0] = 1;

  for (let i = 1; i < len; i++) {
    let sar = values[i - 1] + af * (ep - values[i - 1]);

    if (trend === 1) {
      // Cap SAR to no higher than the prior two bars' lows
      sar = Math.min(sar, bars[i - 1].low);
      if (i >= 2) sar = Math.min(sar, bars[i - 2].low);

      if (bars[i].low < sar) {
        // Reverse to downtrend
        trend = -1;
        sar = ep;
        ep = bars[i].low;
        af = step;
      } else {
        if (bars[i].high > ep) {
          ep = bars[i].high;
          af = Math.min(af + step, maxStep);
        }
      }
    } else {
      // Cap SAR to no lower than the prior two bars' highs
      sar = Math.max(sar, bars[i - 1].high);
      if (i >= 2) sar = Math.max(sar, bars[i - 2].high);

      if (bars[i].high > sar) {
        // Reverse to uptrend
        trend = 1;
        sar = ep;
        ep = bars[i].high;
        af = step;
      } else {
        if (bars[i].low < ep) {
          ep = bars[i].low;
          af = Math.min(af + step, maxStep);
        }
      }
    }

    values[i] = sar;
    direction[i] = trend;
  }

  return { values, direction };
}