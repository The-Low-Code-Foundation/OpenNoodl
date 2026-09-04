# Phase 82 — next session

## ✅ §A RICHARD'S LIST — three of four BUILT and COMMITTED

| # | what he asked for | state |
|---|---|---|
| 1 | **Add a person / list yourself** | 🟢 **BUILT s33, COMMITTED s35** (`e39393c1`). ⏳ Nothing is deployed. See [REL-015 §6](REL-015-THE-SHELVES-YOU-CAN-FILL.md) |
| 2 | **Add a chat message from the editor** | 🟢 **BUILT s34, COMMITTED s35** (`e39393c1`, FB-013). ⏳ Not deployed, not driven in a running editor |
| 3 | **Circle → a Shape/SVG node** | 🟢 **STAGE 1 BUILT s34, COMMITTED s35** (`64fca4e7`). ⏳ Not driven. Stages 2 (`cornerRadius`, `points`) and 3 (`svgSource`) remain |
| 4 | **Dropdown — two defaults + a beginner "click plus and type" mode** | 🟢 **the default-items half BUILT and COMMITTED s35** (`7696420f`) — see §B1, the researched "one-line fix" was wrong and had to be rebuilt for real. ⬜ **The beginner JSON mode is still just research** — [`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §3, three directions, none chosen |

**Both platform (`nodegx-community`) and editor (`OpenNoodl`) repos are clean of this backlog's
work as of s35** — four commits total, all green, see §B.

### §A4 — the smaller ones

| what | state |
|---|---|
| **Filter properties bar** — contrast **1.00:1** in both themes | 🟢 **BUILT+COMMITTED s36** (`645c3922`) — `645c3922`. `PropertyFilterInput.tsx` now passes `UNSAFE_className="property-filter-input"`; `propertyeditor.css` gives it `border-control` scoped to `input.property-filter-input` under `.property-filter` (element+class selector so it beats the module's own `border: none` on specificity regardless of load order — a single class would have tied). `SearchInput.module.scss` itself untouched, so its other five consumers are unaffected. NAT-001 gained a duplicate (border-control, bg-1) row for the new site — same tuple already graded elsewhere, 262/262 still green. Not driven in a running editor (shared box, load average >10 from other sessions when this was built) |
| **"Add style variant" vs "Style → Variant"** | 🟢 **BUILT+COMMITTED s36** (`645c3922`). Confirmed `refusalPlan.test.ts`'s `displayName: 'Variant'` is unrelated synthetic fixture data, not these labels — no collision. The two systems (`propertyeditor.ts`'s `.variants` section = `VariantsEditor`, a project-wide named style; `.element-style-section` = `ElementStyleSection`'s "Style"/"Variant" ElementConfig preset) are built and rendered as adjacent sibling `<div>`s with **no separator between them** — that adjacency, not the words, is what NOTES named as the actual defect. `variantseditor.css`'s `.variants-editor` divider was `border-bottom: 1px solid var(--theme-color-bg-1)` — the same token as the panel ground it sits on, so it painted nothing. Switched to `--theme-color-border-default`, the token this same panel already uses for `.property-header-bar` and `.property-group-children`. Did NOT rename "Add style variant"/"Edit variant"/the toasts — that vocabulary (`ProjectModel.createNewVariant`/`findVariant`) is load-bearing product terminology used throughout the model layer, not a labeling accident, and a rename was outside what "cheapest of what's left" scope should carry without Richard's sign-off on wording. ⚠️ `visualstates.css`'s `.property-editor-visual-states` divider **has the identical `border-bottom: 1px solid var(--theme-color-bg-1)` bug**, one section further down (between the Style section and Visual States) — found but NOT fixed, out of this task's stated scope. Worth a one-line follow-up if anyone's in that file |
| **Button `outline`/`ghost` icons** — correct only by inheritance | 🟡 **ALREADY FIXED, UNCOMMITTED, NOT BY THIS SESSION.** `git status` at the start of s36 already showed `Button.tsx`, `button.ts` and `RadioButton.tsx` modified — `button.ts` drops the shared `#000000` icon-colour default (`iconColor: undefined`), so the icon inherits the button's own resolved text colour instead of a hardcoded colour wrong for `outline`/`ghost`. Comments cite "Ruled by Richard, 2026-09-04: *'Same as label colour I'd imagine.'*" — a live/very recent peer session's work, not this session's. **Left untouched and uncommitted on purpose** — a peer may still be mid-edit on it; do not assume it's finished or safe to commit without checking `git diff` on those three files again first. No test file for it exists yet (`git status` shows source-only changes) — whoever commits it should add the "render gate over all five variants" coverage this row originally asked for before calling it closed |
| **Video node — mp4 only, no YouTube anywhere** | 🟡 **THE SENTENCE IS WRITTEN AND STILL CANNOT BE COMMITTED** — unchanged, still blocked on §A1 (see §C4) |
| **Design Tokens panel is `devMode`-gated, `TokenPicker` has zero call sites** | ⬜ FIX-015's successor phase. 🔴 in a packaged build the panel **is not registered at all** |
| **Default tutorial content** | ⬜ FB-012, phase 75 — blocked on his brief, on purpose |

---

## 🔴 §B WHAT SESSION 35 DID

### §B0 Verified, then committed, everything s33/s34 had left sitting uncommitted

Read the handoff, then checked both repos' actual `git status` against what it claimed before
touching anything — an exact match, nothing had drifted. Committed in order:

1. `nodegx-community` **`e5735d9`** — REL-015 migration/scripts/route + Richard's D3/D4 rulings.
2. `OpenNoodl` **`e39393c1`** — REL-015 editor listing pane + FB-013 chat composer + the `uni-001`
   gate repair, bundled as s33/s34 had already scoped it (files interleave; see that commit for
   the full pathspec).
3. `OpenNoodl` **`64fca4e7`** — Shape/SVG stage 1 (§A item 3), split cleanly out of a
   `node-catalog.json` that turned out to carry **two** sessions' uncommitted hand-patches
   tangled together — see §B2.
4. `OpenNoodl` **`7696420f`** — the Dropdown default-items fix, actually built this session (§B1).

### §B1 The Dropdown "one-line fix" the research proposed does not work — traced, then rebuilt

`NOTES-UNOWNED-NODE-WORK.md` §3 (session 34) proposed restoring the two default items with one
field: `default: [{Label:'Option 1',...}, ...]` on `options.ts`'s `items` port, flagged
*"⚠️ worth confirming against a running editor before shipping it alone… not verified this
session."*

🔴 **It was wrong, and shipping it as written would have been the exact "panel says one thing,
preview renders another" trap this project's memory keeps hitting.** `items` has a custom `set`
function (not a plain typed port), and the runtime only seeds a port's `default` into
`node._inputValues` for an unauthored input — traced through `node.ts`'s `registerInput` and
`nodedefinition.ts`'s `initializeDefaultValues` (called from the `nodeDefinition` factory, twice).
**Neither call ever invokes the port's own `set`.** So `props.items` — the only thing
`Select.tsx` reads — would have stayed `undefined`, while the property panel's summary (which
*does* fall back to `port.default` via `getParameter`, `ListValueType.ts`/`NodeGraphNode.ts:868`)
would have claimed "2 items". Confirmed empirically with a scratch corpus-harness probe before
writing the real fix: a node built with only `default:` set showed `props.items === undefined`.

