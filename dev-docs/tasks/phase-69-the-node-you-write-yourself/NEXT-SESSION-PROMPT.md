# Phase 69 — next session

**Written 2026-08-18, session 22.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first. **s22 built CN-015's headless/CLI
half** (`3ec68b32`). The build is modest; §1 is the part worth reading, because the task's
collision premise was **backwards**, one of its acceptance criteria needed **no code at all**, and
finding that out cost a probe that measured the wrong layer.

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
| **CN-015** | ✅ **CLI/headless half, s22** | ✅ **s22** | **AC2–AC5 met; AC1 editor half OPEN.** §1, §2 |
| CN-011, CN-012, CN-013, CN-016, CN-017 | 📋 | — | §3 |

🔴 **The drive debt is unchanged and is still exactly one item: CN-008 AC1 + CN-009 AC5 are one
drive, not two.** Both want a live model authoring in a project that has a kit. ⚠️ **Read §4 first**
— there is a stale-build trap that would make the whole run grade the wrong code.

**One new decision is owed** (§5, item 1). Nothing else is blocked.

## 1. 🔴 The finding that outlives CN-015: precedence is two rules that disagree

**The catalog gives the built-in priority. The runtime gives the KIT priority.**

`catalogNodesFromNodeLibrary` drops a kit node whose name collides and records a `collision`, so
every check in the editor goes on describing the shipped type. But `NodeRegister.register` is an
unguarded assignment (`this._constructors[name] = nodeDefinition`) and `viewer.jsx` registers
built-ins **before** module nodes on both its paths — so the last writer, the kit, is what
`createNode` returns. **Measured**, with a probe that asserted the *built-in* so its failure message
would print the truth:

```
AFTER KIT REGISTER, metadata.tag = KIT
createNode returns tag = KIT
```

**The consequence is the worst of both halves: validation checks the built-in's ports while the
runtime runs the kit's code.** A project can pass its own gate and behave differently.

🔴 **And the shipped message said the opposite** — *"The built-in wins; the kit's node is not
available."* Anyone who trusted that sentence debugged the wrong node. Corrected in
`validate-project.ts`, and the same half-truth corrected in `responses.ts` and `extract.ts`; a
regression test forbids the old wording drifting back.

⚠️ **Making the runtime agree is a ruling, not a tidy-up** — see §5 item 1.

## 2. What else CN-015 cost, and the two lessons

**AC2 needed no code, and a probe told me otherwise.** The spec is right that
`createNodeFromReactComponent` has no `name` guard, and a probe calling `NodeRegister.register`
**directly** did register a nameless definition under the literal key `'undefined'`.
🔴 **That probe skipped a layer.** A kit always goes `registerModule` → `registerNode` →
`NodeDefinition.defineNode`, which **throws `'Node must have a name'`**
(`nodedefinition.ts:252-254`). The diagnostic was written and then **deleted** when a real fixture
proved it could never fire — this task's own trap list forbids a guard nobody has seen fail.

⚠️ **What the fixture found instead is worse and is now reported.** The throw is *mid-module*, so
`registerModule`'s loop leaves the kit **half-registered** — nodes before the bad definition live,
everything after silently gone. Seen live: one kit produced **both** a load failure **and** a
collision, which is only possible if a node had already registered. My own first-draft message said
*"none of its nodes are available"*, **which was an over-claim of exactly the kind this task exists
to remove**; `kit-load-failed` now carries `partial`.

