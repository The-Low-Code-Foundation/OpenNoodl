# Phase 69 — next session (s26). **The closing run.**

**Written 2026-08-18, end of session 25.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first.

> ## 🔴 Richard's instruction, 2026-08-18: **close this phase as fast as possible.**
>
> Tiers 0–5 only. **CN-016 and CN-017 are Bundle C and stay deferred** — they are tier 6, both **L**,
> and they want their own scoping conversation, not a slot at the end.
>
> **CN-013 is CLOSED but for one confirmation drive.** Its cloud half and its SSR half were both
> built in s25. §2 is the order to work in. **§3 is the one thing that will waste your session if
> you skip it.**

---

## 1. What is left — nine items, and nothing is blocked

| Task | Left | Where |
|---|---|---|
| **CN-013** | a rendered SSR page, confirmed | **Step 1** — 20 min, in Bundle A's stack |
| **CN-008** | AC1 — a live model places a kit node | **Step 2 (Bundle A)** |
| **CN-009** | AC5's consequence — same drive | **Step 2 (Bundle A)** |
| **CN-014** | AC1's 2nd clause, AC2, AC3 | **Step 2 (Bundle A)** |
| **CN-011** | all of it, incl. D8's cashflow tokenisation | **Step 3** — 🔴 **gates CN-007** |
| **CN-007** | AC2, and rewrite the stale AC5 | **Step 4** |
| **CN-010** | AC4 | **Step 5** |
| **D10, D12, D13, D14, D16** | the five outstanding rulings | **Step 5** |

✅ **Done and not to be revisited: D17, D18.** **D9, D11, D15** need no work. **CN-001**…**CN-006**,
**CN-006b**, **CN-012**, **CN-015**, **CN-018**, **CN-019** are closed.

## 2. 🔴 The order, and why it is this order

**Step 1 — CN-013's last drive (do it inside Bundle A's stack, not on its own).**
Deploy a project with a kit at `deployRenderingMode: 'ssr'`, serve it, `curl` the HTML, and look for
the kit node's output **in the server response before any JavaScript runs**. ⚠️ **A built-in node in
the same page is the control** — without it, "the kit node is there" cannot be told from "SSR
rendered the whole page fine anyway", and "it is missing" cannot be told from "SSR rendered
nothing". This is now a **confirmation** drive: the seam is already measured on both sides of the
fix. **CN-013 closes on it.**

**Step 2 — BUNDLE A: one stack, one fixture, every remaining drive.** This is the whole speed-up;
the overhead has always been the launch/teardown cycle, not the coding.

| Drive | What it wants |
|---|---|
| **CN-008 AC1 + CN-009 AC5** | a live model authoring in a project with a kit — the graph must use the kit's nodes rather than a hand-rolled `Group`. 🔴 **A registered MCP server loads `/Applications/…`, not this checkout** — build the bundle to a **scratch** esbuild path (never over `packages/noodl-mcp/dist/`, which peers' registered servers load), pass `--all-tools`, read `inputSchema` from `tools/list` before calling |
| **CN-014 AC1** | rename a port in a kit → the panel shows the new name and the old connection is **dropped with a diagnostic**, not silently retained |
| **CN-014 AC2** | add a node to a kit → it appears in the picker, no restart |
| **CN-014 AC3** | a kit with a **syntax error** reports it rather than leaving the previous version silently running. 🔴 **A stale module that still works is the worst outcome** |

✅ **Build ONE fixture before launching:** a healthy kit, a kit to rename a port in, a kit to add a
node to, a kit to break, and a kit for the SSR deploy. ✅ **Start from
`NodeGX test projects/cn012-drive`** — s24's `cp -R`, already carrying `tally-kit`.
⚠️ **Write every observation down first.** A bundled drive is exactly where *"it looked fine"* gets
in. 🔴 **Bundle the drives; do NOT bundle the conclusions** — nine consecutive sessions have found a
false premise. Measure everything, then stop and read.

**Step 3 — CN-011, and it must come before CN-007.** Mostly making an existing capability the
default rather than building capability. ⚠️ It carries **D8's concrete obligation: tokenise the
cashflow kit**, and that **gates CN-007's worked example** — the flagship docs currently plan to
cite a kit that teaches the opposite of its own ruling. ⚠️ **The token vocabulary gap bites here:**
the semantic set has `--destructive` but **no `--success` and no `--warning`**, so a kit with three
status bands reaches into the palette scale for two of them.

