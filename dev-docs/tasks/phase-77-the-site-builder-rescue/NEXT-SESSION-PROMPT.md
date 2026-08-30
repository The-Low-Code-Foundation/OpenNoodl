# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s30 BUILT AC2's gesture. The runtime could always do it — what was blocking it was a sentence in a comment.**

Read in this order:

1. **[SBR-007 §33](SBR-007-THE-PAGE-EDITOR.md)** — the clause s29 did *not* disprove, why it stopped
   mattering, and the `For Each` trap that would have made every drop two rows too high.
2. **[D28](DEFECTS-THE-SITE-BUILDER-FOUND.md#d28)** (new, `NONE`) — a `Drag`'s child loses its CSS
   class.
3. **[D23](DEFECTS-THE-SITE-BUILDER-FOUND.md#d23)** — still disproved, still kept. Its comment in
   the template source is now replaced by what was measured.
4. Unchanged: **[D15](DEFECTS-THE-SITE-BUILDER-FOUND.md#d15)** 🔴 (AC3's only remaining blocker),
   **[D24](DEFECTS-THE-SITE-BUILDER-FOUND.md#d24)** 🟢, **[D25](DEFECTS-THE-SITE-BUILDER-FOUND.md#d25)** /
   **[D26](DEFECTS-THE-SITE-BUILDER-FOUND.md#d26)** / **[D27](DEFECTS-THE-SITE-BUILDER-FOUND.md#d27)**
   all `NONE` in phase 80.

---

## 🔴 FIRST JOB

### (a) Drag the real page editor — the one thing s30 did NOT do

s30 drove the **mechanism** (`ac2DragGestureDrive.test.ts`, 9 specs, a synthesised pointer) and
gated every static property the template's use of it depends on. It never loaded
`/Pages/PageEditor` against a backend with sections and dragged one.

🔴 **That gap is stated in §33.7 rather than ticked, and it is the distinction this phase has paid
for twice.** The instrument is the first row of the table below: `render-from-disk.js` +
`withRenderedPage`, against a **COPY** of `backend_mterfnli74qwv` on 8601 — plus
`Input.dispatchMouseEvent`, which `ac2DragGestureDrive.test.ts` now has a working copy of
(`dragBy`, and 🔴 **`buttons: 1` on every move** or the element never moves and the failure reads
like *"the runtime cannot drag"*).

What to read off the screen, in this order: three sections exist and are **different heights**; drag
the first below the third; the stored `Section` rows come back renumbered; the row **springs back**
(`out-snap`) rather than staying where it was dropped; `Move up`/`Move down` still work. ⚠️ **Read
the stored rows, never the response** — s28 is what that rule is for.

### (b) Move D28 into phase 80, verbatim

It is written in full in phase 77's register precisely so it can be moved. It is **not** there
already because phase 80's `TASKS.md` had another session's **uncommitted** edits in the working
tree for the whole of s30, and appending would have swept them into a pathspec commit. Check
`git status --porcelain` first; if it is clean, move it.

### (c) Richard's, still small and still unanswered — carried from s26, untouched by s27–s30

**D20's fix moved the actions.** The heading grows as well as shrinks — `layout.ts` assigns
`flexGrow` and `flexShrink` in the same branch, so there is no third option — which puts
`Preview`/`Save page` at the **right** of the header rather than clustered beside the title. Nothing
is clipped at any width; the question is only whether that look is wanted. **Two parameters revert
it** (`sizeMode: 'contentSize'`, drop `width`) at the cost of putting D20 back.

### (d) AC3, still the one that cannot be met — and now for one reason only

**D15** — no drop-target capability in the runtime (`dataTransfer`, `dragover`, `dragenter`,
`DragEvent` all **0** at HEAD, beside a **39**-hit `onClick` control over **369** files). Re-measured
at HEAD with a boundary control at s29 and it **stands**. So **AC3 is not met and phase 77 must not
close pretending it is.**

⚠️ **D15 is about a FILE arriving from outside the page**, which is genuinely absent. It is not
about in-page pointer work: every visual node also carries `pointerEnter`, `pointerDown`, `hoverStart`
and `childIndex`, and s30's drag needed none of them. **Do not let AC2's success be read as
narrowing D15** — they were filed as twins and only one of them was ever real.

---

## 🔴 What s30 paid for, and would pay again

- **A disproof is not a licence.** D23 had three clauses; s29 killed the middle one. Reading that as
  *"so the gesture is easy"* would have been D23's own error with the sign flipped — a measurement of
  **some** property (the ports exist) standing in for the one that decides (the index is computable).
  The last clause was true, and the build works because the arithmetic **never needs a pitch**, not
  because the clause went away. ✅ **After a row is disproved, ask which of its claims survived.**
- 🔴 **A defect nothing in the suite can see.** With the repeater still under `sectionsPanel`, every
  drop would have reported an index two too high — and the wires were right, the appearance ratchet
  satisfied, the census counts right, and the page rendered. It fails only when a person drags.
  ✅ **A DOM-shaped invariant needs a DOM-shaped gate**, and this one was **sabotaged**: one extra
  sibling in the container reddens it and the other 33 specs stay green.
- ✅ **Report the working, not the answer.** The hit test returns `idx`, the sibling count **and the
  parent's class**. An index counted over the wrong parent is still a plausible small integer, and
  `pc=probe-list` is the only reading that excludes it.
- 🔴 **Check the fix is USABLE, not just correct** — third recorded repeat. `/Admin/SectionRow` is
  nothing but controls and `Drag` has no `handle` or `cancel` port, so the build was conditional on a
  reading nobody had taken: **a button inside the draggable card is still clickable**. Had it not
  been, the row would have been draggable *or* usable, and the honest outcome was a product row.
- 🔴 **A connected number cannot say `px`.** `h → card.height` renders `height: 60%; flex-grow: 60`.
  `SIDEBAR_WIDTH` records this for **parameters**, where the `{value, unit}` object form escapes it —
  **a connection has no such form**. Any dimension driven by a wire is a percentage.
- ⚠️ **Three drags, not one.** One drag is satisfied by a script returning a constant, a port
  reporting the viewport, or arithmetic that is right only for uniform rows. The **no-move** arm is
  the one that kills "always last" and "always first" together.
- ⚠️ **`Drag` leaves the element translated where it was dropped.** Two arms of the first drive read
  `idx=0` and `NaN` — both the page answering honestly about a state the arms had not accounted for,
  one because the press landed on a card dragged over the coordinate being pressed. Each arm now
  loads its own page.

## 🔴 What s28 and s29 paid for, still live

- **Count the class, never the answer.** All 47 of `sb004`'s specs read the row the response named —
  always correct — while three junk rows sat beside it for ten sessions.
- **A control drawn from the SAME population tests the syntax, not the boundary.** D23's control ran
  over the directory that held its 0; the ports were one directory up. ✅ **A finding of 0 owes a
  control on the POPULATION as well as the PREDICATE.**
- 🔴 **Check the FIX before you write it.** D23's proposed three-line fix would have shipped the
  product's second unconnectable port — that is D27.
- **The unquoted-`$var` trap**: `grep … $P` with two paths in a zsh variable made finding **and**
  control read 0. Put the paths in the command.

---

## ✅ The instruments — FIVE, and they answer different questions

🔴 **Pick by what is being asked, not by which one you used last.**

| question | tool |
|---|---|
| does it *lay out* / render correctly | `render-from-disk.js` + `withRenderedPage` (§20, §30) |
| does the thing a person **deploys** work | `deploy-from-disk` + `drive-deployed.js` (§26) |
| does a **cloud function** actually do what it claims | `sb004-publication-invariant.test.ts` (§31) |
| does a **node's port** report what it declares | `d23GeometryDrive.test.ts` (§32) |
| does a **gesture** do what it looks like it does | `ac2DragGestureDrive.test.ts` (§33) — **new s30** |

The fifth is the fourth plus a real pointer: `page.client.send('Input.dispatchMouseEvent', …)` on
the connection the page is already rendered on. ~28s, no backend. 🔴 **`buttons: 1` on every
`mouseMoved`** — `react-draggable` listens on the document and ignores a move without the button
bit, so the press and the release both land and nothing moves.

- 🔴 **Read the stored rows, never the answer** — *and count them.*
- 🔴 **A worker's ports must be at COMPONENT level**, not on the Inputs/Outputs nodes, or Run Tasks
  reports `run-tasks/no-completion-output` and the request hangs (CWF-018).
- 🔴 **A new endpoint owes a rule in `site-builder.security.json`** or SB-016's gate refuses a
  public bind.

```
# the gesture drive (and the copy of dragBy worth stealing)
cd packages/noodl-mcp && npx jest ac2DragGestureDrive

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
| **SBR-007** | 🟢 AC1 ✅ both halves, AC4 ✅, AC5 ✅ · **AC2 ✅ BOTH HALVES — outcome driven s27, gesture built + driven s30** · AC3 blocked by D15 alone · D18 ✅ · D20 ✅ · D24 ✅ · ⬜ the real page editor still undragged |
| **SBR-008** | ✅ all five, s18 |
| **SBR-015** | AC1/2/3 ✅ s13 · **AC4** 🟡 re-read: DEF-004(a) now writes a step per action |
| **SBR-016 / SBR-017** | ✅ s14/s15 |
| **D13 / D16** | 🔴 open, `NONE` |
| **D14** | 🟢 fixed s20, DRIVEN s22 — the **browser** deploy path is still exposed and `NONE` |
| **D15** | 🔴 `NONE` — no drop target for a FILE; **AC3 cannot be met**. Stands at HEAD |
| **D17 / D18 / D21** | 🟢 fixed and driven (s21/s24/s25) |
| **D19** | 🟢 reds fixed s23 — 🔴 **`test:main` watched is still `NONE`** |
| **D20** | 🟢 FIXED + DRIVEN s26; **the appearance half is Richard's** |
| **D22** | 🔴 `NONE` — no `textOverflow` port on `Text` |
| **D23** | 🟢 **DISPROVED s29, kept** — and s30 built the thing it was blocking |
| **D24** | 🟢 **FIXED + GATED s28** |
| **D25 / D26 / D27** | 🔴 `NONE` — all three registered in phase 80 |
| **D28** | 🔴 **NEW s30, `NONE`** — a `Drag`'s child loses its `cssClassName`; owes a phase-80 row |

## Standing context

- ✅ **Fixture: `SBR-007 Page Editor Drive`**, backend `backend_mterfnli74qwv`, port **8601**,
  `SITE_SETUP_TOKEN=drive-token-007`, `owner@sbr007.test` / `drive-pass-007`. Page
  `e921dd5b-93a5-40e4-bb75-75c37da395c0`, slug `drive-007`.
  🔴 **Drive a COPY of the backend data.** The fixture's project is **still the pre-D18 control
  arm**, which is what makes it reusable — and it therefore does **not** carry s30's drag.
- ✅ **The setup token is a file, not a UI step**: `~/.noodl/backends/<id>/secrets.json`, `functions`
  namespace. `SecretsStore` re-reads on every call, so no restart.
- ✅ **The template is generated, not authored.** Edit
  `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts`, then `npm run template:site-builder`.
  `sb007Template.test.ts` asserts the committed artefact is byte-identical to a fresh generation.
  ⚠️ **Census literals live in FIVE files.** s30 moved three of them — `code` 15→16 and
  `declared` 6→7 in `sb005AdminPanel`, `browserFunctions` 25→26 in the editor's
  `sb017-deploy-connection-parity` (**`test:ci` only** — its own comment records a session that left
  that literal stale for a week by not running it). `sb017-helper-is-lossless` needed **no** edit: it
  derives its counts and asserts a multiset.
- 🔴 **A node's port description lives in FOUR generated copies.** Changing one in the runtime owes
  `catalog:generate` → `catalog:merge` → `docs:nodes` **and** `cloud-library:generate`.
- 🔴 **A source change is not a drive until the bundle carries it** — the viewer
  (`external/viewer/noodl.viewer.js`), the deploy runtime (`external/deploy/noodl.deploy.js`, a
  *different file*), and `nodegx-backend/dist`. **A template change is different** — project data,
  read from disk every boot, so no rebuild. **s30 changed no product source**, so no bundle is stale.
- ✅ **The gates at s30**: `noodl-mcp` **986 / 74 suites**, `nodegx-backend` **1406 / 119 suites**,
  editor `test:ci` **2905 specs, 4 failures — the recorded AIX-006 floor, all four named `AIX-006
  style vocabulary`**, seed 42125, `gitHead 12cc718a`, fresh readout. `noodl-runtime` **not re-run**:
  no source in it changed. ⚠️ **A lone red is a flake until re-run.**
- ✅ **`test:ci` does not sweep other sessions' processes** — `run-electron-tests.js` spawns one
  Electron and guards `test-results.json`; the reaping trap is about `dev:stop` and the launcher, not
  this. Measured at s30 rather than assumed, and it is why no announcement was owed.
- Shared checkout: **pathspec commits only, never `git add` to stage** (except to make an untracked
  file committable); `git status --porcelain | grep '^??'` before committing. Announce editor
  launches **and** teardowns. `test:ci` alone.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
