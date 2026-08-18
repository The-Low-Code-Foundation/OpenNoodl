# Phase 69 — session 27. **One stack. Six criteria. Then the phase is closed.**

**Written 2026-08-18, end of session 26.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

> ## 🔴 There is no coding left in this phase. Every remaining criterion is a DRIVE.
>
> s26 built the last five rulings (**D10, D12, D13, D14, D16**) and closed **CN-009**. What is left
> is six observations behind **one editor stack**, plus one thing a stack cannot give you (§7).
>
> **Work §0 → §6 in order.** §0 is a gate: if it fails, do §8 instead and do not launch.

---

## 0. 🔴 STEP ZERO — the tree, and it has blocked two sessions running

A peer has had uncommitted phase-67 editor source in this shared checkout since **s25**. At s26's
end, unchanged for over an hour:

```
 M packages/noodl-editor/src/editor/src/models/community/communitysession.ts
 M .../views/DialogLayer/components/AskAboutNodeDialog/AskAboutNodeDialog.tsx
?? .../models/community/communityorigin.ts     ?? .../models/community/communitysignin.ts
```

```bash
git status --short packages/noodl-editor/src
stat -f '%Sm %N' -t '%Y-%m-%d %H:%M:%S' packages/noodl-editor/src/editor/src/models/community/*.ts
```

**Two of those are NEW FILES.** A stack launched over them compiles *their* half-finished feature,
so **every observation below becomes unattributable** — and `AskAboutNodeDialog` is AI-assistant
code, which bears directly on CN-008's drive.

| reading | do |
|---|---|
| **clean** | launch. Go to §1 |
| **dirty** | 🔴 **ASK the phase-67 session to commit or stash.** Silence is not release. Liveness is measurable, intent is not — so ask, do not infer from quiet mtimes |
| **dirty and nobody answers** | do §8 (the no-stack work), and say in your handover that you refused, so this does not read as a third session that simply forgot |

⚠️ **A clean `ps` is not a clean tree.** The check above is the tree, not the process list.

## 1. ✅ Exit criteria — what "the phase is closed" means

Tick all six and the phase is done. **Tiers 0–5 only; CN-016 and CN-017 stay deferred as Bundle C.**

| # | Task | Criterion | Where |
|---|---|---|---|
| 1 | **CN-013** | a **rendered** SSR page contains the kit node's output before any JS runs | §4a |
| 2 | **CN-014** | AC1's 2nd clause — a connected port that disappears is **dropped with a diagnostic**, not silently retained | §4b |
| 3 | **CN-014** | AC2 — a node added to a kit reaches the picker without a restart | §4b |
| 4 | **CN-014** | AC3 — a kit with a syntax error **reports it** rather than leaving the old version running | §4b |
| 5 | **CN-011** | AC2 — a `var(--token)` colour resolves in **both** themes; a token change propagates without a reload | §4c |
| 6 | **CN-011** | AC3 — a variant on a kit node survives save/reload, **tested on the reader path** | §4c |

**Two criteria cannot be closed by this stack and must be reported honestly, not fudged:**

- **CN-008 AC1** needs a real model call and real spend — §7.
- **CN-007 AC2** needs someone who has not read this phase to follow the docs page — §7.

## 2. 🔴 Build the fixture BEFORE launching — and the last handover named the wrong one

s25/s26's handover said *"start from `cn012-drive`, it carries `tally-kit`"*. **Measured s26:
`tally-kit` is LOGIC-ONLY** — its header says so and it registers `nodes:`, never `reactNodes`. A
logic node **renders no markup**, so it **cannot serve CN-013's SSR drive at all**: there would be
nothing to look for in the HTML, and "absent" and "correct" would produce the same reading.

✅ **Build ONE project with FOUR kit folders.** Start from a `cp -R` of
`NodeGX test projects/cn019-drive` (v2, carries `cashflow-kit`, no `inter`/`lucide` noise):

