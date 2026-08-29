# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s19 closed SBR-006 AC2. SBR-006 now has only AC3 open, and AC3 is not SBR-006's to fix.**

The defect that blocked AC2 since s9 — the dialog writing a page with no title and no slug — is
gone, driven on the one fixture where a pass could not be an accident of a grown schema.

Read in this order:

1. **[SBR-006 §5.11](SBR-006-THE-ADMIN-SHELL.md)** — the AC2 drive. §5.11.1 is *why that fixture*;
   §5.11.2 is the four-cell control and the negative that matters.
2. **[SBR-006 §5.12](SBR-006-THE-ADMIN-SHELL.md)** — why AC3's other two actions cannot be driven.
3. **[D14](DEFECTS-THE-SITE-BUILDER-FOUND.md)** — that finding as a row, `NONE`-owned, with the
   experiment written down.

---

## 🔴 FIRST JOB — **SBR-007**, and it is genuinely unblocked now

SBR-007 is the screen a client actually lives in. Its deployed-save half was blocked on SBR-008;
SBR-008 landed at `a14fb8e7` and s19 drove the same mechanism through a second surface.

⚠️ **Read SBR-007's ACs before planning.** It is not a small task: **AC2 (drag to reorder)** and
**AC3 (drop an image, get a thumbnail)** are untouched, untested, and are the two that need real
runtime-capability checks before any design. **AC1's preview half is the cheapest real work.**

🔴 **Do not plan any part of SBR-007 around publish working.** See D14 below.

---

## 🔴 D14 — both row-action cloud functions throw at their FIRST node

```
publishPage    error  HTTP 400  59 ms  →  JavaScriptFunction: Outputs.ready is not a function
duplicatePage  error  HTTP 400  13 ms  →  JavaScriptFunction: Outputs.ready is not a function
claimSite      success              39 ms  ← control, same backend
```

✅ **The refusals are visible and fast — that is SBR-015's fix working.** The template says the
right thing; the thing it says is that the action failed.

🔴 **This is only nameable because DEF-004(a) (`d229bf4b`) writes execution steps.** SBR-006 s9 and
SBR-015 both looked straight at this and saw an opaque 400 with zero steps. The row paid for itself
inside a day.

🔴 **It refutes a recorded refutation.** SBR-015 s10 marked *"undeclared signal ports"* REFUTED
because *"the artefact declares all six."* The shipped artefact at HEAD: **18 Function nodes call a
signal output, 0 declare it in `scriptOutputs`** — `claimSite` among them, which is also why
"undeclared ⇒ throws" is **not** the whole story.

⚠️ **Two variables, neither eliminated. Do not repeat my mistake and assert either.**
`publishPage` succeeded in 12 ms at 09:26:44Z on `SBR-015 AC1 Drive`.

- **the cloud runtime** — `d229bf4b` is the only commit that day touching `nodegx-backend/src`; the
  process serving the success predates it, mine postdates it. The pre-commit runtime was never run.
- **the project** — 🔴 I diffed both projects' `publishPage`, found them byte-identical bar node ids
  and called the project constant. **Both had already been rewritten by the NDA-017 migration** after
  the success I was comparing against.

✅ **The experiment:** mint a project and **never open it**, call `publishPage` against a backend
built from a commit before `d229bf4b`. Vary one, then the other.

---

## 🔴 Three traps this session paid for

### An absence with no control, twice, from the same two lines

`forEachNode` **stops on a truthy return** — `out.push()` returns a length, so the walk ended at the
first match. Worse, a callback that **threw** came back as a clean `[]`. Both times the reading was
*"there is nothing here"*, and both times the instrument had simply stopped.
✅ **Return `undefined` explicitly, and put a counter next to any zero.** The type census that found
15 matching nodes is what exposed the empty array as a lie.

### A grep of line numbers is not a read of a function

I asserted `_updatePorts` derives output ports only from `scriptOutputs`, from grep output. It also
calls `_parseScriptForErrorsAndPorts` over the script text — visible only by reading the body. The
whole mechanism story rested on that sentence.

### 🔴 A diff between two mutated copies is not a control

The sharpest one. Two projects' `publishPage`: same byte count, diff shows only node-id rewrites,
conclusion *"the project is constant, so the runtime is the variable."* **Both files had been
rewritten after the reading I was comparing to**, by the same migration. They matched because they
were mutated **alike** — the one result that comparison could not fail to produce.
✅ **Before diffing two copies, check what wrote to each and when.** The artefact was the honest
third point: its gate node carries only `functionScript`, both projects carry
`runOnChange-in-*: false` added on open.

### And one that went right: pick the negative control from the real vocabulary

The instrument check wanted a port that should read **false**. `prop-neverWiredNoColumn` works, but
**`prop-seoDescription`** is better — a *real* field of this template's `Page` model, wired on
another component, and the create node still says no. A fabricated name proves the instrument is not
stuck on; a real name proves the port set is genuinely **per-node and wire-derived**.

## Where the phase now stands

