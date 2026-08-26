# Phase 75 — next session

**State as of 2026-08-26 (session 44).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue. Take the top unblocked item; dip into the rest when it
bites.

**Committed this session:** queue item 1 — **FB-005 T4**, categories and a search that answers a
sentence. The picker has a facet bar and a search box, `filterTemplates` produces **the rows and
the pill counts from one pass over one predicate**, and the card stopped drawing a machine slug at
a person. 🔴 **Two findings worth carrying**, both in §4c of
[FB-005-SCOPE.md](FB-005-SCOPE.md): the category ruling left a defect at the very surface it was
made for, and **a second spec was found naming a mechanism it never reached** — same shape as s43's
`indexOf`, caught the same way, by a mutant.

⚠️ **Peers.** Six sessions held sockets; four answered the launch announcement directly and all
confirmed idle. The editor drive and `test:ci` were both announced and both ran clean.
✅ **Carried forward and re-confirmed by two peers independently**: `dev:stop` does **not** kill
another session's running `test:ci` — `NEVER_SWEEP` shields the suite *and* its npm/lerna ancestor.
It **does** sweep another session's **editor stack**. `pkill` remains the one unshielded route.
🆕 **`dev:stop --list` immediately before a teardown is the instrument** — a peer's pre-flight
"9222 is free" is only true outside the ~75s window in which a launching stack is invisible.

## The queue — unblocked, cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **FB-005 T5** — "Share as template" files a **submission** | **M** | ✅ **now the top item.** Unblocked by T2; needs the submission table R-templates' posture requires. 🔴 **A submission is third-party code** — P69's *"20/20 ≠ fit to publish"* is the trap, and D-moderation (§5.2) has no named owner |
| 2 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** ⚠️ Its corpus does not exist either — FB-014 measured the bench at **3 posts, 2 threads, 1,369 chars** |
| 3 | **FB-005 T6** — star ratings | **M** | 🔒 **needs a ruling.** Recommendation stands: defer until T5 has produced third-party templates to rate — a star system over a shelf we authored is us rating ourselves |

### 🔴 Two things now sitting with Richard, both surfaced by T4

1. **THREE OF THE EIGHT 0.2.1 TEMPLATES HAVE NO HONEST CATEGORY.** `0020`'s vocabulary —
   `starter`, `data-app`, `dashboard`, `site`, `form`, `integration` — was written before the
   roster existed. Run the roster through it (site builder → personal landing page → pixel game;
   then storefront, membership hub, data dashboard, interactive fiction, shared pixel canvas) and
   **`pixel-game`, `interactive-fiction` and `shared-canvas` are none of the six.** The CHECK
   constraint forces them into `starter`, and a pill labelled **Starter** holding a game, a story
   engine and a shared canvas is not a filter, it is a bin. **The fix is a platform migration plus
   a ruling.** Recorded as an executable note in `template-search.test.ts` §2, which reddens the
   day the vocabulary grows. ⚠️ **Phase 76's site-builder template is unaffected** — it ships
   `site`, which is in the vocabulary.
2. **`--theme-color-border-default` IS 1.07:1 DARK / 1.15:1 LIGHT AGAINST THE PANEL**, and a
   `TemplateCard`'s background is **identical** to the panel (1.00:1). So **T3's unselected
   template card — already shipped — has an effectively invisible boundary**, as does an inactive
   filter pill. WCAG 1.4.11 wants 3:1 for a control's boundary. ⚠️ **Not a T4 edit**: changing that
   token touches every surface in the editor. Same family as FB-002's 1.16:1 pill.

## ✅ Item 1, closed: FB-005 T4 — categories and a search that answers a sentence

**What shipped**, all in OpenNoodl:

- **`ProjectCreationWizard/steps/templateFilter.ts`** — pure, exported, and the **one producer**.
  A pill's `count` is the predicate re-run over the filter that pill's own click would produce, so
  a count that lied would require the function to disagree with itself inside one pass.
- **`TEMPLATE_CATEGORY_LABELS` / `categoryLabel()`** — `data-app` → *Data app*, unknown slugs
  falling through to themselves.
