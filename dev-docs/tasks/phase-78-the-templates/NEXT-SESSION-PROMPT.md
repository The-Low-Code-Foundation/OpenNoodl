# Phase 78 — next session

## Where it stands

**B2 is done: the band is the navigation, and the six dead ends are gone.** Track A and B1 landed in
s8; B3 stays blocked on phase 80's C1 by design. What is left in Track B is B4 and the sample content.

| | before s9 | after |
|---|---|---|
| ways out of a page, other than the browser's Back | **1**, always to `/members` | **5**, from the band |
| destinations a moderator reaches in one click | 5, and only from `/members` | **5, from any page** |
| "Back to …" buttons in the artefact | 6 | **0** |
| children of a `Columns` overflowing their box | **8** | 0 |
| `tpl001Template` + `templateAppearance` | 68/68 | **73/73** |
| the three tpl001 drives (real backend, real browser) | 71/71 | **71/71** |

✅ `typecheck:mcp` clean · noodl-mcp **904/904**. ⚠️ `test:ci` **not run** — no editor source touched,
deliberately: Track C is phase 80's lane and that isolation is what has kept this phase collision-free.

## 🔴 Read this before you touch the visuals again

**B3 is blocked and must stay blocked.** The kit has exactly one content surface — of eighteen
compositions, `bandSurface:120` and `card:170` both fill with `var(--surface)` — so nine kinds of
thing wear the same box. Making a row look unlike a panel needs either a kit change (Track C, phase
80's) or raw values, and **raw values are D10**, the defect this phase exists to stop generating.

✅ Handed over properly: [TRACK-C-HANDOFF.md](TRACK-C-HANDOFF.md) has file, line and measurement for
D26 and D18/D19. 🔴 **The cheap part**: `--surface-raised` is already a token and **no composition
reads it** — zero references, zero nodes painting it. The second surface needs a reader, not a
palette decision.

🔴 **And there is a new one for phase 80 — [D28](DEFECTS-THE-TEMPLATES-FOUND.md), unowned.** Both
button compositions pin `sizeMode: 'contentSize'`; `Columns` hands each child an equal box; a
content-sized child ignores it and overlaps the next. **Following the design system verbatim, inside
the one node in the runtime that reflows, produces overlapping controls.** The template side is fixed
and gated; the kit side is not.

## Then, in order

1. ⬜ **B4 — type doing more work.** Page eyebrows, rules between sections, tabular numerals on dates.
   Cheap, the ramp is already in the kit, and it is now the last unstarted item in Track B. ⚠️ The
   band already uses `eyebrow`; pages do not.
2. ⬜ **Seed sample content into the shipped template** (AC6 ships graphs, not rows — still open and
   additive). ✅ The *reading* is not owed: s8 toured all eleven pages with content in place.
3. ⬜ **Then** T5 / publishing. AC1 is ungradeable until it is on the shelf, and Richard drives it
   first.
4. ⬜ **D29, when you are next running the drive anyway.** The band and the page each call
   `myStanding`. The fix — the band publishing standing and the five pages consuming it — is a better
   app and touches **every wire AC2/AC3/AC4 rest on**, so it belongs beside a drive, not before one.

## 🔴 Traps this session paid for

- 🔴 **A gate that compares the artefact against the table it was generated FROM cannot fail.** The
  band's first specs mapped over `BAND_NAV` and read like "a declaration against a measurement".
  Deleting `moderatorOnly` from one row moved **both sides together** and left the whole describe
  block green. ✅ **Write the second statement as literals**, and sabotage before believing it.
- 🔴 **A layout defect can hide at 390px and appear at 1280.** s8's trap — *check 390 before
  committing* — is right and it pointed **away** from this one: auto-fit makes many narrow columns
  when there is room, so the overlap is a wide-viewport defect. ✅ **Look at both, both ways round.**
- 🔴 **A fix applied where the symptom appeared leaves the other instance.** The overlap showed in
  the new band; the same defect had been shipped on `Pages/Members` since s8, clearing its box by two
  pixels. ✅ **Write the repair as a rule over the PLACE** (`inColumn`), then sweep the artefact.
- 🔴 **A picture cannot show that a signal fires.** The band's standing call hangs off a `Group`'s
  `didMount`, read from source. Only the drive proved it: `Post | Requests | Who belongs` painted for
  a moderator and **absent from `outerHTML`** for a member, same run.
- ⚠️ **The door is silent about a button wired to nothing.** Deliberately dropping one nav item's
  `onClick` produced a clean generation run — same 57 + 6 diagnostics as a good one. Same family as
  §11's instance-port finding.
- ⚠️ **The gates move when the artefact grows.** A new `mounted` gate moves the pin at
  `tpl001Template.test.ts` (29 → 32); a new `Columns` child moves `graded` (8). Both are doing their
  job when they redden.
- ⚠️ `TPL001_DIAG_DETAIL=1 npm run template:members` prints every diagnostic. A clean run is
  **57 × dynamic-port-skipped + 6 × unknown-type-check-skipped** and nothing else. (58 before s9 —
  six back buttons out, five nav buttons in.)
- ⚠️ Only `--space-1/2/3/4/5/6/10/12` are proven to resolve in this template.
- ⚠️ **Never open `templates/members-area/` in the editor** — opening writes three files into it.
- ⚠️ The three tpl001 drives take **~85s** and need the backend; `nodegx-backend` and `noodl-mcp` are
  **jest**, run **from the package directory**, never two package suites at once. `typecheck:mcp` is a
  **root** script. Docker was down this session and the drives ran anyway — Postgres is native on 5432.
- ⚠️ `measure-from-disk.js` skips the two pages whose `urlPath` takes a route parameter and **says so**.
  To look at a gated screen, copy the artefact to a scratch directory and ungate it there — never in
  `templates/`.

## Richard's rulings, still standing

- **Scope, 2026-08-29: A + B + all of C, with C done by phase 80** — not by this phase, because
  phase 78's isolation from editor source is what has kept it from colliding all week.
- **Appearance is an acceptance criterion, graded BEFORE the behaviour work, by looking at it.**
  ✅ Honoured: the band was rendered and read at 1280 and 390 for both a member and a moderator, and
  that is how D28 was found.
- **Templates exist to surface product defects** — findings go in the register **as work with an
  owner**, never as notes.
- **Privacy**: `requestAccess` keeps the non-answer.
- **Publishing**: not yet. He drives it first.
