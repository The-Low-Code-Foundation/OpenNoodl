# Phase 39 — Progress

**Status:** 6 done, 8 not started (2 of those found by the verification pass, not reported).
**Last updated:** 2026-08-03 (second session)

POL-006 also has a head start nobody had noticed: **`library/modules/lucide-icons/` already ships the
full Lucide set as a bundled ISC webfont** (1998 glyphs, `lucide.woff2` + a `type: "iconset"`
manifest), imported 2026-07-25. POL-006's premise — "no project ships one" — is true of the project
*templates*, not of the repo. The curated starter set and Richard's "let users add their own" are
both a matter of wiring that module in, not of sourcing an icon set.

## Tasks

| Task | Reported items | Status | Notes |
|---|---|---|---|
| [POL-001](POL-001-SETTINGS-PANEL-CRASH.md) — settings panel crash | 15 | ✅ **done** | All 5 criteria. Slice 2 answered: the key is not lost — v2 elides an empty `settings: {}` by design on both sides. Verified live on "AIB38 Live Chat", the project that actually crashed. `c6d5f9f8` |
| [POL-002](POL-002-LINKS-AND-THE-LEARN-TAB.md) — links + Learn tab | 1, 2, 5 | ✅ **done** (1 residual) | Removing `react-instantsearch` broke 18 unrelated files: it was the only thing in the tree still declaring a **global `JSX` namespace**, typed for *Preact's* VNode. All 22 annotations moved to `React.JSX`. Criterion 6 (packaged build) not run — human-gated. `d9c0f37c` |
| [POL-003](POL-003-THE-LEFT-RAIL.md) — the left rail | 3, 4, 6 | ✅ **done** (slice 2 deferred) | Contrast now 8.26:1 dark / 7.49:1 light, measured live. 5 Lucide glyphs in. `IconSize` sweep deferred per Richard → [POL-013](POL-013-ICONSIZE-SWEEP.md). `d32b3d13`, `fc10449a` |
| [POL-013](POL-013-ICONSIZE-SWEEP.md) — make `IconSize` real | — | ☐ filed, not started | Split out of POL-003 slice 2 on Richard's call. ~130 call sites. |
| [POL-004](POL-004-TOKENS-USED-AS-WHAT-THEY-ARE-NOT.md) — token misuse | 9b, 12a | ✅ **done** (2 residuals) | The check found **25** undefined tokens, not 6 — writing it first, per its own trap, is what caught that. `DialogBackground.Secondary` deleted; it was also miscolouring **every tooltip arrow** in the editor, which nobody reported. Gate: `npm run tokens:css`. Residual: the diff modal and a populated walk are unverified live — both need a longer drive, POL-010 owns the walk. `4382cb24` |
| [POL-005](POL-005-BACKEND-SURFACES-OPEN-DOCKED.md) — backend surfaces | 7 | ✅ **done** (1 open question) | Verified live against a running backend: all seven open at **859px** with **zero** detached-bar elements, close returns to Backend Services, WFA-005's route lands identically. Slice 3's layout pass done in both themes. **Criterion 5's premise was wrong** — a surface has no float/full route at all (1 header button vs Backend Services' 6), so this change removed the only path to full mode. Richard's call whether that matters. Three findings filed, none width-caused: [POL-014](POL-014-THE-DATA-BROWSER-READS-A-KEY-NOTHING-SENDS.md), the invisible "Save policy" button, Schema's bespoke header. |
| [POL-009](POL-009-A-PIN-BELONGS-TO-ONE-CANVAS.md) — pinned run | 11 | ✅ **done** | All six criteria verified live. The identity the fix compares **does** exist for a workflow canvas (`/#__workflow__/wf_pol009`) — that was the open risk. Step index survives navigation at a *non-default* value (`Step 2 / 3`), a second pin replaces the first, unpin is permanent. The pin even outlives the workflow document being closed and rebuilt. |
| [POL-014](POL-014-THE-DATA-BROWSER-READS-A-KEY-NOTHING-SENDS.md) — `record.id` vs `objectId` | — | ☐ filed, not started | Found doing POL-005 slice 3. Blank id column, React key warning, **one cell click opens editors in all rows**, **delete silently does nothing**. Five consequences, all observed live. |
| [POL-015](POL-015-THE-FIRST-WORKFLOW-CANNOT-BE-CREATED.md) — first workflow | — | ☐ filed, not started | Found setting up POL-009's fixture. The create form's backend list is derived from *existing workflows*, so with none it passes `''` and fails. A first-run blocker for the whole workflow feature. |
| [POL-006](POL-006-A-FONT-AND-AN-ICON-SET.md) — font + icon set | 8 | ☐ not started | `--font-sans` is dangling repo-wide. Recommends Inter + Lucide sprite, bundled not CDN. Touches `LocalProjectsModel.ts` — dirty in another session. |
| [POL-007](POL-007-THE-BUILD-PANEL-FITS.md) — Build panel layout | 9a | ☐ not started | Mechanism confirmed (row min-width > 400px panel). |
| [POL-008](POL-008-SAMPLE-DATA-AND-A-THIN-BUILD.md) — sample data + thin build | 10 | ☐ not started | **Part A undiagnosed** — three candidates, pick one before fixing. Part B gated on POL-006. |
| [POL-010](POL-010-THE-WALK-DOESNT-WALK.md) — provenance walk | 12b | ☐ not started | **Undiagnosed.** Two candidates. Blocked on POL-003 + POL-004 for readability. |
| [POL-011](POL-011-FX-ON-MULTILINE-STRINGS.md) — `fx` on multiline | 13 | ☐ not started | Mechanism confirmed: `multiline: true` routes to `TextAreaType`, which has no expression support. |
| [POL-012](POL-012-SET-ALL-FOUR-SIDES-AT-ONCE.md) — link padding/margin | 14 | ☐ not started | Includes the four-undo-entries defect, worth fixing independently. |

