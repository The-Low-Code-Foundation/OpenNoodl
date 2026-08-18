# Phase 69 — next session

**Written 2026-08-18, session 23.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first. **s23 built CN-015's editor half and
drove it** — the task is now complete on all five acceptance criteria. §1 is the part worth reading:
the fact the editor needed did not exist anywhere downstream, and one line of the fix (`capture:
true`) turns out to carry a whole failure mode on its own.

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
| **CN-015** | ✅ **COMPLETE — CLI half s22, editor half s23** | ✅ s22 + s23 | **All 5 AC met.** §1 |
| CN-011, CN-012, CN-013, CN-016, CN-017 | 📋 | — | §3 |

🔴 **The drive debt is unchanged and is still exactly one item: CN-008 AC1 + CN-009 AC5 are one
drive, not two.** Both want a live model authoring in a project that has a kit. ⚠️ **Read §4 first**
— there is a stale-build trap that would make the whole run grade the wrong code.

**Nothing is blocked.** The rulings owed (§5) are unchanged from s22 — none of them gate a build.

## 1. What CN-015's editor half cost, and the three things that outlive it

**The problem was not rendering. It was that the fact no longer existed.** A kit whose `index.js`
throws never calls `Noodl.defineModule`, so `registerModule` is never called, nothing lands in the
node register, and **no later inspection of any process can tell that kit from one nobody
installed.** The editor reads what a viewer sent (✅ D3), and a kit that threw is simply absent from
that payload. So the fact has to be caught in the page, while the scripts are running, and CN-003's
`__noodl_module_name` marker is what makes it attributable.

Measured in real Chromium (Electron 24) against `@nodegx/module-inject`'s **own output**, not a
hand-written page — a `throw` at import, a syntax error, and an `index.js` that 404s, each named
correctly, with a healthy kit in the same project reporting nothing.

🔴 **`capture: true` on the listener carries an entire failure mode, and the A/B proves it.** A
resource error does not bubble. Run the same fixture in bubble phase and the 404 case disappears —
**and only that case.** A kit whose `main` is missing would otherwise have gone on being exactly the
silent failure the task exists to end. ⚠️ **A one-word option is not a style choice here**; the two
phases differ by one whole class of failure and nothing but an A/B would have said so.

⚠️ **The attribution window is bounded by a SECOND flag, not by clearing `__noodl_module_name`.**
Both bound it. Clearing would *also* have broken CN-003 for a kit that defers its `defineModule`
into a callback — the case that mechanism's own comment calls out. And with no bound at all, the
**last** kit is blamed for every runtime error the app throws for the rest of the session.

🔴 **The failures are held per client and are NOT merged into `currentNodeLibrary`.** `mergeUpdates`
walks `nodetypes` **and nothing else**, so a top-level field arriving on a *second* import is
silently ignored: the list would have frozen at the first client's report and gone on accusing a kit
the author had already fixed. **Driven live** — one kit repaired and one left broken in the same
project, same run: the repaired kit showed its node, the other stayed named.

⚠️ **Scope, said out loud rather than left to be found:** a kit's own `main`, not its dependencies.
Dependency tags are deduped across kits and carry no marker, so a failing dependency has no one kit
to name. It stays uncaptured rather than attributed to a guess.

⚠️ **`expected-inject.snapshot.txt` was re-recorded deliberately**, which its own header demands be
said. It was confirmed matching **on committed code** first, so the red was provably this change and
not something inherited; the diff is exactly the preamble and the epilogue. Behaviour that moved:
the injected page now opens and closes a kit-load capture window around the module scripts.

**Tests:** module-inject 15 → 21, runtime +5, editor `tests-unit/cn-015` +7. **6/6 mutations killed**
plus the Chromium capture-phase A/B.

## 2. ⚠️ One thing s23 did NOT do

**The `partial` (half-registered) wording is not reachable from the editor path yet.** `kitDiagnostics`
computes it from which nodes registered, and the editor passes its kit nodes in, so the machinery is
wired — but s22's half-registered case needs a kit that registers *then* throws, and the drive
fixture's broken kits both failed before registering anything. **The branch is covered by the
package's own tests, not by a live editor observation.** Saying "driven" of it would be a claim the
run does not support.

## 3. Picking the next build

- **CN-012 (logic nodes)** — `module.nodes` via `defineNode` is the non-visual half and is still
  untested here. ⚠️ **s22 found `defineNode` is a live registration path a census had to be taught
  about**, so it is not hypothetical. **Build the caller before specifying anything.**
