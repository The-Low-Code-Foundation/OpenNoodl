# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s21 built SBR-007's screen. The first job is to DRIVE it — and that drive is also the one D14 never got.**

Read in this order:

1. **[SBR-007 §5–§11](SBR-007-THE-PAGE-EDITOR.md)** — what was built, what was re-measured, and the
   three ACs that are not closed.
2. **[D15, D16, D17](DEFECTS-THE-SITE-BUILDER-FOUND.md)** — the three rows s21 added. **D15 has no
   owner and needs one.**

---

## 🔴 FIRST JOB — drive AC1, because two debts are paid by the same drive

**AC1's loop: retitle → save → the public site shows the new title.** Nothing blocks it; the screen
is built and every gate is green. Two other things ride on it:

- ⚠️ **D14's fix has still never been driven.** It is proved by a red-then-green spec pair, not by
  the app: no fixture was redeployed and no cloud function was called after the fix. If publish or
  duplicate still throws `Outputs.<x> is not a function`, the export is not the only place ports are
  lost — and that is worth more than finishing AC1 that day.
- 🟡 **AC4 and AC5 are built but unobserved.** `save.done → record.fetch` is what makes the
  unsaved-changes marker clear and what makes the screen show the stored row rather than the input's
  echo. Both are one drive away from evidence.

**What to watch while driving**, since it is the first time this screen is seen running:

