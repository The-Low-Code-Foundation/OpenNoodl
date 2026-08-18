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

🔴 **CN-013 is now BLOCKED on a ruling that did not exist yesterday** (§5 item 1). Everything else is
unblocked.

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

## 3. Picking the next build

- **CN-014's remainder** (AC1's 2nd clause, AC2, AC3) — and §5 item 4 belongs to it.
- **CN-011 (kits look like NodeGX)** — untouched, and the token-vocabulary gap in §6 bites it.
- **CN-013 is blocked** — see §5 item 1. Do not start it without the ruling.
- **CN-016 / CN-017** — unchanged.

⚠️ **Confirm rather than inherit — nine sessions running now.** s24's premises largely held, but the
*shape* did not: the handover implied CN-012 would be about making logic nodes work, and they
already worked. The work was one field in a manifest.

## 4. ⚠️ Before attempting CN-008 AC1 / CN-009 AC5

🔴 **A registered MCP server loads `/Applications/…`, not this checkout.** Driving the live
`nodegx-*` tools would grade the **old build**. Spawn the bundle directly over stdio — build to a
*scratch* path with esbuild (never over `packages/noodl-mcp/dist/`, which peers' registered servers
load), pass `--all-tools`, and read `inputSchema` from `tools/list` before calling. ✅ s24 used
exactly this route for the kit extractor and it works.

⚠️ **Both criteria are about a *consequence*.** CN-008 AC1: the graph the model produces uses
`Cashflow Lane` + `Money Pill` rather than a hand-rolled `Group`. CN-009 AC5: an agent **places** a
kit node it was not told about.

## 5. Owed by Richard

1. 🆕 **Should a kit be able to run in the cloud runtime at all?** New from s24, and **it gates
   CN-013.** The runtime already accepts kits — `registerModule` works there and a hand-registered
   kit node answers `200`. What is missing is a loader, and writing one means **executing a kit's
   arbitrary JavaScript inside the backend process**. ✅ **D6 ruled only on locally-authored kits in
   the browser.** **(a)** leave the cloud unsupported, which is what s24 made honest and loud;
   **(b)** load kits server-side for locally-authored projects only; **(c)** load them behind
   CN-017's verify-on-install consent. ⚠️ (b) and (c) both put third-party code next to the database.
2. **Should the runtime refuse a kit that shadows a built-in?** Unchanged from s22. Today the kit
   silently wins at runtime while validation describes the built-in. **(a)** leave it and report
   (what s22 built); **(b)** built-ins win at registration too; **(c)** refuse the kit's node.
   ⚠️ (b) and (c) are behaviour changes and **0 of 29 shipped modules have ever been run** (LBR-004).
3. **What should a kit's `docs` be able to say?** Unchanged from s21. Prose only today; CN-006b's
   spec assumed a URL. **(a)** leave it; **(b)** add `docsUrl`; **(c)** sniff `http`. ⚠️ (c) is a
   guess about intent encoded in a regex.
4. **The open-panel refresh (from s20).** An open property panel does not re-render on
   `libraryUpdated`; it recovers on any re-selection. Fold into CN-014, or leave as a rough edge?
5. **What should `channelPort` do?** Unchanged from s19. **(a)** revive the editor-side manager;
   **(b)** stop the exporter stripping the port; **(c)** reject it at kit-load. ⚠️ **Doing nothing is
   the current state and is the worst of the three.**
6. **Widen the project gate to check parameter values?** `checkParameterValues` has one production
   caller. `cn004.test.ts`'s last block asserts the silence deliberately — **replace it when the call
   is taken, do not delete it.**
7. 🆕 **Close `NodeDefinitionOptions`' index signature?** **CN-005's call, measured by s24.** Doing it
   catches optional top-level typos on a logic node (`displayNodeName`, `docs` are silent today) —
   but it makes a **second** deliberate divergence and turns `drift.test.js`' "the one divergence"
   row red. That row exists to catch exactly this, so it is a decision, not a fix.
8. **Should `project`'s `find_tools` purpose line name kits?** Costs resident tokens.
   `tests/kitTools.test.ts` has the control that fails when it changes.
9. **"Clean" is no longer "an empty diagnostics array" for any page** (s18's AC2). `Page` declares
   neither `title` nor `urlPath` statically, so **96 of 947 measured skips are `Page`**.
10. **The ungated typechecks.** Seven of eleven `typecheck:*` scripts run nowhere and `scripts/` is in
    none. ✅ s24 re-measured two: **`typecheck:editor` 0, `typecheck:mcp` 0**.

Open, not caused here, still wanting task numbers: 🔴 `render-from-disk.js` answers `/` and
`/index.html` and 404s everything else, **including the start page's own `urlPath`** · 🔴 the
`@noodl/mcp` provisioning flake · 🔴 `ViewerConnection.sendRefresh()` dead at both ends · **the
half-registered kit** (s22) · 🆕 ⚠️ **`kitDiagnostics` output prints outside `validate:project`'s
summary**, so an `ERROR` line appears above `0 error(s)` and does not move the exit code —
pre-existing CN-015 behaviour, noticed by s24, not changed.

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
