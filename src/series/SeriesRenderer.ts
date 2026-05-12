import { IChart } from '../types/index.js';

export interface SeriesRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    chart: IChart,
    renderStart: number,
    renderEnd: number
  ): void;
  updateLast(
    ctx: CanvasRenderingContext2D,
    chart: IChart,
    barIndex: number,
    renderStart: number
  ): boolean;
}