## What is confirmed vs. what is not

Ten of the twelve tasks have a mechanism established by reading the code, with file and line
references in each spec. **Two do not**, and their first slice is diagnosis, not repair:

- **POL-008 Part A** — why sample data does not reach the preview. Three candidates; the plumbing
  exists end to end, so it is one of "never emitted", "wrong shape for a `User` node", or "the
  sandbox drops it".
- **POL-010** — why the provenance walk stops at one hop. Two candidates; the suspicious signal is a
  node id that equals the node name, which would break edge lookup entirely.

Neither should be estimated or started as a fix.

## Answered by Richard — 2026-08-03

1. **Font: Inter.**
2. **Icon set: we pick the list** — *"but make sure a user can expand the number easily, adding their
   own icons to the project from the Lucide library (dunno how you would do that, maybe add a help
   tip somewhere on the icon node?)"*. So POL-006 owns two deliverables, not one: a curated starter
   set **and** a documented, discoverable path to add any other Lucide glyph to a project. The
   affordance goes where a user meets the limit — the Icon node's property panel.
3. **`IconSize`: scope to the hide-panel button, file the rest.** POL-003 slice 2 (the four
   `is-size-*` rules, a ~130-call-site change in effect) is **out of this phase**. The hide-panel
   glyph is sized from its own container instead. `IconSize` stays inert everywhere else and the
   sweep becomes its own task — say so in the notes rather than claiming the size prop was fixed.
4. **POL-008 Part B: styling floor in CONVENTIONS, re-judged after the font lands.** As specified.

## Not in this phase

- Rebuilding the lessons. POL-002 hides the Learn tab and leaves `LearningCenter` compiling; the
  rebuild is a later learn phase.
- Model output quality beyond POL-008's styling floor.
- Anything in `index.bundle.js` — it is a committed build artifact and is not a source file.
