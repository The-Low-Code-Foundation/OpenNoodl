# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s28 fixed D24 at its cause. The recorded mechanism was wrong, the real one was writing four database rows per press, and the two runtime behaviours behind it are now phase 80's.**

Read in this order:

1. **[SBR-007 §32](SBR-007-THE-PAGE-EDITOR.md)** — the trace, the fix, and what a 47-spec green
   suite could not see.
2. **[D24](DEFECTS-THE-SITE-BUILDER-FOUND.md)** (🟢 fixed), **[D25](DEFECTS-THE-SITE-BUILDER-FOUND.md)**
   and **[D26](DEFECTS-THE-SITE-BUILDER-FOUND.md)** (both new, both `NONE`, both registered in
   [phase 80](../phase-80-the-defects-the-templates-found/TASKS.md)).

---

## 🔴 FIRST JOB

### (a) Richard's, still small and still unanswered — carried from s26, untouched by s27 and s28

**D20's fix moved the actions.** The heading grows as well as shrinks — `layout.ts` assigns
`flexGrow` and `flexShrink` in the same branch, so there is no third option — which puts
`Preview`/`Save page` at the **right** of the header rather than clustered beside the title. Nothing
is clipped at any width; the question is only whether that look is wanted. **Two parameters revert
it** (`sizeMode: 'contentSize'`, drop `width`) at the cost of putting D20 back.

### (b) AC3, still the one that cannot be met

**D15** — no drop-target capability in the runtime, so **AC3 is not met and phase 77 must not close
pretending it is.** **D23** is its twin: no visual node reports its rendered geometry, so a drag
cannot compute an index either. Both `NONE`, and both would be closed by the same small thing — a
`domelement` output on `Group` (`video.ts:283-288` is the three-line template).

### (c) The two rows D24 left behind, now in phase 80 and worth more than the fix was

- **D26** — `simplejavascript.ts` re-runs a node when a value **arrives**, not when it **changes**.
  Contradicts `run-on-value-change.ts`'s own justification for keeping `Run`. Four lines per family,
  **twelve families**, and the primitive/reference line has to be drawn once for all of them (an
  array mutated in place is the same reference and must still re-run).
- **D25** — `Record.Fetched` fires from the `Id` setter with nothing read. Description repaired s28
  across all four copies; the behaviour is untouched.

### And the rest nobody owns

**D13**, **D16**, **D22** (no `textOverflow` on `Text`), making `test:main` watched (**D19**), and
the `ports: []` exposure on the **browser** deploy path (`build/deployer.ts`, end of D14).

---

## 🔴 What s28 paid for, and would pay again

- **Count the class, never the answer.** Every one of `sb004`'s 47 specs read the row the response
  named — always correct — while three junk rows sat beside it for ten sessions. The gate that
  catches this class is `GET /classes/Page` and a length, not a better assertion about the copy.
- **A mechanism that fits every observation can still be wrong.** s27's *"the graph outlives its
  request"* explained the flakiness, the traffic dependence and the one-endpoint-not-another — and
  was false. What settled it was an **instance identity printed in a trace**; nothing that could be
  reasoned from the existing evidence would have. ⚠️ A peer's commit that same morning (DEF-023,
  09:21) had already measured the opposite. **Read the log before re-deriving.**
- **The trace is cheap and it is the tool.** `d24(node, what, extra)` behind `process.env.D24_TRACE`
  in `runtasks.ts` + `simplejavascript.ts`, printing a per-instance id, the state, and — decisively
  — whether the incoming value **equalled the one already there**. Twenty minutes, reverted after.
- **A frozen fixture needs its exemption stated, not zeroed.** Changing one wire reddened
  `sb017-deploy-connection-parity` (a shortfall list) and `sb017-helper-is-lossless` (a wire count).
  Both take a named entry saying which component moved and why — that is the design, not friction.

---

## ✅ The instruments — THREE, and they answer different questions

🔴 **Pick by what is being asked, not by which one you used last.**

| question | tool |
|---|---|
| does it *lay out* / render correctly | `render-from-disk.js` + `withRenderedPage` (§20, §30) |
| does the thing a person **deploys** work | `deploy-from-disk` + `drive-deployed.js` (§26) |
| does a **cloud function** actually do what it claims | `sb004-publication-invariant.test.ts` (§31) |

The third authors `SB004_COMPONENTS` through the **real MCP door**, bundles them with
`bundleAuthoredComponents`, runs a real backend with `devOpen: false`, and drives functions over
HTTP. ~3s.

- 🔴 **Read the stored rows, never the answer** — *and count them.* s28 is what that second half
  is for.
- 🔴 **A worker's ports must be at COMPONENT level**, not on the Inputs/Outputs nodes, or Run Tasks
  reports `run-tasks/no-completion-output` and the request hangs (CWF-018).
- 🔴 **A new endpoint owes a rule in `site-builder.security.json`** or SB-016's gate refuses a
  public bind.

