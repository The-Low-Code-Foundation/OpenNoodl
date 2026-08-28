# Next session — phase 75

_Written 2026-08-28 at the end of session 65. The launcher's `border-strong` controls are closed.
The two blockers are Richard's and are now unchanged for a **seventh** session._

## What happened

**One commit on `cline-dev`** (`781894b7`) — `LauncherButton .is-secondary` and
`ShareTemplateModal .ChoiceItem`, both in `noodl-core-ui`. Two controls, **22 rows, twelve
mutants**. Neither site appears in **any count in the sweep document**, because the inventory's
query is bounded by `border-default` and both of these named `border-strong`.

The most useful thing the session produced is not the fix. It is that **a guard this sweep has been
told to copy for two sessions does nothing in this family, and only a mutant could say so.**

## 🔴 Start here — and this is a question for Richard, not a task for a session

⬜ **Deploy C5 and drive it. Unchanged since session 59 — this is the SEVENTH session to open on it.**
`NODEGX_MODERATORS` is **still absent** from `~/nodegx-community-deploy.env`. Until Richard's handle
is in that file the hide route 404s for *everybody*, and **the verb has still never run outside a
spec.**

⚠️ **Seven sessions have each restated a one-line blocker that no amount of agent work can clear.
Stop re-reporting it and ask him.** It needs: his handle in the file, `ops/deploy.sh
49.12.102.195`, then the hide driven against production.

🧭 **Also Richard's, also not code:**
- **Content for FB-005 / FB-009 / FB-012** — templates, syllabus lessons, the tutorial batch.
- 🔒 **Free tags are still unruled.** §8 asked it alongside R-chat-mod and B did not answer it.

## ⬜ The ready work: the sweep continues — still 40 listed sites

In [BORDER-CONTROL-SWEEP.md](BORDER-CONTROL-SWEEP.md). ⚠️ **The listed number did not move**, because
both sites closed this session were outside every count in it. That is the cleanest illustration yet
of the doc's own warning: **the count is not the artefact, the files are.**

**Suggested next: `LearnerPathSection`.** One file, and it is a coherent family with both kinds of
site in it. Scouted, not swept:

- `.Option` — a control: `bg-2` fill, `cursor: pointer`, hover fills **down** to `bg-3`,
  `.is-selected` already uses `primary`. `border-default` on `bg-2` is **1.07 / 1.15**.
- `.Ghost` — a control: **transparent** fill, `cursor: pointer`, hover fills to `bg-2`. Note this is
  a *bordered* ghost and so IS in scope, unlike `LauncherButton .is-ghost`.
- `.Primary` — 🔴 **likely a FALSE POSITIVE of the `.SaveButton` kind**: `border: primary` on a
  `primary` fill, identified by its fill rather than its edge. Measure before touching it.
- `.Truth` and `.Step` are `bg-1` regions and look like deliberate dividers. **Membership is a
  judgement, as always.**

🔴 **Read s65's findings first — one of them changes which spec you copy, and one changes what you
count as "the ground".** `FolderTree` (six declarations, including
`.DeleteConfirmationCancelButton`) is the natural follow-on.

## 🔴 The finding worth more than the fix: a guard inherited is a guard untested

Session 64 raised *"copy `code-editor-control-borders.test.ts` — `own()` is load-bearing"* from
advice to **instruction**, having proved it by reproduction in its own family.

**In this family it is INERT.** Breaking `own()` alone leaves all 22 rows green; breaking it *with*
the `.is-secondary` revert applied still kills exactly the six rows the revert kills on its own. The
reason is checkable in ten seconds: **no nested state in either file declares `border-color`.**

✅ Keep it — it is correct code and the next nested `border-color` needs it. **But do not report it
as the file's strength.** 🔴 **A guard carried over from a sibling family is untested until its
mutant is run *here*.** The same caution applies to every helper this sweep has been propagating.

## 🔴 Three more that change how you work the next family

**1. A SHARED control has MANY grounds, and the sweep's table shape could not say so.** Every slice
from s60–s64 mapped one control to one ground. `.is-secondary` sits on **three** surfaces — the
titlebar (`bg-1`), the community card (`bg-2`) and the folder-picker footer (`bg-2`) — and on the
two `bg-2` grounds **the fill step is literally 1.00:1**. Reading one call site would have reported
a real number about the wrong question. ✅ **The spec's `ground` is now a list, and the fix must
clear on the WORST one.** Anything in `components/` rather than a view should be assumed to have
this shape until its call sites are counted.

