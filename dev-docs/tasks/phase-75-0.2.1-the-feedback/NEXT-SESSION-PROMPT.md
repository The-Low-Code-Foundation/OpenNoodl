# Next session — phase 75

_Written 2026-08-28 at the end of session 66. `LearnerPathSection` is closed.
The two blockers are Richard's and are now unchanged for an **eighth** session._

## What happened

**One commit on `cline-dev`** — `LearnerPathSection.module.scss`, three controls and three regions,
**26 rows, twelve mutants**. The recommended target came with a scouted disposition for each site,
and **one of the three scouted calls was wrong** — which is the session's most useful output.

## 🔴 Start here — and this is a question for Richard, not a task for a session

⬜ **Deploy C5 and drive it. Unchanged since session 59 — this is the EIGHTH session to open on it.**
`NODEGX_MODERATORS` is **still absent** from `~/nodegx-community-deploy.env`. Until Richard's handle
is in that file the hide route 404s for *everybody*, and **the verb has still never run outside a
spec.**

⚠️ **Eight sessions have each restated a one-line blocker that no amount of agent work can clear.
Stop re-reporting it and ask him.** It needs: his handle in the file, `ops/deploy.sh
49.12.102.195`, then the hide driven against production.

🧭 **Also Richard's, also not code:**
- **Content for FB-005 / FB-009 / FB-012** — templates, syllabus lessons, the tutorial batch.
- 🔒 **Free tags are still unruled.** §8 asked it alongside R-chat-mod and B did not answer it.

## ⬜ The ready work: the sweep continues — 39 listed sites

In [BORDER-CONTROL-SWEEP.md](BORDER-CONTROL-SWEEP.md). One entry closed (`.Option` / `.Ghost`), and
`.Primary` was a third control in the same file that **appears in no count**, as usual.

**Suggested next: `FolderTree`** — six `border-default` declarations including
`.DeleteConfirmationCancelButton`, which IS on the list. It is the natural follow-on s65 named and
it is still unread. `SuggestionBanner .DismissButton` and the two `-trigger` sites are the other
three `noodl-core-ui` entries left.

🔴 **Read s66's findings before picking a target — one of them changes how you decide a site's
GROUND, and one changes what you do with a site you were about to call a false positive.**

## 🔴 The finding worth more than the fix: an exclusion list cannot fail

`.Primary` paints `border: primary` on `background: primary` — **1.00:1**, which reads as the
file's worst defect. The scouting note predicted "likely a FALSE POSITIVE of the `.SaveButton`
kind", and s63 disposed of `.SaveButton` exactly that way: **add it to a prose exclusion list and
move on.**

🔴 **That disposition stops one step early, and it is the shape of every "deliberately left alone"
paragraph this sweep has written.** The claim is real but *unassertable*: a list of things not to
check cannot go red. What is true is narrower and gradeable — **the object is identified by its
FILL** (6.53 / 4.03 on its ground), and the border is only matching the box size of its neighbours.

✅ **So the resting row now branches**: when edge and fill resolve to the same token, it grades the
**fill step against the ground**. `.Primary` passes at 6.53 / 4.03 and reddens the instant that fill
moves — mutant M3 proves it, with the number in the failure text.

⚠️ **Worth carrying**: for every site an earlier slice excluded, ask whether the REASON it was
excluded is itself gradeable. Several probably are, and `.SaveButton` is the first to re-read.

## 🔴 Three more that change how you work the next family

**1. COUNT PLACEMENTS, NOT CALL SITES.** s65 closed with "assume many grounds until the CALL SITES
are counted." Counted here: `LearnerPathSection` has **exactly one**, which under that rule reads
as *one ground, no hazard*. It has **two** — `.Ghost` is placed twice by the component's own JSX,
once on the launcher's `bg-0` content area and once inside a `.Step` painting `bg-1`. **A call-site
count cannot see a second placement inside the component.** Mutant: deepening `.Step` to `bg-4`
reddens `.Ghost` and nothing else.
⚠️ And **which ground is worst SWAPS BY THEME** — `border-control` is 4.86 / 4.17 on `bg-0` / `bg-1`
in dark but 3.28 / 3.72 in light. Defending only the worse-in-dark ground defends the wrong one.

