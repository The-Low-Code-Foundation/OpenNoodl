# Phase 82 — next session

**Session 37 closed every buildable row §D listed.** Five commits, all on `cline-dev`, all
pathspec-scoped, nothing else in this very dirty checkout swept in. What is left in this phase is
either **Richard's** (rulings, a drive, a publish, a tag) or **one other task's owner's**
(REL-002a — see §C, it is the most actionable thing in this file for somebody who is not Richard).

---

## ✅ §A RICHARD'S LIST — the four he asked for, and the smaller ones

| # | what he asked for | state |
|---|---|---|
| 1 | **Add a person / list yourself** | 🟢 BUILT s33, COMMITTED s35 (`e39393c1`). ⏳ Nothing is deployed — see §C1 |
| 2 | **Add a chat message from the editor** | 🟢 BUILT s34, COMMITTED s35 (`e39393c1`, FB-013). ⏳ Never driven in a running editor |
| 3 | **Circle → a Shape/SVG node** | 🟢 STAGE 1 COMMITTED s35 (`64fca4e7`). Stages 2 (`cornerRadius`, `points`) and 3 (`svgSource`) remain |
| 4 | **Dropdown — two defaults + a beginner "click plus and type" mode** | 🟢 default-items half COMMITTED s35 (`7696420f`). ⬜ **The beginner JSON mode needs a DECISION from Richard** between three directions — [`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §3 |

### §A4 — the smaller ones, all now closed except the two that are not ours

| what | state |
|---|---|
| **Filter properties bar** — was 1.00:1 in both themes | 🟢 BUILT+COMMITTED s36 (`645c3922`) |
| **"Add style variant" vs "Style → Variant"** — invisible divider | 🟢 BUILT+COMMITTED s36 (`645c3922`) |
| **Visual States section** — the SAME invisible divider, one section down | 🟢 **BUILT+COMMITTED s37** (`5d1c7786`). `.property-editor-visual-states`'s `border-bottom` was `var(--theme-color-bg-1)`, the same token as the ground under it; now `--theme-color-border-default`, matching `.property-header-bar` in the same stylesheet family. No new NAT-001 row, following the `.variants-editor` precedent: `palette-contrast.spec.ts`'s NAT-005 already grades `border-default` as a visible line, and this introduces no new token pairing. Readings: 262/262 unchanged, `tsc -p noodl-editor` clean |
| **Button `outline`/`ghost` icons** | 🟢 **COMMITTED s37** — `04697305` + `8c5e5b10`. See §B1: the handoff was wrong about this twice |
| **Video node — mp4 only, no YouTube anywhere** | 🟢 **COMMITTED s37** (`edccfe53`) — it was blocked only on the icon-colour work landing, and that landed first in the same session. Description string only; no test pinned the old sentence (grepped the whole tree). Real YouTube/Vimeo support is still unbuilt and unowned: it needs an iframe path that does not exist plus a CSP decision — [`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §2 |
| **Design Tokens panel is `devMode`-gated, `TokenPicker` has zero call sites** | ⬜ FIX-015's successor phase. 🔴 in a packaged build the panel is not registered at all |
| **Default tutorial content** | ⬜ FB-012, phase 75 — blocked on his brief, on purpose |

---

## 🔴 §B WHAT SESSION 37 DID, AND WHERE THE LAST HANDOFF WAS WRONG

Five commits, in order: `04697305`, `8c5e5b10`, `5d1c7786`, `edccfe53`, `c7cb59b6`.

### §B1 The "Button icon fix" was TWO defects, not one, and it already had its tests

§D item 1 said to check three uncommitted files (`Button.tsx`, `button.ts`, `RadioButton.tsx`) and
that if they looked finished they **"still need the render gate over all five variants"** before
anyone called it closed. Both halves of that were wrong:

- 🔴 **The change was wider than three files.** `node-shared-port-definitions.ts` — not in the
  handoff's list — carries the actual fix: `addIconInputs`'s shared default `iconColor: '#FFFFFF'`
  → `'#000000'`, which reaches the Icon node, Checkbox, Radio Button and Button at once. Richard,
  2026-09-04: *"of course it's WHITE by default so I didn't see it… Can we make every icon
  everywhere black by default please?"* `button.ts`'s `iconColor: undefined` is the **exemption**
  to that change, not the change.
- 🔴 **`RadioButton.tsx` was not part of it at all.** Its diff is a different defect — `_renderIcon`
  drew unconditionally, so an author icon appeared on **every option in the group at once**. It came
  with a matching `Checkbox.tsx` fix (also uncommitted, also unmentioned) for the same defect
  Richard reported from the checkbox side: *"I still see the check icon inside the check box"*
  after unchecking.
- 🔴 **The test coverage already existed**, written alongside the source: `tests/icon-colour-defaults.test.ts`
  (untracked, so invisible to a `git status` skim that only reads ` M` lines) and additions to
  `tests/fb-020-checkbox-shows-its-state.test.tsx`. Run against the working tree: **32/32 green**.
  The suite even derives its population from `addIconInputs(` call sites on disk, so a future
  icon-bearing node cannot ship without stating its default. Nothing needed writing.

Committed as the two logical changes they are: `04697305` (state-gated icons, Checkbox +
RadioButton) and `8c5e5b10` (icon colour default, with Button's exemption pinned to the
`ButtonConfig` values it depends on).

⚠️ **Method note for the next reader.** A subagent asked to survey this in a **`isolation: worktree`**
agent reported, confidently and in detail, that none of these tests existed and that Checkbox had no
such feature. A fresh worktree contains **committed content only** — it cannot see an untracked
spec or a working-tree edit, and it will describe their absence as a fact about the repo. The
direct `npx jest` run in the real checkout is what settled it. (This is also why this repo's memory
says never to use `isolation: worktree` here.)

### §B2 The catalog was regenerated without capturing anybody else's work

`node-catalog.json` had **seven** deltas against source. Four were the icon-colour defaults and one
was the Video Source sentence — both now committed here. The other **two belong to REL-002a** and
are still uncommitted (§C).

The regeneration protocol, since this file is a whole-file artefact several tasks feed:

1. `--out-dir` into scratch, diff, never generate in place first.
2. `cp -a` both REL-002a files aside, `md5` them, `git checkout HEAD --` **only those two**,
   regenerate, confirm the diff is **exactly** the five deltas this session owns and nothing else.
3. Restore from the backups, `md5` again to prove byte-identity. **No `git stash`** — it would have
   taken the other ~110 modified files in this checkout with it.

`node-catalog.d.ts` regenerated identical, so it is not in the commit. `catalog:check` is
`EXIT=1` — measured with the redirect, not through a pipe — for **two** deltas now, down from
seven, and both are REL-002a's.

⚠️ `node-catalog-enriched.json` (`catalog:merge`) is **also stale and deliberately untouched**:
regenerating it would sweep in an unrelated uncommitted one-line edit to
`docs/node-catalog/examples/ui-form-field.json`. It needs whoever owns that edit.

### §B3 Readings, all taken 2026-09-04 after the five commits

| gate | reading |
|---|---|
| `noodl-viewer-react` full jest | **91/91 files, 1175/1175** green |
| `nat-001/palette-contrast.spec.ts` | **262/262**, `DISTINCT_PAIRINGS` unchanged |
| `nodegx-export` `visual-controls.test.ts` | 38/38 |
| `noodl-editor` `vib-007` + `fb-021` | 39/39 |
| `tsc -p noodl-viewer-react`, `tsc -p noodl-editor` | clean, both |
| `catalog:check` | **EXIT=1, two deltas, both REL-002a's** (was seven) |
| `noodl-mcp` jest | 92/93 suites, **1256/1257** — the one red is REL-002a's, see §C, and is **not caused by this session** (proved: `placeholderStrings()` reads `["Label","Text","Type here..."]` from the catalog **both before and after** these commits) |
| `test:main` | **419/422 suites, 7070/7079** — three reds, none this session's: `sb-007` + `vfn-011` are the documented pre-existing baseline (neither suite references anything touched here — grepped), and `aib-009/turnDeadline` is a parallel-load flake that runs **8/8 green alone** |

**Not run: `test:ci`.** Nothing this session touched is in its blast radius — one CSS token swap
in the editor (graded by the NAT-001 jest spec that was run), viewer-react node defaults, and a
generated JSON. This follows s36's precedent for the same class of change. **Not driven in a
running editor**, for the same reason s36 did not: this is a shared box.

---

## 🔴 §C THE ONE THING A NON-RICHARD SESSION SHOULD PICK UP FIRST

**REL-002a's placeholder-default work is committed on the TEST side and uncommitted on the SOURCE
side, and has been for three days.**

- `ba6df3fd` (**2026-09-01**) committed `expect(placeholderStrings().sort()).toEqual(['Label', 'Text'])`
  into `packages/noodl-mcp/tests/renderReportModule.test.ts`.
- The two source files that would make it true are **still sitting uncommitted** in this checkout,
  mtime **2026-09-01 11:34**:
  - `packages/noodl-viewer-react/src/nodes/controls/text-input.ts`
  - `packages/noodl-viewer-react/src/nodes-deprecated/controls/text-input.tsx`
  (**the same default lives in BOTH** — the deprecated node's own comment records that a one-file
  fix read as done and left `Type here...` in the catalog anyway.)
- So `noodl-mcp`'s suite has been **red at HEAD for three days**, and `catalog:check`'s last two
  deltas have the same single cause.

The diffs are complete, commented and self-explaining. What is NOT knowable from here is whether
they were held back on purpose (they change a shipped default on every legacy project). 🔴 **Do not
commit another task's source on its behalf — surface it.** But it is one decision away from turning
two red gates green, so it should be **the first thing asked**, not stepped over for a fourth day.

**After those two land**: regenerate `node-catalog.json` (`--out-dir` + diff first) and
`catalog:check` goes green. Also update the now-stale prose in `scripts/devtools/render-report.js`
(~line 104) which still says the placeholder strings are *"`Text`, `Label` and `Type here...`"*.

### The rest of what is not done

1. 🔴 **NOTHING FROM REL-015/FB-013/the Shape node is DEPLOYED**, and `0025` has never run against
   production. It sets every existing row to `unlisted`, so whoever is on `/people` today **comes
   off until approved** — and under D4 their `/u/<handle>` 404s too. **Count first**:
   `select count(*) from profiles where visibility='public' and hidden_at is null;`
2. **The listing card and chat composer have never been driven in a running editor.**
3. ⏳ **REL-015 AC9/AC11 are Richard's** — two YouTube links, one real tutorial.
4. The Dropdown's beginner JSON mode needs Richard to choose among three researched directions.
5. `node-catalog-enriched.json` is stale — blocked on an unrelated uncommitted example-file edit.

---

## 🔴 §D WHAT THE NEXT SESSION BUILDS, IN THIS ORDER

1. 🔴 **Ask about REL-002a (§C).** One question, two files, two red gates. Do not commit it unasked.
2. If that is answered and landed: regenerate the catalog, fix the stale `render-report.js` prose,
   confirm `catalog:check` green and `noodl-mcp` 93/93.
3. Then the only buildable product work left in this phase is **Shape/SVG stages 2 and 3**
   ([`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §1 — `cornerRadius` and `points`, then `svgSource` with
   its documented sanitisation requirement). It is the one row here with no human dependency.
4. Everything else in §F is Richard's.

⚠️ **None of these block the 0.2.2 cut.** [REL-012](REL-012-THE-LESSONS-NOBODY-RECEIVES.md) does
(a fresh install opens Learning empty) — built, pending his drive.

---

## §F The board — 🔴 carried forward from s33's derivation, NOT re-verified since

Re-derive from [`TASKS.md`](TASKS.md) before trusting this for anything.

| # | row | state |
|---|---|---|
| 6 / 6b | REL-002c · [REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) | ⏳ **RICHARD'S LOOK.** Judgements 1 and 3 built; **2 and 4 unbuilt** |
| 7 | REL-001 — publish the members' area | ⏳ **RICHARD.** *fix first, publish once* |
| 8 | REL-004 — cut and tag `v0.2.2` | 🔴 `cline-dev` is **691 commits unpushed** (measured 2026-09-04 after this session's five). Pushing is **Richard's own standing decision** — do not push and do not re-raise it |
| 9c | REL-011c | 🟡 ⏳ AC3 is his ruling. Site builder is **BACK ON HOLD** (his D1) |
| 11 | [REL-012](REL-012-THE-LESSONS-NOBODY-RECEIVES.md) | 🟢 ⏳ **BLOCKS 0.2.2.** AC1–AC4 built, 30/30. **AC5 is a drive** needing his `~/Library/Application Support/NodeGX` moved aside |
| 12 | [REL-013](REL-013-THE-TEMPLATES-TAB.md) | 🟢 40/40. ⏳ AC2's *"no request on cold start"* proven structurally, not by watching the network |
| 13 | [REL-014](REL-014-THE-VALUE-THE-FIELD-DESTROYS.md) | 🟢 86/86 — four copies, not two |
| 14 | [REL-015](REL-015-THE-SHELVES-YOU-CAN-FILL.md) | 🟢 committed both repos. Residuals in §C |

---

## §G Working rules for this tree

0. 🔴 **A SPEC THAT FAILS TO *RUN* REPORTS A CLEAN TEST COUNT.** Gate on the EXIT STATUS and the
   SUITE COUNT, never on the absence of a `✕`. **`Tests: 0 total` CAN JUST MEAN THE WRONG
   DIRECTORY** — a compound `cd … && …` persists cwd into later tool calls; `pwd` first.
1. 🔴 **A PIPE GIVES YOU THE EXIT STATUS OF ITS LAST COMMAND.** `… | tail` reported `EXIT=0` for a
   `catalog:check` that had genuinely failed. Redirect to a log and read `$?`, or check
   `PIPESTATUS`.
2. 🆕 🔴 **AN UNCOMMITTED TREE IS INVISIBLE TO A WORKTREE-ISOLATED AGENT, AND IT WILL NOT SAY SO.**
   §B1 — a confident, detailed, entirely wrong survey. Never `isolation: worktree` on this repo;
   settle questions about uncommitted state by running the thing in the real checkout.
3. 🆕 🔴 **`git status --short` HIDES NEW TESTS IN PLAIN SIGHT.** The suite that proved §B1's fix
   finished was `??`, not ` M`. Read the untracked block too before concluding coverage is missing.
4. 🔴 **REGENERATING A SHARED ARTEFACT IS AN UNPERFORMED MERGE.** `--out-dir` + diff first. When
   other tasks' uncommitted source feeds the same artefact: `cp -a` aside, `md5`, `git checkout
   HEAD --` **only those paths**, generate, restore, `md5` again. **Never `git stash` here.**
5. 🔴 **COMMIT BY PATHSPEC, NEVER `git add`** — except untracked paths, which a pathspec commit
   **skips silently**, so `git add` those first and check `grep '^??'`.
6. 🔴 **A GATE IN ANOTHER PHASE THAT GOES RED IS USUALLY RIGHT.** §C is a red gate that has been
   right for three days. Repair by **DERIVING** the population, never by picking a better literal.
7. 🔴 **A LONE RED IS A FLAKE UNTIL RE-RUN ALONE.** `aib-009` failed in a 422-suite parallel run
   and passed 8/8 by itself.
8. 🔴 **A LITERAL IN A GATE IS NOT ONLY AN ID — A WORD THE PRODUCT PRINTS IS ONE TOO.**
9. 🔴 **AN OOM LOGS `0 error TS` AND READS EXACTLY LIKE A PASS.** `134` is the V8 abort.
10. 🔴 **A `tsc` EXIT=0 PROVES NOTHING UNTIL YOU CHECK WHAT THE CONFIG INCLUDES.**
11. 🔴 **A `default` ON A PORT WITH A HAND-WRITTEN `set` DOES NOT REACH THE RENDER** — seed
    `props.<name>` in `initialize()` and keep `default:` on the port so panel and render agree.
12. 🔴 **A LITERAL COUNT GATE ONLY WORKS IF SOMEBODY RUNS IT.** Touch either template artefact ⇒
    mcp jest + its drives + `test:main` **and** `test:ci`.
13. 🔴 **NEVER OPEN `templates/members-area` OR the site-builder template IN THE EDITOR.** Use
    `npm run template:members` / `template:site-builder`.
14. ⚠️ **`test:ci`'s readout is `packages/noodl-editor/tests/test-results.json`**, not
    `packages/noodl-editor/test-results.json`.
15. ⚠️ **`electron/dist` in `ps` matches the MCP servers.** Read `ps -o command=` before attributing.
