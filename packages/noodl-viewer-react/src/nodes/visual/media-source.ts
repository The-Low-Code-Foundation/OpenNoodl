import { getAbsoluteUrl } from '@noodl/runtime/src/utils';

/**
 * Resolve a media URL port, and let an empty one actually be empty — NDA-012 (Visual), check G1.
 *
 * `getAbsoluteUrl` opens with `String(_url)`, deliberately: a Cloud File is an object with a
 * custom `toString()` and the cast is what makes one usable as a source. The cost is the
 * Empty-Value Contract's `String(value)` defect, measured rather than reasoned about:
 *
 * | value on the port | `getAbsoluteUrl` returned | what the browser then did |
 * |---|---|---|
 * | `null` | `'/null'` | requested `/null`, 404, fired the element's `error` event |
 * | `undefined` | `'/undefined'` | requested `/undefined`, same |
 * | `''` | `''` | `src=""` resolves to the *document* URL and refetches the page |
 *
 * All three are ordinary arrivals — a record property nobody filled in, a cleared parameter
 * (`setParameter(name, undefined)` queues the port's own `undefined` default), an author
 * emptying the field. None of them means "fetch this". Clearing the attribute instead is what
 * "`null` clears" means for a URL port, and it is the only spelling that produces no request:
 * React omits an attribute whose value is `undefined`.
 *
 * The fix lives here rather than in `getAbsoluteUrl` on purpose. That function is in
 * `noodl-runtime` and has ~30 callers across three packages, several of which pass a value that
 * is never empty; changing its contract is a runtime-wide decision, and this is the two nodes
 * where the consequence is a network request. Filed for the runtime — see `FINDINGS.md` **DC-iii**
 * (⚠️ the `WORKER-V-NOTES.md` this used to cite was never written: the worker that would have
 * written it was terminated mid-task, and the reasoning was salvaged into FINDINGS instead).
 */
export function resolveMediaSource(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return getAbsoluteUrl(value);
}