```
# the cloud-function drive
cd packages/nodegx-backend && npx jest sb004-publication-invariant

# the layout drive — never serve the fixture's own rows
cp -R ~/.noodl/backends/backend_mterfnli74qwv <copy>
node packages/nodegx-backend/dist/cli.js serve --data-dir <copy> --port 8601
node <probe>.js <project-dir>

# the deploy drive
node scripts/devtools/build-deploy-from-disk.mjs /tmp/deploy-from-disk.cjs
cd packages/noodl-editor && node /tmp/deploy-from-disk.cjs <v2-project-dir> --out <folder> [--sabotage]
node scripts/devtools/drive-deployed.js <folder> [--port N] [--hold]
```

- ✅ **`--sabotage` wires a connection to a port that does not exist.** If the census does not report
  it dropped, the health filter did not run and **every other reading in that run is void**.
- 🔴 **A headless export's health filter fails OPEN, silently** — `registerModule(project)` first.

## Where the phase now stands

| | verdict |
|---|---|
| **SBR-005** | ⬜ open — **and it owns AC3's gallery model** |
| **SBR-006** | AC1/2/4/5 ✅ · **AC3 🟡** — `Unpublish` is the one act of three still undriven |
| **SBR-007** | 🟢 AC1 ✅ both halves, AC4 ✅, AC5 ✅ · **AC2 🟢 outcome BUILT + DRIVEN s27, gesture 🔴 D23** · AC3 split · D18 ✅ · D20 ✅ · **D24 ✅ s28** |
| **SBR-008** | ✅ all five, s18 |
| **SBR-015** | AC1/2/3 ✅ s13 · **AC4** 🟡 re-read: DEF-004(a) now writes a step per action |
| **SBR-016 / SBR-017** | ✅ s14/s15 |
| **D13 / D16** | 🔴 open, `NONE` |
| **D14** | 🟢 fixed s20, DRIVEN s22 — the **browser** deploy path is still exposed and `NONE` |
| **D15** | 🔴 `NONE` — no drop target; **AC3 cannot be met** |
| **D17 / D18 / D21** | 🟢 fixed and driven (s21/s24/s25) |
| **D19** | 🟢 reds fixed s23 — 🔴 **`test:main` watched is still `NONE`** |
| **D20** | 🟢 FIXED + DRIVEN s26; **the appearance half is Richard's** |
| **D22** | 🔴 `NONE` — no `textOverflow` port on `Text` |
| **D23** | 🔴 `NONE` — no node reports rendered geometry, so **no drag can hit-test** |
| **D24** | 🟢 **FIXED + GATED s28** — four Page rows per press → one; the drive is back in front of `duplicatePage` |
| **D25** | 🟡 description fixed s28, **behaviour `NONE`** — registered in phase 80 |
| **D26** | 🔴 **`NONE`** — registered in phase 80; twelve node families |

## Standing context

- ✅ **Fixture: `SBR-007 Page Editor Drive`**, backend `backend_mterfnli74qwv`, port **8601**,
  `SITE_SETUP_TOKEN=drive-token-007`, `owner@sbr007.test` / `drive-pass-007`. Page
  `e921dd5b-93a5-40e4-bb75-75c37da395c0`, slug `drive-007`.
  🔴 **Drive a COPY of the backend data.** The fixture's project is **still the pre-D18 control
  arm**, which is what makes it reusable. Its title reads `Retitled By The Drive` (21 ch).
- ✅ **The setup token is a file, not a UI step**: `~/.noodl/backends/<id>/secrets.json`, `functions`
  namespace. `SecretsStore` re-reads on every call, so no restart.
- ✅ **The template is generated, not authored.** Edit
  `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts`, then `npm run template:site-builder`.
  `sb007Template.test.ts` asserts the committed artefact is byte-identical to a fresh generation.
  ⚠️ **Census literals live in FIVE files** and a wire change moves two of them
  (`sb017-helper-is-lossless` counts wires per component and in total; `sb017-deploy-connection-parity`
  holds a shortfall exemption list). Read each before bumping it: one counts *code nodes that declare
  a port*, not code nodes.
- 🔴 **A node's port description lives in FOUR generated copies.** Changing one in the runtime owes
  `catalog:generate` → `catalog:merge` → `docs:nodes` **and** `cloud-library:generate`; each has a
  `:check` and `docs:nodes:check` will report *clean* against a stale enriched catalog.
- 🔴 **A source change is not a drive until the bundle carries it** — the viewer
  (`external/viewer/noodl.viewer.js`), the deploy runtime (`external/deploy/noodl.deploy.js`, a
  *different file*), and `nodegx-backend/dist`. **A template change is different** — project data,
  read from disk every boot, so no rebuild.
- ✅ **The gates, all green at s28**: `noodl-mcp` **966**, `nodegx-backend` **1406** (s27's 1405 plus
  D24's count), `noodl-runtime` **2597**, editor `test:ci` **2905 specs, 4 failures — the recorded
  AIX-006 floor**, seed 82523. ⚠️ A first run showed 6: two `Git clone progress` reds that a re-run
  cleared. **A lone red is a flake until re-run.**
- Shared checkout: **pathspec commits only, never `git add` to stage**; `git status --porcelain |
  grep '^??'` before committing. Announce editor launches **and** teardowns. `test:ci` alone.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
