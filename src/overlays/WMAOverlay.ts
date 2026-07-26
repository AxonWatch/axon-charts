import type { IChart } from '../types/index.js';
import { wma as computeWma } from '../utils/indicators.js';
import { LineOverlay } from './LineOverlay.js';

/**
 * Weighted Moving Average overlay.
 *
 * Linear-weighted moving average — most recent bar has the highest
 * weight. Similar to SMA but reacts faster to recent price changes
 * while still smoothing more than EMA.
 *
 * Options (constructor):
 *   show:      boolean  (default true)
 *   period:    number   (default 20)
 *   color:     string   (default '#8b5cf6' violet)
 *   lineWidth: number   (default 1.5)
 *   field:     'close' | 'open' | 'high' | 'low'  (default 'close')
 *
 * Usage:
 *   chart.addOverlay(new WMAOverlay({ period: 20, color: '#8b5cf6' }));
 *   chart.addOverlay(new WMAOverlay({ period: 50, color: '#10B981' }));
 */
export class WMAOverlay extends LineOverlay {
  readonly id: string;
  private opts: { show?: boolean; period?: number; color?: string; lineWidth?: number; field?: 'close'|'open'|'high'|'low' };

  constructor(opts: { show?: boolean; period?: number; color?: string; lineWidth?: number; field?: 'close'|'open'|'high'|'low'; id?: string } = {}) {
    super();
    this.opts = opts;
    this.id = opts.id ?? `wma-${opts.period ?? 20}`;
  }

  compute(chart: IChart): number[] | null {
    const { data } = chart.state;
    if (data.length === 0) return null;
    return computeWma(data, this.opts.period ?? 20, this.opts.field ?? 'close');
  }

  getOptions() { return this.opts; }
}
