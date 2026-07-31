/**
 * "Built-in" — the backend that ships with NodeGX.
 *
 * The best-evidenced descriptor in the set, because the backend is in this
 * repository and every cell below was read rather than believed. It is also the
 * one that turned up two places where **our own backend silently returns wrong
 * answers**, which is a useful reminder that the descriptor is not a courtesy
 * extended to third parties.
 *
 * @module backend-contract/descriptors/nodegx
 */

import type { BackendDescriptor } from '../capabilities';
import { degraded, filterTable, supported, unsupported } from './helpers';

const WIRE = 'nodegx-backend/src/server/parse-wire.ts';
const SQL = 'noodl-runtime/src/api/adapters/local-sql/QueryBuilder.ts';

/**
 * BCN-002's live pass drove the real `ParseWireAdapter` against a running
 * `nodegx-backend`, so the cells carrying this were not only read in the
 * handler — they answered. Recorded in the rig's
 * `BCN-002-PARSE-WIRE-OUTPUT.txt`.
 *
 * The cells without it (`data.acl`, `data.search`, the two pointer/relation
 * reads, `files.private`, `files.progress`) are still read-not-driven, and the
 * distinction is the whole reason this field exists.
 */
const DRIVEN = '; driven live in BCN-002';

export const nodegxDescriptor: BackendDescriptor = {
  type: 'nodegx',

  // Parse-style session tokens, and ours do not expire either. BCN-006 has
  // nothing to schedule here — which is exactly why the token lifecycle had to
  // be declared rather than discovered: the backend we develop against is the
  // one backend that would never have revealed the problem.
  tokenLifecycle: { kind: 'eternal' },

  capabilities: Object.freeze({
    'data.query': supported(`POST/GET /classes/:c — ${WIRE}:6${DRIVEN}, including a $gt filter`),
    'data.count': supported(`GET /classes/:c with count=1 — ${WIRE}:7${DRIVEN}`),

    // Verified in BCN-001's probe work by reading the handler, and it settles
    // README footnote 2: there is no master-key check anywhere in parse-wire.ts.
    // Both routes are governed by the `find` permission and the read ACL, so
    // they reveal exactly what find reveals and work from a browser. Upstream
    // Parse restricts the same route to the master key, which is the whole
    // reason `nodegx` and `parse` are separate rows in this package.
    'data.distinct': supported(`GET /aggregate/:c — ${WIRE}:246-284, ACL-governed, no master key${DRIVEN} with the app id alone, where upstream Parse refuses`),
    'data.aggregate': supported(`GET /aggregate/:c — ${WIRE}:246-284, ACL-governed, no master key${DRIVEN} with the app id alone, where upstream Parse refuses`),

    'data.fetch': supported(`GET /classes/:c/:id — ${WIRE}:8${DRIVEN}`),
    'data.create': supported(`POST /classes/:c — ${WIRE}:6${DRIVEN}`),
    'data.save': supported(`PUT /classes/:c/:id — ${WIRE}:9${DRIVEN}`),
    'data.increment': supported(`PUT with __op: 'Increment' — ${WIRE}:88, atomic${DRIVEN}`),
    'data.delete': supported(`DELETE /classes/:c/:id — ${WIRE}:10${DRIVEN}`),
    'data.acl': supported('BAK-003: CLP + row-level ACL, filtered in SQL'),
    'data.search': supported('BAK-008: FTS5 ranking on a dedicated `search` parameter — parse-wire.ts:126'),

    'relations.pointerRead': supported('Pointer columns resolve via include'),
    'relations.relatedTo': supported(`junction-table subquery on _Join_<key>_<class> — ${SQL}:254`),
    'relations.addRemove': supported(`PUT with __op AddRelation/RemoveRelation — ${WIRE}:90${DRIVEN}, both directions`),

    'files.upload': supported(`BAK-006 file storage v2${DRIVEN} with the app id alone, where a stock Parse Server refuses outright`),
    'files.sign': supported(`BAK-006: SigV4 presign, or a local signed URL${DRIVEN}, returning a url with exp and sig`),
    // BCN-007 step 5, for the one backend whose delete route is in this repo and
    // could be read line by line. Three semantics, all from
    // `nodegx-backend/src/server/files.ts`'s `delete`, and each one is something
    // an app author would otherwise discover from a broken image:
    //
    //  - It is **permanent and immediate** — blob, `_Files` metadata row and
    //    cached thumbnails all go. There is no trash and no restore.
    //  - It is **idempotent**: an unknown stored name answers 200 `{}` rather
    //    than 404, deliberately, matching WF-004. So a Delete File that reports
    //    success is not evidence the file existed.
    //  - It **does not touch records that point at the file**. A File-typed
    //    property persists as `{__type:'File', url, name}` and nothing scans for
    //    those, so the record keeps a link that now 404s. (The orphan sweep runs
    //    the other way — blobs with no metadata row — and does not help here.)
    //
    // These stay `supported` rather than becoming `degraded`: none of them is a
    // capability the backend lacks, and a `degraded` cell puts a warning in front
    // of the user in BCN-010's gating, which would be wrong for behaviour that is
    // both intended and normal.
    'files.delete': supported(
      `BAK-006${DRIVEN} with the app id alone, where upstream Parse needs the master key. Permanent (blob + _Files row + cached thumbnails), idempotent on an unknown name (200, not 404), and leaves File-typed record properties pointing at a URL that now 404s — files.ts delete()`
    ),
    'files.private': supported('X-NodeGX-File-Private header — cloudstore.js:446, ours by construction'),
    'files.progress': supported('XHR upload path reports progress'),

    'auth.password': supported('nodegx-backend/src/server/users.ts'),
    'auth.signUp': supported('nodegx-backend/src/server/users.ts'),
    'auth.signUpProperties': supported('the user is a record in a collection, so profile fields write in the same call'),
    'auth.emailVerify': supported('BAK-002: SMTP + templates'),
    'auth.passwordReset': supported('BAK-002'),
    'auth.oauth': supported('BAK-004'),
    'auth.magicLink': supported('BAK-004 passwordless'),

    // Not Parse LiveQuery — parse-wire.ts:13 says live queries are explicitly
    // not implemented. BAK-001 shipped Server-Sent Events over a generic
    // ChangeBus instead. Same capability from a node's point of view, entirely
    // different transport, which is BCN-008's problem rather than this file's.
    'realtime.subscribe': supported('BAK-001: SSE at GET /realtime, not Parse LiveQuery')
  }),

  filters: filterTable(supported(`translated to SQL — ${SQL}`), {
    // ── The two silent-wrong-answer cells, both closed by BCN-003 ──────────
    //
    // Both were found by reading the SQL translator during BCN-001, and both
    // were worse than an unsupported operator because nothing failed: the
    // query succeeded and returned the wrong rows. Richard assigned both here
    // on 2026-07-31.
    //
    // What made them fixable rather than merely declarable is that
    // `node:sqlite` exposes `db.function()`, so SQLite can call back into
    // JavaScript. The regular expression is now the same engine the user's
    // browser would use, and the geometry is ordinary JavaScript rather than
    // an approximation in SQL.

    // Was `LIKE '%value%'` (QueryBuilder.ts:366), so `^Ada$` searched for that
    // literal text. Now `nodegx_regexp(pattern, flags, column)`, a real
    // RegExp, with `$options` read from its sibling key rather than as an
    // operator of its own.
    matchesRegex: supported(
      `${SQL} — a registered SQL function evaluating a real RegExp; probed live in BCN-003, where ^Ada$ matched "Ada" and not "Adam"`
    ),

    // Unchanged, and still honest. `$text` in a *filter* is a different thing
    // from the `search` query option, which is real FTS5 ranking (BAK-008).
    // Only the filter-operator form lowers to a contains match.
    textSearch: degraded(
      'Full-text search in a filter falls back to a plain contains match. For ranked search use the Search input on the Query node instead.',
      `${SQL} — $text lowers to LIKE; the ranked path is BAK-008's separate 'search' parameter`
    ),

    // ── Geo: no longer dropped on the floor ────────────────────────────────
    //
    // All three used to warn to the console and return null, and a null
    // condition is never added to the WHERE clause — so a "within 5 km" query
    // returned every record in the collection with nothing in the app to see.
    //
    // A GeoPoint is stored as its Parse tagged object, JSON-encoded, which is
    // why the box test reads through `json_extract` and the other two hand the
    // column to a registered function. What we own by fixing rather than
    // gating these is one performance characteristic — there is no spatial
    // index, so all three scan — and that is stated rather than implied.

    nearSphere: degraded(
      'Distance filters work, but the results are not ordered by how close they are, and the whole collection is checked — so a large collection will be slow.',
      `${SQL} — nodegx_distance_km(), haversine; Parse reads a bare $nearSphere as a proximity *sort*, and sorting is out of BCN-003's scope`
    ),
    withinBox: supported(
      `${SQL} — two range comparisons on json_extract'd coordinates; exact, but unindexed`
    ),
    withinPolygon: supported(
      `${SQL} — nodegx_point_in_polygon(), ray casting. Planar, which is what Mongo's legacy $polygon is too, so this agrees with Parse rather than diverging from it`
    )
  })
};
