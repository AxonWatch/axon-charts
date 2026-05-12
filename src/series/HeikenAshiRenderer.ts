import { IChart } from '../types/index.js';
import { priceToY } from '../utils/projection.js';
import { LAYOUT } from '../core/layout.js';
import { SeriesRenderer } from './SeriesRenderer.js';

export class HeikenAshiRenderer implements SeriesRenderer {
  private ha: {o:number;h:number;l:number;c:number}[] = [];
  private lastLen = -1;

  private compute(data: import('../types/index.js').Bar[]): void {
    if (data.length === 0) { this.ha = []; return; }
    const ha: typeof this.ha = [{ o: data[0].open, h: data[0].high, l: data[0].low, c: data[0].close }];
    for (let i = 1; i < data.length; i++) {
      const r = data[i], p = ha[i-1];
      const c = (r.open + r.high + r.low + r.close) / 4;
      ha.push({ o: (p.o + p.c) / 2, h: Math.max(r.high, (p.o+p.c)/2, c), l: Math.min(r.low, (p.o+p.c)/2, c), c });
    }
    this.ha = ha;
  }

  render(ctx: CanvasRenderingContext2D, chart: IChart, renderStart: number, renderEnd: number): void {
    const { data, barWidth } = chart.state;
    if (data.length === 0) return;
    if (data.length !== this.lastLen) { this.compute(data); this.lastLen = data.length; }
    ctx.lineWidth = 1;
    for (let i = renderStart; i < renderEnd; i++) {
      const r = data[i], ha = this.ha[i]; if (!r || !ha) continue;
      const cx = (i - renderStart) * barWidth + barWidth / 2;
      const yH = priceToY(ha.h, chart.state), yL = priceToY(ha.l, chart.state);
      const yO = priceToY(ha.o, chart.state), yC = priceToY(ha.c, chart.state);
      const isUp = ha.c >= ha.o;
      const col = isUp ? (chart.options.series.upColor ?? '#22c55e') : (chart.options.series.downColor ?? '#ef4444');
      ctx.fillStyle = col; ctx.strokeStyle = col;
      const wx = Math.floor(cx) + 0.5;
      ctx.beginPath(); ctx.moveTo(wx, yH); ctx.lineTo(wx, yL); ctx.stroke();
      let bw = Math.floor(barWidth * LAYOUT.CANDLE_GAP_RATIO);
      if (bw % 2 === 0 && bw > 1) bw--;
      ctx.fillRect(Math.floor(wx) - Math.floor(bw / 2), Math.floor(Math.min(yO, yC)), bw, Math.max(Math.abs(yO - yC), 1));
    }
  }
  updateLast(ctx: CanvasRenderingContext2D, chart: IChart, barIndex: number, renderStart: number): boolean {
    return true;
  }
}