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
  private dragMode: 'chart' | 'price' | 'time' = 'chart';
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
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);

    // Touch events
    mainCanvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    mainCanvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    mainCanvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
  }

  /**
   * Handle double click
   */
  private handleDblClick = (e: MouseEvent): void => {
    const { w, h, axisWidth } = this.chart.state;
    const chartAreaWidth = w - axisWidth;

    // Use client coordinates for consistency
    const rect = this.chart.mainCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // If double-clicked on Price Axis, reset vertical zoom AND offset
    if (mouseX > chartAreaWidth) {
      this.chart.state.priceScale = 1.0;
      this.chart.state.priceOffset = 0;
      this.chart.render();
    }

    // If double-clicked on Time Axis, reset horizontal zoom to default
    if (mouseY > h - LAYOUT.BOTTOM_MARGIN) {
      this.chart.state.barWidth = this.chart.state.baseBarWidth;
      this.chart.renderer.createBuffer();
      this.scrollToLatest();
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
    const { w, h, rightGap, axisWidth } = this.chart.state;
    const chartAreaWidth = w - axisWidth;

    // Use client coordinates for consistency
    const rect = this.chart.mainCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Price Axis Zoom
    if (mouseX > chartAreaWidth) {
      this.chart.state.priceScale *= (e.deltaY > 0 ? LAYOUT.PRICE_SCROLL_FACTOR_IN : LAYOUT.PRICE_SCROLL_FACTOR_OUT);
      this.chart.state.priceScale = Math.max(0.1, Math.min(this.chart.state.priceScale, 10));
      this.chart.render();
      return;
    }

    // Horizontal Zoom
    const isTimeAxis = mouseY > h - LAYOUT.BOTTOM_MARGIN;
    const oldWidth = this.chart.state.barWidth;
    const maxBarWidth = Math.min(1000, Math.floor(chartAreaWidth / LAYOUT.MAX_ZOOM_DIVISOR));
    const newWidth = oldWidth * factor;

    if (newWidth < LAYOUT.MIN_BAR_WIDTH || newWidth > maxBarWidth) return;

    const mouseIdx = isTimeAxis ? this.chart.dataManager.length - 1 : xToIndex(mouseX, this.chart.state);
    const anchorX = isTimeAxis ? indexToX(this.chart.dataManager.length - 1, this.chart.state) : mouseX;

    this.chart.state.barWidth = newWidth;

    const zoomStart = 50; 
    const weight = Math.max(0, (newWidth - zoomStart) / Math.max(1, maxBarWidth - zoomStart));
    const naturalOffset = anchorX - (mouseIdx * newWidth) - (newWidth / 2);
    const centeredOffset = (chartAreaWidth / 2) - (mouseIdx * newWidth) - (newWidth / 2);

    this.chart.state.offsetX = (naturalOffset * (1 - weight)) + (centeredOffset * weight);
    this.chart.state.offsetX = clampOffsetX(this.chart.state.offsetX, this.chart.state.barWidth, this.chart.dataManager.length, w, rightGap, axisWidth);
    
    this.checkAutoScrollState();
    this.requestRender();
  }

  private handleMouseDown = (e: MouseEvent): void => {
    const { w, h, axisWidth } = this.chart.state;
    const chartAreaWidth = w - axisWidth;

    // Use client coordinates for consistency
    const rect = this.chart.mainCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.isDragging = true;
    this.lastMouseX = mouseX;
    this.lastMouseY = mouseY;

    if (mouseX > chartAreaWidth) {
      this.dragMode = 'price';
    } else if (mouseY > h - LAYOUT.BOTTOM_MARGIN) {
      this.dragMode = 'time';
    } else {
      this.dragMode = 'chart';
    }
  }

  private handleMouseUp = (): void => {
    this.isDragging = false;
    this.checkAutoScrollState();
  }

  private handleMouseMove = (e: MouseEvent): void => {
    const { w, h, rightGap, barWidth, axisWidth } = this.chart.state;
    const chartAreaWidth = w - axisWidth;

    // Use client coordinates with getBoundingClientRect for consistent positioning
    // even when mouse is outside the chart area
    const rect = this.chart.mainCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const isOverPrice = mouseX > chartAreaWidth;
    const isOverTime = mouseY > h - LAYOUT.BOTTOM_MARGIN;

    // Update cursor based on enabled behaviors
    if (isOverPrice) {
      // Only show resize cursor if dragPriceScale is enabled
      this.chart.mainCanvas.style.cursor = this.chart.options.behavior.dragPriceScale ? 'ns-resize' : 'default';
    } else if (isOverTime) {
      // Only show resize cursor if dragToZoom is enabled
      this.chart.mainCanvas.style.cursor = this.chart.options.behavior.dragToZoom ? 'ew-resize' : 'default';
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
    } else if (this.dragMode === 'time') {
      // Guard: Check if drag-to-zoom is disabled
      if (!this.chart.options.behavior.dragToZoom) return;

      const deltaX = mouseX - this.lastMouseX;
      const factor = Math.pow(LAYOUT.ZOOM_FACTOR_IN, -deltaX / LAYOUT.ZOOM_SENSITIVITY);
      const oldWidth = this.chart.state.barWidth;
      const maxBarWidth = Math.min(1000, Math.floor(chartAreaWidth / LAYOUT.MAX_ZOOM_DIVISOR));
      const newWidth = oldWidth * factor;

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
    } else {
      // Guard: Check if pan-on-drag is disabled
      if (!this.chart.options.behavior.panOnMouseDrag) return;

      this.chart.state.offsetX += mouseX - this.lastMouseX;
      if (this.chart.state.priceScale !== 1.0) {
        this.chart.state.priceOffset += mouseY - this.lastMouseY;
      }
    }

    this.lastMouseX = mouseX;
    this.lastMouseY = mouseY;

    this.chart.state.offsetX = clampOffsetX(this.chart.state.offsetX, this.chart.state.barWidth, this.chart.dataManager.length, w, rightGap, axisWidth);
    this.checkAutoScrollState();
    this.requestRender();
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
        const mouseIdx = xToIndex(screenX, this.chart.state);
        const anchorX = screenX;

        this.chart.state.barWidth = newWidth;
        const zoomStart = 50;
        const weight = Math.max(0, (newWidth - zoomStart) / Math.max(1, maxBarWidth - zoomStart));
        const naturalOffset = anchorX - (mouseIdx * newWidth) - (newWidth / 2);
        const centeredOffset = (chartAreaWidth / 2) - (mouseIdx * newWidth) - (newWidth / 2);
        this.chart.state.offsetX = (naturalOffset * (1 - weight)) + (centeredOffset * weight);
        this.chart.state.offsetX = clampOffsetX(this.chart.state.offsetX, this.chart.state.barWidth, this.chart.dataManager.length, w, rightGap, axisWidth);
        this.lastTouchDistance = currentDistance;
        this.requestRender();
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
    const { w, barWidth, axisWidth } = this.chart.state;
    const dataLength = this.chart.dataManager.length;
    const firstVisibleIdx = deriveVisibleStartIdx(this.chart.state, dataLength);
    const barsVisible = Math.ceil((w - axisWidth) / barWidth);
    const atRightEdge = firstVisibleIdx + barsVisible >= dataLength - 8;

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
  }

  public destroy(): void {
    const mainCanvas = this.chart.mainCanvas;
    mainCanvas.removeEventListener('wheel', this.handleWheel);
    mainCanvas.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    mainCanvas.removeEventListener('touchstart', this.handleTouchStart);
    mainCanvas.removeEventListener('touchmove', this.handleTouchMove);
    mainCanvas.removeEventListener('touchend', this.handleTouchEnd);
  }
}