| folder | for | notes |
|---|---|---|
| `cashflow-kit` | **CN-013**, **CN-011 AC2/AC3** | 🔴 **overwrite it with the TOKENISED copy** from `cashflow-command-centre/noodl_modules/cashflow-kit/index.js` — `cn019-drive`'s own copy is **pre-D8 (25 live hex)** and would read as "the token change did not land" |
| `rename-kit` | **CN-014 AC1** | a small visual kit with one port you will rename, wired to something on canvas |
| `grow-kit` | **CN-014 AC2** | a small kit you will add a node to |
| `broken-kit` | **CN-014 AC3** | ⚠️ **add the syntax error LAST**, after 1–3 are measured. A broken kit in the project from the start poisons every earlier reading |

⚠️ **Opening a project WRITES three files into it.** This is why it is a `cp -R`. Never point the
editor at `cashflow-command-centre` or any original.

## 3. Write the observations down, then launch

🔴 **Fill in the "reading" column only after the stack is up.** A bundled drive is exactly where
*"it looked fine"* gets in. **Bundle the drives; do NOT bundle the conclusions** — ten consecutive
sessions in this phase have found a false premise, s26 included.

```bash
# Bash tool: run_in_background: true — NOT nohup (attribution is by PPID)
npm run dev:debug -- --quiet
until grep -q "launching Electron" .logs/dev.log; do sleep 15; done
sleep 30
npm run cdp -- health          # reactMounted must be true before anything else
```

⚠️ **Announce that you are launching**, and announce the teardown to the same people.

## 4. The drives

### 4a. CN-013 — a rendered SSR page

🔴 **There is no headless deploy path.** `deployRenderingMode` is written **only** by
`DeployToFolderTab.tsx` and no CLI exists. Do what the button does, minus the file dialog, in the
renderer:

```js
// npm run cdp -- eval "…"   (rebuild __req first if absent, see §6)
const { createEditorCompilation } = __req('./src/editor/src/utils/compilation/compilation.editor.ts');
const { ProjectModel } = __req('./src/editor/src/models/projectmodel.ts');
createEditorCompilation(ProjectModel.instance)
  .addProjectBuildScripts()
  .deployToFolder('/tmp/.../ssr-out', { runtimeType: 'ssr' });   // 'ssr' covers SSR and SSG
```

Then, per `packages/noodl-viewer-react/static/ssr/README.md`:
`npm install && npm run build && npm start` (PORT default 3000), and `curl` the page.

| # | Observation | "works" | "does not" |
|---|---|---|---|
| **S1** | the kit node's own text is in the **server** HTML | the pill's amount/label present in `curl` output, **before any JS runs** | absent |
| **S2** | 🔴 **the control — a built-in in the same page** | a `Text` node's content also present | ⚠️ **if the control is ALSO absent, S1 means "SSR rendered nothing", not "kits are missing"** — the two have different fixes and identical readings without this row |
| **S3** | `useLayoutEffect` under SSR | React's SSR warning in the server log | silence — note it, do not chase it |

✅ **This is a CONFIRMATION drive.** The seam is already measured on both sides of the fix
(`tests/ssr-kit-modules.test.js`); what has never been observed is the rendered page. **CN-013 AC1
closes on S1 + S2 together.**

### 4b. CN-014 — the dev loop, three criteria

⚠️ **`cdp reload --target=viewer` reloaded the EDITOR once** (2026-08-15) and sent it back to the
launcher, losing the open project. **Verify which window reloaded before concluding anything.**

| # | Observation | "works" | "does not" |
|---|---|---|---|
| **D1** (AC1, 2nd clause) | remove a port from `rename-kit` that a **live connection** uses | the connection is **dropped and a diagnostic names it** | silently retained (a wire to a port that no longer exists), or dropped with no notice |
| **D2** (AC2) | add a node to `grow-kit`, one preview reload | it is in the picker, no restart | absent until restart |
| **D3** (AC3) | put a syntax error in `broken-kit` | the error is **reported**, naming the kit | 🔴 **the previous version keeps running and nothing is said — the worst outcome**, because the author then debugs code that is not running |

