# Phase 75 — next session

**State as of 2026-08-26 (session 42).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue. Take the top unblocked item; dip into the rest when it
bites.

**Committed this session:** queue item 1 — **FB-005 T2**, the platform template shelf
(`nodegx-community`). 🔴 **A CHECK constraint RAISED instead of refusing, and which constraint
answers is decided ALPHABETICALLY.** Read **[FB-005-SCOPE.md](FB-005-SCOPE.md) §4a** before writing
another migration in that repo.

⚠️ **Peers.** Six other sessions were listed on this machine at the start of this one, four of them
`opennoodl-*`, and **every one of those runs its MCP server from *this* checkout's
`node_modules/electron/dist`** — so a sweep from any of them can match a `test:ci` electron.
Nothing went wrong: this session ran **no OpenNoodl gates at all**, because the change was entirely
in the sibling `nodegx-community` repo. ✅ This session's database is `nodegx_community_fb005`;
peers hold `_s42/_s43/_s45/_s46/_s48/_s49` and several `*drive` ones — **do not take those**.

## The queue — unblocked, cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **FB-005 T3** — "New project from a template" in the create wizard | **M** | ✅ **now the top item.** T2 is done and the editor already has the seam: `templateRegistry` is reachable, `createFromTemplate.ts` is the graded module, and a `PlatformTemplateProvider` is what plugs in. 🔴 **The shelf is EMPTY** — see below |
| 2 | **FB-005 T4** — categories + text search over the curated set | **S–M** | ✅ unblocked. `category` already exists in `0020` with a fixed vocabulary; T4 is the facet bar + the query. ⚠️ FB-024 fixed the Bench's matcher, **not** `websearch_to_tsquery` in `facets.ts`'s neighbours — check which helper a template search would inherit |
| 3 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** ⚠️ Its corpus does not exist either — FB-014 measured the bench at **3 posts, 2 threads, 1,369 chars** |

## ✅ Item 1, closed: FB-005 T2 — the platform half of the template shelf

**What shipped**, all in `nodegx-community`:

- **`0020_fb005_project_templates.sql`** — `project_templates`. A **standalone** table, not
  `tutorial_bundles` with a different `kind`: a tutorial bundle hangs off `articles` because a
  tutorial *is* an article, and a template has no prose to hang off. ⚠️ **No author column** — that
  is R-templates' curated ruling enforced rather than restated, and T5's submission queue is a
  separate table so "submitted" and "published" can never be one column somebody flips.
- **`src/lib/projecttemplates.ts`** — publish, list, detail, bundle. Path safety is **imported**
  from `tutorialbundles.ts`, not re-implemented.
- **Three routes** under `/api/v1/community/templates` — index, `/[slug]`, `/[slug]/bundle` —
  TUT-004's shape one shelf over.
- **`scripts/publish-project-template.ts`** — the caller. `readBundleDirectory` was **extracted**
  out of `publish-tutorial-bundle.ts` rather than copied.

### 🔴 The finding: a CHECK constraint can RAISE instead of refusing

`project_template_files_are_text` was `check (not jsonb_path_exists(payload, '$.files.keyvalue() ?
(@.value.type() != "string")'))`. **`.keyvalue()` on anything that is not an object RAISES** —
*"jsonpath item method .keyvalue() can only be applied to an object"* — rather than returning false.
And **postgres evaluates a table's CHECKs in constraint-NAME order**, which puts `..._files_are_text`
before `..._has_files`.

| payload | before | after |
|---|---|---|
| `{files: ["a.json"]}` | `err.constraint` **undefined**, raw jsonpath text | **`project_template_has_files`** |
| `{files: {"a.json": 5}}` | `project_template_files_are_text` | unchanged |
| `{files: {…}}`, all text | accepted | unchanged |

The row was refused either way — **nothing unsafe was ever stored**. What broke is the *message*:
`refusals.ts` maps constraint **names**, and a raised error has none, so it reached the publisher
raw. ⚠️ **The instrument is what found it** — `expect(err.constraint).toBe(…)`, TUT-004's rule. An
assertion that the insert threw was green on the defect.

🔴 **`0017`'s `tutorial_bundle_has_solution` carries the same unguarded expression and is correct
today ONLY because `tutorial_bundle_has_files` sorts before it.** ⚠️ It **cannot be edited** — the
ledger checksums applied migrations. A constraint added to that table with a name sorting before
`has_files` would expose it.

### Decisions taken inside T2, each reversible and each stated

