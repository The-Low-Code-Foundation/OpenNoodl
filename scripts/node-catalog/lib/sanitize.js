/**
 * Helpers to turn live registry metadata (which may contain functions and
 * editor-only noise) into deterministic, JSON-safe catalog data.
 */

/** Deep-copy a value, dropping functions and normalising key order. */
function sanitize(value) {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'function') return undefined;
  if (t !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'function' ? undefined : sanitize(v)));
  }
  const out = {};
  for (const key of Object.keys(value).sort()) {
    const v = sanitize(value[key]);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

/**
 * Normalise a port type to an object form: `'string'` → `{ name: 'string' }`.
 * Function-valued `enums` (computed at runtime) become `enumsAreDynamic`.
 */
function normalizeType(type) {
  if (type === null || type === undefined) return { name: 'unknown' };
  if (typeof type === 'string') return { name: type };
  const out = { name: type.name || 'unknown' };
  const rest = sanitize(type);
  delete rest.name;
  if (typeof type.enums === 'function') {
    out.enumsAreDynamic = true;
    delete rest.enums;
  }
  return Object.assign(out, rest);
}

/** Strip HTML tags from tooltip markup, yielding plain text. */
function tooltipToText(tooltip) {
  if (!tooltip) return undefined;
  if (typeof tooltip !== 'string') return undefined;
  const text = tooltip
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length ? text : undefined;
}

/** Assign only defined values, preserving explicit key order. */
function assignDefined(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v !== undefined) target[k] = v;
  }
  return target;
}

module.exports = { sanitize, normalizeType, tooltipToText, assignDefined };
