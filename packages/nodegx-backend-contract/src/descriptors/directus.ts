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

    'relations.pointerRead': supported('RUN-003: M2O foreign keys parsed and mapped to ports'),

    // RUN-003's recorded residual, carried forward rather than rediscovered.
    'relations.relatedTo': unsupported(
      'Filtering by "records related to this one" is not available on Directus yet.',
      "RUN-003 found relations are dropped by the BYOB path; Directus needs GET /relations to resolve M2M junctions. BCN-005 owns this."
    ),
    'relations.addRemove': unsupported(
      'Adding and removing related records is not available on Directus yet.',
      'RUN-003 residual: O2M/M2M need GET /relations. BCN-005 owns this.'
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

    'realtime.subscribe': conditional(
      'Live updates need WebSockets enabled on your Directus instance. They are off by default.',
      { method: 'GET', path: '/server/info', expect: 'a websocket section, or a successful ws:// handshake' },
      'WEBSOCKETS_ENABLED defaults to false. RUN-003 ran with it on and found the socket never fired close — a defect BCN-008 inherits.'
    )
  }),

  filters: filterTable(supported('native Directus filter operator'), {
    // The neutral vocabulary was chosen partly because Directus covers most of
    // it natively — these are its own operators, one rename away.

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
