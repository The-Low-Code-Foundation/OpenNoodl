# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s27 built and drove AC2's outcome. Its gesture turned out to be a product row, and driving it found a defect that is not about ordering at all.**

Read in this order:

1. **[SBR-007 §31](SBR-007-THE-PAGE-EDITOR.md)** — what shipped, the drive, and what it cost.
2. **[D23](DEFECTS-THE-SITE-BUILDER-FOUND.md)** and **[D24](DEFECTS-THE-SITE-BUILDER-FOUND.md)**,
   both new and both `NONE`.

---

## 🔴 FIRST JOB

### (a) Richard's, and it is still small and still unanswered

**D20's fix moved the actions.** The heading grows as well as shrinks — `layout.ts` assigns
`flexGrow` and `flexShrink` in the same branch, so there is no third option — which puts
`Preview`/`Save page` at the **right** of the header rather than clustered beside the title. Nothing
is clipped at any width; the question is only whether that look is wanted. **Two parameters revert
it** (`sizeMode: 'contentSize'`, drop `width`) at the cost of putting D20 back. Carried from s26,
untouched by s27.

### (b) 🔴 D24 — one endpoint's traffic can 400 another, and the mechanism is unknown

`reorderSection` traffic makes `duplicatePage` fail **4 runs in 5** with
`run-tasks/already-running` on **duplicatePage's own node**, from state left by an **earlier
request**. Controls, five runs each, same slot: `publishPage` × 10 → **5/5 green**;
`submitContactForm` × 7 → **5/5 green**. So it is not call volume and not "any traffic".

⚠️ **Do not accept a tidy explanation here.** s27 recorded two that fitted and were wrong: an id
shift (the ids were **identical**, measured after the theory) and bundle order (green 3/3, then
**1/5** — both "stable" readings were luck). The drive is placed after every `duplicatePage` call,
which is deterministic, **not a fix**.

A person hits this: reorder sections, then duplicate the page.

### (c) AC3, still the one that cannot be met

**D15** — no drop-target capability in the runtime, so **AC3 is not met and phase 77 must not close
pretending it is.** **D23** is its twin, found by AC2: no visual node reports its rendered geometry,
so a drag cannot compute an index either. Both `NONE`, and both would be closed by the same small
thing — a `domelement` output on `Group` (`video.ts:283-288` is the three-line template).

### And the rest nobody owns

**D13**, **D16**, **D22** (no `textOverflow` on `Text`), making `test:main` watched (**D19**), and
the `ports: []` exposure on the **browser** deploy path (`build/deployer.ts`, end of D14).

---

## ⚠️ Two things about this checkout, from s27

- 🔴 **A peer's commit swept a file mid-session.** `6deabdd4` (09:00, DEF-012) carried
  `sb004-publication-invariant.test.ts` — s27's drive — into a commit about something else, leaving
  HEAD briefly holding a spec whose components were not committed yet. **Never rewrite to un-sweep**;
  s27 committed the rest promptly (`102c614e`) and HEAD is coherent. Check `git log -1 -- <path>`
  before assuming an edit of yours is still yours to commit.
- ✅ **The template gate that was red for a peer in s26 is green.** `withAuthoredScriptPorts` landed
  in `e6f26ffa` and the artefact was regenerated. The two literal NUL bytes in
  `packages/noodl-mcp/src/scriptPorts.ts` are **still there** — they make the file unsearchable by
  `git grep` (reported `Binary file … matches`) and invisible to plain `grep`. Worth fixing as
  searchability; it never broke anything.

---

## ✅ The instruments — there are now THREE, and they answer different questions

🔴 **Pick by what is being asked, not by which one you used last.**

| question | tool |
|---|---|
| does it *lay out* / render correctly | `render-from-disk.js` + `withRenderedPage` (§20, §30) |
| does the thing a person **deploys** work | `deploy-from-disk` + `drive-deployed.js` (§26) |
| does a **cloud function** actually do what it claims | `sb004-publication-invariant.test.ts` (§31) |

The third is the one s27 needed and the one the handoffs had not named. It authors
`SB004_COMPONENTS` through the **real MCP door**, bundles them with `bundleAuthoredComponents`, runs
a **real backend with `devOpen: false`**, and drives functions over HTTP. It is fast (~3s) and it is
the only instrument that can say a write happened.

- 🔴 **Read the stored rows, never the answer.** The response says where the function *thinks* it put
  things; that is the claim under test, not the evidence for it.
- 🔴 **A worker's ports must be at COMPONENT level, not on the Inputs/Outputs nodes.** The bundler
  derives them (`'gives each helper the component ports…'`); `site-builder.content.json` shows
  `ports: null` and that is fine. Without them Run Tasks reports `run-tasks/no-completion-output`
  and the request **hangs** (CWF-018).
- 🔴 **A new endpoint owes a rule in `site-builder.security.json`**, or SB-016's gate refuses a
  public bind. Its *"two of four land on the wrong rule"* finding is now **three of five**.

```
# the layout drive (s26's shape) — never serve the fixture's own rows
cp -R ~/.noodl/backends/backend_mterfnli74qwv <copy>
node packages/nodegx-backend/dist/cli.js serve --data-dir <copy> --port 8601
node <probe>.js <project-dir>

# the deploy drive
node scripts/devtools/build-deploy-from-disk.mjs /tmp/deploy-from-disk.cjs
cd packages/noodl-editor && node /tmp/deploy-from-disk.cjs <v2-project-dir> --out <folder> [--sabotage]
node scripts/devtools/drive-deployed.js <folder> [--port N] [--hold]

# the cloud-function drive
cd packages/nodegx-backend && npx jest sb004-publication-invariant
```

