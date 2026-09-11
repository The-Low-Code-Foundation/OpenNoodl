# TUT-004 — one click from the panel

**Surface:** editor + platform (`nodegx-community`) · **Tier 4** · **Effort:** S/M
**🟡 BUILT AND SPECCED 2026-08-20 (session 6). ✅ R2 answered. One thing left: the drive (§"Session 6").**

> Richard's ruling, 2026-08-19:
>
> > *"One click install from the community panel should be possible, since we're rebuilding it
> > inside the editor (phase 72). But if someone accesses the tutorial from the community web page,
> > they have to download (it'd be a bigger job to beam it to their editor from their signed in web
> > account I'm guessing)."*

Two surfaces, two answers, and the asymmetry is deliberate. The editor is already a trusted local
process with a Learning folder; the browser is not, and closing that gap needs an account-to-machine
channel that does not exist.

## 🔴 This task builds a CALLER. The install mechanism is already there.

This is the BUILD-THE-CALLER pattern again, and the cheapest instance of it to get wrong:

| | Status |
|---|---|
| `LearningFolderModel.instance.install({ bundleDir, provenance })` | ✅ exists, and is **already called** from [`ProjectsPage.tsx:417`](../../../packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx) |
| `LearningSource = { kind:'local'; path } \| { kind:'platform'; url }` | ✅ the platform arm is **declared** — [`learningfolder.ts:98-100`](../../../packages/noodl-editor/src/editor/src/models/learningfolder.ts) |
| Production code constructing `kind: 'platform'` | 🔴 **none.** Two test files, and nothing else in `packages/**` |
| A fetcher that can re-pull a platform source | 🔴 **none** — which is what `ResetLessonOutcome`'s `'unavailable'` arm currently reports |

So the work is: **fetch the bundle → unpack to a staging dir → call the install that exists → record
`source: { kind:'platform', url }` → make `reset` able to re-pull.** A task that writes a second
install path has misread this table.

⚠️ `learningfolder.ts` is emphatic that **the editor process writes the register — never a sidecar,
never the platform.** The fetch may happen wherever is convenient; the install call may not move.

## 🔴 The platform half — and the sentence in this section that was WRONG

> ~~What the editor panel needs is the same URL reachable through NAT-006's read API so the panel
> can offer a button instead of a link.~~

**It is not the same URL, and it must not be.** Two measurements, made 2026-08-20:

1. **`articles.project_url` is unconstrained free text on an arbitrary host.** There is no CHECK,
   no scheme rule, no allow-list. An editor that installed from it would fetch and unpack a remote
   archive from wherever a text column last pointed.
2. **Its own migration already said so.** `0011_uni020_article_content_model.sql:30` —
   *"Nullable, and a tutorial without one shows no button. A starter project is the second action;
   **'Open in editor' is deliberately NOT here** (it needs D5's Learning section)."* The author of
   the column had already ruled that the Learning-section install is a different affordance.

⚠️ **The web experience still does not change** — that half of the paragraph was right.
`project_url` keeps rendering as *"Download the starter project →"*, a tutorial without one still
shows no button, and AC6 is met by touching nothing.

✅ **What was built instead:** `tutorial_bundles`, one row per article, carrying the bundle as
jsonb. The transport is `shelf_items.payload`'s, **reused rather than reinvented** —
`GET /api/v1/me/assignments/:id/lesson` already serves a bundle this way and calls it *"what the
editor pulls"*. A lesson bundle is text (TUT-003: 35 files, **57 KiB**, not one binary), so this
needs no blob store, no signed URLs, and no unzip dependency in an editor that has none.

## ✅ R2 — answered 2026-08-20: `curated`

Richard's ruling, given the measurement below. **A community tutorial installs as `curated`.**

🔴 **The question was smaller than it looked, and a measurement is why.** `articles` has **no
author column** and there is **no authoring UI** (`shelf.ts:215` — *"a seed script today"*), so
every tutorial on the platform is editorial. *"A bundle from an arbitrary member"* is not a thing
that can exist yet, and a provenance invented for it would be a policy with no population.

⚠️ **That is not the loose end it looks like**, because provenance may only ever tighten.
TUT-003's manifest declares `authoredBy: "ai"`, so `resolveProvenance` moves it to **`local-ai`**
— F1 *and* F2 *and* F3 — whatever this path passes. Measured on the shipped bundle:
`Checked as local-ai: F1, F2, F3 passed; F4 not checked.`

🔴 **What member-authored tutorials will need**, when they arrive: a column saying who wrote it
and a new row in `REQUIRED_CLASSES`. What they must **not** get is a path cheaper than `local-ai`,
or the asymmetry that makes the AI claim safe to honour inverts —
`lessoninstallpolicy`'s *"a claim may only ever cost the claimant"* spec is the alarm.

## The original R2 framing, kept

[`lessoninstallpolicy.ts`](../../../packages/noodl-editor/src/editor/src/models/lessoninstallpolicy.ts)
grades an install by provenance, and `ProjectsPage` passes `'local'` for a hand-placed bundle and
`'local-ai'` for one an agent wrote. A **platform** bundle is a third profile: it was not written on
this machine, and it was not written by this user's agent.

The F1–F4 scorecard applies differently to each — that is the whole point of the field. R2 is: what
does a community bundle install under, and what does the panel show the user before it lands? A
bundle from the official account and a bundle from an arbitrary member are not obviously the same
answer, and this is the task where that gets decided rather than defaulted.

## Acceptance criteria

1. From the community panel in the editor, a tutorial with an attached bundle installs in one
   action and appears in the Learning section. No browser opens at any point (phase 72 **P1**).
2. The installed entry records `source: { kind: 'platform', url }` — 🔴 asserted, because that arm
   of the type has been declared and unconstructed since UNI-007.
3. **R2's answer is implemented and visible:** the provenance is passed explicitly, and what the
   scorecard checked is shown before the bundle lands — not after.
4. A bundle that the harness **refuses** is refused here too, with the reason, and nothing is
   written to the Learning folder. Driven with a deliberately-broken bundle.
5. `reset` on a platform-sourced lesson **re-pulls** a clean copy. A reset that cannot reach the
   network reports `'unavailable'` and leaves the installed copy standing — 🔴 both arms driven,
   because the failure arm is the one that exists today for the wrong reason.
6. The web page is **unchanged**: `projectUrl` still renders as a download link, and a tutorial
   with no bundle still shows no button (the page's existing "nullable column and no button is the
   honest pair" rule).
7. Offline: the panel says the tutorial cannot be installed right now and why, rather than failing
   silently — phase 72 **P3**, and NAT-013's `D8` caching ruling does not need to be settled for
   this, because a bundle is fetched on demand, not cached ahead.
8. The first official shared tutorial (TUT-003) is published to the local community instance and
   installs from it end-to-end, before anything is pushed live.

## Out of scope, explicitly

- **Beaming a tutorial from a signed-in web session to the user's editor.** Richard's ruling. It
  needs an account-to-machine channel and it is a phase of its own.
- **NAT-011's job.** That renders tutorial *bodies* in the editor. This installs *bundles*. They
  meet at the panel; neither owns the other. 🔴 Grep the behaviour before either task claims the
  other's ground — NAT-011 carries that warning for three phases' worth of reasons.
- Uninstall / disposal of a tutorial's backend. Named in README §1A as the real cost of per-tutorial
  databases and worth doing — but it is the lifecycle's other end and it should be scoped with the
  measurement in hand, not bolted here.

---

## Session 6 — 2026-08-20. Built, specced, and one thing left.

**Commits, editor:** `a86d13a6` the project identity · `cd024b52` the caller · `f3f20771` the panel.
**Platform:** `4521082` on `nodegx-community@main`.

### The ACs, with the reading beside each

| AC | State | The reading |
|---|---|---|
| **1** one action, no browser | 🟡 **built + specced, NOT DRIVEN** | `CommunityRow` is already a button, so the row *is* the action. 19 specs incl. a **rendered** assertion that exactly one handler sits on the row and calling it installs. ⚠️ Not yet seen in a running editor — §"What is left" |
| **2** `source: {kind:'platform', url}` | ✅ **asserted** | The arm declared and unconstructed since UNI-007 is now constructed. Verified red with the argument dropped |
| **3** scorecard shown *before* it lands | ✅ **asserted, sharply** | `preflight()` extracted so `install` calls **through** it — one scorer, not two. The spec asserts what the Learning folder held **at the moment `confirm` ran** (`[]`), not that confirm ran first. Verified red by moving the confirm block after the install |
| **4** a refused bundle writes nothing | ✅ **asserted** | Staging is a separate directory; a refusal leaves Learning empty *and* no staging. Verified red by keeping staging |
| **5** reset re-pulls / offline stands | ✅ **both arms asserted** | Re-pull drops the learner's file and keeps the project id; offline leaves file **and** progress. Verified red with a delete-then-fail mutation |
| **6** the web page unchanged | ✅ **by construction** | `project_url` untouched; the install is a different table and a different route. A spec asserts `installable` follows the **bundle** and not `projectUrl`, with the flag flipping under a known-firing control |
| **7** offline says why | ✅ **asserted** | `offline` vs `unavailable` are different outcomes with different sentences, and the spec asserts they **differ** rather than that each is non-empty |
| **8** TUT-003 published + installs end to end | 🟡 **platform half done** | Published to the local instance: **35 files, 57 KiB, version 1**. Served over the real route: 200, 65 KB on the wire, `solution/components/Pages/Home/nodes.json` intact five deep. The **real bundle** installs through the **real editor code** on a **real filesystem** — but not yet through the running Electron editor |

### 🔴 What the whole thing was measured against, and it is not fixtures

[`tests-unit/tut-004/the-real-bundle-installs.test.ts`](../../../packages/noodl-editor/tests-unit/tut-004/the-real-bundle-installs.test.ts)
drives `project-examples/lessons/log-a-thing/` — the shipped 35-file bundle — through
`installTutorialFromPlatform` against `node:fs` in a temp directory. It reports
`Checked as local-ai: F1, F2, F3 passed`, all 35 files land, `solution/` included, staging is gone,
and **two installs of the one bundle get two different project ids**.

That test exists because of TUT-003's own finding: *52 specs green on fixtures, and one pass over
the real modules found two defects.* A fixture passes the gates its author was thinking about.

### 🔴 Four gates caught this work before it was committed. None of them was mine.

Worth recording as a group, because the shape is the same each time — **a new surface is invisible
to a sweep until the sweep is told about it, and every one of these refused to be waved through**:

| gate | what it demanded |
|---|---|
| `nat006-api-contract` | a **seeded row** behind the new dynamic route — a made-up slug 404s and a 404 passes every assertion without exercising anything |
| `uni011-mirror-api` (D15) | a **verdict** for the route, *and* a seed, because a route that 404s for everyone reads as "gated" no matter what the gate does |
| `uni005-data-inventory` | both new **free-text columns classified**, with the mechanism named |
| `uni-001/session-readers` | an answer to *"does this reader change what the editor can do without an account?"* |

The last one is the interesting answer: **this is the first session reader where the token can only
make the editor do *less***. Both routes are public; the bearer header is there so **D15** can
refuse an org-minor whose school switched the community off. Four new assertions prove the decision
layer never reads a session, with a known-firing arm beside them.

### 🔴 The defect this session found in its own work

`tutorial_bundle_has_files` was first written as
`jsonb_typeof(payload -> 'files') = 'object' and …`. With no `files` key that expression is **NULL,
not false — and a CHECK constraint PASSES on NULL**. A payload with no `files` key at all went
straight through the gate named after that exact shape, and was caught two constraints further down
**by accident**.

Found by running each refusal against a real Postgres and reading *which constraint* fired, rather
than that one did. It is why every constraint spec in
[`tut004-tutorial-bundles.test.ts`](../../../../nodegx-community/tests/tut004-tutorial-bundles.test.ts)
asserts `err.constraint` **by name**.

### ⚠️ And one this session hit that NAT-006 had already recorded

`bundle.updatedAt.toISOString is not a function`, from a route handler whose TypeScript said `Date`.
NAT-006's own notes: *"a `Date`-typed column arrives as a raw string on some pooled connections"*.
`apisurfaces.isoOf` is now **exported** so a new surface uses the one conversion instead of
reaching for `.toISOString()` and being right until the pool is warm.

### What is left: the drive

Everything above is built and specced. **Nobody has watched a person click the row in a running
editor.** That needs three things standing at once:

1. `nodegx-community` running against a database with the bundle in it. Session 6 used
   `nodegx_community_tut004_s6` (peers hold `nodegx_community_s49` and `…_p67b_s49` — **do not take
   either**), migrated and seeded, with `scripts/publish-tutorial-bundle.ts` already run.
2. 🔴 **`COMMUNITY_URL` pointed at the local instance** — [`communityorigin.ts`](../../../packages/noodl-editor/src/editor/src/models/community/communityorigin.ts).
   ⚠️ **This is a shared-checkout source edit and a peer was already caught leaving it pointed at
   `localhost:3947`.** Announce it, revert it, and verify the revert with `git diff` before the
   session ends.
3. The editor launched (`/run-editor`), the Community rail panel open.

**What to look for, written before driving** (`verify-the-consequence`):

- the row **Log a thing · Beginner · data lists · 20 min · Install**, and no Install word on any
  tutorial without a bundle;
- one click, and the note under the row reads **`Checked as local-ai: F1, F2, F3 passed; F4 not
  checked.`** — ⚠️ if it says `curated`, `resolveProvenance` is not being reached and the strict
  gate did not run;
- the lesson in the **Learning** section of the launcher and **absent** from the Projects picker;
- 🔴 `~/Library/Application Support/NodeGX/Learning/log-a-thing/nodegx.project.json` carries an
  `id` that is **not** in `project-examples/lessons/log-a-thing/` (which carries none at all);
- `LearningStaging/` empty afterwards;
- **AC4 driven**: publish a deliberately-broken bundle (delete a `completeWhen` node's target from
  the solution) under a second slug, click it, and see the reason with **nothing** in Learning;
- **AC7 driven**: stop the Next server, click, and read the sentence.
