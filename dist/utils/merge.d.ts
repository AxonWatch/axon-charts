/**
 * Deep merge two objects recursively
 * Uses generics for better type safety
 */
export declare function deepMerge<T>(target: T, source: Partial<T>): T;
/**
 * Robust Deep Clone implementation
 * Support for nested objects, arrays, and basic primitives
 * Performance optimized (no JSON stringify)
 */
export declare function deepClone<T>(obj: T): T;
//# sourceMappingURL=merge.d.ts.map