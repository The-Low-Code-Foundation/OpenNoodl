# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s22 drove SBR-007. AC1 (preview), AC4, AC5, D17 and D14 are all now observed in the app. Two things came out of it: one owed half, and one new defect.**

Read in this order:

1. **[SBR-007 §12–§16](SBR-007-THE-PAGE-EDITOR.md)** — the drive, act by act, and §16, which is the
   session's own measurement error and the most transferable thing in the file.
2. **[D18](DEFECTS-THE-SITE-BUILDER-FOUND.md)** — new, and it is **SBR-007's own**, so it does not
   need an owner hunt. It does need a design call.

---

## 🔴 FIRST JOB — pick one of two, and they are genuinely different in kind

### (a) AC1's deployed half — the last ⬜ on an otherwise-met AC

AC1's second sentence: *"On the **deployed** panel, the same loop."* Its blocker was SBR-008, which
closed at s18, so this is **unblocked, not blocked** — it was simply not attempted at s22 because a
peer needed the editor back.

What it takes: deploy the fixture to a folder, serve it, claim, retitle, save, and read the public
heading — the same oracle §12.1 used. ⚠️ **Do not reuse the preview reading as evidence for it.**
SBR-008 §8's own scope note says its AC1 drive was the *preview* caller of the shared filter and
that the deploy half is inferred from §5.3. This is the drive that would stop inferring it.

⚠️ And the deploy path has a known unowned hole beside it: the `ports: []` exposure on
`build/deployer.ts`, recorded at the end of D14. If publish or duplicate throws
`Outputs.<x> is not a function` **on the deployed panel** while succeeding in preview, that is that
row, and it is worth more than finishing AC1 that day.

### (b) D18 — the header row a client cannot reach below 897 px

Fully measured, not yet decided. `Save page`'s right edge is pinned at **1001 px at every
viewport**; below 1001 it clips, below 897 it is gone, and `scrollWidth === innerWidth` so nothing
scrolls to it. SBR-004 §9.1 found this family on the public site and the lever there was `sizeMode`
on the Groups — 🔴 **`flex-grow` was explicitly not the lever.** Whether the answer here is that, a
wrap, or taking `Save page` out of the row is a design call.

---

## What is still NOT closed on SBR-007

| | |
|---|---|
| **AC1** deployed half | ⬜ **unblocked**, not attempted — (a) above |
| **AC2** drag to reorder | ⬜ Not built. `Drag` gives position and deltas but **no hit test**, and reordering renumbers *siblings* — a row knows only its own id and there is **no loop node**. Wants a cloud function taking (pageId, id, toIndex). A design decision, not an afternoon |
| **AC3** drop an image | 🔴 Not buildable — **D15**, `NONE`, still unowned |
| **AC3** thumbnail | 🟡 shipped, but **source-measured only** — driving it needs an OS file dialog and was not attempted |
| **AC3** galleries | ⬜ **SBR-005's**, by §2's own wording |
| **D18** | 🔴 new, SBR-007's |

🔴 **D15 is still unowned and phase 77 must not close pretending AC3 was met.**

---

## 🔴 What this session paid for

