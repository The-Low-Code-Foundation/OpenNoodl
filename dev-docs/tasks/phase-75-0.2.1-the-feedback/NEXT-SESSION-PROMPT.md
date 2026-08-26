# Phase 75 — next session

**State as of 2026-08-26 (session 43).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue. Take the top unblocked item; dip into the rest when it
bites.

**Committed this session:** queue item 1 — **FB-005 T3**, "New project from a template". The create
wizard has a fourth mode, `PlatformTemplateProvider` serves the community shelf, and
`templateRegistry.list()` has **its first caller in the product** — which is what T1's whole
finding was about. 🔴 **A defect that only the running app could find**: one refusal sentence served
two different questions. Read **[FB-005-SCOPE.md](FB-005-SCOPE.md) §4b** before touching T4.

⚠️ **Peers.** Seven sessions held sockets at the start of this one; four coordinated directly. The
editor drive and `test:ci` were both announced and both ran clean. ✅ **Correction from a peer,
verified at source and worth carrying**: `dev:stop` does **not** kill another session's running
`test:ci` — `NEVER_SWEEP` shields the suite *and* its npm/lerna ancestor. It **does** sweep another
session's **editor stack**. `pkill` remains the one genuinely unshielded route.

## The queue — unblocked, cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **FB-005 T4** — categories + text search over the curated set | **S–M** | ✅ **now the top item.** `category` exists in `0020` with a fixed vocabulary and `TEMPLATE_CATEGORIES` mirrors it. 🔴 **Two problems come with it — read both below before scoping** |
| 2 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** ⚠️ Its corpus does not exist either — FB-014 measured the bench at **3 posts, 2 threads, 1,369 chars** |
| 3 | **FB-005 T5** — "Share as template" files a **submission** | **M** | unblocked by T2; needs the submission table R-templates' posture requires |

### 🔴 PHASE 76 IS RUNNING IN PARALLEL AND OWNS THE TEMPLATES TAB — READ THIS FIRST

**Richard opened phase 76 on 2026-08-26**, in another session, to **add the first template to the
Templates tab**. That takes two items off this file's "unowned" list and puts a **live collision
surface** in their place. Coordinate before writing, not after.

**What phase 76 will find, and must not rebuild.** T3 shipped the plumbing a templates *gallery*
needs, and all of it is reusable outside the wizard:

| it wants | it already exists | where |
|---|---|---|
| the rows, from every provider | `useProjectTemplates(enabled)` → `TemplateGalleryState` | `noodl-editor/src/editor/src/hooks/useProjectTemplates.ts` |
| rows **plus** the providers that failed | `templateRegistry.listing({})` | `utils/forge/template/template-registry.ts` |
| a card list with loading / empty / short-shelf states | `TemplateStepBody` (pure, no context) | `.../ProjectCreationWizard/steps/TemplateStep.tsx` |
| the row and gallery types | `TemplateChoice`, `TemplateGalleryState` | exported from `ProjectCreationWizard/index.ts` |

🔴 **Call `listing()`, never `list()`, on a surface a person looks at.** `list()` swallows a
provider's failure, so a community outage is indistinguishable from an empty shelf.
🔴 **`TemplateStepBody` is deliberately hook-free** so the plain-Node runner can evaluate it. Keep
it that way if you lift it — that split is what makes the three states gradeable.

**Which half of "the first template" phase 76 means changes everything, and the two are not close:**

- **An EMBEDDED template** (compiled into the editor): a new `models/template/templates/*.template.ts`
  plus one line in `EmbeddedTemplateProvider`'s map. ✅ It appears in the picker **immediately**,
  offline, no platform. ⚠️ Its `category` is **free text**, which is the vocabulary clash below.
- **A PLATFORM template** (published to the community shelf): `scripts/publish-project-template.ts`
  against a Postgres holding `0020`. 🔴 **The editor cannot see it until the platform is deployed** —
  nexus-1 has neither the migration nor the routes, and `COMMUNITY_URL` is a hardcoded constant with
  no env override, so there is no way to point the editor at a local platform without editing it.

⚠️ **Collision surfaces**, both untouched by T3 and both likely phase 76's:
`noodl-core-ui/.../Launcher/views/Templates.tsx` and `LauncherHeader.tsx`. T3 touched neither.
✅ T3's files are listed in §4b of [FB-005-SCOPE.md](FB-005-SCOPE.md); `ProjectsPage.tsx` is the only
shared file, and T3's edit there is five lines.