**2. `own()` IS load-bearing here — s65's rule confirmed by its own opposite.** s65 broke it and
killed nothing, and filed *a guard inherited is untested until its mutant is run here*. Run here it
kills: `.Option` nests `&[data-chosen='yes'] { border-color: primary }`, so a reader without `own()`
resolves the **resting** edge of an unchosen option to `primary`. **The `.Option` revert kills 6
rows on its own and 0 with `own()` broken.** Neither session could have known without the mutant.

**3. A guard that fails on its FIRST run is the only one you know is live.** The state row's suffix
guard (`:`/`.`/`[`) exists because `.Options` — the flex row *holding* the options — was read as a
state of `.Option` and reddened the row on the first run. ✅ **Copying a helper and watching it pass
tells you nothing; the suffix rule was in the sibling spec too, in a family where it never fired.**

⚠️ **Also: three negative-control bounds in one file**, the first family to need that many — 1.5 on
`bg-0`, 1.4 on `bg-1`, 1.2 on `bg-2`. Fifth session to file that the bound belongs to the GROUND.

## Gates, as measured this session

- Editor `test:main`: **372 suites / 6181 passed / 0**, exit 0. Reconciles exactly with s65's
  370 / 6147: **+1 suite / +26 tests mine**, **+1 suite / +8 tests a peer's** (`tests-unit/sbr-002`,
  run separately to attribute it). 41 `● Console` blocks and the single "failed" string
  (`Orphan sweep failed: the disk is on fire`) are deliberate fixture output — read, not assumed.
- `noodl-core-ui` suite: **28 suites / 527 passed / 0** — reconciles exactly with s65.
- Whole `border-sweep/` directory: **6 suites / 214 tests**. 214 − 26 = 188 = s65's figure.
- `tsc -p packages/noodl-editor --noEmit`: **exit 0**, 0 lines, written to a file not piped.
- `npm run tokens:css`: **exit 0**, 322 stylesheets.
- **Twelve mutants.** Ten killed by a named row. The two `own()` mutants are the finding: broken
  alone it kills nothing, and broken *with the revert applied* the revert's six reds **vanish**.
  Failure **text** read for the `.Primary` and ground-pin kills, not just counts.
- `test:ci` **not run and not owed** — one `.module.scss` plus a `tests-unit` spec. **Checked by
  content**: no Electron spec *source* names this family; the only hit is `tests/index.bundle.js`,
  a build artefact. (A peer asked for no `test:ci` mid-session; it was not owed either way.)
- Files borrowed for mutants — `colors.css`, `Launcher.module.scss` and the spec itself — were
  **restored and verified by md5 against their pre-mutation hashes**, all four exact.

## Standing facts for this area

- 🔴 **`NODEGX_MODERATORS` absent from `~/nodegx-community-deploy.env`.** C5 is deployed-but-inert
  until it is there.
- 🔴 **Docker is not running**, so `npm run db:up` fails. The community suite runs against a scratch
  DB on local **5432**: `DATABASE_URL="postgres://richardosborne@localhost:5432/nodegx_c5_s59"`.
  Repo default is **55432** (Docker's).
- ⚠️ **P76 asks that the local backend "sb015 site backend" (port 8588) be left alone.** Not touched.
- ⚠️ **Not mine and still uncommitted, leave them**: the **P77 SBR-002 work** — a peer announced a
  live editor drive mid-session and holds `projectmodel.utils.ts`, `EmbeddedTemplateProvider.ts`,
  `ProjectTemplate.ts`, `site-builder.template.ts`, `firstOpenComponent.ts` and
  `tests-unit/sbr-002/`. Also the P70/P71 task files, the P72 and P68 doc edits, and
  `AskAboutNodeDialog.module.scss`, uncommitted since **08-20** and belonging to nobody here.
  All verified still uncommitted after my commit, which used explicit pathspecs.
