# Phase 82 — next session

## The board, re-derived from [`TASKS.md`](TASKS.md) at 2026-09-04, session 29

🔴 **Re-derive it again yourself.** This phase has been overtaken ten times by a ruling or a row
that landed after a handoff was written. **The task files are the board; this section is a
convenience.** ⚠️ s20 said *"there is no fully-buildable row left"*, s22 said *"every row is CLOSED
or waiting on Richard"*, s23–s26 each said the same, and **s25, s26, s27, s28 and now s29 each built
a whole session out of a finding the previous handoff had registered with owner `NONE` and not
built.** ✅ **Read the FINDINGS a row owns, not only its status.** Five sessions running, the next
job was sitting in the previous handoff's "⬅️ What is left" list.

| # | row | state |
|---|---|---|
| 6 | REL-002c — every page as good as the homepage | 🟢 **Everything a session can do is done.** ⏳ **RICHARD'S LOOK** + the four judgements §7.3 names |
| 6b | [REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) | ⏳ **RICHARD'S LOOK.** AC1–AC5 met s15, AC6 is a person. Pictures current as of s26 |
| 7 | REL-001 — publish the members' area | ⏳ **RICHARD.** *fix first, publish once*. ✅ Nothing stands against this row |
| 8 | REL-004 — cut and tag `v0.2.2` | 🔴 **Blocked**: `cline-dev` unpushed (**674** at s29 close — re-derive at cut time), CI has run on none of it. 🟢 **s28's red release-gate drive is GREEN** — see below |
| 9a / 9b / 10 | REL-011a / REL-011b / REL-009b | 🟢 CLOSED s17 / s19 / s21 |
| 9c | REL-011c — the three surfaces reach PASSABLE | 🟡 AC1 + AC2 met, all findings built, **plus s27's public outline, s28's admin outline and s29's page editor**. ⏳ AC3 is Richard's ruling |

## 🟢 What session 29 did

One job, taken from s28's §"What is left" item 2 — registered, owner `NONE`, explicitly not built.
Write-up: **[REL-011 §7](REL-011-THE-SITE-BUILDER-SHIPS.md)**. Commit `fe31a3f7`.

**`ac2-page-editor-drag-drive.test.ts` now reads 28 of 28, EXIT=0** — from **23 failed of 23**.
The repair and §8's capture are one job, not two: s28 named the reason exactly — *a `beforeAll` that
throws runs no arm*, so `/Pages/PageEditor` could not be graded by a rider on it.

### The drive was stale in TWO places, and the template was right in both

| # | the literal | what the template does now | how it read |
|---|---|---|---|
| 1 | `runOnChange-in-image` on the node labelled *Fold the edits back into data* | SBR-005 split the picture path onto its own `absorb` node, **for a stated reason** (`merge` also runs on `upload.done`, harmless for `next.image = file`, a bug for `images.push(file)`) | `beforeAll` threw on its own precondition. All 23 red, three days |
| 2 | a card's kind, read as `c.text.split(' ')[0]` | REL-011c **A6** wired `kindText` to a human LABEL — the card says *"Rich text"* | `Rich` → `findIndex` `-1` → `sectionIds[-1]` `undefined` → an expected map keyed **`{"undefined": 0, …}`**. **4 specs red, product doing exactly the right thing** |

🔴 **Neither was repaired with a fresh literal.** `restoreD31` derives its population from the graph
— the component's one `SetDbModelProperties`, the `JavaScriptFunction`s wired into it, the value
inputs actually WIRED to each — which is the template's own stated rule (*"a new value input on a
repeater-item write-back node owes a key"*) turned into the arm that tests it. It restores **9 keys
across 3 nodes** where the typed version restored 3 across 1. `kindOf` inverts `SECTION_KIND_LABELS`,
**imported not copied**, and asserts the match is unique and total.

⚠️ It **counts** the writer, it does not **name** it: `writers.length === 1`, never `id === 'save'`.
The MCP door renames node ids project-wide — which is how s28's D42 came to be pinned to a `#pick`
a preset chip had taken.

### The arms still disagree, which is what makes the green mean something

