import type { IChart } from '../types/index.js';
import { priceToY, indexToX, deriveVisibleStartIdx } from '../utils/projection.js';
import { sma, rollingStdDev } from '../utils/indicators.js';
import type { Overlay } from './Overlay.js';

/**
 * Bollinger Bands overlay.
 *
 * Renders three lines on the main chart:
 *   - Middle band: SMA(period) of the close
 *   - Upper band:  middle + numStdDev * rollingStdDev
 *   - Lower band:  middle - numStdDev * rollingStdDev
 *
 * Plus an optional filled region between the upper and lower bands
 * (semi-transparent, default 8% alpha of the band color).
 *
 * Options (constructor):
 *   show:        boolean  (default true)
 *   period:      number   (default 20)
 *   numStdDev:   number   (default 2)
 *   color:       string   (default '#3b82f6' — used for all 3 lines)
 *   lineWidth:   number   (default 1)
 *   showFill:    boolean  (default true — fill the band region)
 *   fillOpacity: number   (default 0.08 — alpha for the fill)
 *
 * Usage:
 *   chart.addOverlay(new BollingerBandsOverlay({ period: 20, numStdDev: 2 }));
 */
export class BollingerBandsOverlay implements Overlay {
  readonly id: string;
  private opts: {
    show?: boolean;
    period?: number;
    numStdDev?: number;
    color?: string;
    lineWidth?: number;
    showFill?: boolean;
    fillOpacity?: number;
  };

  constructor(opts: { show?: boolean; period?: number; numStdDev?: number; color?: string; lineWidth?: number; showFill?: boolean; fillOpacity?: number; id?: string } = {}) {
    this.opts = opts;
    this.id = opts.id ?? `bb-${opts.period ?? 20}-${opts.numStdDev ?? 2}`;
  }

  getOptions() { return this.opts; }

  compute(chart: IChart): number[] | null {
    // Return the middle band as the primary value (used by the base
    // contract). The render method reads the upper/lower from private
    // fields populated here.
    const { data } = chart.state;
    if (data.length === 0) return null;
    const period = this.opts.period ?? 20;
    this.middle = sma(data, period);
    this.stdDev = rollingStdDev(data, period);
    const numStdDev = this.opts.numStdDev ?? 2;
    this.upper = this.middle.map((m, i) => {
      const sd = this.stdDev![i];
      return (isNaN(m) || isNaN(sd)) ? NaN : m + numStdDev * sd;
    });
    this.lower = this.middle.map((m, i) => {
      const sd = this.stdDev![i];
      return (isNaN(m) || isNaN(sd)) ? NaN : m - numStdDev * sd;
    });
    return this.middle;
  }

  private middle: number[] = [];
  private upper: number[] = [];
  private lower: number[] = [];
  private stdDev: number[] = [];

  render(ctx: CanvasRenderingContext2D, chart: IChart, _values: number[] | null): void {
    if (this.middle.length === 0) return;
    const opts = this.opts;
    const color = opts.color ?? '#3b82f6';
    const lineWidth = opts.lineWidth ?? 1;
    const showFill = opts.showFill !== false;
    const fillOpacity = opts.fillOpacity ?? 0.08;
    const { barWidth, w, axisWidth } = chart.state;
    const chartAreaWidth = w - axisWidth;
    const firstVisible = deriveVisibleStartIdx(chart.state, this.middle.length);
    const barsVisible = Math.ceil(chartAreaWidth / barWidth) + 2;
    const endIdx = Math.min(firstVisible + barsVisible, this.middle.length);

    // Fill region between upper and lower bands
    if (showFill && fillOpacity > 0) {
      ctx.fillStyle = this.hexToRgba(color, fillOpacity);
      ctx.beginPath();
      // Upper band left-to-right
      let started = false;
      for (let i = firstVisible; i < endIdx; i++) {
        const v = this.upper[i];
        if (v == null || isNaN(v)) continue;
        const x = indexToX(i, chart.state);
        const y = priceToY(v, chart.state);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else { ctx.lineTo(x, y); }
      }
      // Lower band right-to-left (close the path)
      for (let i = endIdx - 1; i >= firstVisible; i--) {
        const v = this.lower[i];
        if (v == null || isNaN(v)) continue;
        const x = indexToX(i, chart.state);
        const y = priceToY(v, chart.state);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Draw the three lines
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([]);
    for (const band of [this.upper, this.middle, this.lower]) {
      ctx.beginPath();
      let started = false;
      for (let i = firstVisible; i < endIdx; i++) {
        const v = band[i];
        if (v == null || isNaN(v)) continue;
        const x = indexToX(i, chart.state);
        const y = priceToY(v, chart.state);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else { ctx.lineTo(x, y); }
      }
      ctx.stroke();
    }
  }

  private hexToRgba(hex: string, alpha: number): string {
    // Inline to avoid importing from style.ts (keeps the overlay self-contained)
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
      const r = parseInt(hex[1] + hex[1], 16);
      const g = parseInt(hex[2] + hex[2], 16);
      const b = parseInt(hex[3] + hex[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgba(59, 130, 246, ${alpha})`;
  }
}