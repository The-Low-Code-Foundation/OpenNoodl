# `@noodl/backend-contract`

The backend-neutral data, auth and filter contracts, and the capability
descriptor that says what each backend can actually do.

**Types and frozen data. No I/O, no adapter implementations, no node code.**
Adapters arrive in BCN-002 onwards; this package is what they register against
and what the editor gates ports on. Built for
[phase 34 / BCN-001](../../dev-docs/tasks/phase-34-one-backend-contract/).

## Why it is a package and not a folder

Both the runtime (the data nodes) and the editor (Data Browser, schema sync,
filter builders) consume adapters. A home inside either tree forces the other to
import across it, which is the shape that produces the next god-file. The
nx/lerna graph is what actually enforces the boundary; a shared folder with no
graph edge gets violated in a fortnight.

The cost of a new package turned out to be **smaller than BCN-001 estimated**.
The contract doc warned of a PLAT-004 TSFixme re-baseline and a per-package hex
ratchet entry; neither was needed. The TSFixme ratchet already targets
`packages` wholesale, so this package is scanned automatically and contributes
zero escape hatches (`strict: true`, no `any`, no `TSFixme`). The hex ratchet
only targets `noodl-editor/src` and `noodl-core-ui/src`. The only real cost was
one `--scope` entry in the root `test:packages` script.

## What is in here

| Module | What it holds |
|---|---|
| `backends.ts` | The six backend types, their user-facing names, and `BackendHandle` — the resolved backend every contract method takes as its first argument |
| `data.ts` | `IDataAdapter` — **fourteen** methods, extracted from `cloudstore.js`, not designed |
| `auth.ts` | `IAuthAdapter` — ten methods, plus `TokenLifecycle`, the eleventh member that is not a method |
| `events.ts` | `IAdapterEvents` — the local write events, which are **not** backend realtime |
| `filter.ts` | The neutral filter model, its 31 operators, the operators that must be lowered rather than gated, and the 24-operator Directus migration map |
| `capabilities.ts` | The four states, the 27 capability keys, and `BackendDescriptor` |
| `descriptors/` | One descriptor per backend type. **This is the checklist for the rest of phase 34** |

## Three things worth knowing before changing anything here

**Fourteen data methods, not eighteen.** `CloudStore` has eighteen methods but
four are not contract material: `_initCloudServices` (construction),
`_makeRequest` (**the Parse seam each adapter replaces**), and `on`/`off`
(events). BCN-001's success criterion was amended accordingly — as written it
could not be met.

**The neutral filter vocabulary is the Parse-side one, and BYOB's saved model
has to move to it.** The phase spec believed the two filter models had
converged. They had not: BYOB stores Directus's operator names (`_eq`, `_gt`)
verbatim in project data. `DIRECTUS_OPERATOR_MIGRATION` is BCN-003's map, and
its two interesting rows are `_null`/`_nnull`, which are nullary where the
neutral `exists` is boolean-valued.

**A cell is only `supported` if something proved it.** Every non-obvious cell
carries an `evidence` string naming the file and line, the probe output, or the
fact that it is documented and *not* probed. Later tasks flip cells on as they
land; a cell flipped without evidence is the failure mode the table exists to
prevent.

## The four states

| Value | Editor behaviour |
|---|---|
| `supported` | normal |
| `unsupported` | port disabled, reason shown |
| `conditional` | probed at connect; **treated as `unsupported` until proven** |
| `degraded` | normal, caveat surfaced in the property editor |

`conditional` earns its keep on the cells where the answer genuinely depends on
the instance: Parse LiveQuery is a separate server most deployments do not run,
PostgREST aggregates are off unless someone turned them on, Directus WebSockets
default to off. Every one of those is a silent runtime failure today.

Two rules for writing a probe, both learned from BCN-001's live run:

1. **Probe the exact thing.** PostgREST answers embedded-relation counts
   (`?select=name,articles(count)`) with aggregates *disabled*, so probing with
   that reports `supported` on an instance that cannot sum anything.
2. **A 200 is not a yes.** PocketBase returns 200 and ordinary un-aggregated
   rows for every aggregate spelling there is.

## The evidence

Live probes are in
[`uba-e2e/`](../../dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e/) —
`docker compose --profile aggregate up -d && node bcn-001-aggregate-probe.mjs`,
with the recorded run in `BCN-001-AGGREGATE-PROBE-OUTPUT.txt`.

Two findings there are worth repeating because they are about *our own*
backend, not someone else's:

- The built-in backend **drops geo filters on the floor** — `$nearSphere`,
  `$within` and `$geoWithin` warn to the console and return `null` from the SQL
  translator, so the condition never reaches the WHERE clause and a "within 5km"
  query returns every record.
- The built-in backend's `matchesRegex` is **`LIKE '%value%'`**, not a regex.
  `^Ada$` searches for that literal text.

Both are recorded as `unsupported`/`degraded` rather than fixed here — fixing
SQLite geo is out of scope for phase 34; telling the truth about it is not.

## Tests

```bash
npx lerna run test --scope @noodl/backend-contract
```

There is no behaviour in this package, so the tests assert the invariants a
table of claims needs in order to be worth having: every descriptor declares
every key, every cell that takes something away carries a reason, every
`conditional` cell carries a probe that could settle it, and no reason string
reads like an error message or describes someone else's product limitation as
our backlog.
