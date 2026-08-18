# Phase 69 — next session

**Written 2026-08-18, session 24.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first. **s24 took CN-012 — the measurement
task — and it is complete on all three acceptance criteria.** §1 is the part worth reading: the
logic half needed nothing built, and the thing that did need building was a manifest field that
promises a runtime nobody wrote a loader for.

---

## 0. Where the phase is

| Task | Built | Driven | Note |
|---|---|---|---|
| **CN-001** … **CN-006**, **CN-018**, **CN-019** | ✅ | ✅ | Closed sessions 4–15 |
| **CN-007** | ✅ s14 | ✅ s15 | AC1/3/4/5 met; **AC2 still not started** |
| **CN-008** | ✅ s16 | ⚠️ **AC1 needs a live model** | §4 |
| **CN-009** | ✅ s17 | ⚠️ **AC5's consequence needs a live model** | §4 |
| **CN-010** | ✅ s18 | ✅ AC1 s19 | **AC4 not started** |
| **CN-014** | ✅ AC1's library half, s20 | ✅ s20 | AC1's 2nd clause + AC2/AC3 open |
| **CN-006b** | ✅ s21 | ✅ s21 | AC1–AC4 all met |
| **CN-015** | ✅ CLI half s22, editor half s23 | ✅ s22 + s23 | All 5 AC met |
| **CN-012** | ✅ **COMPLETE — measured and built s24** | ✅ s24 | **All 3 AC met.** §1 |
| CN-011, CN-013, CN-016, CN-017 | 📋 | — | §3 |

🔴 **The drive debt is unchanged and is still exactly one item: CN-008 AC1 + CN-009 AC5 are one
drive, not two.** Both want a live model authoring in a project that has a kit. ⚠️ **Read §4 first**
— the stale-build trap would make the whole run grade the wrong code.

✅ **NOTHING IS BLOCKED. THE RULING QUEUE IS EMPTY** — Richard cleared all ten on 2026-08-18
(**D9–D18** in [RULINGS.md](RULINGS.md)). **CN-013's cloud half is now ruled IN**, scoped to pure-JS
logic nodes (D18).

🔴 **§3 is now a BUNDLE PLAN, not a menu** — Richard's call on 2026-08-18 is to close tiers 0–5 in
bundles and defer tier 6. Read §3 before choosing anything.

## 1. What CN-012 found, and the three things that outlive it

**The logic half works and needed nothing built.** A kit with `nodes` and no `reactNodes` at all
registers by the same path a built-in does, keeps the author's `category`, places on canvas with its
type resolved, and signals in *and* out — including kit node → kit node. The catalog overlay's only
visual branch is `isVisual = category === 'Visual'` and a logic node takes the false arm cleanly.
Predictions were written before each measurement; the readings are in
[notes/cn-012-measurement.md](notes/cn-012-measurement.md).

🔴 **THE HEADLINE: the cloud runtime is WILLING and there is NO CALLER.** Built the caller — the same
cloud function **times out** with a kit node, answers `200` with a built-in `Counter`, and answers
`200` again the moment `runtime.registerModule` is called by hand. `CloudRunner`'s constructor calls
`registerNodes` and nothing else, and `load(exportData, projectSettings)` **has no parameter a module
could arrive through**. ⚠️ The failure is a **hang, not an error** — CWF-018's second confirmed
instance, and without CWF-018's timeout the socket would be held.

🔴 **`runtimes: ["cloud"]` makes a kit run NOWHERE, and it was reported to the AI as fact.**
`buildInjectionTags` filters on `browser`, so the field's only positive value **removes the kit from
the one runtime that would have run it** — measured, with every node missing and the author told
nothing. And the overlay copied the manifest verbatim into `availableIn`, which for a built-in means
`runtimeTypes`, i.e. plain fact. ✅ **Census first, because the blast radius depended on it: not one
of the 40 manifests in this repo declares `runtimes`**, and the scaffold writes none — the field is
entirely aspirational, so settling it broke nothing.

🔴 **`runOnValueChange` declares the PORT and wires NOTHING — my own first kit got it wrong.** The
governed input's `set` must ask `this.shouldRunOnValueChange(name)`. Omitting it is silent and reads
as a runtime bug: the output keeps the confident `0` `connectInput` pushed at boot, which is
constraint 4 in `run-on-value-change.ts`' own header. **The published types did not declare
`shouldRunOnValueChange` at all**, so an author following them could not find it. Now declared.

