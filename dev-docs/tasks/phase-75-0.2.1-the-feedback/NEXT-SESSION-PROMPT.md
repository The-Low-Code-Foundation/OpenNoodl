# Next session — phase 75

_Written 2026-08-28 at the end of session 67. `FolderTree` is closed._

## 🔴🔴 STANDING INSTRUCTION FROM RICHARD — READ BEFORE RUNNING ANYTHING

⛔ **NO CPU/RAM-INTENSIVE TESTING until Richard explicitly says to start again.**
Given mid-session 67, machine-wide (a peer session relayed the same instruction and stood its
drive stack down). **Keep this section in this file, at the top, until he says it is OK** — do not
drop it just because a session ends.

That means **no** `test:main`, **no** `test:ci`, **no** package suites, **no** editor launches, **no**
webpack builds. Writing specs is fine — **running** them is not. **Save the work; he will sweep up
and run everything at once later.**

⚠️ **So the next session's job is to WRITE, not to VERIFY.** Plan for that: pick a target, read it,
make the edit, write the spec, write down the mutants you *would* run — and leave them queued in the
task file rather than running them.

## 🔴 What is UNVERIFIED from session 67, and must be run when he clears it

The instruction arrived **mid-gate**. Honest status:

| gate | status |
|---|---|
| `tests-unit/border-sweep/` (whole dir) | ✅ **7 suites / 236 passed, exit 0** — ran to completion *before* the instruction. 236 − 214 = **22**, exactly the new spec, reconciling with s65/s66. |
| **eleven mutants** | ✅ all run before the instruction — see the sweep doc's table |
| editor `test:main` | 🔴 **KILLED — `EXIT=137`, no summary line, NO RESULT.** Not a pass, not a fail. **Must be re-run.** |
| `noodl-core-ui` suite | ⬜ **not run** |
| `tsc -p packages/noodl-editor --noEmit` | ⬜ **not run** |
| `npm run tokens:css` | ⬜ **not run** |

🔴 **Do not record `test:main` as green anywhere.** It was SIGKILLed part-way; the log ends on `PASS`
lines with no summary, which is exactly the shape memory warns reads as success.

## What session 67 did

**`FolderTree` — the launcher's projects sidebar and the confirmation dialog it opens.** Two
declarations fixed, two more graded, one new spec (`folder-tree-control-borders.test.ts`, **22 rows**,
both themes), **eleven mutants**. Full write-up in [BORDER-CONTROL-SWEEP.md](BORDER-CONTROL-SWEEP.md).

- `.RenameInputField` / `.CreateFolderInputField` — two native `<input>`s, 1.26 / 1.27 on the
  sidebar → `border-control`. **On no list**: neither sets `cursor`.
- `.DeleteConfirmationCancelButton` — the one listed entry → `border-control` + `primary` on hover.
- `.DeleteConfirmationDeleteButton` — **graded, and it is a known-open defect** (below).
- `.NewFolderButton` — no border, no fill; graded by its **label**.

## 🔴 Read these three before picking the next target

**1. THE SECOND GROUND WAS A MODAL THE COMPONENT RENDERS ITSELF.** s66 said count PLACEMENTS, not
call sites. `FolderTree` has one call site and two grounds again — but the second is a
`position: fixed` dialog that **escapes the component's layout tree entirely**. The file's own header
comment says everything sits on `bg-1`; the two buttons that matter are on the dialog's `bg-2`, one
ramp step away (1.168:1), so **every contrast row would have passed on the wrong ground**. Only the
pin-by-NAME caught it. ✅ **Read what a component RENDERS — modals and portals included.**

**2. THE FILL STEP DECIDES WHETHER THE EDGE IS GRADED AT ALL.** s66's `edge === fill` branch is the
degenerate case of a rule session 60 already wrote in prose at `.TemplateCard` and nobody encoded:
*a control is identified by its outermost tone against the ground; the "is the ring visible against
its own fill" question is asked **only** when the fill does not already clear 3:1 on the ground.*
It stays strict everywhere this sweep has been strict (every `bg-N` control here has a fill step of
1.10–1.17) and relaxes only for a saturated fill. **Carry this into the next family.**

**3. A PREDICTED-LIVE GUARD THAT KILLED NOTHING — and the mirror image is why.** The state row's
suffix guard was predicted live because `.RenameInput` holds `.RenameInputField`, which looks exactly
like s66's `.Option` / `.Options`. **It is the mirror image**: the guard fires only when the
*queried* selector is a prefix of another, and here the queried one is the LONGER. Removing it kills
nothing. ⚠️ **A common prefix is not enough — the DIRECTION is the whole question.**

