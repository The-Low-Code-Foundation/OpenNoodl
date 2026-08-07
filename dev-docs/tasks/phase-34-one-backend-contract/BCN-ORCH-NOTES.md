# Orchestrator pass — the two checks only the primary checkout could run

**2026-08-01.** Run in the primary while workers A/B/C/D ran BCN-007, BCN-010, BCN-006's
remainder and the editor schema sync in worktrees.

Two carried-forward items were owed and neither could be closed in-process:

- **"The repeater binding with a numeric `objectId`"** — the one third of the `objectId` risk
  a headless driver cannot reach. It needs a rendered React tree.
- **"Still owed: an actual export/deploy."** BCN-009's criterion is *"a **deployed** app
  resolves its backend from the unified metadata"*, and every check so far was in-process.

**Both are now closed, in a real deploy bundle in a real browser.** Getting there found one
security defect, one process defect, and two of my own instrument defects.

Driver, proxy and browser harness are preserved beside the other phase drivers:
[`uba-e2e/bcn-orch-export-driver.ts`](../phase-16-runtime-deploy-health/uba-e2e/bcn-orch-export-driver.ts),
`bcn-orch-cors-proxy.mjs`, `bcn-orch-browse.mjs`, output in `BCN-ORCH-EXPORT-OUTPUT.txt`.

---

## 1. What the rig is, and why it is not `noodl-preview`

The harness runs the editor's **real** export pipeline headlessly — `ProjectModel`,
`NodeLibrary`, `utils/exporter`, the deploy `HtmlProcessor` and the deploy `index.html` —
using noodl-preview's `headless.ts` bootstrap. What it deliberately does **not** reuse is
`loadPreview`, because that passes `environment: null` to blank the cloud-services metadata:

```ts
// `environment: null` blanks the cloud-services metadata: a local preview
// must never inherit a deployed backend by accident.
```

That is the correct behaviour for a preview and the exact opposite of what a deploy check
needs, so `Exporter.exportToJSON(project, { environment })` is called directly — the same
call `deployToFolder` makes.

The project is a converged one: `backendServices.version = 2`, `activeBackendId` naming a
Directus backend, a `Query Records` node feeding a `Repeater` whose template renders the
record's `Id` and `title`.

---

## 2. ⚠️ The security defect: `adminToken` was published to every deployed app

`BackendServices/types.ts` says, of the field it declares:

> Admin token for schema introspection (editor-only).
> **This token is NOT published to the deployed app.**
> Should have permissions to read schema/fields.

**Nothing kept that promise.** `exportToJSON` builds `json.metadata` as
`JSON.parse(JSON.stringify(project.metadata))` — a deep copy of the *whole* metadata block —
and then overrides exactly one key, `cloudservices`. `backendServices` rode along verbatim,
and `serializeBackend` is `{...backend}`, so every configured backend's `auth.adminToken`
reached the export.

The export JSON becomes `window.projectData` in the deployed app. **Measured in a real
browser against a real deploy bundle**, before the fix:

```
window.projectData.metadata.backendServices.backends[0].auth
  → { method: "bearer",
      adminToken: "ADMIN-TOKEN-MUST-NOT-SHIP-c0ffee",
      publicToken: "…" }
```

An admin token on Directus/PocketBase reads and writes **every collection, including the
user table**, and it was readable from the browser console of the shipped site by anyone.

### The fix, and what is deliberately *not* stripped

One sanitiser, `exportMetadata`, now feeds both export paths (`exportToJSON` and
`exportComponentsToJSON` — both had the same two lines). It strips **only** `adminToken`.

- `adminToken` has **zero readers in `packages/noodl-runtime`** — verified by grep across the
  runtime, viewer and editor sources. It exists for schema introspection, which only the
  editor does. Removing it costs a deployed app nothing.
- `publicToken` **stays**: the same file documents it as *"WILL be published"*, and
  `resolveBackend.ts::handleFor` hands it to every adapter as `handle.publicToken`. Stripping
  it would break the deployed app rather than protect it.
- `username`/`password` **stay**: a backend configured for basic auth needs them at runtime.
  They are the user's declared choice, and BCN-009's security disclosure is the thing that
  tells them so. A silent strip would break their app instead of informing them.

Four specs in `tests/nodegraph/export.js`. **Mutation-tested**: neuter the `delete` and
exactly one spec fails, on both the field assertion and the whole-document assertion — the
second exists because a token surviving *anywhere* in the export is published, and asserting
only on the field would miss a second copy.

