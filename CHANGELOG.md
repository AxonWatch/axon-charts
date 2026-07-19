# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added
- `onCandleClose` callback — fires once per actual candle close (when an incoming bar's timestamp differs from the last bar's, causing a new bar to be appended via `updateLastBar()` or `updateLastBarFast()`). Receives the finalized closed bar with its final O/H/L/C/volume values. Does not fire from `setData()`, `appendBar()`, or `prependData()` (bulk loads are not live closes).
- New `CandleCloseCallback` type exported from the package.
- Wired from constructor options (`onCandleClose`) and assignable as a property on the chart instance.
- Extensible drawing system:
  - `DrawingRenderer` interface — plugin contract for rendering a drawing type (mirrors the `SeriesRenderer` pattern used for series types).
  - `chart.registerDrawingType(type, renderer)` — register custom drawing types without forking the library. Overwriting built-ins is allowed.
  - `resolveAnchor(chart, spec)` helper exported — resolves `{barIndex|time, price}` to screen coordinates. Prefers `time` (survives `maxBars` auto-cleanup) over `barIndex`.
  - New `DrawingData` interface — typed bag for type-specific fields (side, qty, sl, tp, lineWidth, lineStyle, extend, fill, plus `[key: string]: unknown` for custom types).
  - `validateDrawing()` — validates drawings on `addDrawing()`. Lenient on legacy types (no regression for existing callers); strict on `position` (requires `data.side`, `data.qty`, `price`, and an anchor).
  - Exports: `DrawingRenderer`, `registerDrawingType`, `getDrawingRenderer`, `resolveAnchor`, `ArrowRenderer`, `LabelRenderer`, `HLineRenderer`, `VLineRenderer`.

### Changed
- `Drawing` interface restructured for extensibility:
  - `type` widens from `'arrow_up' | ... | 'vline'` union to `string` (open for plugin registration).
  - `barIndex` and `price` become optional (vline never needed price; time-based anchoring makes barIndex optional).
  - New optional fields: `time`, `time2`, `barIndex2`, `price2`, `data`.
- `Renderer.renderDrawings()` slimmed from 80-line switch statement to 12-line registry lookup. Unknown drawing types are silently skipped.
- `IChart.dataManager` interface: added `getBarAtTime(timestamp)` (already existed on concrete `DataManager` class; now part of the contract for drawing anchor resolution).
- Color/style helpers (`hexToRgba`, `NAMED_COLORS`) extracted from `Renderer` to `src/utils/style.ts` for reuse by drawing renderers. New helpers: `chartBottomEdge()`, `clampYToChartArea()`.
- Bundle: 26709 → 27488 bytes gzipped (+779 bytes for the plugin registry, 4 extracted renderers, anchor helper, validation, and shared style utils).

### Backward Compatibility
- All 5 legacy drawing types (`arrow_up`, `arrow_down`, `label`, `hline`, `vline`) render pixel-identically (verbatim port to per-type renderer classes).
- `addDrawing`/`removeDrawing`/`clearDrawings`/`getDrawings` signatures unchanged.
- Existing callers passing drawings to the 5 legacy types are unaffected — validation is lenient on legacy types (only checks `id`, `type`, `color`).

## [1.2.8] - 2026-06-24

### Fixed
- Separator ns-resize cursor no longer appears near chart/time-axis boundary when no sub-panes are active — cursor now only shows near real separators

## [1.2.7] - 2026-06-24

### Fixed
- Preserve-center resize now correctly captures the OLD viewport's center pixel before width update — the candle the user was viewing stays centered after resize instead of drifting

## [1.2.6] - 2026-06-24

### Fixed
- Preserve-center resize now correctly maintains scroll position when barWidth is scaled — center index is pre-computed before scaling to avoid mixing old/new coordinate systems
- Time axis crosshair label no longer clips at left/right chart edges — clamped to stay within visible chart area
- Sub-pane separator hover no longer triggers when cursor is to the right of the chart area — added upper bound check on mouseX

## [1.2.5] - 2026-06-24

### Fixed
- barWidth scaling now guards against degenerate resize sizes (< 50px) — prevents zoom corruption when containers are detached or transitioning
- Round-trip resize through degenerate sizes (e.g., 300→1→300) no longer permanently clamps barWidth to maxBarSpacing

## [1.2.4] - 2026-06-23

### Fixed
- Buffer height recreation — candles no longer disappear when chart height changes without width change
- Buffer reuse logic now checks both width and height before skipping recreation

### Changed
- Version strings now read dynamically from package.json (single source of truth)
- Updated all documentation and HTML version references to v1.2.4

## [1.2.3] - 2026-06-23

### Fixed
- Candles now scale proportionally when chart is resized, preventing them from appearing cut at chart edges
- barWidth respects minBarSpacing/maxBarSpacing limits during resize

