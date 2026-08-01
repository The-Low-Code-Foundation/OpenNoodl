/**
 * Supabase.
 *
 * Supabase's REST layer **is** PostgREST, which is what makes this descriptor
 * probeable at all: RUN-003 verified the schema parser against a live PostgREST
 * OpenAPI document, and BCN-001 probed aggregation against two PostgREST 12.2.3
 * servers that differed in exactly one setting.
 *
 * The caveat that matters: raw PostgREST is not the hosted Supabase platform.
 * The wire is identical and the auth headers differ, but Supabase sets its own
 * defaults for things like `db-aggregates-enabled` and changes them over time.
 * Which is not a weakness of the probe — it is the argument for `conditional`.
 *
 * @module backend-contract/descriptors/supabase
 */

import type { BackendDescriptor } from '../capabilities';
import { conditional, degraded, filterTable, supported, unsupported } from './helpers';

export const supabaseDescriptor: BackendDescriptor = {
  type: 'supabase',

  tokenLifecycle: {
    kind: 'refresh',
    accessTtlSeconds: 3600,
    refreshEndpoint: '/auth/v1/token?grant_type=refresh_token',
    refreshBeforeExpirySeconds: 120
  },

  capabilities: Object.freeze({
    'data.query': supported('RUN-003 drove the real parser against a live PostgREST OpenAPI spec'),

    // Answered by the Content-Range header under `Prefer: count=exact`, which
    // is a different mechanism from the aggregate machinery entirely — it
    // worked on the server with aggregates disabled. This is the concrete
    // reason data.count and data.aggregate are separate keys.
    'data.count': supported('BCN-001: Prefer: count=exact + Range: 0-0 returned content-range 0-0/7 with aggregates OFF'),

    // The cell BCN-001 was sent to resolve.
    'data.aggregate': conditional(
      'Totals and averages have to be switched on for your Supabase project. If this stays unavailable after connecting, enable aggregate functions in your project settings.',
      { method: 'GET', path: '/{collection}?select=count()', expect: '200 with [{"count":N}] — a 400 carrying code PGRST123 means it is off' },
      'BCN-001: stock PostgREST 12.2.3 answers PGRST123 "Use of aggregate functions is not allowed"; the same binary with db-aggregates-enabled=true answers count/sum/avg, groupBy and composed filters. Per-instance setting, and Supabase sets it independently of the PostgREST default.'
    ),

    'data.distinct': unsupported(
      'Supabase has no way to list the distinct values of a column from here. Make a database view for it, or fetch the records and reduce them in your app.',
      'BCN-001: no query-string form. Both plausible spellings are PGRST100 parse errors.'
    ),

    'data.fetch': supported('GET /{table}?{pk}=eq.{id}'),
    'data.create': supported('POST /{table} with Prefer: return=representation'),
    'data.save': supported('PATCH /{table}?{pk}=eq.{id}'),
    'data.delete': supported('DELETE /{table}?{pk}=eq.{id}'),

    'data.increment': degraded(
      'Supabase has no way to add to a number in one step from here, so NodeGX reads the value and writes it back. If two people increment the same record at the same moment, one of the changes can be lost. A database function would avoid this.',
      'PostgREST can only do this atomically through an RPC the user has to author. BCN-004 may offer to detect one.'
    ),

    'data.acl': unsupported(
      'Supabase controls access with Row Level Security, set up in your Supabase dashboard — not per record from here.',
      'RLS is database policy; there is no per-record ACL field on the wire.'
    ),

    'data.search': conditional(
      'Ranked search needs a text-search index on the table in your Supabase database.',
      { method: 'GET', path: '/{collection}?select={pk}&{field}=fts.test', expect: '200 rather than a missing-index or unknown-operator error' },
      "PostgREST exposes Postgres full-text search via fts/plfts/phfts operators, which need a tsvector column or index to be useful."
    ),

    'relations.pointerRead': supported(
      'BCN-005 live: ?select=*,author:authors(*) nests the author under the name you asked for. A filter on the related record needs the embed marked !inner or the parent rows are not narrowed — measured both ways, and the adapter emits it'
    ),
    'relations.relatedTo': unsupported(
      'Filtering by "records related to this one" is not available on Supabase. Filter on a field of the related record instead, such as author → name.',
      "BCN-005 live: a dotted filter with an !inner embed narrows the parent correctly, but Parse's $relatedTo has no PostgREST spelling"
    ),
    'relations.addRemove': degraded(
      'Adding a many-to-many relation needs the join table to use both of its links as its key. Where it uses a separate id column instead, Supabase cannot see the relation at all and NodeGX will say so rather than write to the wrong place.',
      'BCN-005 live: with PRIMARY KEY (article_id, tag_id) the M2M embed answers 200 and POST with Prefer: resolution=merge-duplicates makes the add idempotent; with a surrogate id primary key the identical two tables answer PGRST200 "no matches were found" and no request recovers the relation'
    ),

    // ── Files — BCN-007 steps 2/5/7 ──────────────────────────────────────
    //
    // ⚠️ **These five were the only Supabase cells in the descriptor written
    // from documentation that BCN-007 could turn into measurements.** The rig
    // has never had a Storage service — `:8056` is plain PostgREST and answers
    // every `/storage/v1/*` with a bare `404 {}` — and BCN-006 hit the same wall
    // on auth and correctly refused to flip anything, moving four cells to
    // `conditional` instead. Rather than repeat that here, BCN-007 stood a real
    // `supabase/storage-api` up against the rig's existing `supabase-db` and
    // probed it; the service is in `docker-compose.yml` under the `supabase`
    // profile so the measurement is reproducible.
    //
    // Probe: `BCN-007-SUPABASE-STORAGE-OUTPUT.txt`, 14 checks, 0 failures.
    'files.upload': degraded(
      'Supabase keeps files in a Storage bucket, so the Upload File node needs a Bucket and a Path. There is no default bucket, and a bucket name that does not exist fails with a message that does not say so.',
      'BCN-007 live: POST /storage/v1/object/{bucket}/{path} answers 200 with {Key, Id} — and NOTHING ELSE. No url, no size, no content type; those exist only on a second call to POST /object/list/{bucket}, so an upload reports them absent rather than making a round trip to dress the answer up'
    ),
    'files.sign': supported(
      'BCN-007 live: POST /storage/v1/object/sign/{bucket}/{path} with {expiresIn} answers 200 and the link EXPIRES — verified by waiting it out, after which it answers 400 InvalidJWT "jwt expired". ⚠️ The signedURL it returns is RELATIVE (/object/sign/…), so it resolves against the app\'s own origin and 404s there unless the adapter puts the origin and the /storage/v1 mount back'
    ),
    'files.delete': degraded(
      'Deleting a file that is not there is an error on Supabase rather than a no-op, so a Delete File node that runs twice reports a failure the second time.',
      'BCN-007 live: DELETE /storage/v1/object/{bucket}/{path} answers 200 {"message":"Successfully deleted"} and the public URL then 400s. A path that never existed answers 400 with statusCode 404 "Object not found" — NOT idempotent, unlike nodegx-backend, which answers 200 for an unknown name by design'
    ),
    'files.private': supported(
      'BCN-007 live: a bucket created public:false serves 400 on /object/public/{bucket}/{path} while an identical public:true bucket serves 200 with the bytes. Privacy is the bucket\'s, not the file\'s, and row-level security applies on top — an upload with the anon key was refused with "new row violates row-level security policy"'
    ),
    'files.progress': degraded(
      "Upload progress isn't reported by Supabase — the file still uploads, the bar just won't move.",
      'The Storage endpoint is consumed over fetch, which has no upload-progress event.'
    ),

    // ⚠️ **The four auth cells nothing has ever verified, and which no adapter serves.**
    // Two separate facts, and both point the same way:
    //
    // 1. **GoTrue is not in the rig.** Like Realtime below, Supabase Auth is a separate
    //    service; the rig's "Supabase" is one Postgres and one PostgREST container, and
    //    BCN-006 measured every `/auth/v1/*` route as a plain 404 from PostgREST. So the
    //    endpoints named here are read from documentation, not asked of a server.
    // 2. **`RestAuthAdapter` does not implement Supabase.** BCN-006 shipped Directus and
    //    PocketBase and gated Supabase deliberately, on the argument that writing an auth
    //    flow from documentation is how a user gets locked out of their own app.
    //
    // They were `supported`, which claimed a capability the product does not have — flagged
    // by BCN-006 itself rather than left. `conditional` is the correct state and it is the
    // safe one: the editor treats it as unavailable until a probe says otherwise, so an
    // unverified cell cannot promise anything. **Do not promote these to `supported`
    // without both a real GoTrue to probe and an adapter that speaks to it.**
    'auth.password': conditional(
      'Signing in with an email and password needs Supabase Auth, and NodeGX does not support it on this backend yet.',
      { method: 'GET', path: '/auth/v1/settings', expect: 'a settings document rather than a 404' },
      'DOCUMENTED, NOT PROBED — BCN-006 confirmed only that no GoTrue exists in this rig to probe (every /auth/v1/* is a 404 from PostgREST), and RestAuthAdapter implements Directus and PocketBase only.'
    ),
    'auth.signUp': conditional(
      'Creating accounts needs Supabase Auth, and NodeGX does not support it on this backend yet.',
      { method: 'GET', path: '/auth/v1/settings', expect: 'a settings document rather than a 404' },
      'DOCUMENTED, NOT PROBED — same as auth.password. POST /auth/v1/signup is read from documentation.'
    ),
    'auth.signUpProperties': degraded(
      'Supabase keeps the login and the profile separately, so signing up takes two steps. If the second one fails the account still exists, without the profile details.',
      'auth.users is not writable from the client; profile rows live in a public table. DOCUMENTED, NOT PROBED — and moot while auth.signUp is conditional.'
    ),
    'auth.emailVerify': conditional(
      'Confirming an email address needs Supabase Auth, and NodeGX does not support it on this backend yet.',
      { method: 'GET', path: '/auth/v1/settings', expect: 'a settings document rather than a 404' },
      'DOCUMENTED, NOT PROBED. Email confirmation being on by default for new projects is a fact about Supabase, not about whether we can reach it.'
    ),
    'auth.passwordReset': conditional(
      'Resetting a password needs Supabase Auth, and NodeGX does not support it on this backend yet.',
      { method: 'GET', path: '/auth/v1/settings', expect: 'a settings document rather than a 404' },
      'DOCUMENTED, NOT PROBED — POST /auth/v1/recover is read from documentation.'
    ),
    'auth.oauth': conditional(
      'Signing in with a provider needs Supabase Auth, and NodeGX does not support it on this backend yet.',
      { method: 'GET', path: '/auth/v1/settings', expect: 'an external section listing enabled providers' },
      'DOCUMENTED, NOT PROBED — same as auth.password. Which providers a project has enabled is per-project configuration, but that is moot while nothing here can reach GoTrue at all.'
    ),

    // ⚠️ **This was `supported`, and it was the last Supabase auth cell still
    // claiming a capability the product does not have.** BCN-006 corrected its
    // five neighbours and flagged that it had not touched the descriptors; this
    // one survived the sweep because its evidence string reads like a fact about
    // Supabase — and it is one. `POST /auth/v1/otp` really is a first-class
    // Supabase flow. The cell is not about Supabase, though: it is about whether
    // **NodeGX** can drive it, and `RestAuthAdapter` refuses every Supabase auth
    // call with `SUPABASE_AUTH_UNSUPPORTED` before a request is issued.
    //
    // So a builder on Supabase saw `Request Magic Link` offered as fully
    // supported, wired it up, and got a refusal at runtime — the precise failure
    // this phase's central promise exists to prevent, in the one family where the
    // spec names it: *"`Request Magic Link` on a Directus project is a disabled
    // node with a reason, not a node that emits nothing."*
    //
    // `conditional` rather than `unsupported` for the same reason as its five
    // neighbours: the editor treats it as unavailable until a probe says
    // otherwise, and the day a GoTrue is stood up and measured this is the cell
    // that gets promoted rather than rewritten.
    'auth.magicLink': conditional(
      'Sending a magic-link sign-in needs Supabase Auth, and NodeGX does not support it on this backend yet.',
      { method: 'GET', path: '/auth/v1/settings', expect: 'a settings document rather than a 404' },
      'DOCUMENTED, NOT PROBED — POST /auth/v1/otp is read from documentation. Magic links being first-class in Supabase is a fact about Supabase, not about whether we can reach them: every /auth/v1/* answers 404 in this rig and RestAuthAdapter issues no Supabase request at all.'
    ),

    // ⚠️ **The one realtime cell nothing has ever verified.** BCN-008 tried and
    // could not: the rig's "Supabase" is one Postgres and one PostgREST
    // container, and Supabase Realtime is a separate Elixir service that is not
    // in docker-compose.yml at all. The probe established the absence rather
    // than inventing a result — /realtime/v1/api/tenants/realtime/health is a
    // plain 404 from PostgREST, ws://…/realtime/v1/websocket errors in 5ms, and
    // ports 4000 and 54321 are silent.
    //
    // It stays `conditional` because that is what the product documentation
    // describes and `conditional` is already the safe state — the editor treats
    // it as unavailable until a probe says otherwise, so an unverified cell
    // cannot promise anything. It must NOT be promoted to `supported` by anyone
    // who has not run a real Supabase stack.
    //
    // ⚠️ **BCN-008 proper did not change this, and the reason is worth stating.** The
    // transports shipped for the other four backends; **none was written for Supabase**,
    // because writing a Phoenix-channel decoder from documentation is the exact habit this
    // phase exists to end. So at runtime `realtimeSupportFor('supabase')` answers
    // `unsupported`, while this cell says `conditional` — a disagreement that is deliberate
    // and recorded rather than papered over. They are answers to different questions
    // ("could a Supabase project have realtime?" vs "can NodeGX speak to it?"), and BCN-010
    // is where one of them has to give. Until then the reason below says the true thing.
    'realtime.subscribe': conditional(
      'NodeGX cannot subscribe to Supabase Realtime yet — it speaks Phoenix channels and no transport has been ' +
        'written for it (BCN-008). Turning Realtime on in your Supabase dashboard will not make this work.',
      { method: 'GET', path: '/realtime/v1/api/tenants/realtime/health', expect: 'a healthy response, plus the table being in the supabase_realtime publication' },
      'Realtime is per-table opt-in via the publication, not a project-wide switch. DOCUMENTED, NOT PROBED — BCN-008 confirmed only that no Realtime service exists in this rig to probe. The delete payload in particular (postgres_changes sends old_record with the primary key alone unless the table is REPLICA IDENTITY FULL) is unmeasured, and that is exactly the field RUN-003 got wrong on Directus by reading rather than asking.'
    )
  }),

  filters: filterTable(supported('native PostgREST operator'), {
    // PostgREST covers the comparison and set operators natively, and its
    // like/ilike cover the string family. The gaps are the interesting rows.

    matchesRegex: supported('PostgREST match/imatch operators'),

    isEmpty: unsupported(
      "Supabase can't tell an empty value from a missing one from here. Use \"is not set\" instead, or compare the field to an empty string.",
      'No _empty equivalent; is.null answers presence only.'
    ),
    isNotEmpty: unsupported(
      "Supabase can't tell an empty value from a missing one from here. Use \"is set\" instead.",
      'No _nempty equivalent.'
    ),

    relatedTo: unsupported(
      'Filtering by "records related to this one" is not available on Supabase yet.',
      'BCN-005.'
    ),

    textSearch: conditional(
      'Full-text search needs a text-search index on the table in your Supabase database.',
      { method: 'GET', path: '/{collection}?{field}=fts.test', expect: '200 rather than a missing-index error' },
      'PostgREST fts/plfts/phfts operators.'
    ),

    // ⚠️ These three were `conditional` on a `/rpc/postgis_version` probe.
    // BCN-003 corrected them, and the correction is an instance of this
    // package's own rule #1 — *probe the exact thing*. Whether PostGIS is
    // installed is a real question with a real answer, but it is **not the
    // question**: PostgREST's filter grammar has no distance or containment
    // operator either way, so a distance query has to be a database function
    // reached through `/rpc`. The old probe would have reported `supported` on
    // an instance where the filter still could not be written.
    nearSphere: unsupported(
      "Location filters aren't available on Supabase from here. Even with PostGIS installed, a distance search has to be written as a database function.",
      'PostgREST exposes no geo operator in its filter grammar; PostGIS reaches the query only through /rpc. BCN-003.'
    ),
    withinBox: unsupported(
      "Location filters aren't available on Supabase from here. Compare latitude and longitude as numbers instead.",
      'PostgREST exposes no geo operator in its filter grammar. BCN-003.'
    ),
    withinPolygon: unsupported(
      "Location filters aren't available on Supabase from here. Even with PostGIS installed, a polygon search has to be written as a database function.",
      'PostgREST exposes no geo operator in its filter grammar. BCN-003.'
    )
  })
};