⚠️ **A contrast worth carrying: a logic kit node gets NO runtime base set.** Where CN-008's base set
takes `demo.kit.Badge` from 12 in / 9 out down to the 8 and 1 its author declared, a logic node's
ports are exactly what the author wrote plus any `runOnChange-` checkbox they asked for.

⚠️ **Where the new diagnostic had to be keyed, and why the obvious place is wrong.** A kit no runtime
loads **registers no nodes**, so `kit-loads-nowhere` keyed on node entries would be blind in exactly
the case it exists for. An earlier cut fed the fact in as a synthetic node row and thereby made
`registeredSomething` believe the kit had registered something, silently disabling
`kit-registered-nothing` for it. Keyed on the kit, with a test for the pairing.

## 2. ⚠️ Things s24 did NOT do

- **The property panel's rendering** of a logic kit node's ports is **unmeasured** — nothing was
  selected, and this build exposes no `NodeGraphEditor` singleton to select through. The model-level
  reading (which determines what the panel *can* show) is measured and correct.
- ⚠️ **`WarningsModel` read `0` beside a deliberately bogus node type on the same canvas — third
  confirmation of the recorded trap.** Whether the editor warns about anything here is **unmeasured,
  not silent**. Do not read a zero from it as health.
- **CN-007's docs page has no logic-node section.** The material is the measurement note.
- ⚠️ **A ninth mutation could not fail** and the guard it targeted was **deleted** rather than
  re-tested — a `Map` already deduped by kit, so a `!has` check was unkillable by construction.

## 3. 🔴 THE PLAN CHANGED: bundle, and close tier 0–5

**Richard's call, 2026-08-18: close tiers 0–5 and defer tier 6.** Stop picking one task per session.

⚠️ **Why tier 6 is deferred, so nobody re-opens it by accident:** CN-016 and CN-017 are both **L**,
which this phase's own key defines as *"a week+"*, and **CN-017 gates CN-016** for anything not
first-party. CN-016 also sits on P65's audit — **0 of 29 shipped modules have ever been run**, 3
register zero nodes, ~9 vendor third-party libraries with **no licence text**, and **mapbox-gl v2+ is
proprietary**. That is a licensing and fleet-health problem wearing a packaging problem's clothes,
and it wants its own scoping conversation, not a slot at the end of this phase.

### 🔴 BUNDLE A — ONE stack, ONE fixture, EVERY remaining drive

**This is the whole speed-up.** Four separate drives currently cost four launches (~90 s compile
each), four teardowns and four peer-attribution passes. Do them in one stack.

| Drive | Wants |
|---|---|
| **CN-008 AC1 + CN-009 AC5** | a live model authoring in a project that has a kit — §4 |
| **CN-014 AC1** | rename a port in a kit → panel shows the new name; the old connection is **dropped with a diagnostic**, not silently retained |
| **CN-014 AC2** | add a node to a kit → appears in the picker with no restart |
| **CN-014 AC3** | a kit with a **syntax error** reports it (CN-015) rather than leaving the previous version silently running |
| **CN-013 (SSR)** | does a kit node render under SSR? The globals are set (`static/ssr/runtime-globals.js`), so it plausibly does — **confirm, don't infer** |
| **CN-013 (CLOUD — new, ✅ D18)** | a **pure-JS logic** kit node runs in a cloud function. 🔴 **Verify in the editor's preview AND in the deployed path** — the isolate stubs `require` to an error, the service process does not, and D18 exists because they disagree |

✅ **Build ONE fixture project carrying every case before launching**, with a healthy kit, a kit to
rename a port in, a kit to add a node to, and a kit to break. ⚠️ **Write every observation down
first** — that is what made s24's readings usable, and a bundled drive is exactly where "it looked
fine" creeps in.

🔴 **Bundle the drives; do NOT bundle the conclusions.** Eight consecutive sessions have found a
false premise. Measure all five, **then stop and read** before building anything on top.

### BUNDLE B — the build/docs group, one surface, one suite run

- **CN-011** — mostly making the existing capability the default, not building capability. ⚠️ It
  carries **D8's concrete obligation: tokenise the cashflow kit**, which **gates CN-007's worked
  example** — the phase's flagship docs currently plan to cite a kit that teaches the opposite of
  its own ruling. ⚠️ The token vocabulary gap in §6 bites here.
- **CN-007 AC2** — following the page from scratch produces a working node. 🔴 **AC5 is now STALE:**
  it says *"do not claim the logic half works — CN-012 has not run"*. **CN-012 has run** (s24) and
  the logic half works, so the page must gain a logic-node section and that clause must be rewritten.
  The material is [notes/cn-012-measurement.md](notes/cn-012-measurement.md).
