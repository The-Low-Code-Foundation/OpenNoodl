# Phase 78 — next session

## Where it stands

**B4 is done, and Track B has one item left: the sample content.** Track A, B1 and B2 landed in
s8–s9; B3 stays blocked on phase 80's C1 by design; B4 shipped two of its three items and the third
turned out to be impossible and is now [D30](DEFECTS-THE-TEMPLATES-FOUND.md).

| | before s10 | after |
|---|---|---|
| pages that say what KIND of screen they are | **1 of 11** (the landing hero) | **11 of 11** |
| `eyebrow` placements in the artefact | 3 | **13** |
| pages whose two audience zones are separated by more than a gap | 0 of 1 | **1 of 1** |
| `tpl001Template` | 51/51 | **55/55** |
| the three tpl001 drives (real backend, real browser) | 71/71 | **71/71** |

✅ `typecheck:mcp` clean · generation reproducible (**57 + 6** diagnostics). ⚠️ `test:ci` **not run**
— no editor source touched, deliberately: Track C is phase 80's lane and that isolation is what has
kept this phase collision-free all week.

## 🔴 Two reds in `noodl-mcp` are NOT this phase's, and both were established

Do not spend a session on either.

- **`templateAppearance §1 site-builder has the pinned page count`** — expected 5, got **6**. A
  peer's live work: `site-builder.content.json` and three `sb00*` specs are modified in the tree.
  **Theirs to re-pin**, and they are editing that same suite so they will meet it.
- **`renderReportModule` AWP-003 ×2** — fails **at HEAD**, unrelated to templates. Test file
  (08-09), fixture (tracked, clean), `render-report.js` and `visualRoots.ts` all unmodified. The
  nearby modified `render-from-disk.js` (phase 80's DEF-003) is **excluded**: it is reached only via
  `RENDER_SCRIPT` at the server launch, and `blankDiagnosis` is static analysis that never spawns
  one.

## 🔴 Read this before you touch the visuals again

**B3 is blocked and must stay blocked.** The kit has exactly one content surface — of eighteen
compositions, `bandSurface:120` and `card:170` both fill with `var(--surface)` — so nine kinds of
thing wear the same box. Making a row look unlike a panel needs either a kit change (Track C, phase
80's) or raw values, and **raw values are D10**, the defect this phase exists to stop generating.

✅ Handed over properly: [TRACK-C-HANDOFF.md](TRACK-C-HANDOFF.md) has file, line and measurement for
D26 and D18/D19. 🔴 **The cheap part**: `--surface-raised` is already a token and **no composition
reads it** — zero references, zero nodes painting it. The second surface needs a reader, not a
palette decision.

🔴 **Two unowned rows are still unowned** — [D28](DEFECTS-THE-TEMPLATES-FOUND.md) (a `contentSize`
button inside a `Columns` overlaps its neighbour: following the design system verbatim, inside the
one node that reflows, produces overlapping controls) and **new this session, [D30](DEFECTS-THE-TEMPLATES-FOUND.md)** —
the runtime's shared text-style group is nine ports and `font-variant-numeric` is not one of them,
so **no app built here can align a column of numbers**, and a project file carries no stylesheet to
work around it with. Both are product-side. ✅ [D25](DEFECTS-THE-TEMPLATES-FOUND.md) was found to be
**already fixed** in Track A and its row had been stale for a day — re-measured and closed.

## Then, in order

1. ⬜ **Seed sample content into the shipped template.** AC6 ships graphs, not rows — still open and
   additive, and it is now the last unstarted item in Track B. ✅ The *reading* is not owed: s8
   toured all eleven pages with content in place.
2. ⬜ **Then** T5 / publishing. AC1 is ungradeable until it is on the shelf, and **Richard drives it
   first**.
3. ⬜ **D29, when you are next running the drive anyway.** The band and the page each call
   `myStanding`. The fix — the band publishing standing and the five pages consuming it — is a better
   app and touches **every wire AC2/AC3/AC4 rest on**, so it belongs beside a drive, not before one.

## 🔴 Traps this session paid for

- 🔴 **An id in this artefact is not a name you may do arithmetic on.** All eleven pages call their
  heading `heading`, so the door remaps ten (`headingHead-2` … `-8`) — D6's documented behaviour. A
  spec deriving the eyebrow's id with `replace(/Head$/, '')` matched nothing on every remapped page
  and **reported two of ten as if the other eight had no eyebrow**. ✅ Read a child, not a name.
- 🔴 **The sabotage caught a spec grading a table against a table.** §5's "never repeats the band's
  words" **passed** with a page eyebrow set to the band's own phrase, because it filtered the
  hand-written table and never opened the shipped pages. s9's lesson one turn further out: it is not
  enough for *one* side to be a measurement — **the side the rule is ABOUT** has to be.
- 🔴 **A heuristic that catches seven things when you mean one is measuring the wrong property.**
  §6's first draft counted every page head as its page's first section. ✅ The vocabulary already
  drew the line: `sectionHead` carries the air below it (`paddingBottom`), `SECTION` carries none.
- ⚠️ **A "cheap" copy fix can have a blast radius.** `Members sign in` → `Sign in` reads better now
  the eyebrow carries the context — and that string is also a landing-page **button label**, a
  `PRIMARY_LABELS` key and three drive assertions. Left alone on purpose.
- ⚠️ **`npx jest` from the repo ROOT parse-fails on TypeScript** (`Unexpected reserved word
  'interface'`, `Tests: 0 total`) — it is not your change. `cd packages/<pkg>` first, and note a
  `cd repo-root && ...` earlier in the session moves you back.
- ⚠️ Only `--space-1/2/3/4/5/6/10/12` are proven to resolve in this template; `--border-1` and
  `--border` do too (`afterSection` uses them).
- ⚠️ **Never open `templates/members-area/` in the editor** — opening writes three files into it. To
  look at a gated screen, `cp -R` it to a scratch directory and ungate it **there**.
- ⚠️ `measure-from-disk.js --page "/Pages/X" --screenshot full --out <prefix>` is the fastest way to
  look at one screen; it skips the two pages whose `urlPath` takes a route parameter and **says so**.
- ⚠️ The three tpl001 drives take **~85s** and need the backend; `nodegx-backend` and `noodl-mcp` are
  **jest**, run **from the package directory**, never two package suites at once. `typecheck:mcp` is a
  **root** script. Docker was down again and the drives ran anyway — Postgres is native on 5432.

## Richard's rulings, still standing

- **Scope, 2026-08-29: A + B + all of C, with C done by phase 80** — not by this phase, because
  phase 78's isolation from editor source is what has kept it from colliding all week.
- **Appearance is an acceptance criterion, graded BEFORE the behaviour work, by looking at it.**
  ✅ Honoured: `Pages/Members` was rendered and read at 1280 and 390 with both zones open,
  `Pages/SignIn` and `Pages/Setup` at 1280, and then the whole thing driven.
- **Templates exist to surface product defects** — findings go in the register **as work with an
  owner**, never as notes.
- **Privacy**: `requestAccess` keeps the non-answer.
- **Publishing**: not yet. He drives it first.