⚠️ **This is a disclosure question, not only a code fix.** Any project already deployed from
this editor with an external backend has shipped its admin token. Rotating it is the user's
action, and nothing in the product tells them to. **Unowned — Richard's call whether
BCN-009's disclosure should say so.**

---

## 3. ⚠️ The process defect: the deployed runtime is a stale, untracked build artifact

This one cost the most and is the most generalisable.

The first run of the criterion check **failed**, and failed convincingly: with `backendId`
unset (i.e. `_active_`) and converged metadata, the deployed app went to the `cloudservices`
endpoint over the **Parse wire** (`POST /classes/bcnorch`) instead of the Directus backend
named by `activeBackendId`. That looked exactly like "BCN-009's criterion is unmet for the
default case", which would have been the phase's biggest open defect.

It was not. Three hypotheses were tested and **all three were wrong** before the real cause
surfaced:

| Hypothesis | How it was killed |
|---|---|
| The resolution logic is wrong | Reproduced `defaultBackendId`/`resolveBackendTarget` in Node with byte-identical sources: returns the Directus target, correctly |
| The metadata is not readable at query time | `Noodl.getMetaData('backendServices')` in the page returns the full object, `version: 2` |
| The query fires before metadata is set | A `Page.addScriptToEvaluateOnNewDocument` probe timestamped both: **metadata readable at 108ms, request sent at 117.7ms with `metaSeen=true`** |

The cause: **`packages/noodl-editor/src/external/deploy/noodl.deploy.js` is a build artifact,
is `.gitignore`d, and is not rebuilt by anything in the test path.** The copy on disk was
built `Jul 31 19:07` — *before* `4e46a6f6` landed the converged-selection follow-ups on
2026-08-01. It contained `activeBackendId` (11×) and `_endpoint_` (3×) and **zero**
occurrences of `isConvergedSelection`, the function that commit introduced.

So the deployed app was running the previous day's runtime. `npm run build --prefix
packages/noodl-viewer-react` rebuilds it (35s); the check passes immediately afterwards.

> ⚠️ **A runtime change can land in source, pass every unit test and every node-driver live
> check, and still not reach a deployed app.** Every in-process check in this phase runs
> against `src`; a deployed app runs against a prebuilt bundle that nothing rebuilds
> automatically. **This is precisely why BCN-009's criterion says "a *deployed* app", and it
> is the strongest single argument for why the in-process checks could not have satisfied
> it.** Rebuild the viewer before any deploy-level claim.

---

## 4. ⚠️ Directus in the rig has CORS disabled — every prior live pass ran where that cannot bite

The deployed app's first cross-origin request to Directus was blocked: the preflight
`OPTIONS /items/bcnorch` comes back **200 with no `Access-Control-Allow-Origin`**, so the
browser refuses the GET.

**Every live check in this phase so far ran in Node**, where the same-origin policy does not
exist — 42 transport checks, 101 node-level checks, 106 equivalence checks, 55 relation
checks, 99 realtime checks. None of them could have seen this.

It is a rig configuration fact rather than a product defect (a real deployment configures
CORS on its backend), but it is a **real deployment prerequisite that nothing in the product
mentions**, and a user will meet it as "my app works in preview and not when deployed".

Worked around with `bcn-orch-cors-proxy.mjs` rather than restarting the container, because
the handover is explicit that a restart breaks another worker's run mid-flight. The proxy
also earns its keep in §5.

**Unowned. Candidate for BCN-010's docs step or a deploy-docs note.**

---

## 5. ✅ Criterion: a deployed app resolves its backend from the unified metadata

Set up so the answer **cannot** be ambiguous:

- the Directus backend in `backendServices` is reached at the CORS proxy, `:8578`
- the `cloudservices` endpoint baked in by the exporter points at `:9111`, **a dead port**
- the Query Records node has **no `backendId` parameter at all** — i.e. `_active_`

| Run | Result |
|---|---|
| `version: 2` (converged) | **`GET http://127.0.0.1:8578/items/bcnorch`** → three rows render |
| **Mutation:** `version` removed (legacy metadata) | **`POST http://127.0.0.1:9111/classes/bcnorch`** → nothing renders |

The mutation is the point. Dropping the version marker makes the app fall back to the
endpoint's Parse wire on the dead port — which is the `version >= 2` gate BCN-009's notes
insisted on, **now demonstrated live in a deployed bundle**: a legacy project is not
repointed, a converged one is.