- **The filter bar in `TemplateStepBody`** — **still hook-free**, with `filter`/`onFilterChange`
  **optional** so T3's call site (and phase 76's SB-007) keeps working untouched.
- **A fourth screen** — *"no templates"* and *"nothing matches what you typed"* are different
  sentences with different remedies, told apart by `isFilterActive`, not by the row count.

### 🔴 The finding: the ruling left a defect at the surface it was made for

The category vocabulary was ruled to the platform's machine slugs on 2026-08-26 — right for a
CHECK constraint — and **nothing turned them back into words on the way to a screen**. The card
rendered `{item.category}` verbatim, so from the ruling until this session the picker drew the
literal string `starter`. **T3's own spec asserted the slug was drawn**, in good faith, one session
earlier. Both directions are asserted now: the label is drawn *and* the slug is not.

### 🔴 The second finding: a spec named a mechanism it never reached

A mutant deleting the all-terms-matched clause from the ranking **survived** a spec called
*"answering every term outranks answering one of them"* — because for that query the intended row
also wins on raw score. ✅ Rebuilt with `site bio`, a query where the two mechanisms **disagree**:
both candidates score exactly 3, so score cannot separate them and shelf order would put the wrong
one first.

🔴 **The rule, now twice in one phase**: a spec that passes is not a spec that grades the thing in
its name. Both survivors were found by mutating the mechanism the *name* claimed, not the one the
assertion happened to touch.

### ✅ AC4: the measurement, and what it is worth

`recall — ORed terms (shipped): 10/10; ANDed terms (control): 5/10; rank-1: 10/10`

🔴 **The absolute figure is worth nothing; the DIFFERENCE is the measurement.** One author wrote
both the corpus and the queries, so the same corpus and the same queries are run through a
known-broken arm (every term must match — what `websearch_to_tsquery` does to a bare sentence) and
it retrieves **half**. The five it loses are exactly the multi-word ones; it keeps the ones that
were already keywords, which is why the defect survived so long elsewhere.

⚠️ **This grades the MATCHER, not the shelf** — the published shelf holds one row. **Re-run it over
real rows when they exist.**

