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
    // ⚠️ **The probe named the wrong field, and the field it named is `null`.**
    // Measured on PocketBase 0.30.0: `auth-methods` answers
    // `{password:{…}, oauth2:{providers:[], enabled:false}, otp:{…}, authProviders:null}`.
    // `authProviders` is the ≤0.22 spelling, kept as a deprecated alias — and on
    // an instance with OAuth **switched off** it is not an empty array, it is
    // `null`. A probe reading it would have thrown rather than reported "no
    // providers", which is the failure mode a probe exists to avoid. `oauth2` is
    // the live field and `oauth2.enabled` is the switch.
    //
    // The cell stays `conditional`, and now for a reason that was measured rather
    // than assumed: the *implementation* exists and has been driven end to end
    // (BCN-006 step 5 — a stub OIDC provider was stood up so a real round trip
    // could be observed), but whether any provider is configured is this
    // instance's business. `RestAuthAdapter.signInWithProvider` asks
    // `auth-methods` before it navigates anywhere, so this probe and the runtime
    // check are the same question asked of the same endpoint.
    'auth.oauth': conditional(
      'Signing in with Google, GitHub and the rest depends on which providers you have set up in your PocketBase admin.',
      { method: 'GET', path: '/api/collections/{collection}/auth-methods', expect: 'oauth2.enabled true, with at least one entry in oauth2.providers' },
      'MEASURED 2026-08-01 against PocketBase 0.30.0: with a provider configured, auth-methods returns oauth2.providers[] carrying a per-attempt state, codeVerifier and an authURL ending in a bare `redirect_uri=`; POST /api/collections/{c}/auth-with-oauth2 {provider, code, codeVerifier, redirectURL} answers 200 with {token, record, meta.isNew}. With OAuth off the same POST answers 403 "The collection is not configured to allow OAuth2 authentication."'
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