## [1.2.2] - 2026-05-24

### Fixed
- Crosshair now shows projected timestamps in empty chart areas (before first bar, after last bar) using virtual time calculation
- Removed fallback to `Date.now()` when hovering outside data range

### Changed
- Crosshair time extrapolation uses data interval for accurate virtual time projection

## [1.2.1] - 2026-05-19

### Added
- Callback wiring — `onVisibleRangeChange`, `onCrosshairMove`, `onBarClick`, `onScrollLockChange`, `onDataUpdate` now work when passed via `ChartOptions` (previously only worked via property assignment on the chart instance)
- `prependData(bars)` — inserts historical bars at the beginning without shifting the viewport. Use with `onVisibleRangeChange` to implement infinite scroll-to-past-history

### Fixed
- Report that `onVisibleRangeChange` never fired when passed via options constructor parameter — all 5 callbacks now assigned from the options object

### Changed
- Bundle: ~25.4KB gzipped (unchanged — callback wiring + prependData are negligible code)
- Version: 1.2.0 → 1.2.1


## [1.2.0] - 2026-05-19

### Added
- `attribution` option (with `show` toggle) — Axon.Watch brand logo at bottom-left of the chart area
- `src/ui/Attribution.ts` — DOM overlay widget with CSS-only hover-expand animation
- Attribution doc section in `html/docs.html`, `docs/SETTINGS.md`, `docs/API.md`
- SETTINGS entry for attribution in `html/demo.html` settings panel

### Changed
- Bundle: ~25.1KB gzipped → ~25.4KB gzipped (attribution widget)
- Version: 1.1.1 → 1.2.0
- Updated all documentation to reflect v1.2.0 option counts (91 → 94) and bundle size (25.1KB → 25.4KB)
- `html/bench.html`: benchmark upgrade — 5000 → 10000 bars, 100 → 1000 tight-loop iters, 100 → 500 async ticks at 100Hz, p99 reporting, live stat cards, CDN bundle source
- `html/index.html`: stat cards updated (25.1 → 25.4 KB, 91 → 94 options)
- `CONTRIBUTING.md`: docs listing cleaned up, bundle size updated, open-source + commercial contribution note added
- `NOTICE` file added with attribution request and trademark boundaries

## [1.1.1] - 2026-05-16

### Added
- `layout.borderVisible` option (default: false) — controls axis border lines and sub-pane vertical borders
- Sub-pane vertical axis border matching main chart axis border style
- Independent RAF animation loop for latest price marker pulse (works without countdown timer)
- Bottom gap (`bottomGap`) for sub-pane content areas preventing edge-to-edge rendering

### Changed
- Pulse animation eased from linear to ease-out cubic — front-loaded shrinkage, smoother feel
- Pulse duration: 500ms → 800ms with early RAF stop at eased < 0.005
- Market header default font size: 20px → 15px
- Market header, OHLC tooltip, and sub-pane tooltip fonts: bold → regular weight
- `showCountdown` default: `true` → `false`
- `layout.textColor` default: `#aaaaaa` → `#ffffff`
- `series.upColor` default: `#22c55e` → `#10B981`
- `series.downColor` default: `#ef4444` → `#E11D48`
- All docs defaults updated to match source code

### Fixed
- Hollow candle body outline anti-aliasing mismatch with wicks — added half-pixel offset for crisp rendering
- Axis border lines crisp rendering — added half-pixel offset (matches wick technique)
- Sub-pane Y-axis tick Y positions now use `areaTop` instead of hardcoded `subPaneTop + 14` — fixes drift when `topGap ≠ 14`
- ScalePane `renderAxisLabel()` coordinate system now consistent with `render()` gap calculation

## [1.1.0] - 2026-05-14