**What actually shipped**: `options.ts` gained a `DEFAULT_ITEMS` constant, seeded directly into
`this.props.items` (a fresh per-instance clone) at the top of `initialize()` — `default:` stays
on the port too, purely so the panel's summary agrees with what renders. `set()` is untouched: an
authored or wired value still overwrites the seeded default, `undefined` still abstains. Verified
empirically, not assumed: a never-authored Dropdown's `props.items` equals the two-item array;
two sibling instances don't share one array reference; the default array carries no `.on` (never
bound as a Collection, so no listener leak onto a shared object). New suite:
`noodl-viewer-react/tests/corpus/p82-dropdown-default-items.test.ts` (3 specs). Full
`noodl-viewer-react` suite 91/91 files green afterward; `nodegx-export`'s `controlled-state` +
`visual-controls` suites (both author `items` explicitly, so unaffected) 64/64; `tsc` clean.

🔴 **General lesson, not just this port**: a `default` on any `inputs`-declared port with a
hand-written `set` function needs the same treatment — the port declaration alone is cosmetic for
the property panel and dead for the render. `inputProps` (no custom `set`) is a different code
path entirely (`react-component-node.ts` applies its defaults straight into `props` at
construction) and doesn't have this problem.

### §B2 `node-catalog.json` carried two sessions' uncommitted hand-patches, tangled — how it got split

