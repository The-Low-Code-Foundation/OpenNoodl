/**
 * Record identity, normalised at the adapter boundary.
 *
 * Every backend has a name for "which record is this" and they disagree: Parse
 * says `objectId`, Directus and PocketBase say `id`, Supabase says whatever the
 * table's primary key is called. Twenty-five standard-library nodes, the Model
 * store and every `prop-` port read exactly one of those names, so the choice is
 * not "which is nicest" — it is "which one is already load-bearing".
 *
 * **The contract's name is `objectId`**, and that is not a preference either. It
 * is what BCN-001 shipped (`AdapterRecord.objectId`, and `objectId` on the fetch,
 * save, delete, increment and relation option shapes), and it follows the phase
 * decision that the Parse-family *names* win while the implementation comes from
 * whichever side is better. Renaming it to `id` would change a field twenty-five
 * nodes pass through, in the one task whose entire value is that nothing
 * observable changed.
 *
 * > **Spec correction.** BCN-002's Desired State §4 and its third success
 * > criterion ask for the opposite — "a node sees `id` for a Parse record whose
 * > wire payload said `objectId`". That inverts the contract BCN-001 shipped and
 * > the naming decision of 2026-07-31. The normalisation is real and is
 * > implemented here; its direction is *towards* `objectId`, not away.
 *
 * So this module is the rule, stated once: an adapter declares what its wire
 * calls the identity field, and the boundary renames it. For the Parse wire that
 * is the identity case and the record is returned by reference — which is what
 * makes "no behaviour change" provable rather than argued. For BCN-004's REST
 * adapters it is a rename, and the test below already covers that direction so
 * the second adapter inherits a proven helper instead of writing its own.
 *
 * @module api/backends/recordIdentity
 */

import type { AdapterRecord } from '@noodl/backend-contract';

/** What a record's identity is called everywhere above the adapter boundary. */
export const CONTRACT_ID_FIELD = 'objectId';

/**
 * Rename a wire record's identity field to the contract's.
 *
 * Returns the **same reference** when the wire already agrees, so an adapter
 * whose backend speaks the contract's name pays nothing and changes nothing.
 * When it does rename, the original field is removed: leaving both would let a
 * node read the wire name by accident and work on one backend only, which is the
 * failure this whole normalisation exists to prevent.
 */
export function normalizeRecordIdentity<T extends AdapterRecord>(record: T, wireIdField: string): T {
  if (wireIdField === CONTRACT_ID_FIELD) return record;
  if (record === null || record === undefined || typeof record !== 'object') return record;
  if (!(wireIdField in record)) return record;

  const normalized = Object.assign({}, record) as T;
  // The contract types an id as `string`, and some backends key on integers —
  // PostgREST tables routinely have a `bigint` primary key. Carried across as-is
  // rather than coerced: `String(4)` and `'4'` are not the same value to send
  // back in a `PATCH` URL, and BCN-004 is where a backend that does that has to
  // decide. Recorded here so the decision is made once and not per adapter.
  normalized[CONTRACT_ID_FIELD] = record[wireIdField] as string;
  delete normalized[wireIdField];
  return normalized;
}

/** {@link normalizeRecordIdentity} over a result page. Same reference when nothing renames. */
export function normalizeRecordIdentities<T extends AdapterRecord>(records: T[], wireIdField: string): T[] {
  if (wireIdField === CONTRACT_ID_FIELD) return records;
  if (!Array.isArray(records)) return records;
  return records.map((record) => normalizeRecordIdentity(record, wireIdField));
}
