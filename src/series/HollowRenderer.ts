import { IChart } from '../types/index.js';
import { priceToY } from '../utils/projection.js';
import { LAYOUT } from '../core/layout.js';
import { SeriesRenderer } from './SeriesRenderer.js';

/**
 * Hollow Candlestick Renderer (Full Context / Professional Standard).
 *
 * TWO independent dimensions per candle:
 *
 *   1. FILL (close vs open):  Hollow  = close > open  (intra-period bullish)
 *                              Filled  = close < open  (intra-period bearish)
 *
 *   2. COLOR (close vs prev close):  Green = close > prevClose (trending up)
 *                                    Red   = close < prevClose (trending down)
 *
 * Four states:
 *   Hollow Green  = strong bullish  (up intra-period AND trending up)
 *   Solid  Green  = bullish gap     (down intra-period BUT still above yesterday)
 *   Hollow Red    = bearish gap     (up intra-period BUT still below yesterday)
 *   Solid  Red    = strong bearish  (down intra-period AND trending down)
 *
 * Doji (close === open): horizontal dash at close/open level.
 *
 * The wick is drawn in TWO segments (upper + lower) so it NEVER passes
 * through the body interior — no vertical line visible inside hollow bodies.
 */
export class HollowRenderer implements SeriesRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, renderStart: number, renderEnd: number): void {
    ctx.lineWidth = 1;
    for (let i = renderStart; i < renderEnd; i++) this.draw(ctx, chart, i, renderStart);
  }

  updateLast(ctx: CanvasRenderingContext2D, chart: IChart, barIndex: number, renderStart: number): boolean {
    const { barWidth } = chart.state;
    ctx.clearRect((barIndex - renderStart) * barWidth, 0, barWidth, chart.state.h);
    this.draw(ctx, chart, barIndex, renderStart);
    return false;
  }

  private draw(ctx: CanvasRenderingContext2D, chart: IChart, index: number, startIdx: number): void {
    const { data, barWidth } = chart.state;
    const bar = data[index];
    if (!bar) return;

    // ── Coordinates ──
    const cx = (index - startIdx) * barWidth + barWidth / 2;
    const yH = priceToY(bar.high, chart.state);
    const yL = priceToY(bar.low, chart.state);
    const yO = priceToY(bar.open, chart.state);
    const yC = priceToY(bar.close, chart.state);

    // Body boundaries (independent of up/down direction)
    const bodyTop = Math.min(yO, yC);
    const bodyBot = Math.max(yO, yC);

    // ── Dimension 1: Fill (hollow vs solid) ──
    // Based on close vs open — tells intra-period direction.
    const isHollow = bar.close > bar.open;
    const isDoji = bar.close === bar.open;

    // ── Dimension 2: Color (green vs red) ──
    // Based on close vs previous close — tells trend direction.
    let col: string;
    const upColor = chart.options.series.upColor ?? '#10B981';
    const downColor = chart.options.series.downColor ?? '#E11D48';

    if (index > 0) {
      const prevBar = data[index - 1];
      col = (prevBar && bar.close >= prevBar.close) ? upColor : downColor;
    } else {
      // First bar: no previous close to compare — default green
      col = upColor;
    }

    ctx.strokeStyle = col;

    // ── Wick: TWO segments ──
    // Upper wick: high → top of body
    const wx = Math.floor(cx) + 0.5;
    if (yH < bodyTop) {
      ctx.beginPath();
      ctx.moveTo(wx, yH);
      ctx.lineTo(wx, bodyTop);
      ctx.stroke();
    }

    // Lower wick: bottom of body → low
    if (yL > bodyBot) {
      ctx.beginPath();
      ctx.moveTo(wx, bodyBot);
      ctx.lineTo(wx, yL);
      ctx.stroke();
    }

    // ── Body ──
    // Floor/ceil ensures body rect covers exact pixel range with no gaps.
    const bodyY = Math.floor(bodyTop);
    const bodyH = Math.max(Math.ceil(bodyBot - bodyTop), 1);
    let bw = Math.floor(barWidth * LAYOUT.CANDLE_GAP_RATIO);
    if (bw % 2 === 0 && bw > 1) bw--;
    const bl = Math.floor(wx) - Math.floor(bw / 2);

    if (isDoji) {
      ctx.beginPath();
      ctx.moveTo(bl, yC);
      ctx.lineTo(bl + bw, yC);
      ctx.stroke();
    } else if (isHollow) {
      if (bw > 2 && bodyH > 2) {
        ctx.strokeRect(bl + 0.5, bodyY + 0.5, bw - 1, bodyH - 1);
      } else {
        ctx.strokeRect(bl, bodyY, bw, bodyH);
      }
    } else {
      ctx.fillStyle = col;
      ctx.fillRect(bl, bodyY, bw, bodyH);
    }
  }
}
