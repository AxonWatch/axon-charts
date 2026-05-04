import { ChartOptions } from '../types/index.js';

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(
    public path: string,
    message: string,
    public value?: any
  ) {
    super(`Validation failed at "${path}": ${message}`);
    this.name = 'ValidationError';
  }
}

/**
 * Validate chart options
 * @param options - Partial or full chart options to validate
 * @throws ValidationError if any option is invalid
 *
 * Usage:
 *   try {
 *     validateOptions(options);
 *   } catch (e) {
 *     if (e instanceof ValidationError) {
 *       console.error(e.path, e.message, e.value);
 *     }
 *   }
 */
export function validateOptions(options: Partial<ChartOptions>): void {
  if (!options || typeof options !== 'object') {
    throw new ValidationError('root', 'Options must be an object', options);
  }

  // === LAYOUT ===
  if (options.layout) {
    validateLayout(options.layout);
  }

  // === GRID ===
  if (options.grid) {
    validateGrid(options.grid);
  }

  // === PRICE SCALE ===
  if (options.priceScale) {
    validatePriceScale(options.priceScale);
  }

  // === TIME SCALE ===
  if (options.timeScale) {
    validateTimeScale(options.timeScale);
  }

  // === CROSSHAIR ===
  if (options.crosshair) {
    validateCrosshair(options.crosshair);
  }

  // === BEHAVIOR ===
  if (options.behavior) {
    validateBehavior(options.behavior);
  }

  // === DATA ===
  if (options.data) {
    validateData(options.data);
  }

  // === INIT-ONLY ===
  if (options.devicePixelRatio !== undefined) {
    validateDevicePixelRatio(options.devicePixelRatio);
  }
}

function validateLayout(layout: any, path: string = 'layout'): void {
  if (typeof layout !== 'object' || layout === null) {
    throw new ValidationError(path, 'Layout must be an object', layout);
  }

  if (layout.width !== undefined) {
    validateWidth(layout.width, `${path}.width`);
  }
  if (layout.height !== undefined) {
    validateWidth(layout.height, `${path}.height`);
  }
  if (layout.background !== undefined) {
    validateColor(layout.background, `${path}.background`);
  }
  if (layout.textColor !== undefined) {
    validateColor(layout.textColor, `${path}.textColor`);
  }
  if (layout.fontSize !== undefined) {
    if (typeof layout.fontSize !== 'number' || layout.fontSize < 1 || layout.fontSize > 72) {
      throw new ValidationError(
        `${path}.fontSize`,
        'Font size must be a number between 1 and 72',
        layout.fontSize
      );
    }
  }
  if (layout.fontFamily !== undefined) {
    if (typeof layout.fontFamily !== 'string' || layout.fontFamily.trim().length === 0) {
      throw new ValidationError(`${path}.fontFamily`, 'Font family must be a non-empty string', layout.fontFamily);
    }
  }
  if (layout.padding !== undefined) {
    validatePadding(layout.padding, `${path}.padding`);
  }
}

function validateGrid(grid: any, path: string = 'grid'): void {
  if (typeof grid !== 'object' || grid === null) {
    throw new ValidationError(path, 'Grid must be an object', grid);
  }

  if (grid.show !== undefined) {
    if (typeof grid.show !== 'boolean') {
      throw new ValidationError(`${path}.show`, 'Grid show must be a boolean', grid.show);
    }
  }

  if (grid.vertLines !== undefined) {
    validateGridLines(grid.vertLines, `${path}.vertLines`);
  }

  if (grid.horzLines !== undefined) {
    validateGridLines(grid.horzLines, `${path}.horzLines`);
  }
}

function validateGridLines(lines: any, path: string): void {
  if (typeof lines !== 'object' || lines === null) {
    throw new ValidationError(path, 'Grid lines must be an object', lines);
  }

  if (lines.show !== undefined && typeof lines.show !== 'boolean') {
    throw new ValidationError(`${path}.show`, 'Show must be a boolean', lines.show);
  }

  if (lines.color !== undefined) {
    validateColor(lines.color, `${path}.color`);
  }

  if (lines.width !== undefined) {
    if (typeof lines.width !== 'number' || lines.width < 0.1 || lines.width > 10) {
      throw new ValidationError(`${path}.width`, 'Width must be a number between 0.1 and 10', lines.width);
    }
  }
}

function validatePriceScale(priceScale: any, path: string = 'priceScale'): void {
  if (typeof priceScale !== 'object' || priceScale === null) {
    throw new ValidationError(path, 'Price scale must be an object', priceScale);
  }

  if (priceScale.mode !== undefined) {
    if (priceScale.mode !== 'linear' && priceScale.mode !== 'logarithmic') {
      throw new ValidationError(
        `${path}.mode`,
        'Mode must be either "linear" or "logarithmic"',
        priceScale.mode
      );
    }
  }

  if (priceScale.scaleMargins !== undefined) {
    validateMargins(priceScale.scaleMargins, `${path}.scaleMargins`);
  }

  if (priceScale.priceFormat !== undefined) {
    validatePriceFormat(priceScale.priceFormat, `${path}.priceFormat`);
  }

  if (priceScale.currentPrice !== undefined) {
    validateCurrentPrice(priceScale.currentPrice, `${path}.currentPrice`);
  }
}

