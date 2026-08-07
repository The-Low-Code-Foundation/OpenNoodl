/**
 * `toDirectusFilter` — the neutral filter as a Directus filter document.
 *
 * ## The two copies
 *
 * There were two implementations of this: one in the editor's filter builder
 * and one in the runtime's Query Data node. RUN-003 slice 6 shipped the second
 * one and the pair is what BCN-003 exists to prevent — the handover recorded
 * them as materially divergent, with the editor unwrapping a lone condition and
 * the runtime always wrapping it in `_and`.
 *
 * **That is not what they did.** Read side by side, both unwrap a single
 * surviving child, and the runtime's own unit test is named for it. The one
 * real divergence was narrower and in the other direction: the runtime skipped
 * a condition whose `operator` was missing, while the editor emitted
 * `{ field: { undefined: value } }` — a document Directus rejects. So the pair
 * had not silently diverged in a way that produced two different payloads for
 * the same saved filter, which is worth writing down because the correction in
 * the handover says it had.
 *
 * The argument for one copy does not depend on that, though. It is the
 * architecture RUN-003's 403 paid for, and a second copy is a second place for
 * the next relation-path bug to live.
 *
 * ## The `_null` / `_empty` quirk, preserved
 *
 * Both copies mapped the four nullary operators to a literal `true` —
 * `{ archived: { _null: true } }` — because that is Directus's own spelling.
 * The neutral model instead has `exists`, which is boolean-valued, so the two
 * meet here: `{ exists: false }` becomes `_null: true`, and `{ exists: true }`
 * becomes `_nnull: true`.
 *
 * @module backend-contract/translators/directus
 */

import type { Filter } from '../filter';
import { betweenBounds } from './lowering';
import { translateWith } from './translate';
import type { FilterDialect, TranslateOptions } from './types';

/** A Directus filter document — `{ status: { _eq: 'published' } }`. */
export type DirectusFilter = Record<string, unknown>;

/**
 * Neutral operator → Directus operator.
 *
 * The inverse of `DIRECTUS_OPERATOR_MIGRATION`, and deliberately written out
 * rather than derived from it: the migration map is about *saved data* and must
 * not change when a translator gains an operator, and this is about the wire.
 * Nine of the eleven `LOWERED_OPERATORS` are native here, which is most of why
 * the neutral vocabulary was worth having.
 */
const DIRECTUS_OPERATORS: Readonly<Record<string, string>> = Object.freeze({
  equalTo: '_eq',
  notEqualTo: '_neq',
  greaterThan: '_gt',
  greaterThanOrEqualTo: '_gte',
  lessThan: '_lt',
  lessThanOrEqualTo: '_lte',
  contains: '_contains',
  notContains: '_ncontains',
  containsIgnoreCase: '_icontains',
  startsWith: '_starts_with',
  notStartsWith: '_nstarts_with',
  startsWithIgnoreCase: '_istarts_with',
  endsWith: '_ends_with',
  notEndsWith: '_nends_with',
  endsWithIgnoreCase: '_iends_with',
  containedIn: '_in',
  notContainedIn: '_nin',
  between: '_between',
  notBetween: '_nbetween',
  isEmpty: '_empty',
  isNotEmpty: '_nempty',
  matchesRegex: '_regex'
});

/**
 * Wrap an operator/value pair in one object per segment of a dotted path.
 *
 * `author.name` becomes `{ author: { name: { _eq: … } } }`. A flat
 * `"author.name"` key is what live Directus answered with a 403 in RUN-003
 * slice 6 — the bug that shape-only unit tests could not see, and the reason
 * the live equivalence pass is this task's deliverable rather than its
 * scaffolding.
 */
function nest(field: string, operatorValue: Record<string, unknown>): DirectusFilter {
  const parts = field.split('.');
  let result: DirectusFilter = operatorValue;
  for (let i = parts.length - 1; i >= 0; i--) {
    result = { [parts[i]]: result };
  }
  return result;
}