- the rail is present *while editing* (D17's fix) and `active: 'pages'` does not go dark;
- the marker appears on the first keystroke and **is absent on load** — that is the whole point of
  §7's comparison, and a marker that is lit before you touch anything means the guard failed;
- `Preview` lands on the real slug, not on the literal `{slug}` (SBR-006's `8661ce83` was that bug).

---

## What is NOT closed on SBR-007, and why

| | |
|---|---|
| **AC2** drag to reorder | ⬜ Not built. `Drag` gives position and deltas but **no hit test**, and reordering means renumbering *siblings* — a row knows only its own id and there is **no loop node**. It wants a cloud function taking (pageId, id, toIndex). That is a design decision, not an afternoon |
| **AC3** drop an image | 🔴 **The drop gesture is not buildable.** See **D15** |
| **AC3** thumbnail | 🟢 Already shipped — and had been all along |
| **AC3** galleries | ⬜ **SBR-005's**, by §2's own wording |

🔴 **D15 is unowned and phase 77 must not close pretending AC3 was met.** The runtime has no
drop-target API of any kind; it needs a viewer node, which is not this task's and not SBR-005's.

---

## 🔴 Four things this session paid for

- **A negative grep is worth nothing without a control in the same command.** The drop-target
  measurement was first run with the two search paths in an unquoted shell variable. zsh does not
  word-split, so the paths did not exist and **both the finding and its control came back 0** — an
  absence that reads exactly like the discovery. The control is what caught it.
- **A green gate can be asserting the defect.** `sb005AdminPanel`'s AC5 pinned the admin shell's
  placements at `['Pages/Admin','Pages/ThemeEditor']` and was green for two sessions; the missing
  third placement was D17. ⚠️ And its second assertion had the **wrong shape** — "every placement is
  unique" was accidentally equivalent to the real invariant while there were two, and reddens on a
  correct screen at three. **When a literal moves, re-read what the assertion means, not just what
  it counts.**
- **A floor goes stale GENEROUS, and that is the dangerous direction.** Three of the four names in
  `BARE_PAGES_TODAY` had been paid by other tasks and never removed — so §4 could not have caught
  any of them regressing. Now `[]`.
- **A ratchet can be satisfied by a placement.** D16: `barePages()` walks the reachability closure,
  so a page passes §4 by placing a styled component even with an entirely unstyled body — sabotage
  reads "styled" with all nine of its own structure params stripped. **Do not cite §4 as evidence
  that a screen is designed**; cite the page's own tree.

---

## Where the phase now stands

| | verdict |
|---|---|
| **SBR-005** | ⬜ open — **and it owns AC3's gallery model**, which SBR-007 deliberately did not touch |
| **SBR-006** | AC1/2/4/5 ✅ · **AC3 🟢 unblocked by s20's D14 fix, not re-driven** |
| **SBR-007** | 🟢 **built s21** — AC5 ✅, AC4 ✅ by construction, **AC1 🟡 needs the drive**, AC2 ⬜, AC3 split |
| **SBR-008** | ✅ all five, s18 — and s21 confirmed it still covers 8 new `prop-` wires (19 → 27, unresolved still 0) |
| **SBR-015** | AC1/2/3 ✅ s13 · **AC4** 🟡 re-read: DEF-004(a) now writes a step per action |
| **SBR-016 / SBR-017** | ✅ s14/s15 |
| **D13** | 🔴 open, `NONE` |
| **D14** | 🟢 fixed s20 — ⚠️ **never driven** |
| **D15** | 🔴 **new, `NONE`** — no drop-target capability in the runtime |
| **D16** | ⚠️ **new, `NONE`** — the appearance ratchet cannot fail for a page that places a styled component |
| **D17** | 🟢 **fixed s21** — the page editor now wears the admin shell |
| **also unowned** | the same `ports: []` exposure on the **browser** deploy path (`build/deployer.ts`), recorded at the end of D14 |

## Standing context

- ✅ **Gate at HEAD: `test:ci` = 2894 specs, 4 failures, all four `AIX-006 style vocabulary` by
  name** — the documented floor, seed 65644, fresh `test-results.json` (note: the readout is at
  `packages/noodl-editor/tests/test-results.json`, not the package root). `noodl-mcp` 958/958,
  `typecheck:mcp` clean.
- 🔴 **Check `ps` before running `test:ci`.** A peer's run was already in flight this session; two
  peer commits landed mid-session and swept nothing, but `gitHead` in the readout is **theirs** —
  it is the checkout at read time, never authorship.
- ✅ **The template is generated, not authored.** Edit `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts`,
  then `npm run template:site-builder`. `sb007Template.test.ts` asserts the committed artefact is
  byte-identical to a fresh generation, so an un-regenerated edit reddens rather than ships.
- ✅ **The artefacts are the cheapest oracle in this phase.** A deployed bundle is a plain file:
  `~/.noodl/backends/<id>/workflows/*.workflow.json`; the project that produced it is another:
  `<project>/components/__cloud__/<fn>/nodes.json`. Also
  `sqlite3 ~/.noodl/backends/<id>/executions.sqlite` (backend **root**, not `data/`) —
  `workflow_executions` and `execution_steps`, timestamps **local**.
- 🔴 **Drive fixtures are spent for the no-column question.** `SBR-017 Sign In Drive`
  (`backend_mte82r1qhnr87`, 8599, `owner@sbr017.test` / `drive-pass-017`) and `SBR-016 Arrive Drive`
  (`backend_mte9omazclxw6`, 8600, `owner@sbr016.test` / `drive-pass-016`) both grew their `Page`
  class. A fresh mint is needed. `SBR-015 AC1 Drive` (`backend_mte62ofkj8whc`, 8598) is still in the
  **refusal** arm.
- 🔴 **A source change is not a drive until the bundle carries it.** Grep
  `packages/noodl-editor/src/external/viewer/noodl.viewer.js` for your symbol immediately before the
  act; a peer's `noodl-runtime` edit rebuilds it mid-session.
- ⚠️ **A peer editing editor source will full-reload your editor and close your project.** Keep a
  two-call reopen helper and re-install the webpack probe, which the reload clears.
- ✅ **Reaching the editor's models headlessly**:
  `window.webpackChunknoodl_editor.push([['probe'], {}, (r) => { window.__wr = r; }])`, then
  `__wr('./src/editor/src/models/projectmodel.ts').ProjectModel.instance`.
- 🔴 `closest('[class*=Card]')` matches the *Name* span — use `[class*=__Card--]`.
- 🔴 `getConnectionHealth` and `evaluateConnectionHealth` take OPPOSITE spellings on one class.
  Prefer `exportComponent`. Force `graph.evaluateHealth()` before reading health or exporting.
  ⚠️ `kept === authored` proves nothing alone — pair it with a port that must read **false**.
- ✅ Viewer measured **988 × 313** — measure it, assume neither.
  `Noodl.Navigation.navigateToPath('/admin/pages')`; wrap every `cdp eval` in `(() => { … })()`;
  stamp in one call and click in the **next**. ⚠️ The editor's preview webview has measured
  `96 × 0`, which makes every CDP click land and hit-test to `<html>` —
  `Emulation.setDeviceMetricsOverride` on the same connection is the fix.
- Shared checkout: **pathspec commits only, never `git add` to stage**; `git status --porcelain |
  grep '^??'` before committing. Announce editor launches **and** teardowns. `test:ci` alone.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
