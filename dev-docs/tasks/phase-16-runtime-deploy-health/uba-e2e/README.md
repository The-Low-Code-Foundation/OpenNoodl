# Backend E2E harness

Containerised backends plus drivers that record empirically what happens
against a real one, rather than what the docs claim. The name is RUN-003's and
is kept deliberately; the rig is shared.

| Profile | Added by | What it answers |
|---|---|---|
| *(default)* + `supabase` | RUN-003 | first contact: does UBA/BYOB work against a live backend at all |
| `aggregate` | BCN-001 (phase 34) | which backends can aggregate — see [below](#the-aggregate-capability-probe-bcn-001) |
| `parse` | BCN-002 (phase 34) | what an **upstream Parse Server** does that ours does not — see [below](#the-parse-wire-live-pass-bcn-002) |
| `aggregate` + `parse` together | BCN-003 (phase 34) | does the same filter return the same rows from all five backends — see [below](#the-filter-equivalence-pass-bcn-003) |

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

## The Parse-wire live pass (BCN-002)

BCN-002 moved the Parse client behind `IDataAdapter` as `ParseWireAdapter`, and
its success criterion asked for a live pass against **an external Parse server**.
There was none — not in this repo, not in this rig — which is also why BCN-001
shipped every `parse` descriptor cell reading *"documented, not probed"*.
Decision 2026-07-31: stand one up.

```bash
docker compose --profile parse up -d          # parse-server 7.3.0 + mongo 7, ~20s
# and our own backend, for the other direction:
(cd ../../../../packages/nodegx-backend && node bin/nodegx-backend.js serve \
   --data-dir /tmp/bcn002-backend --port 8093 &)

node build-bcn-002.mjs && node bcn-002-parse-driver.cjs

docker compose --profile parse down -v
```

| File | What it is |
|---|---|
| `parse` (8092) + `parse-db` | `parseplatform/parse-server:7.3.0` on Mongo 7. 8092, not Parse's own 1337, so it stays out of a local instance's way |
| `bcn-002-parse-driver.ts` + `build-bcn-002.mjs` | Drives the **real `ParseWireAdapter`**, bundled from `noodl-runtime` sources — 40 checks against both servers, plus the real `records.js` |
| `stub-noodl-runtime-cloudstore.js` | The runtime singleton `cloudstore.js` reads project metadata from. Separate from `stub-noodl-runtime.js`, which serves `byob-utils`' `backendServices` |
| `BCN-002-PARSE-WIRE-OUTPUT.txt` | Recorded run |

**Why both servers.** `nodegx-backend` answers the same Parse routes on the same
headers, so a green pass against it proves the adapter's shape and nothing about
upstream Parse. The safety net and the trap are the same object. Every row where
the two columns differ is a descriptor cell that used to be a reading of the
Parse docs.

What the run found:

- **BCN-001 §0.2's separate-columns argument, measured.** Upstream Parse answers
  `/aggregate` and `/aggregate?distinct=` with
  `unauthorized: master key is required`, and answers both with 200 when given
  the master key. Ours serves both under ordinary ACLs. Same wire, different
  capabilities — in Parse's own words rather than its documentation's.
- **Three `parse` file cells were wrong**, all read carefully from the docs, all
  wrong in the direction that only shows up in a user's app: a stock Parse Server
  **refuses uploads outright** (`code 130, File upload by public is disabled`),
  **deleting a file needs the master key** (the cell said it did not), and
  **`GET /files/:name/sign` does not exist on Parse at all** — it is BAK-006's,
  ours, and Parse answers 403 code 119 with the master key as readily as without.
- **`records.js` works through the shim**, in the cloud-runtime branch, with a
  filter written in the neutral vocabulary. That is the one check here that
  exercises `CloudStore` rather than the adapter, so it is the only one that
  would catch the shim binding the wrong handle — and the only coverage the
  four server-side `convertFilterOp` call sites have outside a cloud function.
- **A defect in our own client**, found on the first run and reachable by nothing
  else in the repo. With no baked `_noodl_cloudservices`, the cloud-runtime
  branch sent `X-Parse-Master-Key: undefined` — `JSON.stringify` drops an
  undefined property but `new Headers()` keeps it as the four-letter string.
  `nodegx-backend` counts each as a failed credential attempt and **locks the
  caller out for 300 seconds**. Upstream Parse ignores a master key it does not
  recognise, so ours is the only server that fails loudly. Fixed in `203469c7`.

**One trap worth carrying forward.** Parse Server restricts master-key use to
loopback by default, and a request published through Docker arrives from the
bridge gateway — so every master-key probe 403s for a reason that has nothing to
do with the route being probed. The compose file opens `PARSE_SERVER_MASTER_KEY_IPS`
so a refusal is evidence about the route. The default is itself a finding: it is a
second reason a browser can never reach a master-key-only route.

Credentials are throwaway: app id `uba-e2e-app`, master key `uba-e2e-master-key`.


## The filter equivalence pass (BCN-003)

**The deliverable of BCN-003, not its scaffolding.** One logical corpus in five
backends, one set of neutral filters, and an assertion about what comes back.

```bash
# ⚠️ the SQL seed only runs on a FRESH volume
docker compose --profile aggregate --profile parse down -v
docker compose --profile aggregate --profile parse up -d
(cd ../../../../packages/nodegx-backend && node bin/nodegx-backend.js serve --data-dir /tmp/bcn003-backend --port 8093 &)
node build-bcn-003.mjs && node bcn-003-equivalence-driver.cjs
```

| File | What it is |
|---|---|
| `bcn-003-equivalence-driver.ts` | Drives the **real translators** from `@noodl/backend-contract` against all five backends |
| `bcn-003-people-seed.sql` | The corpus, for the PostgREST half — the only backend that cannot create its own table |
| `BCN-003-EQUIVALENCE-OUTPUT.txt` | Recorded run: 106 checks, 0 failures, 8 declared divergences |

### What it asserts, which is not "they all agree"

They do not all agree, and a run demanding that would be measuring the world
rather than our claims about it. What is asserted:

> **A backend whose capability cell says `supported` returns exactly the
> expected rows. A backend that returns anything else has a cell that already
> said so.**

A `degraded` cell buys a divergence; nothing else does. All eight divergences
in the recorded run were `supported` cells *before* the run — the pass is what
turned them into `degraded` ones with a sentence attached.

### The seven people, and why each is there

`Ada` / `Adam` / `adaline` separate case-sensitive from case-insensitive
matching. Adam's empty bio and Grace's NULL one separate `isEmpty` from
`exists`. `Q"uote && Co` is the injection case — a value carrying a quote, an
ampersand pair and a space must come back as one row rather than as a rewritten
query. `100% sure` beside `1000 words` is the LIKE-wildcard case: searching for
`100%` must not match the second.

### What it found

Four defects in translators that every unit test passed, and four wrong
descriptor cells:

- **PostgREST 12.2 does not strip quotes at the top level.** `?city=eq."London"`
  matches nothing. Quoting is honoured *inside* `or=(…)`, where a bare comma is
  a parse error — so the two positions need opposite encodings.
- **Parse `$exists` tests key presence, not null-ness.** A record whose field
  was explicitly set to null satisfies `$exists: true`, so "is set" returned it
  and "is not set" returned nothing. `$ne: null` / `$eq: null` is the question
  the user is actually asking, and compiles to the same SQL on our own backend.
- **Directus 11 refuses `_regex` on a string field** — `400`, in its own words.
  The cell said `supported`, written from the documentation.
- **Directus and PocketBase honour no `LIKE` escape.** A `%` or `_` in the
  user's text is a wildcard and a backslash is matched literally. Postgres does
  honour it, so PostgREST escapes and the other two declare `degraded`.

## The relation live pass (BCN-005)

[BCN-005](../../phase-34-one-backend-contract/BCN-005-RELATIONS.md) closed the hole
[BCN-004's notes](../../phase-34-one-backend-contract/BCN-004-NOTES-TRANSPORT.md) named in
§3.4: *"no live check reads a related record back on any backend."*

```bash
docker compose --profile supabase --profile aggregate --profile parse up -d

# the wire, measured BEFORE any adapter code
node bcn-005-relation-probe.mjs  > /tmp/p1.txt     # ⚠️ never pipe into `head`
node bcn-005-relation-probe2.mjs > /tmp/p2.txt

# the adapters, driven
node bcn-005-relation-driver.build.mjs && node bcn-005-relation-driver.cjs
```

| File | What it is |
|---|---|
| `bcn-005-relation-probe.mjs` | Round one: what each backend says about its own relations, and what a read/add/remove actually does |
| `bcn-005-relation-probe2.mjs` | Round two — the questions round one could not answer because it wrote before it read |
| `bcn-005-relation-driver.ts` | **55 checks** through the shipped `RestDataAdapter`, `ParseWireAdapter` and relation parsers |
| `BCN-005-RELATION-PROBE-OUTPUT.txt` / `BCN-005-RELATION-DRIVER-OUTPUT.txt` | Recorded runs |

It owns the `bcn005_*` collections and tables and rebuilds them on every run. It touches
nothing else — in particular not `articles`, `authors`, `bcn004a` or `bcn004n`.

Three findings worth knowing before touching this area again, all in
[BCN-005-NOTES.md](../../phase-34-one-backend-contract/BCN-005-NOTES.md):

- **Directus's many-to-many include is two hops.** `fields=*,tags.*` answers 200 with the
  *junction rows*; only `fields=*,tags.tag_id.*` gives the tags.
- **PostgREST cannot see a junction whose primary key is a surrogate `id`** — the same two
  tables answer `PGRST200 … no matches were found`.
- **PocketBase needs `?=` to filter across a to-many relation.** `=` means *every* related
  record matches and returns an empty result set, with a 200.

⚠️ And the methodological one: **two of the driver's checks passed 50/50 under a broken
implementation** and were only caught by mutation-testing it. A corpus small enough to be
convenient is often small enough that two different implementations agree on it.
