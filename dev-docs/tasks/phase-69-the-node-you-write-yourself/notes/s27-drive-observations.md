# s27 — the six closing observations. Predictions written BEFORE the stack, readings after.

Fixture: `NodeGX test projects/cn027-drive`, a `cp -R` of `cn019-drive` with four kit folders.
`cashflow-kit` overwritten with the tokenised copy from `cashflow-command-centre` — verified by
measurement, not by trusting the handover: **25 hex → 2 hex / 18 `var()`**, md5
`332963e0adb8e5fa1de072c7683dfe3e`. The §2 warning was correct.

Probes on `/Pages/Home`: `probe-text` (built-in `Text`, the S2 control) · `probe-pill`
(`nodegx.cashflow.Pill`) · `probe-badge` (`nodegx.rename.Badge`) · `probe-alpha` · `probe-intact`.
Live connection `probe-source.outText → probe-badge.caption`, confirmed **delivering at runtime**
(`BADGE:WIRED-FROM-SOURCE`) before D1 touched it.

## Readings

| # | Criterion | Reading | Verdict |
|---|---|---|---|
| **S1** | kit node in server HTML | `SSRPROBEPILL` **0 occurrences**. All kit markers 0 | 🔴 **not met** |
| **S2** | the control | `SSRPROBETEXT-CONTROL` **present**; root div = **110,653 bytes** of server markup | ✅ fires — so S1 means **"kits are missing"**, NOT "SSR rendered nothing" |
| **S3** | `useLayoutEffect` | **7 warnings** in the server log | present, from built-ins |
| **D1** | connected port removed | connection **retained** in `connections.json`; value **stops** (`BADGE:(none)`); diagnostic **raised and rendered**: `nodegx.rename.Badge · #probe-badge · input: caption`, code `con-no-target-port` | ⚠️ **flagged, not silent — but the wire is not dropped** |
| **D2** | node added to a kit | `nodegx.grow.Beta` in the editor library after **one viewer reload, no restart**; 185 types | ✅ **met** |
| **D3** | kit with a syntax error | node stops rendering, **old version does NOT keep running**, other three kits survive, viewer stays mounted. But: `SyntaxError: Unexpected identifier 'Noodl'` names **neither the kit nor the file**; editor shows only `nodelibrary-unknown-node`; UI mentions "Broken Kit" **nowhere** | 🔴 **not met — reported, but does not name the kit** |
| **T1** | pill in default theme | **`rgb(22, 163, 74)`** = `--green-600` = `#16a34a`; `el.style.background` is the literal `var(--green-600)` | ✅ **met** |
| **T2** | the other theme | 🔴 **PREMISE FALSE.** There is no other theme — see below | not measurable |
| **T3** | token change, no reload | `setToken('--green-600', …)` → viewer root property **and** the pill follow, no reload: `rgb(0, 0, 255)` | ✅ **met** — the half s15 never measured |
| **T4** | variant on the reader path | created on `nodegx.grow.Gamma`, auto-saved to `nodegx.styles.json`, project **closed and reopened**, returns as a real `VariantModel` with `tone: var(--green-600)` intact | ✅ **met** |

## 🔴 CN-013 — two independent failures, and the first stops every deploy

**1. The SSR deploy does not ship `kit-modules.js`, so it cannot build — for any project.**

`deployToFolder` does not copy the directory; it copies an explicit manifest,
`external/ssr/index.json`, which lists **ten** files. `kit-modules.js` is not among them, in the
built copy **or** in the source `static/ssr/index.json`. So this is not a stale artefact — the
manifest was never updated when CN-013 added the loader (`5d956ae2`).

`index.js` requires it at top level (`const { loadKitModules } = require('./kit-modules')`), so
`npm run build` dies with `Could not resolve "./kit-modules"`. **Every SSR deploy fails to build,
kit or no kit.** ✅ **Control: copying that one file in and re-running the same command builds
cleanly** (`server.js`, 6.0mb) — one file, opposite outcome.

⚠️ Three lines above the failing require, `index.js` states *"All of static/ssr is copied into the
deploy runtime by webpack, so these travel together."* That comment is false, and it is the reason
the gap is invisible to a reader.