- **CN-010 AC4** — not started.

### BUNDLE C — deferred

**CN-016, CN-017.** Not this phase's remaining sessions. See above.

## 3b. ✅ The queue is EMPTY — and D9–D18 created work. Read this before planning

**All ten ruled 2026-08-18** ([RULINGS.md](RULINGS.md) D9–D18; the reasoning is in
[RULINGS-OPEN-QUEUE.md](RULINGS-OPEN-QUEUE.md)). ⚠️ **Six of them are BUILD instructions, not just
permissions** — fold them into the bundles rather than treating the queue as closed admin:

| Ruling | What it obliges, and where it goes |
|---|---|
| **D18** | 🔴 **CN-013's cloud half is IN** — build the loader for **pure-JS logic nodes only**. ⚠️ It must **say what it does not cover** rather than hang, and be **verified in preview AND production**: the editor's isolate stubs `require` to an error, the deployed backend runs in-process where it works. **Bundle A gains a case.** |
| **D10** | A kit gets a separate **`docsUrl`** — touches `ReactNodeDefinition`, `NodeDefinitionOptions`, the scaffold and CN-006b's panel. ⚠️ It also **unblocks CN-007's docs link**. **Bundle B.** |
| **D12** | `channelPort` is **rejected at kit-load with a diagnostic**. Small, self-contained. **Bundle B.** |
| **D13** | `validate:project` **will** check parameter values. 🔴 **REPLACE `cn004.test.ts`'s last block, do not delete it.** Expect it to go red on real projects — that is the point. |
| **D14** | Close `NodeDefinitionOptions`' index signature. ⚠️ **Update `drift.test.js`' "one deliberate divergence" row to name TWO**, with reasons. **CN-005's surface.** |
| **D16** | Suppress the `Page` parameter-skip `info`. ⚠️ **Narrow to `Page`'s two undeclared fields** — Richard's recorded worry is the effect on LLM page authoring, and a wholesale suppression would hide a real parameter error on a page, which is exactly that effect. |
| **D17** | Gate `typecheck:editor` + `typecheck:mcp` (both **0**). ⚠️ Do **not** gate `typecheck:runtime` (red at 2) or `core-ui` (44, unmeasured since s23) — raise those separately. |
| **D9, D15** | No work: shadowing stays reported-not-refused; `find_tools` does not name kits. |
| **D11** | ⚠️ **A deferral WITH AN OWNER, not a wontfix** — Richard asked that the open-panel refresh be fixed in a **later phase**. It needs a task number there. **Not CN-014's scope.** |

## 4. ⚠️ Before attempting CN-008 AC1 / CN-009 AC5

🔴 **A registered MCP server loads `/Applications/…`, not this checkout.** Driving the live
`nodegx-*` tools would grade the **old build**. Spawn the bundle directly over stdio — build to a
*scratch* path with esbuild (never over `packages/noodl-mcp/dist/`, which peers' registered servers
load), pass `--all-tools`, and read `inputSchema` from `tools/list` before calling. ✅ s24 used
exactly this route for the kit extractor and it works.

⚠️ **Both criteria are about a *consequence*.** CN-008 AC1: the graph the model produces uses
`Cashflow Lane` + `Money Pill` rather than a hand-rolled `Group`. CN-009 AC5: an agent **places** a
kit node it was not told about.

## 5. ✅ Owed by Richard — NOTHING. The queue is empty

**All ten ruled 2026-08-18 as D9–D18.** The obligations they created are in **§3b**, not here — one
copy, or they drift. 🔴 **Do not re-open a ruled item to "check"** — three of them were re-litigated
across earlier sessions and it cost time each round.

⚠️ **One thing to put back to him eventually, but not as a blocker:** the SDK story behind D18
(below) is the feature he actually asked for, and it is out of this phase deliberately.

