# Phase 69 — next session (s25)

**Written 2026-08-18, end of session 24.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first.

> ## 🔴 The two things that changed on 2026-08-18, and they change how you work
>
> **1. THE RULING QUEUE IS EMPTY.** Richard cleared all ten in one pass — **D9–D18**. Nothing in
> this phase is blocked on a decision. ⚠️ **But six of them are BUILD INSTRUCTIONS, not permissions**
> — §2 is the list, and skipping it means doing the bundles wrong.
>
> **2. STOP TAKING ONE TASK PER SESSION.** Richard's call: **close tiers 0–5 in bundles, defer tier
> 6.** §3 is the plan. The remaining tier 0–5 work is small and mostly verification; the overhead has
> been the per-session launch/teardown cycle, not the coding.

---

## 1. Where the phase is

| Task | Built | Driven | Left |
|---|---|---|---|
| **CN-001** … **CN-006**, **CN-018**, **CN-019** | ✅ | ✅ | — closed s4–s15 |
| **CN-007** | ✅ s14 | ✅ s15 | **AC2**; 🔴 **AC5 is STALE** — §3 Bundle B |
| **CN-008** | ✅ s16 | ⚠️ | **AC1 needs a live model** — Bundle A |
| **CN-009** | ✅ s17 | ⚠️ | **AC5's consequence needs a live model** — Bundle A |
| **CN-010** | ✅ s18 | ✅ AC1 s19 | **AC4 not started** — Bundle B |
| **CN-011** | 📋 | — | all of it — Bundle B |
| **CN-012** | ✅ **s24** | ✅ s24 | — **all 3 AC met** |
| **CN-013** | 📋 | — | SSR + cloud (✅ **D18** scopes the cloud half) — Bundle A |
| **CN-014** | ✅ AC1's library half s20 | ✅ s20 | **AC1's 2nd clause, AC2, AC3** — Bundle A |
| **CN-006b**, **CN-015** | ✅ | ✅ | — closed s21 / s23 |
| **CN-016**, **CN-017** | 📋 | — | 🔴 **DEFERRED — do not start.** §3 Bundle C |

## 2. 🔴 D9–D18 — read before planning. Six of them are work

Ruled 2026-08-18; reasoning in [RULINGS-OPEN-QUEUE.md](RULINGS-OPEN-QUEUE.md), decisions in
[RULINGS.md](RULINGS.md).

| Ruling | What it obliges |
|---|---|
| **D18** | 🔴 **CN-013's cloud half is IN**, scoped to **pure-JS logic nodes only**. ⚠️ It must **say what it does not cover** rather than hang, and be verified in **preview AND production** — see §4. **Bundle A.** |
| **D10** | A kit gets a separate **`docsUrl`**. Touches `ReactNodeDefinition`, `NodeDefinitionOptions`, the scaffold, CN-006b's panel — and **unblocks CN-007's docs link**. **Bundle B.** |
| **D12** | `channelPort` is **rejected at kit-load with a diagnostic**. Small, self-contained. **Bundle B.** |
| **D13** | `validate:project` **will** check parameter values. 🔴 **REPLACE `cn004.test.ts`'s last block, do not delete it** (CN-002's rule). ⚠️ Expect it to go red on real projects — **that is the point, do not soften it.** |
| **D14** | Close `NodeDefinitionOptions`' index signature. ⚠️ **Update `drift.test.js`' "one deliberate divergence" row to name TWO**, with reasons. **CN-005's surface.** |
| **D16** | Suppress the `Page` parameter-skip `info`. ⚠️ **Narrow to `Page`'s two undeclared fields.** Richard's recorded worry is the effect on **LLM page authoring**, and a wholesale suppression would hide a real parameter error on a page — exactly that effect. |
| **D17** | Gate `typecheck:editor` + `typecheck:mcp` (both **0**, re-measured s24). ⚠️ Do **not** gate `typecheck:runtime` (red at 2) or `core-ui` (44, unmeasured since s23). |
| **D9, D15** | No work. Shadowing stays reported-not-refused; `find_tools` does not name kits. |
| **D11** | ⚠️ **A deferral WITH AN OWNER** — the open-panel refresh goes to a **later phase** by Richard's explicit request. **Not CN-014's scope**, and not a wontfix: it needs a task number there. |

🔴 **Do not re-open a ruled item to "check".** Three were re-litigated across earlier sessions and it
cost time every round.

## 3. The plan: bundles

### 🔴 BUNDLE A — ONE stack, ONE fixture, EVERY remaining drive

**This is the whole speed-up.** These drives currently cost a launch (~90 s compile), a teardown and
a peer-attribution pass **each**. Do them in one stack.

| Drive | What it wants |
|---|---|
| **CN-008 AC1 + CN-009 AC5** | a live model authoring in a project that has a kit — §4 |
| **CN-014 AC1** | rename a port in a kit → panel shows the new name, and the old connection is **dropped with a diagnostic**, not silently retained |
| **CN-014 AC2** | add a node to a kit → appears in the picker, no restart |
| **CN-014 AC3** | a kit with a **syntax error** reports it (CN-015) rather than leaving the previous version silently running. 🔴 **A stale module that still works is the worst outcome** — the author's next twenty minutes test code that is not running |
| **CN-013 SSR** | does a kit node render under SSR? The globals *are* set (`static/ssr/runtime-globals.js`) so it plausibly does — **confirm, don't infer** |
| **CN-013 CLOUD** (✅ D18) | a **pure-JS logic** kit node runs in a cloud function — §4 |

