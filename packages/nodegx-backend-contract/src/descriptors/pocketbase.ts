/**
 * PocketBase.
 *
 * The descriptor that most justifies the phase.
 *
 * BCN-001's probe found that PocketBase does not *refuse* the things it cannot
 * do — it **ignores** them. Every aggregate spelling tried returned HTTP 200
 * with ordinary un-aggregated rows, and an invented parameter behaved
 * identically. One spelling returned 200 with `Content-Type: application/json`
 * and `Content-Length: 0`, an empty body that `JSON.parse` throws on.
 *
 * So an Aggregate Records node pointed at PocketBase would not error. It would
 * return wrong numbers, quietly, and the app would show them. There is nothing
 * for a runtime error handler to catch, which means **the descriptor gate is
 * the only thing that can stop it** — this is precisely the "merged node family
 * that lies" outcome the capability model exists to prevent, and precisely
 * BCN-010's job.
 *
 * Evidence: `uba-e2e/BCN-001-AGGREGATE-PROBE-OUTPUT.txt`, PocketBase 0.30.0.
 *
 * @module backend-contract/descriptors/pocketbase
 */

import type { BackendDescriptor } from '../capabilities';
import { conditional, degraded, filterTable, supported, unsupported } from './helpers';

const IGNORED =
  'BCN-001 probe: PocketBase returns 200 and un-aggregated rows for every spelling tried; an invented parameter behaves identically. Nothing fails at runtime.';

export const pocketbaseDescriptor: BackendDescriptor = {
  type: 'pocketbase',

  tokenLifecycle: {
    kind: 'refresh',
    // PocketBase tokens are longer-lived than Directus's but still expire, and
    // the refresh is an explicit call rather than a cookie the browser handles.
    accessTtlSeconds: 1209600,
    refreshEndpoint: '/api/collections/{collection}/auth-refresh',
    refreshBeforeExpirySeconds: 3600
  },

  capabilities: Object.freeze({
    'data.query': supported('GET /api/collections/{c}/records with filter/sort/expand'),

    'data.count': supported('BCN-001 probe: totalItems and totalPages on every list response'),

    'data.aggregate': unsupported(
      "PocketBase can't total or average records on the server. Query the records and calculate in your app, or make a view collection in the PocketBase admin that does the grouping.",
      IGNORED +
        ' A `view` collection wrapping a GROUP BY query does work and was verified — but that is schema authored by hand in the admin UI, not something a node can express.'
    ),

    'data.distinct': unsupported(
      "PocketBase can't list the distinct values of a field. Query the records and reduce them in your app.",
      'BCN-001 probe: ?distinct=status silently returned all seven rows — the same ignore-the-parameter behaviour.'
    ),

    'data.fetch': supported('GET /api/collections/{c}/records/{id}'),
    'data.create': supported('POST /api/collections/{c}/records'),
    'data.save': supported('PATCH /api/collections/{c}/records/{id}'),
    'data.delete': supported('DELETE /api/collections/{c}/records/{id}'),

    'data.increment': supported("PocketBase has the +/- field modifier: {'rating+': 1} is applied server-side"),

    'data.acl': unsupported(
      'PocketBase controls access with API rules, written per collection in the PocketBase admin — not per record from here.',
      'API rules are collection-level filter expressions, not a per-record ACL field.'
    ),

    'data.search': degraded(
      'PocketBase has no ranked search. NodeGX searches by looking for your text inside each field, which finds matches but cannot order them by relevance.',
      'Lowered to a filter of ORed ~ (contains) conditions. No FTS index exists.'
    ),

    'relations.pointerRead': supported('?expand=relField resolves relations inline'),
    'relations.relatedTo': unsupported(
      'Filtering by "records related to this one" is not available on PocketBase yet.',
      'PocketBase relations are id arrays on the record; a back-reference query is expressible but not wired. BCN-005.'
    ),
    'relations.addRemove': unsupported(
      'Adding and removing related records is not available on PocketBase yet.',
      "Would use the += / -= field modifiers on the relation array. BCN-005."
    ),

    'files.upload': supported('multipart POST to the record endpoint; files are record fields'),
    'files.sign': supported('POST /api/files/token then ?token= on the file URL'),
    'files.delete': supported('PATCH the record with the file field cleared'),

    'files.private': degraded(
      'PocketBase files are protected by the same rule as the record they belong to, so a file is private only if its record is. There is no per-file setting.',
      'File access follows the collection view rule; the protected flag is per field, not per file.'
    ),

    'files.progress': supported('multipart upload goes over the XHR path'),

    'auth.password': supported('POST /api/collections/{c}/auth-with-password'),
    'auth.signUp': supported('POST /api/collections/{c}/records on an auth collection'),
    'auth.signUpProperties': supported('the PocketBase user is a record in an auth collection, so profile fields write in the same call'),

    'auth.emailVerify': conditional(
      'Verification emails need SMTP set up in your PocketBase admin. Without it PocketBase only logs the mail.',
      { method: 'GET', path: '/api/settings', expect: 'an smtp section with enabled: true' },
      'PocketBase falls back to logging mail rather than erroring, so a missing SMTP setup looks like success.'
    ),
    'auth.passwordReset': conditional(
      'Password reset emails need SMTP set up in your PocketBase admin.',
      { method: 'GET', path: '/api/settings', expect: 'an smtp section with enabled: true' },
      'Same silent-log fallback as verification.'
    ),
    'auth.oauth': conditional(
      'Signing in with Google, GitHub and the rest depends on which providers you have set up in your PocketBase admin.',
      { method: 'GET', path: '/api/collections/{collection}/auth-methods', expect: 'an authProviders array with at least one entry' },
      'Providers are per-collection configuration; auth-methods enumerates them.'
    ),
    'auth.magicLink': unsupported(
      'PocketBase has no magic-link login. Use email and password, or an OAuth provider.',
      'OTP exists in recent versions but is a code-entry flow, not a link. Revisit if BCN-006 adds an OTP node.'
    ),

    'realtime.subscribe': supported('GET /api/realtime is Server-Sent Events, on by default — the same transport shape as BAK-001')
  }),

  filters: filterTable(supported('native PocketBase filter expression'), {
    // PocketBase's filter syntax is an expression language (`status = "x" &&
    // rating > 3`) rather than a JSON operator tree, so most of the vocabulary
    // maps onto an operator symbol. `~` covers the contains family.

    matchesRegex: unsupported(
      "PocketBase can't match text with regular expressions. Use \"contains\", \"starts with\" or \"ends with\" instead.",
      'The filter language has ~ (contains) but no regex operator.'
    ),

    isEmpty: supported('= "" matches empty string and empty array in the PocketBase filter language'),
    isNotEmpty: supported('!= ""'),

    relatedTo: unsupported(
      'Filtering by "records related to this one" is not available on PocketBase yet.',
      'BCN-005.'
    ),

    textSearch: degraded(
      'PocketBase has no ranked search — this looks for your text inside the field instead.',
      'Lowered to ~ (contains).'
    ),

    nearSphere: unsupported(
      "Location filters aren't available on PocketBase.",
      'No geo types or operators in the records API.'
    ),
    withinBox: unsupported("Location filters aren't available on PocketBase.", 'No geo operators.'),
    withinPolygon: unsupported("Location filters aren't available on PocketBase.", 'No geo operators.')
  })
};
