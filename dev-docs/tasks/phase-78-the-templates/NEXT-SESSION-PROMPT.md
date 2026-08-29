# Phase 78 — next session

## Where it stands

**Richard scoped the repair into three tracks and ruled all three in scope, with Track C handed to
phase 80. A and B are done as far as they go; B is capped by C exactly as the scope said it would be.**

| | before | after |
|---|---|---|
| screens carrying the association's identity | **1 of 11** | **8 of 11** |
| components | 22 | **23** (`Members/Chrome`) |
| cloud-function nodes whose `Failure` reached nothing | **10** | **0** |
| date formats shown to a person | **3** (two machine) | **1** |
| buttons on `/members`, and primaries among them | 5, **0 primary** | 4, **1 primary** |
| open bugs D22–D25, D27 | 5 | **0** |
| template + appearance · drives | 68/68 · 71/71 | **68/68 · 71/71** |

✅ `typecheck:mcp` clean. 12 rendered views, **0 console errors**. ⚠️ `test:ci` **not run** — no editor
source touched, deliberately: Track C is phase 80's lane.

## 🔴 Read this before you touch the visuals again

**B3 is blocked and must stay blocked.** The kit has exactly one content surface — of eighteen
compositions, `bandSurface:120` and `card:170` both fill with `var(--surface)` — so nine kinds of
thing wear the same box. Making a row look unlike a panel needs either a kit change (Track C, phase
80's) or raw values, and **raw values are D10**, the defect this phase exists to stop generating.

✅ It is handed over properly: [TRACK-C-HANDOFF.md](TRACK-C-HANDOFF.md) has file, line and
measurement for D26 and D18/D19. 🔴 **The cheap part**: `--surface-raised` is already a token and
**no composition reads it** — zero references, zero nodes painting it. The second surface needs a
reader, not a palette decision.

## Then, in order

1. ⬜ **B2 — real navigation.** The band carries identity and the way out; every page still ends in
   "Back to the members area". ⚠️ **Six nav items do not fit at 390px** — that is the exact overflow
   this session just fixed on three buttons. Whatever you build must reflow, which means
   `net.noodl.visual.columns`; a `Group` row cannot.
2. ⬜ **B4 — type doing more work.** Page eyebrows, rules between sections, tabular numerals on dates.
   Cheap, and the ramp is already in the kit.
3. ⬜ **Seed sample content into the shipped template** (AC6 ships graphs, not rows — still open and
   additive). ✅ The *reading* is no longer owed: this session toured all eleven pages with two
   announcements, two meetings, a request and a member in place, which is how D22–D25 were found.
4. ⬜ **Then** T5 / publishing. AC1 is ungradeable until it is on the shelf.

## 🔴 Traps this session paid for

- 🔴 **A confident comment can hide a defect for eight sessions.** `claimAssociation`'s wiring said
  *"`founder` reaches NEITHER response, and that is the whole decision about it."* The reasoning was
  sound; the implementation hung the request for 30s. **"Do not tell them it failed" and "send
  nothing at all" are different things.** Ten nodes across all four cloud functions (D27).
- 🔴 **A date-only string parses as UTC midnight.** `new Date('2026-09-14').toLocaleDateString()`
  renders **the day before** in any negative offset. Every meeting in the diary was a day early for
  anybody west of Greenwich, and it looked right here only because this machine is not. `humanDay()`
  in `tpl001Components.ts` has the anchored-`$` branch; use it rather than `new Date(x)`.
- 🔴 **A `Group` has no breakpoint** — `columnsTwoUp`'s own description says so. Three buttons in a
  row ran off the right edge at 390px with *"Who belongs"* reduced to one visible letter. Only
  `net.noodl.visual.columns` reflows. ⚠️ Its `gridAutoFit` composition is sized for **cards**
  (`minWidth: 280`); override it for anything smaller.
- 🔴 **Check 390px before committing any layout.** Both regressions this session were invisible at
  1280 and obvious at 390 — the second was the header name running under the Sign out button, because
  `space-between` gives air only while there is air.
- 🔴 **A pathspec commit does not pick up untracked files**, and it bit again this session on a new
  doc. ✅ `git add <paths> && git commit <paths>` in one chain; then `git status --short | grep '^??'`.
- 🔴 **A peer's uncommitted work can block your generation.** `failureReachesNothing.ts` was sitting
  untracked in the tree and refused `template:members` mid-session. It was **right** and it found
  D27. Read the diagnostic before assuming a collision.
- ⚠️ **The gates move when the artefact grows.** A new component moves three pins: the file count
  (`23 * 3 + 3`), `built.order`/`shipped` length, and — if it uses a new composition — **§4**, which
  is doing exactly its job when it reddens.
- ⚠️ Only `--space-2/3/4/5/6/10/12` are proven to resolve in this template.
- ⚠️ `TPL001_DIAG_DETAIL=1 npm run template:members` prints every diagnostic individually. A clean
  run is **58 × dynamic-port-skipped + 6 × unknown-type-check-skipped** and nothing else.
- ⚠️ **Never open `templates/members-area/` in the editor** — opening writes three files into it.
- ⚠️ `nodegx-backend` and `noodl-mcp` are **jest**, run **from the package directory**, never two
  package suites at once. `typecheck:mcp` is a **root** script.

## Richard's rulings, still standing

- **Scope, 2026-08-29: A + B + all of C, with C done by phase 80** — not by this phase, because
  phase 78's isolation from editor source is what has kept it from colliding all week.
- **Appearance is an acceptance criterion, graded BEFORE the behaviour work, by looking at it.**
  ✅ Honoured: every change this session was rendered and read at 1280 and 390 before being committed,
  and that is how both regressions were caught.
- **Templates exist to surface product defects** — findings go in the register **as work with an
  owner**, never as notes.
- **Privacy**: `requestAccess` keeps the non-answer.
- **Publishing**: not yet. He drives it first.
