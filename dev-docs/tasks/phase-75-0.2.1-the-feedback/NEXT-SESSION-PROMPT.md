# Next session — phase 75

_Written 2026-08-28 at the end of session 63. One family of the border sweep closed; the two
blockers are Richard's and are now unchanged for a **fifth** session._

## What happened

**Two commits on `cline-dev`** (`37f6d751`, `9126d227`) — the code-editor family of the border
sweep, in `noodl-core-ui`. Five controls fixed, 38 rows, ten mutants. The most useful thing the
session produced is not the fix: it is that **the spec was green while measuring the wrong
declaration**, and the mutant battery is the only reason anyone knows.

## 🔴 Start here — and this one needs Richard, not another session

⬜ **Deploy C5 and drive it. Unchanged since session 59 — this is the FIFTH session to open on it.**
`NODEGX_MODERATORS` is **still absent** from `~/nodegx-community-deploy.env`; re-checked this
session, **mtime still 08-26**, i.e. untouched since before C5 existed. Until Richard's handle is in
that file the hide route 404s for *everybody*, and **the verb has still never run outside a spec.**
Needs: his handle in the file, `ops/deploy.sh 49.12.102.195`, then the hide driven against
production.

⚠️ **Stop re-reporting this and ask him.** Five sessions have each spent a paragraph restating a
one-line blocker that no amount of agent work can clear. It is a question, not a task.

🧭 **Also Richard's, also not code:**
- **Content for FB-005 / FB-009 / FB-012** — templates, syllabus lessons, the tutorial batch.
- 🔒 **Free tags are still unruled.** §8 asked it alongside R-chat-mod and B did not answer it.

## ⬜ The ready work: the sweep continues — 43 sites left

In [BORDER-CONTROL-SWEEP.md](BORDER-CONTROL-SWEEP.md). 🔴 **Read the three findings below before
picking one up — two of them change how you would do the next family.**

**Suggested next: `.Card` (LauncherProjectCard) + `.Select` (LauncherSearchBar) + `.FolderPickerItem`
(Projects)**, still in `noodl-core-ui`. `.Card` carries the hover trap. ⚠️ These sit on the launcher,
whose ground is **not** `bg-1`/`bg-2` in the places the editor uses — **read it from its own
stylesheet**, which is the one instruction this sweep has had to re-file three times.

## 🔴 The finding worth more than the fix: a green spec that measured nothing

The first draft of `code-editor-control-borders.test.ts` passed **38/38 while four of its ten
mutants survived.** Reverting three of the five controls to the broken token changed nothing it
looked at.

**Why:** it read `border-color` out of the whole SCSS rule body — and **in SCSS a rule body contains
its nested `&:hover`**. So `.CancelButton`'s *resting* edge resolved to its *hover's* colour.

🔴 **The tell was not the survivor count. It was a mutant that touched ONLY a `:hover` and reddened
the RESTING rows.** A kill attributed to the wrong row is a broken reader wearing a strong spec's
clothes — so **read which row died, not how many.** Fixed by `own()`, commented at length in the
spec.

⚠️ **This generalises, and it is the reason to read this section before the next family.** Every
remaining family nests its states. The bench and picker specs' helpers have the same defect and were
never exposed only because those two files happened to use *top-level* state rules. **Copy
`code-editor-control-borders.test.ts`, not the older two.**

## 🔴 Two findings that change the sweep's rules

**1. `border-control` is NOT the answer everywhere.** POL-016 scopes the token to **"bg-1, bg-2 and
bg-3"**. `JavaScriptEditor .CloseButton` is filled `bg-4`, where it is **2.64:1 dark / 2.77:1 light —
under 3:1**. Swapping it in would have looked exactly like the other four edits and shipped a
control that still fails. It uses `fg-default-shy`.
⚠️ **The sweep now has two exclusion tests, not one:** "is it a control?" *and* **"what step is it
filled on?"** — `bg-4` and `bg-5` (2.41 / 2.54) are outside the token's guarantee.
✅ **And in all three fixes here, the rule already contained its own answer** — the hovers took
`primary` from `.FormatButton:hover` in the same file, and `.CloseButton` took `fg-default-shy` from
its own `:hover`. **Read the rest of the rule and its neighbours before inventing a tone.**

**2. The inventory contains a FALSE POSITIVE, not just misses.** It lists `.SaveButton`, which was
never broken (it overrides `border-color` to `primary`), and omits `.FormatButton`, which shares the
declaration and really was. **A worker trusting the list would have "fixed" a correct control and
left a broken one.** The count is a floor *and* has wrong entries in it — the doc's headline "60"
has never even summed to its own list (57). **The files are the artefact; the count is not.**

**3. s62's up/down hover rule needs a third step.** `.CancelButton:hover` fills *down* the ramp yet
lands at 3.08 / 3.05 — a deletion would have **passed**. `primary` is used anyway because a rule
whose job is to emphasise must not go *quieter* under the pointer. **Direction, then the number,
then what the rule is for.**

## ⚠️ A process note

`git checkout -- <path>` is still not an undo (s62's trap). This session snapshotted to the
scratchpad and `cp`'d back for all ten mutants, and **md5-verified all five files afterwards** —
worth keeping, it costs nothing and the battery mutates `colors.css` too.

## Gates, as measured this session

- Editor `test:main`: **366 suites / 6072 passed / 0**, exit 0, on tree `37f6d751`.
  ✅ **Reconciles exactly** with s62's `365 / 6034`: +1 suite / +38 tests.
- `noodl-core-ui` suite (the package actually changed): **28 suites / 527 passed / 0**.
- `tsc -p packages/noodl-editor --noEmit`: **exit 0**, 0 lines, written to a file not piped.
- `npm run tokens:css`: **exit 0**, 322 stylesheets.
- Ten mutants, **each killed by a named row**, verified by reading the failure **text**: the two
  hover mutants die on the state row only (`.Button&:hover is 1.28:1 on its own fill`), and the
  `.CloseButton` over-fix dies on the fill row only (`2.64:1 on its own fill in dark`).
- `test:ci` **not run and not owed** — the change is four `.module.scss` files plus a `tests-unit`
  spec. **Checked by content, not by absence**: the four Electron/core-ui specs that name this
  family (`code-history.test.ts`, `portBar`, `scriptPortNotation`, `paste-carries-labels`) contain
  no reference to styles, borders or `css[...]`.
- ⚠️ A peer jest suite was running when the gates started; `test:main` was **held until it exited**
  rather than run beside it.

## Standing facts for this area

- 🔴 **`NODEGX_MODERATORS` absent from `~/nodegx-community-deploy.env`** (mtime 08-26). C5 is
  deployed-but-inert until it is there.
- 🔴 **Docker is not running**, so `npm run db:up` fails. The community suite runs against a scratch
  DB on local **5432**: `DATABASE_URL="postgres://richardosborne@localhost:5432/nodegx_c5_s59"`.
  Repo default is **55432** (Docker's).
- ⚠️ **P76 asks that the local backend "sb015 site backend" (port 8588) be left alone.** Not touched.
- ⚠️ **Not mine and still uncommitted, leave them**: `packages/nodegx-export/*` and
  `tests/port-types.test.ts` (P18, actively moving), the P70/P71 task files, the P72 and P68 doc
  edits, and `AskAboutNodeDialog.module.scss`, uncommitted since **08-20** and belonging to nobody
  here.
