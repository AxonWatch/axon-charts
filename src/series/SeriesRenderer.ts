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
  /** Optional: cached series-specific computed values (e.g., HA O/H/L/C for heiken-ashi) */
  getSeriesCache?(): Record<string, unknown> | null;
}
