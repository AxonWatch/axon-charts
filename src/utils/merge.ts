/**
 * Deep merge two objects recursively
 * Uses generics for better type safety
 */
export function deepMerge<T>(target: T, source: Partial<T>): T {
  if (!source) return target;
  if (!target) return deepClone(source as T);

  const output = { ...target } as any;

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      const sourceVal = (source as any)[key];
      const targetVal = (target as any)[key];

      if (isObject(sourceVal)) {
        if (!(key in (target as any))) {
          output[key] = deepClone(sourceVal);
        } else {
          output[key] = deepMerge(targetVal, sourceVal);
        }
      } else {
        output[key] = sourceVal;
      }
    });
  }

  return output as T;
}

/**
 * Robust Deep Clone implementation
 * Support for nested objects, arrays, and basic primitives
 * Performance optimized (no JSON stringify)
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as any;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  const clonedObj = {} as any;
  Object.keys(obj).forEach(key => {
    clonedObj[key] = deepClone((obj as any)[key]);
  });

  return clonedObj as T;
}

function isObject(item: unknown): boolean {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}
