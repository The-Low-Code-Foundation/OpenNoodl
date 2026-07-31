/**
 * `toCustomFilter` — a filter for a backend nobody has seen.
 *
 * Richard's 2026-07-31 decision made `custom` a **declared** backend rather
 * than a data-only one: the user fills in its capability table in the Backend
 * Services panel, and the editor gates ports off it exactly as for a backend we
 * shipped. The consequence recorded against BCN-003 was that it *"must accept a
 * declared dialect, not just one of five known ones"*.
 *
 * The reading taken here is that a declared dialect is a *chosen* one, not an
 * invented one. Letting a user describe an arbitrary filter syntax needs a
 * plugin API and a versioned interface, and the same decision bought its
 * cheapness by explicitly not having either. So a custom backend declares which
 * of the four syntaxes we already implement its API speaks — plenty of REST
 * APIs are a thin layer over one of them — or `params`, the flat `?field=value`
 * convention the custom preset form already asks the user to configure.
 *
 * `params` is the floor and the default, and it is why the shipped `custom`
 * descriptor marks only `equalTo` and `idEqualTo` supported: those are the two
 * a bare query-parameter convention can express. Everything else the user turns
 * on by declaring a richer dialect.
 *
 * @module backend-contract/translators/custom
 */

import type { Filter } from '../filter';
import { toDirectusFilter, type DirectusFilter } from './directus';
import { toParseWhere, type ParseWhere } from './parse';
import { toPocketBaseFilter, type PocketBaseFilter } from './pocketbase';
import { toPostgrest, type PostgrestFilter } from './postgrest';
import { translateWith } from './translate';
import type { FilterDialect, TranslateOptions } from './types';

/** The flat `?field=value` form — the only thing assumable of an unseen API. */
export interface ParamsFilter {
  params: Array<[string, string]>;
}

export type CustomFilter = ParamsFilter | ParseWhere | DirectusFilter | PostgrestFilter | PocketBaseFilter;

function createParamsDialect(): FilterDialect<ParamsFilter> {
  return {
    name: 'params',
    identityField: 'id',

    empty: () => ({ params: [] }),
    isEmpty: (value) => value.params.length === 0,

    group(combinator, children, ctx) {
      if (combinator === 'or') {
        // Repeated query parameters are ANDed by every convention there is.
        // There is no "any of" without a syntax, and inventing one would
        // produce a request the user's API answers by ignoring the parameter
        // it does not recognise — which returns more rows, not fewer.
        return ctx.fail(
          'A custom API using plain query parameters cannot express "any of". ' +
            'Use "all of", or set this backend\'s filter dialect to one your API speaks.'
        );
      }
      return { params: children.flatMap((child) => child.params) };
    },

    id(node, ctx) {
      if (node.operator === 'idContainedIn') {
        return ctx.fail('A custom API using plain query parameters cannot filter by a list of ids', {
          operator: 'idContainedIn'
        });
      }
      return { params: [['id', String(node.value)]] };
    },

    relatedTo(node, ctx) {
      return ctx.fail('A custom API cannot filter by Parse-style relations', { operator: 'relatedTo' });
    },

    condition(node, ctx) {
      if (node.operator !== 'equalTo') {
        return ctx.fail(
          `A custom API using plain query parameters can only filter by equality, not "${node.operator}". ` +
            "Set this backend's filter dialect to one your API speaks.",
          { operator: node.operator, field: node.field }
        );
      }
      return { params: [[node.field, String(node.value)]] };
    }
  };
}

/**
 * Translate for a custom backend, in whichever dialect it declared.
 *
 * The capability gate still runs, and still reads the *user's* table — so a
 * custom backend that declares the Directus dialect but says it cannot do
 * `between` refuses `between`, even though the Directus translator could
 * express it. That is the right way round: the table describes their API, the
 * dialect describes its syntax, and the two are independent claims.
 */
export function toCustomFilter(filter: Filter | null | undefined, options: TranslateOptions): CustomFilter {
  switch (options.customDialect ?? 'params') {
    case 'parse':
      return toParseWhere(filter, options);
    case 'directus':
      return toDirectusFilter(filter, options);
    case 'postgrest':
      return toPostgrest(filter, options);
    case 'pocketbase':
      return toPocketBaseFilter(filter, options);
    case 'params':
    default:
      return translateWith(createParamsDialect(), filter, options);
  }
}