**2. `border-control` was the DEFECT again — reached through the GROUND this time.** `.ChoiceItem`
paints no fill and sits on `Modal .Root` = **`bg-4`**, where the token is **2.64 / 2.77**. Session 63
met this exclusion at a control *filled* `bg-4`; this one is *grounded* on it. 🔴 **Ask "what step is
it on?" of BOTH sides of the edge.** It uses `fg-default-shy` (5.85 / 4.61), following s63.

**3. This family needed BOTH state-discovery mechanisms in one spec** — `.is-secondary` nests
`&:hover`, `ShareTemplateModal` writes `.ChoiceItem:hover` top-level. Removing either mechanism
leaves **every contrast row green**, so a half-blind reader is silent. ✅ **Assert that both
spellings are reachable**; the two mutants for it kill only the row added to detect them.

✅ **And the ground pin by name earned its place more cheaply than in s64**: moving the modal's
ground to `bg-3` reddens ten rows, but *only* because the ground is named — `fg-default-shy` clears
3:1 on `bg-3` as well as `bg-4`, so every contrast row would have passed on the wrong ground.

⚠️ **One correction to the sweep doc's own numbers**, now applied: `.is-secondary` was recorded at
**1.74 / 1.53**, which is its ratio against the *titlebar*. Against its own `bg-2` fill it is
**1.49 / 1.39** — worse than recorded, and the fill figure is the one that decides whether the edge
is load-bearing.

## Gates, as measured this session

- Editor `test:main`: **370 suites / 6147 passed / 0**, exit 0. Reconciles exactly with s64's
  369 / 6125: **+1 suite / +22 tests, both mine.** (41 `● Console` blocks and 7 "failed" strings in
  the log are all deliberate failure-path console output — checked, not assumed.)
- `noodl-core-ui` suite: **28 suites / 527 passed / 0** — reconciles exactly with s64.
- Whole `border-sweep/` directory: **5 suites / 188 tests**. 188 − 22 = 166 = s64's 38 + 38 + 50 + 40.
- `tsc -p packages/noodl-editor --noEmit`: **exit 0**, 0 lines, written to a file not piped.
- `npm run tokens:css`: **exit 0**, 322 stylesheets.
- **Twelve mutants.** Ten killed by a named row; the two `own()` mutants are the interesting ones —
  one kills **nothing** (that is the finding) and one adds nothing to the revert it accompanies.
  Failure **text** was read for the `border-control` and ground-pin kills, not just counts.
- `test:ci` **not run and not owed** — two `.module.scss` files plus a `tests-unit` spec.
  **Checked by content**: no Electron spec *source* names this family; the only hit is
  `tests/index.bundle.js`, a build artefact.
- ⚠️ A peer's **live editor stack** (`start-electron-dev.js`, pid 18783) and three webpack processes
  were running throughout. Nothing was killed or reaped; `test:main` is plain Node and safe beside
  it. `colors.css` and `Modal.module.scss` were borrowed for mutants and **restored by hash**, both
  verified clean against git afterwards.

## Standing facts for this area

- 🔴 **`NODEGX_MODERATORS` absent from `~/nodegx-community-deploy.env`.** C5 is deployed-but-inert
  until it is there.
- 🔴 **Docker is not running**, so `npm run db:up` fails. The community suite runs against a scratch
  DB on local **5432**: `DATABASE_URL="postgres://richardosborne@localhost:5432/nodegx_c5_s59"`.
  Repo default is **55432** (Docker's).
- ⚠️ **P76 asks that the local backend "sb015 site backend" (port 8588) be left alone.** Not touched.
- ⚠️ **Not mine and still uncommitted, leave them**: the **P77 SBR-001 work** (`templatebackend.ts`,
  `tests-unit/sbr-001/`, `TemplateStep.tsx`, `useProjectTemplates.ts`, `EmbeddedTemplateProvider.ts`,
  `ProjectsPage.tsx`, `template.ts`) — **actively moving, a peer had a live stack this session**; the
  P70/P71 task files; the P72 and P68 doc edits; and `AskAboutNodeDialog.module.scss`, uncommitted
  since **08-20** and belonging to nobody here. All eight paths verified still uncommitted after my
  commit, which used explicit pathspecs.