**Step 4 — CN-007.** AC2 (following the page from scratch produces a working node) and 🔴 **AC5 is
STALE**: it says *"do not claim the logic half works — CN-012 has not run."* **CN-012 has run and it
works**, so the page needs a logic-node section and that clause rewritten. Material:
[notes/cn-012-measurement.md](notes/cn-012-measurement.md). ⚠️ **D10 lands here too** — a kit's
separate `docsUrl` is what unblocks CN-007's docs link, so do D10 before writing the page, not after.

**Step 5 — CN-010 AC4 and the four remaining rulings.** All small, all independent, no stack needed.
Do **D13 last**: it turns on `validate:project`'s parameter-value check and is **expected to go red
on real projects — that is the point, do not soften it.**

| Ruling | What it obliges |
|---|---|
| **D10** | a kit gets a separate `docsUrl`; touches `ReactNodeDefinition`, `NodeDefinitionOptions`, the scaffold, CN-006b's panel |
| **D12** | `channelPort` **rejected at kit-load with a diagnostic**. Seam: `kitDiagnostics` in `nodegx-kit-catalog/src/health.js`, fed by `toDynamicPorts` (`src/index.js:213`), the one place `channelPort` is recognised. Census stands: **1 occurrence in 177 types, a test fixture's own node** |
| **D14** | close `NodeDefinitionOptions`' index signature. ⚠️ **Update `drift.test.js`' "one deliberate divergence" row to name TWO**, with reasons — do not delete it. **CN-005's surface** |
| **D16** | suppress the `Page` parameter-skip `info` — ⚠️ **narrowed to `Page`'s two undeclared fields**. Richard's recorded worry is the effect on **LLM page authoring**, and a wholesale suppression would hide a real parameter error on a page |
| **D13** | `validate:project` checks parameter values. 🔴 **REPLACE `cn004.test.ts`'s last block, do not delete it** (CN-002's rule) |

## 3. 🔴 Read this before you touch anything. It cost s25 a second commit

**Shipping a capability turns working diagnostics into lies, and every suite stays green.**

