# Phase 69 — session 28. **The drives are done. Three of six criteria failed, and the fixes are small.**

**Written 2026-08-18, end of s27.** 🔴 **This file is a REWRITE, not an amendment.** Overwrite it
next session; anything that outlives the phase goes to memory, not here.

> ## s27 drove all six criteria and then fixed one of the two failures. What is left is **one
> ruling** (§2b), **one naming job** (§2c), and **one criterion to re-scope** (§2d).

---

## 0. STEP ZERO — the tree

s27 left the checkout clean of its own work (committed `4aba00f4`). A peer has
`scripts/library/check.ts`, `phase-50`/`phase-68` notes and two untracked task dirs in flight —
**not yours, do not sweep them.** Commit with explicit pathspecs, never `git add -A`.

```bash
git status --short packages/noodl-editor/src   # empty ⇒ safe to launch
```

## 1. Where the six criteria actually landed

| # | Task | Verdict |
|---|---|---|
| 1 | CN-013 AC1 | 🔴 **NOT met** — two independent causes, §2 |
| 2 | CN-014 AC1 cl.2 | ⚠️ **flagged but not dropped** — diagnostic real, wire retained |
| 3 | CN-014 AC2 | ✅ **met** — one viewer reload, no restart |
| 4 | CN-014 AC3 | 🔴 **NOT met** — reported, but names neither kit nor file |
| 5 | CN-011 AC2 | ✅ token resolution + live propagation met · 🔴 **"both themes" is unmeasurable** |
| 6 | CN-011 AC3 | ✅ **met**, on the reader path |

✅ **CN-010 is fully closed** — `parameterEncoding` was the last non-drive item and it is done.

Everything is in **[notes/s27-drive-observations.md](notes/s27-drive-observations.md)**, with the
instrument traps that nearly produced wrong readings. Read it before re-measuring anything.

## 2. 🔴 The work, in the order it is worth doing

### 2a. ✅ DONE s27 — the SSR deploy builds again

`kit-modules.js` is in `static/ssr/index.json` (`8ea0f6c1`), and
**`tests/ssr-deploy-manifest.test.js`** now walks the require graph **transitively** from `index.js`
and `ssg.js`, so a require added inside `server-core.js` is caught the same way. **3/3 mutants
killed**, each naming the file — including `render-gate.js`, which is reachable only transitively.
925/925 `noodl-viewer-react` (73 suites).

✅ **Verified end to end, not just by the gate:** a fresh unpatched deploy from a live editor now
ships `kit-modules.js`, `npm install && npm run build` produces `server.js`, and the server answers
`200` with the built-in control present in the HTML. ⚠️ The misleading comment in `index.js` — *"all
of static/ssr is copied … so these travel together"* — is rewritten to name the step that actually
copies.

🔴 **This did NOT make kits render server-side.** All four kits still throw `window is not defined`;
the loader runs and names each one. That is §2b, and it is the whole of what is left on CN-013 AC1.


### 2b. 🔴 The documented kit pattern is incompatible with SSR — this is a RULING, not a fix

Every kit begins `var React = window.React;`. Under SSR all four threw `window is not defined`, and
the loader said so per-kit, clearly. But **the cashflow kit's own header teaches this pattern** and
CN-007 documents it. So either the pattern changes, or kits are honestly declared browser-only.

| | Option |
|---|---|
| **(a)** | Give the SSR loader a `window` shim carrying `React` before evaluating a kit |
| **(b)** | Change the documented pattern to a guarded accessor and update the worked example + scaffold |
| **(c)** | Declare kits browser-only under SSR; keep today's diagnostic as the honest answer |

**Recommendation: (a) then (b).** (a) is small and makes existing kits work; (b) stops new ones
being written against a global that may not exist. (c) is a real option and is what ships today.

### 2c. Kit failures must name the kit — CN-015's remaining teeth

Two failure modes, both anonymous, opposite blast radii:

- **Syntax error** (isolated): `SyntaxError: Unexpected identifier 'Noodl'` — no kit, no file. The
  editor says only `nodelibrary-unknown-node` on the node. Kit recovers when fixed.
- **Missing `category` on a logic node** (total): `Node must have a category` out of `registerModule`
  kills the **whole viewer** — `reactMounted:false`, `rootChildren:0`. `nodedefinition.ts:248` has
  `opts.name` on the very next line and does not use it.

🔴 **The second reads exactly like a dead renderer**, which is how a session loses an afternoon.
The SSR loader already does this right — copy its message shape.

### 2d. CN-011 AC2's "both themes" clause should be struck

There is no second theme: `StyleTokenRecord` is one value per token, 182 flat tokens, and no
`data-theme` / `prefers-color-scheme` / `setTheme` anywhere in `noodl-viewer-react/src`. Re-scope
the criterion to what was measured and met (resolution + live propagation) rather than logging a
failure against a capability the product does not have.

## 3. Two criteria this stack could not close, reported not fudged

- **CN-008 AC1** — 🔴 **unmet, no model available.** ⚠️ And the seam §7 named is not a usable check:
  `AiConfigStore.getApiKey(provider)` **ignores its argument** — a bogus provider name returns the
  same 16-character value as `anthropic`, with no `sk-ant-` prefix. Do not read "a key is set" from
  it. s27 did **not** substitute the "handout appears in the prompt" mechanism, which CN-008 itself
  says would be equally true of a broken feature.
- **CN-007 AC2** — still needs someone who has not read this phase to follow the docs page. Ask
  Richard: hand it to a fresh agent, or close CN-007 on its other four criteria.

## 4. Waiting on Richard — the queue is reopened

**[RULINGS-OPEN-QUEUE.md](RULINGS-OPEN-QUEUE.md)** #11 and #12, both measured by s27:
no `--success`/`--warning`/`--info` semantic tokens; and `kitDiagnostics` printing outside
`validate:project`'s summary so an `ERROR` sits above `0 error(s)` and the exit code stays `0`
(⚠️ the `--json` path omits kit diagnostics entirely). §2b above is a third.

## 5. Driving traps s27 paid for — read before launching

- 🔴 **`cdp reload --target=viewer` reloads the EDITOR — second confirmation** (first 2026-08-15). It
  closes the project and returns to the launcher. ✅ Use `eval "location.reload()" --target=viewer`.
- 🔴 **Do not edit anything the editor bundles between launch and `reactMounted:true`.** s27 edited a
  workspace package during the first compile and wedged the renderer permanently:
  `compiled successfully in 278859 ms` then `wait until bundle finished`, and
  `curl -o /dev/null -w '%{http_code}' http://localhost:8080/src/editor/index.bundle.js` → **000**
  (held, not refused). Only a relaunch clears it. ⚠️ **000 *before* the first compile is normal** —
  the wedge is 000 *after* a successful compile.
- 🔴 **`NodeLibrary.types` reads empty when the VIEWER is dead** — the editor's library comes from the
  viewer. A zero there is the instrument, not a finding.
- 🔴 **Variants persist in `nodegx.styles.json`, not `nodegx.project.json`.**
- ⚠️ **`DeployOptions.environment` is required** (may be `undefined`, must be present).
- ⚠️ To open a specific project: `LocalProjectsModel.instance.openProjectFromFolder(dir)` to register
  it, `App.instance.exitProject()` to reach the launcher, then click `[data-test=launcher-project-card]`.
- ✅ Fixture ready to reuse: **`NodeGX test projects/cn027-drive`** — four kits, probes on
  `/Pages/Home`, a live connection, and a `useVariants` node. It is a copy; never open an original.