| arm | `landed` | `rowWrites` |
|---|---|---|
| shipped | `false` | **0** (three `updatedAt` unmoved to the millisecond) |
| defect restored (9 keys) | `true` | **137+** |
| defect restored, no refetch wire | `true` | **>50** — the obvious suspect still excluded |

`Move up on the LAST STORED card` now reports `ok:true` on the card headed *"Rich text"* and
renumbers `[1,2,0] → [2,1,0]`, where it reported **`no card`** and moved nothing.

### §8 — `/Pages/PageEditor`'s rendered outline, the fifth of six admin screens

| arm | mains | h1s | h1sInMain | navsInDoc | navsInMain |
|---|---|---|---|---|---|
| **HEAD** | 1 | 1 | 1 | 1 | 0 |
| **reverted** (13 `as` tags stripped) | 0 | 0 | 0 | 0 | 0 |

🔴 **The obvious control was NOT available, and the section says so.** `mains:0 h1s:0` is also what a
**blank screen** reads, and the usual answer — *"the rail's `<nav>` is still there"* — cannot be
used: `stripOutlineTags` takes `/Admin/Shell`'s `as: 'nav'` with everything else, so the reverted
arm's `navsInDoc` is legitimately 0. The three **section cards** are the control instead.

## 🟢 `typecheck:backend-tests` — narrowed from "this box cannot" to ONE import

Three sessions recorded it as a hardware limit. Bisected with single-file `tsc` programs at a 2.5 GB
heap: `BackendService`, the 3.7 MB `site-builder.content.json`, `sb004`/`sb005`/`sb006Components`,
`documentOutline` and the MCP SDK `Client` each return **EXIT 0**. **`helpers/site-drive.ts` returns
134**, narrowed one level to **`noodl-mcp/src/server`** — which **`typecheck:mcp` compiles fine**.

So it is the cost of compiling that module under the **backend's** tsconfig, not the ~255-file
count, and every site drive imports `site-drive.ts` — which is why scoping the entry never helped.
**Owner `NONE`.** ⚠️ **The control that makes this a finding**: the **unedited** drive, restored from
a snapshot, OOMs identically.

## The readings, with their exit statuses

⚠️ **Gate on an exit file the run writes itself.** A task-completion notice's *"exit code 0"* is the
**wrapper's** status; it has misreported in five consecutive sessions.

| gate | reading |
|---|---|
| `ac2-page-editor-drag-drive.test.ts` | **28/28, EXIT=0**, 327 s — from 23 failed of 23 |
| the same file, after the label fix, before §8 | **23/23, EXIT=0**, 242 s — the repair on its own |
| the same file, at HEAD, first run | **EXIT=1, 4 failed of 23** after the `beforeAll` repair; s28's baseline was 23 of 23 |
| `tsc -p packages/nodegx-backend` | **EXIT=0** — and it **proves nothing here**: `include` is `src/**/*` and it excludes `**/*.test.ts` |

✅ **No template gate and neither editor suite is owed, and that is checked rather than assumed.**
One file changed — a spec in `nodegx-backend/tests`. No template component, no product source, no
node-count literal. ⚠️ The `nodegx-export`-sibling hazard does not apply: nothing under
`packages/noodl-editor/src` imports `noodl-mcp` as a module.

## ⬅️ What is left

1. ⏳ **Rows 6, 6b, 7 and 9c are RICHARD'S**, and nothing stands against 6/6b/7.
2. 🔴 **Row 8 needs a push**: **674** commits ahead of `origin/cline-dev`, CI has run on none.
3. ⚠️ **`/Pages/Setup` is the SIXTH screen and still has no drive that loads it at all.** The site
   is claimed over HTTP before any browser opens, so grading its outline needs a **new arm, not a
   rider**. This is the strongest buildable candidate left. **Owner: `NONE`.**
4. ⚠️ **`typecheck:backend-tests` is one import away from working locally** (above). Fixing it hands
   every future session a reading three sessions have gone without. **Owner: `NONE`.**
5. ⚠️ **The MCP door renames node ids project-wide, silently.** Defensible for uniqueness,
   indefensible for anything referring to a node by id — and nobody has asked which it should be.
   **Owner: `NONE`.**
6. ⚠️ **`<h2>` order is unchecked in BOTH templates.** Every section kind carries one; nothing
   asserts a page's headings descend without skipping a level. **Owner: `NONE`.**