s25 built the cloud kit loader. `effectiveKitRuntimes` then reported every cloud-enabled kit as
running **nowhere** and `kit-loads-nowhere` still told authors to *"add browser"* — both correct the
day before, both false the moment the loader landed, **all suites passing**. The function had even
predicted it in a comment (*"the day a cloud loader exists, this function is the one place that has
to learn about it"*) and **that did not fire either. A comment naming its own staleness is not a
gate.**

✅ **So after building anything in Steps 1–5, grep for the sentences that assert its ABSENCE** —
`runs nowhere`, `nothing loads`, `not supported`, `is not available`, `no caller`, `does not`. The
SSR loader in s25 invalidated claims in **twelve** places across four packages, the task files and
memory; all twelve were fixed in the same slice, and none of them would have been caught by a test.

🔴 **The sharpest case was a hand-built TEST FIXTURE.** `health.test.js` built an overlay the
producer **can no longer emit** — it went on passing while grading a state the code cannot reach.
✅ **Re-derive a fixture from its producer, or keep a live counter-example in it.**
✅ **And move a baseline's TITLE with its assertion** — a row named for what it used to assert is how
a suite comes to assert the opposite of what it says. **Replace, never delete** (CN-002's rule).

⚠️ **Before launching a stack: `git status --short` for uncommitted editor source, and `stat` the
mtime of anything that shows up.** s25 could not run Bundle A because a peer had half-finished
editor changes in the tree — a stack would have compiled *their* code and made every observation
unattributable. **A clean-looking `ps` is not a clean tree.**

## 4. What CN-013 left behind — none of it blocking, all of it wanting a number

- 🔴 **A remote `http(s)` kit dependency cannot be loaded server-side.** `manifest.dependencies`
  accepts URLs and there is no synchronous fetch in the SSR loader, so it is **skipped with a
  warning** and a kit relying on one is still missing from the server render. Named, not hidden.
- 🔴 **The deploy-time kit warning.** The editor could name, *before* pushing, a cloud function whose
  graph uses a node type from a kit that has not opted into `cloud` — the node library already
  stamps `module` on every kit node (CN-003). Turns a 504 into a warning in the editor.
- **Server-side SDK dependencies** — Richard's actual ask behind D18. Its own task and probably its
  own phase: it reopens backend packaging, the isolate's `require` and the trust boundary together.
- 🔴 **The cashflow kit is OUTSIDE the repo and the copies differ.**
  `NodeGX test projects/cashflow-command-centre` — unversioned, covered by no gate, and **D5 makes
  CN-007 depend on it staying working.** ⚠️ Read it via a `cp -R`; never write to it.
- **The open-panel refresh** (D11, deferred *by decision* to a later phase — it needs a number there)
  · `render-from-disk.js` answers only `/` and `/index.html` · the `@noodl/mcp` provisioning flake ·
  `ViewerConnection.sendRefresh()` dead at both ends · the half-registered kit (s22) ·
  ⚠️ `kitDiagnostics` prints outside `validate:project`'s summary, so an `ERROR` appears above
  `0 error(s)` and does not move the exit code.

## 5. Instrument traps that will bite these specific drives

- 🔴 **`WarningsModel` reads `0` beside a deliberately bogus node type on the same canvas** — third
  confirmation. A zero from it is **unmeasured, not healthy**.
- 🔴 **`openProjectFromFolder` returns the model but does not move the UI**, and the editor reads
  `recently_opened_project.json` **at launch** — editing it afterwards does nothing. Open through
  the launcher card.
- ⚠️ **`window.__req` is not present by default**; reconstruct with
  `window.webpackChunknoodl_editor.push([['probe'], {}, r => { window.__req = r; }])`.
- ⚠️ **This build exposes no `NodeGraphEditor` singleton**, so selecting a node to read the property
  panel may not be possible — s24 recorded the panel as **unmeasured** rather than guessing.
- ⚠️ **`BaseDialog` renders every dialog twice** — filter `:not([class*=MeasuringContainer])`.
  **`ed.selection` does not exist** — it is `ed.selector._selected`.
- ⚠️ **Opening a project WRITES three files into it.** Drive a `cp -R`, never a real project.

## 6. Checkout conditions as s25 left them

- ✅ **NO editor stack was launched.** The only processes started were two `nodegx-backend` servers
  built to a **scratch** path (ports 8611 / 8612), both confirmed dead. 🔴 **Never build over
  `packages/nodegx-backend/dist/cli.js`** — the editor spawns it and a peer's backend can start
  from it at any moment.
- ⚠️ **A peer worked phase 67 throughout**, committing `179c6432`, `4c23f869`, `3482c1da` between my
  commits. **Same git user, so the author field cannot separate us** — attribute by content and time.
- **My commits:** `c6dcb3a2` (cloud loader) · `112fbb50` (catalog correction + D17) · `fc50f387`
  (docs) · plus the SSR loader slice. 🔴 **A `test:ci` contamination window covers all of them**:
  `noodl-viewer-cloud`, `noodl-viewer-react`, `nodegx-module-inject`, `nodegx-kit-catalog`,
  `nodegx-backend`, `noodl-editor`, `noodl-mcp` and `.github/workflows/pr.yml`.
- ✅ **Suites:** `@noodl/cloud-runtime` **189 / 9** · `nodegx-backend` **1090 / 101** ·
  `@nodegx/module-inject` **21** · `@nodegx/kit-catalog` **66 / 3** · `noodl-mcp` **641 / 54** ·
  `noodl-viewer-react` **921 / 72** · editor `test:main` **3752 / 244**. `typecheck:cloud` **0**,
  `typecheck:editor` **0**, `typecheck:mcp` **0**.
- 🔴 **`test:main` FLAKED once** — first run 3 failed in 2 suites (one was
  `tests-unit/bld-004/reasoningChannel.test.ts:238`), immediate re-run on the same tree **green**.
  ⚠️ **That run was piped to `tail`, which destroyed the failure list AND the exit code** (the pipe's
  last command reports 0). **Redirect a suite to a file; never pipe it.**
- 🔴 **`test:ci` still stands where s12 left it** (`2843 / 6 @ 39393`); s13–s25's commits are not in
  it. **Re-measure before quoting; never quote a handover's number.**
- ⚠️ **Peer work live in the tree, untouched:** `phase-50-legibility/notes/`,
  `phase-65-the-library/` (untracked), `phase-68-learnbook/README.md`, `scripts/library/check.ts`,
  `phase-70-the-course-is-an-app/` (untracked).
- Whoever you tell you are starting, tell you have stopped.
