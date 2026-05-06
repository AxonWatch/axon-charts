import { LAYOUT } from '../core/layout.js';
import { deriveVisibleStartIdx, clampOffsetX, xToIndex, indexToX, calculateRightEdgeOffset } from '../utils/projection.js';
import { IChart } from '../types/index.js';

/**
 * Handles mouse and touch interactions for the chart
 */
export class EventManager {
  private chart: IChart;
  private isDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private lastTouchDistance: number = 0;
  private autoScrollEnabled: boolean = true;
  private _separatorWasHovered: boolean = false;
  private contextMenuActive: boolean = false;
  private _contextMenu: HTMLDivElement | undefined;
  private _contextMenuDismiss: ((e: MouseEvent) => void) | undefined;
  private dragMode: 'chart' | 'price' | 'time' | 'subPane' | 'separator' = 'chart';
  private activePane?: import('../subpanes/SubPane.js').SubPane;
  private rafId: number | null = null;

  constructor(chart: IChart) {
    this.chart = chart;
    this.setupEventListeners();
  }

  /**
   * Request a throttled render using RAF
   */
  private requestRender(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.chart.render();
      this.rafId = null;
    });
  }

  /**
   * Set up all event listeners
   */
  private setupEventListeners(): void {
    const mainCanvas = this.chart.mainCanvas;

    // Mouse events
    mainCanvas.addEventListener('wheel', this.handleWheel);
    mainCanvas.addEventListener('mousedown', this.handleMouseDown);
    mainCanvas.addEventListener('dblclick', this.handleDblClick);
    mainCanvas.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);

    // Touch events
    mainCanvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    mainCanvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    mainCanvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    mainCanvas.addEventListener('mouseleave', this.handleMouseLeave);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
  }

  /**
   * Handle double click
   */
  private handleDblClick = (e: MouseEvent): void => {
    const { w, h, axisWidth, bottomMargin, chartBottom } = this.chart.state;
    const chartAreaWidth = w - axisWidth;

    // Use client coordinates for consistency
    const rect = this.chart.mainCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // If double-clicked on Price Axis (main chart area only, not sub-pane axis), reset vertical zoom AND offset
    if (mouseX > chartAreaWidth && mouseY <= chartBottom) {
      this.chart.state.priceScale = 1.0;
      this.chart.state.priceOffset = 0;
      this.chart.render();
    }

    // If double-clicked on separator line, reset sub-pane height to default (20%)
    let currentTop = chartBottom;
    for (const pane of (this.chart as any).getActiveSubPanes()) {
      const subPaneHeight = pane.computeHeight(this.chart.state, pane.getOptions());
      const SEPARATOR_HIT = 6;
      const isOverSeparator = mouseY > currentTop - SEPARATOR_HIT && mouseY < currentTop + SEPARATOR_HIT;
      if (isOverSeparator) {
        const opts = pane.getOptions();
        if (opts) opts.heightPercent = 0.2;
        this.chart.render();
        return;
      }

      // If double-clicked on sub-pane axis area, reset zoom/scale
      const isOverThisPane = mouseY > currentTop && mouseY <= currentTop + subPaneHeight;
      const isOverAxis = mouseX > chartAreaWidth;

      if (isOverThisPane && isOverAxis) {
        pane.handleDblClick(this.chart);
        this.chart.render();
        return;
      }

      currentTop += subPaneHeight;
    }

    // If double-clicked on Time Axis, reset horizontal zoom to default
    if (mouseY > h - bottomMargin) {
      this.chart.state.barWidth = this.chart.state.baseBarWidth;
      this.chart.renderer.createBuffer();
      this.scrollToLatest();
    }
  }



  /**
   * Handle right-click: show custom context menu with chart export options
   */
  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();

    // Check if right-click menu is disabled
    if (!this.chart.options.menu.enabled) {
      return;
    }

    // Remove any existing context menu first
    this.removeContextMenu();

    const menu = document.createElement('div');
    menu.id = 'axon-context-menu';

    // Smart positioning: stay within viewport bounds
    const menuWidth = 200;
    const approxMenuHeight = 210;
    let leftPos = e.clientX;
    let topPos = e.clientY;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    if (leftPos + menuWidth > winW) leftPos = winW - menuWidth - 10;
    if (topPos + approxMenuHeight > winH) topPos = winH - approxMenuHeight - 10;
    if (leftPos < 10) leftPos = 10;
    if (topPos < 10) topPos = 10;

    menu.style.cssText = [
      'position: fixed',
      'z-index: 99999',
      'background: #1e1e1e',
      'border: 1px solid #444',
      'border-radius: 6px',
      'padding: 4px 0',
      'min-width: ' + menuWidth + 'px',
      'box-shadow: 0 4px 16px rgba(0,0,0,0.4)',
      'font-family: system-ui, sans-serif',
      'font-size: 13px',
      'left: ' + leftPos + 'px',
      'top: ' + topPos + 'px'
    ].join(';');

    // Helper to create menu items
    const makeItem = (text, fn) => {
      const el = document.createElement('div');
      el.textContent = text;
      el.style.cssText = [
        'padding: 8px 16px',
        'cursor: pointer',
        'color: #ccc',
        'display: flex',
        'align-items: center',
        'gap: 8px',
        'white-space: nowrap'
      ].join(';');
      el.addEventListener('mouseenter', () => { el.style.background = '#333'; });
      el.addEventListener('mouseleave', () => { el.style.background = 'transparent'; });
      el.addEventListener('click', (ev2) => {
        ev2.stopPropagation();
        fn();
        this.removeContextMenu();
      });
      return el;
    }
    const makeDivider = () => {
      const d = document.createElement('div');
      d.style.cssText = 'height: 1px; background: #333; margin: 4px 0;';
      return d;
    }

    menu.appendChild(makeItem('Copy Chart Image', () => this.copyChartToClipboard()));
    menu.appendChild(makeItem('Save Chart Image As...', () => this.saveChartImage()));
    menu.appendChild(makeDivider());

    const opts = this.chart.options;

    // Toggle view states using setOptions — menu auto-updates on re-open
    const makeToggle = (text, checked, partial) => {
      const el = document.createElement('div');
      el.textContent = (checked ? '✓ ' : '  ') + text;
      el.style.cssText = [
        'padding: 8px 16px',
        'cursor: pointer',
        'color: #ccc',
        'display: flex',
        'align-items: center',
        'gap: 8px',
        'white-space: nowrap',
        'font-family: monospace'
      ].join(';');
      el.addEventListener('mouseenter', () => { el.style.background = '#333'; });
      el.addEventListener('mouseleave', () => { el.style.background = 'transparent'; });
      el.addEventListener('click', (ev2) => {
        ev2.stopPropagation();
        this.removeContextMenu();
        this.chart.setOptions(partial);
      });
      return el;
    };

    menu.appendChild(makeToggle('Grid', opts.grid.show, { grid: { show: !opts.grid.show } }));
    menu.appendChild(makeToggle('Volume', opts.volume.show, { volume: { show: !opts.volume.show } }));
    menu.appendChild(makeToggle('Crosshair', opts.crosshair.mode !== 'none', { crosshair: { mode: opts.crosshair.mode !== 'none' ? 'none' : 'magnet' } }));
    menu.appendChild(makeToggle('Market Header', opts.market.show, { market: { show: !opts.market.show } }));
    menu.appendChild(makeToggle('Watermark', opts.watermark.show, { watermark: { show: !opts.watermark.show } }));
    menu.appendChild(makeDivider());
    menu.appendChild(makeItem('Fit Content', () => {
      this.chart.timeScale().fitContent();
    }));
    menu.appendChild(makeItem('Reset Price Scale', () => {
      this.chart.state.priceScale = 1.0;
      this.chart.state.priceOffset = 0;
      this.chart.render();
    }));
    menu.appendChild(makeToggle('Reverse Price Scale', opts.priceScale.reverse, { priceScale: { reverse: !opts.priceScale.reverse } }));
    menu.appendChild(makeDivider());

    // Fullscreen toggle
    const isFull = !!document.fullscreenElement;
    menu.appendChild(makeItem(isFull ? 'Exit Fullscreen' : 'Fullscreen', () => {
      this.removeContextMenu();
      this.toggleFullscreen();
    }));

    // Append to container (not document.body) so menu is visible in fullscreen mode
    this.chart.container.appendChild(menu);

    // Track for cleanup
    this._contextMenu = menu;

    // Close on any click outside
    this._contextMenuDismiss = (ev2: MouseEvent) => {
      if (menu && !menu.contains(ev2.target as Node)) {
        this.removeContextMenu();
      }
    };
    // Use setTimeout to avoid the current mousedown closing it immediately
    setTimeout(() => {
      document.addEventListener('mousedown', this._contextMenuDismiss);
    }, 0);
  }

  /**
   * Remove the custom context menu from the DOM
   */
  private removeContextMenu(): void {
    if (this._contextMenuDismiss) {
      document.removeEventListener('mousedown', this._contextMenuDismiss);
      this._contextMenuDismiss = undefined;
    }
    if (this._contextMenu) {
      this._contextMenu.remove();
      this._contextMenu = undefined;
    }
  }

  /**
   * Copy chart image to clipboard
   */
  private toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      const el = this.chart.container;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  private copyChartToClipboard(): void {
    try {
      const chart = (this.chart as any);
      if (typeof chart.toDataURL === 'function') {
        const dataUrl = chart.toDataURL();
        // Use chart.toBlob() for clipboard (avoids Image() load latency)
        chart.toBlob().then(function(blob) {
          if (blob) {
            navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]).catch(function() {});
          }
        }).catch(function() {});
      }
    } catch (err) {
      // Clipboard may not be available
    }
  }

  /**
   * Save chart image as PNG file
   */
  private saveChartImage(): void {
    try {
      const chart = (this.chart as any);
      if (typeof chart.toDataURL === 'function') {
        const dataUrl = chart.toDataURL();
        const link = document.createElement('a');
        link.download = 'chart-' + Date.now() + '.png';
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      // Download may fail in some contexts
    }
  }
  /**
   * Handle wheel zoom
   */
  private handleWheel = (e: WheelEvent): void => {
    // Guard: Check if scroll-to-zoom is disabled
    if (!this.chart.options.behavior.scrollToZoom) return;

    e.preventDefault();
    const factor = e.deltaY > 0 ? LAYOUT.ZOOM_FACTOR_OUT : LAYOUT.ZOOM_FACTOR_IN;
    const { w, h, rightGap, axisWidth, bottomMargin, chartBottom } = this.chart.state;
    const chartAreaWidth = w - axisWidth;
    const chartBottomEdge = chartBottom || (h - bottomMargin);

    // Use client coordinates for consistency
    const rect = this.chart.mainCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Price Axis Zoom (only on main chart price axis, not sub-pane axis)
    if (mouseX > chartAreaWidth && mouseY <= chartBottomEdge) {
      this.chart.state.priceScale *= (e.deltaY > 0 ? LAYOUT.PRICE_SCROLL_FACTOR_IN : LAYOUT.PRICE_SCROLL_FACTOR_OUT);
      this.chart.state.priceScale = Math.max(0.1, Math.min(this.chart.state.priceScale, 10));
      this.chart.render();
      return;
    }

    // === NEW: Sub-pane axis zoom ===
    let currentTop = chartBottomEdge;
    for (const pane of (this.chart as any).getActiveSubPanes()) {
      const subPaneHeight = pane.computeHeight(this.chart.state, pane.getOptions());
      const isOverThisPane = mouseY > currentTop && mouseY <= currentTop + subPaneHeight;
      const isOverAxis = mouseX > chartAreaWidth;

      if (isOverThisPane && isOverAxis && pane.handleWheel(this.chart, e.deltaY)) {
        this.chart.render();
        return;
      }

      currentTop += subPaneHeight;
    }

    // Horizontal Zoom (time axis only, not sub-pane)
    const isTimeAxis = mouseY > h - bottomMargin;
    const oldWidth = this.chart.state.barWidth;
    const maxBarWidth = Math.min(1000, Math.floor(chartAreaWidth / LAYOUT.MAX_ZOOM_DIVISOR));
    const newWidth = oldWidth * factor;

    if (newWidth < LAYOUT.MIN_BAR_WIDTH || newWidth > maxBarWidth) return;

    // Use raw unclamped index so zoom stays smooth when mouse is in empty gap.
    // For naturalOffset: keep pixel under mouse fixed (raw index - smooth across gaps).
    // For centeredOffset: use clamped index so at max zoom the edge candle centers.
    const rawMouseIdx = isTimeAxis ? this.chart.dataManager.length - 1 : xToIndex(mouseX, this.chart.state);
    const clampedMouseIdx = Math.max(0, Math.min(rawMouseIdx, this.chart.dataManager.length - 1));

    this.chart.state.barWidth = newWidth;

    const zoomStart = 50; 
    const weight = Math.max(0, (newWidth - zoomStart) / Math.max(1, maxBarWidth - zoomStart));
    const naturalOffset = mouseX - (rawMouseIdx * newWidth) - (newWidth / 2);
    const centeredOffset = (chartAreaWidth / 2) - (clampedMouseIdx * newWidth) - (newWidth / 2);

    this.chart.state.offsetX = (naturalOffset * (1 - weight)) + (centeredOffset * weight);
    const maxOffsetX = chartAreaWidth - (this.chart.state.barWidth * 2);
    this.chart.state.offsetX = Math.min(maxOffsetX, this.chart.state.offsetX);

    this.checkAutoScrollState();
    this.requestRender();
    this.chart.triggerVisibleRangeChange();
  }

  private handleMouseDown = (e: MouseEvent): void => {
    const { w, h, axisWidth, bottomMargin, chartBottom } = this.chart.state;
    const chartAreaWidth = w - axisWidth;
    const chartBottomEdge = chartBottom || (h - bottomMargin);

    // Use client coordinates for consistency
    const rect = this.chart.mainCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.isDragging = true;
    this.lastMouseX = mouseX;
    this.lastMouseY = mouseY;

    if (mouseX > chartAreaWidth && mouseY <= chartBottomEdge) {
      this.dragMode = 'price';
    } else if (mouseY > chartBottomEdge && mouseY <= h - bottomMargin) {
      // === NEW: Check for separator drag or sub-pane axis drag ===
      const SEPARATOR_DRAG_THRESHOLD = 6;
      if (Math.abs(mouseY - chartBottomEdge) < SEPARATOR_DRAG_THRESHOLD) {
        this.dragMode = 'separator';
      } else {
        // Check if over any sub-pane axis
        let currentTop = chartBottomEdge;
        let foundPane = false;
        for (const pane of (this.chart as any).getActiveSubPanes()) {
          const subPaneHeight = pane.computeHeight(this.chart.state, pane.getOptions());
          const isOverThisPane = mouseY > currentTop && mouseY <= currentTop + subPaneHeight;
          const isOverAxis = mouseX > chartAreaWidth;

          if (isOverThisPane && isOverAxis) {
            this.dragMode = 'subPane';
            this.activePane = pane;
            foundPane = true;
            break;
          }

          currentTop += subPaneHeight;
        }

        if (!foundPane) {
          this.dragMode = 'chart';
        }
      }
    } else if (mouseY > h - bottomMargin) {
      this.dragMode = 'time';
    } else {
      this.dragMode = 'chart';

      // Trigger onBarClick callback when clicking in chart area
      if (this.chart.onBarClick) {
        const barIndex = xToIndex(mouseX, this.chart.state);
        const bar = this.chart.dataManager.data[barIndex];
        if (bar) {
          this.chart.onBarClick(bar, barIndex);
        }
      }
    }
  }

  private handleMouseUp = (): void => {
    this.isDragging = false;

    // After drag ends, update auto-scroll state based on where the user
    // left the chart. Do NOT snap the latest bar back to the right edge —
    // the user chose this position. `ensureRightGapAndRoll` handles
    // auto-scroll forward when new data arrives.
    this.chart.render();
    this.checkAutoScrollState();
  }

  private handleMouseMove = (e: MouseEvent): void => {
    const { w, h, rightGap, barWidth, axisWidth, bottomMargin, chartBottom } = this.chart.state;
    const chartAreaWidth = w - axisWidth;
    const chartBottomEdge = chartBottom || (h - bottomMargin);

    // Use client coordinates with getBoundingClientRect for consistent positioning
    // even when mouse is outside the chart area
    const rect = this.chart.mainCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const isOverPrice = mouseX > chartAreaWidth && mouseY <= chartBottomEdge;
    const isOverTime = mouseY > h - bottomMargin;
    const isOverSubPane = mouseY > chartBottomEdge && mouseY <= h - bottomMargin;
    const SEPARATOR_HIT_THRESHOLD = 6;
    const isNearSeparator = isOverSubPane && Math.abs(mouseY - chartBottomEdge) < SEPARATOR_HIT_THRESHOLD;

    // Check if over any sub-pane axis, and update separator hover state
    let isOverSubPaneAxis = false;
    let separatorHovered = false;
    let currentTop = chartBottomEdge;
    // Reset all pane separator hover states before checking
    for (const pane of (this.chart as any).getActiveSubPanes()) {
      pane.separatorHovered = false;
    }
    for (const pane of (this.chart as any).getActiveSubPanes()) {
      const subPaneHeight = pane.computeHeight(this.chart.state, pane.getOptions());
      const isOverThisPane = mouseY > currentTop && mouseY <= currentTop + subPaneHeight;
      const isOverAxis = mouseX > chartAreaWidth;

      if (isOverThisPane && isOverAxis) {
        isOverSubPaneAxis = true;
      }

      // Check if mouse is near the separator line (6px hit zone above the pane)
      const SEP_HIT = 6;
      if (Math.abs(mouseY - currentTop) < SEP_HIT && mouseY >= 0) {
        pane.separatorHovered = true;
      }

      if (isOverThisPane && isOverAxis) break;

      currentTop += subPaneHeight;
    }

    // Trigger render when separator hover state changes (highlight on/off)
    if (separatorHovered !== this._separatorWasHovered) {
      this._separatorWasHovered = separatorHovered;
      this.requestRender();
    }

    // Update cursor based on enabled behaviors
    if (isOverPrice) {
      // Only show resize cursor if dragPriceScale is enabled
      this.chart.mainCanvas.style.cursor = this.chart.options.behavior.dragPriceScale ? 'ns-resize' : 'default';
    } else if (isOverSubPaneAxis) {
      this.chart.mainCanvas.style.cursor = 'ns-resize';
    } else if (isNearSeparator) {
      this.chart.mainCanvas.style.cursor = 'ns-resize';
    } else if (isOverTime) {
      // Only show resize cursor if dragToZoom is enabled
      this.chart.mainCanvas.style.cursor = this.chart.options.behavior.dragToZoom ? 'ew-resize' : 'default';
    } else if (this.chart.options.crosshair.mode === 'none') {
      // Crosshair disabled → regular cursor
      this.chart.mainCanvas.style.cursor = 'default';
    } else {
      this.chart.mainCanvas.style.cursor = 'crosshair';
    }

    if (!this.isDragging) return;

    if (this.dragMode === 'price') {
      // Guard: Check if price-scale drag is disabled
      if (!this.chart.options.behavior.dragPriceScale) return;

      const deltaY = mouseY - this.lastMouseY;
      this.chart.state.priceScale *= (1 + deltaY / LAYOUT.DRAG_SCALE_DIVISOR);
      this.chart.state.priceScale = Math.max(0.1, Math.min(this.chart.state.priceScale, 10));
    } else if (this.dragMode === 'subPane' && this.activePane) {
      // Generic sub-pane drag (zoom/scale)
      const deltaY = mouseY - this.lastMouseY;
      this.activePane.handleDrag(this.chart, deltaY);
    } else if (this.dragMode === 'separator') {
      // Dragging separator resizes the first active sub-pane
      const deltaY = mouseY - this.lastMouseY;
      const firstPane = (this.chart as any).getActiveSubPanes()[0];
      if (firstPane) {
        firstPane.handleSeparatorDrag(this.chart, deltaY, this.chart.state.h);
      }
    } else if (this.dragMode === 'time') {
      // Guard: Check if drag-to-zoom is disabled
      if (!this.chart.options.behavior.dragToZoom) return;

            const deltaX = mouseX - this.lastMouseX;
      const maxBarWidth = Math.min(1000, Math.floor(chartAreaWidth / LAYOUT.MAX_ZOOM_DIVISOR));
      // Linear additive: symmetric zoom in/out, instant direction reversal
      const dragSpeed = 0.15;
      const newWidth = this.chart.state.barWidth - deltaX * dragSpeed;

      if (newWidth >= LAYOUT.MIN_BAR_WIDTH && newWidth <= maxBarWidth) {
        const lastIdx = this.chart.dataManager.length - 1;
        const anchorX = indexToX(lastIdx, this.chart.state);
        this.chart.state.barWidth = newWidth;

        const zoomStart = 50;
        const weight = Math.max(0, (newWidth - zoomStart) / Math.max(1, maxBarWidth - zoomStart));
        const naturalOffset = anchorX - (lastIdx * newWidth) - (newWidth / 2);
        const centeredOffset = (chartAreaWidth / 2) - (lastIdx * newWidth) - (newWidth / 2);
        this.chart.state.offsetX = (naturalOffset * (1 - weight)) + (centeredOffset * weight);
      }

      const maxOffsetX_time = chartAreaWidth - (this.chart.state.barWidth * 2);
      this.chart.state.offsetX = Math.min(maxOffsetX_time, this.chart.state.offsetX);
      this.lastMouseX = mouseX;
      this.lastMouseY = mouseY;
      this.checkAutoScrollState();
      this.requestRender();
      this.chart.triggerVisibleRangeChange();
      return;
    } else {
      // Guard: Check if pan-on-drag is disabled
      if (!this.chart.options.behavior.panOnMouseDrag) return;

      this.chart.state.offsetX += mouseX - this.lastMouseX;
      if (this.chart.state.priceScale !== 1.0) {
        this.chart.state.priceOffset += mouseY - this.lastMouseY;
      }

      // During active drag: only clamp LEFT (bar 0 off-screen right).
      // The right-edge clamp is deferred to mouse-up so the user can
      // freely place the latest bar anywhere (e.g. to create empty space
      // on the right for text labels).
      const maxOffsetX = chartAreaWidth - (barWidth * 2);
      this.chart.state.offsetX = Math.min(maxOffsetX, this.chart.state.offsetX);
    }

    this.lastMouseX = mouseX;
    this.lastMouseY = mouseY;

    // Only re-clamp both sides on mouse-up. During drag, the left-only
    // clamp above is enough — don't snap the latest bar back yet.
    if (this.dragMode !== 'chart' && this.dragMode !== 'subPane' && this.dragMode !== 'separator') {
      this.chart.state.offsetX = clampOffsetX(this.chart.state.offsetX, this.chart.state.barWidth, this.chart.dataManager.length, w, rightGap, axisWidth);
    }
    this.checkAutoScrollState();
    this.requestRender();
    this.chart.triggerVisibleRangeChange();
  }

  private handleFullscreenChange = (): void => {
    this.removeContextMenu();
    this._separatorWasHovered = false;
    for (const pane of (this.chart as any).getActiveSubPanes()) {
      pane.separatorHovered = false;
    }
    this.chart.render();
  }

  private handleMouseLeave = (): void => {
    // Reset separator hover state when mouse leaves chart
    if (this._separatorWasHovered) {
      this._separatorWasHovered = false;
      for (const pane of (this.chart as any).getActiveSubPanes()) {
        pane.separatorHovered = false;
      }
      this.requestRender();
    }
  }

  private handleTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.lastMouseX = e.touches[0].clientX;
    } else if (e.touches.length === 2) {
      this.isDragging = false;
      this.lastTouchDistance = this.getTouchDistance(e.touches);
    }
  }

  private handleTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    if (this.isDragging && e.touches.length === 1) {
      const touch = e.touches[0];
      this.chart.state.offsetX += touch.clientX - this.lastMouseX;
      this.lastMouseX = touch.clientX;
      this.requestRender();
    } else if (e.touches.length === 2) {
      // Guard: Check if pinch-to-zoom is disabled
      if (!this.chart.options.behavior.pinchToZoom) return;

      const currentDistance = this.getTouchDistance(e.touches);
      const factor = currentDistance / this.lastTouchDistance;
      const { w, axisWidth, rightGap } = this.chart.state;
      const chartAreaWidth = w - axisWidth;
      const maxBarWidth = Math.min(1000, Math.floor(chartAreaWidth / LAYOUT.MAX_ZOOM_DIVISOR));
      const newWidth = this.chart.state.barWidth * factor;

      if (newWidth >= LAYOUT.MIN_BAR_WIDTH && newWidth <= maxBarWidth) {
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const rect = this.chart.mainCanvas.getBoundingClientRect();
        const screenX = centerX - rect.left;
        const rawMouseIdx = xToIndex(screenX, this.chart.state);
        const clampedMouseIdx = Math.max(0, Math.min(rawMouseIdx, this.chart.dataManager.length - 1));

        this.chart.state.barWidth = newWidth;
        const zoomStart = 50;
        const weight = Math.max(0, (newWidth - zoomStart) / Math.max(1, maxBarWidth - zoomStart));
        const naturalOffset = screenX - (rawMouseIdx * newWidth) - (newWidth / 2);
        const centeredOffset = (chartAreaWidth / 2) - (clampedMouseIdx * newWidth) - (newWidth / 2);
        this.chart.state.offsetX = (naturalOffset * (1 - weight)) + (centeredOffset * weight);
        const maxOffsetX_pinch = chartAreaWidth - (this.chart.state.barWidth * 2);
        this.chart.state.offsetX = Math.min(maxOffsetX_pinch, this.chart.state.offsetX);
        this.lastTouchDistance = currentDistance;
        this.requestRender();
        this.chart.triggerVisibleRangeChange();
      }
    }
  }

  private handleTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();
    if (e.touches.length === 0) this.isDragging = false;
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private checkAutoScrollState(): void {
    const { w, barWidth, axisWidth, offsetX } = this.chart.state;
    const dataLength = this.chart.dataManager.length;
    const barsVisible = Math.ceil((w - axisWidth) / barWidth);

    // Use RAW first-visible index (before clamping) to detect when the
    // latest bar is genuinely off-screen. The clamped deriveVisibleStartIdx
    // would say "firstVisible = dataLength-1" even when the entire data
    // range is to the left of the viewport, making it impossible to
    // distinguish "at right edge" from "scrolled way past it."
    const rawFirstVisible = Math.floor(-offsetX / barWidth);
    const latestBarVisible = rawFirstVisible < dataLength;
    const atRightEdge = latestBarVisible && (rawFirstVisible + barsVisible >= dataLength - 8);

    const wasAutoScrolling = this.autoScrollEnabled;
    this.autoScrollEnabled = atRightEdge;

    if (wasAutoScrolling !== this.autoScrollEnabled) {
      this.chart.onScrollLockChange?.(!this.autoScrollEnabled);
    }
  }

  public isAutoScrolling(): boolean {
    return this.autoScrollEnabled;
  }

  public scrollToLatest(): void {
    const { w, barWidth, rightGap, axisWidth } = this.chart.state;
    if (this.chart.dataManager.length === 0) return;
    this.chart.state.offsetX = calculateRightEdgeOffset(this.chart.dataManager.length, barWidth, w, rightGap, axisWidth);
    this.autoScrollEnabled = true;
    this.chart.render();
    this.chart.triggerVisibleRangeChange();
  }

  public destroy(): void {
    this.removeContextMenu();
    const mainCanvas = this.chart.mainCanvas;
    mainCanvas.removeEventListener('wheel', this.handleWheel);
    mainCanvas.removeEventListener('mousedown', this.handleMouseDown);
    mainCanvas.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    mainCanvas.removeEventListener('mouseleave', this.handleMouseLeave);
    mainCanvas.removeEventListener('touchstart', this.handleTouchStart);
    mainCanvas.removeEventListener('touchmove', this.handleTouchMove);
    mainCanvas.removeEventListener('touchend', this.handleTouchEnd);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
  }
}
