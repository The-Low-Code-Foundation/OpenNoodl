/**
 * The filter translators — one pure function per backend, shared by the editor
 * and the runtime.
 *
 * **Imported from `@noodl/backend-contract/translators`, not from the package
 * root.** The root pulls in every descriptor and the whole capability model;
 * this entry point pulls in the descriptors too (the capability gate needs
 * them) but nothing else, and keeping it separate means the boundary is
 * deliberate and measurable rather than incidental.
 *
 * The hard rule this module exists to enforce: **no backend has two
 * translators.** RUN-003 shipped a second Directus converter in the runtime and
 * it emitted a flat `"author.name"` key that live Directus answers with a 403 —
 * invisible to every unit test, because only a real fetch exercised that copy.
 *
 * @module backend-contract/translators
 */

export { toParseWhere, type ParseWhere } from './parse';
export { toDirectusFilter, type DirectusFilter } from './directus';
export { toPostgrest, postgrestQueryString, encodePostgrestValue, type PostgrestFilter } from './postgrest';
export {
  toPocketBaseFilter,
  bindPocketBaseFilter,
  encodePocketBaseValue,
  type PocketBaseFilter
} from './pocketbase';
export { toCustomFilter, type CustomFilter, type ParamsFilter } from './custom';

export { operatorState, resolveDescriptor, translateWith } from './translate';
export { parseFilterNode } from './walk';
export { betweenBounds, escapeLike, escapeRegExp, lowerToLike, lowerToRegex } from './lowering';

export {
  isSavedGroup,
  migrateSavedFilter,
  needsOperatorMigration,
  savedFilterToNeutral,
  visualQueryToNeutral,
  type SavedFilterCondition,
  type SavedFilterGroup,
  type SavedFilterItem,
  type VisualQueryNode
} from './saved';

export {
  FilterTranslationError,
  type CustomDialectName,
  type DialectContext,
  type FilterDialect,
  type FilterFieldSchema,
  type FilterNode,
  type FilterSchema,
  type FilterValueResolver,
  type TranslateOptions
} from './types';

import type { BackendType } from '../backends';
import type { Filter } from '../filter';
import { toCustomFilter } from './custom';
import { toDirectusFilter } from './directus';
import { toParseWhere } from './parse';
import { toPocketBaseFilter } from './pocketbase';
import { toPostgrest } from './postgrest';
import { resolveDescriptor } from './translate';
import type { TranslateOptions } from './types';

/**
 * Translate a neutral filter for whichever backend is in `options.backend`.
 *
 * The return type is the union of the five dialects' shapes, which is honest
 * rather than convenient: a caller that has already resolved its backend should
 * call that backend's translator directly and keep its type. This exists for
 * the places that genuinely dispatch — the MCP tools, the equivalence rig, and
 * BCN-010's port gating.
 */
export function translateFilter(
  filter: Filter | null | undefined,
  options: TranslateOptions
): ReturnType<typeof toCustomFilter> {
  const type: BackendType = resolveDescriptor(options.backend).type;
  switch (type) {
    case 'nodegx':
    case 'parse':
      return toParseWhere(filter, options);
    case 'directus':
      return toDirectusFilter(filter, options);
    case 'supabase':
      return toPostgrest(filter, options);
    case 'pocketbase':
      return toPocketBaseFilter(filter, options);
    case 'custom':
      return toCustomFilter(filter, options);
  }
}
