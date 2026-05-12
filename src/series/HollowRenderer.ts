import { IChart } from '../types/index.js';
import { priceToY } from '../utils/projection.js';
import { LAYOUT } from '../core/layout.js';
import { SeriesRenderer } from './SeriesRenderer.js';

export class HollowRenderer implements SeriesRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, renderStart: number, renderEnd: number): void {
    ctx.lineWidth = 1;
    for (let i = renderStart; i < renderEnd; i++) this.draw(ctx, chart, i, renderStart);
  }
  updateLast(ctx: CanvasRenderingContext2D, chart: IChart, barIndex: number, renderStart: number): boolean {
    const { barWidth } = chart.state;
    ctx.clearRect((barIndex - renderStart) * barWidth, 0, barWidth, chart.state.h);
    this.draw(ctx, chart, barIndex, renderStart); return false;
  }
  private draw(ctx: CanvasRenderingContext2D, chart: IChart, index: number, startIdx: number): void {
    const { data, barWidth } = chart.state;
    const bar = data[index]; if (!bar) return;
    const cx = (index - startIdx) * barWidth + barWidth / 2;
    const yH = priceToY(bar.high, chart.state), yL = priceToY(bar.low, chart.state);
    const yO = priceToY(bar.open, chart.state), yC = priceToY(bar.close, chart.state);
    const isUp = bar.close > bar.open, isDoji = bar.close === bar.open;
    const col = isUp ? (chart.options.series.upColor ?? '#22c55e') : (chart.options.series.downColor ?? '#ef4444');
    ctx.strokeStyle = col;
    const wx = Math.floor(cx) + 0.5;
    ctx.beginPath(); ctx.moveTo(wx, yH); ctx.lineTo(wx, yL); ctx.stroke();
    let bw = Math.floor(barWidth * LAYOUT.CANDLE_GAP_RATIO);
    if (bw % 2 === 0 && bw > 1) bw--;
    const bl = Math.floor(wx) - Math.floor(bw / 2);
    if (isDoji) {
      ctx.beginPath(); ctx.moveTo(bl, yC); ctx.lineTo(bl + bw, yC); ctx.stroke();
    } else if (isUp) {
      ctx.strokeRect(bl, Math.floor(yC), bw, Math.max(Math.abs(yO - yC), 1));
    } else {
      ctx.fillStyle = col;
      ctx.fillRect(bl, Math.floor(Math.min(yO, yC)), bw, Math.max(Math.abs(yO - yC), 1));
    }
  }
}
