import { IChart } from '../types/index.js';
import { priceToY } from '../utils/projection.js';
import { SeriesRenderer } from './SeriesRenderer.js';

export class LineRenderer implements SeriesRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, renderStart: number, renderEnd: number): void {
    const { data, barWidth } = chart.state;
    if (data.length === 0) return;

    const lineColor = chart.options.series.lineColor || '#1E90FF';
    const showMarkers = chart.options.series.showMarkers === true;
    const showLatest = chart.options.series.showLatestPriceMarker !== false;

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let i = renderStart; i < renderEnd; i++) {
      const bar = data[i]; if (!bar) continue;
      const x = (i - renderStart) * barWidth + barWidth / 2;
      const y = priceToY(bar.close, chart.state);
      if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    }
    ctx.stroke();

    if (!showMarkers && !showLatest) return;

    for (let i = renderStart; i < renderEnd; i++) {
      const bar = data[i]; if (!bar) continue;
      const x = (i - renderStart) * barWidth + barWidth / 2;
      const y = priceToY(bar.close, chart.state);

      if (i === data.length - 1 && showLatest) {
        ctx.fillStyle = lineColor;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (showMarkers) {
        ctx.fillStyle = lineColor;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  updateLast(ctx: CanvasRenderingContext2D, chart: IChart, barIndex: number, renderStart: number): boolean {
    return true;
  }
}