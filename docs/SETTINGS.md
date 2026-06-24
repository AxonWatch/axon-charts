# Settings Reference — Axon Charts v1.2.6

Complete configuration reference for all chart options. All options are optional — every field has a sensible default. Pass a `Partial<ChartOptions>` to `createChart()` or `chart.setOptions()`.

---

## Layout (11 options)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | `number \| 'auto'` | `'auto'` | Chart width in pixels. Auto uses container width. |
| `height` | `number \| 'auto'` | `'auto'` | Chart height in pixels. Auto uses container height. |
| `background` | `string` | `'#1a1a1a'` | Canvas background color (hex, rgb, or named). |
| `textColor` | `string` | `'#ffffff'` | Default text color for axis labels, tooltips, headers. |
| `fontSize` | `number` | `12` | Base font size in pixels. |
| `fontFamily` | `string` | `'system-ui'` | Font family for all text. |
| `borderVisible` | `boolean` | `false` | Show axis border lines and sub-pane vertical borders. |
| `padding.top` | `number` | `40` | Top padding (space above chart area for price labels). |
| `padding.right` | `number` | `60` | Right padding (width of price axis column). |
| `padding.bottom` | `number` | `35` | Bottom padding (height of time axis row). |
| `padding.left` | `number` | `10` | Left padding (gap from container edge to chart). |

---

## Attribution (1 option)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `show` | `boolean` | `true` | Show the Axon.Watch attribution logo at bottom-left of the chart area. Disable with `{ show: false }`. |

---

## Grid (7 options)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `show` | `boolean` | `true` | Show/hide all grid lines. |
| `vertLines.show` | `boolean` | `true` | Show vertical grid lines (time-aligned). |
| `vertLines.color` | `string` | `'#2a2a2a'` | Vertical grid line color. |
| `vertLines.width` | `number` | `1` | Vertical grid line width in pixels. |
| `horzLines.show` | `boolean` | `true` | Show horizontal grid lines (price-aligned). |
| `horzLines.color` | `string` | `'#2a2a2a'` | Horizontal grid line color. |
| `horzLines.width` | `number` | `1` | Horizontal grid line width in pixels. |

---

## Series (7 options)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | `'candlestick' \| 'line' \| 'area' \| 'bar' \| 'heiken-ashi' \| 'hollow'` | `'candlestick'` | Visualization style. Runtime-swappable. |
| `upColor` | `string` | `'#10B981'` | Bullish candle body and current price line color. |
| `downColor` | `string` | `'#E11D48'` | Bearish candle body and current price line color. |
| `lineColor` | `string` | `'#1E90FF'` | Line/area series color. Independent of upColor/downColor. |
| `showMarkers` | `boolean` | `false` | Show a dot at every close price (line/area only). |
| `showLatestPriceMarker` | `boolean` | `true` | Show highlighted marker at the latest close. |
| `showLatestPriceAnimation` | `boolean` | `true` | Animate the latest price marker with a pulse on change. |

---

## Price Scale (12 options)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'linear' \| 'logarithmic' \| 'percentage'` | `'linear'` | Price axis scaling mode. |
| `scaleMargins.top` | `number` | `0.1` | Top margin fraction (0-0.5) for price range padding. |
| `scaleMargins.bottom` | `number` | `0.1` | Bottom margin fraction (0-0.5) for price range padding. |
| `priceFormat.type` | `'price' \| 'volume' \| 'percent'` | `'price'` | Number formatting mode. |
| `priceFormat.precision` | `number` | `2` | Decimal places for price display. |
| `priceFormat.minMove` | `number` | — | Minimum price increment (derives precision when set). |
| `currentPrice.show` | `boolean` | `true` | Show/hide the entire price line and label. |
| `currentPrice.showLine` | `boolean` | `true` | Show/hide just the dashed horizontal line. |
| `currentPrice.showCountdown` | `boolean` | `false` | Show candle-close countdown timer on the price label. |
| `currentPrice.countdownColor` | `string` | `'rgba(255,255,255,0.8)'` | Countdown timer text color. |
| `currentPrice.lineStyle` | `'dashed' \| 'solid'` | `'dashed'` | Current price line style. |
| `reverse` | `boolean` | `false` | Invert price axis (high prices at bottom). |

---

## Time Scale (11 options)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `visible` | `boolean` | `true` | Show/hide the time axis row. |
| `timeVisible` | `boolean` | `true` | Show time labels on axis (vs date-only). |
| `secondsVisible` | `boolean` | `false` | Include seconds in time labels. |
| `showFullDate` | `boolean` | `true` | Crosshair: show full date string in tooltip. |
| `showDayOfWeek` | `boolean` | `true` | Prefix date with weekday (Mon, Tue...). |
| `dateFormat` | `string` | `'MMM dd, yyyy'` | Date format tokens: yyyy, yy, MMM, MM, dd. |
| `timezone` | `string` | — | IANA timezone name (e.g. 'America/New_York'). Empty = browser local. |
| `rightOffset` | `number` | `80` | Empty space on the right side in pixels. |
| `barSpacing` | `number` | `11` | Pixels per bar (zoom level). Range: minBarSpacing–maxBarSpacing. |
| `minBarSpacing` | `number` | `4` | Minimum bar spacing (zoom-in boundary). |
| `maxBarSpacing` | `number` | `1000` | Maximum bar spacing (zoom-out boundary). |