✅ **Build ONE fixture project carrying every case before launching:** a healthy kit, a kit to rename
a port in, a kit to add a node to, a kit to break, and a pure-JS logic kit for the cloud case.
⚠️ **Write every observation down first.** That is what made s24's readings usable, and a bundled
drive is exactly where "it looked fine" gets in.

🔴 **Bundle the drives; do NOT bundle the conclusions.** Eight consecutive sessions have found a
false premise. **Measure everything, then stop and read** before building on any of it.

### BUNDLE B — the build/docs group

- **CN-011** — mostly making an existing capability the default, not building capability. ⚠️ Carries
  **D8's concrete obligation: tokenise the cashflow kit**, which **gates CN-007's worked example** —
  the flagship docs currently plan to cite a kit that teaches the opposite of its own ruling.
  ⚠️ The token vocabulary gap in §6 bites here.
- **CN-007 AC2** — following the page from scratch produces a working node. 🔴 **AC5 is STALE:** it
  says *"do not claim the logic half works — CN-012 has not run."* **CN-012 has run** and it works,
  so the page needs a logic-node section and that clause rewritten. Material:
  [notes/cn-012-measurement.md](notes/cn-012-measurement.md).
- **CN-010 AC4** — not started.
- **D10, D12, D13, D14, D16, D17** — the ruled work from §2 lands here where it is not Bundle A.

### BUNDLE C — 🔴 DEFERRED, do not start

**CN-016, CN-017.** Both **L** — *"a week+"* by this phase's own key — and **CN-017 gates CN-016**
for anything not first-party. CN-016 also sits on P65's audit: **0 of 29 shipped modules have ever
been run**, 3 register zero nodes, **~9 vendor third-party libraries with no licence text**, and
**mapbox-gl v2+ is proprietary**. That is a licensing and fleet-health problem wearing a packaging
problem's clothes. **It wants its own scoping conversation with Richard, not a slot at the end.**

## 4. ⚠️ Read before the two hardest drives

### CN-008 AC1 / CN-009 AC5 — the live model

🔴 **A registered MCP server loads `/Applications/…`, not this checkout.** Driving the live
`nodegx-*` tools grades the **old build**. Spawn the bundle directly over stdio: build to a
**scratch** path with esbuild (never over `packages/noodl-mcp/dist/`, which peers' registered servers
load), pass `--all-tools`, read `inputSchema` from `tools/list` before calling. ✅ s24 used exactly
this route for the kit extractor and it works.

⚠️ **Both criteria are about a *consequence*, and both say so.** CN-008 AC1: the graph the model
produces uses `Cashflow Lane` + `Money Pill` rather than a hand-rolled `Group` — *"the handout
appears in the prompt"* is the mechanism and would be equally true of a broken feature. CN-009 AC5:
an agent **places** a kit node it was not told about.

### CN-013's cloud half — two execution contexts that disagree

🔴 **This is why D18 exists, and it will bite the build.** Cloud functions run in **two different
places**:

- **Editor preview** → `sandbox.isolate.js`, an isolate where **`require` is deliberately stubbed to
  an error** (`"Error, require not supported: "`).
- **Deployed backend** → **in the service process** (`WorkflowRunner`, `@cloud-runtime` statically
  bundled), where `require` would work.

⚠️ **Verify the loader in BOTH.** A result from one is not a result from the other, and a kit that
works in preview and fails deployed (or the reverse) is the failure class this phase keeps fixing.

⚠️ **Scope discipline:** D18 rules in **pure-JS logic nodes**. `manifest.dependencies` is **script
paths/URLs, not npm** (only test fixtures use it; every real module vendors a UMD build inline), and
a deployed backend is **a single prebuilt `cli.js`** with no `npm install` and nowhere for a package
to land. **Do not drift into building the SDK story** — it is out of this phase by ruling.

## 5. ✅ Owed by Richard — nothing

The queue is empty. Obligations the rulings created are in §2, not here — one copy, or they drift.

