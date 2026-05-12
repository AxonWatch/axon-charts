import { IChart } from '../types/index.js';
import { priceToY } from '../utils/projection.js';
import { SeriesRenderer } from './SeriesRenderer.js';

export class BarRenderer implements SeriesRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, renderStart: number, renderEnd: number): void {
    ctx.lineWidth = 1;
    for (let i = renderStart; i < renderEnd; i++) this.drawBar(ctx, chart, i, renderStart);
  }
  updateLast(ctx: CanvasRenderingContext2D, chart: IChart, barIndex: number, renderStart: number): boolean {
    const { barWidth } = chart.state;
    ctx.clearRect((barIndex - renderStart) * barWidth, 0, barWidth, chart.state.h);
    this.drawBar(ctx, chart, barIndex, renderStart); return false;
  }
  private drawBar(ctx: CanvasRenderingContext2D, chart: IChart, index: number, startIdx: number): void {
    const { data, barWidth } = chart.state;
    const bar = data[index]; if (!bar) return;
    const cx = (index - startIdx) * barWidth + barWidth / 2;
    const yH = priceToY(bar.high, chart.state), yL = priceToY(bar.low, chart.state);
    const yO = priceToY(bar.open, chart.state), yC = priceToY(bar.close, chart.state);
    const col = (bar.close >= bar.open) ? (chart.options.series.upColor ?? '#22c55e') : (chart.options.series.downColor ?? '#ef4444');
    ctx.strokeStyle = col;
    ctx.beginPath(); ctx.moveTo(cx, yH); ctx.lineTo(cx, yL); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 4, yO); ctx.lineTo(cx, yO); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, yC); ctx.lineTo(cx + 4, yC); ctx.stroke();
  }
}
