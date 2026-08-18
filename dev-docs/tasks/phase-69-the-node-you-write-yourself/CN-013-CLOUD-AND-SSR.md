# CN-013 — Cloud and SSR

| Field | Value |
|---|---|
| **Tier** | 4 |
| **Effort** | M |
| **Surface** | `runtime`, `editor` |
| **Rulings** | — |
| **Depends on** | CN-012 (which establishes whether the cloud path exists at all) |

## ✅ CLOUD HALF BUILT AND DRIVEN — s25, 2026-08-18. ⚠️ SSR half MEASURED, not fixed

| Item | State |
|---|---|
| 1. Does a kit render under SSR? | ✅ **ESTABLISHED: no.** [notes/cn-013-ssr.md](notes/cn-013-ssr.md) |
| 2. A browser-only kit on an SSG build | ✅ answered — **silent omission**, but see below: it is not browser-only kits, it is *all* of them |
| 3. Cloud runtime | ✅ **BUILT.** [notes/cn-013-cloud-drive.md](notes/cn-013-cloud-drive.md) |
| 4. `kitNeedsSsrWarning` | 🔴 **DO NOT BUILD YET** — see below |
| 5. Document `ssr` for kit authors | 📋 CN-007, Bundle B |

**The cloud half (✅ D18).** `noodl-viewer-cloud/src/kitModules.ts` evaluates a cloud-enabled kit's
entry script and registers its **logic** nodes; `@nodegx/module-inject` gained the `runtimes` cloud
predicate and the disk read; the editor's cloud-function bundle carries the sources; `WorkflowRunner`
prints what happened at load. A `require` shim throws D18's sentence, so an SDK reach fails **naming
the limit** rather than dying on `require is not defined`. Verified in **both build shapes** — source
via the `@cloud-runtime` alias, and the esbuild bundle over real HTTP where the same graph with
`modules` deleted still 504s. **Mutations 5/5 killed.**

🔴 **D18's premise 2 is false and it changes the verification obligation, not the ruling.**
[notes/cn-013-cloud-premise.md](notes/cn-013-cloud-premise.md): nothing in this repo loads
`sandbox.isolate.js`, and the editor's "cloud preview" spawns `nodegx-backend/dist/cli.js` — the
bundle a deploy target runs. **One context, two build shapes.** D18's conclusion stands on premise 4.

🔴 **AC1's SSR half is established and NOT fixed.** The globals are set and **nothing fills them** —
no file in `static/ssr/` evaluates a kit, so `__noodl_modules` is `[]` at every server render while
the client loads the kits from `public/index.html`. The server renders the page **without** the kit
nodes and hydration renders a different tree. ⚠️ **Item 4 must not be built before this is fixed**:
*every* kit is missing under SSR, not just browser-only ones, so a `kitNeedsSsrWarning` modelled on
`libraryNeedsSsrWarning` would warn about the wrong kits and stay silent about the rest.

⚠️ **AC2 and AC4 are open. AC3 is now met for `browser` and `cloud`** — `effectiveKitRuntimes` is the
one place that knows which runtimes have loaders, and `kit-loads-nowhere` documents the ones that do
not. **AC1 is met for cloud, half-met for SSR** (the seam is measured; a rendered SSR page is not).

## The question

A kit is a `<script>` tag. That works in a browser. NodeGX also renders **server-side** (SSR/SSG) and
runs **cloud functions**, and a kit's relationship to both is currently unproven.

Three mechanisms already exist and are wired to different degrees:

- **`manifest.runtimes`** — the module scanner filters on it, so a module can declare itself
  browser-only and be omitted elsewhere. This half works and ships.
- **`ReactNodeDefinition.ssr`** — a `NodeSSRCompat` field (RUN-002) forwarded to the runtime
  definition and the catalog. Kit authors have never been told it exists.
- **SSR globals** — `static/ssr/runtime-globals.js` sets `globalThis.React` and
  `globalThis.__noodl_modules`, and `static/ssr/index.js:68` passes them into the server render. So
  the SSR path **is** module-aware by construction.

## The precedent for doing this well

ERG-002 already solved the adjacent problem for UMD libraries and the pattern should be reused
rather than reinvented: **`libraryNeedsSsrWarning(lib, deployRenderingMode)`** — a pure predicate,
true when the project's `deployRenderingMode` (written only by `DeployToFolderTab.ts`; unset means
CSR) is `ssr`/`ssg` **and** the library is browser-only. The Libraries settings section shows an
inline warning naming the specific `window.<global>` reference that will fail server-side.

**A kit deserves the same treatment**, and the warning should name the *node*, because that is what
the user will see missing.

## What to establish, then build

1. **Does a kit node render under SSR today?** The globals are set, so it plausibly does. Confirm
   with the cashflow kit and an `ssr` deploy — it uses `useLayoutEffect` and `ResizeObserver`, both
   of which are exactly the things that misbehave server-side, which makes it an unusually good test
   subject.
2. **What happens to a browser-only kit on an SSG build** — silent omission, blank, or a crash. The
   answer determines whether the warning is a nicety or a necessity.
3. **Cloud runtime**: CN-012 checks whether `registerModule` is reachable there at all. If it is not,
   `manifest.runtimes` promises something we do not deliver, and this task must either deliver it or
   make the field honest.
4. **A `kitNeedsSsrWarning` predicate** on `libraryNeedsSsrWarning`'s model, surfaced in CN-006b's
   kits list and at deploy time.
5. **Document `ssr` for kit authors** in CN-007.

## Acceptance criteria

1. The SSR behaviour of a kit node is **established and written down**, not inferred from the globals
   being present.
2. A browser-only kit in an SSR/SSG project produces a warning naming the affected nodes, before
   deploy rather than after.
3. `manifest.runtimes` either works for every value it accepts, or documents the ones it does not.
4. No claim reaches CN-007's docs that this task has not measured.

## Traps

- ⚠️ **Deployed apps freeze their React copy at deploy time** (RUN-001's assessment). SSR output and
  client hydration must agree about which React they got, or a kit works in one and not the other.
- ⚠️ `useLayoutEffect` warns under SSR in React and is a common source of hydration mismatch — the
  cashflow kit's `Cashflow Lane` uses it, deliberately, to measure. Expect this to be the first
  thing that breaks and treat it as the interesting case rather than an obstacle.
