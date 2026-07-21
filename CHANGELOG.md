# Changelog

All notable changes to this project will be documented in this file.

## [1.5.6] - 2026-07-20

### Fixed
- **Overlay labels showed minified class names** (e.g. `V4(14)`, `U4(50)`) instead of proper indicator names — `constructor.name` gets renamed by esbuild's minifier in production builds. Now uses the overlay registry's type name (`'sma'`, `'ema'`, `'bb'`, `'vwap'`, `'ichimoku'`) which is stable across minification. Labels now correctly show `SMA(20)`, `EMA(12)`, `BB(20,2)`, `VWAP`, `Ichimoku`.
- **Sub-pane crosshair tooltips all stacked on the first sub-pane** — all active sub-pane tooltips (RSI, Stoch, etc.) were drawn at the top of the first sub-pane, overlapping each other. Now each tooltip is drawn inside its own sub-pane, right-aligned (near the axis), so the indicator name label (left) and the hover-value tooltip (right) don't overlap.

### Changed
- **Overlay labels now show the current value** — e.g. `SMA(20)  42,150.5` instead of just `SMA(20)`. The latest computed value is appended using `priceFormatter.formatPrice`.
- **Sub-pane labels now show the current value** — e.g. `RSI(14)  56.7` instead of just `RSI(14)`. The latest indicator value is appended using the pane's `formatValue` method.
- **Sub-pane tooltips moved to the right side** of each sub-pane (right-aligned, near the axis) to avoid overlapping the indicator name label on the left. Shows the value at the hovered bar: `RSI(14): 54.1`.
- Bundle: 41226 → 41313 bytes gzipped (+87 bytes).

## [1.5.5] - 2026-07-20

### Fixed
- **Drawings visible in sub-pane area** — `renderDrawings()` was not clipping to the main chart area, so drawings (trendlines, boxes, text, etc.) rendered across sub-panes (RSI, MACD, Volume). Now clips to `chartBottom` (same clip as the candle buffer copy and overlays).
- **`text` drawing — text overflowed the chart** — long single lines had no wrapping and could exceed the chart width. Now the box width is constrained to the chart area, and `data.maxWidth` wraps long lines at word boundaries (greedy word-break algorithm with character-level fallback for very long words).

### Added — Text drawing options
- `data.showBackground` (boolean, default `true`) — set `false` for transparent background.
- `data.showBorder` (boolean, default `true`) — set `false` for borderless text.
- `data.borderColor` (CSS color, default: `drawing.color`) — independent border color.
- `data.textColor` (CSS color, default: `drawing.color`) — independent text color (e.g. dark border + white text).
- `data.maxWidth` (number, optional) — wrap long lines at word boundaries to fit within this width in pixels. Text height grows to accommodate wrapped lines.
- `data.showAnchorDot` (boolean, default `true`) — set `false` to hide the anchor dot unless the drawing is selected/hovered.

### Added — Label drawing options
- `data.showPrice` (boolean, default `false`) — prepend the formatted anchor price to the label text (e.g. `"42,150.50 — Support"`). Turns the label into a price-pointing annotation.

### Changed
- `DrawingData` interface: 7 new optional fields (showBackground, showBorder, borderColor, textColor, maxWidth, showAnchorDot, showPrice).
- Bundle: 40885 → 41226 bytes gzipped (+341 bytes for the wrap algorithm, clipping, and new option handling).

## [1.5.4] - 2026-07-20

### Fixed — State Persistence

- **`saveState()` now includes drawings and overlays.** Previously, user-drawn annotations (trendlines, boxes, positions) and overlay indicators (SMA, EMA, BB, VWAP, Ichimoku) were not captured in the serialized state — users lost their work on page reload. Now `saveState()` returns `{ ..., drawings: Drawing[], overlays: OverlaySnapshot[] }`.
- **`loadState()` now restores drawings and overlays.** Drawings are restored via direct internal assignment (bypassing `addDrawing()` to avoid O(n) validation + render per drawing). Overlays are reconstructed from `{ id, type, options }` snapshots via the overlay registry. Unknown overlay types are silently skipped — consumers must register custom overlay types before calling `loadState()`.
- **Schema version bumped from 1.0.0 to 1.1.0** (additive — old snapshots still load, with `drawings`/`overlays` defaulting to empty arrays). Version contract documented: major = breaking, minor = additive, patch = no shape change.
- **`migrateSnapshot(state)` helper** — upgrades a snapshot from any 1.x schema version to the current one. Returns a deep-cloned, upgraded copy. Does not mutate the input. Exported from the package.