**2. Even patched, every kit fails server-side.** The loader ran and reported, naming each kit:

```
SSR: kit "Cashflow Kit" threw while loading server-side (window is not defined). Its nodes will be
missing from the server render and will appear only after hydration, which is a hydration mismatch.
```

All **four** kits threw, because every one begins `var React = window.React;` — which is the pattern
the phase's own worked example documents and ships (`cashflow-kit`'s header explains it as correct).
**The documented kit-authoring pattern is incompatible with SSR.** The diagnostic itself is
excellent: kit, cause, consequence, and the fix.

**CN-013 AC1 is NOT met.** The seam had a unit test (`ssr-kit-modules.test.js`); nothing had ever
built the deploy or rendered the page. Build-the-caller, again.

## 🔴 T2 — CN-011 AC2's "both themes" cannot be met or failed: there is no second theme

Measured, not inferred: `StyleTokenRecord` is `{name, value, category, isCustom, description?}` —
**one value per token, no theme dimension**. `DefaultTokens.ts` holds 182 flat tokens;
`nodegx.styles.json` has flat `colors`/`textStyles`; and `noodl-viewer-react/src` contains **no**
`data-theme`, `prefers-color-scheme`, `setTheme` or `themeName`. A project has exactly one token set.

So AC2 splits: the *token resolution* half (T1) and the *live propagation* half (T3) are **met**;
the "in both themes" clause is about a capability that does not exist. It should be struck or
re-scoped, not recorded as a failure.

## 🔴 A kit that omits `category` on a logic node kills the whole viewer, and nothing names it

Found by hitting it: `rename-kit`'s logic node had no `category`. The viewer rendered **nothing** —
`reactMounted: false`, `rootChildren: 0` — and the only signal was:

```
EXCEPTION Uncaught: Error: Node must have a category
    at Object.defineNode (noodl.viewer.js) at NoodlRuntime.registerNode / registerModule
```

`nodedefinition.ts:248` throws it, and **`opts.name` is available on the very next line** yet is not
in the message. No kit, no node, no file. One missing field in one node of one kit takes down the
entire preview with a message that points nowhere. Same family as D3 and squarely CN-015's.

⚠️ **Two failure modes, opposite blast radii:** a *syntax error* (D3) is isolated — the kit's nodes
vanish, its neighbours live, the viewer stays up, and the kit **recovers** when fixed. A *throw
inside `defineNode`* takes everything down. Same authoring mistake class, very different outcomes.

## Instrument notes — where a wrong reading was available

- 🔴 **`NodeLibrary.getNodeTypes()` returned `0`, and `types` was empty, while `isLoaded()` was
  `false`** — because the editor's library arrives **from the viewer**, and the viewer had died on
  the `category` throw. A zero here is the instrument, not a finding. After the fix: **186 types**.
- ✅ **`WarningsModel` proven firing before any absence was claimed**: 11 warnings, ten of them
  pre-existing and unrelated. The zero-beside-a-bogus-node trap did not bite because the instrument
  was read against known signal first.
- 🔴 **`cdp reload --target=viewer` reloaded the EDITOR — second confirmation** (first 2026-08-15).
  It closed the project and returned to the launcher. ✅ **`eval "location.reload()" --target=viewer`
  is the reliable route** and was used for every subsequent reload.
- 🔴 **`variants` are in `nodegx.styles.json`, NOT `nodegx.project.json`.** Reading the project file
  showed no `variants` key and would have been filed as "variants do not persist". They do.
- ✅ **`stateParamaters` is a KNOWN legacy typo, handled on both sides** (`ProjectExporter` normalises,
  `ProjectImporter` reverses, both with comments). It appears in `toJSON()` output and is not a bug.
- ⚠️ **`DeployOptions.environment` is required** (may be `undefined`, must be present). §4a's recipe
  omitted it.

## Corrections to the prompt

- §2's fixture advice was right and was verified independently.
- §4a's `deployToFolder` call needs `{ environment: undefined, runtimeType: 'ssr' }`.
- §4b's D1 expectation "dropped with a diagnostic" — the wire is **retained**; the diagnostic is real.