### 🔴 Two things T4 inherits, and neither is search

1. **THE LAUNCHER SHIPS A "Templates" TAB THAT SAYS "COMING SOON"** —
   `noodl-core-ui/.../Launcher/views/Templates.tsx` renders *"Project templates will be displayed
   here. This feature is coming soon!"*, and `LauncherHeader` lists it beside Projects, Community,
   Learning and GitHub. It has been inert the whole time, and **a working picker three clicks inside
   "New project" beside a dead tab called Templates reads as broken**. ✅ **Now phase 76's** — but T4
   is also a browse surface, so **agree who draws that tab before either of you draws it**.
   ⚠️ Same shape AIX-012 named: *present, offered, inert*.
2. ✅ **THE CATEGORY VOCABULARY IS SETTLED — ruled 2026-08-26 with phase 76, and already applied.**
   The **platform's** vocabulary is canonical, including for templates compiled into the editor:
   `starter`, `data-app`, `dashboard`, `site`, `form`, `integration`. It was free text, and
   `hello-world` said `'Getting Started'` — drawn live in the picker this session, beside nothing
   else, which is what a T4 facet bar would have inherited. **`hello-world` is now `starter`.**
   ⚠️ **The type cannot hold this** — `category` is a plain `string` and the vocabulary is a CHECK
   constraint in another repository. `EMBEDDED_TEMPLATE_CATEGORIES` in
   `tests-unit/fb-005/template-shelf.test.ts` is the enforcement, and it is a **third copy** whose
   drift cost is written down beside it: a platform-side addition reddens that file loudly, which
   is cheaper than the ruling quietly not existing. Phase 76's site-builder template ships
   **embedded** with `site`.

⚠️ Also still true unless phase 76 changes it: **the shelf is empty**, so T4's search would be
searching one embedded row. Publishing to the community half needs a local Postgres —
`DATABASE_URL=… npx tsx scripts/publish-project-template.ts <slug> <projectDir> <category> "<summary>" --publish`.

## ✅ Item 1, closed: FB-005 T3 — the picker `list()` was built for

**What shipped**, all in OpenNoodl:

- **`models/template/PlatformTemplateProvider.ts`** — the second `ITemplateProvider` ever to run and
  the first that fetches. `community://<slug>` is an **identifier the registry resolves**, never an
  address anything dereferences.
- **`communityapi.templates()` / `templateBundle()`**, with `readBundlePayload` **extracted** out of
  `tutorialBundle` — the rules in it are all safety rules, and a second hand-written copy is one
  where the missing rule is the one an attacker chose.
- **`TemplateRegistry.listing()`** — rows tagged by provider, plus the providers that failed.
- **The wizard's `'template'` mode** — `basics → template → review`, **no preset step**.
- **`hooks/useProjectTemplates.ts`** — `list()`'s first product caller, gated on the wizard being
  open so the launcher makes no community request on cold start.
- **AC2**: a refusal removes the project directory **only when this code created it**.
  `directoryExists` is asked **before** `makeDirectory` — that ordering is the whole precondition.

### 🔴 The finding: one refusal sentence served two different questions

`refusalSentence(read)` mapped an outcome to a sentence, and both `list` and `install` called it.
With the platform undeployed, opening the picker logged:

> `Error: that template is no longer on the community shelf`

A sentence about **a template**, in a refusal where **no template was named**. A 404 on
`/templates` means the shelf could not be read; a 404 on `/templates/x/bundle` means *x* is gone.

⚠️ **No spec could have caught it.** Both arms are `absent`, both are refusals, and every assertion
available — *it threw*, *it refused*, *it did not narrate permission* — is green on either wording.
**The instrument that found it was the running app**, at the first moment the code met a platform
that answers 404. Fixed with a `subject` parameter; re-measured live:
`Error: the community shelf is not available to this editor`.

### Decisions taken inside T3, each reversible and each stated

1. **`'template'` is a MODE, not a step inside `guided`** — a template ships its own look, and the
   preset step exists to choose one. `setPendingPresetId` maps the untouched default `'modern'` to
   `null`, so template mode applies **no** preset rather than one nobody picked.