### Added — Overlay Registry + Reset

- **`chart.registerOverlayType(type, ctor)`** — register a custom overlay type so `saveState()` can serialize it and `loadState()` can reconstruct it. Mirrors the existing `registerDrawingType()` pattern for custom drawing types. Built-in overlays (SMA, EMA, BB, VWAP, Ichimoku) self-register at module load.
- **`chart.resetState(opts?)`** — clears user-added state (drawings + overlays) in a single render call. Preserves options, data, and viewport. Defaults to clearing both; pass `{ drawings: false }` or `{ overlays: false }` to skip one.
- **`OverlaySnapshot` interface** — `{ id: string; type: string; options: Record<string, unknown> }` — the serialized form of an overlay, used by `saveState`/`loadState`.
- **`registerOverlayType` / `getOverlayType`** exported from the package — lets external code register and look up overlay constructors.

### Changed
- `ChartState` interface: `drawings?: Drawing[]` and `overlays?: OverlaySnapshot[]` are now optional fields (backward compatible with 1.0.0 snapshots).
- `Renderer.clearOverlays()` added (internal — used by `resetState` and `loadState`).
- Bundle: 40576 → 40885 bytes gzipped (+309 bytes for the overlay registry, `migrateSnapshot`, `resetState`, `registerOverlayType`, and the extended `saveState`/`loadState`).

## [1.5.3] - 2026-07-20

### Added
- **On-chart indicator labels** — each active sub-pane shows its name + key params (e.g. `RSI(14)`, `MACD(12,26,9)`) in the top-left corner. Overlay indicators (SMA, EMA, BB, VWAP, Ichimoku) show similar labels on the main chart. Canvas-rendered, no DOM overhead.
- **Right-click context menu — indicator toggles** — the existing right-click menu now includes toggle entries for all 8 sub-pane indicators (RSI, MACD, Stochastic, Williams %R, CCI, MFI, ATR, ADX), alongside the existing Volume and Grid toggles.
- **`setIndicatorOptions` API** — `chart.setIndicatorOptions(id, options)` updates a sub-pane or overlay indicator's options at runtime. For sub-panes: merges into `chart.options[id]` and re-renders. For overlays: merges into the overlay's options object in place.
- **`onIndicatorClick` callback** — `chart.onIndicatorClick = (id, type) => { ... }` fires when the user clicks an indicator label. The integrating app can use this to open a custom settings panel (`type` is `'subpane'` or `'overlay'`).

### Changed
- Bundle: 39989 → 40576 bytes gzipped (+587 bytes, +1.5%) for the indicator labels, 8 context menu entries, `setIndicatorOptions` method, and `onIndicatorClick` callback.

## [1.5.2] - 2026-07-20

