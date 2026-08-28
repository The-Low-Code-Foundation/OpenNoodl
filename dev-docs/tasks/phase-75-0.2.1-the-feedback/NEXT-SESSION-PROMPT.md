# Next session — phase 75

_Written 2026-08-28 at the end of session 61. Session 60 handed over two blockers that are
Richard's, and one ready unit of sweep work. The sweep unit is done; the blockers are unchanged._

## What happened

**Two commits on `cline-dev`** (`40b6e3a3`, `c8ec4f8c`), both the border sweep. The node picker
family is closed — and the way it closed changes how the rest of the sweep must be done.

## Start here

⬜ **STILL THE ONE READY, UNFINISHED THING, AND STILL BLOCKED ON THE SAME LINE: deploy C5 and drive
it.** Unchanged from s59 *and* s60. **`NODEGX_MODERATORS` is still absent from
`~/nodegx-community-deploy.env`** — re-checked this session, mtime still **08-26**, i.e. untouched
since before C5 existed. Until Richard's handle is in it the hide route 404s for *everybody*, and
**the verb has still never run outside a spec.** Needs: his handle in that file,
`ops/deploy.sh 49.12.102.195`, then the hide driven against production. ⚠️ Three sessions have now
opened on this same sentence — it is not going to move without Richard.

🧭 **Richard's, and neither is code:**
- **Content for FB-005 / FB-009 / FB-012** — templates, syllabus lessons, the tutorial batch.
- 🔒 **Free tags are still unruled.** §8 asked it alongside R-chat-mod and B did not answer it. v1
  keeps the channel as the category by *default*, not by decision.

⬜ **The border sweep continues — ~57 sites left**, in
[BORDER-CONTROL-SWEEP.md](BORDER-CONTROL-SWEEP.md). **Read the new "hover trap" section before
picking one up.** Suggested next family: **the bench/canvas group** (BenchScenarioBar,
BenchInputsRail, CanvasHud) — 6 listed sites, all three files carry the hover trap, so it exercises
the finding immediately.

## ✅ Closed: the node picker, and it was six declarations rather than three

Full detail is in the sweep doc. The short version:

Four controls moved to `--theme-color-border-control` — `NodePickerCard .Root` (a `<button>`),
`NodePickerSearchBar .Field` (draws the `<input>`'s edge), `NodePickerEmpty .Action`,
`NodePickerPreview .DocsButton`. All now **3.37–4.17:1** both sides, both themes. Ten sites in the
same family were **deliberately left** on the divider token and are asserted as such.

Pinned by `tests-unit/border-sweep/node-picker-control-borders.test.ts` — 40 rows, six mutants.

## 🔴 The findings worth more than the code

**1. `border-strong` is a DIVIDER tone, so the resting-state fix alone is a REGRESSION.** It is one
of NAT-003's three (1.74:1 dark / 1.53:1 light), and both `.Root:hover` and `.DocsButton:hover`
moved their edge to it. Harmless while the resting edge is also a divider; the moment the resting
edge becomes a real 3:1 control tone, **pointing at the control makes its boundary harder to see**
(3.57 → 1.74). **A find-and-replace over the inventory would have shipped exactly that.**
🔴 **The unit of work is a RULE, not a declaration** — every `:hover` / `:focus` / `.is-*` state is
part of the same claim.

**2. The trap is laid across most of what is left: 20 stylesheets repo-wide, ≥17 of the remaining
sites.** Named in the sweep doc. ✅ Session 60's shelf work was **checked, not assumed**, and is
clean — its hovers use `primary`, which is *stronger* than the resting tone.

**3. A threshold is a property of the GROUND, not of the token.** I copied the shelf spec's
`border-default < 1.2` negative control and it went red at **1.255** — which is the value
`colors.css` *documents by design* for the divider on `bg-1` ("1.109 / 1.254 / 1.730"). The shelf
measures against `bg-2`. **The bound was wrong, not the token**; a copied threshold reads a correct
value as a defect. Re-derive per surface.

**4. Third independent proof the 60-site inventory is a FLOOR.** It listed three picker sites; nine
stylesheets in that tree name the token, and one of the misses — `.Field` — was a real defect. A
text input never sets `cursor: pointer`, so the query cannot see it. Same shape as
`.TemplateFilter-search`. **Read the family; do not work the list.**

**5. One mutant reddened in light only** — the `.is-unavailable` mix, 2.52 light vs 3.19 dark. A row
that fails in exactly one theme is measuring the surface rather than matching a string.

## Gates, as measured this session

- Editor `test:main`: **364 suites / 5984 passed / 0**, exit 0, on tree `40b6e3a3`.
  ✅ **Reconciles exactly** with s60's `363 / 5944`: this change is +1 suite / +40 tests. No flake;
  s60's `bld-004/reasoningChannel.test.ts` red did not recur.
- `tsc -p packages/noodl-editor --noEmit`: **exit 0**, 0 lines, written to a file not piped.
  ⚠️ It does not cover `tests-unit/`; **ts-jest does**, and the new spec ran.
- Targeted `border-sweep` + `fb-005`: **8 suites / 289 / 0**.
- `npm run tokens:css`: **exit 0**, 322 stylesheets.
- `test:ci` **not run by this lane, and not owed**: the change is four `.module.scss` files plus a
  `tests-unit` file. The Electron node-picker specs (`tests/nodepicker/`) are reducer and search
  logic — **checked**, they assert nothing about styling.
- ⚠️ A peer's editor build (webpack ×3) was running throughout. `test:main` is plain Node and came
  out clean, but that is the context for any timing question.

## Standing facts for this area

- 🔴 **`NODEGX_MODERATORS` absent from `~/nodegx-community-deploy.env`** (mtime 08-26). C5 is
  deployed-but-inert until it is there.
- 🔴 **Docker is not running**, so `npm run db:up` fails. The community suite runs against a scratch
  DB on local **5432**: `DATABASE_URL="postgres://richardosborne@localhost:5432/nodegx_c5_s59"`.
  `nodegx_c5_s59` still exists and can be reused. Repo default is **55432** (Docker's).
- ⚠️ **P76 asks that the local backend "sb015 site backend" (port 8588) be left alone.** Not touched.
- ⚠️ **Not mine and still uncommitted, leave them**: `packages/nodegx-export/*` (P18),
  `tests/cloud/sb017-*`, `tests-unit/sb-017/`, `registeradapters.ts` (P76), the P70/P71 task files,
  and `AskAboutNodeDialog.module.scss`, uncommitted since **08-20** and belonging to nobody here.