1. **Text-only payloads**, refused at publish (scope §3's recommended arm).
2. **A fixed category vocabulary in DDL** — `starter`, `data-app`, `dashboard`, `site`, `form`,
   `integration`. ⚠️ **A product decision Richard may want different words for**; one migration to
   change. The spec reads the vocabulary out of `pg_get_constraintdef` and compares the **sets both
   ways** against `TEMPLATE_CATEGORIES`.
3. **The manifest rule is `ProjectFormatDetector.detect()` restated**, not invented:
   `nodegx.project.json`, `components/_registry.json` **or** `project.json`. ⚠️ `components/` alone
   is refused — the detector scores it 1 against its own threshold of 2.
4. **No `installable` flag** (the payload is `not null`; the flag could only read true).
   **Detail carries `paths`, not a body** — a template has no prose, so what a detail route can
   honestly add is what is in it.
5. 🔴 **Omitting `publishedAt` on a republish leaves the row where it was.** The obvious spelling
   would take a live template off the shelf as a side effect of fixing a typo in it.
6. **No `readTemplates` capability was added** — `READ_CAPABILITIES` is what a *client* reads and
   nothing dispatches on it; the gate is `communityGate`, whole-surface. A fourth entry no consumer
   reads is P73 s3's shape.

## 🔴 Still open from T2 itself — read before starting T3

- 🔴 **THE SHELF IS EMPTY.** T2 shipped the table, the routes and the publisher; **no template has
  been authored**. That is content, not schema, and **T3 cannot be driven without one**. Author a
  first template and publish it with
  `DATABASE_URL=… npx tsx scripts/publish-project-template.ts <slug> <projectDir> <category> "<summary>" --publish`.
- 🔴 **THERE IS NO WEB `/templates` PAGE, AND THE SLICE NEVER ASSIGNED ONE.** Every other content
  type has one under `src/app/` — tutorials, replays, people, rfps, coaching, bench. T3 is the
  editor wizard, T4 is categories+search; **neither is the page**. Unowned, and it is the surface
  Richard's original ask ("filter by categories, text search") most obviously describes.
- ⚠️ **Not deployed** — nexus-1 has neither the migration nor the routes.
- ⚠️ **No thumbnail column.** A `thumbnail_url` is `articles.project_url`'s free-text-on-any-host
  hazard again, and a binary in the payload is the decision scope §3 parks.
- ⚠️ **AC2 is T3's** — "a curated template installs from the launcher into a project that opens and
  renders, and a refusal leaves nothing on disk". T1 left an empty directory behind on refusal
  deliberately; a **partial install of a multi-file bundle** is the case that makes it real.

## Gates — session 42

⚠️ **This session's change was entirely in `nodegx-community`. No OpenNoodl gate was run, and none
was implicated.** The OpenNoodl figures further down are s40's and are quoted as **history, not as
measurements of the current tree** — re-measure before relying on them.

- `nodegx-community` full suite: **60 files / 1461 specs / 0 failures**, 1026 s. ✅ **The count
  reconciles exactly**: s41's 59/1418, plus this file's 42, plus **one** from
  `db-schema-drift`'s `it.each(tableNames)` — which generates a test per table, so a new table adds
  a test. Needs ~17 minutes — **background it and wait on the PID**.
- `tests/fb005-project-templates.test.ts` — **42 specs**.
- The four route gates, green with the new routes **discovered from disk**: `nat006-api-contract` +
  `uni011-mirror-api` **38 passed**; `uni005-data-inventory` + `db-schema-drift` **83 passed**.
- `npx tsc --noEmit` — **0 errors**.
- **8 mutants, all killed.** ⚠️ Run with **`-t` filtered to one spec each**, so *"killed by its own
  spec"* is measured and *"and by no other"* is **not**. Pristine copies restored by `copyfile`;
  all three touched files **`md5`-verified identical** afterwards.
- `check:css` **not** run — no stylesheet changed. ⚠️ It has one pre-existing non-ours violation.
- 🔴 **From s40, NOT re-measured since:** `typecheck:editor` 0 errors; `test:main` 341 files / 5522
  specs / 0 failures; `test:ci` **`Jasmine: 2849 specs, 4 failures`** — the recorded floor, all four
  AIX-006, by name. ⚠️ `test:ci` needs ~11 minutes and outlives a 600 s tool timeout. ⚠️ Quote the
  **summary line**, never `$?`.

## Driving — what worked, exactly

✅ **Everything in the last two sessions' driving sections still holds.** Nothing was driven this
session: T2 is a database and three route handlers, and both HTTP gates drive the routes through
real handler calls with seeded rows behind them. **T3 is the drive**, and it needs a published
template first.

🔴 **Four gates guard a new `/api/v1` route** and all four caught this work before it was committed:
`nat006-api-contract` (expected-path list, a `params` entry, **and a seeded row**), `uni011-mirror-api`
(a `RECIPES` verdict with a written `because`, **and a seed**), `uni005-data-inventory` (every new
free-text/jsonb column classified), `db-schema-drift` (the table declared in `src/db/schema.ts`).
⚠️ **Three of them refuse a made-up id on purpose** — a 404 passes every assertion without
exercising anything. ⚠️ **Migrations are registered by hand** in `MIGRATIONS` in `src/db/migrate.ts`.

## Gate *traps* carried forward — the figures are in the s42 section above

🔴 **Figures older than the s42/s40 sections are superseded; the traps below are not.**
✅ For reference, `test:platform` was **5 suites / 27 passed / 3 skipped / 0 failures** at s39, and
`tokens:css` clean over 319 stylesheets at s37.
⚠️ **`tokens:css` cannot see a contrast failure** — it checks that a `var(--…)` names a defined
property, nothing more. It would have passed the 1.91:1 this phase shipped.
- 🔴 **`tsc -p packages/noodl-editor/tsconfig.tests-main.json` is NOT a gate and reports 31 errors**
  — unchanged, none ours.
- 🔴 **No gate in this repo compiles `LessonItem.jsx` or `LessonLayerView.jsx`.** They are `.jsx`,
  `tsconfig.json` has no `allowJs`, and neither is in the jasmine tests graph.
- ⚠️ **This repo's `tsconfig.json` sets no `strict`**, so a **boolean discriminant does not narrow a
  union**. Use a **string** discriminant, as `ResetLessonOutcome` and `CreateFromTemplateOutcome` do.

## Still open, owned by nobody

- 🆕 🔴 **No web `/templates` page** — see above. The most visible half of Richard's item 4.
- 🆕 ⚠️ **`0017`'s `tutorial_bundle_has_solution` is unguarded** and correct only by name order —
  see above. Not fixable in place.
- ⚠️ **`body_tsv`, its GIN index and its trigger still serve no reader.** FB-024 made the live search
  cover bodies, so the column's only prospective caller is FB-014. **Richard's call**, not a tidy-up.
- ⚠️ **`benchList` now parses the markdown of every visible post in the 200-thread window on every
  request.** Free at 3 posts; first thing to cache when the Bench has content.
- ⚠️ **Node names that are stopwords** — `For Each`, `Not`, `And`, `Or`. `Static Data For Each`
  searches `static data` and matches more widely than typed. Correct rows, extra ones.
- 🆕 ⚠️ **`Set Record Properties` → `Update Record` (2026-08-01) created a live name collision** with
  `noodl.byob.UpdateRecord`. Two nodes answer to one name in the picker and the catalog.
- ⚠️ **A manually re-opened popout still covers the completion banner.** Inherent to popouts.
- 🔴 **FB-002's selected pill is 1.16:1 against the panel** — the active fill, 1.24:1 between active
  and inactive label, border **identical** in both states. Every individual label passes AA
  (7.9–8.5:1); *which pill is on* does not. NAT-008's shared `.FilterPill`, so the **people
  directory has the same invisible selection**. ✅ Cheapest real fix: move the state onto the
  **border**, already at 3.57:1. ⚠️ Measure in **both** themes.
- ⚠️ Two small things FB-021 leaves undriven: the gated block is no longer given `canRedirect`, and
  the **mixed-group** case.
- ⚠️ **The platform sends `firstReplyMinutes: null` on a thread with `replyCount: 1`**, so the
  accepted thread reads *"no reply yet"* everywhere. **FIX-025 §7's second cause.** 🔴 Do not patch
  `replyLatency` without deciding the other half.
- ⚠️ **`MIRROR_THREAD_WINDOW = 100` is a copy of the platform's limit and nothing checks it.**
- ⚠️ `.property-port-gate-target`'s outline and `.Bench`'s gutter are unmeasured in pixels.
- ⚠️ **Only `Group` was driven** for FB-021; the other 174 types are covered by the catalog sweep,
  which grades *sentences*, not rendering.
- ⚠️ FB-022's crosshair settled by mechanism, not pixels; **one commit in three dropped focus,
  uncharacterised**; FB-016's auto-margin branch never exercised in a running app.
- ⚠️ **`AskAboutNodeDialog.module.scss` uncommitted — seventeenth session.** Belongs to no session;
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
  1368 px window. `.popup-layer-tooltip-content p` caps at 268 px; bare inline markup is capped by
  nothing.