Session 34 hand-patched `Circle`'s stage-1 entry into `node-catalog.json` (verified byte-identical
to a `--out-dir` generation) but never committed it. This session's `git status` before touching
anything showed the file **already modified relative to HEAD by exactly that patch** — so when the
Dropdown `items.default` hunk was added on top for §B1, the working file mixed two unrelated
features' worth of catalog change into one artifact, uncommittable as a clean pair of pathspec
commits.

**Fix**: `git checkout HEAD -- node-catalog.json` to blank it, hand-reapply *only* the three
Circle-only JSON hunks (displayName, the `shape` port object, the `dynamicports` group — the exact
text s34 had already verified), commit that together with the Shape/SVG source as `64fca4e7`.
Then hand-reapply the Dropdown `items.default` hunk fresh and commit that with the Dropdown source
as `7696420f`. Each state verified byte-identical to a fresh `--out-dir` generation, and verified
that at each point exactly the one intended node differed from `git show HEAD:…`.

🔴 **Lesson for whoever hand-patches this file next**: if `git status` already shows
`node-catalog.json` modified before you've touched it, **stop and `git diff -- node-catalog.json`
first** — find out whose change is already sitting there before adding yours on top, or the file
becomes two features tangled into one diff that can't be committed separately later.

### §B3 What was NOT touched this session

§A1's icon-colour (`#FFFFFF`→`#000000`, four sites) and Video Source-sentence work is still
sitting uncommitted, exactly as s33/s34 left it. Nobody has claimed it. `catalog:check` is still
red for that reason alone — verified again this session (`--out-dir` diff shows exactly those
same deltas, nothing new).

### §B4 SESSION 36 — the two cheapest §A4 rows, BUILT+COMMITTED (`645c3922`)

Picked up §D's ordering. Before touching anything, checked `git status` against files each item
would need — `Button.tsx`/`button.ts`/`RadioButton.tsx` were **already modified**, dated
"Richard, 2026-09-04" in their own comments, i.e. a live/very recent peer session's uncommitted
work on item 3 of §A4's table. Left it alone (see that row) and built the other two:

- **Filter properties bar.** `PropertyFilterInput.tsx` passes `SearchInput` a new
  `UNSAFE_className="property-filter-input"`, which lands on the `<input>` itself (not `Root`) —
  confirmed by reading `SearchInput.tsx` first, since the two props go to different elements.
  `propertyeditor.css` adds `.property-filter input.property-filter-input { border-control; }`,
  an element+class selector chosen deliberately: a single class here would tie the module's own
  `.SearchInput { border: none }` on specificity and the winner would depend on stylesheet load
  order, which is exactly the kind of "works on my machine" bug this repo's memory files warn
  about repeatedly. Added `box-sizing: border-box` alongside it — the field's `45px` height has no
  box-sizing of its own, so a bare `border: 1px` would have grown it by 2px and nudged the sticky
  offset math `propertyeditor.css`'s own comment already measured precisely.
- **The variant-section divider.** `variantseditor.css`'s `.variants-editor` — the ONLY consumer
  of that class (`visualstates.tsx` reuses `.variants-section`/`.variants-button` but has its own
  root class, checked by grep, not assumed) — had `border-bottom: 1px solid
  var(--theme-color-bg-1)`, the same token as the panel ground it sits on. Switched to
  `--theme-color-border-default`, matching `.property-header-bar`'s existing divider elsewhere in
  the same file. Left the "variant" *word* alone in both features — `ProjectModel.createNewVariant`
  /`findVariant`/the toasts are load-bearing product vocabulary, not a naming accident, and a
  rename was more than "cheapest of what's left" should carry without Richard's sign-off.
  🔴 **Found, not fixed: `visualstates.css` has the identical bug one section further down** — see
  §D.
- Both used an Explore agent first to locate the exact adjacent-render site
  (`propertyeditor.ts:224-225`, two sibling `section()` divs with no separator) and to confirm
  `refusalPlan.test.ts`'s `displayName: 'Variant'` literal is unrelated synthetic fixture data —
  NOTES' own caution about it turned out not to apply.
