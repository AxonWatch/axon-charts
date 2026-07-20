import type { IChart } from '../types/index.js';
import { sma as computeSma } from '../utils/indicators.js';
import { LineOverlay } from './LineOverlay.js';

/**
 * Simple Moving Average overlay.
 *
 * Renders a single line on the main chart at the SMA value for each
 * bar, using the main chart's price scale. The line starts at the
 * first bar where the SMA is defined (index >= period - 1).
 *
 * Options (passed via the constructor, not chart.options — overlays
 * are registered programmatically):
 *   show:      boolean  (default true)
 *   period:    number   (default 20)
 *   color:     string   (default '#3b82f6' blue)
 *   lineWidth: number   (default 1.5)
 *   field:     'close' | 'open' | 'high' | 'low'  (default 'close')
 *
 * Usage:
 *   chart.addOverlay(new SMAOverlay({ period: 20, color: '#f59e0b' }));
 *   chart.addOverlay(new SMAOverlay({ period: 50, color: '#10B981' }));
 */
export class SMAOverlay extends LineOverlay {
  readonly id: string;
  private opts: { show?: boolean; period?: number; color?: string; lineWidth?: number; field?: 'close'|'open'|'high'|'low' };

  constructor(opts: { show?: boolean; period?: number; color?: string; lineWidth?: number; field?: 'close'|'open'|'high'|'low'; id?: string } = {}) {
    super();
    this.opts = opts;
    this.id = opts.id ?? `sma-${opts.period ?? 20}`;
  }

  compute(chart: IChart): number[] | null {
    const { data } = chart.state;
    if (data.length === 0) return null;
    return computeSma(data, this.opts.period ?? 20, this.opts.field ?? 'close');
  }

  getOptions() { return this.opts; }
}