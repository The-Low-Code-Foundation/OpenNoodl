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

/**
 * The nine string operators on `~`, PocketBase's `LIKE`.
 *
 * Measured by BCN-003's live equivalence pass: `%` and `_` in the user's text
 * act as wildcards and no escape is honoured, and the comparison ignores case
 * whether the operator asks it to or not — so `notStartsWith "Ada"` also
 * excludes `adaline`. See the identical table in `directus.ts` for why the two
 * are separate copies rather than one shared constant.
 */
const WILDCARD_DEGRADED = (() => {
  const wildcards =
    'The characters % and _ act as wildcards here, so searching for text containing one will match more than you asked for.';
  const bothWays = `${wildcards} Matching also ignores capitals.`;
  const evidence = 'BCN-003 live: ~ is LIKE with no ESCAPE clause; a backslash is matched literally';
  return {
    contains: degraded(bothWays, evidence),
    notContains: degraded(bothWays, evidence),
    containsIgnoreCase: degraded(wildcards, evidence),
    startsWith: degraded(bothWays, evidence),
    notStartsWith: degraded(bothWays, evidence),
    startsWithIgnoreCase: degraded(wildcards, evidence),
    endsWith: degraded(bothWays, evidence),
    notEndsWith: degraded(bothWays, evidence),
    endsWithIgnoreCase: degraded(wildcards, evidence)
  };
})();

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

    'relations.pointerRead': supported(
      'BCN-005 live: ?expand=author,tags nests both under `expand`. Filtering across a relation that can hold several records needs the "any of" form of the operator, which the adapter emits from the schema'
    ),
    'relations.relatedTo': unsupported(
      'Filtering by "records related to this one" is not available on PocketBase. Filter on a field of the related record instead, such as author → name.',
      "BCN-005 live: dotted-path filters work (author.city='London', tags.label?='algebra'), but Parse's $relatedTo has no PocketBase spelling"
    ),
    'relations.addRemove': supported(
      'BCN-005 live: PATCH {"tags+": id} and {"tags-": id} are applied server-side in one request and are set-shaped — appending a value already present leaves the list unchanged. ⚠️ On a relation that holds only one record, "+" replaces what is there and "-" clears it whichever id you name'
    ),

    // ── Files — BCN-007 steps 2/3/5/7, every cell measured ───────────────
    // Probe: BCN-007-FILES-PROBE-OUTPUT.txt §3 and
    // BCN-007-FILES-PROBE2-OUTPUT.txt §2.
    'files.upload': degraded(
      'On PocketBase a file is a field on a record, not a thing of its own — so the Upload File node needs a Collection and a Field, and a Record ID if it should attach to a record that already exists rather than creating one. Leave them blank and the upload has nowhere to go.',
      'BCN-007 live: a multipart POST to the RECORD endpoint answers 200 and the field holds a bare filename string. The handle is (collection, record id, filename) and FileRef.target carries it — the contract expresses it rather than approximating it, and this cell is degraded because the target is something the app author has to supply and cannot be guessed'
    ),
    'files.sign': degraded(
      'A PocketBase file link carries a token rather than a signature. It expires quickly (about three minutes on a default install) and it works for whoever holds it until then, so treat it as short-lived rather than shareable.',
      'BCN-007 live: POST /api/files/token answers 200 with a JWT whose exp is 180s ahead, and ?token= serves a protected file. The token is per-CALLER, not per-file — its payload names a collection and an auth-record id, not the file'
    ),
    'files.delete': degraded(
      'Deleting a file on PocketBase edits the record it belongs to — the file goes and the record stays. Deleting the record instead takes its files with it.',
      'BCN-007 live: PATCH {field: null} answers 200, the field reads "" afterwards, and the file URL becomes 404. DELETE of the record also 404s the file. Neither is symmetric with our own DELETE /files/{name}, which removes a file and leaves records pointing at it'
    ),
    'files.private': degraded(
      'PocketBase files are protected by the same rule as the record they belong to, so a file is private only if its record is. Marking a field "protected" on a collection anyone can read does nothing.',
      '⚠️ BCN-007 live, and stronger than this cell previously claimed: a field created with protected:true — confirmed round-tripped as true by reading the collection back — SERVED WITH NO CREDENTIAL AT ALL when the collection\'s view rule was public. The same field on an admin-only collection answered 404. So `protected` defers to the record rule rather than being an independent file-level control'
    ),
    'files.progress': degraded(
      'The upload works but the progress bar will not move on this backend.',
      '⚠️ CORRECTED by BCN-007. This cell read `supported` with the evidence "multipart upload goes over the XHR path". It does not: RestDataAdapter is built on `fetch`, which has no upload-progress event'
    ),

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

    // Supported, and measured — but read the second half of the evidence before
    // reusing this cell to justify anything. PocketBase accepts a subscription
    // it will never deliver, which is the same "a 200 is not a yes" shape
    // BCN-001 found in its aggregate probe.
    'realtime.subscribe': supported(
      'GET /api/realtime is Server-Sent Events, on by default — the same transport shape as BAK-001. BCN-008 measured it live against 0.30.0, anonymously and with no token anywhere: `PB_CONNECT` carries a clientId, POST /api/realtime {clientId, subscriptions:["coll"]} answers 204, and events arrive under an SSE event name that is the COLLECTION NAME rather than "change", with data {action, record}. A delete carries the whole record. Nothing at all arrived on an idle stream in 130s, so there is no observed keepalive. ⚠️ Subscribing to a collection the caller cannot list is ALSO 204 — acceptance is not gated, delivery is, so a wrong subscription is silent rather than refused.'
    )
  }),

  filters: filterTable(supported('native PocketBase filter expression'), {
    // PocketBase's filter syntax is an expression language (`status = "x" &&
    // rating > 3`) rather than a JSON operator tree, so most of the vocabulary
    // maps onto an operator symbol. `~` covers the contains family.

    matchesRegex: unsupported(
      "PocketBase can't match text with regular expressions. Use \"contains\", \"starts with\" or \"ends with\" instead.",
      'The filter language has ~ (contains) but no regex operator.'
    ),

    // ⚠️ BCN-003, live: PocketBase has no NULL for a text field — an unset
    // value *is* the empty string — so "is empty" and "is not set" are the same
    // question here and cannot be separated. All three cells say so.
    isEmpty: degraded(
      'PocketBase stores an empty value rather than a missing one, so "is empty" also matches records that were never given a value.',
      'BCN-003 live: = "" returned both the empty-string row and the row seeded without a value'
    ),
    isNotEmpty: degraded(
      'PocketBase stores an empty value rather than a missing one, so "is not empty" also excludes records that were never given a value.',
      'BCN-003 live: the complement of the above'
    ),
    exists: degraded(
      'PocketBase stores an empty value rather than a missing one, so "is set" and "is not empty" are the same question here.',
      'BCN-003 live: = null also matched the empty-string row'
    ),

    ...WILDCARD_DEGRADED,

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
