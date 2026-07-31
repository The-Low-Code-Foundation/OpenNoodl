/**
 * Parse Server — someone else's, hosted by them.
 *
 * Kept as a preset by decision, not by inertia: projects exist that point at a
 * real Parse Server, and the wire is one we already speak.
 *
 * **Evidence quality is the thing to know about this file.** Every cell is
 * transcribed from Parse Server's documented REST API and from the fact that
 * `cloudstore.js` has shipped against it for years. None of it is probed —
 * we do not run a Parse Server anywhere in this repo, and standing one up was
 * not in BCN-001's scope. Where the documentation is unambiguous that is fine.
 * Where it is not, the cell is `conditional` and carries a probe, which is the
 * honest state for "this depends on the deployment and we have not asked it".
 *
 * @module backend-contract/descriptors/parse
 */

import type { BackendDescriptor } from '../capabilities';
import { conditional, filterTable, supported, unsupported } from './helpers';

const SHIPPED = 'cloudstore.js has spoken this wire since Noodl; not probed — no Parse Server is run in this repo';

export const parseDescriptor: BackendDescriptor = {
  type: 'parse',

  // Parse session tokens do not expire. This is the reason there is no
  // `refresh` method among the ten auth methods: the interface was extracted
  // from a codebase that had only ever talked to Parse.
  tokenLifecycle: { kind: 'eternal' },

  capabilities: Object.freeze({
    'data.query': supported(SHIPPED),
    'data.count': supported(SHIPPED),

    // The one place Parse and the built-in backend genuinely part company.
    // Upstream Parse Server requires the master key for /aggregate, and the
    // master key must never be in a browser — so this is not "hard from the
    // client", it is closed to it. Marked unsupported rather than conditional
    // because no per-instance setting opens it up.
    'data.aggregate': unsupported(
      'Parse Server only allows totals and averages from a trusted server, not from your app. Query the records and calculate in your app, or switch this node to the built-in backend.',
      'Parse Server REST docs: /aggregate is master-key only. Documented, not probed.'
    ),
    'data.distinct': unsupported(
      'Parse Server only allows distinct values from a trusted server, not from your app.',
      'Parse Server REST docs: /aggregate/distinct is master-key only. Documented, not probed.'
    ),

    'data.fetch': supported(SHIPPED),
    'data.create': supported(SHIPPED),
    'data.save': supported(SHIPPED),
    'data.increment': supported(`__op: 'Increment' is atomic on Parse. ${SHIPPED}`),
    'data.delete': supported(SHIPPED),
    'data.acl': supported(`Parse ACLs are the model BAK-003 was built to match. ${SHIPPED}`),

    // BAK-008's `search` parameter is ours. Parse has $text, which is a filter
    // operator and is indexed only if someone created the index — see the
    // filter table below. There is no ranked-search parameter to map onto.
    'data.search': unsupported(
      'Parse Server has no ranked search. Use a "contains" filter on the field you want to search, or switch this node to the built-in backend.',
      'The search parameter is BAK-008, ours. Parse offers $text as a filter operator only.'
    ),

    'relations.pointerRead': supported(SHIPPED),
    'relations.relatedTo': supported(`$relatedTo is Parse's own operator. ${SHIPPED}`),
    'relations.addRemove': supported(`__op AddRelation/RemoveRelation. ${SHIPPED}`),

    'files.upload': supported(SHIPPED),
    'files.sign': conditional(
      'Signed file links depend on how your Parse Server stores files. Servers using S3 can sign them; the default local file store cannot.',
      { method: 'GET', path: '/files/probe.txt', expect: 'a redirect to a URL carrying a signature or expiry parameter' },
      'Parse file adapters differ: S3Adapter presigns, GridFS and the filesystem adapter serve unsigned URLs. Documented, not probed.'
    ),
    'files.delete': supported(`master key is not required for file delete on most deployments. ${SHIPPED}`),
    'files.private': unsupported(
      'Parse Server files are public to anyone with the link. To keep a file private, store it on the built-in backend instead.',
      'The private flag is the X-NodeGX-File-Private header — ours, not Parse\'s.'
    ),
    'files.progress': supported('the XHR upload path is client-side and works against any wire'),

    'auth.password': supported(SHIPPED),
    'auth.signUp': supported(SHIPPED),
    'auth.signUpProperties': supported(`the Parse user is a row in _User, so profile fields write in the same call. ${SHIPPED}`),
    'auth.emailVerify': conditional(
      'Email verification needs your Parse Server to have an email adapter configured. Many do not.',
      { method: 'POST', path: '/verificationEmailRequest', expect: 'anything other than a "no email adapter" error' },
      'Parse Server verifyUserEmails requires a configured mail adapter. Documented, not probed.'
    ),
    'auth.passwordReset': conditional(
      'Password reset emails need your Parse Server to have an email adapter configured. Many do not.',
      { method: 'POST', path: '/requestPasswordReset', expect: 'anything other than a "no email adapter" error' },
      'Same mail-adapter dependency as verification. Documented, not probed.'
    ),
    'auth.oauth': conditional(
      'Signing in with Google, GitHub and the rest depends on which providers your Parse Server was set up with.',
      { method: 'GET', path: '/serverInfo', expect: 'an auth section listing configured providers' },
      'Parse authDataManager providers are server configuration. Documented, not probed.'
    ),
    'auth.magicLink': unsupported(
      'Parse Server has no magic-link login. Use email and password, or an OAuth provider.',
      'No passwordless flow exists in the Parse REST API.'
    ),

    // The cell that justifies the four-state model existing at all. A user
    // enables realtime, gets nothing, and there is no error anywhere because
    // the node never managed to connect.
    'realtime.subscribe': conditional(
      'Live updates need a Parse LiveQuery server, which most Parse setups do not run. Check with whoever hosts yours.',
      { method: 'GET', path: '/serverInfo', expect: 'a liveQueryServer entry, or a reachable ws:// endpoint' },
      'LiveQuery is a separate process with its own port. Documented, not probed.'
    )
  }),

  filters: filterTable(supported(SHIPPED), {
    // Parse has no native contains/startsWith/endsWith or between. They are
    // NOT gated: `contains` is `$regex`, `between` is two comparisons under an
    // `and`, and Parse's regex is a real regex so the lowering is exact. See
    // LOWERED_OPERATORS — greying these out on a backend that can plainly
    // answer them would read as the product being broken.
    contains: supported('lowered to $regex'),
    notContains: supported('lowered to $regex under $not'),
    containsIgnoreCase: supported('lowered to $regex with the i option'),
    startsWith: supported('lowered to an anchored $regex'),
    notStartsWith: supported('lowered to an anchored $regex under $not'),
    startsWithIgnoreCase: supported('lowered to an anchored $regex with the i option'),
    endsWith: supported('lowered to an anchored $regex'),
    notEndsWith: supported('lowered to an anchored $regex under $not'),
    endsWithIgnoreCase: supported('lowered to an anchored $regex with the i option'),
    between: supported('lowered to $gte + $lte under $and'),
    notBetween: supported('lowered to $lt + $gt under $or'),

    // Parse has no operator for "empty string or empty array" as distinct from
    // null, and no way to synthesise one: $exists answers the null question
    // only. This is a genuine gap rather than a lowering opportunity.
    isEmpty: unsupported(
      "Parse Server can't tell an empty value from a missing one. Use \"is not set\" instead, or compare the field to an empty string.",
      'No $empty equivalent; $exists answers presence only.'
    ),
    isNotEmpty: unsupported(
      "Parse Server can't tell an empty value from a missing one. Use \"is set\" instead.",
      'No $nempty equivalent.'
    ),

    textSearch: conditional(
      'Full-text search on Parse needs a text index on the field, created in your database.',
      { method: 'GET', path: '/classes/{collection}', expect: 'a $text query returning without an index error' },
      'Parse $text requires a MongoDB text index. Documented, not probed.'
    )
  })
};