2. **`PlatformTemplateProvider.list` THROWS on a failed read** instead of returning `[]`. An empty
   array and a failed read are the same length; returning `[]` makes an outage look like curation.
3. **The embedded provider is FIRST.** Order does not decide installs — it decides row order, and
   the first card should be the one that draws with no network.
4. **No `fileCount` on a picker row.** Rows arrive as `TemplateItem`, which the embedded provider
   also fills and which has no such field. T2's rejected `installable`, in mirror image.
5. **The selected card is marked in TEXT** (`✓ Selected`) as well as colour. Measured: border
   carries the state at **4.46:1 dark / 3.61:1 light**; the fill alone would be **1.16:1 / 1.11:1**,
   which is FB-002's shipped defect exactly.
6. **`TemplateStepBody` split out of `TemplateStep`** so the plain-Node runner can evaluate it. The
   three states are **rendered and read**, not grepped.

## Driving — what worked, exactly

✅ **Everything in the previous sessions' driving sections still holds.** New this session:

- ✅ **The full wizard path drives cleanly**: `New project` → *Start from a Template* → basics →
  picker → Review → *Create Project* → a project that opens with Home and App and a canvas.
- 🔴 **The picker's short-shelf path was exercised for real** — `community.nodegx.io` answers 404,
  the provider threw, `TemplateRegistry.listing` recorded it, and the screen drew *"Some templates
  could not be loaded (Community), so this list may be short."* beside the embedded row. **That is
  where the refusal-sentence defect appeared.**
- 🔴 **Setting a React-controlled input via CDP fights React.** `type` inserts at whatever selection
  React thinks exists, so a field already holding text ends up with fragments interleaved
  (`"T3 Template Driverag"`). ✅ **What worked**: the native value setter plus a bubbled `input`
  event —
  `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, v); el.dispatchEvent(new Event('input',{bubbles:true}))`.
- 🔴 **`Delete project` opens a NATIVE dialog and CDP goes dead** — every subsequent `eval` hangs
  until the tool timeout. There is no way back through CDP. ✅ **Tear down with `dev:stop` and clean
  up by hand**: the directory, plus the entry in `recently_opened_project.json` and the key in
  `project_runtime_cache.json` under `~/Library/Application Support/NodeGX/`. Verified restored
  (55 → 54 projects).
- ⚠️ **`cdp eval` shares one global scope across calls** — a second `const b` is
  `SyntaxError: Identifier 'b' has already been declared`. Wrap each eval in `{…}`.
- ⚠️ **`button:has-text(...)` is not a selector.** Tag the element in an `eval`
  (`el.setAttribute('data-drive','x')`) and click `[data-drive='x']`.

## Gates — session 43

- `tests-unit/fb-005/` — **97 specs, 0 failures** (T1's 27 unchanged + T3's 70).
- `npm run test:main` — **342 files / 5592 specs / 0 failures** (s40: 341 / 5522 / 0). The extra
  suite is the new file; the counts reconcile.
- 🔴 **`tests-unit/uni-001/session-readers.test.ts` refused the new session reader** until its
  third-column question was answered. `PlatformTemplateProvider` is now recorded, with a structural
  block asserting the token is used **once**, neither read is gated, the hook that decides what is
  drawn never sees a session, and **the picker still has a provider with no account and no network**.
- `npm run tokens:css` — clean over **320** stylesheets (s37: 319). ⚠️ Still blind to contrast.
- `typecheck:editor` **0**; `typecheck:editor-tests` **0** — it caught the three `WizardState`
  literals needing the new field. `typecheck:core-ui` **44 errors, all `TS2307` alias resolution,
  none ours** — pre-existing.
- **13 mutants, all killed** — but **one survived first, and it was a hole in the spec, not in the
  code.** See below. ⚠️ Run with **`-t` filtered to one spec**, so *"killed by its own spec"* is
  measured and *"and by no other"* is **not**. Pristine copies restored by `copyfile`, every file
  **`md5`-verified identical** afterwards.
- 🔴 **`test:ci` — `Jasmine: 2856 specs, 4 failures`, ALL FOUR `AIX-006 style vocabulary`, by name.**
  ✅ **The clean floor.** The count reconciles exactly: **2849 + 7**, the seven jasmine specs this
  session added to `tests/models/ProjectCreationWizard.test.ts`. ⚠️ The run took **~25 minutes**,
  not the ~11 the older notes quote. `COMPOUND_EXIT=1`, which is what the clean floor also exits —
  the summary line is the verdict.
  ⚠️ **Honest scope**: its webpack bundle was built before the last two edits (the category string
  and a doc comment). **No jasmine spec reads a template category** — checked by grep, both for
  `EmbeddedTemplate.test.ts` and for the string across `tests/`.

