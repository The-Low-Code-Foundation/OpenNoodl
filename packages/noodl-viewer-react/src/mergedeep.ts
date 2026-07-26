type PlainObject = Record<string, unknown>;

function isObject(item: unknown): item is PlainObject {
  return Boolean(item) && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Recursively merges `sources` into `target`, **mutating `target`** and returning it.
 *
 * Two behaviours worth knowing before relying on this:
 * - Arrays are treated as leaves, not merged — a source array replaces the target one.
 * - Only plain-object values recurse; everything else is assigned by reference, so
 *   nested non-object values are shared between `target` and the source afterwards.
 */
export default function mergeDeep<T extends PlainObject>(target: T, ...sources: unknown[]): T {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key] as PlainObject, source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}
