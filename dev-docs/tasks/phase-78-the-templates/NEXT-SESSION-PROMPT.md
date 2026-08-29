# Phase 78 — next session

## Where it stands

**Track B is finished and D29 is closed.** s12 landed B3, the last of Track B; s13 took the one
engineering item the prompt left behind — the five pages that asked the server who you are a second
time — and measured the result rather than inferring it.

| | before s13 | after |
|---|---|---|
| `myStanding` calls on a signed-in page load | **2** on five of seven pages | **1** everywhere |
| the two detail pages (never had a second) | 1 | 1 — unchanged |
| `anon.landing`, which carries no band | 0 | 0 — the control |
| the three tpl001 drives (real backend, real browser) | 75/75 | **79/79** (+4 D29 specs) |
| `tpl001Template` | 67/67 | **71/71** (+2 D29, +2 a peer's DEF-006 §4b) |

✅ `typecheck:mcp` and the backend typecheck clean · generation reproducible and exit 0 (**63 + 6**
diagnostics, unchanged) · `templateAppearance` 22/22, `d18-controls-wear-the-app-font` 5/5,
`def-002/connection-targets` 12/12 — the three other suites that read the generated artefact.
⚠️ `test:ci` **not run** — no editor source touched, deliberately, as every session this phase.

## 🔴 Read this first

- 🔴 **A peer session was live in `packages/noodl-mcp/tests/` throughout s13, and their DEF-006
  §4b work is in this commit.** They committed the product half as `e337325c` at 15:27 but not
  their two test-file hunks, so a pathspec commit of `tpl001Components.ts` and
  `tpl001Template.test.ts` swept them. Nothing was lost and everything is green — but if you are
  that session, your §4b specs are already committed under a D29 message.
- 🔴 **I overwrote a file a peer was editing, and only luck made it recoverable.** To capture a
  baseline spec list I ran `git show HEAD:<path> > <path>` — which is `git checkout --` wearing a
  different name, and it discarded the peer's uncommitted §4b work for thirty seconds. It came back
  only because I had `cp`-snapshotted first for an unrelated reason. **Never redirect `git show
  HEAD:` over a working file on this checkout.** To get a baseline, copy to the scratchpad and read
  it there.
- ✅ **[`tpl001-rows.look.ts`](../../../packages/nodegx-backend/tests/tpl001-rows.look.ts) is still
  the only way to SEE this template with content in it.** Every list draws its empty state on a
  fresh install (AC6, correct), so `render-report` and all three drives read the empty half. No
  suite runs it; the `.look.ts` suffix keeps it out of `testMatch`. Run it whenever you touch a row
  — s13 did not, because s13 changed no layout:

      npx jest --config packages/nodegx-backend/jest.config.js \
        --testMatch '**/tests/**/*.look.ts' --runTestsByPath \
        packages/nodegx-backend/tests/tpl001-rows.look.ts

- 🔴 **[D32](DEFECTS-THE-TEMPLATES-FOUND.md) is still UNOWNED (`NONE`)**, as are D28, D30, D22–D24.
  Two children of a row both grow — the default, every `width` port starts at 100% — and
  `justifyContent: 'space-between'` then distributes nothing. Generation clean, door silent, an 84px
  button rendered **361px** wide.

## Then, in order

1. ⬜ **T5 / publishing.** AC1 is ungradeable until it is on the shelf, and **Richard drives it
   first**. Everything else in TPL-001 is measured. This is the only thing between this template and
   a person having it.
2. ⬜ **TPL-002** (the opt-in notifications). Untouched. Its §3 is the interesting half — *an admin
   posting on a backend with no SMTP is told so, in a sentence, at the moment they post* — and it
   wants the negative control run in the same send, the way §10 got its `0` from the landing page.
3. ⬜ **T3**, the category question. Untouched, and it needs Richard: either extend the ruled
   vocabulary or re-file the three templates that do not fit it.

## 🔴 Traps this session paid for

- 🔴 **Count the thing the person pays for, not the thing the graph says.** D29's fix could have
  been "graded" by counting `Members/Standing` instances — which would pass on a template that
  placed one and called it twice, and fail on one that placed two and called neither. §10 counts
  requests off `performance.getEntriesByType('resource')`, per page load, in the real browser.
- 🔴 **The `0` is what makes the `1`s a reading.** `anon.landing` carries no band and asks nobody.
  Without it in the table, "1 everywhere" is equally consistent with an instrument that cannot tell
  requests apart at all. The *before* column (`2`) is the other control, and it was taken from the
  same instrument on the same harness at HEAD before anything changed.
- 🔴 **Widen a gate by proving provenance, not by loosening the predicate.** The trigger gate said a
  members-only query may only be triggered by a `Members/Standing` instance. Accepting "any port on
  a chrome instance" would have been a hole shaped exactly like the defect; it now proves, from
  `Members/Chrome`'s own graph, which ports the band's standing gate actually drives.
- ⚠️ **Both sabotages generated with exit 0.** The door accepts a band forwarding an unproven port,
  and a page placing a redundant standing gate, in silence. The two specs are the whole boundary.
- ⚠️ **A spec count that moves is a question, not a win.** 67 → 69 looked like my two new specs; it
  was a peer's two, written into the same file while I worked. Diff the spec-name *sets*, not the
  totals.
- ⚠️ **`${PIPESTATUS[0]}` is empty in zsh** — as recorded. Log to a file and read `$?`.

## Richard's rulings, still standing

- **Appearance is an acceptance criterion, graded BEFORE the behaviour work, by looking at it.**
- **Seeding, 2026-08-29: close the delete gap, seed nothing.** AC6's designed empty state is the
  first impression.
- **Scope: A + B + all of C, with C done by phase 80** — not by this phase, because phase 78's
  isolation from editor source is what has kept it from colliding.
- **Templates exist to surface product defects** — findings go in the register **as work with an
  owner**, never as notes.
- **Privacy**: `requestAccess` keeps the non-answer. **Publishing**: not yet. He drives it first.