7. ⚠️ **Registered, owner `NONE`**: `/Site/ContactForm`'s stale comment block in
   `sb006Components.ts` (near line 702). Stale prose, not a defect.
8. ⚠️ **REL-010 AC4 and REL-002c §8.5 both say "the nine chrome pages"; the artefact says EIGHT.**
   The gate asserts eight. `README.md` carries a peer's uncommitted paragraph; REL-010's own text is
   Richard's reading material. Neither was edited.

## Working rules for this tree — carried forward, plus what s29 earned

1. 🔴 **A LITERAL IN A GATE IS NOT ONLY AN ID — A WORD THE PRODUCT PRINTS IS ONE TOO.** s29's second
   red was a gate reading a card's *heading* as data; the product improved its wording (A6) and the
   gate broke. ✅ **Import the product's vocabulary; never retype it.**
2. 🔴 **REPAIR BY DERIVING THE POPULATION, NOT BY PICKING A BETTER LITERAL.** `#pick-2` would have
   been the same fragility with a fresh name. Ask the artefact the question the source states.
3. 🔴 **A SILENT `-1` INDEX IS THE REAL DAMAGE.** The stale literal was one line; what cost four
   specs was `arr[findIndex(...)]` returning `undefined` and travelling on. ✅ **Assert the
   identification resolved, at the moment it is made.**
4. 🔴 **A GATE NOBODY RUNS DECAYS AGAINST THE ARTEFACT IT DRIVES, INVISIBLY** (s28).
5. 🔴 **AN OOM LOGS `0 error TS` AND READS EXACTLY LIKE A PASS.** Gate on the exit status; `134` is
   the V8 abort. ✅ **And compile the UNEDITED file as the control** — that is what turns *"did my
   edit break the typecheck?"* into a measurement.
6. 🔴 **A `tsc` EXIT=0 PROVES NOTHING UNTIL YOU CHECK WHAT THE CONFIG INCLUDES.** `-p
   packages/nodegx-backend` excludes `**/*.test.ts`.
7. 🔴 **A NEARLY-COMPLETE VERSION OF A THING IS HARDER TO MEASURE THAN AN ABSENT ONE** (s27).
8. 🔴 **A SENTINEL MUST NOT COLLIDE WITH A REAL READING.** `NO_LANDMARKS` is `-1` because `0` is what
   a working reverted arm reads; a never-ran arm leaving `0` would pass by not happening.
9. 🔴 **WHEN THE USUAL CONTROL IS UNAVAILABLE, SAY SO AND FIND ANOTHER ONE.** §8 cannot use the
   `<nav>` control because the stripper removes that tag too. Recording the gap and substituting the
   section-card count is the difference between a control and a decoration.
10. 🔴 **A LITERAL COUNT GATE ONLY WORKS IF SOMEBODY RUNS IT** (s23). Touch either template artefact
    ⇒ mcp jest + its drives + `test:main` **and** `test:ci`. s29 touched no template component, and
    says so with the check that establishes it.
11. 🔴 **CHECK WHOSE VERDICT DIRECTORY YOU ARE ABOUT TO WRITE INTO** (s24). `judge()` keys by `today()`.
12. 🔴 **COMMIT BY PATHSPEC, NEVER `git add`** — except untracked paths, which a pathspec commit
    **skips silently**. ⚠️ `phase-82/README.md`, `packages/nodegx-backend/tests/sbr011-live-preview-drive.test.ts`,
    `packages/noodl-editor/tests-unit/rel-002a/`, the whole of `phase-70/EL-00*.md` and several more
    carry peers' work; **s29 left all of them alone**, as s24–s28 did.
13. 🔴 **NEVER OPEN `templates/members-area` OR the site-builder template IN THE EDITOR.** Work
    through `npm run template:members` / `template:site-builder`.
14. ⚠️ **`test:ci`'s readout is `packages/noodl-editor/tests/test-results.json`**, not
    `packages/noodl-editor/test-results.json`.
15. ⚠️ **`electron/dist` in `ps` matches the MCP servers.** Five "editors" were all `noodl-mcp.cjs`
    at s29 open. Read `ps -o command=` before attributing a process.
