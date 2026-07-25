# UBA E2E first-contact harness (RUN-003)

A containerised Directus plus a driver that points the **real** `UBAClient` and
`SchemaParser` at it, to record empirically what happens on first contact with a
real backend. This is the harness the spec's step 1–2 ("stand up a containerised
Directus and drive the existing UBAClient against it") calls for.

The recorded finding is in [`../RUN-003-ASSESSMENT.md`](../RUN-003-ASSESSMENT.md).
The canonical run output is [`FIRST-CONTACT-OUTPUT.txt`](./FIRST-CONTACT-OUTPUT.txt).

## Files

| File | What it is |
|---|---|
| `docker-compose.yml` | Directus 11 on SQLite, bootstrapped admin, port 8055 |
| `seed.mjs` | Seeds a rich schema: `authors` + `articles` with a M2O relation, a file relation, an enum (dropdown), a timestamp, an integer, a boolean |
| `driver.ts` | Drives the real `UBAClient`/`SchemaParser` against Directus (4 probes) |
| `FIRST-CONTACT-OUTPUT.txt` | The recorded output of a full run |

## Run it

```bash
cd dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e
docker compose up -d
# wait until http://localhost:8055/server/health returns 200 (~30–60s on first boot)
node seed.mjs
../../../../node_modules/.bin/esbuild driver.ts \
  --bundle --platform=node --format=cjs --target=node22 --outfile=driver.cjs
node driver.cjs
docker compose down            # add -v to also drop the volume
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
