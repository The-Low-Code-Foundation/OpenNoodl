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
    'files.delete': supported(`BAK-006${DRIVEN} with the app id alone, where upstream Parse needs the master key`),
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
    // ── The two silent-wrong-answer cells ──────────────────────────────────
    //
    // Both were found by reading the SQL translator during BCN-001, and both
    // are worse than an unsupported operator because nothing fails: the query
    // succeeds and returns the wrong rows.

    // `$regex` becomes `LIKE '%value%'` (QueryBuilder.ts:366), with the code's
    // own comment conceding "only handles basic patterns". A user who writes
    // `^Ada$` gets a substring search for the literal text `^Ada$` and no
    // error. Degraded rather than unsupported because plain-substring intent —
    // which is most of what people type — does work.
    matchesRegex: degraded(
      "The built-in backend matches text by containment, not by full regular expressions. Anchors like ^ and $, character classes and groups are treated as literal characters.",
      `${SQL}:366 — SQLite has no native REGEXP, so this lowers to LIKE '%…%'`
    ),

    // Same lowering. Distinct from the `search` query option, which is real
    // FTS5 ranking (BAK-008) and is `data.search`.
    textSearch: degraded(
      'Full-text search in a filter falls back to a plain contains match. For ranked search use the Search input on the Query node instead.',
      `${SQL}:376 — $text lowers to LIKE; the ranked path is BAK-008's separate 'search' parameter`
    ),

    // ── Geo: dropped on the floor ──────────────────────────────────────────
    //
    // `translateOperator` warns to the console and returns null for all three
    // (QueryBuilder.ts:394). A null condition is not added to the WHERE clause,
    // so the filter does not narrow anything — a "within 5km" query returns
    // every record in the collection, with nothing in the app to see.
    //
    // Marked unsupported so BCN-010 gates the ports off. Fixing SQLite geo is
    // out of scope for this phase; telling the truth about it is not.
    nearSphere: unsupported(
      'The built-in backend cannot filter by location. Store latitude and longitude as numbers and compare them, or use a backend with geo support.',
      `${SQL}:394 — warns and drops the condition, so the query currently returns everything`
    ),
    withinBox: unsupported(
      'The built-in backend cannot filter by location. Store latitude and longitude as numbers and compare them, or use a backend with geo support.',
      `${SQL}:394 — warns and drops the condition`
    ),
    withinPolygon: unsupported(
      'The built-in backend cannot filter by location. Store latitude and longitude as numbers and compare them, or use a backend with geo support.',
      `${SQL}:394 — warns and drops the condition`
    )
  })
};