function validateMargins(margins: any, path: string): void {
  if (typeof margins !== 'object' || margins === null) {
    throw new ValidationError(path, 'Margins must be an object', margins);
  }

  if (margins.top !== undefined) {
    if (typeof margins.top !== 'number' || margins.top < 0 || margins.top > 1) {
      throw new ValidationError(`${path}.top`, 'Top margin must be a number between 0 and 1', margins.top);
    }
  }

  if (margins.bottom !== undefined) {
    if (typeof margins.bottom !== 'number' || margins.bottom < 0 || margins.bottom > 1) {
      throw new ValidationError(`${path}.bottom`, 'Bottom margin must be a number between 0 and 1', margins.bottom);
    }
  }
}

function validatePriceFormat(format: any, path: string): void {
  if (typeof format !== 'object' || format === null) {
    throw new ValidationError(path, 'Price format must be an object', format);
  }

  if (format.type !== undefined) {
    const validTypes = ['price', 'volume', 'percent', 'custom'];
    if (!validTypes.includes(format.type)) {
      throw new ValidationError(`${path}.type`, `Type must be one of: ${validTypes.join(', ')}`, format.type);
    }
  }

  if (format.precision !== undefined) {
    if (typeof format.precision !== 'number' || format.precision < 0 || format.precision > 20) {
      throw new ValidationError(`${path}.precision`, 'Precision must be a number between 0 and 20', format.precision);
    }
  }

  if (format.minMove !== undefined) {
    if (typeof format.minMove !== 'number' || format.minMove <= 0) {
      throw new ValidationError(`${path}.minMove`, 'Min move must be a positive number', format.minMove);
    }
  }

  if (format.formatter !== undefined && typeof format.formatter !== 'function') {
    throw new ValidationError(`${path}.formatter`, 'Formatter must be a function', format.formatter);
  }
}

function validateCurrentPrice(currentPrice: any, path: string): void {
  if (typeof currentPrice !== 'object' || currentPrice === null) {
    throw new ValidationError(path, 'Current price must be an object', currentPrice);
  }

  if (currentPrice.showCountdown !== undefined && typeof currentPrice.showCountdown !== 'boolean') {
    throw new ValidationError(`${path}.showCountdown`, 'Show countdown must be a boolean', currentPrice.showCountdown);
  }

  if (currentPrice.countdownColor !== undefined) {
    validateColor(currentPrice.countdownColor, `${path}.countdownColor`);
  }
}

function validateTimeScale(timeScale: any, path: string = 'timeScale'): void {
  if (typeof timeScale !== 'object' || timeScale === null) {
    throw new ValidationError(path, 'Time scale must be an object', timeScale);
  }

  if (timeScale.visible !== undefined && typeof timeScale.visible !== 'boolean') {
    throw new ValidationError(`${path}.visible`, 'Visible must be a boolean', timeScale.visible);
  }

  if (timeScale.timeVisible !== undefined && typeof timeScale.timeVisible !== 'boolean') {
    throw new ValidationError(`${path}.timeVisible`, 'Time visible must be a boolean', timeScale.timeVisible);
  }

  if (timeScale.secondsVisible !== undefined && typeof timeScale.secondsVisible !== 'boolean') {
    throw new ValidationError(`${path}.secondsVisible`, 'Seconds visible must be a boolean', timeScale.secondsVisible);
  }

  if (timeScale.rightOffset !== undefined) {
    validateRightGap(timeScale.rightOffset, `${path}.rightOffset`);
  }

  if (timeScale.barSpacing !== undefined) {
    validateBarSpacing(timeScale.barSpacing, `${path}.barSpacing`);
  }

  if (timeScale.minBarSpacing !== undefined) {
    validateBarSpacing(timeScale.minBarSpacing, `${path}.minBarSpacing`, 4);
  }

  if (timeScale.maxBarSpacing !== undefined) {
    if (typeof timeScale.maxBarSpacing !== 'number' || timeScale.maxBarSpacing < 4) {
      throw new ValidationError(`${path}.maxBarSpacing`, 'Max bar spacing must be a number >= 4', timeScale.maxBarSpacing);
    }
  }
}