- **The instrument is a variable in a control pair.** Four consecutive readings said the public
  page's heading had disappeared after the `Preview` click. It had not. The control dump listed
  `div,span,h1,h2,h3,a`; every later dump was written `div,span`. The heading is an `<h1>`. A defect
  note was drafted, with a *plausible mechanism* attached (`RouterNavigate`'s `pm-slug` versus a slug
  in the URL path — exactly SBR-004 §10.3's family), which is what made it convincing. ✅ **The probe
  that killed it names no selectors at all**: `querySelectorAll('*')` filtered on computed
  `font-size`. When you change probes between arms, you have varied the instrument, not the subject.
- **A drive can pass on the site's own navigation.** SBR-016 §8.4's trap was live again:
  `body.innerText.includes('Retitled By The Drive')` passes at the public URL because the nav lists
  every page by title. The oracle has to be the **36px heading element**.
- **`published` is not what keeps a draft off the public site — the ACL is.** The nav query asks
  only `showInNav`. Signed in as owner, the unpublished copy is listed; signed out it is absent,
  because the published row's ACL grants `"*": {"read": true}` and the draft's does not. Only the
  **signed-out arm** could tell those apart.
- **A peer editing editor source closes your project mid-drive.** Three times this session
  (`utils/exporter/cloudFunctions.ts`, HMR "not accepted" → full reload). The backend keeps every
  reading; the DOM stamps and the webpack probe do not. Keep the two-call reopen helper to hand.

---

## Where the phase now stands

| | verdict |
|---|---|
| **SBR-005** | ⬜ open — **and it owns AC3's gallery model**, which SBR-007 deliberately did not touch |
| **SBR-006** | AC1/2/4/5 ✅ · **AC3 🟡 — s22 drove Publish and Duplicate green from the menu; `Unpublish` is the one act of the three still undriven** |
| **SBR-007** | 🟢 **AC1 (preview) ✅ DRIVEN, AC4 ✅ DRIVEN, AC5 ✅ DRIVEN** · AC1 deployed ⬜, AC2 ⬜, AC3 split · **D18 new** |
| **SBR-008** | ✅ all five, s18 — and s22 saw a fresh mint create a **titled and slugged** row first time |
| **SBR-015** | AC1/2/3 ✅ s13 · **AC4** 🟡 re-read: DEF-004(a) now writes a step per action |
| **SBR-016 / SBR-017** | ✅ s14/s15 |
| **D13** | 🔴 open, `NONE` |
| **D14** | 🟢 fixed s20, **DRIVEN s22** |
| **D15** | 🔴 `NONE` — no drop-target capability in the runtime |
| **D16** | ⚠️ `NONE` — the appearance ratchet cannot fail for a page that places a styled component |
| **D17** | 🟢 fixed s21, **DRIVEN s22** |
| **D18** | 🔴 **new — owner SBR-007** |
| **also unowned** | the same `ports: []` exposure on the **browser** deploy path (`build/deployer.ts`) |

## Standing context

- ✅ **Gate: unchanged since s21 — `test:ci` = 2894 specs, 4 failures, all four `AIX-006 style
  vocabulary` by name.** s22 ran no suites because it changed documentation only. Re-read the floor
  before trusting it; **quote a tree, not a seed** — `gitHead` in the readout is the checkout at read
  time, never authorship.
- 🔴 **Check `ps` before running `test:ci`.** Peers held it for most of s22.
- ✅ **Fixture for this task: `SBR-007 Page Editor Drive`**, backend `backend_mterfnli74qwv`, port
  **8601**, `SITE_SETUP_TOKEN=drive-token-007`, `owner@sbr007.test` / `drive-pass-007`. It holds a
  **published** page (`Retitled By The Drive` / `drive-007`) and a **draft** copy — so it is already
  a two-arm fixture for anything about published-versus-draft. Its `Page` class has all 11 columns.
- ✅ **The setup token is a file, not a UI step**: `~/.noodl/backends/<id>/secrets.json`, `functions`
  namespace. `SecretsStore` re-reads it on every call, so writing it needs no restart.
- ✅ **The template is generated, not authored.** Edit
  `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts`, then `npm run template:site-builder`.
  `sb007Template.test.ts` asserts the committed artefact is byte-identical to a fresh generation.
- ✅ **The artefacts are the cheapest oracle in this phase.** `~/.noodl/backends/<id>/data/local.db`
  (the class tables), `~/.noodl/backends/<id>/executions.sqlite` at the backend **root**
  (`workflow_executions`, `execution_steps`), `~/.noodl/backends/<id>/workflows/*.workflow.json`,
  and `<project>/components/__cloud__/<fn>/nodes.json`.
- 🔴 **A source change is not a drive until the bundle carries it.** Grep
  `packages/noodl-editor/src/external/viewer/noodl.viewer.js` for your symbol immediately before the
  act.
- ✅ **Reaching the editor's models headlessly**:
  `window.webpackChunknoodl_editor.push([['probe'], {}, (r) => { window.__wr = r; }])`, then
  `__wr('./src/editor/src/models/projectmodel.ts').ProjectModel.instance`.
- ✅ **Driving the viewer**: `Noodl.Navigation.navigateToPath('/admin/pages')`; wrap every
  `cdp eval` in `(() => { … })()`; **stamp in one call and click in the next**. `cdp type` clicks
  first, so it cannot replace a field's value — select-all needs `Emulation.setFocusEmulationEnabled`
  + `setSelectionRange` + `Input.insertText` **on one connection**.
- ✅ Viewer measured **988 × 313** — measure it, assume neither. `Emulation.setDeviceMetricsOverride`
  on the same connection is how D18 was swept.
- 🔴 `closest('[class*=Card]')` matches the *Name* span — use `[class*=__Card--]`.
- 🔴 `getConnectionHealth` and `evaluateConnectionHealth` take OPPOSITE spellings on one class.
  Prefer `exportComponent`. Force `graph.evaluateHealth()` before reading health or exporting.
  ⚠️ `kept === authored` proves nothing alone — pair it with a port that must read **false**.
- Shared checkout: **pathspec commits only, never `git add` to stage**; `git status --porcelain |
  grep '^??'` before committing. Announce editor launches **and** teardowns. `test:ci` alone.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