⚠️ **AC1's first clause is already met and driven (s20):** one write renamed a port *and* added a
node; one reload delivered both (`types.length` 177 → 178, `title.displayName` → `Panel Heading`).
**Do not re-measure it.** The residual — an open property panel not re-rendering until you
re-select — is **D11, deferred by decision**, and is *not* a CN-014 failure.

### 4c. CN-011 — AC2 and AC3

| # | Observation | "works" | "does not" |
|---|---|---|---|
| **T1** (AC2) | a positive pill's `getComputedStyle(el).backgroundColor` in the **default** theme | **`rgb(22, 163, 74)`** (`--green-600`) | `rgb(31, 138, 76)` = the old `#1F8A4C`, i.e. the pre-D8 kit — **you copied the wrong kit, see §2** · `rgba(0, 0, 0, 0)` = the default never reached props |
| **T2** (AC2) | the same pill in the **other** theme | the theme's own value for that token | unchanged ⇒ the token is not theme-aware, which is a finding worth having |
| **T3** (AC2) | change the token's value; do **not** reload | the computed colour follows | it does not ⇒ say so; this is the half s15 never measured |
| **T4** (AC3) | create a variant on a kit node, save, **reload**, read it back | still there | 🔴 **test the READER path** — a spec containing a save cannot catch a variant that writes but never reads |

🔴 **Read the rgb triple, never a screenshot.** `#1F8A4C` and `#16a34a` are both "green" and an
eyeball comparison reports success for either. 🔴 **A React write is invisible in the SAME eval** —
measure T2/T3 in a **second** `eval` call or you will record a false negative.

## 5. Teardown, gates, commit

```bash
npm run dev:stop            # ALWAYS. Three webpack watchers otherwise recompile forever
npm run dev:stop -- --list  # confirm
```

Then re-measure and quote **trees, not commits**:

- `npm run typecheck:editor` · the editor suite · `noodl-viewer-react`
- ⚠️ **`test:ci` still stands where s12 left it** (`2843 / 6 @ 39393`, seed pinned at
  `tests/SpecRunner.html:41-42`). **Re-measure before quoting; never quote a handover's number.**
- 🔴 **NEVER pipe a suite to `tail`** — it destroys the failure list *and* the exit code. Redirect to
  a file.
- 🔴 **`nodegx-node-kit-types` takes ~220 s and its suite MUTATES a fixture**, restoring in a
  `finally`. A 120 s foreground timeout kills it mid-fault and leaves
  `tests/fixtures/kit-logic/index.js` corrupted. ✅ **Run it BACKGROUNDED and `git status` the
  fixtures directory afterwards.**

**Commit with explicit pathspecs, never `git add`** — a sibling's commit sweeps staged files, and a
peer is active in this checkout.

## 6. Instrument traps that will bite these exact drives

- 🔴 **`WarningsModel` reads `0` beside a deliberately bogus node type on the same canvas** — third
  confirmation. A zero from it is **unmeasured, not healthy**. Bites D1 and D3 directly: if you are
  looking for a diagnostic there, prove the instrument fires first.
- 🔴 **`openProjectFromFolder` returns the model but does not move the UI**, and the editor reads
  `recently_opened_project.json` **at launch** — editing it afterwards does nothing. **Open through
  the launcher card.**
- ⚠️ **`window.__req` is absent by default**; rebuild it with
  `window.webpackChunknoodl_editor.push([['probe'], {}, r => { window.__req = r; }])`.
- ⚠️ **This build exposes no `NodeGraphEditor` singleton**, so selecting a node to read the property
  panel may not be possible — s24 recorded the panel **unmeasured** rather than guessing. Do the
  same rather than inventing a reading.
- ⚠️ **`BaseDialog` renders every dialog twice** — filter `:not([class*=MeasuringContainer])`.
  **`ed.selection` does not exist** — it is `ed.selector._selected`.
- ⚠️ **`node.setParameter()` does not re-render the property panel.** s19 nearly filed a false
  finding about working code this way. **Drive the UI.**
- 🔴 **Stale bundles**: if a change appears to have no effect, suspect `index.bundle.js` before
  suspecting the change.