🔴 **AC4's "three known-zero shipped modules" is a list that does not exist.** LBR-006 asserts it and
names none. A census of all 29 was run instead
([notes/cn-015-premise-census.md](notes/cn-015-premise-census.md)): **15 register ≥1 node, 1
registers zero** (`form-validation/noodl-validation-module` — AC4's real known-broken input), **5
unmeasured** (they need a browser the harness lacks), 7 have no `main` and register zero by design.
⚠️ **The census lied twice before it was right**: without `window.React` **9 healthy modules read as
broken**, and collecting only `defineModule` missed **`defineNode`** entirely. **`asked − answered =
absent` — the other two LBR-006 counted are NOT disproven.**

## 3. Picking the next build

- **CN-015's editor half (AC1)** — the natural continuation and small. The editor cannot tell *"this
  kit threw"* from *"this kit is not installed"*: it reads the payload a viewer sent (✅ D3), and a
  thrown kit is simply absent from it. `kitDiagnostics` already takes **`assumeLoaded: false`** for
  exactly that caller, so the zero-node check is **skipped rather than guessed** — ⚠️ do not
  collapse CN-006b's deliberate "installed, not yet loaded" state into "0 nodes". The failure facts
  have to reach the editor from somewhere first; that is the real work, not the rendering.
- **CN-012 (logic nodes)** — `module.nodes` via `defineNode` is the non-visual half and is still
  untested here. ⚠️ **s22 found `defineNode` is a live registration path a census had to be taught
  about**, so it is not hypothetical. **Build the caller before specifying anything.**
- **CN-011 / CN-013 / CN-016 / CN-017** — unchanged.

⚠️ **Confirm rather than inherit — seven sessions running now.** s22's spec was wrong about
collision precedence, wrong that AC2 needed building, and cited a list that does not exist.

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

1. 🆕 **Should the runtime refuse a kit that shadows a built-in?** Today the kit silently wins at
   runtime while validation describes the built-in (§1). **(a)** leave it and report, which is what
   s22 built; **(b)** make built-ins win at registration too, so the layers agree; **(c)** refuse the
   kit's node and error at load. ⚠️ (b) and (c) are behaviour changes — an existing module may
   override deliberately, and **0 of 29 shipped modules have ever been run** (LBR-004), so the blast
   radius is genuinely unknown. (a) is the current state and is at least now honest.
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
   none. ⚠️ `typecheck:runtime` red at 2, pre-existing; `typecheck:core-ui` reports **44 `TS2307`s**.
   ⚠️ **s22 did not re-measure these** — a peer was committing in `noodl-mcp` throughout, so any
   reading would have been misattributable.
7. **Should `project`'s `find_tools` purpose line name kits?** Costs resident tokens.
   `tests/kitTools.test.ts` has the control that fails when it changes. Narrowed by s17, unanswered.
8. **"Clean" is no longer "an empty diagnostics array" for any page** (s18's AC2). `Page` declares
   neither `title` nor `urlPath` statically, so **96 of 947 measured skips are `Page`**.

Open, not caused here, still wanting task numbers: 🔴 `render-from-disk.js` answers `/` and
`/index.html` and 404s everything else, **including the start page's own `urlPath`** · 🔴 the
`@noodl/mcp` provisioning flake · 🔴 `ViewerConnection.sendRefresh()` dead at both ends · 🆕 **the
half-registered kit** (§2) — a kit truncated mid-module is reported as a load failure but **nothing
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

⚠️ **`NodeLibraryDataNodeType` is not a census of the payload.** s21 added `module`; `ports`,
`dynamicports` and most other fields the viewer sends are still undeclared, and `BasicNodeType`'s
constructor copies **every** field regardless. **A field's absence from that interface says nothing
about whether it arrives** — check the recorded payload, not the type.

⚠️ Also carried: `CodeFileDocument` renders **two toolbars** (s13) · `find_tools`' `query` matches
tool *names* only while its `describe` says "names and descriptions" (s17/s18) · whether the colour
picker paints a swatch for a `color` port whose value is `var(--token)`.

## 7. Checkout conditions

- ✅ **No editor stack was launched.** Nothing of mine ran. The only `npm run start` on the box is a
  **`next-server`** (pid 62793, started 23:44 the previous night) — the nodegx-community web app,
  **not** an OpenNoodl editor; every OpenNoodl Electron match in `ps` is a peer MCP server by its
  command line. No CDP, no teardown, nothing to announce.
- ⚠️ **Seven repo source files were edited and committed** (`3ec68b32`): `health.js` (new),
  `health.test.js` (new), `kit-catalog`'s `index.js` / `index.d.ts`, `noodl-mcp`'s `extract.ts` and
  `responses.ts` (**comments only**), and `scripts/validate-project.ts`. There was therefore a
  `test:ci` contamination window. **No broadcast was sent** — 21 peer sessions were listed and all
  but two started 1–3 days ago; the two fresh ones were committing in `noodl-mcp`, not running gates.
- ⚠️ **A probe test file existed briefly** in `packages/noodl-runtime/test/` (a package inside
  `test:packages`) and was deleted within the same minute. If a peer's `test:packages` run from
  ~this window shows an unexplained extra suite, that was it.
- ✅ **No fixture or real test project was written to.** Everything ran on `cp -R` copies in the
  session scratchpad; the fault kits were created inside a copy.
- 🔴 **`test:ci` still stands where s12 left it** (`2843 / 6 @ 39393`); s13–s22's commits are not in
  it. **Re-measure before quoting.** `@nodegx/kit-catalog` is **55 / 3 suites** (re-measured).
  ⚠️ **`noodl-mcp`'s suite and the `typecheck:*` set were deliberately NOT run** — a peer committed
  in that package twice during the session (`5754a168`, `e0452b3c`), so any red would have been
  misattributable to me or to them.
- ⚠️ **Peer work live in the tree and not touched**: `dev-docs/tasks/phase-50-legibility/notes/`,
  `dev-docs/tasks/phase-65-the-library/` (untracked), `dev-docs/tasks/phase-68-learnbook/README.md`,
  `scripts/library/check.ts`.
- Whoever you tell you are starting, tell you have stopped.
