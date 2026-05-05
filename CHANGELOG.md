# Changelog

All notable changes to this project will be documented in this file.

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
- Deprecated option cleanup (13 dead fields removed)

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
- getBarAtTime uses O(n) → DataManager helper for binary search
- onVisibleRangeChange no longer fires duplicate callbacks
- Unknown command types throw proper error instead of silent ignore

### Technical
- Bundle size: 17.6KB gzipped
- Zero external dependencies
- Apache-2.0 licensed