- **Readings**: `tests-unit/nat-001/palette-contrast.spec.ts` 262/262 (the new row is a duplicate
  tuple of an existing one, so `DISTINCT_PAIRINGS` stayed unchanged, and asserting that was itself
  part of the check); `tsc -p noodl-editor` clean on the touched files; a broader
  `propertyeditor|nat-001` filtered run: 400/402 suites, the 2 failures are the pre-existing
  `sb-007`/`vfn-011` baseline §A1 already owns, unchanged by this. **Not driven in a running
  editor** — system load was >10 from other concurrent sessions when this was built (`uptime`
  checked first), and this repo's own standing rule is one heavy job at a time on this box.

---

## ⬅️ §C WHAT'S STILL NOT DONE

1. 🔴 **NOTHING FROM REL-015/FB-013/the Shape node is DEPLOYED**, and `0025` has never run against
   production. It sets every existing row to `unlisted`, so whoever is on `/people` today **comes
   off until approved** — and under D4 their `/u/<handle>` 404s too. **Count first**:
   `select count(*) from profiles where visibility='public' and hidden_at is null;`
2. **The listing card and chat composer have never been driven in a running editor.** Graded by
   element-tree walk and a round trip through the real route against a real database — neither is
   a person clicking it.
3. ⏳ **REL-015 AC9/AC11 are still Richard's** — two YouTube links, one real tutorial.
4. 🔴 **`catalog:check` is still `EXIT=1`** — purely §A1's uncommitted icon-colour + Video Source +
   textinput-placeholder deltas (unchanged, see §B3). The Video sentence (§A4) still can't commit
   alone until §A1 lands and the catalog is regenerated with **both** reconciled together.
5. The Dropdown's beginner JSON mode (§A item 4's harder half) is unbuilt — needs a decision with
   Richard among the three directions in `NOTES` §3, or ship nothing further on it.

---

## 🔴 §D WHAT THE NEXT SESSION BUILDS, IN THIS ORDER

**§A4's first two items are BUILT+COMMITTED (s36, `645c3922`)** — filter-bar contrast and the
variant-section divider. What's left:

1. 🟡 **Check on the Button `outline`/`ghost` icon fix before touching it.** It was already sitting
   uncommitted (`Button.tsx`, `button.ts`, `RadioButton.tsx`) at the start of s36, apparently from a
   concurrent peer session — `git diff` those three files again first; if they're still there and
   look finished, it still needs the "render gate over all five variants" test coverage before
   anyone calls it closed. If they're gone, someone else committed it — check `git log`.
2. `visualstates.css`'s `.property-editor-visual-states` has the **same invisible-divider bug** s36
   just fixed on `.variants-editor` — `border-bottom: 1px solid var(--theme-color-bg-1)`, one
   section further down. One-line fix, not yet done, found but out of scope this session.
3. Then either pick a Dropdown beginner-mode direction with Richard, or leave it as backlog and
   move to the bigger/blocked items: Design Tokens panel (own phase), default tutorial content
   (blocked on his brief, on purpose).

⚠️ **None of these block the 0.2.2 cut.** [REL-012](REL-012-THE-LESSONS-NOBODY-RECEIVES.md) does
(a fresh install opens Learning empty) — built, pending his drive. See §F for the rest of the
board, **re-derive it yourself** — it was not touched this session.

---

## §F The board, carried forward from s33's derivation — 🔴 NOT RE-VERIFIED THIS SESSION

Nothing platform-side (REL-001/004/010/011c/012/013/014) was touched in s35. Re-derive from
[`TASKS.md`](TASKS.md) before trusting this table for anything beyond REL-015's row.

| # | row | state |
|---|---|---|
| 6 / 6b | REL-002c · [REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) | ⏳ **RICHARD'S LOOK.** Judgements 1 and 3 built; **2 and 4 still unbuilt** |
| 7 | REL-001 — publish the members' area | ⏳ **RICHARD.** *fix first, publish once*. Nothing stands against it |
| 8 | REL-004 — cut and tag `v0.2.2` | 🔴 `cline-dev` unpushed (re-derive count at cut time), CI has run on none of it |
| 9c | REL-011c | 🟡 ⏳ AC3 is Richard's ruling. **Site builder is BACK ON HOLD** (his D1) |
| 11 | [REL-012](REL-012-THE-LESSONS-NOBODY-RECEIVES.md) | 🟢 ⏳ **BLOCKS 0.2.2.** AC1–AC4 built, 30/30. **AC5 is a drive** needing his `~/Library/Application Support/NodeGX` moved aside |
| 12 | [REL-013](REL-013-THE-TEMPLATES-TAB.md) | 🟢 40/40. ⏳ AC2's *"no request on cold start"* is proven structurally, not by watching the network |
| 13 | [REL-014](REL-014-THE-VALUE-THE-FIELD-DESTROYS.md) | 🟢 86/86 — **four copies, not two** |
| 14 | [REL-015](REL-015-THE-SHELVES-YOU-CAN-FILL.md) | 🟢 **s35: editor button + platform route COMMITTED, both repos.** Residuals in §C1–§C3 |

