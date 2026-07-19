# API Reference — Axon Charts v1.2.8

This document provides the complete API surface for the Axon Charts library. The library exposes an `AxonCharts` global (when loaded via script tag) or named exports (when used as an ES module).

---

## Core API

### `createChart(container, options?)`

Creates a new chart instance attached to a DOM element.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `container` | `HTMLElement \| string` | required | DOM element or CSS selector string |
| `options` | `Partial<ChartOptions>` | `{}` | Chart configuration (all fields optional) |

**Returns:** `Chart` instance

```typescript
// HTML script tag
const chart = AxonCharts.createChart('#chart', { /* options */ });

// ES module
import { createChart } from 'axon-charts';
const chart = createChart('#chart', { /* options */ });
```

---

### `generateChartId(options?)`

Generates a chart ID for the global `__AXON_CHARTS__` registry.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `options` | `ChartOptions` | `{}` | Chart options (reads `context.id` if set) |

**Returns:** `string` — opaque ID (`'ax-xxxxxx'`) or user-provided `context.id`.

```typescript
const id = generateChartId({ context: { id: 'btc-usdt' } });
// => 'btc-usdt'

const id2 = generateChartId();
// => 'ax-a1b2c3'
```

---

### `Chart` Instance Methods

#### Data Operations

```typescript
chart.setData(bars: Bar[]): void
```
Replaces all chart data with a new set of bars. Validates structural integrity (every bar must have valid time, open, high, low, close). Auto-scrolls viewport to latest bar.

```typescript
chart.appendBar(bar: Bar): void
```
Appends a new completed bar to the end. Calls `ensureRightGapAndRoll()` for auto-scroll if enabled. Fires `onDataUpdate` callback.

```typescript
chart.updateLastBar(bar: Bar): void
```
Updates the last (current/live) bar. If the timestamp doesn't match the last bar, appends a new bar internally. Fires `onDataUpdate` callback.

```typescript
chart.updateLastBarFast(bar: Bar): void
```
High-frequency tick update (10-1000 ticks/sec). Uses lightweight path:
- Skips full buffer re-render — only re-draws the last candle in buffer
- Skips grid/axis redraw unless price range expanded beyond 1.5% hysteresis
- Falls back to full render on new candle (time advanced)
- Uses a lighter render path than `updateLastBar()`. See `STREAMING.md` for details.

```typescript
chart.render(): void
```
Manually triggers a full re-render: recalculates sub-pane geometry, updates price scale, re-renders buffer, redraws background, composites viewport, draws crosshair.

