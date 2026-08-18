# Phase 69 — next session (s27). **Everything left is one stack.**

**Written 2026-08-18, end of session 26.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first.

> ## 🔴 Richard's standing instruction: **close this phase as fast as possible.**
>
> Tiers 0–5 only. **CN-016 and CN-017 are Bundle C and stay deferred.**
>
> ## ✅ s26: ALL FIVE OUTSTANDING RULINGS ARE BUILT. CN-009 IS CLOSED.
>
> **D10, D12, D13, D14, D16** — every ruling in the queue is now code with tests and mutants.
> **CN-009 AC5 is driven and the task is closed.** **CN-010 AC4 is written.**
>
> 🔴 **What is left is now ONE THING: a stack.** Every remaining criterion in this phase is a drive.
> There is no more coding to do first. **§2 is that stack. §3 is why s25 and s26 both refused to
> launch it, and it is the first thing to check.**

---

## 1. What is left — and it is all one session's work if the tree is clean

| Task | Left | Needs |
|---|---|---|
| **CN-013** | AC1's last clause — a **rendered** SSR page | the stack |
| **CN-008** | AC1 — a live model places a kit node | the stack **+ a real API key** |
| **CN-014** | AC1's 2nd clause, AC2, AC3 | the stack |
| **CN-011** | AC2 (both themes, token change without reload), AC3 (variant round-trip, **reader** path) | the stack |
| **CN-007** | AC2 — a fresh reader follows the page | a person/agent who has not read this phase |
| **CN-010** | `parameterEncoding` is still `{known:false}` on every overlay node | no stack; small |

✅ **Closed and not to be revisited:** CN-001…CN-006, CN-006b, **CN-009**, CN-012, CN-015, CN-018,
CN-019, and **every ruling D1–D18**. **D9, D11, D15** need no work; **D11 is a deferral WITH AN
OWNER** and still wants a task number in a later phase.

## 2. 🔴 The stack, and the order to run it in

**Build ONE fixture before launching.** Start from a `cp -R` of `NodeGX test projects/cn012-drive`
(carries `tally-kit`). It needs: a healthy kit · a kit to rename a port in · a kit to add a node to ·
a kit to break · a kit for the SSR deploy. ⚠️ **Write every observation down before launching.** A
bundled drive is exactly where *"it looked fine"* gets in. 🔴 **Bundle the drives; do NOT bundle the
conclusions** — ten consecutive sessions have found a false premise, s26 included (see §4).

| Drive | What it wants |
|---|---|
| **CN-013** | Deploy with `deployRenderingMode: 'ssr'`, serve, `curl`, and find the kit node's output **before any JS runs**. ⚠️ **A built-in node in the same page is the control** — without it, "the kit node is there" cannot be told from "SSR rendered the page fine anyway", and "it is missing" cannot be told from "SSR rendered nothing". **Confirmation, not discovery**: the seam is measured on both sides of the fix |
| **CN-014 AC1** | rename a port in a kit → the panel shows the new name and the old connection is **dropped with a diagnostic**, not silently retained |
| **CN-014 AC2** | add a node to a kit → it appears in the picker, no restart |
| **CN-014 AC3** | a kit with a **syntax error** reports it. 🔴 **A stale module that still works is the worst outcome** |
| **CN-011 AC2** | a `var(--token)` colour resolving in **both** themes, and a token change propagating **without a reload**. ⚠️ s15 read ONE theme. 🔴 **Read the rgb triple, never a screenshot** — `#1F8A4C` and `#16a34a` are both "green" |
| **CN-011 AC3** | create a variant on a kit node, save, reload, still there. 🔴 **Test the READER path** — a spec containing a save cannot catch this |
| **CN-008 AC1** | a live model authoring in a project with a kit — the graph must use the kit's nodes, not a hand-rolled `Group` |

### 🔴 There is no headless deploy path — CN-013 must go through the editor

`deployRenderingMode` is written **only** by `DeployToFolderTab.tsx`, and there is no CLI. The drive
is: launch, open the project, and in the renderer call
`createEditorCompilation(ProjectModel.instance).addProjectBuildScripts().deployToFolder(dir, { environment, runtimeType: 'ssr' })`
— that is exactly what the button does, minus the file dialog. Then `npm install && npm run build &&
npm start` in the output folder per `static/ssr/README.md`.