---

## §G Working rules for this tree — carried forward, plus what s35 earned

0. 🔴 **A SPEC THAT FAILS TO *RUN* REPORTS A CLEAN TEST COUNT.** ✅ Gate on the EXIT STATUS and the
   SUITE COUNT, never on the absence of a `✕`. **`Tests: 0 total` CAN JUST MEAN THE WRONG
   DIRECTORY** — a compound `cd … && …` persists cwd into later tool calls; `pwd` first or use
   absolute paths.
1. 🔴 **AN UNQUOTED HEREDOC EXECUTES BACKTICKS INSIDE THE TEXT YOU ARE WRITING.** ✅ `<<'PY'` always,
   never interpolate a path into the heredoc.
2. 🔴 **BACKTICKS INSIDE A TAGGED TEMPLATE LITERAL TERMINATE IT.** Match the file you're editing.
3. 🔴 **A GATE IN ANOTHER PHASE THAT GOES RED IS USUALLY RIGHT.** ✅ Repair it by **DERIVING** the
   population, never by picking a better literal.
4. 🔴 **REGENERATING A SHARED ARTEFACT IS AN UNPERFORMED MERGE.** ✅ `--out-dir` to a scratch
   directory and **diff** before writing in place.
5. 🆕 **IF THE SHARED ARTEFACT IS ALREADY DIRTY BEFORE YOU TOUCH IT, `git diff` IT FIRST.** §B2 —
   two sessions' hand-patches tangled into one file because nobody checked whose change was
   already sitting there. `git checkout HEAD --` + reapply each patch separately, one commit per
   feature, if that happens to you.
6. 🆕 **A `default` ON A PORT WITH A HAND-WRITTEN `set` DOES NOT REACH THE RENDER.** §B1 — the
   runtime seeds a port's `default` into `_inputValues` for an unauthored input but never calls
   the port's own `set`, so `props.<name>` (what the React component reads) stays whatever it was
   — the property panel's summary lies about what's on screen. Seed `props.<name>` directly in
   `initialize()` instead; keep `default:` on the port too so the panel and the render agree.
   `inputProps` ports don't have this problem — different code path, defaults applied straight
   into `props` at construction.
7. 🔴 **A LITERAL IN A GATE IS NOT ONLY AN ID — A WORD THE PRODUCT PRINTS IS ONE TOO.** Import the
   product's vocabulary; never retype it.
8. 🔴 **AN OOM LOGS `0 error TS` AND READS EXACTLY LIKE A PASS.** Gate on the exit status; `134` is
   the V8 abort. ✅ Compile the UNEDITED file as the control.
9. 🔴 **A `tsc` EXIT=0 PROVES NOTHING UNTIL YOU CHECK WHAT THE CONFIG INCLUDES.**
10. 🔴 **A SENTINEL MUST NOT COLLIDE WITH A REAL READING.**
11. 🔴 **WHEN THE USUAL CONTROL IS UNAVAILABLE, SAY SO AND FIND ANOTHER ONE.**
12. 🔴 **A LITERAL COUNT GATE ONLY WORKS IF SOMEBODY RUNS IT.** Touch either template artefact ⇒
    mcp jest + its drives + `test:main` **and** `test:ci`.
13. 🔴 **COMMIT BY PATHSPEC, NEVER `git add`** — except untracked paths, which a pathspec commit
    **skips silently**.
14. 🔴 **NEVER OPEN `templates/members-area` OR the site-builder template IN THE EDITOR.** Work
    through `npm run template:members` / `template:site-builder`.
15. ⚠️ **`test:ci`'s readout is `packages/noodl-editor/tests/test-results.json`**, not
    `packages/noodl-editor/test-results.json`.
16. ⚠️ **`electron/dist` in `ps` matches the MCP servers.** Read `ps -o command=` before attributing.
