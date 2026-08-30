# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s31 dragged the real page editor. AC2's gesture works — and the artefact a person receives cannot show it.**

Read in this order:

1. **[SBR-007 §34](SBR-007-THE-PAGE-EDITOR.md)** — the drive, the two defects it found, and the four
   things it paid for.
2. **[D31](DEFECTS-THE-SITE-BUILDER-FOUND.md#d31)** 🔴 (new, `NONE`) — opening the page editor on a
   page with sections starts a **cyclic write loop**. 115,755 write errors in eleven seconds on a
   screen nobody is touching.
3. **[D30](DEFECTS-THE-SITE-BUILDER-FOUND.md#d30)** 🔴 (new, `NONE`) — the editor's section query has
   no `visualSort`, so a drag moves a section somewhere other than where it was dropped.
4. Unchanged: **[D15](DEFECTS-THE-SITE-BUILDER-FOUND.md#d15)** 🔴 (AC3's only remaining blocker),
   **[D28](DEFECTS-THE-SITE-BUILDER-FOUND.md#d28)** 🔴, **[D29](DEFECTS-THE-SITE-BUILDER-FOUND.md#d29)** 🔴
   (a peer's, filed s21 of phase 80).

---

## 🔴 FIRST JOB — fix D31, then D30, then re-run the drive

Both fixes are **already proven by a mutant arm** in
[`ac2-page-editor-drag-drive.test.ts`](../../../packages/nodegx-backend/tests/ac2-page-editor-drag-drive.test.ts).
That is the unusual thing about these two rows: the repair is not a proposal, it is an arm that ran.

### (a) D31 — three parameters on one node

In `packages/noodl-mcp/tests/sb005Components.ts`, on the `merge` node of `SECTION_ROW_NODES`
(*"Fold the edits back into data"*):

```ts
parameters: {
  'runOnChange-in-data': false,
  'runOnChange-in-body': false,
  'runOnChange-in-image': false,
  functionScript: '…'
}
```

🔴 **Put them FIRST in the bag.** `NodeScope.setNodeParameters` drains queued values in key order,
so a `runOnChange-*` that landed after the value it governs lets the load-time run happen once
anyway. The editor's own NDA-017 migration rebuilds the bag for exactly this reason, and eleven
other Function nodes in this template — three in this same screen — already state the flags.

🔴 **Check `unpack` while you are there.** It takes `in-data` on the same wire and has **no `run`
connected**, so the migration would never touch it and s31's mutant did not vary it. Whether it
needs the same treatment is unmeasured.

### (b) D30 — one parameter on one query

On the `sections` node of `PAGE_EDITOR_NODES`, add `visualSort: SECTION_SORT` — the constant
`/Pages/Site` already uses, exported from `sb006Components.ts`. ⚠️ Import it rather than retyping
it; a second copy of a sort is the copy that drifts.

### (c) Then

```
npm run template:site-builder                 # regenerates site-builder.content.json
cd packages/noodl-mcp && npx jest sb007Template     # byte-identity with a fresh generation
cd packages/nodegx-backend && npx jest ac2-page-editor-drag-drive
```

🔴 **The drive PINS both defects and is meant to go red when they are fixed.** Flip, do not delete:

| spec | flip to |
|---|---|
| `FINDING — the shipped page editor states no sort…` | `editorSorted:true` |
| `FINDING — and on the screen, the drawn order is not the stored order` | `toEqual` |
| `FINDING — so the section did not land where the client dropped it` | `toEqual` |
| `FINDING — but 'Move up' on the card a client sees at the BOTTOM does nothing` | `changed:true` |
| the four D31 `FINDING` specs | assert `0` on the **shipped** arm |
| the two mutant CONTROL arms | keep them — they become the regression net |

⚠️ **Census literals live in FIVE files** and a parameter-only change should move none of them —
`code`, `declared` and `browserFunctions` count nodes and functions, not parameters. Verify rather
than assume: `sb005AdminPanel`, and `sb017-deploy-connection-parity` is **`test:ci` only** (its own
comment records a session that left that literal stale for a week by not running it).

---

## ✅ SECOND JOB — done in s31: the rows are placed, and not all in the same place

Phase 80's `TASKS.md` came clean mid-session (the peer committed at `07e9237f`), so s30's carried
job was finished — but **only one of the three rows belonged there.** Phase 80's own rule is that it
is *"graded on the product surface and never on a template being fixed downstream of it"*, which is
why phase 78's D22/D23/D24 are not in it either.

| row | fix touches | filed |
|---|---|---|
| **D28** — a `Drag`'s child loses its `cssClassName` | `react-draggable`, the **runtime** | ✅ **phase 80 as `DEF-027`** |
| **D30** — no `visualSort` on the editor's query | `sb005Components.ts`, the **template** | **stays in phase 77 — it is this phase's own work** |
| **D31** — `merge` re-runs on the value it writes | `sb005Components.ts`, the **template** | **stays in phase 77** |

🔴 **`NONE` on D30/D31 means "nobody has picked them up", not "no phase owns them".** They are the
first job above. The decision is written into the register so it is on record and not a gap.

---

## Richard's, still small and still unanswered — carried from s26, untouched by s27–s31

**D20's fix moved the actions.** The heading grows as well as shrinks — `layout.ts` assigns
`flexGrow` and `flexShrink` in the same branch, so there is no third option — which puts
`Preview`/`Save page` at the **right** of the header rather than clustered beside the title. Nothing
is clipped at any width; the question is only whether that look is wanted. **Two parameters revert
it** (`sizeMode: 'contentSize'`, drop `width`) at the cost of putting D20 back.

## AC3, still the one that cannot be met — and now for one reason only

**D15** — no drop-target capability in the runtime (`dataTransfer`, `dragover`, `dragenter`,
`DragEvent` all **0** at HEAD, beside a **39**-hit `onClick` control over **369** files). Re-measured
at HEAD with a boundary control at s29 and it **stands**. So **AC3 is not met and phase 77 must not
close pretending it is.**

⚠️ **D15 is about a FILE arriving from outside the page**, which is genuinely absent. It is not about
in-page pointer work: s31 dragged a real section with a real pointer and needed none of it. **Do not
let AC2's success be read as narrowing D15** — they were filed as twins and only one was ever real.

---

## 🔴 What s31 paid for, and would pay again

- 🔴 **Read the stored rows BEFORE opening the screen, not only after.** The first version read the
  boot orders after loading the editor and got `{}` — three rows whose `order` was simply *absent*
  from the response, because the loop had already saturated the limiter and **the harness's own
  reads were being refused**. Every expectation computed from that was arithmetic over nothing.
  ✅ **A page in the middle of a write storm refuses the reader too.**
- 🔴 **A control the store un-varies is not a control.** The first attempt at naming D31's cause
  seeded one page *with* `data` and one *without*, betting on `merge`'s `if (Inputs.data ===
  undefined) return`. Both stormed: `Section.data` is a column the moment any section has one, so
  the "without" rows come back as `data: null`, and `null !== undefined`. ✅ **Vary something the
  store cannot fill back in** — the arm that worked varied a *parameter of the graph*, which no
  backend can restore.
- 🔴 **Exclude the obvious suspect with an arm, not with reasoning.** `save.done → Changed →
  storageFetch` is a real edge, it is the one everybody would name, and removing it does **not**
  stop the loop. A fix aimed there would have been green on every gate and changed nothing.
- 🔴 **When a drive goes red, ask which side the error is on.** Two of s31's own assertions were
  wrong before the product was: `Move up` on the last *drawn* card "failing" was D30 being correct,
  and `queries:2 sorted:1` was a guess about a template that holds four. Both became evidence.
- 🔴 **The consequence a person reports may be the flakier reading.** The section list emptying
  itself was true on two of four runs; the query being **refused** was true on all four. Assert the
  refusal, log the list. ⚠️ And keep a control that reads zero — the mutant arm's `queryFailed: 0`
  is what stops the assertion being a constant.
- ⚠️ **Count every mutant edit.** `dropWire` asserts `removed:1`; `setParams` asserts `matched:1`
  **and** that the keys were absent beforehand. A mutant that varied nothing is an arm that measured
  nothing, and here the mutants carry the whole causal argument.

## 🔴 What s30 paid for, still live

- **A disproof is not a licence.** D23 had three clauses; s29 killed the middle one. The build works
  because the arithmetic **never needs a pitch**, not because the clause went away. ✅ **After a row
  is disproved, ask which of its claims survived.**
- 🔴 **`For Each` renders into its VISUAL PARENT.** `sectionRows` exists so the hit test counts rows
  and not the header and the refusal line. Gated in `sb005AdminPanel.test.ts` and **sabotaged**; s31
  re-measured it on the real screen (`strays:[] children:3`).
- 🔴 **A connected number cannot say `px`.** `h → card.height` renders `height: 60%; flex-grow: 60`.
  `SIDEBAR_WIDTH` records this for **parameters**, where `{value, unit}` escapes it — **a connection
  has no such form**.
- 🔴 **Check the fix is USABLE, not just correct.** `/Admin/SectionRow` is nothing but controls and
  `Drag` has no `handle` or `cancel` port. s31 re-took that reading on the template's own card:
  `Move up` hit-tests `BUTTON.ndl-controls-button` after the drag.

---

## ✅ The instruments — SIX, and they answer different questions

🔴 **Pick by what is being asked, not by which one you used last.**

| question | tool |
|---|---|
| does it *lay out* / render correctly | `render-from-disk.js` + `withRenderedPage` (§20, §30) |
| does the thing a person **deploys** work | `deploy-from-disk` + `drive-deployed.js` (§26) |
| does a **cloud function** actually do what it claims | `sb004-publication-invariant.test.ts` (§31) |
| does a **node's port** report what it declares | `d23GeometryDrive.test.ts` (§32) |
| does a **gesture** do what it looks like it does | `ac2DragGestureDrive.test.ts` (§33) |
| does **the shipped screen** do it, against a real backend | `ac2-page-editor-drag-drive.test.ts` (§34) — **new s31** |

The sixth is SB-008's harness (`helpers/site-drive.ts`: real MCP authoring → real `BackendService`
with enforcement on → headless Chrome) plus a real pointer plus **one-edit mutants of the project on
disk**. ~6 min, 23 specs. It is the only instrument in the phase that can see a defect which needs a
browser, a backend and stored rows all at once — which is both of s31's findings.

```
# the shipped-screen drive (and the mutant helpers worth stealing)
cd packages/nodegx-backend && npx jest ac2-page-editor-drag-drive

# the gesture-mechanism drive
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

- 🔴 **Read the stored rows, never the answer** — *and count them.*
- 🔴 **`buttons: 1` on every `mouseMoved`** or `react-draggable` ignores the move and the failure
  reads like *"the runtime cannot drag"*.
- 🔴 **A worker's ports must be at COMPONENT level**, not on the Inputs/Outputs nodes, or Run Tasks
  reports `run-tasks/no-completion-output` and the request hangs (CWF-018).
- 🔴 **A new endpoint owes a rule in `site-builder.security.json`** or SB-016's gate refuses a
  public bind.
- ✅ **`--sabotage` wires a connection to a port that does not exist.** If the census does not report
  it dropped, the health filter did not run and **every other reading in that run is void**.
- 🔴 **A headless export's health filter fails OPEN, silently** — `registerModule(project)` first.

## Where the phase now stands

| | verdict |
|---|---|
| **SBR-005** | ⬜ open — **and it owns AC3's gallery model** |
| **SBR-006** | AC1/2/4/5 ✅ · **AC3 🟡** — `Unpublish` is the one act of three still undriven |
| **SBR-007** | 🟢 AC1 ✅ both halves, AC4 ✅, AC5 ✅ · **AC2 ✅ ALL THREE HALVES — outcome s27, gesture s30, the real screen s31** · AC3 blocked by D15 alone · D18/D20/D24 ✅ · 🔴 **the shipped artefact cannot demonstrate AC2 until D30+D31 are fixed** |
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
| **D23** | 🟢 DISPROVED s29, kept — s30 built the thing it was blocking |
| **D24** | 🟢 FIXED + GATED s28 |
| **D25 / D26 / D27** | 🔴 `NONE` — all three registered in phase 80 |
| **D28** | 🔴 **filed s31 as phase 80 `DEF-027`** — a `Drag`'s child loses its `cssClassName` |
| **D29** | 🔴 `NONE` — one-way gate latches; **a peer's row**, filed from phase 80 s21 |
| **D30** | 🔴 **NEW s31, `NONE`** — the editor draws sections unsorted. **Template work: stays in this phase** |
| **D31** | 🔴 **NEW s31, `NONE`** — the page editor's cyclic write loop. **Template work: stays in this phase** |

## Standing context

- ✅ **Fixture: `SBR-007 Page Editor Drive`**, backend `backend_mterfnli74qwv`, port **8601**,
  `SITE_SETUP_TOKEN=drive-token-007`, `owner@sbr007.test` / `drive-pass-007`. Page
  `e921dd5b-93a5-40e4-bb75-75c37da395c0`, slug `drive-007`.
  🔴 **Drive a COPY of the backend data.** ⚠️ **Its `Section` table is EMPTY** — s31 needed sections
  and seeded its own backend rather than using this one. 🔴 **And its `/Admin/SectionRow` carries the
  three `runOnChange` parameters the template does not**, because it was minted through the editor
  and the NDA-017 migration wrote them. That is D31's whole scope statement in one file.
- ✅ **The setup token is a file, not a UI step**: `~/.noodl/backends/<id>/secrets.json`, `functions`
  namespace. `SecretsStore` re-reads on every call, so no restart.
- ✅ **The template is generated, not authored.** Edit
  `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts`, then `npm run template:site-builder`.
  `sb007Template.test.ts` asserts the committed artefact is byte-identical to a fresh generation.
  ⚠️ **Census literals live in FIVE files**; s30 moved three of them. A **parameter-only** change
  should move none — verify, do not assume.
- 🔴 **A node's port description lives in FOUR generated copies.** Changing one in the runtime owes
  `catalog:generate` → `catalog:merge` → `docs:nodes` **and** `cloud-library:generate`.
- 🔴 **A source change is not a drive until the bundle carries it** — the viewer
  (`external/viewer/noodl.viewer.js`), the deploy runtime (`external/deploy/noodl.deploy.js`, a
  *different file*), and `nodegx-backend/dist`. **A template change is different** — project data,
  read from disk every boot, so no rebuild. **s31 changed no product source**, so no bundle is stale.
- ✅ **The gates at s31, and the reading is SPLIT — stated rather than rounded up.** Every one of
  `nodegx-backend`'s **120** suites has a green reading, but not from one process:
  **119 `PASS`, zero `FAIL`** in the full run, which was **cut off before its summary line** while
  two peer suites were running; and the 120th — this session's new file — **23/23, `EXIT 0`**,
  standalone, three minutes earlier. 🔴 **The gap was found by reconciling the `PASS` count against
  `ls tests/*.test.ts`, not by reading the tail** — a run with no `Tests:` line and 119 greens looks
  exactly like a clean one. A clean single-process re-run is still owed and is cheap
  (`cd packages/nodegx-backend && npx jest`, ~10 min).
- ✅ `noodl-mcp`, `noodl-runtime` and editor `test:ci` **not re-run**: **s31 changed no product
  source** — one new test file and documentation. ⚠️ **A lone red is a flake until re-run.**
- ⚠️ **A peer was live in this phase's register during s31.** They filed **D29** from phase 80 s21 at
  12:34; D30/D31 were appended after it, never over it. The register was committed with their row in
  it — named here so it is not a surprise.
- Shared checkout: **pathspec commits only, never `git add` to stage** (except to make an untracked
  file committable); `git status --porcelain | grep '^??'` before committing. Announce editor
  launches **and** teardowns. `test:ci` alone.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