### ⚠️ CN-008 AC1 is the one criterion that needs something this repo cannot provide

It needs a **real model call** through the editor's `AuthoringSession`, i.e. an API key and real
spend. Everything else in §2 is free. If no key is available, **say AC1 is unmet and why** — do not
substitute "the handout appears in the prompt", which CN-008's own AC1 names as the mechanism that
would be equally true of a broken feature.

## 3. 🔴 CHECK THIS BEFORE ANYTHING ELSE. It cost s25 and s26 their drives.

**A peer has had uncommitted editor source in this shared checkout for two sessions.** At s26's end:

```
 M packages/noodl-editor/src/editor/src/models/community/communitysession.ts
 M .../views/DialogLayer/components/AskAboutNodeDialog/AskAboutNodeDialog.tsx
?? .../models/community/communityorigin.ts        ?? .../models/community/communitysignin.ts
?? packages/noodl-editor/tests-unit/uni-001/
```

Two of those are **new files**. A stack launched over them compiles *their* half-finished feature,
and **every observation becomes unattributable** — which is the whole reason to refuse. ⚠️ `AskAboutNodeDialog`
is AI-assistant-adjacent, so it bears directly on CN-008's drive.

✅ **`git status --short packages/noodl-editor/src` and `stat` the mtimes. A clean `ps` is not a
clean tree.** If it is still dirty, **ask** — silence is not release, and liveness is measurable
while intent is not. This is phase 67 work (NodeGX Community sign-in); its session is the one to ask.

## 4. 🔴 What s26 found, and the two lessons that generalise

### A check registered in a second pipeline is a DUPLICATE before it is a feature

D13 registered `rules/parameterValue`. `validateCandidate` merges the rules report with
`preconditionDiagnostics`, and **both** run `checkParameterValues` — so every parameter finding was
reported **twice**, in the list an agent is shown and in the counts. **Nothing went red**, because
`cn004.test.ts` calls the two pipelines *separately* and the staging tests assert *codes*. Every
assertion in the area is shaped like *"is this reported?"*, and that question cannot detect *twice*.

✅ Deduped on `diagnosticKey`; regression test reddens when reverted. ✅ **It was found by DRIVING**
(CN-009 AC5), not by any suite. **Assert cardinality, not presence, wherever two producers meet.**

### A task's own premise decays, and the handover repeats it

s26's handover carried CN-011 as *"all of it, incl. D8's cashflow tokenisation, and that gates
CN-007"*. Measured: **the kit has 0 live hex and 16 token references**, AC1 was **driven in s15**,
and D8 has not gated CN-007 since. Two of CN-011's four criteria were already met and three
consecutive documents said otherwise. ✅ **Measure the artefact before believing the task file about
it** — `grep`, don't infer. That is the tenth false premise in this phase.

### And the absence sweep found a 13th site

s25 fixed twelve places claiming a kit "runs nowhere" in the cloud. The one it missed was
`nodegx-node-kit-types/src/index.d.ts` — **the file kit authors actually read**, whose header told
them `["cloud"]` "gains nothing". ✅ **After building anything, grep for the sentences asserting its
absence**: `runs nowhere`, `no caller`, `nothing loads`, `does not`, `cannot`, `never`.

## 5. Instrument traps that will bite these specific drives

- 🔴 **`WarningsModel` reads `0` beside a deliberately bogus node type on the same canvas** — third
  confirmation. A zero from it is **unmeasured, not healthy**.
- 🔴 **`openProjectFromFolder` returns the model but does not move the UI**, and the editor reads
  `recently_opened_project.json` **at launch**. Open through the launcher card.
- 🔴 **A React write is invisible in the SAME eval** — measure in a second call or record a false
  negative. Bites CN-011 AC2's theme flip directly.
- ⚠️ **`window.__req` is absent by default**: rebuild with
  `window.webpackChunknoodl_editor.push([['probe'], {}, r => { window.__req = r; }])`.
- ⚠️ **No `NodeGraphEditor` singleton is exposed**, so reading the property panel by selecting a node
  may not be possible — s24 recorded the panel **unmeasured** rather than guessing.
- ⚠️ **`BaseDialog` renders every dialog twice** — filter `:not([class*=MeasuringContainer])`.
  **`ed.selection` does not exist** — it is `ed.selector._selected`.
