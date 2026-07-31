/**
 * Parse Server — someone else's, hosted by them.
 *
 * Kept as a preset by decision, not by inertia: projects exist that point at a
 * real Parse Server, and the wire is one we already speak.
 *
 * **Evidence quality is the thing to know about this file, and it changed in
 * BCN-002.** BCN-001 shipped every cell here transcribed from Parse Server's
 * documented REST API, because no Parse Server existed in this repo. One does
 * now — `parseplatform/parse-server:7.3.0` on the rig's `parse` profile — and
 * the data, relation and file cells have been driven against it by the real
 * `ParseWireAdapter`. Cells carrying `PROBED` were measured; cells still
 * carrying `SHIPPED` were not, and say so.
 *
 * **Three cells were wrong, and the documentation is why.** Reading the docs
 * produced `files.upload: supported`, `files.delete: supported` and
 * `files.sign: conditional`. A real server says: uploads are refused outright
 * unless the deployment turned them on, deleting a file needs the master key,
 * and the signing route does not exist at all. All three are the kind of wrong
 * that only shows up in a user's app.
 *
 * @module backend-contract/descriptors/parse
 */

import type { BackendDescriptor } from '../capabilities';
import { conditional, filterTable, supported, unsupported } from './helpers';

const SHIPPED = 'cloudstore.js has spoken this wire since Noodl; documented, not probed';

/**
 * BCN-002's live pass: the real `ParseWireAdapter` against
 * `parseplatform/parse-server:7.3.0`, recorded in the rig's
 * `BCN-002-PARSE-WIRE-OUTPUT.txt`.
 */
const PROBED = 'BCN-002 live pass against parse-server 7.3.0, app id only';

export const parseDescriptor: BackendDescriptor = {
  type: 'parse',

  // Parse session tokens do not expire. This is the reason there is no
  // `refresh` method among the ten auth methods: the interface was extracted
  // from a codebase that had only ever talked to Parse.
  tokenLifecycle: { kind: 'eternal' },

  capabilities: Object.freeze({
    'data.query': supported(`${PROBED}; filtered read with $gt returned the matching row only`),
    'data.count': supported(PROBED),

    // The one place Parse and the built-in backend genuinely part company, and
    // the reason BCN-001 gave them separate columns. It is no longer a reading
    // of the docs: asked with the app id alone, Parse answers
    // `unauthorized: master key is required`; asked with the master key, it
    // answers 200 with the total. The master key must never be in a browser, so
    // this is not "hard from the client", it is closed to it. `unsupported`
    // rather than `conditional` because no per-instance setting opens it up.
    'data.aggregate': unsupported(
      'Parse Server only allows totals and averages from a trusted server, not from your app. Query the records and calculate in your app, or switch this node to the built-in backend.',
      `${PROBED}: 403 "unauthorized: master key is required"; the same call with the master key returns 200 and the total`
    ),
    'data.distinct': unsupported(
      'Parse Server only allows distinct values from a trusted server, not from your app.',
      `${PROBED}: /aggregate?distinct= is refused without the master key and answers 200 with it`
    ),

    'data.fetch': supported(PROBED),
    'data.create': supported(PROBED),
    'data.save': supported(PROBED),
    'data.increment': supported(`__op: 'Increment' is atomic on Parse. ${PROBED}, and the response carried the new value`),
    'data.delete': supported(PROBED),
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
    'relations.addRemove': supported(`__op AddRelation/RemoveRelation. ${PROBED}, both directions, app id only`),

    // Corrected in BCN-002, and the correction is the argument for probing.
    // Parse Server disables file upload by default for *everyone* — public,
    // anonymous and authenticated alike — so an out-of-the-box server answers
    // the Upload File node with `File upload by public is disabled.` The
    // documentation reads as though upload is simply available; it is not, and
    // the difference is per deployment, which is what `conditional` means.
    'files.upload': conditional(
      'Whether your Parse Server accepts uploads depends on how it was set up — new servers turn file uploads off. Ask whoever hosts yours to enable them.',
      {
        method: 'POST',
        path: '/files/probe.txt',
        expect: 'a 201 with a name and url, rather than error code 130 "File upload by public is disabled"'
      },
      `${PROBED}: a server started with Parse's defaults answers 400 code 130; the same server with fileUpload.enableForPublic accepts it`
    ),
    // Corrected in BCN-002 from `conditional`. The probe BCN-001 wrote asked
    // whether Parse's file adapter presigns URLs, which is a real question —
    // but the contract's `signFileUrl` calls `GET /files/:name/sign`, and that
    // route is BAK-006's, ours. Parse has no route there at all: it answers 403
    // code 119 "Invalid application ID" *even with the master key*, which is
    // what a missing route looks like from behind Parse's router.
    'files.sign': unsupported(
      'Parse Server has no way to mint a temporary link to a file. Store files on the built-in backend if you need links that expire.',
      `${PROBED}: GET /files/:name/sign answers 403 code 119 with the master key as well as without — the route is BAK-006's, not Parse's`
    ),
    // Corrected in BCN-002. The old cell read `supported`, with "master key is
    // not required for file delete on most deployments" — the opposite of what
    // a real server does, and a confident wrong answer about a delete.
    'files.delete': unsupported(
      'Parse Server only allows a file to be deleted from a trusted server, not from your app.',
      `${PROBED}: DELETE /files/:name answers 403 "unauthorized: master key is required", and 200 with the master key`
    ),
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
