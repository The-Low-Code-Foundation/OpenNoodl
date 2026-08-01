/**
 * Directus.
 *
 * The best-evidenced third-party descriptor, because Directus is the backend
 * this repo has actually stood up and driven: RUN-003 probed introspection and
 * the runtime CRUD path against a live Directus 11, and BCN-001 probed
 * aggregation, distinct and search against the same container.
 *
 * Evidence keys used below:
 * - `RUN-003` — `uba-e2e/BYOB-CONTACT-OUTPUT.txt`, live Directus 11
 * - `BCN-001` — `uba-e2e/BCN-001-AGGREGATE-PROBE-OUTPUT.txt`, same container
 *
 * @module backend-contract/descriptors/directus
 */

import type { BackendDescriptor } from '../capabilities';
import { conditional, degraded, filterTable, supported, unsupported } from './helpers';

/**
 * The nine string operators, on a backend whose `LIKE` cannot be escaped.
 *
 * Measured by BCN-003's live equivalence pass: `%` and `_` in the user's text
 * act as wildcards, a backslash escape is matched literally rather than
 * honoured, and the comparison ignores case whether the operator says so or
 * not — so `notStartsWith "Ada"` also excludes `adaline`. The three
 * `IgnoreCase` members are the ones for which that last part is not a
 * difference, so they carry the shorter sentence.
 *
 * `pocketbase.ts` has the same table for the same measured reasons. They are
 * separate copies because they are separate claims about separate products, and
 * sharing one would make a later divergence between them invisible.
 */