## 🔴 A defect this sweep cannot fix — it needs a decision, possibly Richard's

`.DeleteConfirmationDeleteButton:hover` is **2.61:1 on the dialog in dark**. It is pinned by its
measured value (the row does **not** claim it passes) because the fix is not local:

| | dark | light |
|---|---|---|
| white label on `danger` (resting fill) | **2.79:1** ❌ | 4.83:1 |
| white label on `danger-dim` (hover fill) | 4.83:1 | 6.57:1 |
| boundary: `danger` on the dialog | 4.52:1 | 4.38:1 |
| boundary: `danger-dim` on the dialog | **2.61:1** ❌ | 5.96:1 |

**The label needs the dim step; the boundary needs the bright one**, and they cannot both be had in
dark. `LauncherHeader.module.scss:183` already ruled the label half — *"only the dim step carries a
white glyph legibly in BOTH themes"* — and **this button's resting fill contradicts that ruling at
2.79:1**. `danger` as a white-labelled fill appears in **at least seven** stylesheets
(`PrimaryButton`, `CellEditor`, `DataGrid`, `EasyMode`, `AddColumnForm`, `TitleBar`, this one), so
it is a **platform token question**, not a border-sweep edit.

## ⬜ The ready work — 38 listed sites

**Suggested next, staying in `noodl-core-ui` (3 left):** `SuggestionBanner .DismissButton`, and the
two `-trigger` sites (`.VariantSelector-trigger`, `.TokenPicker-trigger`). After that the packages
with the most left are **Panels (18)** and **Canvas/bench (5)**.

⚠️ Per the standing instruction above: **write the fix and the spec, queue the mutants, do not run
them.**

## 🔴 Still Richard's, and now unchanged for a NINTH session — please just ask him

⬜ **Deploy C5 and drive it.** `NODEGX_MODERATORS` is **still absent** from
`~/nodegx-community-deploy.env`. Until Richard's handle is in that file the hide route 404s for
everybody, and **the verb has still never run outside a spec.** It needs: his handle in the file,
`ops/deploy.sh 49.12.102.195`, then the hide driven against production.

⚠️ **Nine sessions have each restated a one-line blocker no amount of agent work can clear. Stop
re-reporting it and ask him.** (⛔ note the deploy/drive is also blocked by the testing freeze.)

🧭 **Also Richard's, also not code:**
- **Content for FB-005 / FB-009 / FB-012** — templates, syllabus lessons, the tutorial batch.
- 🔒 **Free tags are still unruled.** §8 asked it alongside R-chat-mod and B did not answer it.
- 🆕 **The `danger` / `danger-dim` question above.**

## ⚠️ One trap worth carrying: the mutant runner was wrong before the mutants were

Run from the repo root, `npx jest` used the **root** config, the TS spec failed to **parse**, and the
runner reported `Tests: 0 total` — which read as a kill. **Every mutant would have "passed".** The
runner now refuses a run that failed to RUN before reporting reds. Same family as the standing "a
failed install reads as a failed test" trap.

## Standing facts for this area

- 🔴 **`NODEGX_MODERATORS` absent from `~/nodegx-community-deploy.env`.** C5 deployed-but-inert.
- 🔴 **Docker is not running**, so `npm run db:up` fails. Community suite runs against a scratch DB
  on local **5432**: `DATABASE_URL="postgres://richardosborne@localhost:5432/nodegx_c5_s59"`.
  Repo default is **55432** (Docker's).
- ⚠️ **P76 asks that the local backend "sb015 site backend" (port 8588) be left alone.** Not touched.
- ⚠️ **Not mine and still uncommitted, leave them**: the **P77 SBR-002** work
  (`projectmodel.utils.ts`, `EmbeddedTemplateProvider.ts`, `ProjectTemplate.ts`,
  `site-builder.template.ts`, `firstOpenComponent.ts`, `tests-unit/sbr-002/`, and — new this
  session — `tests-unit/sb-007/site-template.test.ts`). Also the P70/P71 task files, the P72 and
  P68 doc edits, and `AskAboutNodeDialog.module.scss`, uncommitted since **08-20**.
- ✅ Files borrowed for mutants — `colors.css`, `Projects.module.scss`, `FolderTreeItem.module.scss`
  and the spec — were **restored and verified by md5 against their pre-mutation hashes**, all exact.
