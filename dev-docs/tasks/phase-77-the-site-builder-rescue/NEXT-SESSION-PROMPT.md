# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s23 fixed D18 in the template and found D19 — the editor suite had been red at HEAD for three commits. Neither of those is a drive. The editor was held by a peer all session.**

Read in this order:

1. **[SBR-007 §17–§19](SBR-007-THE-PAGE-EDITOR.md)** — D18's real mechanism, what its own row had
   wrong, and the gate's honest reach.
2. **[D19](DEFECTS-THE-SITE-BUILDER-FOUND.md)** — the runner nobody watches. Short, and it changes
   how you should read the standing gate note below.

---

## 🔴 FIRST JOB — the two open ones are unchanged, and D18 added a third

### (a) D18's drive — the cheapest of the three, and it closes something

**Nothing has seen the fix on a screen.** The lever (`flexWrap: 'wrap'` + `rowGap` on
`/Pages/PageEditor`'s `headerRow`) is proven from `layout.ts:82` and pinned by a mutant, but that is
a source argument and an artefact assertion — not a drive.

⚠️ **The existing fixture cannot show it.** `SBR-007 Page Editor Drive` was minted from the **old**
template and still holds the unwrapped row; the fix does not reach an existing project
retroactively. **Mint a fresh project from the template** first.

Then re-run §14's own probe: `elementFromPoint` on `Save page` at **1440 / 988 / 800 / 600**,
expecting a hit test of `SELF` at every width and the row's height to grow by one line below
~1001px. 🔴 Take the reading with **the same probe in every arm** — §16 is what that rule cost.

### (b) AC1's deployed half — still the last ⬜ on an otherwise-met AC

Unblocked since SBR-008 closed at s18, not attempted at s22 or s23. Deploy the fixture to a folder,
serve it, claim, retitle, save, read the public heading — the same oracle §12.1 used. ⚠️ **Do not
reuse the preview reading as evidence**: SBR-008 §8 says its AC1 drive was the *preview* caller and
the deploy half is inferred from §5.3.

⚠️ Known unowned hole beside it: the `ports: []` exposure on `build/deployer.ts` (end of D14). If
publish or duplicate throws `Outputs.<x> is not a function` **on the deployed panel** while
succeeding in preview, that is that row, and it is worth more than finishing AC1 that day.

### (c) AC2 — still a design decision, not an afternoon

`Drag` gives position and deltas but **no hit test**, and reordering renumbers *siblings* — a row
knows only its own id and there is **no loop node**. Wants a cloud function taking
(pageId, id, toIndex).

---

## What is still NOT closed on SBR-007

| | |
|---|---|
| **AC1** deployed half | ⬜ **unblocked**, not attempted — (b) |
| **AC2** drag to reorder | ⬜ not built — (c) |
| **AC3** drop an image | 🔴 not buildable — **D15**, `NONE`, still unowned |
| **AC3** thumbnail | 🟡 shipped, **source-measured only** — driving needs an OS file dialog |
| **AC3** galleries | ⬜ **SBR-005's**, by §2's own wording |
| **D18** | 🟢 fixed s23, 🔴 **UNDRIVEN** — (a) |

🔴 **D15 is still unowned and phase 77 must not close pretending AC3 was met.**

---

## 🔴 What this session paid for

- **A green quoted for one runner says nothing about the other.** The standing note —
  *"`test:ci` = 2894 specs, 4 failures, all four `AIX-006` by name"* — is true and was being read as
  "the gates are green". `test:main` had been **red at HEAD since `7913e6b6`**, and SBR-017,
  SBR-016 and SBR-007 s21 all landed on top of it. Name the runner every time you quote a floor.
- **Attribute a red before assuming it is yours.** Three counts were wrong the moment the editor
  suite ran after a template change — the obvious reading was that the change caused them. Computing
  them from `git show HEAD:<artefact>` **and** the working tree gave identical numbers (22/15/274),
  which placed the reds before this session in one read-only step and cost nothing.
- **A stale literal is repaired with its reason, never bumped.** The file's own comment says *"The
  literal is the point"* — the ledger exists so a rewrite that renamed ids instead of regenerating
  them cannot stay green on a set that had SHRUNK. Bumping 236 → 274 silently would have discarded
  exactly that.
- **A defect row's cited section can be wrong, and so can its family.** D18 pointed at SBR-004 §9.1
  (it is §8.2/§10) and called it the same family — but SBR-004's was a **height** problem *cured* by
  `contentSize`, and D18 is a **width** problem *caused* by it. Reading `layout.ts:82` before
  building was what separated them.
- **Say what a gate cannot see.** The obvious rule for D18 — *row + children cannot shrink* — flags
  five rows, and §14 had already **measured two of them reflowing correctly**. The check grades a
  narrower, real property instead (a wire-fed `Text` at display size), and the write-up says so.

---

## Where the phase now stands

| | verdict |
|---|---|
| **SBR-005** | ⬜ open — **and it owns AC3's gallery model** |
| **SBR-006** | AC1/2/4/5 ✅ · **AC3 🟡** — `Unpublish` is the one act of three still undriven |
| **SBR-007** | 🟢 AC1 (preview) ✅, AC4 ✅, AC5 ✅ driven s22 · AC1 deployed ⬜, AC2 ⬜, AC3 split · **D18 fixed s23, undriven** |
| **SBR-008** | ✅ all five, s18 |
| **SBR-015** | AC1/2/3 ✅ s13 · **AC4** 🟡 re-read: DEF-004(a) now writes a step per action |
| **SBR-016 / SBR-017** | ✅ s14/s15 |
| **D13** | 🔴 open, `NONE` |
| **D14** | 🟢 fixed s20, DRIVEN s22 |
| **D15** | 🔴 `NONE` — no drop-target capability in the runtime |
| **D16** | ⚠️ `NONE` |
| **D17** | 🟢 fixed s21, DRIVEN s22 |
| **D18** | 🟢 fixed s23 — 🔴 **undriven** |
| **D19** | 🟢 the three reds fixed s23 — 🔴 **making `test:main` watched is `NONE`** |
| **also unowned** | the `ports: []` exposure on the **browser** deploy path (`build/deployer.ts`) |

## Standing context

- ✅ **Gates, s23, and name the runner**: `noodl-mcp` **69 suites / 961 tests / exit 0**;
  `noodl-editor` **`test:main` 363 suites / 6105 tests / exit 0** (green *because* s23 fixed D19).
  🔴 **`test:ci` was NOT run this session** — a peer held the editor throughout. Its last known floor
  is s21's **2894 specs, 4 failures, all four `AIX-006 style vocabulary` by name**; re-read it before
  trusting it, and **quote a tree, not a seed** (`gitHead` is the checkout at read time, never
  authorship).
- 🔴 **Check `ps` before `test:ci` or a launch.** A peer held the only editor for all of s22 and s23
  (a live viewer on `:8574`). Two editors cannot share 9222.
- ✅ **Fixture: `SBR-007 Page Editor Drive`**, backend `backend_mterfnli74qwv`, port **8601**,
  `SITE_SETUP_TOKEN=drive-token-007`, `owner@sbr007.test` / `drive-pass-007`. Holds a **published**
  page (`Retitled By The Drive` / `drive-007`) and a **draft** copy — a two-arm fixture for anything
  about published-versus-draft. ⚠️ **Minted from the pre-D18 template**, so it cannot show D18's fix.
- ✅ **The setup token is a file, not a UI step**: `~/.noodl/backends/<id>/secrets.json`, `functions`
  namespace. `SecretsStore` re-reads on every call, so no restart.
- ✅ **The template is generated, not authored.** Edit
  `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts`, then `npm run template:site-builder`.
  `sb007Template.test.ts` asserts the committed artefact is byte-identical to a fresh generation.
- ✅ **The artefacts are the cheapest oracle in this phase.** `~/.noodl/backends/<id>/data/local.db`,
  `~/.noodl/backends/<id>/executions.sqlite` at the backend **root**,
  `~/.noodl/backends/<id>/workflows/*.workflow.json`, and
  `<project>/components/__cloud__/<fn>/nodes.json`.
- 🔴 **A source change is not a drive until the bundle carries it.** Grep
  `packages/noodl-editor/src/external/viewer/noodl.viewer.js` for your symbol immediately before the
  act.
- ✅ **Reaching the editor's models headlessly**:
  `window.webpackChunknoodl_editor.push([['probe'], {}, (r) => { window.__wr = r; }])`, then
  `__wr('./src/editor/src/models/projectmodel.ts').ProjectModel.instance`.
- ✅ **Driving the viewer**: `Noodl.Navigation.navigateToPath('/admin/pages')`; wrap every `cdp eval`
  in `(() => { … })()`; **stamp in one call and click in the next**. `cdp type` clicks first, so it
  cannot replace a field's value — select-all needs `Emulation.setFocusEmulationEnabled` +
  `setSelectionRange` + `Input.insertText` **on one connection**.
- ✅ Viewer measured **988 × 313** — measure it, assume neither.
  `Emulation.setDeviceMetricsOverride` on the same connection is how D18 was swept.
- 🔴 `closest('[class*=Card]')` matches the *Name* span — use `[class*=__Card--]`.
- 🔴 `getConnectionHealth` and `evaluateConnectionHealth` take OPPOSITE spellings on one class.
  Prefer `exportComponent`. Force `graph.evaluateHealth()` before reading health or exporting.
  ⚠️ `kept === authored` proves nothing alone — pair it with a port that must read **false**.
- Shared checkout: **pathspec commits only, never `git add` to stage**; `git status --porcelain |
  grep '^??'` before committing. Announce editor launches **and** teardowns. `test:ci` alone.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
