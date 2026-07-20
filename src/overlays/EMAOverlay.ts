import type { IChart } from '../types/index.js';
import { ema as computeEma } from '../utils/indicators.js';
import { LineOverlay } from './LineOverlay.js';

/**
 * Exponential Moving Average overlay.
 *
 * Renders a single line on the main chart at the EMA value for each
 * bar. EMA reacts faster to recent price changes than SMA.
 *
 * Options (constructor):
 *   show:      boolean  (default true)
 *   period:    number   (default 20)
 *   color:     string   (default '#f59e0b' amber)
 *   lineWidth: number   (default 1.5)
 *   field:     'close' | 'open' | 'high' | 'low'  (default 'close')
 *
 * Usage:
 *   chart.addOverlay(new EMAOverlay({ period: 12, color: '#3b82f6' }));
 *   chart.addOverlay(new EMAOverlay({ period: 26, color: '#ef4444' }));
 */
export class EMAOverlay extends LineOverlay {
  readonly id: string;
  private opts: { show?: boolean; period?: number; color?: string; lineWidth?: number; field?: 'close'|'open'|'high'|'low' };

  constructor(opts: { show?: boolean; period?: number; color?: string; lineWidth?: number; field?: 'close'|'open'|'high'|'low'; id?: string } = {}) {
    super();
    this.opts = opts;
    this.id = opts.id ?? `ema-${opts.period ?? 20}`;
  }

  compute(chart: IChart): number[] | null {
    const { data } = chart.state;
    if (data.length === 0) return null;
    return computeEma(data, this.opts.period ?? 20, this.opts.field ?? 'close');
  }

  getOptions() { return this.opts; }
}