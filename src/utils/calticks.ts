import { PriceFormatter } from './formatter.js';
import type { Bar } from '../types/index.js';

/**
 * Calendar-anchored time-axis tick generation.
 *
 * Boundaries are snapped to CALENDAR points in the display timezone so that
 * day/month/year changes always land exactly on a boundary:
 *   - intraday cadence (< 1 day bars): steps that divide the 24h day
 *     (1/2/3/5/10/15/30 min, 1/2/3/4/6/8/12 h) → local 00:00 is always a
 *     boundary and shows the date label
 *   - daily/weekly/monthly cadence: local day starts walked by N days, then
 *     local month starts walked by N months (quarters/years)
 *
 * The same rule applies inside the data and in empty (virtual) regions — the
 * label type depends only on the boundary's own calendar position, never on
 * neighboring bars.
 */

export type CalStep =
  | { kind: 'time'; ms: number }   // intraday divisor of the 24h day
  | { kind: 'day'; n: number }     // n calendar days
  | { kind: 'month'; n: number };  // n calendar months (includes years at n%12===0)

// Intraday steps that divide the 24h day — guarantees a 00:00 boundary.
const TIME_STEPS_MS = [
  60e3, 2 * 60e3, 3 * 60e3, 5 * 60e3, 10 * 60e3, 15 * 60e3, 30 * 60e3,
  3600e3, 2 * 3600e3, 3 * 3600e3, 4 * 3600e3, 6 * 3600e3, 8 * 3600e3, 12 * 3600e3
];
const DAY_STEPS = [1, 2, 7, 14];
const MONTH_STEPS = [1, 2, 3, 6, 12];

/**
 * Pick the smallest calendar step whose on-screen spacing meets `targetPx`.
 * Equivalent-pixel spacing uses the nominal cadence (interval) — the actual
 * boundary walk may compress slightly across DST/month lengths, which the
 * spacing checker tolerates via the label loop's own suppression.
 */
export function chooseCalendarStep(interval: number, barWidth: number, targetPx: number): CalStep {
  const safeBarWidth = Math.max(barWidth, 0.1);

  const fits = (approxMs: number): boolean =>
    safeBarWidth * (approxMs / interval) >= targetPx;

  // Intraday: divisors of the 24h day → midnight-anchored boundary grid
  for (const ms of TIME_STEPS_MS) {
    if (fits(ms)) return { kind: 'time', ms };
  }
  // Whole days
  for (const n of DAY_STEPS) {
    if (fits(n * 86400000)) return { kind: 'day', n };
  }
  // Months (quarterly, half-year, ... — yearly = 12m, then geometric growth)
  for (const n of MONTH_STEPS) {
    if (fits(n * 30.44 * 86400000)) return { kind: 'month', n };
  }
  let n = 24; // 2 years
  while (!fits(n * 30.44 * 86400000)) n *= 2;
  return { kind: 'month', n };
}

/**
 * Generate calendar boundary timestamps covering [firstT, lastT].
 * Yields ascending instants. tz-aware: days start at local 00:00, months at
 * local month starts.
 */
export function* calendarBoundaries(
  firstT: number,
  lastT: number,
  step: CalStep,
  timezone?: string
): Generator<number> {
  if (lastT < firstT) return;

  if (step.kind === 'time') {
    // Walk day by day from the zoned midnight at/before firstT, stepping
    // through the day in `step.ms` slots. DST-short/long days self-correct
    // because each day restarts from its own computed local midnight.
    let dayStart = PriceFormatter.zonedDayStartMs(firstT, timezone);
    let guard = 0;
    while (dayStart <= lastT && guard++ < 10000) {
      const nextDay = PriceFormatter.zonedDayStartMs(dayStart + 86400000, timezone);
      for (let t = dayStart; t < nextDay && t <= lastT; t += step.ms) {
        if (t >= firstT) yield t;
      }
      dayStart = nextDay;
    }
    return;
  }

  if (step.kind === 'day') {
    // Anchor: local day starts; only boundaries on day-index multiples of n
    let dayIdx = Math.floor(PriceFormatter.zonedDayStartMs(firstT, timezone) / 86400000);
    const lastDayIdx = Math.floor(PriceFormatter.zonedDayStartMs(lastT, timezone) / 86400000) + 1;
    const firstAligned = Math.ceil(dayIdx / step.n) * step.n;
    let guard = 0;
    for (let k = firstAligned; k <= lastDayIdx && guard++ < 10000; k += step.n) {
      // Snap the nominal day count to a real local midnight (DST-safe)
      const nominal = k * 86400000;
      const t = PriceFormatter.zonedDayStartMs(Math.max(nominal, firstT), timezone);
      if (t >= firstT && t <= lastT) yield t;
    }
    return;
  }

  // Month tier: walk local month starts
  const startParts = PriceFormatter.getWallParts(
    PriceFormatter.zonedDayStartMs(firstT, timezone), timezone
  );
  const startMonthIdx = startParts.year * 12 + (startParts.month - 1);
  const endMonthKey = PriceFormatter.getZonedMonthKey(lastT, timezone); // 'yyyy-mm'
  const endParts = endMonthKey.split('-');
  const lastMonthIdx = +endParts[0] * 12 + (+endParts[1] - 1) + 1;
  const firstAligned = Math.ceil(startMonthIdx / step.n) * step.n;
  let guard = 0;
  for (let m = firstAligned; m <= lastMonthIdx && guard++ < 10000; m += step.n) {
    const year = Math.floor(m / 12);
    const month = m % 12;
    const nominalFirstDay = Date.UTC(year, month, 1);
    const t = PriceFormatter.zonedDayStartMs(nominalFirstDay, timezone);
    if (t >= firstT && t <= lastT) yield t;
  }
}

/**
 * Robust bar-interval estimate: median of successive time deltas over a small
 * head sample. Immune to a data gap between the first bars (which would make
 * data[1]-data[0] wildly unrepresentative).
 */
export function robustBarInterval(data: Bar[], fallback: number): number {
  const n = data.length;
  if (n < 2) return fallback;
  const sample = Math.min(33, n - 1);
  const deltas: number[] = [];
  for (let i = 0; i < sample; i++) {
    const d = data[i + 1].time - data[i].time;
    if (d > 0) deltas.push(d);
  }
  if (deltas.length === 0) return fallback;
  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)];
}