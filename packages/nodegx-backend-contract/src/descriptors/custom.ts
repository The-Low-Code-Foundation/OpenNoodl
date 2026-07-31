/**
 * Custom API — a backend we know nothing about.
 *
 * **This descriptor is a floor, not a verdict.** Richard reopened the "is
 * `custom` really data-only?" question on 2026-07-31 and chose a third option
 * the phase spec had not offered: `custom` is a *declared* backend. The user
 * supplies endpoint configuration **and fills in this capability table
 * themselves**, in the Backend Services panel — the same four states, the same
 * keys.
 *
 * What that buys, and why it is nearly free:
 *
 * - No plugin API. No versioned `IDataAdapter` for third parties to implement.
 *   No commitment to support someone else's token-refresh scheme or filter
 *   serialiser. Those were the costs that made the open-ended option a platform
 *   commitment rather than a phase.
 * - The descriptor already has to exist and already has to be plain data, so
 *   letting a user write one costs a form and a validator.
 * - The editor gates ports off for a user-declared backend exactly as it does
 *   for one we shipped. A user who says "my API understands greater-than but
 *   not between" gets a filter builder that tells the truth about their API.
 *
 * The cost, stated plainly: `custom` now has auth and filter capability
 * surface, so BCN-003 and BCN-006 must accept a declared dialect rather than
 * assuming one of five known ones. `declarable: true` is where that starts.
 *
 * Everything below is `unsupported` because that is the only honest default for
 * an API nobody has seen. The reason strings are written for the case where the
 * user has not filled the table in yet, and so they point at the table.
 *
 * @module backend-contract/descriptors/custom
 */

import type { BackendDescriptor } from '../capabilities';
import { filterTable, supported, unsupported } from './helpers';

/** The one sentence every un-declared capability shows. */
const DECLARE = (thing: string): string =>
  `NodeGX doesn't know whether your API can ${thing}. Tell it in the backend's Capabilities tab, and this will work.`;

const NOT_DECLARED = 'Default floor for an undeclared custom backend. The user overrides this per instance.';

export const customDescriptor: BackendDescriptor = {
  type: 'custom',

  // A custom backend's token lifecycle is the user's to declare too. `eternal`
  // is the floor because it schedules nothing: assuming a refresh loop against
  // an endpoint that may not exist would produce background 404s on every
  // custom backend that does not need one.
  tokenLifecycle: { kind: 'eternal' },

  declarable: true,

  capabilities: Object.freeze({
    // The four a REST API has to have for the preset form to be worth filling
    // in at all — they are the endpoints the Backend Services panel asks for by
    // name (list, get, create, update, delete), so configuring a custom backend
    // is already a claim that these exist.
    'data.query': supported('the list endpoint is required by the custom preset form'),
    'data.fetch': supported('the get endpoint is required by the custom preset form'),
    'data.create': supported('the create endpoint is required by the custom preset form'),
    'data.save': supported('the update endpoint is required by the custom preset form'),
    'data.delete': supported('the delete endpoint is required by the custom preset form'),

    'data.count': unsupported(DECLARE('count records'), NOT_DECLARED),
    'data.distinct': unsupported(DECLARE('list distinct values'), NOT_DECLARED),
    'data.aggregate': unsupported(DECLARE('total or average records'), NOT_DECLARED),
    'data.increment': unsupported(DECLARE('add to a number in one step'), NOT_DECLARED),
    'data.acl': unsupported(DECLARE('set permissions per record'), NOT_DECLARED),
    'data.search': unsupported(DECLARE('search'), NOT_DECLARED),

    'relations.pointerRead': unsupported(DECLARE('resolve related records'), NOT_DECLARED),
    'relations.relatedTo': unsupported(DECLARE('filter by related records'), NOT_DECLARED),
    'relations.addRemove': unsupported(DECLARE('add and remove related records'), NOT_DECLARED),

    'files.upload': unsupported(DECLARE('store files'), NOT_DECLARED),
    'files.sign': unsupported(DECLARE('make temporary file links'), NOT_DECLARED),
    'files.delete': unsupported(DECLARE('delete files'), NOT_DECLARED),
    'files.private': unsupported(DECLARE('keep files private'), NOT_DECLARED),
    'files.progress': unsupported(DECLARE('report upload progress'), NOT_DECLARED),

    'auth.password': unsupported(DECLARE('sign people in'), NOT_DECLARED),
    'auth.signUp': unsupported(DECLARE('let people sign up'), NOT_DECLARED),
    'auth.signUpProperties': unsupported(DECLARE('save profile details at sign-up'), NOT_DECLARED),
    'auth.emailVerify': unsupported(DECLARE('verify email addresses'), NOT_DECLARED),
    'auth.passwordReset': unsupported(DECLARE('reset passwords'), NOT_DECLARED),
    'auth.oauth': unsupported(DECLARE('sign people in with Google or GitHub'), NOT_DECLARED),
    'auth.magicLink': unsupported(DECLARE('send magic-link logins'), NOT_DECLARED),

    'realtime.subscribe': unsupported(DECLARE('push live updates'), NOT_DECLARED)
  }),

  // Equality is the one filter a list endpoint can be assumed to answer, since
  // the custom preset asks for query-parameter conventions. Everything else the
  // user declares.
  filters: filterTable(unsupported(DECLARE('filter this way'), NOT_DECLARED), {
    equalTo: supported('the custom preset form configures query-parameter equality'),
    idEqualTo: supported('the get endpoint takes an id by definition')
  })
};
