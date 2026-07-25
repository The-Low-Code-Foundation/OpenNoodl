# Backend E2E first-contact harness (RUN-003)

A containerised Directus plus drivers that point the **real** editor/runtime
sources at it, recording empirically what happens on first contact with a real
backend. Two drivers, matching the assessment's two stages:

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