| | verdict |
|---|---|
| **SBR-006 AC1** | ✅ s17 · **AC2** ✅ **s19** · **AC3** 🔴 **blocked by D14, not by this task** · **AC4** ✅ s12 · **AC5** ✅ s9 |
| **SBR-007** | ⬜ **unblocked, and the first job** — ⚠️ AC2/AC3 are the expensive half |
| **SBR-008** | ✅ all five, s18 |
| **SBR-015 AC1/2/3** | ✅ s13 · **AC4** 🟡 ⚠️ re-read: DEF-004(a) now writes a step per action, so *"0 steps"* is no longer the expected reading |
| **SBR-016 / SBR-017** | ✅ s14/s15 |
| **D13** | 🔴 open, `NONE` — untouched again |
| **D14** | 🔴 **new, `NONE`** — door half is a natural DEF-002 rule 4; runtime half fits no open task |

## Standing context

- 🔴 **Drive fixtures — and `SBR-017 Sign In Drive` is now SPENT for the no-column question.**
  `backend_mte82r1qhnr87`, port 8599, `owner@sbr017.test` / `drive-pass-017`. s19's create grew its
  `Page` class to `[published,showInNav,navOrder,title,slug]`, so it can no longer answer *"what
  happens with no column?"* — same way `SBR-016 Arrive Drive` (`backend_mte9omazclxw6`, 8600,
  `owner@sbr016.test` / `drive-pass-016`) was spent at s18. **There is no unspent no-column fixture
  left; the next one needs a fresh mint.** `SBR-015 AC1 Drive` (`backend_mte62ofkj8whc`, 8598) is
  still in the **refusal** arm.
- ✅ **The backend is the cheapest oracle in this phase, and it now has two halves.**
  `sqlite3 ~/.noodl/backends/<id>/data/local.db` → `PRAGMA table_info(Page)` and
  `SELECT name, updatedAt FROM _Schema` for *"did the write land, did it create the column?"*.
  🆕 **`sqlite3 ~/.noodl/backends/<id>/executions.sqlite`** — note it is at the backend **root**, not
  under `data/` — `workflow_executions` and `execution_steps` for *"which node failed and why."*
  ⚠️ The HTTP API refused both drive tokens; querying from inside the viewer page works (it holds a
  session), but check the function's request schema first — mine was rejected in 5 ms for sending
  `isPublic` where the door wanted `publish`, and that never reached the graph.
- 🔴 **A source change is not a drive until the bundle carries it, and the bundle moves under you.**
  Grep `packages/noodl-editor/src/external/viewer/noodl.viewer.js` for your symbol **immediately
  before the act**, not once at the start: a peer's unrelated `noodl-runtime` edit rebuilt it
  mid-session (15:11 → 15:44) and I re-checked rather than trusting the first reading.
- ⚠️ **A peer editing editor source will full-reload your editor and close your project.**
  `[HMR] Cannot apply update. Need to do a full reload! Aborted because …StyleCompositions.ts is not
  accepted` did exactly that mid-drive. Keep a two-call reopen helper (stamp the card, then click
  it — a write is invisible in the same eval) and re-install the webpack probe, which the reload
  also clears.
- 🔴 **`closest('[class*=Card]')` matches the *Name* span** — CSS-module class names contain their
  component name, so a substring selector hits children. Use `[class*=__Card--]`.
- ✅ **Reaching the editor's models headlessly**:
  `window.webpackChunknoodl_editor.push([['probe'], {}, (r) => { window.__wr = r; }])`, then
  `__wr('./src/editor/src/models/projectmodel.ts').ProjectModel.instance` and
  `__wr('./src/editor/src/utils/exporter/util.ts').exportComponent`. Module ids are source paths.
- 🔴 **`getConnectionHealth` and `evaluateConnectionHealth` take OPPOSITE spellings**, on the same
  class. `evaluateConnectionHealth` reads the editor's `fromId`/`fromProperty`/`toId`/`toProperty`;
  `getConnectionHealth` reads the runtime's `sourceId`/`sourcePort`/`targetId`/`targetPort` and
  falls through to `c.sourceNode.id`, so a raw `graph.connections` entry throws. `graph.connections`
  hold the **editor** spelling. Prefer `exportComponent` — it is the real filter.
- ✅ **Force `graph.evaluateHealth()` before reading health or exporting** — it removes D13 as a
  confound in one line. ⚠️ And **`kept === authored` proves nothing by itself**: 336/336 is equally
  what an inert filter gives. Pair it with a port that must read **false**.
- ✅ Viewer measured **988 × 313** again (not `96 × 0`) — measure it, assume neither.
  `Noodl.Navigation.navigateToPath('/admin/pages')`; wrap every `cdp eval` in `(() => { … })()`;
  stamp in one call and click in the **next**; `npm run cdp -- screenshot --target=viewer` works.
- ✅ **Gate at HEAD: `test:ci` = 2889 specs, 4 failures, all four `AIX-006 style vocabulary` by
  name**, seed 07472, fresh `test-results.json` — the documented floor. Ran alone, after teardown.
  ⚠️ `gitHead` in that file read `d8e9b7c3` — a peer's commit landing mid-run, not mine; it is the
  checkout at read time, never authorship.
- Shared checkout: **pathspec commits only, never `git add` to stage**; a new **screenshot is
  untracked and a pathspec commit skips it silently** — `git status --porcelain | grep '^??'` before
  committing. Announce editor launches **and** teardowns (`dev:stop --list` before and after; s19
  showed empty before, `Stopped 27 process(es)` after, all 18 peer MCP servers alive). `test:ci`
  alone, never beside a live stack.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
