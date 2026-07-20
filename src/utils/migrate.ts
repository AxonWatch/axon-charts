import type { ChartState } from '../types/index.js';
import { deepClone } from '../utils/merge.js';

/**
 * Migrate a ChartState snapshot from an older schema version to the
 * current one. Lets consumers call loadState(migrateSnapshot(oldSnap))
 * without writing their own migrators.
 *
 * Schema version history:
 *   1.0.0 — original (options, data, referencePrice, priceScaleMode,
 *           reverse, viewport). No drawings, no overlays.
 *   1.1.0 — adds `drawings: Drawing[]` and `overlays: OverlaySnapshot[]`.
 *           Old 1.0.0 snapshots load fine — new fields default to [].
 *
 * Version contract:
 *   Major (1.0 → 2.0): breaking shape change. loadState() may reject old snapshots.
 *   Minor (1.0 → 1.1): additive. Old snapshots still load; new fields default.
 *   Patch: no shape change.
 *
 * This function does NOT mutate the input — it returns a deep-cloned,
 * upgraded copy. Safe to call on snapshots that are already current
 * (no-op).
 *
 * @param state  The snapshot to migrate (any 1.x schema version)
 * @returns A snapshot at the current schema version (1.1.0)
 */
export function migrateSnapshot(state: ChartState): ChartState {
  const version = state.version || '1.0.0';
  // Deep-clone so we don't mutate the caller's stored snapshot
  const migrated = deepClone(state) as ChartState;

  if (version === '1.0.0') {
    // 1.0.0 → 1.1.0: add drawings + overlays (default to empty arrays)
    if (!migrated.drawings) migrated.drawings = [];
    if (!migrated.overlays) migrated.overlays = [];
    migrated.version = '1.1.0';
  }
  // If already 1.1.0 or newer, no migration needed
  // Future migrations: add `else if (version === '1.1.0') { ... }` blocks here

  return migrated;
}