### ⚠️ The first version of this check was vacuous, and the mutation is how I found out

Initially the Query node carried an **explicit** `backendId`. Dropping the version marker
changed nothing — both runs rendered the same three rows — and that is the tell.
`resolveBackendTarget` short-circuits on an explicit id (`wanted = backendId`), so
`defaultBackendId`, where the converged-selection gate lives, **is never consulted**. The
check was measuring "an explicit id resolves", not the criterion.

This is the same failure mode as BCN-004 step 6's routing check, which stayed green with
`backendId` disabled entirely because each backend was the active one in its own run. The
comment is now in the driver so the next reader does not re-introduce it.

Both configurations are kept, since they answer different questions:

| `backendId` | endpoint | Result |
|---|---|---|
| explicit `backend_bcnorch_directus` | dead `:9111` | `GET :8578/items/bcnorch`, 3 rows — an explicit id wins over the endpoint |
| unset / `_active_` | dead `:9111` | `GET :8578/items/bcnorch`, 3 rows — **the criterion** |
| unset / `_active_`, legacy metadata | dead `:9111` | `POST :9111/classes/…`, 0 rows — the gate holds |

---

## 6. ✅ The Repeater renders with a numeric `objectId`

Directus hands back integer ids — measured at the wire on this very collection:
`wireIds: [1,2,3]`, `wireIdTypes: ["number","number","number"]`.

In the deployed app, `document.body.innerText` is:

```
1
bcnorch-alpha
2
bcnorch-beta
3
bcnorch-gamma
```

Three item components mounted, each with the record's numeric `Id` flowing through a
component input into a rendered `Text` node. **This closes the register's "repeater half
unowned" item** — the last third of the `objectId` risk, and the one a headless driver could
not reach.

The DOM assertion is not vacuous: the legacy-metadata mutation in §5 renders an **empty**
body through the same assertion.

Corroborating what the register already recorded: `Collection.set`'s diff keys a **plain
object** (`keys[item.getId()] = item`, `collection.ts:492`), so a numeric id coerces to its
string form. That is the accident the register says is load-bearing, and it is why a re-fetch
that returns `7` where a previous pass held `'7'` does not tear the list down and rebuild it.
**Do not convert `models` to a `Map`.**

---

## 7. My own instrument defects, both caught before they were reported as findings

1. **The export format is not the project format.** A component exports as
   `{name, nodes, connections, ports, roots}` — a **flat** `nodes` array with `roots` as a
   list of *ids* — where the project format nests under `graph.roots`. The first walker read
   `graph.roots`, found nothing, and reported *"the Query node's `backendId` parameter does
   not survive the export"*. It survives verbatim. Caught by dumping the export before
   believing the check.
2. **The vacuous criterion check** — §5.

Both are the reason the mutation-testing instruction is in every worker prompt.

---

## 8. Could not verify

- **A real `deployToFolder` to disk**, and the deploy *pipeline* around it (asset copying,
  the SSR path, `index.html` rewriting for a sub-path base URL). This ran
  `exportToJSON` + `exportComponentBundle` + `HtmlProcessor` — the same engines — and served
  the result, but did not exercise the folder writer or any hosting target.
- **Whether an already-deployed app in the wild carries an admin token.** The defect is
  proven in the export path; how many real deployments exist is not something the repo knows.
- **A Repeater over a collection that *changes* while mounted with numeric ids** — add,
  remove and reorder against a live backend. The initial render is proven; incremental
  `Collection.set` diffing with numeric ids is reasoned from `collection.ts:492` and pinned by
  the existing nine tests the register warns not to modernise past, not measured here.
- **Basic-auth backends after the strip.** `username`/`password` are deliberately kept, but no
  basic-auth backend exists in the rig to prove one still authenticates post-export.
- **SSR.** `index.ssr.js` was not exercised; BCN-008's `client-only` note still has no
  evidence behind it.

---

## 9. Deliberately not done

**Widening `objectId?: string` to `string | number`** on the contract and on
`CloudStore._fromJSON`. It recompiles every consumer — including `RestDataAdapter.ts`
(Worker A's exclusive file) and `capabilities.ts` (Worker B's) — and the handover's own
instruction is to do it *"when nothing else is in flight"*. Four workers were in flight.
**Still owed; do it after the batch merges, in one commit.**