---

## Crosshair (11 options)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'normal' \| 'magnet' \| 'none'` | `'magnet'` | Crosshair interaction mode. |
| `showLabels` | `boolean` | `true` | Show crosshair axis labels (price + time). |
| `showTooltip` | `boolean` | `true` | Show OHLC tooltip on hover. |
| `vertLine.color` | `string` | `'#555555'` | Vertical crosshair line color. |
| `vertLine.width` | `number` | `1` | Vertical crosshair line width. |
| `vertLine.style` | `'solid' \| 'dashed'` | `'dashed'` | Vertical crosshair line style. |
| `horzLine.color` | `string` | `'#555555'` | Horizontal crosshair line color. |
| `horzLine.width` | `number` | `1` | Horizontal crosshair line width. |
| `horzLine.style` | `'solid' \| 'dashed'` | `'dashed'` | Horizontal crosshair line style. |
| `showLabels` | `boolean` | `true` | Show price/time labels on crosshair axes. |
| `showTooltip` | `boolean` | `true` | Show OHLC tooltip near cursor. |

---

## Behavior (6 options)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dragToZoom` | `boolean` | `true` | Drag horizontally on time axis to zoom. |
| `scrollToZoom` | `boolean` | `true` | Mouse wheel scroll to zoom. |
| `pinchToZoom` | `boolean` | `true` | Touch pinch gesture to zoom. |
| `panOnMouseDrag` | `boolean` | `true` | Drag in chart area to pan horizontally. |
| `dragPriceScale` | `boolean` | `true` | Drag on price axis to zoom price scale. |
| `autoScroll` | `boolean` | `true` | Auto-scroll to show latest bar on new data. |

---

## Data (2 options)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxBars` | `number` | `5000` | Maximum bars held in memory. Oldest bars pruned first. |
| `autoCleanup` | `boolean` | `true` | Automatically prune old bars when exceeding maxBars. |

---

## Market (6 options)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `show` | `boolean` | `false` | Show market header label (top-left). |
| `baseAsset` | `string` | `'BTC'` | Base asset name (e.g. 'BTC', 'ETH'). |
| `quoteAsset` | `string` | `'USDT'` | Quote asset name (e.g. 'USDT', 'USD'). |
| `timeframe` | `string` | `'1m'` | Chart timeframe label (e.g. '1m', '1h', '1d'). |
| `source` | `string` | `''` | Exchange or data source name. |
| `fontSize` | `number` | `15` | Market header font size in pixels. |

---

## Watermark (6 options)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `show` | `boolean` | `false` | Display watermark overlay. |
| `text` | `string` | `''` | Watermark text. Falls back to pair label (BTC/USDT) if empty. |
| `color` | `string` | `'#ffffff'` | Watermark text color. |
| `fontSize` | `number \| null` | `null` | Watermark font size. null = auto-scale to ~30% of chart width. |
| `opacity` | `number` | `0.07` | Watermark opacity (0.01–1.0). |
| `rotate` | `boolean` | `false` | Render watermark at -45° diagonal. |

---

## Volume (6 options)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `show` | `boolean` | `false` | Display volume histogram sub-pane below candles. |
| `upColor` | `string` | `'#10B981'` | Bullish volume bar color (close >= open). |
| `downColor` | `string` | `'#E11D48'` | Bearish volume bar color (close < open). |
| `heightPercent` | `number` | `0.2` | Sub-pane height as fraction of total chart height (0.05–0.5). |
| `precision` | `number \| null` | `null` | Volume decimal places. null = auto-detect from data. |
| `minMove` | `number \| null` | `null` | Minimum volume increment. Derives precision when set. |

---

## Menu (2 options)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable right-click context menu. |
| `items` | `string[] \| null` | `null` | Ordered item IDs. null = all items with auto-dividers. |

---

## Context / LLM (3 options)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `exposeData` | `boolean` | `false` | Include visible bar data in `chart.getContext()`. |
| `discoverable` | `boolean` | `true` | Register chart in `window.__AXON_CHARTS__` for AI agent discovery. |
| `id` | `string` | `'auto'` | Custom chart ID for the registry. Auto-generated if empty. |

---

## Device Pixel Ratio

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `devicePixelRatio` | `number` | `window.devicePixelRatio` | HiDPI rendering scale. Init-only (cannot be changed at runtime). |

---

**Total: 94 options across 14 categories + 1 init-only setting.**