- ⚠️ **Do NOT `pkill -f "electron/dist"`** — it matches every peer's MCP server and reaches zero
  editors. `dev:stop` only touches this checkout.

## 7. The two criteria this stack cannot close — report, do not fudge

**CN-008 AC1** — *"asking the AI for another cashflow row produces a graph using `Cashflow Lane` +
`Money Pill`, not a hand-rolled `Group`"*. Needs a **real model call** through `AuthoringSession`,
i.e. an API key and real spend. The seam is `AiConfigStore.setApiKey(value, provider)` /
`getApiKey(provider)` in `store/AiAssistantStore.ts` — check whether one is already configured
before asking.

🔴 **If there is no key, write "AC1 unmet, no model available" and stop.** Do **not** substitute
*"the handout appears in the prompt"* — CN-008's own AC1 names that as the **mechanism**, and says it
*"would be equally true of a broken feature"*. AC2–AC5 are met and the handout is tested; only the
consequence is open.

⚠️ **The Build composer authors on a one-character prompt and `ed.undo()` does not undo an AI apply**
— any live attempt must be on a `cp -R`.

**CN-007 AC2** — *"following the page from scratch produces a working node in the picker"*, done by
someone who has **not** read this phase, recording where they stall. It cannot be self-graded by
anyone who has. Ask Richard whether to hand it to a fresh agent or to call it out of scope and close
CN-007 on the other four criteria.

## 8. If §0 blocks you — the work that needs no stack

In priority order, none of it requiring the editor:

1. **`parameterEncoding` is `{known: false}` on every overlay node.** `@nodegx/kit-catalog`'s own
   header names **CN-010** as the owner. The last open non-drive item in the phase.
2. **Two findings that want a RULING from Richard, both raised s26:**
   - the semantic token set has `--destructive` (+`-foreground`/`-hover`) but **no `--success`, no
     `--warning`, no `--info`** — so a kit with three status bands reaches into the palette scale for
     two, which is exactly what the cashflow kit does. Fixing it means editing `DefaultTokens.ts`,
     which changes the vocabulary **every** project sees.
   - **`kitDiagnostics` prints outside `validate:project`'s summary**, so an `ERROR` appears above
     `0 error(s)` and does not move the exit code. **D12 just added a fifth code to that surface**,
     so this is now more visible than when it was first recorded.
3. **D11 needs a task number in a later phase** — it is a deferral *with an owner*, not a wontfix.

## 9. What s26 changed, in one table

| | |
|---|---|
| **D10** | `docsUrl` through both published interfaces, the viewer, `@noodl/types`, `defineNode`, the editor export, the kit-catalog overlay, provenance, the panel's "read more", and the scaffold (which now also emits `docs`) |
| **D12** | `kit-unsupported-dynamic-port` — an **error** naming the kit, node, mechanism and the working alternative. 4/4 mutants |
| **D13** | `NormNode` carries `parameters`; `rules/parameterValue` registered; `--info` gates the skip notices. Corpus: errors **8 → 24**, warnings **32 → 413** |
| **D14** | index signature closed; `drift.test.js` names **two** divergences and asserts the exemption list cannot grow. 2/2 mutants |
| **D16** | `Page`'s `title`/`urlPath` suppressed **only**; the narrowness has its own test. 2/2 mutants |
| **CN-009** | ✅ **CLOSED.** AC5 driven — an MCP session discovered a kit node and placed it; the invented-port control is rejected with nothing written |
| **CN-010** | AC4 written into the docs page |
| **CN-007** | the stale AC5 clause rewritten (CN-012 ran and works) + four sections; **AC2 is all that is left** |
| **CN-011** | 🔴 **premise measured FALSE** — AC1 and AC4 were already met; only AC2/AC3 remain |

🔴 **The lesson from s26 most likely to bite you: a check registered in a second pipeline is a
DUPLICATE before it is a feature.** D13 made both pipelines run `checkParameterValues`, so every
finding was reported twice — counts included — and **nothing went red**, because every assertion in
the area asks *"is this reported?"*, which cannot detect *twice*. It was found by **driving**, not by
a suite. **Assert cardinality wherever two producers meet.**
