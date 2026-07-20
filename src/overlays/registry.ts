import type { Overlay } from './Overlay.js';
import { SMAOverlay } from './SMAOverlay.js';
import { EMAOverlay } from './EMAOverlay.js';
import { BollingerBandsOverlay } from './BollingerBandsOverlay.js';
import { VWAPOverlay } from './VWAPOverlay.js';
import { IchimokuCloudOverlay } from './IchimokuCloudOverlay.js';

/**
 * Central registry of overlay type → constructor.
 *
 * Mirrors the drawing registry pattern (src/drawings/registry.ts):
 * built-in types self-register at module load; external code registers
 * custom types via chart.registerOverlayType().
 *
 * The registry maps type strings (e.g. 'sma', 'ema', 'bb') to
 * constructor functions. This lets saveState()/loadState() serialize
 * overlays to plain { id, type, options } triples and reconstruct them
 * without the consumer maintaining their own type → constructor map.
 *
 * A reverse map (constructor → typeName) is maintained alongside
 * so saveState() can look up the type string for a given overlay
 * instance via overlay.constructor.
 */
type OverlayConstructor = new (opts?: any) => Overlay;

const typeToCtor = new Map<string, OverlayConstructor>();
const ctorToType = new Map<Function, string>();

/**
 * Register an overlay type. Built-in types are registered at module
 * load. External code uses this via chart.registerOverlayType() to
 * add custom overlay types.
 *
 * Overwriting an existing type is allowed (last-writer-wins).
 */
export function registerOverlayType(type: string, ctor: OverlayConstructor): void {
  if (!type || typeof type !== 'string') {
    throw new Error('AxonCharts: registerOverlayType requires a non-empty type string');
  }
  if (!ctor || typeof ctor !== 'function') {
    throw new Error('AxonCharts: registerOverlayType requires a constructor function');
  }
  typeToCtor.set(type, ctor);
  ctorToType.set(ctor, type);
}

/**
 * Look up the constructor for an overlay type.
 * Returns undefined for unregistered types.
 */
export function getOverlayType(type: string): OverlayConstructor | undefined {
  return typeToCtor.get(type);
}

/**
 * Look up the type string for a given overlay constructor.
 * Returns undefined for unregistered constructors.
 */
export function getOverlayTypeName(ctor: Function): string | undefined {
  return ctorToType.get(ctor);
}

// ── Built-in overlay self-registration ──────────────────────
registerOverlayType('sma', SMAOverlay);
registerOverlayType('ema', EMAOverlay);
registerOverlayType('bb', BollingerBandsOverlay);
registerOverlayType('vwap', VWAPOverlay);
registerOverlayType('ichimoku', IchimokuCloudOverlay);