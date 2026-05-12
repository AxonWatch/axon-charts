import { IChart } from '../types/index.js';
import { priceToY } from '../utils/projection.js';
import { SeriesRenderer } from './SeriesRenderer.js';

export class AreaRenderer implements SeriesRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, renderStart: number, renderEnd: number): void {
    const { data, barWidth } = chart.state;
    if (data.length === 0) return;
    const col = chart.options.series.upColor ?? '#22c55e';
    const cb = chart.state.chartBottom || (chart.state.h - chart.state.bottomMargin);
    ctx.beginPath();
    let s = false;
    for (let i = renderStart; i < renderEnd; i++) {
      const bar = data[i]; if (!bar) continue;
      const x = (i - renderStart) * barWidth + barWidth / 2;
      const y = priceToY(bar.close, chart.state);
      if (!s) { ctx.moveTo(x, y); s = true; } else { ctx.lineTo(x, y); }
    }
    if (s) {
      const lx = (renderEnd - 1 - renderStart) * barWidth + barWidth / 2;
      ctx.lineTo(lx, cb); ctx.lineTo(0, cb); ctx.closePath();
      ctx.fillStyle = this.rgba(col, 0.15); ctx.fill();
    }
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); s = false;
    for (let i = renderStart; i < renderEnd; i++) {
      const bar = data[i]; if (!bar) continue;
      const x = (i - renderStart) * barWidth + barWidth / 2;
      const y = priceToY(bar.close, chart.state);
      if (!s) { ctx.moveTo(x, y); s = true; } else { ctx.lineTo(x, y); }
    }
    ctx.stroke();
  }
  updateLast(ctx: CanvasRenderingContext2D, chart: IChart, barIndex: number, renderStart: number): boolean {
    return true;
  }
  private rgba(hex: string, a: number): string {
    if (/^#[0-9a-f]{6}$/i.test(hex)) return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`;
    return `rgba(34,197,94,${a})`;
  }
}