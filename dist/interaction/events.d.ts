import { IChart } from '../types/index.js';
/**
 * Handles mouse and touch interactions for the chart
 */
export declare class EventManager {
    private chart;
    private isDragging;
    private lastMouseX;
    private lastMouseY;
    private lastTouchDistance;
    private autoScrollEnabled;
    private contextMenuActive;
    private _contextMenu;
    private _contextMenuDismiss;
    private dragMode;
    private rafId;
    constructor(chart: IChart);
    /**
     * Request a throttled render using RAF
     */
    private requestRender;
    /**
     * Set up all event listeners
     */
    private setupEventListeners;
    /**
     * Handle double click
     */
    private handleDblClick;
    /**
     * Handle right-click: show custom context menu with chart export options
     */
    private handleContextMenu;
    /**
     * Remove the custom context menu from the DOM
     */
    private removeContextMenu;
    /**
     * Copy chart image to clipboard
     */
    private copyChartToClipboard;
    /**
     * Save chart image as PNG file
     */
    private saveChartImage;
    /**
     * Handle wheel zoom
     */
    private handleWheel;
    private handleMouseDown;
    private handleMouseUp;
    private handleMouseMove;
    private handleTouchStart;
    private handleTouchMove;
    private handleTouchEnd;
    private getTouchDistance;
    private checkAutoScrollState;
    isAutoScrolling(): boolean;
    scrollToLatest(): void;
    destroy(): void;
}
//# sourceMappingURL=events.d.ts.map