**Still wanting task numbers, none blocking:** 🔴 **server-side SDK dependencies for cloud functions**
(Stripe/AWS/Anthropic — Richard's actual ask behind D18; **its own task and probably its own phase**,
since it reopens backend packaging, the isolate's `require` and the trust boundary together) ·
**the open-panel refresh** (D11, deferred *by decision* to a later phase) · 🔴 `render-from-disk.js`
answers `/` and `/index.html` and 404s everything else, **including the start page's own `urlPath`** ·
🔴 the `@noodl/mcp` provisioning flake · 🔴 `ViewerConnection.sendRefresh()` dead at both ends ·
**the half-registered kit** (s22) — nothing says *which* node broke it or what survived ·
⚠️ **`kitDiagnostics` prints outside `validate:project`'s summary**, so an `ERROR` appears above
`0 error(s)` and does not move the exit code (pre-existing CN-015 behaviour).

## 6. ⚠️ Carried, unresolved

🔴 **The cashflow kit is OUTSIDE the repo and the copies differ.** `NodeGX test projects/cashflow-command-centre`
— unversioned, covered by no gate. The standing note is about `cn001-kit-drive` and `cn019-drive`
**only**. D5 makes CN-007 depend on this kit staying working and nothing enforces it. **Wants a task
number.** ⚠️ Read it via a `cp -R`; never write to it.

⚠️ **The token vocabulary gap (s14):** the semantic set has `--destructive` but **no `--success` and
no `--warning`**, so a kit with three status bands reaches into the palette scale for two of them.
**Bundle B hits this.**

⚠️ **`NodeLibraryDataNodeType` is not a census of the payload.** s21 added `module`; s23 added
`modulefailures`. `ports`, `dynamicports` and most other fields the viewer sends are still
undeclared, and `BasicNodeType`'s constructor copies **every** field regardless. **A field's absence
from that interface says nothing about whether it arrives** — check the recorded payload.

⚠️ **Instrument traps that cost s24 time and will cost you the same:**
- **`WarningsModel` reads `0` beside a deliberately bogus node type on the same canvas** — third
  confirmation. A zero from it is **unmeasured, not healthy**.
- **`openProjectFromFolder` returns the model but does not move the UI**, and the editor reads
  `recently_opened_project.json` **at launch** — editing it afterwards does nothing. Open through the
  launcher card.
- **`window.__req` is not present by default**; reconstruct with
  `window.webpackChunknoodl_editor.push([['probe'], {}, r => { window.__req = r; }])`.
- **This build exposes no `NodeGraphEditor` singleton**, so selecting a node to read the property
  panel was not possible — s24 recorded the panel as **unmeasured** rather than guessing.

⚠️ Also carried: `CodeFileDocument` renders **two toolbars** (s13) · `find_tools`' `query` matches
tool *names* only while its `describe` says "names and descriptions" (s17/s18) · whether the colour
picker paints a swatch for a `color` port whose value is `var(--token)`.

## 7. Checkout conditions as s24 left them

- ✅ **An editor stack WAS launched and IS stopped.** `dev:debug --quiet` → drive → `dev:stop`
  reported *"Stopped 25 process(es). Nothing left running."* Verified after: **no Electron, lerna or
  webpack from this checkout**, and **47 peer MCP servers survived**. ✅ A `dev:stop --list` dry run
  before launching showed it would kill nothing.
- 🔴 **A PEER STACK WAS LIVE 09:19–~09:29 and a peer jest burst ran at 09:29**, during my headless
  measurements. ✅ **Checked rather than assumed: `noodl.viewer.js` stayed at 08:44:45 throughout**,
  so the Chromium readings used a stable bundle. No broadcast was sent — the stack could not be
  attributed to a named peer by PPID, and it was down before my source edits began.
- ⚠️ **Commits `1e1ab190` (18 files) + three docs commits**, so there was a `test:ci` contamination
  window: `nodegx-kit-catalog`, `nodegx-node-kit-types` (+ a new `kit-logic` fixture), the editor's
  `projectmodules.ts` / `KitsSection.tsx` / two test files, `noodl-mcp`'s `extract.ts` +
  `kitOverlay.test.ts`, and `scripts/devtools/render-from-disk.js`.
- 🔴 **A drive fixture exists OUTSIDE the repo:** `NodeGX test projects/cn012-drive`, a `cp -R` with a
  logic-only `tally-kit`. **No existing fixture was touched.** Its graph carries two nodes the drive
  added (`drive_kit`, `drive_ctl`). ✅ **Reusable as Bundle A's starting point.**
- ⚠️ **`recently_opened_project.json` was edited and restored** (1 entry before, 1 after) — ⚠️ it held
  **1**, not the 46 s23 recorded.
- ✅ **Suites after the change:** `@nodegx/kit-catalog` **63** · `@nodegx/node-kit-types` **76** ·
  `@nodegx/module-inject` **21** · `noodl-mcp` **633 / 53 suites** · editor `test:main`
  **3664 / 240 suites**. `typecheck:editor` **0**, `typecheck:mcp` **0**.
- 🔴 **`test:ci` still stands where s12 left it** (`2843 / 6 @ 39393`); s13–s24's commits are not in
  it. **Re-measure before quoting; never quote a handover's number.** ⚠️ `noodl-runtime` and
  `noodl-viewer-react` were **not** run — neither was touched.
- ⚠️ **Peer work live in the tree, not touched and still uncommitted after my commits:**
  `dev-docs/tasks/phase-50-legibility/notes/`, `dev-docs/tasks/phase-65-the-library/` (untracked),
  `dev-docs/tasks/phase-68-learnbook/README.md`, `scripts/library/check.ts`, and a phase-66 file plus
  `package-lock.json` a peer touched late in the session.
- Whoever you tell you are starting, tell you have stopped.