### Fixed
- **Negative-value sub-pane indicators were clipped** — two bugs in the `ScalePane` base class broke MACD, CCI, and Williams %R:
  - `visibleMin` was computed as `Math.max(getMinVisible(), paneState.offset)` — `paneState.offset` defaults to 0, so `Math.max(-200, 0) = 0`, clipping the entire negative half of the indicator off-screen. Fixed to `getMinVisible() + paneState.offset` (add the pan offset instead of max'ing it). Same fix applied to `renderAxisLabel()`.
  - `formatValue()` only checked `value >= 1000` for the K/M suffix — negative values like `-50000` rendered as `-50000.00` instead of `-50.00K`. Fixed to use `Math.abs(value)` for the threshold check.
- **Williams %R** (range -100..0) never rendered at all — the entire indicator was below the clipped Y-axis minimum of 0. Now renders correctly with the full -100..0 range visible.

## [1.5.1] - 2026-07-20

### Fixed
- `getContext()` now exposes three previously-missing data blocks when `context.exposeData !== false`:
  - **Sub-pane indicator values**: RSI, MACD, Stochastic, etc. now include their computed values for the visible bars (`values: number[]`) and `latestValue`, not just metadata (show, heightPercent, scale, offset).
  - **Drawings**: all drawings (positions, trendlines, boxes, etc.) are now exposed as a flat array with their id, type, color, anchors (time/price/time2/price2), and type-specific data (side, qty, SL/TP, etc.).
  - **Overlays**: all active overlays (SMA, EMA, Bollinger Bands, VWAP, Ichimoku) are now exposed as an object keyed by overlay id, with their type, options, computed values for the visible bars, and `latestValue`. Hidden overlays (`show === false`) are skipped.

## [1.5.0] - 2026-07-20

### Added — Sub-Pane Indicators (8 indicators)
- **RSI sub-pane** — Relative Strength Index (Wilder's smoothing), 0-100 oscillator with overbought/oversold reference lines. Options: `chart.options.rsi` (period, color, overbought, oversold, showLevels, heightPercent).
- **MACD sub-pane** — MACD line + signal line + histogram. Auto-scaled Y-axis symmetric around zero. Options: `chart.options.macd` (fastPeriod, slowPeriod, signalPeriod, macdColor, signalColor, histogramUpColor, histogramDownColor).
- **Stochastic sub-pane** — %K and %D lines, 0-100 range. Supports fast (%K smoothing=1) and slow (smoothing=3) stochastic. Options: `chart.options.stochastic` (kPeriod, dPeriod, smoothK, kColor, dColor, overbought, oversold).
- **Williams %R sub-pane** — -100..0 oscillator. Options: `chart.options.williamsR`.
- **CCI sub-pane** — Commodity Channel Index, around 0, auto-scaled. Options: `chart.options.cci`.
- **MFI sub-pane** — Money Flow Index (uses volume), 0-100. Options: `chart.options.mfi`.
- **ATR sub-pane** — Average True Range, absolute values, auto-scaled. Options: `chart.options.atr`.
- **ADX sub-pane** — ADX + +DI / -DI (Directional Movement System), 3 lines + threshold at 25. Options: `chart.options.adx`.

All sub-pane indicators:
- Extend the existing `ScalePane` base class (inherit zoom/pan, separator drag, grid, axis labels, tooltip, current-value line, LLM context)
- Registered in the `Chart` constructor alongside VolumeSubPane
- Toggle via `chart.setOptions({ rsi: { show: true } })` or `chart.execute({ type: 'setSubPane', id: 'rsi', show: true })`
- Exported from the package (`RSISubPane`, `MACDSubPane`, etc.)

### Added — Overlay Indicators (4 indicators)
- **Overlay stack infrastructure** — `Overlay` interface + `chart.addOverlay(overlay)` / `chart.removeOverlay(id)` / `chart.getOverlays()`. Overlays draw on the main chart on top of candles, sharing the main price scale.
- **SMA overlay** — Simple Moving Average line. `chart.addOverlay(new SMAOverlay({ period: 20, color: '#3b82f6' }))`.
- **EMA overlay** — Exponential Moving Average line. `chart.addOverlay(new EMAOverlay({ period: 12, color: '#f59e0b' }))`.
- **Bollinger Bands overlay** — 3 lines (mid/upper/lower) + filled band region. `chart.addOverlay(new BollingerBandsOverlay({ period: 20, numStdDev: 2 }))`.
- **VWAP overlay** — Volume Weighted Average Price, daily reset by default. `chart.addOverlay(new VWAPOverlay())`.
- **Ichimoku Cloud overlay** — 5 components (Tenkan, Kijun, Senkou A, Senkou B, Chikou) + filled cloud (Kumo). `chart.addOverlay(new IchimokuCloudOverlay())`.
- `LineOverlay` abstract base class for single-line overlays (SMA, EMA, VWAP extend it).
- All overlays exported from the package.

### Added — Indicators Math Utilities
- `Indicators` namespace exported from the package with pure functions:
  - `sma(bars|values, period, field?)` — Simple Moving Average
  - `ema(bars, period, field?)` — Exponential MA (SMA-seeded)
  - `wma(bars, period, field?)` — Weighted MA (linear weights)
  - `rollingStdDev(bars|values, period, field?)` — Rolling population stdev
  - `trueRange(bar, prevClose)` — Single-bar True Range
  - `rsi(bars, period=14)` — RSI (Wilder's smoothing)
  - `macd(bars, 12, 26, 9)` — MACD line + signal + histogram
  - `stochastic(bars, 14, 3, 1)` — %K, %D (configurable slow)
  - `williamsR(bars, period=14)` — Williams %R
  - `cci(bars, period=20)` — Commodity Channel Index
  - `mfi(bars, period=14)` — Money Flow Index
  - `atr(bars, period=14)` — Average True Range
  - `adx(bars, period=14)` — ADX + +DI / -DI
- All functions are pure (no chart dependency), return `number[]` aligned with input bars, NaN where not yet defined.

### Changed
- Bundle: 33851 → 39725 bytes gzipped (+5874 bytes, +17.3%) for the indicators math utils, 8 sub-pane indicators, overlay stack infrastructure, and 4 overlay indicators.
- New exports: `Indicators` (namespace), `RSISubPane`, `MACDSubPane`, `StochasticSubPane`, `WilliamsRSubPane`, `CCISubPane`, `MFISubPane`, `ATRSubPane`, `ADXSubPane`, `Overlay`, `LineOverlay`, `SMAOverlay`, `EMAOverlay`, `BollingerBandsOverlay`, `VWAPOverlay`, `IchimokuCloudOverlay`.

### Backward Compatibility
- All existing options, APIs, and sub-panes unchanged.
- New sub-pane indicators default to `show: false` — no visual change unless explicitly enabled.
- Overlays are opt-in via `chart.addOverlay()` — no visual change unless explicitly added.

## [1.4.1] - 2026-07-20

### Fixed
- **Cursor overwritten by chart's cursor logic** — `DrawingInteraction.onMouseMove()` set the cursor when hovering a drawing handle/body, but returned `false` so `EventManager`'s cursor logic below overwrote it with `'crosshair'` or `'default'`. The user got no visual feedback when hovering a draggable drawing. Fix: `onMouseMove` now returns `true` when a drawing is hovered (consuming the event); new `hoverActive` flag + `clearHover()` method.
- **Hover state not cleared on mouseleave** — `handleMouseLeave` only reset the separator hover state; the drawing hover circle stayed drawn after the cursor left the canvas. Fix: `handleMouseLeave` now calls `drawingInteraction.clearHover()`.
- **Rubber-band preview always drew a line, even for box** — creating a `box` showed a line while dragging, then the box appeared only after the second click. Fix: the preview is now type-aware (`getDrawingPreviewShape()`): `box`/`highlighter` → dashed rectangle, `hline` → horizontal line, `vline` → vertical line, `trendline`/`measure`/`fib`/`position_closed` → line, single-point types → just a dot at p1.
- **`arrow_up` and `arrow_down` rendered with swapped directions** — pre-existing bug from the original `Renderer.renderDrawings()` switch (ported verbatim). In canvas coordinates Y increases downward, so `arrow_up` used `y+8` (point below anchor, looked like down) and `arrow_down` used `y-8` (point above, looked like up). Fix: swapped the y offsets.

### Added
- **OHLC magnet mode for drawing anchors** — new `drawing.magnet` option (default `false`) + `chart.setDrawingMagnet(enabled)` runtime toggle. When on, drawing anchors snap to the nearest Open, High, Low, or Close of the bar under the cursor during both create mode and drag. New `magnetToOHLC(chart, x, y)` helper exported from the package.
- **Crosshair cursor in create mode** — when `chart.isDrawing()` is true, the canvas cursor becomes `crosshair`, signaling placement mode.

### Changed
- `DrawingController` accessed via `(this.chart as any).drawingController` in `EventManager` — replaced with proper `IChart` methods `routeDrawingMouseDown` / `routeDrawingMouseMove` for type-safe access.
- `Renderer.previewTimeToX` — reimplemented to reuse `DataManager.getBarAtTime` (the same binary search `resolveAnchor` uses) instead of an inline duplicate. Bundle shrank by 50 bytes.
- Bundle: 33365 → 33851 bytes gzipped (+486 bytes, +1.5%) for the hover-consume fix, type-aware preview, magnet mode, crosshair cursor, and clean controller routing.

## [1.4.0] - 2026-07-20

### Added — Interactive Drawing System
- **Hit-testing + drag**: all 14 drawing types now respond to mouse interaction. Click on a drawing to select it (blue handle circles appear); drag a handle to resize/move; drag the body of a two-point drawing to move the whole drawing while preserving its shape.
- **Drawing-creation mode** (`chart.beginDrawing(type)` / `chart.cancelDrawing()` / `chart.isDrawing()`): enter a create mode for a drawing type, click on the chart to place the first anchor, move the mouse to see a dashed rubber-band preview, click again to commit. Single-point drawings (hline, vline, arrow, label, text, position, order) commit on the first click; two-point drawings (trendline, box, fib_retracement, measure, highlighter, position_closed) need two clicks.
- **Keyboard handling**: Delete/Backspace removes the selected drawing; Escape cancels an in-progress drag, deselects, or exits create mode.
- **New public API on `Chart`**:
  - `beginDrawing(type)` / `cancelDrawing()` / `isDrawing()` — create mode
  - `selectDrawing(id | null)` / `getSelectedDrawingId()` — selection state
  - `updateDrawing(id, updates)` — patch a drawing in place (used by the drag layer)
  - `getHoveredHandle()` — current hovered handle (drawingId + handleId), for renderer highlight drawing
  - `getDrawingPreview()` — in-progress drawing's preview anchors (p1 + p2Preview), for rubber-band rendering
- **Extended `DrawingRenderer` interface** with two optional methods:
  - `hitTest(x, y, chart, drawing)` — is the cursor over this drawing?
  - `getHandles(chart, drawing)` — what draggable handles does it expose?
  - New `DrawingHandle` interface: `{ id, x, y, cursor }` (id convention: `'p1'`, `'p2'`, `'body'`)
- **New `screenToAnchor(chart, x, y)` helper** — the inverse of `resolveAnchor`. Converts a screen point to chart coordinates (time + price + barIndex). Snaps X to the nearest bar center, maps Y to price via `yToPrice`. Returns null when the cursor is outside the data range.
- **New `DrawingInteraction` dispatcher** (`src/interaction/drawings.ts`) — central module that EventManager delegates to on mousedown/mousemove/mouseup. Routes events to drawings, manages drag state, updates drawing anchors in place, sets the canvas cursor based on the handle under the cursor.
- **New `DrawingController`** (`src/interaction/drawing-controller.ts`) — owns the click-to-create state machine, with per-type default colors and sensible defaults (position/order/position_closed get `side:'long', qty:1`).
- **Handle + selection rendering** in `Renderer.renderDrawings()`: selected drawing's handles drawn as small open circles; hovered handle drawn as a filled circle (uses `#4a9eff`, matching the sub-pane separator hover color).
- **Rubber-band preview** during create mode: dashed line from p1 to the cursor, with filled circles at both anchors.

### Per-Drawing-Type Interaction
| Drawing | Handles | Drag behavior |
|---------|---------|---------------|
| `hline` | 1 body (ns-resize) | Drag to change price |
| `vline` | 1 body (ew-resize) | Drag to change time |
| `arrow_up`/`arrow_down` | 1 body (move) | Drag to move anchor |
| `label` | 1 body (move) | Drag to move anchor |
| `text` | 1 body (move) | Drag to move anchor |
| `position` | 1 body (move) | Drag to move entry |
| `order` | 1 body (ns-resize) | Drag to change price |
| `trendline` | 2 endpoints (p1, p2) | Drag endpoints to resize; drag body to move whole line |
| `box` | 2 corners (p1, p2) | Drag corners to resize; drag body to move whole box |
| `measure` | 2 endpoints (p1, p2) | Drag endpoints; label updates live |
| `fib_retracement` | 2 endpoints (p1, p2) | Drag swing endpoints |
| `highlighter` | 2 edges (p1, p2, ew-resize) | Drag edges to resize time window; drag body to move |
| `position_closed` | 2 endpoints (entry, exit) | Drag either endpoint; realized PnL recomputes |

### Refactor
- `VLineRenderer`, `ArrowRenderer`, `LabelRenderer` updated to use `resolveAnchor()` for consistency with the other renderers (makes them time-anchor-aware, surviving `maxBars` cleanup). Pixel output identical for callers passing `barIndex`.
- `pointToSegmentDistance()` helper added to `TrendlineRenderer`, `MeasureRenderer`, `PositionClosedRenderer` for line hit-testing (perpendicular distance from cursor to line segment).

### Changed
- Bundle: 30401 → 33365 bytes gzipped (+2964 bytes, +9.7%) for the full interaction layer: interface extension, `screenToAnchor`, `DrawingInteraction` dispatcher, `DrawingController`, per-type `hitTest`/`getHandles` for all 14 renderers, handle/selection rendering, rubber-band preview, Delete/Escape keyboard handling.
- `IChart` interface: added `updateDrawing`, `getSelectedDrawingId`, `selectDrawing`, `getHoveredHandle`, `beginDrawing`, `cancelDrawing`, `isDrawing`, `getDrawingPreview`.
- `EventManager` now routes mousedown/mousemove to `DrawingInteraction` first (drawings take priority over chart pan/zoom), then to `DrawingController` (create mode), then falls through to the existing chart pan/zoom logic. All three return early when they consume the event.
- New keyboard listener on `window` for Delete/Escape (ignored when the target is an input/textarea/contentEditable).

### Backward Compatibility
- `addDrawing`/`removeDrawing`/`clearDrawings`/`getDrawings` unchanged.
- Existing programmatic drawings still render and are now also draggable.
- `DrawingRenderer.hitTest` and `DrawingRenderer.getHandles` are optional — custom renderers without them remain display-only.
- The 3 refactored legacy renderers (`VLine`, `Arrow`, `Label`) produce pixel-identical output for callers passing `barIndex`.

## [1.3.0] - 2026-07-19

### Added
- `onCandleClose` callback — fires once per actual candle close (when an incoming bar's timestamp differs from the last bar's, causing a new bar to be appended via `updateLastBar()` or `updateLastBarFast()`). Receives the finalized closed bar with its final O/H/L/C/volume values. Does not fire from `setData()`, `appendBar()`, or `prependData()` (bulk loads are not live closes).
- New `CandleCloseCallback` type exported from the package.
- Wired from constructor options (`onCandleClose`) and assignable as a property on the chart instance.
- `position` drawing type — renders a trading position with live unrealized PnL, optional stop-loss and take-profit lines, and a right-axis label showing side, qty, entry price, and signed PnL. PnL is recomputed every frame (including the high-frequency `updateLastBarFast` path) using `lastBar.close` as the current price. Anchored via `time` (preferred, survives `maxBars` cleanup) or `barIndex`.
- `trendline` drawing type — 2-point straight line between two anchors on the chart. Supports optional `extend` (`'none'`/`'left'`/`'right'`/`'both'`), `lineStyle` (`'solid'`/`'dashed'`/`'dotted'`), `lineWidth`, and an end-point text label. Both anchors resolved via `resolveAnchor` (prefers `time`/`time2` for stability). Works in all scale modes.
- `box` drawing type — 2-point rectangle (opposite corners) for trading ranges, supply/demand zones, and highlight regions. Supports optional `fill` (defaults to 15%-alpha of `color`), `lineStyle`, `lineWidth`, and a top-left corner label. Works in all scale modes.
- `fib_retracement` drawing type — Fibonacci retracement levels (0/23.6/38.2/50/61.8/78.6/100%) between a swing's two anchors. Direction-agnostic (works for uptrend and downtrend swings). Each level is a horizontal line between the anchor X positions with a right-axis `level% price` label. Tier-colored by default (shallow=green, mid=amber, deep=red); optional `data.fill` override and `text` header label.
- `measure` drawing type — 2-point measurement annotation showing price delta, percentage change, and bar count between two anchors. Draws a connector line, endpoint markers, and a two-line label near the second anchor (clamped to the chart area). Color-coded green/red by sign of the price delta.
- `order` drawing type — pending order (limit/stop/stop_limit/market) drawn as a dashed horizontal line at the order price with a right-axis label showing `"SIDE KIND qty @ price"` (e.g. `"BUY LIMIT 0.5 @ 42150.5"`). Complements the `position` drawing — where `position` visualizes a filled trade, `order` visualizes a resting order that hasn't filled yet. Color defaults to side-based (green for buy/long, red for sell/short), overridable via `drawing.color`.
- `text` drawing type — multi-line freeform text annotation. Distinct from the simpler `label` type (single-line, fixed 16px box, centered): `text` accepts `data.lines` (array of strings), sizes the box to content, and anchors at the top-left with auto-flip when near the right edge. Optional `data.textFill` overrides the default 10%-alpha-of-color background. Falls back to the `text` field as a single-line convenience when `data.lines` is not set.
- `highlighter` drawing type — vertical time band spanning the full chart height between two time anchors. Common uses: earnings windows, news event periods, session ranges. Unlike `box`, only the X range (time range) is user-controlled; price/price2 are ignored. Optional `data.fill` (defaults to 20%-alpha of `color`), `lineStyle`, `lineWidth`, and a top-left text label. Draws on top of candles — use low fill alpha (0.05–0.15) for readability.
- `position_closed` drawing type — closed trade with entry + exit markers, a connector line between them, entry/exit dashed lines, and a right-axis label showing side, qty, entry price, exit price, and realized PnL (green for profit, red for loss). Complements the `position` drawing: where `position` shows an open trade with live unrealized PnL, `position_closed` shows a finalized trade with fixed realized PnL computed from the two anchor prices. Useful for trade history visualization.
- Extensible drawing system:
  - `DrawingRenderer` interface — plugin contract for rendering a drawing type (mirrors the `SeriesRenderer` pattern used for series types).
  - `chart.registerDrawingType(type, renderer)` — register custom drawing types without forking the library. Overwriting built-ins is allowed.
  - `resolveAnchor(chart, spec)` helper exported — resolves `{barIndex|time, price}` to screen coordinates. Prefers `time` (survives `maxBars` auto-cleanup) over `barIndex`.
  - New `DrawingData` interface — typed bag for type-specific fields (side, qty, sl, tp, lineWidth, lineStyle, extend, fill, plus `[key: string]: unknown` for custom types).
  - `PositionRenderer` — built-in renderer for the `position` drawing type. Exported from the package.
  - `TrendlineRenderer` — built-in renderer for the `trendline` drawing type. Exported from the package.
  - `BoxRenderer` — built-in renderer for the `box` drawing type. Exported from the package.
  - `FibRetracementRenderer` — built-in renderer for the `fib_retracement` drawing type. Exported from the package.
  - `MeasureRenderer` — built-in renderer for the `measure` drawing type. Exported from the package.
  - `OrderRenderer` — built-in renderer for the `order` drawing type. Exported from the package.
  - `TextRenderer` — built-in renderer for the `text` drawing type. Exported from the package.
  - `HighlighterRenderer` — built-in renderer for the `highlighter` drawing type. Exported from the package.
  - `PositionClosedRenderer` — built-in renderer for the `position_closed` drawing type. Exported from the package.
  - `validateDrawing()` — validates drawings on `addDrawing()`. Lenient on legacy types (no regression for existing callers); strict on `position` (requires `data.side`, `data.qty`, `price`, and an anchor), `order` (requires `data.side`, `data.qty`, `data.kind`, and `price`), and `position_closed` (requires `data.side`, `data.qty`, both `price` and `price2`, and both anchors).
  - Exports: `DrawingRenderer`, `registerDrawingType`, `getDrawingRenderer`, `resolveAnchor`, `ArrowRenderer`, `LabelRenderer`, `HLineRenderer`, `VLineRenderer`, `PositionRenderer`, `TrendlineRenderer`, `BoxRenderer`, `FibRetracementRenderer`, `MeasureRenderer`, `OrderRenderer`, `TextRenderer`, `HighlighterRenderer`, `PositionClosedRenderer`.

### Changed
- `Drawing` interface restructured for extensibility:
  - `type` widens from `'arrow_up' | ... | 'vline'` union to `string` (open for plugin registration).
  - `barIndex` and `price` become optional (vline never needed price; time-based anchoring makes barIndex optional).
  - New optional fields: `time`, `time2`, `barIndex2`, `price2`, `data`.
- `Renderer.renderDrawings()` slimmed from 80-line switch statement to 12-line registry lookup. Unknown drawing types are silently skipped.
- `IChart.dataManager` interface: added `getBarAtTime(timestamp)` (already existed on concrete `DataManager` class; now part of the contract for drawing anchor resolution).
- Color/style helpers (`hexToRgba`, `NAMED_COLORS`) extracted from `Renderer` to `src/utils/style.ts` for reuse by drawing renderers. New helpers: `chartBottomEdge()`, `clampYToChartArea()`.
- Bundle: 26709 → 30401 bytes gzipped (+3692 bytes, +13.8%) for the plugin registry, 4 extracted renderers, anchor helper, validation, shared style utils, and 9 new drawing types.

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
