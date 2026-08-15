# CN-013 — Cloud and SSR

| Field | Value |
|---|---|
| **Tier** | 4 |
| **Effort** | M |
| **Surface** | `runtime`, `editor` |
| **Rulings** | — |
| **Depends on** | CN-012 (which establishes whether the cloud path exists at all) |

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
