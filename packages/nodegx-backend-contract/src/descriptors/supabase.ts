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

    'relations.pointerRead': supported('PostgREST resolves foreign keys via embedded selects: ?select=*,author(*)'),
    'relations.relatedTo': unsupported(
      'Filtering by "records related to this one" is not available on Supabase yet.',
      'Junction-table embedding exists but is not wired. BCN-005 owns this.'
    ),
    'relations.addRemove': unsupported(
      'Adding and removing related records is not available on Supabase yet.',
      'Would mean writing junction rows directly. BCN-005 owns this.'
    ),

    'files.upload': supported('Supabase Storage: POST /storage/v1/object/{bucket}/{path}'),
    'files.sign': supported('POST /storage/v1/object/sign/{bucket}/{path}'),
    'files.delete': supported('DELETE /storage/v1/object/{bucket}/{path}'),
    'files.private': supported('private buckets are the Supabase Storage default'),

    'files.progress': degraded(
      "Upload progress isn't reported by Supabase — the file still uploads, the bar just won't move.",
      'The Storage endpoint is consumed over fetch, which has no upload-progress event.'
    ),

    'auth.password': supported('POST /auth/v1/token?grant_type=password'),
    'auth.signUp': supported('POST /auth/v1/signup'),
    'auth.signUpProperties': degraded(
      'Supabase keeps the login and the profile separately, so signing up takes two steps. If the second one fails the account still exists, without the profile details.',
      'auth.users is not writable from the client; profile rows live in a public table.'
    ),
    'auth.emailVerify': supported('email confirmation is on by default for new Supabase projects'),
    'auth.passwordReset': supported('POST /auth/v1/recover'),
    'auth.oauth': conditional(
      'Signing in with Google, GitHub and the rest depends on which providers you have enabled in your Supabase dashboard.',
      { method: 'GET', path: '/auth/v1/settings', expect: 'an external section listing enabled providers' },
      'Providers are per-project configuration; the settings endpoint enumerates them.'
    ),

    // The one place Supabase does something the built-in backend cannot.
    'auth.magicLink': supported('POST /auth/v1/otp — magic links are a first-class Supabase flow'),

    'realtime.subscribe': conditional(
      'Live updates need Realtime turned on for this table in your Supabase dashboard.',
      { method: 'GET', path: '/realtime/v1/api/tenants/realtime/health', expect: 'a healthy response, plus the table being in the supabase_realtime publication' },
      'Realtime is per-table opt-in via the publication, not a project-wide switch.'
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