### 🔴 The mutant that survived: `indexOf(a) < indexOf(b)` PASSES WHEN `a` IS ABSENT

The AC2 precondition spec asserted `order.indexOf('directoryExists') < order.indexOf('makeDirectory')`.
A mutant that **deleted the `directoryExists` call outright** left it out of the array, so `indexOf`
returned **-1**, and **`-1 < 0` is true**. The spec passed on code that never asked the question at
all — which is precisely the thing it exists to detect.

✅ **The fix is two lines**: `expect(order).toContain(…)` for **both** entries, *then* the ordering.
🔴 **Check every ordering assertion in this phase for the same shape.** The rule: an `indexOf`
comparison is an ordering test only once both operands are known to be present; until then it is a
presence test that silently answers "yes" to absence. ⚠️ The earlier 10-mutant run missed it because
that mutant *moved* the call rather than *removing* it — **a weaker mutant made a broken instrument
look sound.**

### 🔴 Gate trap met this session

**A jest suite that fails TO RUN reads as a smaller, passing suite.** A straight apostrophe inside a
single-quoted TS string made ts-jest reject the new spec: the run reported `1 failed, 1 passed` and
**`Tests: 27 passed, 27 total`** — a green Tests line over 56 specs that never executed.
**Reconciling the count against the previous run caught it; the exit code did not.**

## Still open, owned by nobody

- ✅ **The launcher's "Templates" tab** — **now phase 76's**, see above. Still inert as of this commit.
- ✅ **Two category vocabularies in one picker** — **RULED and applied 2026-08-26**: the platform's
  vocabulary is canonical everywhere; `hello-world` moved from `'Getting Started'` to `starter`.
- 🆕 🔴 **`ProjectCreationWizard`'s comment says the provider is keyed on `isVisible`; the code
  passes a constant `key`.** Harmless today — the component returns `null` when hidden, so React
  unmounts it and state resets anyway — but the comment describes a mechanism that is not there,
  and the next person to rely on it will rely on the wrong one.
- 🔴 **No web `/templates` page.** Every other content type has one under `src/app/` — tutorials,
  replays, people, rfps, coaching, bench. Unowned, and it is the surface Richard's original ask
  ("filter by categories, text search") most obviously describes.
- 🆕 ⚠️ **`0017`'s `tutorial_bundle_has_solution` is unguarded** and correct only by constraint-name
  order. Not fixable in place — the ledger checksums applied migrations.
- ⚠️ **`body_tsv`, its GIN index and its trigger still serve no reader.** FB-024 made the live search
  cover bodies, so the column's only prospective caller is FB-014. **Richard's call.**
- ⚠️ **`benchList` parses the markdown of every visible post in the 200-thread window on every
  request.** Free at 3 posts; first thing to cache when the Bench has content.
- ⚠️ **Node names that are stopwords** — `For Each`, `Not`, `And`, `Or`.
- ⚠️ **`Set Record Properties` → `Update Record` (2026-08-01) created a live name collision** with
  `noodl.byob.UpdateRecord`.
- ⚠️ **A manually re-opened popout still covers the completion banner.** Inherent to popouts.
- 🔴 **FB-002's selected pill is 1.16:1 against the panel** — NAT-008's shared `.FilterPill`, so the
  people directory has the same invisible selection. ✅ Cheapest real fix: move the state onto the
  **border**, already at 3.57:1 — **which is exactly what T3's template card does**, measured at
  4.46:1 dark / 3.61:1 light. ⚠️ Measure in **both** themes.
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
- ⚠️ **`AskAboutNodeDialog.module.scss` uncommitted — eighteenth session.** Belongs to no session;
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

🔴 **Figures older than the s43/s42 sections are superseded; the traps below are not.**
✅ For reference, `test:platform` was **5 suites / 27 passed / 3 skipped / 0 failures** at s39.
⚠️ **`tokens:css` cannot see a contrast failure** — it checks that a `var(--…)` names a defined
property, nothing more. It would have passed the 1.91:1 this phase shipped.
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