- **CN-014's remainder** (AC1's 2nd clause, AC2, AC3) — and §5 item 3 belongs to it.
- **CN-011 / CN-013 / CN-016 / CN-017** — unchanged.

⚠️ **Confirm rather than inherit — eight sessions running now.** s22's spec was wrong about collision
precedence, wrong that AC2 needed building, and cited a list that does not exist. s23's own premise
(*"the editor cannot tell a thrown kit from an absent one"*) held up, but the **mechanism** the
handover implied — that this was mostly rendering work — did not: the transport did not exist.

## 4. ⚠️ Before attempting CN-008 AC1 / CN-009 AC5

🔴 **A registered MCP server loads `/Applications/…`, not this checkout.** Driving the live
`nodegx-*` tools would grade the **old build**, so s18's and s17's work would not be under test at
all. The recorded route is to **spawn the bundle directly over stdio** — build to a *scratch* path
with esbuild (never over `packages/noodl-mcp/dist/`, which is what peers' registered servers load),
pass `--all-tools`, and read `inputSchema` from `tools/list` before calling.

⚠️ **Both criteria are about a *consequence*, and both say so.** CN-008 AC1: the graph the model
produces uses `Cashflow Lane` + `Money Pill` rather than a hand-rolled `Group` — *"the handout
appears in the prompt" is the mechanism and would be equally true of a broken feature*. CN-009 AC5:
an agent **places** a kit node it was not told about.

## 5. Owed by Richard

1. **Should the runtime refuse a kit that shadows a built-in?** Unchanged from s22. Today the kit
   silently wins at runtime while validation describes the built-in. **(a)** leave it and report,
   which is what s22 built; **(b)** make built-ins win at registration too, so the layers agree;
   **(c)** refuse the kit's node and error at load. ⚠️ (b) and (c) are behaviour changes — an existing
   module may override deliberately, and **0 of 29 shipped modules have ever been run** (LBR-004), so
   the blast radius is genuinely unknown. (a) is the current state and is at least now honest.
2. **What should a kit's `docs` be able to say?** Unchanged from s21. Today prose only; CN-006b's
   spec assumed a URL and a kit author cannot express one. **(a)** leave it prose-only; **(b)** add a
   separate `docsUrl`; **(c)** sniff `http` and render a link. ⚠️ (c) is cheap and is **a guess about
   the author's intent encoded in a regex**.
3. **The open-panel refresh (from s20).** An open property panel does not re-render on
   `libraryUpdated`; it recovers on any re-selection. Fold into CN-014's remaining scope, or leave
   as a known rough edge?
4. **What should `channelPort` do?** Unchanged from s19. **(a)** revive the editor-side manager;
   **(b)** have the exporter stop stripping the port; **(c)** reject it at kit-load with a
   diagnostic. ⚠️ **Doing nothing is the current state and it is the worst of the three.**
5. **Widen the project gate to check parameter values?** `checkParameterValues` has one production
   caller, so `validate:project` / `validate_project` check parameter values for **no node of any
   provenance**. `cn004.test.ts`'s last block asserts the silence deliberately — **replace it when
   the call is taken, do not delete it.**
6. **The ungated typechecks.** Seven of eleven `typecheck:*` scripts run nowhere and `scripts/` is in
   none. ✅ **s23 re-measured two of them on its own changed surfaces:** `typecheck:editor` is
   **0 errors**, `typecheck:runtime` is **red at 2** — both pre-existing `TS2451` redeclarations in
   `test/editorconnection.*`, unrelated to this work. ⚠️ `typecheck:core-ui`'s reported 44 `TS2307`s
   were **not** re-measured.
7. **Should `project`'s `find_tools` purpose line name kits?** Costs resident tokens.
   `tests/kitTools.test.ts` has the control that fails when it changes. Narrowed by s17, unanswered.
8. **"Clean" is no longer "an empty diagnostics array" for any page** (s18's AC2). `Page` declares
   neither `title` nor `urlPath` statically, so **96 of 947 measured skips are `Page`**.

Open, not caused here, still wanting task numbers: 🔴 `render-from-disk.js` answers `/` and
`/index.html` and 404s everything else, **including the start page's own `urlPath`** · 🔴 the
`@noodl/mcp` provisioning flake · 🔴 `ViewerConnection.sendRefresh()` dead at both ends · **the
half-registered kit** (s22) — a kit truncated mid-module is reported as a load failure but **nothing
says which node broke it**, and nothing lists what did survive.

## 6. ⚠️ Carried, unresolved

🔴 **The cashflow kit is OUTSIDE the repo and the copies differ.** It lives in
`NodeGX test projects/cashflow-command-centre` — unversioned, covered by no gate. ⚠️ s20's handover
said `cn069-s15-drive` carries the pre-D8 kit; **it does not** (s21 checked). The standing note is
about `cn001-kit-drive` and `cn019-drive` **only**. D5 makes CN-007 depend on this kit staying
working and nothing enforces it. **Still wants a task number.** ⚠️ Read it via a `cp -R` into a
scratchpad; never write to it.

⚠️ **The token vocabulary gap (s14):** the semantic set has `--destructive` but **no `--success` and
no `--warning`**, so any kit with three status bands reaches into the palette scale for two of them.

⚠️ **`NodeLibraryDataNodeType` is not a census of the payload.** s21 added `module`; s23 added the
top-level `modulefailures`. `ports`, `dynamicports` and most other fields the viewer sends are still
undeclared, and `BasicNodeType`'s constructor copies **every** field regardless. **A field's absence
from that interface says nothing about whether it arrives** — check the recorded payload, not the
type.

⚠️ Also carried: `CodeFileDocument` renders **two toolbars** (s13) · `find_tools`' `query` matches
tool *names* only while its `describe` says "names and descriptions" (s17/s18) · whether the colour
picker paints a swatch for a `color` port whose value is `var(--token)`.

## 7. Checkout conditions

- ✅ **An editor stack WAS launched and IS stopped.** `npm run dev:debug` → drive → `npm run dev:stop`
  reported *"Stopped 26 process(es). Nothing left running."* Verified after: **no Electron process
  from this checkout except peers' MCP servers**, which survived (the `NEVER_SWEEP` shield naming
  `noodl-mcp.cjs` held, as designed). ✅ **A dry-run sweep before launching showed it would kill
  nothing** — that was checked rather than assumed, because 20+ peer MCP servers match the same
  binary path.
- ⚠️ **Eight repo source/test files were edited and committed**, so there was a `test:ci`
  contamination window: `@nodegx/module-inject`'s `index.js` + its tests, `noodl-runtime.ts` + a new
  `test/modulefailures.test.ts`, `viewer.jsx`, the editor's `NodeLibraryData.ts` /
  `NodeLibraryImporter.ts` / `KitsSection.tsx` + new `tests-unit/cn-015/`, and the re-recorded
  `expected-inject.snapshot.txt`. **No broadcast was sent** — 21 peer sessions were listed, all but
  two started 1–3 days ago, matching s22's picture; none was running a gate.
- 🔴 **A drive fixture was created OUTSIDE the repo:** `NodeGX test projects/cn015-editor-drive`, a
  `cp -R` of `cn001-kit-drive` with two deliberately faulty kits added (`broken-kit`, `gone-kit`).
  **`cn001-kit-drive` itself was not touched.** The copy's `broken-kit` was repaired mid-drive as
  part of the measurement, so it now holds one healthy and one still-broken kit.
- ⚠️ **Richard's real `recently_opened_project.json` was edited to open the fixture and then
  restored** (46 → 45 entries, the original count). It is the launcher's own store; there is no other
  way to open a project path headlessly.
- ✅ **Suites run green after the change**: `@nodegx/module-inject` **21**, `@nodegx/kit-catalog`
  **55**, `noodl-viewer-react` **910**, `noodl-runtime` **2520 passed / 13 skipped**, editor
  `test:main` **3637**. `typecheck:editor` **0**; `typecheck:runtime` red at **2, pre-existing**.
- 🔴 **`test:ci` still stands where s12 left it** (`2843 / 6 @ 39393`); s13–s23's commits are not in
  it. **Re-measure before quoting.** ⚠️ **`noodl-mcp`'s suite was deliberately NOT run** — unchanged
  by this work, and a peer committed in that package during s22.
- ⚠️ **Peer work live in the tree and not touched**: `dev-docs/tasks/phase-50-legibility/notes/`,
  `dev-docs/tasks/phase-65-the-library/` (untracked), `dev-docs/tasks/phase-68-learnbook/README.md`,
  `scripts/library/check.ts`.
- Whoever you tell you are starting, tell you have stopped.
