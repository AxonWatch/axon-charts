import type { IChart } from '../types/index.js';
import { priceToY, indexToX, deriveVisibleStartIdx } from '../utils/projection.js';
import { LineOverlay } from './LineOverlay.js';

/**
 * VWAP (Volume Weighted Average Price) overlay.
 *
 * Renders a single line on the main chart at the VWAP value for each
 * bar. VWAP = cumulative(typicalPrice * volume) / cumulative(volume),
 * reset at the start of each session by default.
 *
 * VWAP is commonly used by intraday traders to gauge the average
 * price weighted by volume — price above VWAP suggests bullish
 * sentiment, below suggests bearish.
 *
 * Options (constructor):
 *   show:         boolean   (default true)
 *   color:        string    (default '#a855f7' purple — distinct from MA colors)
 *   lineWidth:    number    (default 1.5)
 *   resetDaily:   boolean   (default true — reset VWAP at the start
 *                            of each new calendar day; false = continuous
 *                            from the first bar)
 *
 * Usage:
 *   chart.addOverlay(new VWAPOverlay({ resetDaily: true }));
 */
export class VWAPOverlay extends LineOverlay {
  readonly id: string;
  private opts: { show?: boolean; color?: string; lineWidth?: number; resetDaily?: boolean };

  constructor(opts: { show?: boolean; color?: string; lineWidth?: number; resetDaily?: boolean; id?: string } = {}) {
    super();
    this.opts = opts;
    this.id = opts.id ?? 'vwap';
  }

  getOptions() { return this.opts; }

  compute(chart: IChart): number[] | null {
    const { data } = chart.state;
    if (data.length === 0) return null;
    const resetDaily = this.opts.resetDaily !== false;
    const result = new Array(data.length).fill(NaN);

    let cumPV = 0;  // cumulative price * volume
    let cumVol = 0; // cumulative volume
    let lastDay: number | null = null;

    for (let i = 0; i < data.length; i++) {
      const bar = data[i];
      const vol = bar.volume ?? 0;
      const tp = (bar.high + bar.low + bar.close) / 3;  // typical price

      // Reset at the start of a new calendar day
      if (resetDaily) {
        const day = Math.floor(bar.time / 86400000);  // ms per day
        if (lastDay != null && day !== lastDay) {
          cumPV = 0;
          cumVol = 0;
        }
        lastDay = day;
      }

      cumPV += tp * vol;
      cumVol += vol;

      if (cumVol > 0) {
        result[i] = cumPV / cumVol;
      } else {
        // No volume data — fall back to the typical price
        result[i] = tp;
      }
    }

    return result;
  }
}