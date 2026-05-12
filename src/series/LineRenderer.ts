import { IChart } from '../types/index.js';
import { priceToY } from '../utils/projection.js';
import { SeriesRenderer } from './SeriesRenderer.js';

export class LineRenderer implements SeriesRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, renderStart: number, renderEnd: number): void {
    const { data, barWidth } = chart.state;
    if (data.length === 0) return;
    ctx.strokeStyle = chart.options.series.upColor ?? '#22c55e';
    ctx.lineWidth = 1.5; ctx.beginPath();
    let started = false;
    for (let i = renderStart; i < renderEnd; i++) {
      const bar = data[i]; if (!bar) continue;
      const x = (i - renderStart) * barWidth + barWidth / 2;
      const y = priceToY(bar.close, chart.state);
      if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    }
    ctx.stroke();
  }
  updateLast(ctx: CanvasRenderingContext2D, chart: IChart, barIndex: number, renderStart: number): boolean {
    return true;
  }
}