# Backend E2E harness

Containerised backends plus drivers that record empirically what happens
against a real one, rather than what the docs claim. The name is RUN-003's and
is kept deliberately; the rig is shared.

| Profile | Added by | What it answers |
|---|---|---|
| *(default)* + `supabase` | RUN-003 | first contact: does UBA/BYOB work against a live backend at all |
| `aggregate` | BCN-001 (phase 34) | which backends can aggregate — see [below](#the-aggregate-capability-probe-bcn-001) |

## RUN-003 — first contact

Two drivers, matching the assessment's two stages:

1. `driver.ts` — the **UBA** first contact (proved UBA is a config-form
   renderer that no real BaaS can speak to).
2. `byob-driver.ts` — the **BYOB** reality check (proved the BYOB adapter's
   introspection, runtime CRUD path, and field→port mapping all work against
   live Directus — and that relations are dropped).

The recorded findings are in [`../RUN-003-ASSESSMENT.md`](../RUN-003-ASSESSMENT.md)
(read the correction box). Canonical run outputs:
[`FIRST-CONTACT-OUTPUT.txt`](./FIRST-CONTACT-OUTPUT.txt) (UBA) and
[`BYOB-CONTACT-OUTPUT.txt`](./BYOB-CONTACT-OUTPUT.txt) (BYOB).

## Files

| File | What it is |
|---|---|
| `docker-compose.yml` | Directus 11 on SQLite, bootstrapped admin, port 8055 |
| `seed.mjs` | Seeds a rich schema: `authors` + `articles` with a M2O relation, a file relation, an enum (dropdown), a timestamp, an integer, a boolean |
| `driver.ts` | Drives the real `UBAClient`/`SchemaParser` against Directus (4 probes) |
| `byob-driver.ts` + `build-byob.mjs` | Drives the real `BackendServices` parsers + `byob-utils` against Directus (3 probes) |
| `supabase-driver.ts` + `supabase-seed.sql` | Drives the real `parseSupabaseSchema` against a live PostgREST OpenAPI spec (Supabase's REST layer *is* PostgREST) — enums, `<pk/>`, `<fk/>`, required[]; plus the preset's filter syntax live |
| `stub-*.js` | Three tiny stubs that let the editor/runtime sources bundle standalone (see byob-driver header) |
| `FIRST-CONTACT-OUTPUT.txt` / `BYOB-CONTACT-OUTPUT.txt` / `SUPABASE-CONTACT-OUTPUT.txt` | Recorded outputs of full runs |

## Run it

```bash
cd dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e
docker compose up -d
# wait until http://localhost:8055/server/health returns 200 (~30–60s on first boot)
node seed.mjs

# UBA first-contact probes
../../../../node_modules/.bin/esbuild driver.ts \
  --bundle --platform=node --format=cjs --target=node22 --outfile=driver.cjs
node driver.cjs

# BYOB reality-check probes
node build-byob.mjs && node byob-driver.cjs

# Supabase-parser verification (PostgREST stack, port 8056)
docker compose --profile supabase up -d
node build-byob.mjs supabase && node supabase-driver.cjs

docker compose --profile supabase down   # add -v to also drop the volumes
```

`driver.ts` imports the two UBA source files by relative path. Both use only
`import type`, so esbuild erases the type imports and bundles them standalone —
no Electron/editor runtime required. This is the same "the source is pure enough
to run headless" trick RUN-002's SSR smoke harness used.

## Credentials (throwaway)

`admin@example.com` / `directus-admin-pw`. Do not reuse anywhere real.

## The four probes

1. **`UBAClient.health()`** against `/server/health` → **works** (200, healthy).
2. **`UBAClient.configure()`** → **404**: Directus has no config-ingest endpoint.
3. **`SchemaParser.parse()`** on `/collections` and `/fields` → **fails**: Directus
   serves no `UBASchema` (a config-form description), and nothing translates its
   native metadata into one.
4. **Directus introspection** (`/collections`, `/fields`) → prints the rich
   per-field metadata (type, interface, FK relations, enum choices) a real
   adapter would consume — the surface UBA currently has no code to read.

## The aggregate-capability probe (BCN-001)

[BCN-001 §5.3](../../phase-34-one-backend-contract/BCN-001-CONTRACT.md) left two
capability-descriptor cells unresolved because they are facts about other
people's products, not about this repo: **can PocketBase aggregate, and can
Supabase?** Docs were not enough — PostgREST's `db-aggregates-enabled` default
has moved, and Supabase's hosted platform sets it independently.

```bash
docker compose --profile aggregate up -d      # ~15s after the images are pulled
node bcn-001-aggregate-probe.mjs
docker compose --profile aggregate down -v
```

| File | What it is |
|---|---|
| `bcn-001-agg-seed.sql` | 7 articles across 3 statuses and 2 authors — enough that an aggregate result is distinguishable from a row count |
| `agg-rest-default` (8057) / `agg-rest-enabled` (8058) | **The same PostgREST 12.2.3 against the same rows, differing in exactly one setting.** The delta between them is the whole finding |
| `pocketbase` (8091) | PocketBase 0.30.0. Seeds itself over the API — the image has no seed hook. 8091, not 8090, so it stays out of a local instance's way |
| `BCN-001-AGGREGATE-PROBE-OUTPUT.txt` | Recorded run, with the verdicts appended |

Headline results, in case the file is not to hand:

- **Supabase aggregate is `conditional`, and now provably so.** Stock PostgREST
  refuses with `PGRST123`; the same binary with `db-aggregates-enabled=true`
  answers every aggregate including GROUP BY. Connect-time probe:
  `GET /<table>?select=count()`.
- **PocketBase aggregate is `unsupported` — and it fails silently.** Every
  spelling returns HTTP 200 with ordinary un-aggregated rows; an invented
  parameter behaves identically. `?fields=rating:sum` returns 200 with
  `Content-Type: application/json` and `Content-Length: 0`. An aggregate node
  pointed at PocketBase would not error, it would return wrong numbers — which
  is why the descriptor gate is the only thing that can stop it.
- **Two traps recorded in the output**: PostgREST's embedded-relation count
  (`?select=name,articles(count)`) works *even with aggregates disabled*, so
  probing with it reports `supported` on an instance that cannot sum anything;
  and PocketBase *can* aggregate through a hand-authored `view` collection,
  which is schema authoring, not something an adapter can express at runtime.

Credentials are throwaway: PocketBase `admin@example.com` /
`pocketbase-admin-pw`.
