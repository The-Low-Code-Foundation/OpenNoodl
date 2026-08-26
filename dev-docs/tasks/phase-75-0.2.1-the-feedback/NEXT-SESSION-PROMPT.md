# Phase 75 — next session

**State as of 2026-08-26 (session 45).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue. Take the top unblocked item; dip into the rest when it
bites.

**Committed this session:** queue item 1 — **FB-005 T5**, the submission queue. 🟡 **It is not
closed, and the gap is named rather than glossed**: the table, the route, the capability, the
promotion caller, the editor-side collector and the client method all exist and are graded — but
**"Share as template" is not yet a thing a person can click.** The dialog and the menu entry that
call `shareAsTemplate` are the remaining half, and they are **the top item below**.

🔴 **Two findings worth carrying**, both in §4d of [FB-005-SCOPE.md](FB-005-SCOPE.md):
a share written the obvious way **would have uploaded `.mcp.json`** — absolute paths out of the
author's home directory — to a public shelf; and **`0020`'s alphabetical constraint-order defect
reproduced itself in `0021`**, caught only because the spec asserts the constraint *name*.

⚠️ **Peers.** A peer was actively writing phase-76 (`SB-004`, `SB-009`, `TASKS.md`, and two
`noodl-mcp` test files) throughout this session — mtimes confirmed it, one minute old at the start.
**Nothing in those paths was touched.** No editor was launched and `test:ci` was not run, so
neither shield was exercised.
🔴 **The platform suite resets the schema, and peers share the Postgres instance.** This session
used its own database — `nodegx_community_fb005t5` via `DATABASE_URL` — rather than the default
`nodegx_community`. ⚠️ **`_s45`, `_s46`, `_s48` and `_s49` already existed**, so session-numbered
database names are not free; name yours for the task.

## The queue — unblocked, cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **FB-005 T5 — the SHARE BUTTON** | **S–M** | 🔴 **now the top item, and it is the "build the caller" half.** The seam is done, typed and specced; what is missing is a dialog (five fields) and the entry point that opens it. ⚠️ **Drive it** — an undriven dialog is how this phase's findings keep arriving |
| 2 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** ⚠️ Its corpus does not exist either — FB-014 measured the bench at **3 posts, 2 threads, 1,369 chars** |
| 3 | **FB-005 T6** — star ratings | **M** | 🔒 **still needs a ruling.** ⚠️ **The recommendation's precondition is now closer, not met**: T5 can *accept* third-party templates, but none exists and nothing in the product can file one until item 1 lands |

### 🔴 Three things now sitting with Richard

1. 🆕 **NOBODY IS NAMED AS THE PERSON WHO CLEARS THE SUBMISSION QUEUE.** §5.2 has said so since the
   design and T5 **cannot** settle it — a schema cannot name an owner. What T5 refused to do is
   pretend the question is answered by shipping a queue with no reader: the submitter can see their
   own row's status, and a decline cannot be recorded without a reason. **The bottleneck is visible
   from the side that suffers it; it is not fixed.**
2. 🆕 **THE LICENCE VOCABULARY IS A PRODUCT DECISION.** `MIT`, `Apache-2.0`, `CC0-1.0`, `other` —
   where **`other` means *"I wrote this and I will agree terms with you"***, a real answer somebody
   may honestly need to give. Richard may want different words; **it is one migration.**
3. **THREE OF THE EIGHT 0.2.1 TEMPLATES STILL HAVE NO HONEST CATEGORY.** `pixel-game`,
   `interactive-fiction` and `shared-canvas` are none of the six. ⚠️ **T5 inherited the vocabulary
   rather than fixing it**, which is the honest thing for a queue feeding that shelf — but it means
   a submission whose category cannot be named is **mis-filed at the door**. Unchanged from s44:
   the fix is a platform migration plus a ruling.
4. **`--theme-color-border-default` is 1.07:1 dark / 1.15:1 light against the panel**, and a
   `TemplateCard`'s background equals the panel (1.00:1) — so T3's unselected card has an
   effectively invisible boundary. Unchanged from s44. ⚠️ Changing that token touches every
   surface in the editor.

## 🟡 Item 1, half-closed: FB-005 T5 — the queue is built; the button is not