/**
 * Expand a relation prefix to the path Directus actually addresses it by.
 *
 * ⚠️ **A many-to-many is reachable through its junction and nothing else.**
 * `{"tags":{"label":{"_eq":"algebra"}}}` answers **403 "You don't have
 * permission to access field \"label\" in collection
 * \"bcn005_articles_tags\""** — the junction is in the path whether the query
 * names it or not, and the field the query names is looked for *there*.
 * `{"tags":{"tag_id":{"label":…}}}` is the one that works. Both measured live.
 *
 * The 403 matters as much as the fix: it is the same status a genuine
 * permission failure gives, so this cannot be told from "the token is wrong" by
 * anything downstream. RUN-003's defect was a 403 of exactly this shape.
 *
 * `path` comes from the relation descriptor's `readPath`, which the adapter
 * merges into the schema — so the filter path and the include path are one
 * fact, recorded once.
 */
function expandRelationPath(field: string, ctx: { schema?: { properties?: Record<string, { path?: string }> } }): string {
  const dot = field.indexOf('.');
  if (dot < 0) return field;
  const prefix = field.slice(0, dot);
  const path = ctx.schema?.properties?.[prefix]?.path;
  return path ? path + field.slice(dot) : field;
}

function createDirectusDialect(): FilterDialect<DirectusFilter> {
  return {
    name: 'directus',
    identityField: 'id',

    empty: () => ({}),
    isEmpty: (value) => Object.keys(value).length === 0,

    group(combinator, children) {
      return { [`_${combinator}`]: children };
    },

    id(node) {
      return node.operator === 'idEqualTo' ? { id: { _eq: node.value } } : { id: { _in: node.value } };
    },

    relatedTo(node, ctx) {
      return ctx.fail('Directus cannot filter by Parse-style relations', { operator: 'relatedTo' });
    },

    condition(node, ctx) {
      const { operator, value } = node;
      // Not `node.field`: a many-to-many prefix has to become its junction path
      // first, or Directus answers 403. See {@link expandRelationPath}.
      const field = expandRelationPath(node.field, ctx);

      // Directus splits presence into two nullary operators where the neutral
      // model has one boolean-valued one.
      if (operator === 'exists') {
        return nest(field, value === false ? { _null: true } : { _nnull: true });
      }

      // The four nullary operators take a literal `true`, not the value.
      if (operator === 'isEmpty') return nest(field, { _empty: true });
      if (operator === 'isNotEmpty') return nest(field, { _nempty: true });

      if (operator === 'between' || operator === 'notBetween') {
        const bounds = betweenBounds(value);
        if (!bounds) {
          return ctx.fail(`A "${operator}" filter needs a two-element array [from, to]`, { operator, field });
        }
        return nest(field, { [DIRECTUS_OPERATORS[operator]]: bounds });
      }

      if (operator === 'containedIn' || operator === 'notContainedIn') {
        return nest(field, { [DIRECTUS_OPERATORS[operator]]: Array.isArray(value) ? value : [value] });
      }

      // Directus's `?search=` is a query parameter rather than a filter
      // operator, so a `textSearch` condition on one field is the closest
      // Directus can get. The descriptor marks it `degraded` and says so: it
      // searches every field and does not rank.
      if (operator === 'textSearch') {
        return nest(field, { _contains: typeof value === 'string' ? value : String((value as { term?: unknown })?.term ?? '') });
      }

      // A pointer is a foreign key here, so "points to this record" is
      // equality on the relation field.
      if (operator === 'pointsTo') {
        return Array.isArray(value) ? nest(field, { _in: value }) : nest(field, { _eq: value });
      }

      const directus = DIRECTUS_OPERATORS[operator];
      if (!directus) {
        return ctx.fail(`The Directus dialect cannot express "${operator}"`, { operator, field });
      }
      return nest(field, { [directus]: value });
    }
  };
}

export function toDirectusFilter(filter: Filter | null | undefined, options: TranslateOptions): DirectusFilter {
  return translateWith(createDirectusDialect(), filter, options);
}
