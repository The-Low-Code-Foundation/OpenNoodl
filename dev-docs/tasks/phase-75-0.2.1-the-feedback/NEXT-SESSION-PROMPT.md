# Next session — phase 75

_Written 2026-08-28 at the end of session 62. Session 61 handed over two blockers that are
Richard's and one ready unit of sweep work. The sweep unit is done; the blockers are unchanged —
now for the fourth session running._

## What happened

**Two commits on `cline-dev`** (`d7c459e8`, `c7a03f44`), both the border sweep. The component bench
family is closed, and it contradicted the rule session 61 handed over.

## Start here

⬜ **STILL THE ONE READY, UNFINISHED THING, AND STILL BLOCKED ON THE SAME LINE: deploy C5 and drive
it.** Unchanged from s59, s60 *and* s61. **`NODEGX_MODERATORS` is still absent from
`~/nodegx-community-deploy.env`** — re-checked this session, mtime still **08-26**, i.e. untouched
since before C5 existed. Until Richard's handle is in it the hide route 404s for *everybody*, and
**the verb has still never run outside a spec.** Needs: his handle in that file,
`ops/deploy.sh 49.12.102.195`, then the hide driven against production.
⚠️ **Four sessions have now opened on this sentence.** It will not move without Richard, and it is
probably worth asking him directly rather than re-reporting it.

🧭 **Richard's, and neither is code:**
- **Content for FB-005 / FB-009 / FB-012** — templates, syllabus lessons, the tutorial batch.
- 🔒 **Free tags are still unruled.** §8 asked it alongside R-chat-mod and B did not answer it. v1
  keeps the channel as the category by *default*, not by decision.

⬜ **The border sweep continues — ~51 listed sites left** (a FLOOR), in
[BORDER-CONTROL-SWEEP.md](BORDER-CONTROL-SWEEP.md). **Read the two hover-trap shapes before picking
one up.** Suggested next family: **the code-history / JavaScript-editor group in `noodl-core-ui`**
(`.Button`, `.CancelButton`, `.PreviewButton`, `.SaveButton`, `.CloseButton`) — five listed sites,
three of them carry the hover trap, and it is the first family in a *different package*, which will
test whether the ground can still be read from a sibling stylesheet the way `ComponentBench .Rail`
was here.

## ✅ Closed: the component bench — seven controls, and the picker's fix was the wrong one to copy

Full detail is in the sweep doc. The short version:

Seven controls moved to `--theme-color-border-control` across `BenchScenarioBar`, `BenchInputsRail`
and `BenchOutputsRail`, all now **3.05–4.17:1** on both sides in both themes. Two sites were
**deliberately left** on the divider token and are asserted as such: `ComponentBench .Frame` (the
preview box's edge — a region) and `.Menu` (a popup surface).

Pinned by `tests-unit/border-sweep/bench-control-borders.test.ts` — 50 rows, eight mutants.

## 🔴 The findings worth more than the code

**1. Session 61's hover remedy does NOT generalise, and copying it here would have reintroduced the
defect.** The picker closed its hover traps by *deleting* `border-color`, which was safe only
because that fill lightens `bg-2 → bg-1` and so *raises the same border*. Both hover rules in the
bench fill the other way, **`bg-3 → bg-4`, where `border-control` is 2.64:1 dark / 2.77:1 light** —
under 3:1. Deletion would have made the boundary fail **exactly while the pointer is on it**. Both
now use `primary` (3.54 / 3.40 on the fill, 4.80 / 4.14 on the rail).
🔴 **So the trap has two shapes and the hover FILL DIRECTION picks which fix applies.** ~9 of the
~13 remaining trap sites fill *down* the ramp. One measurement tells you which; the doc says where.

**2. The inventory's token half is as leaky as its cursor half.** `BenchScenarioBar .NameField` —
the field you type a scenario's name into — was **1.74:1** and is invisible to the query *twice*:
it is a text `<input>` so it sets no `cursor: pointer`, **and its edge named `border-strong`, which
the query does not look for at all.** Fourth independent floor proof. Every count in the sweep doc
is bounded by `border-default` and does not see `border-strong` sites.

**3. The negative control's bound is a property of the GROUND — confirmed a second time, from the
other direction.** s61 found the picker's 1.2 too tight on `bg-1`; here the bench is on `bg-2` and
1.2 is correct. The two files hold **different bounds and both are right**.

**4. 🧭 Out of scope but found by reading: `ComponentBench .ResizeHandle` has no resting visual at
all** — transparent until `:hover`. That is a 1.4.11 question no border token can answer, and the
file argues for it deliberately. It needs a design answer from Richard, not a sweep.

## 🔴 A process trap I walked into — worth more than the finding above

**`git checkout -- <path>` is not an "undo" for a mutant when your own work is uncommitted.** I used
it to revert each mutation and it restored the files to **HEAD**, silently discarding the nine
source edits I had just made and had not committed. The battery then ran against a half-reverted
tree: three mutants failed to apply, and the "baseline" read **40 failed** — a number that looked
like a broken spec and was actually a broken *tree*.
✅ **Snapshot to the scratchpad and `cp` back.** Nothing was lost that was not mine (checked: no peer
file was in the checkout set), but only by luck of which files I happened to mutate.
🔴 The tell was the *setup* assertions failing, not the test counts — **a mutant that cannot find
its own string is telling you about the tree, not about the mutant.**

## Gates, as measured this session

- Editor `test:main`: **365 suites / 6034 passed / 0**, exit 0, on tree `d7c459e8`.
  ✅ **Reconciles exactly** with s61's `364 / 5984`: this change is +1 suite / +50 tests.
- `tsc -p packages/noodl-editor --noEmit`: **exit 0**, 0 lines, written to a file not piped.
  ⚠️ It does not cover `tests-unit/`; **ts-jest does**, and the new spec ran.
- Targeted `border-sweep`: **2 suites / 90 / 0**.
- Eight mutants, **each killed, and the two hover mutants killed by the state row ONLY** — verified
  by reading the failure text, not the count: `.PickerChip:hover is 1.10:1 on its own fill`.
- `npm run tokens:css`: **exit 0**, 322 stylesheets.
- `test:ci` **not run by this lane, and not owed**: the change is three `.module.scss` files plus a
  `tests-unit` file. **Checked** — no Electron source spec references the bench; the only hit is
  `tests/index.bundle.js`, a **gitignored build artifact**.
- ⚠️ A peer's editor stack was live throughout (`start-electron-dev.js` + 3 webpacks, ~1h25m). No
  jest/vitest suite was running, so no concurrent-suite flake risk. Nothing of theirs was touched.

## Standing facts for this area

- 🔴 **`NODEGX_MODERATORS` absent from `~/nodegx-community-deploy.env`** (mtime 08-26). C5 is
  deployed-but-inert until it is there.
- 🔴 **Docker is not running**, so `npm run db:up` fails. The community suite runs against a scratch
  DB on local **5432**: `DATABASE_URL="postgres://richardosborne@localhost:5432/nodegx_c5_s59"`.
  `nodegx_c5_s59` still exists and can be reused. Repo default is **55432** (Docker's).
- ⚠️ **P76 asks that the local backend "sb015 site backend" (port 8588) be left alone.** Not touched.
- ⚠️ **Not mine and still uncommitted, leave them**: `packages/nodegx-export/*` and
  `tests/port-types.test.ts` (P18, actively moving this session), the P70/P71 task files, the P72
  and P68 doc edits, and `AskAboutNodeDialog.module.scss`, uncommitted since **08-20** and belonging
  to nobody here.
