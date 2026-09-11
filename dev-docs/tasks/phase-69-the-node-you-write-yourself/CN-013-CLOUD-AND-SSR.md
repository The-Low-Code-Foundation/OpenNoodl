# CN-013 — Cloud and SSR

| Field | Value |
|---|---|
| **Tier** | 4 |
| **Effort** | M |
| **Surface** | `runtime`, `editor` |
| **Rulings** | — |
| **Depends on** | CN-012 (which establishes whether the cloud path exists at all) |

## ✅ AC1 CLOSED — s29, 2026-08-18, on a real SSR deploy over real HTTP

**AC1 is met. AC3 is met.** ⚠️ **AC2 and AC4 remain open** and both are item 4
(`kitNeedsSsrWarning`), which s25 unblocked and nobody has built.

✅ **D19 built and proven where the last three sessions could not reach.** The SSR loader now installs
a `window` shim carrying **`React` and nothing else** before evaluating a kit, and removes it before
the render. The documented pattern moved with it: the scaffold and the worked example open
`var h = React.createElement;` — the **bare `React` global**, which the shipped kit types already
recommended over `window.React` and which the scaffold's own cold-typecheck test enforced when
`globalThis.React` was tried instead.

| | s27 measured | s29 measured |
|---|---|---|
| Deploy builds | 🔴 `Could not resolve "./kit-modules"`, every SSR deploy | ✅ `server.js` 6.0mb |
| Kits load server-side | 🔴 **all four threw** `window is not defined` | ✅ `SSR: loaded 4 kit script(s)`, **zero** threw |
| Kit node in the served HTML | 🔴 **S1 = 0** | ✅ `SSRPROBEPILL` in rendered DOM, plus three more kit nodes |
| Control (built-in, same page) | ✅ present | ✅ present, 120,984 bytes |

🔴 **The presence check was made falsifiable before it was believed.** A parameter value also appears
in an inlined project export, so a bare `grep` proves nothing; the occurrences are inside
`nodegx.cashflow.Pill`'s own React output with its computed styles. Full readings, including the
control-read-first ordering: [notes/s29-drive-observations.md](notes/s29-drive-observations.md).

⚠️ **Residual, newly named:** a **stock** `JavaScript Function` node touching `window`/`document`
throws under SSR — two of the fixture's own did. Not a kit problem and not this task's, but it had
never been written down, and it is the same class of surprise as the one D19 just removed for kits.

⚠️ **7 `useLayoutEffect` warnings**, as this task's trap list predicted — now *reachable* because
`Cashflow Lane` actually runs server-side. Not a regression; the interesting case arriving on time.

## ✅ CLOUD HALF BUILT AND DRIVEN — s25, 2026-08-18. ⚠️ SSR half MEASURED, not fixed

| Item | State |
|---|---|
| 1. Does a kit render under SSR? | ✅ **ESTABLISHED, FIXED, and s29 SAW A RENDERED PAGE.** [notes/cn-013-ssr.md](notes/cn-013-ssr.md), [notes/s29-drive-observations.md](notes/s29-drive-observations.md) |
| 2. A browser-only kit on an SSG build | ✅ answered — it was **silent omission of every kit**; now they load |
| 3. Cloud runtime | ✅ **BUILT.** [notes/cn-013-cloud-drive.md](notes/cn-013-cloud-drive.md) |
| 4. `kitNeedsSsrWarning` | 📋 **now buildable, and its shape changed** — see below |
| 5. Document `ssr` for kit authors | 📋 CN-007, Bundle B — ⚠️ **the thing to document is that there is NO `ssr` value** |

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

✅ **The SSR half — established, then FIXED the same session** (`static/ssr/kit-modules.js`). It was
the same defect in a second runtime: the globals were set and **nothing filled them**, so the server
rendered every page with its kit nodes missing while the client hydrated with them present.

🔴 **The loader reads the injector's own `<script>` tags out of `index.html`, not `noodl_modules/`.**
A second manifest scanner is the regression LIB-003 exists to end, and an SSR deploy is a standalone
folder that cannot import the first one — so it consumes the browser's instructions instead and
**cannot disagree with the browser about which kits load.** CN-003's name adoption is reused rather
than copied. **11 tests, 4/4 mutations killed.**

⚠️ **There is no `runtimes: ["ssr"]`, and item 5 should say so.** SSR is the *browser* app rendered
on a server, so `browser` is what reaches it. A kit declaring only `ssr` is in no page and still runs
nowhere — which is why `KIT_LOADERS` stays `['browser', 'cloud']`.

✅ **Item 4 is unblocked and its shape has changed.** The objection was that *every* kit was missing
under SSR, so a `libraryNeedsSsrWarning`-shaped predicate would name the wrong kits. The honest
predicate is what that objection implied: **warn about a kit that throws or no-ops server-side**,
and the loader's own failure list — loaded / threw / skipped-remote-dependency — is the input.

✅ **AC3 is met. AC1 is met — including the rendered SSR page, observed in s29** (see the top of this
file). **AC2 and AC4 are what is left**, and both are item 4.

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

---

## 🔴 s27 (2026-08-18) — AC1 DRIVEN and NOT MET, for two independent reasons

Full readings: [notes/s27-drive-observations.md](notes/s27-drive-observations.md).

**1. The SSR deploy never ships `kit-modules.js`, so the output cannot build — for ANY project.**
`deployToFolder` copies an explicit manifest (`external/ssr/index.json`), not the directory. That
manifest lists ten files and `kit-modules.js` is not among them — in the built copy **or** in the
source `static/ssr/index.json`. Not a stale artefact: the manifest was never updated when this task
added the loader (`5d956ae2`). `index.js` requires it at top level, so `npm run build` dies with
`Could not resolve "./kit-modules"`. ✅ **Control: adding that one file and re-running the same
command builds cleanly.** ⚠️ `index.js` claims three lines above the failing require that "All of
static/ssr is copied into the deploy runtime by webpack" — false, and it hides the gap.

**2. Even patched, every kit fails server-side.** All four kits in the fixture threw
`window is not defined` at import, because each begins `var React = window.React;` — **the pattern
this phase documents and ships as the worked example**. The loader's diagnostic is excellent (names
kit, cause, consequence, fix); the outcome is that no kit node reaches the server render.

**S1 = 0** kit markers in the served HTML. **S2 control = present**, with 110,653 bytes of
server-rendered markup — so this is *"kits are missing"*, not *"SSR rendered nothing"*. S3: 7
`useLayoutEffect` warnings.

🔴 **The seam had a unit test (`ssr-kit-modules.test.js`); nothing had ever built the deploy or
rendered a page.** Build the caller.