- ⚠️ **Opening a project WRITES three files into it.** Drive a `cp -R`, never a real project.
- 🔴 **The cashflow kit copies DIFFER.** `cashflow-command-centre` and `cn069-s15-drive` are
  tokenised (0 live hex); `cn001-kit-drive`, `cn019-drive`, `cn015-editor-drive` are **pre-D8 (25
  hex)**. Driving one of the latter measures the old kit and reads as *"the change did not land"*.
- ⚠️ **`cashflow-command-centre` is a legacy monolithic `project.json`** — the MCP server refuses it
  by design, and `validate:project` reads it fine. Know which tool you are pointing at it.

## 6. Checkout conditions as s26 left them

- ✅ **NO editor stack was launched.** The only processes started were short-lived `node` MCP servers
  built to a **scratch** esbuild path, all exited. 🔴 **Never build over
  `packages/noodl-mcp/dist/`** — four peer-registered servers were loading it during this session.
- **My commits:** `c1c0b5b5` (the five rulings + the docs page), plus the CN-009/CN-011 slice.
- ⚠️ **A peer worked phase 67 throughout.** Same git user, so the author field cannot separate us —
  attribute by content and time.
- ✅ **Suites, measured this session:** `@nodegx/node-kit-types` **80 / 4** (on a
  verified-clean fixture — see below) · `@nodegx/kit-catalog` **76 / 3** · `@nodegx/kit-scaffold`
  **67 / 5** · `noodl-runtime` **2520 / 138** · `noodl-viewer-react` **921 / 72** ·
  editor `tests-unit/cn-006b` **35**, `tests-unit/d-13` **8** · `typecheck:editor` **0**.
- 🔴 **`noodl-viewer-react` FLAKED once** — `erg-001-repeater-outcomes` timed out at 5 s while a
  second suite ran concurrently; **14/14 alone**. CPU contention, not a regression.
- 🔴 **`noodl-mcp`'s `projectOwnsBackend.test.ts` failed on `provision_backend`** — the known
  provisioning flake already in the residuals list, not new.
- 🔴 **`test:ci` still stands where s12 left it** (`2843 / 6 @ 39393`). **Re-measure before quoting.**
- 🔴 **A killed jest run LEAVES `tests/fixtures/kit-logic/index.js` FAULTED on disk.**
  `fixtures.test.js` mutates it and restores in a `finally`; the suite takes **~220 s**, so a
  2-minute foreground timeout kills it mid-fault and the next run grades a corrupted fixture.
  ✅ **Run that package's suite BACKGROUNDED**, and `git status` the fixtures directory after.
- ⚠️ **Peer work live in the tree, untouched:** phase 67's editor source (§3), `phase-50-legibility/notes/`,
  `phase-65-the-library/`, `phase-68-learnbook/README.md`, `scripts/library/check.ts`,
  `phase-70-the-course-is-an-app/`.
- Whoever you tell you are starting, tell you have stopped.

## 7. Residuals — none blocking, all wanting a number

- 🔴 **A remote `http(s)` kit dependency cannot be loaded server-side** — no synchronous fetch in the
  SSR loader, so it is skipped with a warning and that kit is missing from the server render.
- 🔴 **The deploy-time kit warning** — the editor could name, *before* pushing, a cloud function
  whose graph uses a node from a kit that has not opted into `cloud`. Turns a 504 into a warning.
- 🔴 **`--success` / `--warning` / `--info` do not exist** in the semantic token set (`--destructive`
  does, with `-foreground` and `-hover`). A kit with three status bands reaches into the palette
  scale for two — which is what the cashflow kit does. **Wants a ruling**: `DefaultTokens.ts` changes
  the vocabulary every project sees.
- **Server-side SDK dependencies** — Richard's actual ask behind D18. Its own phase.
- 🔴 **The cashflow kit is OUTSIDE the repo, unversioned, covered by no gate**, and D5 makes CN-007
  depend on it staying working.
- **`parameterEncoding {known:false}`** (CN-010's) · **the open-panel refresh** (D11, deferred *by
  decision*) · `render-from-disk.js` answers only `/` and `/index.html` · the `@noodl/mcp`
  provisioning flake · `ViewerConnection.sendRefresh()` dead at both ends · the half-registered kit
  (s22) · ⚠️ `kitDiagnostics` prints outside `validate:project`'s summary, so an `ERROR` appears above
  `0 error(s)` and does not move the exit code — **D12 just added a fifth code to that surface**.