- ✅ **`--sabotage` wires a connection to a port that does not exist.** If the census does not report
  it dropped, the health filter did not run and **every other reading in that run is void**.
- 🔴 **A headless export's health filter fails OPEN, silently** — `registerModule(project)` first.

## 🔴 What s27 paid for, beyond the fix

- **A checker's classification is only as good as the shapes it has met.** `sb007Template`'s SBR-016
  walk put `CloudFunction2` in `TRANSPARENT` and, finding no `runOnValueChange` entry, fell through
  to *"a value landing runs it"* — untrue, `scheduleCall` is *"the only method the `Call` port
  reaches"*. It had never been reached because no cloud call had ever sat on a query's trigger path.
  ✅ **With the checker fixed the pinned literal did NOT move** — that is what says the hole was the
  cause rather than the change.
- **A control's population is part of the control.** Grepping `plug: 'output'` over the viewer's
  nodes returned **18** hits for **51** `outputs:` blocks — viewer nodes do not declare outputs that
  way. A finding of 0 against that denominator would have been a fact about the grep.
- 🔴 **Two theories that fitted and excluded nothing, both measured false**: see (b). The habit that
  caught both was re-running, not reasoning — a 3/3 green became 1/5.
- **`CloudFunction2` has no `success` port** (ERG-001 renamed it `done`), and **`failure` is a signal
  while `mounted` is a value port** — a `States` node is the recorded repair.
- **`Run Tasks` fires `Done` on an EMPTY list, deliberately** (`runtasks.ts:664-668`) — *"an empty
  list is a run that completed"*. `unchanged` means a run that never started. s27 wrote the opposite
  in a comment first and the source corrected it.

---

## Where the phase now stands

| | verdict |
|---|---|
| **SBR-005** | ⬜ open — **and it owns AC3's gallery model** |
| **SBR-006** | AC1/2/4/5 ✅ · **AC3 🟡** — `Unpublish` is the one act of three still undriven |
| **SBR-007** | 🟢 AC1 ✅ both halves, AC4 ✅, AC5 ✅ · **AC2 🟢 outcome BUILT + DRIVEN s27, gesture 🔴 D23** · AC3 split · D18 ✅ · D20 ✅ |
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
| **D23** | 🔴 **NEW s27, `NONE`** — no node reports rendered geometry, so **no drag can hit-test** |
| **D24** | 🔴 **NEW s27, `NONE`** — a cloud graph outlives its request; one endpoint 400s another |

## Standing context

- ✅ **Fixture: `SBR-007 Page Editor Drive`**, backend `backend_mterfnli74qwv`, port **8601**,
  `SITE_SETUP_TOKEN=drive-token-007`, `owner@sbr007.test` / `drive-pass-007`. Page
  `e921dd5b-93a5-40e4-bb75-75c37da395c0`, slug `drive-007`.
  🔴 **Drive a COPY of the backend data.** The fixture's project is **still the pre-D18 control
  arm**, which is what makes it reusable. Keep it that way. Its title reads
  `Retitled By The Drive` (21 ch).
- ✅ **The setup token is a file, not a UI step**: `~/.noodl/backends/<id>/secrets.json`, `functions`
  namespace. `SecretsStore` re-reads on every call, so no restart.
- ✅ **The template is generated, not authored.** Edit
  `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts`, then `npm run template:site-builder`.
  `sb007Template.test.ts` asserts the committed artefact is byte-identical to a fresh generation.
  ⚠️ **A new component moves census literals in FIVE files** — s27 moved 14 of them across
  `sb007Template`, `sb005AdminPanel`, `sb016`, `sb017-helper`, `def015` and `sb017-deploy-parity`.
  Read each one before bumping it: one of them counts *code nodes that declare a port*, not code
  nodes, and s27 wrote the comment backwards first.
- 🔴 **A source change is not a drive until the bundle carries it** — the viewer
  (`external/viewer/noodl.viewer.js`), the deploy runtime (`external/deploy/noodl.deploy.js`, a
  *different file*), and `nodegx-backend/dist`. **A template change is different** — project data,
  read from disk every boot, so no rebuild.
- ✅ **Reaching the editor's models headlessly**:
  `window.webpackChunknoodl_editor.push([['probe'], {}, (r) => { window.__wr = r; }])`, then
  `__wr('./src/editor/src/models/projectmodel.ts').ProjectModel.instance`.
- ✅ **Driving the viewer**: `Noodl.Navigation.navigateToPath('/admin/page/<pageId>')`; wrap every
  `cdp eval` in `(() => { … })()`; **stamp in one call and click in the next**.
- 🔴 **`cdp.js` and `render-report.js` both export `connect`, `evaluate` and `httpJson`, and they are
  DIFFERENT FUNCTIONS.** Wait for a target of type **`page`**, not merely for `/json/list` to answer.
- 🔴 `getConnectionHealth` and `evaluateConnectionHealth` take OPPOSITE spellings on one class.
- ✅ **The gates, all green at s27**: `noodl-mcp` 966, `nodegx-backend` 1405,
  editor `test:ci` **2905 specs, 4 failures — the recorded AIX-006 floor**, seed 99159.
- Shared checkout: **pathspec commits only, never `git add` to stage**; `git status --porcelain |
  grep '^??'` before committing. Announce editor launches **and** teardowns. `test:ci` alone.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