```typescript
chart.getData(): Bar[]
```
Returns a shallow copy of all bars in the data manager. (Not a live reference — mutations don't affect the chart.)

```typescript
chart.getBar(index: number): Bar | undefined
```
Returns the bar at the given index, or `undefined` if out of bounds.

```typescript
chart.getBarAtTime(time: number): Bar | undefined
```
Returns the bar matching the given timestamp via binary search, or `undefined`.

```typescript
chart.getBars(startIndex: number, count: number): Bar[]
```
Returns a slice of bars starting at `startIndex` with `count` bars.

```typescript
chart.getBarsInRange(startTime: number, endTime: number): Bar[]
```
Returns all bars whose `time` falls within `[startTime, endTime]`.

#### Viewport

```typescript
chart.resize(width?: number, height?: number): void
```
Resizes the chart to specified dimensions, or reads container size if omitted.

**Smart Resize Behavior:**
- If **auto-scroll is enabled** — anchors to the latest candle
- If **auto-scroll is disabled** — preserves the visible center point
- Re-entrant calls prevented via `isResizing` guard
- `ResizeObserver` and `window.resize` events both handled with deduplication
- Skips resize if width/height haven't actually changed

```typescript
chart.getContext(): ChartContext
```
Returns a structured JSON object with current viewport state, visible bars, price range, and scale info. Designed for LLM reasoning:

```javascript
{
  viewport: {
    width, height, rightGap,
    visibleRange: { fromIndex, toIndex, fromTime, toTime },
    priceRange: { min, max },
    scales: { pricePerPixel, timePerBar, barWidth }
  },
  state: {
    id: 'ax-a1b2c3',
    version: '1.2.8',
    totalBars: 150,
    isAutoScrolling: true,
    market: { baseAsset: 'BTC', quoteAsset: 'USDT', timeframe: '1m', source: 'Binance' }
  },
  // Only if context.exposeData !== false:
  visibleBars: Bar[],
  latestBar: Bar,
  subPanes: { volume: { ... } }
}
```

```typescript
chart.scrollToLatest(): void
```
Snaps the viewport to show the latest candle at the right edge. Delegates to `eventManager.scrollToLatest()`.

```typescript
chart.isAutoScrolling(): boolean
```
Returns `true` if the viewport is currently tracking the latest candle.

```typescript
chart.triggerVisibleRangeChange(): void
```
Manually fires the `onVisibleRangeChange` callback with the current visible range. Throttled to 200ms between calls. Also called internally after resize and render.

#### LLM Control

```typescript
chart.execute(command: ChartCommand): void
```
Execute a command for LLM-driven chart control. Supported command types:

| Command | Parameters | Description |
|---------|-----------|-------------|
| `setVisibleRange` | `from: number, to: number` | Set visible time range |
| `scrollToTime` | `time: number` | Scroll to a specific timestamp (right-aligned) |
| `zoomIn` | `factor?: number` (default: 1.5) | Zoom in on time scale |
| `zoomOut` | `factor?: number` (default: 1.5) | Zoom out on time scale |
| `fitContent` | *(none)* | Fit all data in view |
| `setPriceScale` | `mode: 'linear' \| 'logarithmic' \| 'percentage'` | Switch price scale mode |
| `setCrosshair` | `mode: 'normal' \| 'magnet' \| 'none'` | Set crosshair mode |
| `setSubPane` | `id: string, show: boolean` | Toggle sub-pane visibility |
| `setReverse` | `reverse: boolean` | Invert price axis |

```typescript
chart.execute({ type: 'scrollToTime', time: 1704067200000 });
chart.execute({ type: 'setPriceScale', mode: 'logarithmic' });
chart.execute({ type: 'setSubPane', id: 'volume', show: true });
```

#### Export

```typescript
chart.toDataURL(): string
```
Export the current chart view as a PNG data URL. Merges all canvas layers (background + main + crosshair overlay).

```typescript
chart.toBlob(): Promise<Blob>
```
Export the current chart view as a PNG Blob. Same layer merge as `toDataURL()`.

#### State Persistence

```typescript
chart.saveState(): ChartState
```
Returns a serializable object with current options, data, reference price, price scale mode, reverse state, and viewport settings (offsetX, barWidth, priceScale, priceOffset).

```typescript
chart.loadState(state: ChartState): void
```
Restores options, data, and viewport from a previously saved state. Calls `setOptions()` → `setData()` → restores viewport geometry → `render()`.

#### Sub-Pane Management

```typescript
chart.addSubPane(pane: SubPane): void
chart.removeSubPane(id: string): void
chart.getSubPane(id: string): SubPane | undefined
chart.getActiveSubPanes(): SubPane[]
```
Manage sub-pane instances (indicators, volume histogram, etc.). `getActiveSubPanes()` filters to only those with `show: true`.

#### Drawing API

```typescript
chart.addDrawing(drawing: Drawing): void
chart.removeDrawing(id: string): void
chart.clearDrawings(): void
chart.getDrawings(): Drawing[]
chart.registerDrawingType(type: string, renderer: DrawingRenderer): void
```
Manage persistent chart drawings rendered on the main canvas overlay. Drawings are re-rendered every frame, including on `updateLastBarFast()` ticks, so any value derived from the latest bar (e.g. live PnL) updates automatically.

`registerDrawingType()` allows external code to add custom drawing types. After registration, drawings with that `type` value passed to `addDrawing()` will be rendered by the provided `DrawingRenderer` instance. Overwriting a built-in type is allowed (last-writer-wins).

```typescript
interface Drawing {
  id: string;            // Unique identifier
  type: string;          // 'arrow_up' | 'arrow_down' | 'label' | 'hline' | 'vline' | 'position' | <custom>
  color: string;         // CSS color (hex, rgb/rgba, or named)
  text?: string;         // Optional text (used by 'label' type)

  // === Primary anchor ===
  barIndex?: number;     // Bar index anchor (optional — prefer time for stability)
  time?: number;         // Anchor timestamp (preferred — survives maxBars auto-cleanup)
  price?: number;        // Price level at the primary anchor

  // === Secondary anchor (two-point drawings: trendline, box, fib, measure) ===
  barIndex2?: number;
  time2?: number;
  price2?: number;

  // === Type-specific payload ===
  data?: DrawingData;    // Optional bag interpreted by the drawing's renderer
}

interface DrawingData {
  // Position
  side?: 'long' | 'short';
  qty?: number;
  sl?: number;           // Stop-loss price
  tp?: number;           // Take-profit price
  status?: 'open' | 'closed' | 'pending' | 'working' | 'cancelled' | 'filled' | 'rejected';
  kind?: 'limit' | 'stop' | 'stop_limit' | 'market';   // Order type

  // Two-point drawings (trendline, box, fib, measure)
  lineWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  extend?: 'none' | 'left' | 'right' | 'both';
  fill?: string;

  // Text (multi-line annotation)
  lines?: string[];       // Each entry is one line
  textFill?: string;      // Box background (defaults to 10%-alpha of color)

  // Custom (user-registered drawing types)
  [key: string]: unknown;
}
```

**Anchoring:** prefer `time` over `barIndex` for drawings that should persist across `maxBars` auto-cleanup. When oldest bars are spliced out, `barIndex` shifts but `time` stays stable — the registry's `resolveAnchor()` helper re-resolves the bar via binary search on `time`.

**Built-in drawing types** (registered at module load):

| Type | Anchors | Description |
|------|---------|-------------|
| `arrow_up` | `{barIndex|time, price}` | Up-pointing filled triangle |
| `arrow_down` | `{barIndex|time, price}` | Down-pointing filled triangle |
| `label` | `{barIndex|time, price}` | Boxed text annotation centered on anchor |
| `hline` | `{price}` | Horizontal dashed line spanning chart width |
| `vline` | `{barIndex|time}` | Vertical dashed line spanning chart height |
| `position` | `{barIndex|time, price, data}` | Trading position with live PnL, optional SL/TP |
| `trendline` | `{barIndex|time, price, barIndex2|time2, price2, data}` | 2-point line with optional extend/lineStyle/lineWidth + end label |
| `box` | `{barIndex|time, price, barIndex2|time2, price2, data}` | 2-point rectangle (opposite corners) with fill + optional label |
| `fib_retracement` | `{barIndex|time, price, barIndex2|time2, price2, data}` | Fibonacci retracement levels (0/23.6/38.2/50/61.8/78.6/100%) between a swing's two anchors |
| `measure` | `{barIndex|time, price, barIndex2|time2, price2, data}` | 2-point measurement showing price delta, % change, and bar count |
| `order` | `{barIndex|time, price, data}` | Pending order (limit/stop/market) with side, qty, kind label |
| `text` | `{barIndex|time, price, data}` | Multi-line freeform text annotation (richer than `label`) |
| `highlighter` | `{barIndex|time, barIndex2|time2, data}` | Vertical time band spanning full chart height (earnings window, session range) |

##### `position` drawing type

Renders a trading position with live unrealized PnL. Designed for external trading apps that want to visualize open positions on the chart.

**Required fields:**
- `price` — entry price
- `data.side` — `'long'` or `'short'`
- `data.qty` — position size (positive number)
- One anchor: `time` (preferred) or `barIndex`

**Optional fields:**
- `data.sl` — stop-loss price (draws a dashed red horizontal line)
- `data.tp` — take-profit price (draws a dashed green horizontal line)
- `data.status` — `'open'` (default) / `'closed'` / `'pending'`
- `color` — entry line and label color (PnL color is auto green/red)

**Renders:**
1. Entry marker — filled circle at `(entryBarX, entryPriceY)`
2. Entry line — dashed, from entry bar's X to the right edge, at the entry price
3. Stop-loss line — dashed red, full chart width (only if `data.sl` set)
4. Take-profit line — dashed green, full chart width (only if `data.tp` set)
5. Right-axis label box — two lines:
   - Line 1: `"SIDE qty @ entryPrice"` (e.g. `"LONG 0.5 @ 42150.5"`)
   - Line 2: signed PnL (green for profit, red for loss)

**PnL is live.** `renderDrawings()` runs on every frame, including the high-frequency `updateLastBarFast()` path, so the PnL label updates with each tick using `lastBar.close` as the current price.

**Example — marking a long position:**

```typescript
chart.addDrawing({
  id: 'pos-1',
  type: 'position',
  time: 1704067200000,        // entry bar timestamp (stable across maxBars cleanup)
  price: 42150.5,             // entry price
  color: '#3b82f6',           // entry line + label color
  data: {
    side: 'long',
    qty: 0.5,
    sl: 41800,                // optional stop-loss
    tp: 43000                 // optional take-profit
  }
});
```

**Example — closing a position** (remove the drawing when filled):

```typescript
chart.removeDrawing('pos-1');
```

**Anchoring note:** prefer `time` over `barIndex` for positions. When `maxBars` auto-cleanup splices the oldest bars out, `barIndex` shifts but `time` stays stable — the renderer re-resolves the bar via binary search on `time`.

**Scale modes:** works in linear, logarithmic, and percentage modes (PnL is always computed in real price space; the label is formatted via `priceFormatter.formatPrice` which honors the chart's price format).

##### `order` drawing type

Renders a pending order on the chart. Complements the `position` drawing — where `position` visualizes a filled trade with live PnL, `order` visualizes a resting order that hasn't filled yet.

**Required fields:**
- `price` — order price
- `data.side` — `'long'` (buy order) or `'short'` (sell order)
- `data.qty` — order size (positive number)
- `data.kind` — `'limit'` / `'stop'` / `'stop_limit'` / `'market'`
- One anchor: `time` (preferred) or `barIndex` — the bar/time the order was placed

**Optional `data` fields:**
- `data.status` — `'working'` (default) / `'cancelled'` / `'filled'` / `'rejected'`

**Renders:**
1. Dashed horizontal line at the order price, from the anchor X to the right edge of the chart area
2. Right-axis label box: `"SIDE KIND qty @ price"` (e.g. `"BUY LIMIT 0.5 @ 42150.5"`, `"SELL STOP 1.0 @ 41800"`)

**Color logic:** defaults to side-based (`series.upColor` for buy/long, `series.downColor` for sell/short); override with `drawing.color`.

**Example — pending buy limit:**

```typescript
chart.addDrawing({
  id: 'ord-1',
  type: 'order',
  time: 1704067200000,
  price: 42150.5,
  data: { side: 'long', qty: 0.5, kind: 'limit' }
});
```

**When the order fills**, remove the order drawing and add a `position` drawing at the same price:

```typescript
chart.removeDrawing('ord-1');
chart.addDrawing({
  id: 'pos-1', type: 'position',
  time: 1704067200000, price: 42150.5, color: '#3b82f6',
  data: { side: 'long', qty: 0.5, sl: 41800, tp: 43000 }
});
```

##### `trendline` drawing type

Renders a straight line between two anchor points on the chart. The most-used drawing in technical analysis — support/resistance, trend channels, breakout lines.

**Required fields:**
- `price`, `price2` — prices at the two anchor points
- Two anchors: `{time|barIndex, price}` and `{time2|barIndex2, price2}` (prefer `time`/`time2` for stability)

**Optional `data` fields:**
- `data.extend` — `'none'` (default) / `'left'` / `'right'` / `'both'` — extend the line beyond the anchors to the chart boundary
- `data.lineStyle` — `'solid'` (default) / `'dashed'` / `'dotted'`
- `data.lineWidth` — stroke width in pixels (default 1)
- `text` — optional end-point label (small boxed text near the second anchor / extended end)

**Example — support trendline extending right:**

```typescript
chart.addDrawing({
  id: 'tl-1',
  type: 'trendline',
  time: 1704067200000,
  price: 42150,
  time2: 1704153600000,
  price2: 42500,
  color: '#3b82f6',
  text: 'Support',
  data: { extend: 'right', lineStyle: 'dashed', lineWidth: 1 }
});
```

**Scale modes:** works in linear, logarithmic, and percentage modes (both anchors' Y coordinates go through `priceToY`, the single source of truth).

##### `box` drawing type

Renders a rectangle between two anchor points (opposite corners). Common uses: trading ranges, supply/demand zones, pattern completion zones, highlight regions.

**Required fields:**
- `price`, `price2` — prices at the two opposite corners
- Two anchors: `{time|barIndex, price}` and `{time2|barIndex2, price2}` (prefer `time`/`time2` for stability)

**Optional `data` fields:**
- `data.fill` — CSS color for the rectangle fill (semi-transparent recommended; if omitted, defaults to a 15%-alpha version of `color`)
- `data.lineStyle` — `'solid'` (default) / `'dashed'` / `'dotted'` (border style)
- `data.lineWidth` — border width in pixels (default 1)
- `text` — optional label at the top-left corner of the box

**Example — supply zone:**

```typescript
chart.addDrawing({
  id: 'box-1',
  type: 'box',
  time: 1704067200000,
  price: 42800,
  time2: 1704153600000,
  price2: 42100,
  color: '#ef4444',
  text: 'Supply',
  data: { fill: 'rgba(239, 68, 68, 0.12)', lineStyle: 'dashed' }
});
```

**Scale modes:** works in linear, logarithmic, and percentage modes.

##### `fib_retracement` drawing type

Renders Fibonacci retracement levels between a swing's two anchor points. Anchor 1 = swing start, anchor 2 = swing end. Direction-agnostic — works for both uptrend retracements (anchor 1 low, anchor 2 high) and downtrend retracements (anchor 1 high, anchor 2 low).

**Required fields:**
- `price`, `price2` — prices at the swing start and swing end
- Two anchors: `{time|barIndex, price}` and `{time2|barIndex2, price2}` (prefer `time`/`time2` for stability)

**Optional `data` fields:**
- `data.fill` — CSS color override for all level labels (if omitted, uses tier coloring: shallow levels green, mid levels amber, deep levels red)
- `data.lineWidth` — stroke width in pixels (default 1)
- `text` — optional header label above the first level (e.g. `"Fib Retracement"`)

**Levels drawn** (horizontal lines between the two anchor X positions, each with a right-axis label showing `level% price`):

| Level | Price |
|-------|-------|
| 0% | `price2` (swing end) |
| 23.6% | `price2 + (price1 - price2) * 0.236` |
| 38.2% | `price2 + (price1 - price2) * 0.382` |
| 50% | `price2 + (price1 - price2) * 0.5` |
| 61.8% | `price2 + (price1 - price2) * 0.618` |
| 78.6% | `price2 + (price1 - price2) * 0.786` |
| 100% | `price1` (swing start) |

**Example — retracement of an uptrend swing:**

```typescript
chart.addDrawing({
  id: 'fib-1',
  type: 'fib_retracement',
  time:  1704067200000, price: 41800,   // swing low (start)
  time2: 1704153600000, price: 42900,   // swing high (end)
  color: '#3b82f6',
  text: 'Fib Retracement',
  data: { lineWidth: 1 }
});
```

**Scale modes:** works in linear, logarithmic, and percentage modes (all level Y coordinates go through `priceToY`, the single source of truth).

##### `measure` drawing type

The "drag to measure" tool. Draws a connector line between two anchor points with endpoint markers and a label showing the price delta, percentage change, and bar count between them.

**Required fields:**
- `price`, `price2` — prices at the two anchor points
- Two anchors: `{time|barIndex, price}` and `{time2|barIndex2, price2}` (prefer `time`/`time2` for stability)

**Optional `data` fields:**
- `data.lineStyle` — `'solid'` (default) / `'dashed'` / `'dotted'` (connector style)
- `data.lineWidth` — connector width in pixels (default 1)

**Renders:**
1. Connector line between the two anchors (using `color`, `lineStyle`, `lineWidth`)
2. Small filled circles at both endpoints
3. Two-line label box near the second anchor (clamped to the chart area):
   - Line 1: `+priceDelta  (+pct%)` or `-priceDelta  (-pct%)` (color-coded green/red)
   - Line 2: `N bars` (bar count between anchors, in `layout.textColor`)

**Example — measuring a swing:**

```typescript
chart.addDrawing({
  id: 'meas-1',
  type: 'measure',
  time:  1704067200000, price: 42150,
  time2: 1704153600000, price2: 42850,
  color: '#3b82f6',
  data: { lineStyle: 'dashed' }
});
// → "+700.0  (+1.66%)" / "10 bars"
```

**Scale modes:** works in linear, logarithmic, and percentage modes. PnL/delta is computed in real price space; the label is formatted via `priceFormatter.formatPrice`.

##### `text` drawing type

Renders a multi-line freeform text annotation. Distinct from the simpler `label` type:
- `label` = single-line, small fixed 16px box, centered on the anchor
- `text`  = multi-line, box sized to content, anchored at the top-left

**Required fields:**
- `price` — anchor price
- One anchor: `time` (preferred) or `barIndex`
- Either `data.lines` (array of strings) OR `text` (single line, convenience)

**Optional `data` fields:**
- `data.lines` — `string[]`, each entry is one line
- `data.textFill` — CSS color for the box background (defaults to 10%-alpha of `color`)
- `text` — single-line convenience (used only if `data.lines` is not set)

**Renders:**
1. Small dot at the anchor point (so the user can see what the text marks)
2. Box positioned with its top-left corner at the anchor, offset 4px so the dot is visible. Box flips to the left of the anchor if it would overflow the right edge; Y is clamped to the visible chart area.
3. Each line of `data.lines` drawn left-aligned, top-baseline, inside the box

**Example — multi-line note:**

```typescript
chart.addDrawing({
  id: 'note-1',
  type: 'text',
  time: 1704067200000,
  price: 42800,
  color: '#f59e0b',
  data: {
    lines: [
      'Earnings release',
      'Q3 2026',
      'Expect volatility'
    ],
    textFill: 'rgba(245, 158, 11, 0.10)'
  }
});
```

**Example — single-line (using `text` convenience field):**

```typescript
chart.addDrawing({
  id: 'note-2', type: 'text',
  time: 1704153600000, price: 41800, color: '#3b82f6',
   text: 'Support level'
});
```

##### `highlighter` drawing type

Renders a vertical highlight band spanning the full chart height between two time anchors. Common uses: earnings windows, news event periods, session ranges (London open, NY open), marking a specific bar range for attention.

Unlike `box`, `highlighter` spans the full chart height (top margin to chart bottom edge) — only the X range (time range) is user-controlled. The `price`/`price2` fields are ignored.

**Required fields:**
- Two time anchors: `{time|barIndex}` and `{time2|barIndex2}` (prefer `time`/`time2` for stability)

**Optional `data` fields:**
- `data.fill` — CSS color for the band fill (semi-transparent recommended; defaults to 20%-alpha of `color`)
- `data.lineStyle` — `'solid'` (default) / `'dashed'` / `'dotted'` (border)
- `data.lineWidth` — border width in pixels (default 1)
- `text` — optional label at the top-left of the band

**Renders:**
1. Filled rectangle from `leftX` to `rightX`, spanning `topMargin` to `chartBottomEdge`
2. Border around the rectangle (using `lineStyle`/`lineWidth`)
3. Optional boxed text label at `(left+4, top+4)`

**Note on z-order:** the band draws *on top* of candles (renderDrawings runs after the buffer copy). Use a low fill alpha (0.05–0.15) to keep candles readable through the band.

**Example — earnings window:**

```typescript
chart.addDrawing({
  id: 'hl-1',
  type: 'highlighter',
  time:  1704067200000,         // window start
  time2: 1704153600000,         // window end
  color: '#f59e0b',
  text: 'Earnings Q3',
  data: { fill: 'rgba(245, 158, 11, 0.10)', lineStyle: 'dashed' }
});
```

**Registering a custom drawing type:**

```typescript
import { DrawingRenderer } from 'axon-charts';

class FibRenderer implements DrawingRenderer {
  render(ctx, chart, drawing) {
    // Custom rendering using chart.state, chart.priceFormatter, etc.
  }
}

chart.registerDrawingType('fib', new FibRenderer());
chart.addDrawing({ id: 'f1', type: 'fib', time: ..., price: ..., color: '#888' });
```

The `DrawingRenderer` interface and the `resolveAnchor()` helper are exported from the package so custom renderers can reuse the same coordinate mapping and anchor resolution as the built-ins.

#### Events / Callbacks

All callbacks can be set either via `createChart()` options or as properties on the chart instance:

```typescript
// Via constructor options:
const chart = createChart('#container', {
  onVisibleRangeChange: (range) => { /* ... */ },
  onCrosshairMove: (param) => { /* ... */ },
});

// Via property assignment:
chart.onVisibleRangeChange = (range) => { /* ... */ };
```

```typescript
chart.onScrollLockChange?: (locked: boolean) => void
```
Callback invoked when auto-scroll state changes (locked/unlocked).

```typescript
chart.onCrosshairMove?: CrosshairMoveCallback
```
Callback invoked on crosshair position change:
```typescript
type CrosshairMoveCallback = (param: {
  time: number;
  price: number;
  bar?: Bar;
}) => void;
```

```typescript
chart.onBarClick?: BarClickCallback
```
Callback invoked when a bar is clicked:
```typescript
type BarClickCallback = (bar: Bar, index: number) => void;
```

```typescript
chart.onVisibleRangeChange?: VisibleRangeChangeCallback
```
Callback invoked when the visible range changes:
```typescript
type VisibleRangeChangeCallback = (range: {
  fromIndex: number;
  toIndex: number;
  fromTime: number;
  toTime: number;
}) => void;
```

```typescript
chart.onDataUpdate?: ((bars: Bar[]) => void) | null
```
Callback fired on every data mutation: `appendBar()`, `updateLastBar()`, and `updateLastBarFast()`. Receives the bar(s) that were updated. Designed for plugin/indicator re-evaluation.

```typescript
chart.onCandleClose?: (closedBar: Bar) => void
```
Callback fired **once per actual candle close** — when an incoming bar's timestamp differs from the last bar's timestamp, causing a new bar to be appended. Receives the finalized closed bar (its O/H/L/C/volume are the final values for that period).

Only triggered by `updateLastBar()` and `updateLastBarFast()`. Does NOT fire from `setData()`, `appendBar()`, or `prependData()` (those are bulk loads, not live closes). Useful for persisting finalized candles, triggering downstream analytics, or snapshotting chart state at period boundaries.

```typescript
chart.onCandleClose = (closedBar) => {
  console.log(`Candle closed at ${closedBar.time}: O=${closedBar.open} H=${closedBar.high} L=${closedBar.low} C=${closedBar.close}`);
};

// Or via constructor:
const chart = createChart('#container', {
  onCandleClose: (closedBar) => { archiveBar(closedBar); }
});
```

#### Configuration

```typescript
chart.prependData(bars: Bar[]): void
```
Prepends historical bars to the beginning of the chart **without shifting the viewport**. Use with `onVisibleRangeChange` to implement infinite scroll-to-past-history: when the user scrolls to bar 0, fetch more bars and call `prependData(newBars)` — the visible bars stay at the same screen positions.

```typescript
chart.setOptions(options: Partial<ChartOptions>): void
```
Updates chart options at runtime using deep merge. Validates all inputs before applying.

**Side-effect cascade:**

| Option changed | Effect |
|----------------|--------|
| `timeScale.barSpacing` | Buffer recreation + full render |
| `timeScale.rightOffset` | State update + render |
| `timeScale.visible` | Render |
| `timeScale.minBarSpacing` / `maxBarSpacing` | Stored in options (enforced in events.ts) |
| `priceScale.mode` | State update + render |
| `priceScale.priceFormat` | PriceFormatter recreate + render |
| `priceScale.reverse` | State update + render |
| `priceScale.currentPrice.*` | Countdown timer restart + render |
| `layout.width` / `height` | Full resize (ResizeObserver + dedup) |
| `layout.background` / `textColor` / `fontSize` / `fontFamily` / `borderVisible` | Render |
| `layout.padding.*` | State update + render |
| `grid.*` | Render |
| `crosshair.*` | Crosshair overlay redraw (no full render) |
| `series.type` | Series renderer swap + buffer recreate + render |
| `series.*Color` / `showMarkers` / `showLatestPriceMarker` / `showLatestPriceAnimation` | Buffer recreate + render |
| `behavior.*` | No immediate update — flags read on next event |
| `data.maxBars` | DataManager update + render |
| `data.autoCleanup` | DataManager mode update (no render) |
| `market.*` | Render |
| `watermark.*` | Render (bg canvas) |
| `context.*` | No immediate effect (read on getContext) |
| `volume.*` | State update + buffer recreation + render |
| `attribution.*` | Attribution logo show/hide update |
| `menu.*` | No immediate effect (next right-click) |

```typescript
chart.getOptions(): Readonly<ChartOptions>
```
Returns a deep-cloned snapshot of current options.

```typescript
chart.resetOptions(): void
```
Resets all options to factory defaults: `deepClone(DEFAULT_OPTIONS)`, resets `state.reverse`, `state.priceScale`, `state.priceOffset`, recreates series renderer, re-renders.

#### Lifecycle

```typescript
chart.destroy(): void
```
Cleanly destroys the chart: stops countdown timer (`cancelAnimationFrame`), removes event listeners (`resize`, `ResizeObserver`), destroys event manager (wheel, mouse, touch, keyboard), removes canvas DOM elements, destroys crosshair overlay, nullifies all references. Sets `_destroyed = true` guard.

AI agent cleanup: unregisters from `window.__AXON_CHARTS__` registry by deleting `charts[axonId]`.

---

## Component APIs

### `chart.priceScale()`

Controls the Y-axis price scale. **Type:** `PriceScaleAPI`

```typescript
chart.priceScale().setMode('linear' | 'logarithmic' | 'percentage'): void
chart.priceScale().getMode(): 'linear' | 'logarithmic' | 'percentage'
chart.priceScale().setMargins({ top: number, bottom: number }): void
chart.priceScale().getMargins(): { top: number; bottom: number }
chart.priceScale().setReverse(reverse: boolean): void
chart.priceScale().getReverse(): boolean
chart.priceScale().setOptions(options: Partial<ChartOptions['priceScale']>): void
chart.priceScale().getOptions(): PriceScaleOptions
```

**Notes:**
- `setMode('percentage')` converts prices to percentage space relative to first visible bar's open.
- `setMargins()` validates top/bottom are 0-1 range.
- `setReverse(true)` inverts axis (high at bottom, low at top).
- `setOptions()` dispatches to individual setters: mode, margins, priceFormat, currentPrice.

---

### `chart.timeScale()`

Controls the X-axis time scale. **Type:** `TimeScaleAPI`

#### Range & Zoom

```typescript
chart.timeScale().setVisibleRange(from: number, to: number): void
chart.timeScale().getVisibleRange(): { from: number; to: number }
chart.timeScale().fitContent(): void
chart.timeScale().zoomIn(factor?: number, x?: number): void
chart.timeScale().zoomOut(factor?: number, x?: number): void
```

- `setVisibleRange(from, to)` — adjusts barWidth and offsetX to fit the time range. Throws if timestamps not found or `from >= to`.
- `zoomIn(factor, x?)` — zooms toward center (default) or specified x-coordinate. Clamped by min/max barSpacing. `zoomOut()` is `zoomIn(1/factor)`.

#### Scrolling

```typescript
chart.timeScale().scrollToTime(timestamp: number, position?: 'left' | 'center' | 'right'): void
```
- `'right'` (default): Places bar at right edge
- `'center'`: Centers the bar in viewport
- `'left'`: Places bar at left edge
- Throws if timestamp not found in data.

#### Coordinate Mapping

```typescript
chart.timeScale().getCoordinate(timestamp: number): number | null
chart.timeScale().getBarIndex(x: number): number | null
chart.timeScale().getBarAtTime(timestamp: number): Bar | null
```
- `getCoordinate()` — returns screen X coordinate for a bar's timestamp.
- `getBarIndex()` — returns bar index at a screen X position (inverse of getCoordinate).
- `getBarAtTime()` — delegates to `DataManager.getBarAtTime()` (binary search).

#### Bar Spacing

```typescript
chart.timeScale().setBarSpacing(px: number): void
chart.timeScale().getBarSpacing(): number
```

#### Options

```typescript
chart.timeScale().setOptions(options: Partial<ChartOptions['timeScale']>): void
chart.timeScale().getOptions(): TimeScaleOptions
```

---

### `chart.crosshairAPI()`

Controls the crosshair overlay. **Type:** `CrosshairAPI`

#### Mode

```typescript
chart.crosshairAPI().setMode('normal' | 'magnet' | 'none'): void
chart.crosshairAPI().getMode(): 'normal' | 'magnet' | 'none'
chart.crosshairAPI().setVisible(visible: boolean): void
chart.crosshairAPI().isVisible(): boolean
```

**Modes:**
- `'none'` — Crosshair completely hidden
- `'magnet'` — Crosshair snaps to the nearest bar center
- `'normal'` — Crosshair follows mouse freely (no snap)
- `setVisible(false)` internally calls `setMode('none')`. `setVisible(true)` restores previous mode.

#### Labels & Tooltip

```typescript
chart.crosshairAPI().setShowLabels(show: boolean): void
chart.crosshairAPI().getShowLabels(): boolean
chart.crosshairAPI().setShowTooltip(show: boolean): void
chart.crosshairAPI().getShowTooltip(): boolean
```
- Labels appear on price axis (Y) and time axis (X) when crosshair is active.
- Tooltip shows OHLC values (or HA-computed values for heiken-ashi) at top-left.

#### Line Styling

```typescript
chart.crosshairAPI().setVerticalLine(options: { color?: string; width?: number; style?: 'solid' | 'dashed' }): void
chart.crosshairAPI().setHorizontalLine(options: { color?: string; width?: number; style?: 'solid' | 'dashed' }): void
chart.crosshairAPI().setOptions(options: Partial<ChartOptions['crosshair']>): void
chart.crosshairAPI().getOptions(): CrosshairOptions
```

---

## Options Reference

### `ChartOptions` Interface

All options are optional with sensible defaults.

```typescript
interface ChartOptions {
  // === Layout ===
  layout?: {
    width?: number | 'auto';          // default: 'auto'
    height?: number | 'auto';         // default: 'auto'
    background?: string;              // default: '#1a1a1a'
    textColor?: string;               // default: '#ffffff'
    fontSize?: number;                // default: 12 (1-72)
    fontFamily?: string;              // default: 'system-ui'
    padding?: { top?: number;         // default: 40
                right?: number;       // default: 60
                bottom?: number;      // default: 35
                left?: number };      // default: 10
    borderVisible?: boolean;          // default: false (axis border lines)
  };

  // === Attribution ===
  attribution?: {
    show?: boolean;                   // default: true (Axon.Watch attribution logo)
  };

  // === Grid ===
  grid?: {
    show?: boolean;                   // default: true
    vertLines?: { show?: boolean; color?: string; width?: number };
    horzLines?: { show?: boolean; color?: string; width?: number };
  };

  // === Series ===
  series?: {
    type?: 'candlestick' | 'line' | 'area' | 'bar' | 'heiken-ashi' | 'hollow';
                                       // default: 'candlestick'
    upColor?: string;                  // default: '#10B981'
    downColor?: string;                // default: '#E11D48'
    lineColor?: string;                // default: '#1E90FF' (line/area only)
    showMarkers?: boolean;             // default: false (line/area dots)
    showLatestPriceMarker?: boolean;   // default: true (latest dot)
    showLatestPriceAnimation?: boolean; // default: true (pulse on change)
  };

  // === Price Scale ===
  priceScale?: {
    mode?: 'linear' | 'logarithmic' | 'percentage';  // default: 'linear'
    scaleMargins?: { top?: number; bottom?: number };  // 0-1 range
    priceFormat?: PriceFormat;
    currentPrice?: {
      show?: boolean;                  // default: true
      showLine?: boolean;              // default: true
      showCountdown?: boolean;         // default: false
      countdownColor?: string;         // default: 'rgba(255,255,255,0.8)'
      upColor?: string;                // fallback: series.upColor
      downColor?: string;              // fallback: series.downColor
      lineStyle?: 'dashed' | 'solid';  // default: 'dashed'
      textColor?: string;              // fallback: layout.textColor
    };
    reverse?: boolean;                // default: false
  };

  // === Time Scale ===
  timeScale?: {
    visible?: boolean;                 // default: true
    timeVisible?: boolean;             // default: true
    secondsVisible?: boolean;          // default: false
    showFullDate?: boolean;            // default: true
    showDayOfWeek?: boolean;           // default: true
    dateFormat?: string;               // default: 'MMM dd, yyyy'
    timezone?: string;                 // IANA timezone (omitted = local)
    rightOffset?: number;              // default: 80
    barSpacing?: number;               // default: 11
    minBarSpacing?: number;            // default: 4
    maxBarSpacing?: number;            // default: 1000
  };

  // === Crosshair ===
  crosshair?: {
    mode?: 'normal' | 'magnet' | 'none';  // default: 'magnet'
    showLabels?: boolean;              // default: true
    showTooltip?: boolean;             // default: true
    vertLine?: { color?, width?, style? };
    horzLine?: { color?, width?, style? };
  };

  // === Right-Click Context Menu ===
  menu?: {
    enabled?: boolean;                 // default: true
    items?: string[];                  // ordered menu item IDs
  };

  // === Behavior ===
  behavior?: {
    dragToZoom?: boolean;              // default: true
    scrollToZoom?: boolean;            // default: true
    pinchToZoom?: boolean;             // default: true
    panOnMouseDrag?: boolean;          // default: true
    dragPriceScale?: boolean;          // default: true
    autoScroll?: boolean;              // default: true
  };

  // === Data ===
  data?: {
    maxBars?: number;                  // default: 5000
    autoCleanup?: boolean;             // default: true
  };

  // === Market Info ===
  market?: {
    baseAsset?: string;                // default: 'BTC'
    quoteAsset?: string;               // default: 'USDT'
    timeframe?: string;                // default: '1m'
    source?: string;                   // default: ''
    show?: boolean;                    // default: false
    fontSize?: number;                 // default: 20
  };

  // === Watermark ===
  watermark?: {
    text?: string;                     // default: '' (falls back to market pair)
    color?: string;                    // default: '#ffffff'
    fontSize?: number | null;          // default: null (auto-scale)
    opacity?: number;                  // default: 0.07
    show?: boolean;                    // default: false
    rotate?: boolean;                  // default: false
  };

  // === LLM Context ===
  context?: {
    exposeData?: boolean;              // default: false (metadata only)
    discoverable?: boolean;            // default: true (AI agent registry)
    id?: string;                       // default: auto-generated 'ax-xxxxxx'
  };

  // === Volume Sub-Pane ===
  volume?: {
    show?: boolean;                    // default: false
    upColor?: string;                  // default: '#10B981'
    downColor?: string;                // default: '#E11D48'
    heightPercent?: number;            // default: 0.2 (0.05-0.5)
    precision?: number | null;         // default: null (auto-detect)
    minMove?: number | null;           // default: null (derive precision)
  };

  // === Init-Only ===
  devicePixelRatio?: number;           // default: window.devicePixelRatio
}
```

### `PriceFormat`

```typescript
interface PriceFormat {
  type: 'price' | 'volume' | 'percent' | 'custom';
  precision?: number;
  minMove?: number;
  formatter?: (price: number) => string;
}
```

### `Bar` Data Format

```typescript
interface Bar {
  time: number;       // Timestamp in milliseconds
  open: number;       // Open price
  high: number;       // High price
  low: number;        // Low price
  close: number;      // Close price
  volume?: number;    // Optional volume (required for volume sub-pane)
}
```

### `Drawing` Data Format

```typescript
interface Drawing {
  id: string;            // Unique identifier
  type: string;          // 'arrow_up' | 'arrow_down' | 'label' | 'hline' | 'vline' | 'position' | <custom>
  color: string;         // CSS color
  text?: string;         // Optional text (used by 'label')

  // Primary anchor (one of barIndex/time required for anchored types)
  barIndex?: number;     // Bar index anchor (prefer time for stability)
  time?: number;         // Anchor timestamp (survives maxBars cleanup)
  price?: number;        // Price level

  // Secondary anchor (two-point drawings: trendline, box, fib, measure)
  barIndex2?: number;
  time2?: number;
  price2?: number;

  data?: DrawingData;    // Type-specific payload
}

interface DrawingData {
  side?: 'long' | 'short';     // Position
  qty?: number;
  sl?: number;
  tp?: number;
  status?: 'open' | 'closed' | 'pending' | 'working' | 'cancelled' | 'filled' | 'rejected';
  kind?: 'limit' | 'stop' | 'stop_limit' | 'market';   // Order
  lineWidth?: number;          // Two-point (trendline, box, fib, measure)
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  extend?: 'none' | 'left' | 'right' | 'both';
  fill?: string;
  lines?: string[];            // Text (multi-line annotation)
  textFill?: string;
  [key: string]: unknown;      // Custom types
}
```

### `ChartCommand` Type

```typescript
type ChartCommand =
  | { type: 'setVisibleRange'; from: number; to: number }
  | { type: 'scrollToTime'; time: number }
  | { type: 'zoomIn'; factor?: number }
  | { type: 'zoomOut'; factor?: number }
  | { type: 'fitContent' }
  | { type: 'setPriceScale'; mode: 'linear' | 'logarithmic' | 'percentage' }
  | { type: 'setCrosshair'; mode: 'normal' | 'magnet' | 'none' }
  | { type: 'setSubPane'; id: string; show: boolean }
  | { type: 'setReverse'; reverse: boolean };
```

### `ChartState` (Persistence)

```typescript
interface ChartState {
  version: string;
  options: Required<ChartOptions>;
  data: Bar[];
  referencePrice: number;
  priceScaleMode: 'linear' | 'logarithmic' | 'percentage';
  reverse: boolean;
  viewport: {
    offsetX: number;
    barWidth: number;
    priceScale: number;
    priceOffset: number;
  };
}
```

---

## Legacy / Deprecated Options

These are accepted for backward compatibility but mapped to the hierarchical structure:

| Legacy Option | Maps to | Status |
|---------------|---------|--------|
| `width` | `layout.width` | Supported |
| `height` | `layout.height` | Supported |
| `colors.background` | `layout.background` | Supported |
| `colors.text` | `layout.textColor` | Supported |
| `colors.grid` | `grid.vertLines.color` + `grid.horzLines.color` | Supported |
| `colors.up` | `series.upColor` | Supported |
| `colors.down` | `series.downColor` | Supported |
| `colors.crosshair` | *(direct)* Crosshair line color | Supported |
| `rightGap` | `timeScale.rightOffset` | Supported |
| `autoScroll` | `behavior.autoScroll` | Supported |
| `baseBarWidth` | `timeScale.barSpacing` | Supported |
| `timeframe` | *(none)* | Accepted but never read |
| `maxBars` | `data.maxBars` | Supported |

---

## Quick Examples

```typescript
// Create with hierarchical options
const chart = createChart('#container', {
  layout: { background: '#1a1a1a', textColor: '#ffffff' },
  grid: { vertLines: { color: '#333', width: 1 } },
  crosshair: { mode: 'magnet', showTooltip: true }
});

// Set data
chart.setData([
  { time: 1704067200000, open: 100, high: 110, low: 95, close: 105, volume: 15000 },
  { time: 1704070800000, open: 105, high: 112, low: 100, close: 108, volume: 22000 }
]);

// Use component APIs
chart.priceScale().setMode('logarithmic');
chart.timeScale().fitContent();
chart.crosshairAPI().setMode('normal');

// Add volume sub-pane
chart.setOptions({ volume: { show: true, heightPercent: 0.25 } });

// Market header
chart.setOptions({
  market: { baseAsset: 'BTC', quoteAsset: 'USDT', timeframe: '1m', source: 'Binance', show: true }
});

// Watermark
chart.setOptions({ watermark: { text: 'AXON CHARTS', show: true, opacity: 0.05 } });

// Line series with independent color
chart.setOptions({
  series: { type: 'line', lineColor: '#FF6B35', showMarkers: true }
});

// LLM integration
const context = chart.getContext();
chart.execute({ type: 'scrollToTime', time: 1704067200000 });
chart.execute({ type: 'setCrosshair', mode: 'none' });
chart.execute({ type: 'setReverse', reverse: true });
chart.execute({ type: 'setSubPane', id: 'volume', show: true });

// Drawing API
chart.addDrawing({
  id: 'ann1', type: 'arrow_up', barIndex: 5, price: 108, color: '#22c55e', text: 'Breakout'
});
chart.addDrawing({
  id: 'ann2', type: 'hline', barIndex: 0, price: 95, color: '#ef4444'
});

// Position with live PnL, SL, TP
chart.addDrawing({
  id: 'pos-1', type: 'position',
  time: 1704067200000, price: 42150.5, color: '#3b82f6',
  data: { side: 'long', qty: 0.5, sl: 41800, tp: 43000 }
});

// Pending buy limit order
chart.addDrawing({
  id: 'ord-1', type: 'order',
  time: 1704067200000, price: 42150.5,
  data: { side: 'long', qty: 0.5, kind: 'limit' }
});

// Trendline extending right with a label
chart.addDrawing({
  id: 'tl-1', type: 'trendline',
  time: 1704067200000, price: 42150,
  time2: 1704153600000, price2: 42500,
  color: '#3b82f6', text: 'Support',
  data: { extend: 'right', lineStyle: 'dashed' }
});

// Box marking a supply zone
chart.addDrawing({
  id: 'box-1', type: 'box',
  time: 1704067200000, price: 42800,
  time2: 1704153600000, price2: 42100,
  color: '#ef4444', text: 'Supply',
  data: { fill: 'rgba(239, 68, 68, 0.12)', lineStyle: 'dashed' }
});

// Fibonacci retracement of an uptrend swing
chart.addDrawing({
  id: 'fib-1', type: 'fib_retracement',
  time: 1704067200000, price: 41800,
  time2: 1704153600000, price2: 42900,
  color: '#3b82f6', text: 'Fib Retracement'
});

// Measure a swing
chart.addDrawing({
  id: 'meas-1', type: 'measure',
  time: 1704067200000, price: 42150,
  time2: 1704153600000, price2: 42850,
  color: '#3b82f6',
  data: { lineStyle: 'dashed' }
});

// Multi-line text annotation
chart.addDrawing({
  id: 'note-1', type: 'text',
  time: 1704067200000, price: 42800, color: '#f59e0b',
  data: { lines: ['Earnings release', 'Q3 2026', 'Expect volatility'] }
});

// Highlighter marking an earnings window
chart.addDrawing({
  id: 'hl-1', type: 'highlighter',
  time: 1704067200000, time2: 1704153600000,
  color: '#f59e0b', text: 'Earnings Q3',
  data: { fill: 'rgba(245, 158, 11, 0.10)', lineStyle: 'dashed' }
});

// Custom drawing type
chart.registerDrawingType('fib', new FibRenderer());
chart.addDrawing({ id: 'f1', type: 'fib', time: ..., price: ..., color: '#888' });

// Events
chart.onCrosshairMove(({ time, price, bar }) => {
  console.log(`At cursor: $${price}`);
});

chart.onBarClick((bar, index) => {
  console.log(`Bar ${index}: O=${bar.open} H=${bar.high} L=${bar.low} C=${bar.close}`);
});

chart.onVisibleRangeChange((range) => {
  console.log(`View: bars ${range.fromIndex}-${range.toIndex}`);
});

chart.onDataUpdate((bars) => {
  console.log('Data updated:', bars);
});

// Streaming
chart.updateLastBarFast({ time: Date.now(), open: 105, high: 108, low: 104, close: 107, volume: 5000 });

// Export
const dataUrl = chart.toDataURL();
const blob = await chart.toBlob();

// Persistence
const state = chart.saveState();
// ... later ...
chart.loadState(state);

// Cleanup
chart.destroy();
```

---

## Volume Sub-Pane API

The volume sub-pane displays a histogram below the main chart with its own Y-axis.

### Configuration
```typescript
chart.setOptions({
  volume: {
    show: true,             // Toggle visibility
    upColor: '#22c55e',     // Green for up bars
    downColor: '#ef4444',   // Red for down bars
    heightPercent: 0.2,     // 20% of chart height (0.05-0.5)
    precision: 0,           // Optional: force 0 decimal places
    minMove: 1              // Optional: derive precision (1 → 0 decimals)
  }
});
```

### Interaction
- **Scroll wheel** on sub-pane axis: zoom volume Y-scale (1x-10x)
- **Drag** on sub-pane axis: adjust volume scale (up = zoom out, down = zoom in)
- **Double-click** on sub-pane axis: reset zoom/offset to defaults
- **Draggable separator**: click within 6px of separator line and drag up/down to resize
- **Volume tooltip**: shows at top-left of sub-pane with K/M formatting

### Notes
- Bars are colored per candle direction using the same up/down colors as candles
- Crosshair spans full chart height including sub-pane
- Vertical grid lines align with main chart via same `calculateTimeStep()` function
- Data must include `volume` field on Bar objects (optional, defaults to 0)
- Precision auto-detected from data values when `precision: null`

---

## AI Agent Integration

Axon Charts automatically registers in `window.__AXON_CHARTS__` for AI agent discovery:

```javascript
// Global registry structure
window.__AXON_CHARTS__ = {
  version: '1.2.8',
  charts: {
    'ax-a1b2c3': chartInstance,   // Keyed by axonId
    'btc-usdt': chartInstance       // User-provided context.id
  }
};
```

- Each chart instance has a `data-axon-charts-id` attribute on its container element.
- `context.discoverable: false` disables registration (stealth mode).
- `context.id` provides a human-readable identifier.
- Use `chart.getContext()` for LLM-friendly chart state introspection.
- Use `chart.execute()` for LLM-driven chart control.

---

## Exported Types & Classes

All exported from the package entry point:

| Export | Type | Description |
|--------|------|-------------|
| `createChart` | function | Create a new chart instance |
| `generateChartId` | function | Generate or resolve chart ID |
| `Chart` | class | Main chart class |
| `DataManager` | class | Data storage and management |
| `Renderer` | class | Canvas rendering engine |
| `Crosshair` | class | Crosshair overlay |
| `Axes` | class | Grid and axis rendering |
| `EventManager` | class | Mouse/touch/keyboard events |
| `PriceScaleAPI` | class | Price scale control API |
| `TimeScaleAPI` | class | Time scale control API |
| `CrosshairAPI` | class | Crosshair control API |
| `SubPane` | interface | Sub-pane contract |
| `ScalePane` | class | Abstract scale pane base |
| `VolumeSubPane` | class | Volume histogram sub-pane |
| `DrawingRenderer` | interface | Drawing plugin contract |
| `registerDrawingType` | function | Register custom drawing type |
| `getDrawingRenderer` | function | Look up renderer by type |
| `resolveAnchor` | function | Resolve {time\|barIndex, price} → screen coords |
| `ArrowRenderer` | class | Built-in arrow drawing renderer |
| `LabelRenderer` | class | Built-in label drawing renderer |
| `HLineRenderer` | class | Built-in hline drawing renderer |
| `VLineRenderer` | class | Built-in vline drawing renderer |
| `PositionRenderer` | class | Built-in position drawing renderer |
| `TrendlineRenderer` | class | Built-in trendline drawing renderer |
| `BoxRenderer` | class | Built-in box drawing renderer |
| `FibRetracementRenderer` | class | Built-in fib_retracement drawing renderer |
| `MeasureRenderer` | class | Built-in measure drawing renderer |
| `OrderRenderer` | class | Built-in order drawing renderer |
| `TextRenderer` | class | Built-in text drawing renderer |
| `HighlighterRenderer` | class | Built-in highlighter drawing renderer |
| `Bar` | interface | OHLCV data type |
| `ChartOptions` | interface | Full options schema |
| `PriceFormat` | interface | Price formatting |
| `ChartCommand` | type | LLM command union |
| `ChartState` | interface | Persistence format |
| `Drawing` | interface | Extensible drawing data type |
| `DrawingData` | interface | Type-specific drawing payload |
| `LAYOUT` | const | Layout constants |
| `ValidationError` | class | Option validation error |
| `Projection` | namespace | priceToY, yToPrice, indexToX, xToIndex |