const WILDCARD_DEGRADED = (() => {
  const wildcards =
    'The characters % and _ act as wildcards here, so searching for text containing one will match more than you asked for.';
  const bothWays = `${wildcards} Matching also ignores capitals.`;
  const evidence = 'BCN-003 live: LIKE with no ESCAPE clause; contains "100%" also returned "1000 words"';
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

export const directusDescriptor: BackendDescriptor = {
  type: 'directus',

  // Directus issues a 15-minute access token with a refresh token beside it.
  // This is the lifecycle Parse never had, and the reason BCN-006 exists.
  tokenLifecycle: {
    kind: 'refresh',
    accessTtlSeconds: 900,
    refreshEndpoint: '/auth/refresh',
    refreshBeforeExpirySeconds: 60
  },

  capabilities: Object.freeze({
    'data.query': supported('RUN-003: GET /items/articles with a filter returned 4 records'),
    'data.count': supported('BCN-001: aggregate[count]=* returned {"count":4}'),
    'data.distinct': supported('BCN-001: groupBy alone returns one row per distinct value'),
    'data.aggregate': supported('BCN-001: count/sum/avg, groupBy, and a composed filter all answered — no opt-in'),
    'data.fetch': supported('RUN-003: GET /items/{collection}/{id}'),
    'data.create': supported('RUN-003: POST /items/articles returned 200, id=4'),
    'data.save': supported('PATCH /items/{collection}/{id} — byob-update-record.ts ships against it'),
    'data.delete': supported('DELETE /items/{collection}/{id} — byob-delete-record.ts ships against it'),

    'data.increment': degraded(
      "Directus has no way to add to a number in one step, so NodeGX reads the value and writes it back. If two people increment the same record at the same moment, one of the changes can be lost.",
      'No atomic increment in the Directus items API; read-modify-write is the only route.'
    ),

    'data.acl': unsupported(
      'Directus controls access with roles and permissions, set up in your Directus admin — not per record from here.',
      'Directus permissions are role-scoped policy, not a per-record ACL field.'
    ),

    // Verified and genuinely surprising: ?search= matched articles whose
    // *status* was "published" when the term was "Published", returning titles
    // that do not contain the word at all.
    'data.search': degraded(
      'Directus searches every field in the record, not just the text ones, and does not rank the results. Expect matches you did not intend. For ranked search, use the built-in backend.',
      'BCN-001: ?search=Published returned three articles matched on their status field, unranked'
    ),

    'relations.pointerRead': supported(
      'BCN-005 live: ?fields=*,author.* nests the author. An M2M needs two hops (tags.tag_id.*) because one hop returns junction rows; the adapter emits the two-hop path and flattens the result'
    ),

    // RUN-003's recorded residual, closed for reading and writing; `relatedTo`
    // is the one relation cell that stays refused, and for a different reason
    // from before — see below.
    'relations.relatedTo': unsupported(
      'Filtering by "records related to this one" is not available on Directus. Filter on a field of the related record instead, such as author → name.',
      'BCN-005 live: filtering across a relation works via a nested path ({author:{city:{_eq}}}) and across an M2M via the junction, but Parse\'s $relatedTo asks for members of one record\'s relation set, which has no Directus spelling. The dotted-path filter is the replacement and it is measured working'
    ),
    'relations.addRemove': degraded(
      'Adding a related record writes a row in a join table, and Directus join tables allow the same pair twice. NodeGX checks first so you will not get duplicates, but if two people add the same one at the same moment you can.',
      'BCN-005 live: POST junction row 200; the same pair posted twice creates a second row, so addRelation reads before it writes. DELETE of a pair that never existed answers 204, so a remove cannot report "was not there"'
    ),

    'files.upload': supported('POST /files, multipart'),
    'files.sign': supported('Directus asset tokens on /assets/{id}'),
    'files.delete': supported('DELETE /files/{id}'),
    'files.private': supported('folder and role permissions on directus_files'),
    'files.progress': supported('XHR upload path is client-side'),

    'auth.password': supported('POST /auth/login'),
    'auth.signUp': conditional(
      'Letting people sign themselves up needs public registration turned on in your Directus settings. It is off by default.',
      { method: 'POST', path: '/users/register', expect: 'anything other than 403 FORBIDDEN' },
      'Directus public registration is opt-in per project.'
    ),
    'auth.signUpProperties': degraded(
      'Directus stores the login and the profile separately, so signing up takes two steps. If the second one fails the account still exists, without the profile details.',
      'directus_users holds credentials; profile fields typically live in a separate collection.'
    ),
    'auth.emailVerify': conditional(
      'Verification emails need email set up in your Directus instance.',
      { method: 'GET', path: '/server/info', expect: 'a project mail configuration' },
      'Directus EMAIL_TRANSPORT is deployment configuration.'
    ),
    'auth.passwordReset': conditional(
      'Password reset emails need email set up in your Directus instance.',
      { method: 'POST', path: '/auth/password/request', expect: 'anything other than a mail-transport error' },
      'Same EMAIL_TRANSPORT dependency.'
    ),
    'auth.oauth': conditional(
      'Signing in with Google, GitHub and the rest depends on which providers your Directus instance was set up with.',
      { method: 'GET', path: '/auth', expect: 'a list of configured SSO providers' },
      'Directus AUTH_PROVIDERS is deployment configuration; GET /auth enumerates them.'
    ),
    'auth.magicLink': unsupported(
      'Directus has no magic-link login. Use email and password, or an OAuth provider.',
      'No passwordless flow in the Directus auth API.'
    ),

    // ⚠️ The probe moved from `/server/info` to the handshake itself, because
    // BCN-008 measured what `/server/info` actually returns on an instance with
    // `WEBSOCKETS_ENABLED=true`: `{data:{project:{…},setupCompleted:true}}` and
    // no websocket section of any kind. The old probe would have reported
    // `unsupported` on a server where realtime works perfectly.
    'realtime.subscribe': conditional(
      'Live updates need WebSockets enabled on your Directus instance. They are off by default.',
      {
        method: 'GET',
        kind: 'websocket',
        path: '/websocket',
        expect:
          'a 101 upgrade. Nothing else settles it — /server/info says nothing about websockets even when they are on. Give up after a deadline: a Directus server that does not upgrade a path fires NEITHER error NOR close (measured silent for 20s).'
      },
      'BCN-008, live against Directus 11 with WEBSOCKETS_ENABLED=true: open in single-digit ms, auth ok, subscribe confirmed by an `init` frame. A delete on an INTEGER primary key arrives as data:["1"] — keys only, coerced to string. Server pings every 30s and closes a client that does not pong (measured at 60s, code 1005).'
    )
  }),

  filters: filterTable(supported('native Directus filter operator'), {
    // The neutral vocabulary was chosen partly because Directus covers most of
    // it natively — these are its own operators, one rename away. The
    // exceptions below were measured by BCN-003's live equivalence pass against
    // Directus 11, and three of them contradict what this table said when it
    // was written from the documentation.

    // ⚠️ BCN-003, live: Directus 11 answers a `_regex` filter on a string field
    // with `400 Invalid query. "string" field type does not contain the
    // "_regex" filter operator.` Documented, but not served for ordinary text
    // columns — precisely the "documented, not probed" distinction this package
    // exists to make.
    matchesRegex: unsupported(
      'Directus cannot match text with regular expressions. Use "contains", "starts with" or "ends with" instead.',
      'BCN-003 live: 400 — "string field type does not contain the _regex filter operator"'
    ),

    // ⚠️ BCN-003, live: `_contains` is `LIKE '%value%'` with no escape
    // available — a `%` or `_` the user typed acts as a wildcard, and a
    // backslash is matched literally rather than honoured. Searching for "100%"
    // also returns "1000 words". Degraded rather than unsupported because the
    // condition *is* applied; it is broader than asked, not absent.
    ...WILDCARD_DEGRADED,

    // ⚠️ BCN-003, live: `_empty` matches a NULL as well as an empty string, so
    // it answers a different question from the neutral `isEmpty` — which exists
    // precisely because "empty" and "not set" are not the same question.
    isEmpty: degraded(
      'On Directus, "is empty" also matches records where the field was never set.',
      'BCN-003 live: _empty returned both the empty-string row and the NULL row'
    ),
    isNotEmpty: degraded(
      'On Directus, "is not empty" also excludes records where the field was never set.',
      'BCN-003 live: the complement of the above'
    ),

    relatedTo: unsupported(
      'Filtering by "records related to this one" is not available on Directus yet.',
      'Needs a junction-table query. BCN-005.'
    ),

    textSearch: degraded(
      'Directus searches every field in the record and does not rank the results.',
      'BCN-001: ?search= is substring-across-all-fields'
    ),

    nearSphere: unsupported(
      "Location filters aren't available on Directus.",
      'No geo operators in the Directus filter syntax.'
    ),
    withinBox: unsupported("Location filters aren't available on Directus.", 'No geo operators.'),
    withinPolygon: unsupported("Location filters aren't available on Directus.", 'No geo operators.')
  })
};