### Added
- **6 series types**: line, area, bar (OHLC), heiken-ashi, hollow -- runtime-swappable via `series.type`
- **lineColor option** -- fully independent of upColor/downColor (default: #1E90FF). Line/area series only.
- **showMarkers / showLatestPriceMarker / showLatestPriceAnimation** options for line/area series
- **Heiken-Ashi**: single-compute architecture, separate compact HA price label with overlap detection, O(1) updateLast
- **Drawing API**: `addDrawing()`, `removeDrawing()`, `clearDrawings()`, `getDrawings()` -- persistent annotations on overlay canvas
- **Plugin system preparations**: `onDataUpdate` callback, `ScalePane.setData()` for external data injection, `renderDrawings()` in drawViewport
- **onBarClick** and **onVisibleRangeChange** callbacks on IChart interface
- New timeScale options: `showDayOfWeek`, `dateFormat`, `timezone` (IANA)
- New layout option: `borderVisible` (axis border lines)
- New menu option: `items` (ordered item ID array for right-click menu)
- New market option: `fontSize`
- New watermark option: `rotate` (-45 degree diagonal)
- New context block: `exposeData`, `discoverable`, `id` for AI agent integration
- New volume options: `precision`, `minMove`
- New currentPrice sub-options: `show`, `showLine`, `upColor`, `downColor`, `lineStyle`, `textColor`
- Cascading defaults for currentPrice colors (currentPrice -> series -> hardcoded fallback)
- Percentage mode: 0% reference line and label injection

### Changed
- Bundle: ~80KB minified / ~21.8KB gzipped -> ~80KB minified / ~25.4KB gzipped (series types + audit hardening)
- Full codebase audit completed: 22 bugs fixed, 5 intentional behaviors documented
- All `(this.chart as any)` casts eliminated -- 12 occurrences replaced with IChart interface methods
- ScalePane text colors now follow layout.textColor (no more hardcoded #666/#888)
- All axis label X positions unified to LAYOUT.LABEL_OFFSET (15px from edge)
- hexToRgba handles named colors, short hex (#fff), and rgba() strings
- Buffer reuse logic compares actual pixel dimensions (not barWidth)
- Log scale asymmetric clamp fixed (both priceMin/priceMax use 0.01)
- Grid drawing uses chartBottom instead of h-bottomMargin
- Separator highlight only triggers when mouse is over canvas (not settings panel)
- Documentation restructured: public docs in docs/, internal planning in .guide/, hosted pages in html/
- esbuild.config.js maintained for bundling (UMD + ESM)

### Fixed
- Countdown timer crash after chart.destroy() -- RAF callback now checks _destroyed flag
- render() and resize() now guard against use-after-destroy
- loadState() now triggers a render call to paint the restored viewport
- setSubPane execute() command works for sub-panes without top-level options schema key
- B5-B7: Price label Y, HA label Y, and shifted HA label minY all clamped to topMargin
- B8: Negative spareBars on ultra-wide screens fixed with Math.max(0, ...)
- B9: Multi-sub-pane separator drag now iterates all sub-panes (not just first)
- B10: Stale lastTouchDistance on out-of-bounds pinch -- moved assignment outside bounds guard
- HA updateLast() using wrong predecessor index (was reading current bar's old HA instead of previous bar)
- HA first-bar formula corrected: open = (rawOpen + rawClose) / 2, high/low use max/min of HA values
- HA wicks invisible on live candles -- updateLast() now returns true (triggers full renderCandles)
- demo.html restored from git after OUTPUT_TRUNCATED corruption, series entries re-applied

### Technical
- Zero external dependencies
- Apache-2.0 licensed
- tsc --noEmit: 0 errors
- Bundle: ~25.4KB gzipped (under 25KB target)
- Added CSS for crosshair overlay z-index (zIndex: 10) for proper stacking

## [1.0.0] - 2026-05-04

### Added
- Core candlestick rendering engine with dual-canvas architecture
- Smart resize behavior (preserves center or anchors to latest based on autoScroll)
- Crosshair with magnetic snapping, OHLC tooltip, and axis labels
- Real-time updates with updateLastBarFast()
- Streaming support (docs/STREAMING.md)
- Event callbacks (onCrosshairMove, onBarClick, onVisibleRangeChange)
- Query methods (getData, getBar, getBarAtTime, getBars, getBarsInRange)
- Command execution interface (execute() for LLM-driven control)
- Screenshot capture (toDataURL, toBlob)
- State serialization (saveState, loadState)
- LLM integration context (getContext())
- Component APIs (priceScale, timeScale, crosshair)
- Runtime configuration with 73+ options across 11 categories
- Option validation with 76 checks
- WebSocket-ready demo with Binance integration
- Market info header (in-chart top-left label)
- Watermark with auto-scaling and rotation support
- Volume histogram sub-pane with independent Y-axis
- Draggable separator for resizing volume sub-pane
- Volume axis zoom/pan via scroll wheel and drag
- Custom right-click context menu (copy/save chart image)
- Full date crosshair time label option
- Right-click menu toggle option
- Dynamic chart margins (layout.padding)
- Series colors (upColor/downColor) replacing legacy colors block

### Changed
- Price axis width no longer shrinks by 20px tolerance
- Buffer now uses smart sizing with margin bars for smoother panning
- Vertical grid lines extend through sub-pane area
- Crosshair spans full chart height (including sub-pane)
- Separator extends through axis column full width

### Fixed
- Auto-scroll now correctly mapped to behavior.autoScroll
- Right-click no longer triggers chart pan
- Export images now include background, grid, and axes (uses merged canvas)
- Current price line no longer draws diagonally at extreme zoom levels
- getBarAtTime uses binary search (was O(n))
- onVisibleRangeChange no longer fires duplicate callbacks

### Technical
- Bundle size: 17.6KB gzipped (v1.0.0)
- Zero external dependencies
- Apache-2.0 licensed
