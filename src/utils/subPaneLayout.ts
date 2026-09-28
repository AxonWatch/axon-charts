import type { SubPane } from '../subpanes/SubPane.js';
import type { ChartState } from './projection.js';

/**
 * Shared sub-pane stack layout with a total-height budget.
 *
 * Single source of truth for pane tops/heights — used by chart.render(),
 * separator hit-testing, axis-position walks, and context output. Guarantee:
 * the sum of EFFECTIVE pane heights never exceeds
 * `subPane.maxTotalHeightPercent × state.h`, so the main candle area always
 * keeps at least (1 − budget) of the chart height no matter how many panes
 * are active or who enabled them (LLM, user code, right-click menu).
 *
 * Proportional auto-fit: when Σdesired > budget, every pane shrinks by the
 * same factor (relative weights preserved — all panes stay visible and
 * similarly readable). Configured `heightPercent` values in options are
 * NEVER modified; only the rendered/layout height is scaled.
 */

export interface PaneLayout {
  pane: SubPane;
  /** Effective top in CSS pixels (below the main chart area). */
  top: number;
  /** Effective height in CSS pixels (post-budget scale). */
  height: number;
  /** Desired height (pre-budget, = pane.computeHeight()). */
  desired: number;
}

export const SUBPANE_BUDGET_DEFAULT = 0.45;
export const SUBPANE_BUDGET_MIN = 0.2;
export const SUBPANE_BUDGET_MAX = 0.8;

/** Inclusive-effective budget resolution: option → default fallback. */
function resolveBudget(chart: { options: { subPane?: { maxTotalHeightPercent?: number } } }): number {
  const v = chart.options?.subPane?.maxTotalHeightPercent;
  if (typeof v !== 'number' || !isFinite(v)) return SUBPANE_BUDGET_DEFAULT;
  return Math.max(SUBPANE_BUDGET_MIN, Math.min(SUBPANE_BUDGET_MAX, v));
}

/**
 * Compute the effective layout of all active sub-panes against the budget.
 * The budget fraction applies to the USABLE height (full chart height minus
 * the reserved top/bottom axis margins) — the same drawable space the pane
 * heights share with the main candle area. computeHeight() keeps its
 * historical basis (state.h) for per-pane values; only the ceiling uses the
 * usable basis so `main + panes <= usable` holds exactly.
 */
export function getSubPaneStack(
  chart: {
    state: ChartState;
    getActiveSubPanes(): SubPane[];
    options: { subPane?: { maxTotalHeightPercent?: number } };
  }
): PaneLayout[] {
  const panes = chart.getActiveSubPanes();
  if (panes.length === 0) return [];

  const desiredList: number[] = [];
  let total = 0;
  for (const pane of panes) {
    const d = Math.max(0, pane.computeHeight(chart.state, pane.getOptions()));
    desiredList.push(d);
    total += d;
  }
  if (total === 0) return [];

  const usableH = chart.state.h - (chart.state.topMargin || 0) - (chart.state.bottomMargin || 0);
  const budgetPx = resolveBudget(chart) * usableH;
  const scale = total > budgetPx ? budgetPx / total : 1;

  const layouts: PaneLayout[] = [];
  let top = 0;
  for (let i = 0; i < panes.length; i++) {
    const height = Math.floor(desiredList[i] * scale);
    layouts.push({ pane: panes[i], top, height, desired: desiredList[i] });
    top += height;
  }
  return layouts;
}

/** Sum of EFFECTIVE heights (post-budget). */
export function subPaneStackTotal(layouts: PaneLayout[]): number {
  let s = 0;
  for (const l of layouts) s += l.height;
  return s;
}

/** Sum of DESIRED heights (pre-budget, what the panes asked for). */
export function subPaneStackRequested(chart: Parameters<typeof getSubPaneStack>[0]): number {
  let s = 0;
  for (const pane of chart.getActiveSubPanes()) {
    s += Math.max(0, pane.computeHeight(chart.state, pane.getOptions()));
  }
  return s;
}