Open, not caused here, still wanting task numbers: 🔴 `render-from-disk.js` answers `/` and
`/index.html` and 404s everything else, **including the start page's own `urlPath`** · 🔴 the
`@noodl/mcp` provisioning flake · 🔴 `ViewerConnection.sendRefresh()` dead at both ends · **the
half-registered kit** (s22) · 🆕 ⚠️ **`kitDiagnostics` output prints outside `validate:project`'s
summary**, so an `ERROR` line appears above `0 error(s)` and does not move the exit code —
pre-existing CN-015 behaviour, noticed by s24, not changed · 🆕 🔴 **SERVER-SIDE SDK DEPENDENCIES
for cloud functions** (Stripe/AWS/Anthropic — Richard's actual ask behind D18). **Wants its own task
and probably its own phase**: it reopens the deployed backend's single-prebuilt-`cli.js` packaging,
the preview isolate's stubbed `require`, and the trust boundary together · 🆕 **the open-panel
refresh (D11)** — deferred to a later phase *by decision*, so it needs a number there.

## 6. ⚠️ Carried, unresolved

🔴 **The cashflow kit is OUTSIDE the repo and the copies differ.** It lives in
`NodeGX test projects/cashflow-command-centre` — unversioned, covered by no gate. The standing note
is about `cn001-kit-drive` and `cn019-drive` **only**. D5 makes CN-007 depend on this kit staying
working and nothing enforces it. **Still wants a task number.** ⚠️ Read it via a `cp -R`; never write.

⚠️ **The token vocabulary gap (s14):** the semantic set has `--destructive` but **no `--success` and
no `--warning`**, so any kit with three status bands reaches into the palette scale for two of them.

⚠️ **`NodeLibraryDataNodeType` is not a census of the payload.** s21 added `module`; s23 added
`modulefailures`. `ports`, `dynamicports` and most other fields the viewer sends are still
undeclared, and `BasicNodeType`'s constructor copies **every** field regardless. **A field's absence
from that interface says nothing about whether it arrives.**

⚠️ Also carried: `CodeFileDocument` renders **two toolbars** (s13) · `find_tools`' `query` matches
tool *names* only while its `describe` says "names and descriptions" (s17/s18) · whether the colour
picker paints a swatch for a `color` port whose value is `var(--token)`.

## 7. Checkout conditions

- ✅ **An editor stack WAS launched and IS stopped.** `npm run dev:debug --quiet` → drive →
  `npm run dev:stop` reported *"Stopped 25 process(es). Nothing left running."* Verified after: **no
  Electron, lerna or webpack from this checkout**, and **47 peer MCP servers survived**, as designed.
  ✅ A `dev:stop --list` dry run before launching showed it would kill nothing.
- 🔴 **A PEER STACK WAS LIVE 09:19–~09:29 and a peer jest burst ran at 09:29**, while my headless
  measurements were running. ✅ **Checked rather than assumed: `noodl.viewer.js` stayed at 08:44:45
  throughout**, so the Chromium readings used a stable bundle. **No broadcast was sent** — the stack
  could not be attributed to a named peer by PPID, and it was down before my own source edits began.
- ⚠️ **Eighteen files committed** (`1e1ab190`), so there was a `test:ci` contamination window:
  `nodegx-kit-catalog` src+tests, `nodegx-node-kit-types` src+tests+a new `kit-logic` fixture, the
  editor's `projectmodules.ts` / `KitsSection.tsx` / two test files, `noodl-mcp`'s `extract.ts` +
  `kitOverlay.test.ts`, and `scripts/devtools/render-from-disk.js`.
- 🔴 **A drive fixture was created OUTSIDE the repo:** `NodeGX test projects/cn012-drive`, a `cp -R`
  of a scratchpad project with a logic-only `tally-kit`. **No existing fixture was touched.** Its
  graph carries two nodes the drive added (`drive_kit`, `drive_ctl`).
- ⚠️ **`recently_opened_project.json` was edited and restored** (1 entry before, 1 after). ⚠️ It had
  **1** entry, not the 46 s23 recorded — either a peer cleared it or s23's count was of something
  else. ⚠️ **The edit did nothing**: the editor reads the store at launch, and mine came after, so
  the project was opened through the launcher card instead.
- ✅ **Suites after the change:** `@nodegx/kit-catalog` **63**, `@nodegx/node-kit-types` **76**,
  `@nodegx/module-inject` **21**, `noodl-mcp` **633 / 53 suites**, editor `test:main`
  **3664 / 240 suites**. `typecheck:editor` **0**, `typecheck:mcp` **0**.
- 🔴 **`test:ci` still stands where s12 left it** (`2843 / 6 @ 39393`); s13–s24's commits are not in
  it. **Re-measure before quoting.** ⚠️ `noodl-runtime` and `noodl-viewer-react` were **not** run —
  neither was touched.
- ⚠️ **Peer work live in the tree and not touched**: `dev-docs/tasks/phase-50-legibility/notes/`,
  `dev-docs/tasks/phase-65-the-library/` (untracked), `dev-docs/tasks/phase-68-learnbook/README.md`,
  `scripts/library/check.ts`. **Confirmed still uncommitted after my commit.**
- Whoever you tell you are starting, tell you have stopped.
