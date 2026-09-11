# s29 — the observations, written BEFORE the stack was launched

**2026-08-18.** Three things are being read on one stack: **CN-014 AC3** (a syntax-error kit names
itself on the console), **✅ D20** (a kit that throws during registration loses the kit, not the
app), and **✅ D19 / CN-013 AC1** (a kit node reaches a server-rendered page).

🔴 **Written before launching, and the reason is on record in this phase**: a drive can pass on a
broken feature when the expectation is formed after the reading. Each row below says what *met* and
*not met* look like, and names its **surface** — s23 and s27 recorded opposite verdicts on the same
failure and both were right, because one read Settings → Kits and the other read the console.

## The instrument, stamped

| | |
|---|---|
| Built viewer | `packages/noodl-editor/src/external/viewer/noodl.viewer.js` |
| mtime / size / md5 | `2026-08-18 18:00:17` · `1,504,574` · `e56e8d382e8cc17d890faf3c8c3eb5ad` |
| Carries D20? | `The rest of the app is unaffected` ×1 · `NONE of this kit` ×1 · `registration-failed` ×1 · `preview renders nothing` **×0** |

🔴 **`packages/noodl-editor/src/external` is GITIGNORED** (`.gitignore:197`, `git ls-files` → 0
tracked) — measured here, after a peer flagged it. So the rebuild leaves **no diff**, nothing in the
tree records which viewer these readings were taken against, and **no gate reproduces this
artefact**. That is why the hash is stamped above. ⚠️ A deploy **copies** this directory rather than
rebuilding it (`deployToFolder` walks `external/ssr/index.json` and `external/deploy`), so what a
user's deploy ships is whatever a local build last wrote here.

⚠️ Fixture is a **copy** — opening a project writes three files into it and dirties every component.

## Part A — CN-014 AC3, the syntax-error kit. Surface: **the console**, then **Settings → Kits**

| # | Observation | Met | Not met |
|---|---|---|---|
| A1 | Console names the **kit and the file** | `Kit "Broken Kit" failed to load: … (in …/broken-kit/index.js)` | bare `SyntaxError: Unexpected identifier 'Noodl'` |
| A2 | Settings → Kits **still** names it (s23 must not regress) | a row for Broken Kit carrying the message | no row, or a row with no message |
| A3 | The other three kits load; the viewer stays mounted | `reactMounted: true`, `NodeLibrary.types` ≈ 185 | ⚠️ `types === 0` is the **viewer being dead**, not a finding |
| A4 | Fixing the error recovers the kit | its node type is back after one viewer reload | still absent |

## Part B — ✅ D20, on the same stack. Surface: **the app itself**, then **Settings → Kits**

The trigger is s27's second failure: a kit logic node with **no `category`**, in `rename-kit`.

| # | Observation | Met | Not met |
|---|---|---|---|
| B1 | 🔴 The viewer **still mounts** | `reactMounted: true`, `rootChildren > 0` | `reactMounted: false` — the s27 behaviour, D20 not working |
| B2 | The failed kit is **atomic**: its *other* nodes are gone too | neither `nodegx.rename.Badge` nor `nodegx.rename.Source` in the library | one present, one not = half-registered, the state D20 rejected |
| B3 | The **other** kits are untouched | `nodegx.cashflow.*` and `nodegx.grow.*` still present | absent |
| B4 | 🔴 The failure reaches **Settings → Kits** | a row for Rename Kit with the message | absent ⇒ a **silent** skip, which D20 calls strictly worse than the blank screen |
| B5 | The console names node, kit and consequence | `node "…"`, `in kit "Rename Kit"`, `NONE of this kit's nodes register` | anonymous |

⚠️ **B4 is the condition D20 does not relax.** If B1–B3 pass and B4 fails, D20 is **not** built: it
has replaced a failure nobody can miss with a missing node an author will blame on a typo.

## Part C — ✅ D19 / CN-013 AC1, a real SSR deploy. Surface: **HTTP, before any JavaScript runs**

Fixture already carries the probes s27 put there: `SSRPROBETEXT-CONTROL` on a built-in `Text`, and
`SSRPROBEPILL` on `nodegx.cashflow.Pill` — a kit node — inside `probe-group` on `/Pages/Home`.

