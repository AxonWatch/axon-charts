# Changelog

All notable changes to this project will be documented in this file.

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
- Bundle: ~80KB minified / ~21.8KB gzipped -> ~80KB minified / ~24.9KB gzipped (series types + audit hardening)
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
- Bundle: ~24.9KB gzipped (under 25KB target)
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
