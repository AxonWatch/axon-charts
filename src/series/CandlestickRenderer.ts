import { IChart } from '../types/index.js';
import { priceToY } from '../utils/projection.js';
import { LAYOUT } from '../core/layout.js';
import { SeriesRenderer } from './SeriesRenderer.js';

export class CandlestickRenderer implements SeriesRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, renderStart: number, renderEnd: number): void {
    const { data, barWidth } = chart.state;
    ctx.lineWidth = 1;
    for (let i = renderStart; i < renderEnd; i++) this.drawCandle(ctx, chart, i, renderStart);
  }
  updateLast(ctx: CanvasRenderingContext2D, chart: IChart, barIndex: number, renderStart: number): boolean {
    const { barWidth } = chart.state;
    ctx.clearRect((barIndex - renderStart) * barWidth, 0, barWidth, chart.state.h);
    this.drawCandle(ctx, chart, barIndex, renderStart);
    return false;
  }
  private drawCandle(ctx: CanvasRenderingContext2D, chart: IChart, index: number, startIdx: number): void {
    const { data, barWidth } = chart.state;
    const bar = data[index];
    if (!bar) return;
    const bufferX = (index - startIdx) * barWidth;
    const centerX = bufferX + barWidth / 2;
    const yH = priceToY(bar.high, chart.state), yL = priceToY(bar.low, chart.state);
    const yO = priceToY(bar.open, chart.state), yC = priceToY(bar.close, chart.state);
    const isUp = bar.close >= bar.open;
    const col = isUp ? (chart.options.series.upColor ?? '#10B981') : (chart.options.series.downColor ?? '#E11D48');
    ctx.fillStyle = col; ctx.strokeStyle = col;
    const wx = Math.floor(centerX) + 0.5;
    ctx.beginPath(); ctx.moveTo(wx, yH); ctx.lineTo(wx, yL); ctx.stroke();
    let bw = Math.floor(barWidth * LAYOUT.CANDLE_GAP_RATIO);
    if (bw % 2 === 0 && bw > 1) bw--;
    ctx.fillRect(Math.floor(wx) - Math.floor(bw / 2), Math.floor(Math.min(yO, yC)), bw, Math.max(Math.abs(yO - yC), 1));
  }
}