**Old-vocabulary control** (FB-014's shape): `getting started` no longer reaches a row through its
category — proved by a `starter` row whose text never says "start" *not* being returned — while
`hello-world`, whose summary says *"to start from nothing"*, still is. 🔴 The second half is
load-bearing: **a control that returns nothing proves nothing.**

### Decisions taken inside T4, each reversible and each stated

1. **In-memory filtering**, `facets.ts`' choice and its stated limit — the shelf is curated and
   small by construction; the day it is thousands of rows this becomes a `where` and a `group by`.
2. 🔴 **NO server-side `?q=`/`?category=` was added.** FB-005 exists *because* four providers were
   registered, typechecked and reached by nobody — a platform filter with no caller would be that
   finding committed again inside the task opened to clean it up.
3. **Terms ORed, ranking supplies precision** — `searchThreads`' trade, client-side.
4. **Pills come from the rows PRESENT, not the vocabulary** — a pill promising zero is a dead click,
   and an unknown category still gets one. ⚠️ The **active** pill survives a zero count; it is the
   only way back out.
5. **The filter is local `useState` in `TemplateStep`, not a `WizardState` field** — the wizard's
   state is the answers the creation is built from; a search box is how somebody looked for one.

## Driving — what worked, exactly

✅ **Everything in the previous sessions' driving sections still holds**, including the native
value-setter trick for React-controlled inputs and wrapping every `cdp eval` in `{…}`. New:

- ✅ **All four picker screens observed live**, not inferred: the bar (`All (1) ✓`, `Starter (1)`,
  labels not slugs), the no-match sentence with `Clear filters`, the selection-hidden notice, and
  the pill toggle moving `aria-pressed`.
- 🔴 **A ten-word sentence of which only ONE term appears in the document still finds it** —
  *"I want a blank app to start a dashboard from"* returns Hello World. An AND matcher returns
  zero. AC4's claim, observed in the product rather than in a fixture.
- ⚠️ **`data-theme` can be flipped straight on `document.documentElement`** for a contrast pass, but
  the read must be a **second `eval`** — the write is invisible in the same one.
- ⚠️ **CSS-module class names are hashed in the running app**, so `[class*=TemplateFilter-pill]`
  works and an exact class selector does not. In the jest runner they resolve to themselves.

## Gates — session 44

- `tests-unit/fb-005/` — **150 specs, 0 failures** across four files. Reconciles exactly:
  **107 at HEAD + 43 new**, and the 107 was verified with `git show HEAD:` rather than trusted from
  a note. ⚠️ **The s43 prompt said 97 and the s43 scope file said 107** — the scope file was right.
- `npm run test:main` — **344 files / 5649 specs / 0 failures.** ⚠️ **Only +1 file / +43 specs is
  mine**; the rest of the delta against s43's 342/5592 is two peer commits (SB-001, SB-002).
- **14 mutants, 14 killed** — after the survivor above was found and its spec rebuilt. Run with
  `-t` filtered to one spec, so *"killed by its own spec"* is measured and *"and by no other"* is
  **not**. Pristine copies restored by `copyfile`, both files `md5`-verified identical.
- `typecheck:editor` **0**; `typecheck:editor-tests` **0**; `typecheck:core-ui` **44, all `TS2307`
  alias resolution, none ours** — unchanged.
- `npm run tokens:css` — clean over **320** stylesheets. ⚠️ Blind to every ratio measured above.
- 🔴 **`npm run test:ci` — `Jasmine: 2856 specs, 4 failures`, all four `AIX-006 style vocabulary`,
  by name — the clean floor.** ⚠️ **2856 is s43's count unchanged, and that is correct**: T4 added no
  jasmine spec and none renders `TemplateStep`. ~26 min. **The summary line is the verdict, never
  `$?`.**

## Still open, owned by nobody

- 🆕 🔴 **The category vocabulary cannot express three of the eight 0.2.1 templates** — see above.
- 🆕 ⚠️ **`--theme-color-border-default` at 1.07:1 / 1.15:1**, and an unselected `TemplateCard`
  whose background equals its panel — see above.
- ✅ **The launcher's "Templates" tab** — phase 76's. **Still inert as of this commit.**
- 🔴 **No web `/templates` page.** Every other content type has one under `src/app/` — tutorials,
  replays, people, rfps, coaching, bench. Unowned, and it is the surface Richard's original ask
  most obviously describes. ⚠️ **It is also where queue item 3 would bite**: T4 did not fix
  `websearch_to_tsquery`'s AND, it simply never reaches it. A server-side template search is born
  with that bug.
- 🆕 ⚠️ **`ProjectCreationWizard`'s comment says the provider is keyed on `isVisible`; the code
  passes a constant `key`.** Harmless today, but it describes a mechanism that is not there.
- 🆕 ⚠️ **`0017`'s `tutorial_bundle_has_solution` is unguarded** and correct only by
  constraint-name order. Not fixable in place — the ledger checksums applied migrations.
- ⚠️ **`body_tsv`, its GIN index and its trigger still serve no reader.** **Richard's call.**
- ⚠️ **`benchList` parses the markdown of every visible post in the 200-thread window on every
  request.** Free at 3 posts; first thing to cache when the Bench has content.
- ⚠️ **Node names that are stopwords** — `For Each`, `Not`, `And`, `Or`. 🆕 **T4's matcher has the
  same hazard in miniature**: its stopword rescue is **all-or-nothing**, so `for each` searches for
  `each`. Harmless over titles and summaries, **not** harmless over a node catalogue — the line to
  change first if that matcher is ever pointed at one.
- ⚠️ **`Set Record Properties` → `Update Record` (2026-08-01) created a live name collision** with
  `noodl.byob.UpdateRecord`.
- 🔴 **FB-002's selected pill is 1.16:1 against the panel** — NAT-008's shared `.FilterPill`, so the
  people directory has the same invisible selection. ✅ **T4 re-measured the same shape on its own
  new pill and got 1.16:1 dark / 1.11:1 light**, which is why nothing there depends on fill. The
  cheapest real fix for FB-002 is the same one: move the state to the **border**.
- ⚠️ Two small things FB-021 leaves undriven: the gated block is no longer given `canRedirect`, and
  the **mixed-group** case.
- ⚠️ **The platform sends `firstReplyMinutes: null` on a thread with `replyCount: 1`.** FIX-025 §7's
  second cause. 🔴 Do not patch `replyLatency` without deciding the other half.
- ⚠️ **`MIRROR_THREAD_WINDOW = 100` is a copy of the platform's limit and nothing checks it.**
- ⚠️ `.property-port-gate-target`'s outline and `.Bench`'s gutter are unmeasured in pixels.
- ⚠️ **Only `Group` was driven** for FB-021; the other 174 types are covered by the catalog sweep,
  which grades *sentences*, not rendering.
- ⚠️ FB-022's crosshair settled by mechanism, not pixels; **one commit in three dropped focus,
  uncharacterised**; FB-016's auto-margin branch never exercised in a running app.
- ⚠️ **`AskAboutNodeDialog.module.scss` uncommitted — nineteenth session.** Belongs to no session;
  Richard's call. Same for the phase-70/71/72 working files and the phase-50/68 notes.
- The highlighter's disposal bug: a **selected** node whose element has gone is never removed from
  `selectedNodes`, so it is revisited and `remove()`d every frame.
- Unchased: `SidebarModel.switch('PortEditor')` crashes the panel; Settings clips two rows; a
  `Number` node draws a group literally called `ADVANCED` beside the synthetic `Advanced CSS`;
  `getConnectionSourceLabel` returns nothing for the checkbox row; `check:css` in `nodegx-community`
  has one pre-existing non-ours violation.
- ⚠️ **Pre-existing, not ours**: the projects page logs `Encountered two children with the same key`
  for one project id, and `feed.json` 404s.
- ⚠️ **A wire warning is silent for two seconds after you draw it.** `EVALUATE_HEALTH_DEBOUNCE_MS`
  is 2000 and the urgent lane is 50; `con-type-unconverted` is deliberately on the lazy one.
- ⚠️ **A tooltip has no `max-width`,** so a long health message draws a very wide box — 1074 px in a
  1368 px window.

## Gate *traps* carried forward

🔴 **Figures older than the s44/s43 sections are superseded; the traps below are not.**
✅ For reference, `test:platform` was **5 suites / 27 passed / 3 skipped / 0 failures** at s39.
⚠️ **`tokens:css` cannot see a contrast failure** — it checks that a `var(--…)` names a defined
property, nothing more. It would have passed every 1.1:1 ratio T4 measured.
- 🔴 **`tsc -p packages/noodl-editor/tsconfig.tests-main.json` is NOT a gate and reports 31 errors**
  — unchanged, none ours.
- 🔴 **No gate in this repo compiles `LessonItem.jsx` or `LessonLayerView.jsx`.** They are `.jsx`,
  `tsconfig.json` has no `allowJs`, and neither is in the jasmine tests graph.
- ⚠️ **This repo's `tsconfig.json` sets no `strict`**, so a **boolean discriminant does not narrow a
  union**. Use a **string** discriminant, as `CreateFromTemplateOutcome` does.
- 🔴 **`test:ci`'s exit code lies.** Completion is the `Jasmine: N specs` summary line, never `$?`.
  The floor is **4**, all `AIX-006 style vocabulary`, **by name** — not the 10 in older notes.
  ⚠️ `AIX-011 criterion 7` is a 30 ms flake if it appears. Check the **pageout delta** (`vm_stat`
  twice, 5s apart), not swap-used, before starting; never raise `NOODL_TEST_TIMEOUT_MINUTES`.
- ⚠️ **A jest suite that fails TO RUN reads as a smaller, passing suite** (s43). **Reconcile the
  count against the previous run**; the exit code will not tell you. 🆕 **And reconcile it against
  the source, not against a note** — the s43 prompt's 97 was wrong where the s43 scope file's 107
  was right, and only `git show HEAD:` settled it.