| # | Observation | Met | Not met |
|---|---|---|---|
| C1 | The deploy **builds** | `npm run build` completes | `Could not resolve "./kit-modules"` (s27's failure; fixed in `8ea0f6c1`) |
| C2 | Kits load server-side | `SSR: loaded N kit script(s)` and **no** `threw while loading` | `window is not defined`, ×4 — the s27 reading |
| C3 | 🔴 The kit node's output is in the **server** HTML | `SSRPROBEPILL` present in `curl` output | 0 occurrences — s27's S1 |
| C4 | **CONTROL** — the built-in in the same page | `SSRPROBETEXT-CONTROL` present | ⚠️ if this is ALSO absent the reading is *"SSR rendered nothing"*, not *"kits are missing"*, and C3 says nothing |

🔴 **C4 is read first.** A control that reads zero makes C3 unfalsifiable, and this phase has the
recorded case: s27's 110,653 bytes of server markup are what let *"kits are missing"* be said at all.

## Residual named in advance, so it is not discovered as a surprise

⚠️ **The D19 shim is removed before the render.** A kit that captures React at import time —
`var React = window.React;`, the documented pattern — keeps it in a closure and is fine. A kit that
reads `window.React.useRef` **inside its component**, at render time, would find no `window`. The
bare `React` global the scaffold now emits does not have this problem, because `globalThis.React` is
installed permanently by `runtime-globals.js`. Found by a harness that tore the global down after
loading and rendered `undefined.useRef` — a real distinction, caught by accident.

---

# MEASURED — 2026-08-18, 18:09–18:26. Every row met, and one new defect found by hitting it

Stack: `dev:debug --quiet`, CDP 9222, fixture **`cn029-drive`** (a copy of `cn027-drive`; the
original was never opened — verified from `ProjectModel.instance`, not assumed, because the launcher
listed two cards with the same display name and card **0 was the original**).

**Baseline before anything was broken:** `NodeLibrary` **186** types, **11** kit types across four
kits, `NodeLibraryImporter.getModuleFailures()` **`[]`**, viewer `reactMounted: true`.

## Part C — ✅ D19 / CN-013 AC1. **MET.** The last thing between CN-013 and AC1

Two `deployToFolder` passes, as `compilation.ts:236` does one: `runtimeType: 'ssr'` to the root and
`runtimeType: 'deploy'` into `public/`. All four kits injected into `public/index.html` with their
`__noodl_module_name` markers.

| # | Result |
|---|---|
| **C1** | ✅ `npm install` + `npm run build` → **`server.js` 6.0mb**. s27's `Could not resolve "./kit-modules"` is gone; the deploy ships the file (`index.json` lists it, and the copy carries `installWindowShim` ×3) |
| **C2** | ✅ **`SSR: loaded 4 kit script(s) for the server render`** — and **zero** `threw while loading`. s27 measured **all four** throwing `window is not defined` |
| **C4** | ✅ **CONTROL read first.** `SSRPROBETEXT-CONTROL` present, inside `<div class="ndl-visual-text">`; 120,984 bytes of server markup |
| **C3** | ✅ **`SSRPROBEPILL` in the SERVER HTML** — s27's S1 was **0** |

🔴 **C3 was checked for the trap that would have made it meaningless.** A parameter value also
appears in an inlined project export, so presence alone proves nothing. The occurrences are in
rendered DOM: `<div style="…border-radius…transition:left 120ms ease-out;z-index:1">SSRPROBEPILL</div>`
plus its own `title` attribute — `nodegx.cashflow.Pill`'s React output with computed styles. Three
more kit nodes rendered too: `BADGE:(none)`, `GROW-ALPHA:GROWTAG`, `BROKEN-KIT-INTACT:v1`. **All
four kits reached the server render.**

⚠️ **7 `useLayoutEffect` warnings** — same count as s27, now reachable because `Cashflow Lane`
actually runs server-side. CN-013's trap list called this "the interesting case"; it is not a
regression.

✅ **Corroboration nobody set up.** Two of the project's own `JavaScript Function` nodes threw
server-side — `Cannot set properties of undefined (setting 'foo')` and `document is not defined`.
The first is `window.foo = …` finding **no `window`**, which is independent evidence that the D19
shim really is removed before the render. ⚠️ It is also a residual worth naming: a **stock**
`JavaScript Function` node touching `window`/`document` fails under SSR. Not a kit problem, not this
task's, and not previously written down here.

## Part B — ✅ D20. **MET, including the condition it does not relax**

Trigger: a third logic node in `rename-kit` with **no `category`**, placed **after** `Source` in
registration order on purpose, so a non-atomic implementation would leave `Source` alive.

| # | Result |
|---|---|
| **B1** | ✅ 🔴 **`reactMounted: true`, `rootChildren: 1`, 2,973 chars visible.** s27: `reactMounted: false`, `rootChildren: 0`. **No uncaught exception** — s27 had `EXCEPTION Uncaught: Error: Node must have a category` |
| **B2** | ✅ **Atomic.** 186 → **184**; both `nodegx.rename.Badge` **and** `nodegx.rename.Source` gone. Second instrument agreed unprompted: `[nodelib] Removed nodes: Array(2)` |
| **B3** | ✅ `nodegx.cashflow.*` ×5, `nodegx.grow.*` ×3, `nodegx.broken.Intact` all still present |
| **B4** | ✅ **Settings → Kits renders a Rename Kit row with the message** — read off the panel DOM, not only off `getModuleFailures()`. Payload: `{module: "Rename Kit", reason: "registration-failed", message: …}` |
| **B5** | ✅ Console: `Node must have a category — node "nodegx.rename.Broken" in kit "Rename Kit". Add a \`category\`… without one NONE of this kit's nodes register…` |
| **B6** | ✅ **Recovers.** Restoring the file → 186 types, all 11, `moduleFailures` **`[]`** — the list is not sticky |

⚠️ **One blemish found and fixed after the drive, so the fix itself is unverified live:** B5's console
line ended *"The rest of the app still runs. **The rest of the app is unaffected.**"* — `viewer.jsx`
appended a consequence to a message that already had one. Guarded now (`/rest of the app/i`), which
is the same rule as CN-015's "do not say the kit twice", one layer up. The clause keeps a population:
a `setup` throw carries no consequence sentence.

## Part A — CN-014 AC3. **MET on both surfaces**

| # | Result |
|---|---|
| **A1** | ✅ Console: `Kit "Broken Kit" failed to load: Uncaught SyntaxError: Unexpected identifier 'oops3' (in http://localhost:8574/noodl_modules/broken-kit/index.js) — its nodes will be missing from the app until this is fixed.` — **kit AND file** |
| **A2** | ✅ Settings → Kits names it; payload `{module: "Broken Kit", reason: "threw", message: …(in …/broken-kit/index.js)}` |
| **A3** | ✅ 185 types, other three kits intact, viewer mounted |
| **A4** | ✅ Recovers on one viewer reload |

## 🔴 NEW DEFECT — the picker's per-kit index is never pruned, and it inverts a diagnostic

Found by reading the panel rather than the model. Settings → Kits said, of a kit that had registered
**nothing**:

> kit "Broken Kit" failed to load: … **It is only PARTIALLY registered — nodes defined before the
> failure are available** and every node after it is missing…

and with D20 in place the Rename Kit row **contradicted itself in one sentence**: *"NONE of this
kit's nodes register"* immediately followed by *"It is only PARTIALLY registered"*. Two fields made
to contradict each other, on the one surface D20 requires the truth to reach.

✅ **Measured, with a control, rather than inferred.** With **both** kits broken: live types **183**
with no `nodegx.broken.*` and no `nodegx.rename.*`, while `NodeLibrary.instance.library.nodeIndex.moduleNodes`
still listed `Broken Kit → [nodegx.broken.Intact]` **and** `Rename Kit → [nodegx.rename.Source,
nodegx.rename.Badge]`. So it is **not** specific to either failure mode — the group is simply never
removed. A second instrument (an independent read of the code paths) landed on the same two lines.

**Cause:** `updateIndex` filters `nodetypes` against `clients.getNodeNames()` and nothing filtered
`nodeIndex.moduleNodes`; `mergeInByName` only ever replaces-by-name or pushes, so a group absent from
a new report survives. `KitsSection` then feeds those names to `kitDiagnostics` as *"what this kit
registered"*, so `registeredSomething` was true for a kit that registered nothing.

✅ **Fixed in `NodeLibraryImporter.updateIndex`** — prune each group's items against the **same**
`nodeNames`, drop groups that empty. **The `partial` branch is kept, not deleted**: a script that
throws after some `defineModule` calls really is half-registered, and that is the alarming case
CN-015 named. What changed is that its input is now true. **6 tests, 4/4 mutants killed**
(`tests-unit/cn-015/pickerIndexPruned.test.ts`).

⚠️ **A first draft added `|| removedModuleNodes.length > 0` as a republish trigger and it was removed
again**: no test could reach it, because an item can only be pruned once its name has left
`nodeNames`, and that is the same removal that drops the node type. A branch nothing can reach is a
branch that only ever passes.

⚠️ **Not re-driven.** The prune and the console dedup are proven by unit tests and mutants, not by a
second stack. Both are small and their inputs are the ones measured above, but the honest record is
that the *live* readings in this file are from the 18:00:17 bundle
(`e56e8d382e8cc17d890faf3c8c3eb5ad`), and the shipped bundle is now **18:33:21**
(`52d7fa4c2d71d45c55b1fc4b8ca125d2`).