function validateCrosshair(crosshair: any, path: string = 'crosshair'): void {
  if (typeof crosshair !== 'object' || crosshair === null) {
    throw new ValidationError(path, 'Crosshair must be an object', crosshair);
  }

  if (crosshair.mode !== undefined) {
    if (crosshair.mode !== 'normal' && crosshair.mode !== 'magnet' && crosshair.mode !== 'none') {
      throw new ValidationError(
        `${path}.mode`,
        'Mode must be one of: normal, magnet, none',
        crosshair.mode
      );
    }
  }

  if (crosshair.showLabels !== undefined && typeof crosshair.showLabels !== 'boolean') {
    throw new ValidationError(`${path}.showLabels`, 'Show labels must be a boolean', crosshair.showLabels);
  }

  if (crosshair.showTooltip !== undefined && typeof crosshair.showTooltip !== 'boolean') {
    throw new ValidationError(`${path}.showTooltip`, 'Show tooltip must be a boolean', crosshair.showTooltip);
  }

  if (crosshair.vertLine !== undefined) {
    validateCrosshairLine(crosshair.vertLine, `${path}.vertLine`);
  }

  if (crosshair.horzLine !== undefined) {
    validateCrosshairLine(crosshair.horzLine, `${path}.horzLine`);
  }
}

function validateCrosshairLine(line: any, path: string): void {
  if (typeof line !== 'object' || line === null) {
    throw new ValidationError(path, 'Crosshair line must be an object', line);
  }

  if (line.color !== undefined) {
    validateColor(line.color, `${path}.color`);
  }

  if (line.width !== undefined) {
    if (typeof line.width !== 'number' || line.width < 0.1 || line.width > 10) {
      throw new ValidationError(`${path}.width`, 'Width must be a number between 0.1 and 10', line.width);
    }
  }

  if (line.style !== undefined) {
    if (line.style !== 'solid' && line.style !== 'dashed') {
      throw new ValidationError(`${path}.style`, 'Style must be either "solid" or "dashed"', line.style);
    }
  }
}

function validateBehavior(behavior: any, path: string = 'behavior'): void {
  if (typeof behavior !== 'object' || behavior === null) {
    throw new ValidationError(path, 'Behavior must be an object', behavior);
  }

  const booleanFields = [
    'dragToZoom',
    'scrollToZoom',
    'pinchToZoom',
    'panOnMouseDrag',
    'dragPriceScale',
    'autoScroll'
  ];

  for (const field of booleanFields) {
    if (behavior[field] !== undefined && typeof behavior[field] !== 'boolean') {
      throw new ValidationError(`${path}.${field}`, `${field} must be a boolean`, behavior[field]);
    }
  }
}

function validateData(data: any, path: string = 'data'): void {
  if (typeof data !== 'object' || data === null) {
    throw new ValidationError(path, 'Data must be an object', data);
  }

  if (data.maxBars !== undefined) {
    validateMaxBars(data.maxBars, `${path}.maxBars`);
  }

  if (data.autoCleanup !== undefined && typeof data.autoCleanup !== 'boolean') {
    throw new ValidationError(`${path}.autoCleanup`, 'Auto cleanup must be a boolean', data.autoCleanup);
  }
}

// === HELPER VALIDATORS ===

function validateWidth(value: any, path: string): void {
  if (value !== 'auto' && (typeof value !== 'number' || value <= 0 || value > 65536)) {
    throw new ValidationError(path, 'Width must be "auto" or a positive number (max 65536)', value);
  }
}

function validatePadding(padding: any, path: string): void {
  if (typeof padding !== 'object' || padding === null) {
    throw new ValidationError(path, 'Padding must be an object', padding);
  }

  const fields = ['top', 'right', 'bottom', 'left'];
  for (const field of fields) {
    if (padding[field] !== undefined) {
      if (typeof padding[field] !== 'number' || padding[field] < 0 || padding[field] > 1000) {
        throw new ValidationError(`${path}.${field}`, 'Padding must be a number between 0 and 1000', padding[field]);
      }
    }
  }
}

function validateColor(color: any, path: string): void {
  if (typeof color !== 'string' || !isValidColor(color)) {
    throw new ValidationError(path, 'Color must be a valid hex color (e.g., "#ffffff") or color name', color);
  }
}

function isValidColor(color: string): boolean {
  // Check for hex color (#RGB or #RRGGBB)
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color)) {
    return true;
  }
  // Check for rgb/rgba
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/.test(color)) {
    return true;
  }
  // Allow common color names (not exhaustive, but covers most cases)
  const commonColors = [
    'black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
    'gray', 'grey', 'orange', 'purple', 'pink', 'brown', 'transparent'
  ];
  return commonColors.includes(color.toLowerCase());
}

function validateBarSpacing(value: any, path: string, min: number = 1): void {
  if (typeof value !== 'number' || value < min || value > 1000) {
    throw new ValidationError(path, `Bar spacing must be a number between ${min} and 1000`, value);
  }
}

function validateRightGap(value: any, path: string): void {
  if (typeof value !== 'number' || value < 0 || value > 1000) {
    throw new ValidationError(path, 'Right gap must be a number between 0 and 1000', value);
  }
}

function validateMaxBars(value: any, path: string): void {
  if (typeof value !== 'number' || value < 1 || value > 1000000) {
    throw new ValidationError(path, 'Max bars must be a number between 1 and 1000000', value);
  }
}

function validateDevicePixelRatio(value: any): void {
  if (typeof value !== 'number' || value < 1 || value > 4) {
    throw new ValidationError('devicePixelRatio', 'Device pixel ratio must be a number between 1 and 4', value);
  }
}
