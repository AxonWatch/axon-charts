# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-05-09

### Added
- ScalePane abstract class — generic Y-axis sub-pane with separator, grids, tooltip, axis labels, current value line, zoom/pan
- VolumeSubPane migrated to ScalePane (only 6 abstract methods, ~70% less code)
- `computeValues()` hook — computation cached once per render, eliminates recalculation duplication
- `getMinVisible()` override — enables MACD/oscillator sub-panes with negative values
- `getActiveSubPanes()` exposed on IChart interface — eliminates 12 `(this.chart as any)` casts
- `separatorHovered` property added to SubPane interface — prevents crashes in custom implementations
- Percentage mode enhancements: 0% reference line, 0% label always injected into axis ticks, smart formatting with per-path sign handling
- Reference price changed to firstVisibleBar.open (industry standard for percentage mode)
- All ScalePane text colors now follow layout.textColor
- Timezone, dateFormat, showDayOfWeek options for timeScale
- Cascading defaults pattern for currentPrice (upColor/downColor/textColor fall through series/layout)
- `timeScale()` and `setOptions()` methods on IChart interface

### Changed
- Bundle: ~72KB minified / ~19.4KB gzipped -> ~80KB minified / ~21.8KB gzipped (interface safety, ScalePane additions)
- tsc --noEmit passes with zero errors (was 28 errors)
- All axis label X positions unified to LAYOUT.LABEL_OFFSET (ScalePane latest price, crosshair, renderAxisLabel)
- Separator drag now works at the exact pixel where separator highlight activates (boundary match)
- Separator highlight only triggers when mouse is over the canvas (not settings panel)
- Grid drawing uses chartBottom instead of h-bottomMargin (stops grid extending into sub-pane area)
- Log mode asymmetric clamp fixed (both priceMin/priceMax use 0.01)
- Buffer reuse logic compares actual pixel dimensions (not barWidth) — prevents stale rendering after window resize

### Fixed
- hexToRgba now handles named colors, short hex (#fff), and falls back gracefully
- setVisibleRange offsetX formula corrected to match indexToX (was fromIdx-1, now calculated from barWidth)
- Tooltip uses PriceFormatter.formatPrice() instead of hardcoded toFixed(2)
- Auto-scroll detection magic number 8 replaced with named constant

## [1.0.0] - 2026-05-04

### Added
- Core candlestick rendering engine with dual-canvas architecture
- Smart resize behavior (preserves center or anchors to latest based on autoScroll)
- Crosshair with magnetic snapping, OHLC tooltip, and axis labels
- Real-time updates with sub-millisecond tick rendering (updateLastBarFast)
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