**In `nodegx-community`:** `0021_fb005_template_submissions.sql` (a **separate table**, because
`0020`'s header said it would be), `src/lib/templatesubmissions.ts`, `POST`/`GET
/api/v1/community/templates/submissions`, the `submitTemplate` write capability, and
`scripts/promote-template-submission.ts` — `list`, `show`, `promote`, `decline`.

**In OpenNoodl:** `models/template/shareAsTemplate.ts` — the seam, behind two narrow host
interfaces so plain-Node jest can drive it — and `CommunityApiClient.submitTemplate` /
`.submissions`. 🔴 **There is deliberately no `publishTemplate`, and a spec asserts its absence**:
this editor can reach no route that publishes a template, and a method named otherwise would be a
promise the client cannot keep.

### 🔴 The finding: a share would have uploaded `.mcp.json`

`readBundleDirectory` on the platform says of itself *"skips nothing silently"* — right for a
publisher pointed at a prepared directory. **"Share as template" points at the project somebody is
working in right now.** The editor writes `.mcp.json` into every project it creates or opens, that
file holds **absolute paths into the author's home directory and into their install of NodeGX**,
and `agentConfig.ts` already gitignores it with the reason written out.

A template is that failure **with an audience** — uploaded to a public shelf, written onto the disk
of everybody who installs it. `NEVER_SHARED` withholds it, plus `.git/`, `.nodegx/`,
`node_modules/`, `.env*` and `.DS_Store`. ⚠️ **Every exclusion is REPORTED, not dropped silently**:
a hazard list is a hypothesis, so a person must be able to see what stayed behind — including the
day it withholds something they wanted.

### 🔴 The second finding: `0020`'s constraint-order defect, reproduced in `0021`

Postgres evaluates a table's CHECK constraints **in constraint-NAME order**.
`..._review_timestamp` sorts before `..._status_known`, and written symmetrically the timestamp
rule refuses an unknown status too — so somebody who typed `'approved'` was told their review
**timestamp** was wrong. A true statement about a rule they had not broken.

✅ Fixed with `0020`'s guard in a different costume: phrase the rule so an unknown status falls
through to the constraint that owns it. 🔴 **An assertion that the insert merely THREW would have
been green on it.** ⚠️ **And a third instance, on the spec itself** — the control for that fix, an
`accepted` row with no timestamp, first reported `..._published_link`, which sorts earlier still.
**A test row must be valid in every other respect or it measures the wrong constraint.**

### 🔴 The third finding, and the one to carry: a new table and a new route owe THREE repo sweeps

**Register a new artefact in `nodegx-community` in all three, or the suite is red while your own
file is green:**

| sweep | what it demands |
|---|---|
| `db-schema-drift` | the table declared in the **Drizzle mirror** (`src/db/schema.ts`) |
| `uni005-data-inventory` | every free-text column **classified** — and `minor-refused` needs an **executed probe** |
| `uni011-mirror-api` | a **D15 verdict recipe** for every route on disk |

✅ **AC6 named the census explicitly and it was still missed.** The lesson is **run the whole
suite, not the file you wrote** — 35/35 green beside three red sweeps is what unfinished work looks
like when you only look where you were working.

⚠️ **The new probe is the only one in that census whose mechanism is CODE, not a constraint** — the
database would accept a pupil's row; `serveCommunityWrite`'s capability check is what refuses it.
So it drives the **real route**, with **`read_only`** (an `off` minor is refused by `communityGate`
before the capability is consulted — a different gate), and asserts **nothing was stored**.

### 🔴 The guard worth knowing about: promotion refuses a slug already on the shelf

`publishProjectTemplate` **upserts on slug**. A promotion written the obvious way would let a
stranger overwrite a live template by proposing its name — bumping its version, replacing its
payload — and **the shelf would look unchanged in the list**. `replaceExisting` is how a deliberate
replacement is still possible. Both arms specced, including that ours is untouched after the
refusal.

## Gates — session 45

- `tests/fb005-template-submissions.test.ts` — **35 specs, 0 failures**, against
  `nodegx_community_fb005t5`.
- `tests/fb005-project-templates.test.ts` — **42, unchanged**, re-run after `0021` to prove the new
  migration applies cleanly and changed nothing on the shelf.
- `tests-unit/fb-005/template-submission.test.ts` — **21 specs, 0 failures.**
- `npm run test:main` — **345 files / 5670 specs / 0 failures.** ✅ **Reconciles exactly**: s44 was
  344/5649, so **+1 file / +21 specs, all mine**.
- **9 mutants, 9 killed.** ⚠️ One survived first, and the finding was **the unasserted field, not
  the mutant**: a fourth entry in `MANIFESTS` is invisible to the accept/reject decision (a files
  map is keyed by **files**, so it never holds a bare `components` key) but changes the `looked`
  list a refusal shows, which nothing graded.
- **Full platform suite — 61 files / 1500 tests / 0 failures.** 🔴 **It was 3 RED on the first run
  while my own file was 35/35 green** — see below.
- `typecheck:editor` **0**; `typecheck:editor-tests` **0**; platform `tsc --noEmit` **0**.
- ⚠️ **`npm run test:ci` was NOT run this session** — a peer was live in the checkout throughout.
  T5 adds no jasmine spec and nothing renders a share dialog, so the expectation is s44's
  **2856 specs / 4 failures, all `AIX-006 style vocabulary`, by name**. 🔴 **Expectation, not a
  measurement.** Run it alone before believing it.

## Still open, owned by nobody

- 🆕 🔴 **No UI files a submission.** The top queue item.
- 🆕 ⚠️ **No admin surface for the queue.** `listPendingTemplateSubmissions` has no route on
  purpose — a page listing strangers' unpublished projects needs its visibility rules right before
  it has a user. The script is the reader.
- 🆕 ⚠️ **No total cap on pending submissions per account.** The partial unique index stops the same
  person filing the same slug twice; a distinct slug each time is one character apart. At 8 MiB a
  row that is a storage cost, bounded only by the write rate limit.
- 🆕 ⚠️ **The two size caps do not measure the same quantity.** `pg_column_size` is TOAST-compressed
  storage; the route's 8 MiB is JSON bytes on the wire. Matching the numbers is a stated
  approximation, not a shared constant.
- ✅ **The launcher's "Templates" tab** — phase 76's. **Still inert.**
- 🔴 **No web `/templates` page.** Every other content type has one under `src/app/`. Unowned, and
  it is the surface Richard's original ask most obviously describes. ⚠️ A server-side template
  search is **born with `websearch_to_tsquery`'s AND bug** — T4 did not fix it, it simply never
  reaches it.
- ⚠️ **`ProjectCreationWizard`'s comment says the provider is keyed on `isVisible`; the code passes
  a constant `key`.** Harmless today; it describes a mechanism that is not there.
- ⚠️ **`0017`'s `tutorial_bundle_has_solution` is unguarded** and correct only by constraint-name
  order. 🆕 **Now the fourth member of that family** — see §4d. Not fixable in place; the ledger
  checksums applied migrations.
- ⚠️ **`body_tsv`, its GIN index and its trigger still serve no reader.** **Richard's call.**
- ⚠️ **`benchList` parses the markdown of every visible post** in the 200-thread window on every
  request. Free at 3 posts; first thing to cache when the Bench has content.
- ⚠️ **Node names that are stopwords** — `For Each`, `Not`, `And`, `Or`. T4's matcher has the same
  hazard in miniature: its stopword rescue is **all-or-nothing**, so `for each` searches for
  `each`.
- ⚠️ **`Set Record Properties` → `Update Record` (2026-08-01) created a live name collision** with
  `noodl.byob.UpdateRecord`.
- 🔴 **FB-002's selected pill is 1.16:1 against the panel** — NAT-008's shared `.FilterPill`, so the
  people directory has the same invisible selection. The cheapest real fix is to move the state to
  the **border**.
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
- ⚠️ **`AskAboutNodeDialog.module.scss` uncommitted — twentieth session.** Belongs to no session;
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
  is 2000 and the urgent lane is 50.
- ⚠️ **A tooltip has no `max-width`,** so a long health message draws a very wide box — 1074 px in a
  1368 px window.

## Gate *traps* carried forward

🔴 **Figures older than the s45/s44 sections are superseded; the traps below are not.**
✅ For reference, `test:platform` was **5 suites / 27 passed / 3 skipped / 0 failures** at s39.
⚠️ **`tokens:css` cannot see a contrast failure** — it checks that a `var(--…)` names a defined
property, nothing more.
- 🆕 🔴 **The platform suite is DESTRUCTIVE** — `freshDb` → `resetSchema` drops and recreates. Peers
  share the Docker Postgres on **55432**. Use your own database via `DATABASE_URL`, and **do not
  assume a session-numbered name is free** — `_s45`, `_s46`, `_s48`, `_s49` already existed.
- 🆕 ⚠️ **`npx jest` from the repo ROOT reports `Tests: 0 total` and a failed suite** — it is the
  wrong config, not a broken spec. Run it from `packages/noodl-editor`. This is the
  **fails-to-run-reads-as-a-smaller-suite** trap wearing a new hat.
- 🆕 🔴 **A literal NUL in a source file makes `grep` treat the whole file as binary and skip it.**
  `shareAsTemplate.ts` and its spec reason about NULs and therefore write them as `\u0000`
  escapes. Anything testing binary detection must do the same.
- 🔴 **`tsc -p packages/noodl-editor/tsconfig.tests-main.json` is NOT a gate and reports 31 errors**
  — unchanged, none ours.
- 🔴 **No gate in this repo compiles `LessonItem.jsx` or `LessonLayerView.jsx`.** They are `.jsx`,
  `tsconfig.json` has no `allowJs`, and neither is in the jasmine tests graph.
- ⚠️ **This repo's `tsconfig.json` sets no `strict`**, so a **boolean discriminant does not narrow a
  union**. Use a **string** discriminant, as `ShareAsTemplateOutcome` and
  `CreateFromTemplateOutcome` do.
- 🔴 **`test:ci`'s exit code lies.** Completion is the `Jasmine: N specs` summary line, never `$?`.
  The floor is **4**, all `AIX-006 style vocabulary`, **by name**. ⚠️ `AIX-011 criterion 7` is a
  30 ms flake if it appears. Check the **pageout delta** (`vm_stat` twice, 5s apart) before
  starting; never raise `NOODL_TEST_TIMEOUT_MINUTES`.
- ⚠️ **A jest suite that fails TO RUN reads as a smaller, passing suite.** **Reconcile the count
  against the previous run** and against the **source**, not against a note.
