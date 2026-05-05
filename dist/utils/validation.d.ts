import { ChartOptions } from '../types/index.js';
/**
 * Validation error class
 */
export declare class ValidationError extends Error {
    path: string;
    value?: any | undefined;
    constructor(path: string, message: string, value?: any | undefined);
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
export declare function validateOptions(options: Partial<ChartOptions>): void;
//# sourceMappingURL=validation.d.ts.map