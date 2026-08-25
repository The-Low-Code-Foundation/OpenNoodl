# FB-001 — the post you cannot take back

**Filed:** 2026-08-22, from Richard's item 1a. **Status: ✅ BUILT 2026-08-23 (session 9), both
surfaces. NOT YET DRIVEN.** Ruling D7 landed 2026-08-22; scope-3 ruling landed 2026-08-23.
Size: M.

✅ **D7, as ruled:** *edit own post body* and *delete own thread while nobody else has answered* —
exactly scope items 1 and 2 below. Richard **declined** the wider options: **no report/flag** and
**no hide-after-answers**, so an answered thread is simply undeletable and the refusal says so.
D19's no-revision-history exclusion stands: `updated_at` is the whole history. **Build scope 1–3
as written; do not grow a fourth verb without a new ruling.**

> *"Right now in the community I can't edit or delete the questions I added to the bench."*

---

## What exists (swept 2026-08-22)

- **No mutation surface at all.** `nodegx-community/src/app/api/v1/bench/**` has no PATCH and no
  DELETE on threads or posts (only `same-here` has a DELETE). `src/lib/bench.ts` exports no
  edit/delete function.
- **The absence was chosen, twice.** `UNI-015-THE-BENCH.md` "Not in v1": *"no drafts, no edit
  history beyond an `updated_at`"*; P67 D19's Discourse exclusion list names *post revisions*.
- **The ruling that owns this is D7** (`phase-72-nobody-has-to-leave/README.md` ~200):
  *"Report/flag/delete-own — which of these ship."* Still open.

So this is not a regression — it is the chosen absence meeting its first real user. The task is
to answer D7 and then build the smallest honest version.

## Scope (proposed, pending D7)

1. **Edit own post body** — PATCH, author-only, stamps `updated_at`, no revision history (v1
   keeps D19's exclusion). The web thread shows "edited" from `updated_at`.
2. **Delete own thread** — only while it has **no answers from others**; after that it is part of
   someone else's record and the verb becomes *hide* or nothing (D7 decides). An accepted answer
   makes the thread definitively undeletable.
3. Editor mirror gets the same verbs or deliberately doesn't — **D15: both surfaces must agree**;
   shipping it web-only is a decision to record, not an accident.

## Acceptance criteria

- AC1: The author of a thread can edit their own question body; a non-author gets a tagged
  refusal, not a 404-shaped lie (D15 governs what a hidden thread reveals).
- AC2: The author can delete their own thread while it is unanswered; the list stops showing it;
  the refusal for an answered thread names why.
- AC3: Refusals follow the migration-tag pattern — and remember NAT-009's finding: **the refusal
  surface is bigger than its doc**; sweep the migration per function and state the bound in the
  spec.
- AC4: New routes comply with the `/v1` envelope (`tests/nat006-api-contract.test.ts` will
  enforce it) and get a route-inventory D15 verdict; writes go through the byte-capped
  `apiwrite.ts` path.

## Traps

- The four derived-from-disk platform gates fire on any new route; run the suite early, after
  `npm run build`.
- `updated_at` is the only history v1 keeps — do not quietly grow a revisions table; that
  reverses D19 and belongs in a ruling.

---

## What was built — 2026-08-23, session 9

✅ **Scope 1, 2 and 3, and scope 3 was RULED: the editor gets the same verbs.** Richard chose
verb parity over web-only. The reasoning that decided it: the editor is *already* a full writing
client — it asks, answers and accepts — so "the post you cannot take back" reproduces inside it
exactly, and a web-only fix would have left the complaint standing in the surface Richard was
using when he filed it.

### The platform

| Piece | Where |
|---|---|
| `editPost` / `deleteThread` / `postSourceFor` | `src/lib/bench.ts` |
| `PATCH` + author-only `GET` | `.../bench/threads/[threadId]/posts/[postId]/route.ts` |
| `DELETE` | `.../bench/threads/[threadId]/route.ts` |
| Refusal verdicts | `src/lib/bench-http.ts` — 4 new tags |
| **Migration `0018`** | the ban, on the path that did not exist when the ban was written |
| `bodyOptional` | `src/lib/apiwrite.ts` |

- ✅ **AC1** — the author edits their own post body; a non-author gets **403 with a sentence**,
  never a 404-shaped lie. A hidden post and a missing one answer **identically** on purpose.
- ✅ **AC2** — the author deletes an unanswered thread (**204**, no body). Their *own* follow-up
  does not lock it; **somebody else's answer does**, and so does a hidden one — otherwise getting
  an answer hidden becomes a way to unlock the delete. **409**, and the sentence names why.
- ✅ **AC3** — the refusal sweep reads the tags **off `bench.ts` per function**, with a
  known-firing control (an invented tag must fall to the catch-all, and every real tag must
  differ from it — `refusalResponse` has a total default, so a mapping check over it passes on an
  EMPTY table). **Bound stated in the file**: the two FB-001 functions only; UNI-015's insert path
  is swept in its own suite.
- ✅ **AC4** — `/v1` envelope, recipe verdict, byte-capped write path. `updated_at` is still the
  whole history; no revisions table.

### 🔴 Three findings, and the first is the one worth carrying

1. **A BAN DID NOT REACH THE EDIT VERB, AND NOTHING ABOVE THE DATABASE WOULD HAVE CAUGHT IT.**
   `bench_posts_author_eligible` is **`BEFORE INSERT`** — correct and complete for as long as a
   post could only be *created*. Above it, `communityGate` refuses D15's `absent` (a school
   switch, not a ban) and `serveCommunityWrite`'s capability check reads `communityVisibility`,
   whose viewer kinds are anonymous / individual / org_minor — **a banned account is an
   `individual` and holds every write capability**. So shipping the edit verb without `0018`
   would have turned a ban from *"you may not post"* into *"you may not post anything NEW"*: an
   unbounded content channel out of a sanction.
   - 🔴 **And the obvious fix was wrong in a way only an arm would find.** A plain
     `BEFORE UPDATE` gate refuses `upholdReport`'s hide — making a banned account's posts **the
     only ones a moderator cannot hide**, which inverts the rule. `when (new.body is distinct
     from old.body)` is the whole guard, and the spec row that would go red if somebody
     simplified it is *"a moderator can still hide a banned account's post"*.
   - Mutation-checked: unregistering `0018` turns exactly **2** rows red, both behavioural.
2. 🔴 **`tests/api-malformed-id.test.ts` HAD A HOLE SHAPED LIKE THIS TASK.** It discovered a
   route by its `[…Id]` segments and then drove only `GET` and `POST` — the two verbs it was
   born knowing. A **`PATCH`-only route was discovered and driven zero times**, and the
   non-vacuity floor (`driven >= 9`) is satisfied by the GETs alone, so it passed. Widened to all
   four verbs, **and given a row that asserts the ARM** (at least one route of each mutating verb
   in scope) — because narrowing `VERBS` back would otherwise go quiet rather than red. Verified
   by mutation: stripping `isId` from the new PATCH now fails the sweep; before, it could not.
3. ⚠️ **`/api/v1/me` nests the handle under `viewer`, and reading it flat FAILS SILENTLY.** The
   first `PostControls` read `body.handle`; `undefined === handle` is false, so the controls
   simply never appeared and nothing threw. Caught by checking the route rather than the
   component. Pinned by a spec that asserts both halves — `viewer.handle` is the handle, **and
   there is no top-level one** — plus a source-text row on the component.

### What is NOT done

- 🔴 **NEITHER SURFACE HAS BEEN DRIVEN.** Everything above is specs — 34 rows against a real
  database on the platform, 18 decision rows in the editor — and this phase's standing lesson is
  that a spec asserting a mechanism passes on dead code. Specifically undriven:
  - the **web** controls (`PostControls`): the `/me` fetch, the source fetch, the save, the
    `confirm` + delete + redirect;
  - the **editor** pane: `editFor` is graded, but nothing has watched the panel place the verbs,
    and **no editor bench WRITE has ever been driven** (NAT-012 AC4's other half is the same gap).
  - ⚠️ The editor drive needs a signed-in editor against the live platform, which is the thing
    NAT-012 AC4 is still waiting on — so these two are one drive, not two.
- **Not deployed.** nexus-1 is still `8d40b63`; this lands behind `9ecec25` and `fd695ae`, which
  were already unshipped. Deploying changes the live site — **Richard's call**.

### Measurements — 2026-08-23, session 9

- **Community suite**: see the session log; run after `npm run build` so the real-HTTP file does
  not self-skip.
- **Editor `tests-unit`**: **292 suites / 4759 specs, 0 failures.** Reconciles exactly against
  session 8's 291 / 4741 — **+1 suite / +18 specs**, both `fb-001/editverbs.test.ts`.
- `typecheck:editor`, `typecheck:editor-tests`: 0. `typecheck:core-ui`: **44 pre-existing
  `TS2307`**, unchanged, nothing else.

---

## ✅ DRIVEN — 2026-08-23, session 10. Both surfaces.

**Status: BUILT AND DRIVEN.** Both halves were watched end to end against a live platform
(`next start` on :3200, its own database `nodegx_community_fb001drive` on 55432, three seeded
threads). The verbs work. The drive also found **one defect that is not FB-001's** and which
blocked it for most of the session — see the next section, it is the more important finding.

### The fixture, and why three threads

| thread | author | state | what it is an arm for |
|---|---|---|---|
| **A** | `fb001author` (the driver) | unanswered | the happy path for BOTH verbs |
| **B** | `fb001author` | **answered by `fb001other`** | delete must be refused / withdrawn |
| **C** | `fb001other` | unanswered | **the control**: not my post, no verbs |

### The web half — `PostControls`, driven in headless Chrome over CDP

Read states, structurally (`.post-controls` is **absent** when not the author, so the marker is
the read — never innerText):

| arm | `.post-controls` | buttons |
|---|---|---|
| A, **signed out** (control) | **0** | — |
| A, signed in as **non-author** (control) | **0** | — |
| A, signed in as **author** | 1 | `Edit`, `Delete` |
| B (answered), as author | 1 | `Edit`, `Delete` |
| C, somebody else's, as author (control) | **0** | — |

- ✅ **Edit** — `Edit` fetches the **source** (`ORIGINAL BODY A…`, the markdown, not a
  reconstruction), the textarea takes a rewrite, `Save changes` PATCHes and the page reloads
  showing the new body, the old body **gone**, and an **"edited"** marker. Confirmed in the
  database: body replaced and `updated_at > created_at`.
- ✅ **Delete, three arms.** The `confirm` text is
  *"Delete this question? It will be gone for good, and only works while nobody has answered."*
  - **cancel** → nothing happens: still on the thread, no error, controls intact;
  - **answered thread, accepted** → the server's own sentence is shown:
    *"somebody has answered this thread, so it is part of their record too and cannot be
    deleted"* — AC2's requirement that the refusal **names why**, driven;
  - **unanswered, accepted** → gone, redirected to `/bench`, and the list no longer shows it.
    Database: the thread row and its post are both gone, **0 orphan posts** (the cascade holds).

### The editor half — and the first bench WRITE ever driven

⚠️ **NAT-012 AC4's other half is now closed too**: this is the first time any editor bench write
has been watched, not just the edit verbs.

Driven against the same live platform by patching `window.fetch` in the renderer to rewrite
`https://community.nodegx.io` → `localhost:3200` and swap the bearer. 🔴 **Richard's real
credential file was never touched** — `~/Library/Application Support/NodeGX/nodegx.community.session.json`
holds a live token for the real site; the header swap in the patch is what made touching it
unnecessary. (It was backed up first regardless.)

| thread | **loaded** | Edit | Delete | matches `editFor` |
|---|---|---|---|---|
| A — mine, unanswered | ✅ | ✅ | ✅ | both verbs |
| B — mine, **answered by another** | ✅ | ✅ | **✗** | Delete **withdrawn**, not drawn-and-refused |
| C — somebody else's | ✅ | ✗ | ✗ | no verbs |

- ✅ **Edit** — the composer **replaces** the body (not added beneath it), pre-filled with the
  fetched source; `Save changes` → composer closes, new body drawn, old gone, "edited" shown,
  verbs restored. Database confirms body replaced and `updated_at` stamped.
- ✅ **Delete** — the thread goes, the pane returns to the list by itself (`onBack` on success,
  as the hook argues), and the list has two threads. Database: gone, **0 orphans**.

- 🔴 **THE "loaded" COLUMN IS LOAD-BEARING AND THE FIRST RUN OF THIS TABLE WAS VACUOUS.** An
  early pass read thread C as *"no Edit, no Delete — correct, not the author"*. It was actually
  a **failed read**: the pane was on its error arm and there were no verbs because there was no
  thread. A failed read and a correctly verb-less thread are **identical** in `hasEdit: false`.
  The rows above only mean something because each carries a known-firing signal that the thread
  really rendered. Same family as session 8's `[data-panel-id]` lesson, one layer up.

### ✅ RULED AND BUILT (session 11): the editor asks before it withdraws

**Found by driving in session 10, owned by nobody then; Richard ruled for the confirm step on
2026-08-23 and it is built and driven (`0679ccc7`).**

The web calls `window.confirm` before deleting; the editor's `onDelete` fired the DELETE
immediately on click. D7 declined a soft delete, so the row really goes and takes its posts with
it — it was the one irreversible verb in the pane, one stray click away with no step in between.

🔴 **Why no spec caught it, and this is the reusable half.** Verb parity (D15) was satisfied —
both surfaces offered the same verbs. `editFor` grades **which verbs are offered**, never what
happens *between the click and the request*. A whole family of specs was watching the wrong
half-second.

**What was built.** `DialogLayerModel.instance.showConfirm` rather than `window.confirm`: a
native modal would sit outside the editor's own chrome, and `createDialogLayer()` runs once in
`router.tsx`'s `componentDidMount` for **both** routes — so one implementation covers the panel
and the launcher tab, which matters because one hook draws both.

⚠️ **`editPending` moved into the request path (`deleteNow`), not the click.** Setting it when
the dialog opens would leave the pane spinning forever on a cancel — and cancelling is the
*common* case for a confirmation, so that bug would have been the one people met most.

⚠️ **`deleteNow` is declared BEFORE `onDelete`.** `onDelete` names it in a dependency array,
which React evaluates on every render rather than on click, so the other order throws
`Cannot access 'deleteNow' before initialization` the first time the pane draws. Caught by
reading the code, not by the type checker.

#### The drive, both surfaces (2026-08-23, local platform, own database)

| arm | launcher tab | in-editor panel |
|---|---|---|
| click **Delete** | dialog shown, **0 requests sent** | dialog shown, **0 requests sent** |
| click **Cancel** | dialog gone, **0 DELETE**, still on the thread, verb back to `Delete` (not stuck on `Deleting…`), **row still in the database** | same, **row still in the database** |
| reopen → **Confirm** | **exactly one DELETE**, pane back on the list, **0 rows, 0 orphan posts** | **exactly one DELETE**, pane back on the list, **0 rows, 0 orphan posts** |

- ✅ **The known-firing control that mattered**: before concluding "the dialog does not appear",
  `showConfirm` was fired directly through webpack's require and **did** render — which is what
  ruled out the dialog layer and pointed at the click delivery instead.
- 🔴 **And that was the real fault: a hand-rolled `Input.dispatchMouseEvent` over a fresh
  WebSocket reported `clicked` and did nothing.** The button hit-tested correctly at those exact
  coordinates and its React `onClick` was verifiably the new code. `npm run cdp -- click` on the
  same selector worked first time. ⚠️ **A CDP click that reports success is not a click** — the
  memory's input trap, met again in a new shape.
- ⚠️ `BaseDialog` renders every dialog twice; the buttons read `["Cancel","Delete","Cancel","Delete"]`
  until filtered with `:not([class*=MeasuringContainer])`.

#### The guard, and what it is honestly worth

Four rows in `tests-unit/fb-001/editverbs.test.ts`, **3 red on the pre-change hook** (the fourth
is a non-vacuity row and is meant to stay green). They read **source**, which this phase has
shown passes on dead code — so they are a regression guard, not evidence. What they do catch is
the specific way this regresses: somebody re-inlining the request onto the click. The evidence is
the drive above.

### What is still not driven

- The **409 refusal inside the editor**. It cannot be reached by clicking: the editor
  *withdraws* Delete once somebody else has answered rather than drawing it and refusing, which
  is the documented choice. The refusal line is graded by spec only.
- The **web** was driven signed-in via a minted session row, not through the real device flow.

### Measurements — 2026-08-23, session 10

- **Community suite, after `npm run build` on the reverted tree: 54 files / 1313 specs, 0
  failures** — *identical* to session 9's, which is the check that the drive's local patches
  (a `toPost` coercion, then a `mirror.ts` pool isolation) were both fully reverted. The
  `nodegx-community` working tree is clean at `080a4f1`.
- **No editor code was changed this session**, so `tests-unit` stands at session 9's
  **292 / 4759 / 0**. Nothing was rebuilt to make the drive work; the only editor-side
  intervention was a renderer `fetch` patch applied at runtime.
- The drive ran against its own database (`nodegx_community_fb001drive` on 55432), so nothing
  it did touched the suite's `nodegx_community`.

### ✅ `test:ci` now covers the confirmation — measured 2026-08-25, by another session

The confirm step (`0679ccc7`) shipped with `tests-unit` and `typecheck:editor` green but **without**
a `test:ci` run; the handover recorded that gate as not-re-measured. It has since been measured on a
tree containing it:

**`Jasmine: 2849 specs, 4 failures`, seed `49062`, run 10:13–10:26 on 2026-08-25** (session 26, for
FB-017 AC4 — this task was simply along for the ride). Spec count identical to the 08-19 floor;
all four failures are `AIX-006 style vocabulary`, a family the floor already carried. **No new
failure names, and nothing in the community/sidebar/dialog area.**

🔴 **CORRECTED — the paragraph that stood here was wrong, and wrong in the dangerous direction.**
It said the floor's other six failures were *"the known seed-sensitive ones"* and that this run
therefore proved nothing about them. They were not seed luck: **they were fixed on 2026-08-21**, by
`dae76da8` (the shipped fx expression form → 3× `SUB-011`), `a46b52ba` (a gateway user's default
model → 2× `AI model registry`) and `ea402850` (the D13 double-report → 1× `AIX-011 AAQ-005`).
`4c038fa7` recorded the measurement the same afternoon — *"2849 specs, 6 failures… the 3× SUB-011
and 2× AI model registry are gone by name"*.

✅ **So the floor is 4 — all `AIX-006 style vocabulary` — and has been since 08-21.** The `10` this
file compared against was already four days stale when it was written.

🔴 **Why that matters more than an ordinary error: a stale-HIGH floor HIDES regressions.** Quoting
10 means six genuinely new failures could land and still read as *under the floor*. A stale-low
floor merely cries wolf; this one goes quiet.

⚠️ **And the reasoning error is one this phase keeps repeating: when failures VANISH, read
`git log` before crediting the seed.** Seed-sensitivity explained the observation — and so did
"somebody fixed them". Both fitted; only the commit log discriminated, and nobody looked.
**A reading that FITS is not one that EXCLUDES.**

⚠️ `AIX-011 criterion 7 — createPlanDocWriter on real files` is a **timing** flake (undo writes
settled on a 30 ms `setTimeout` a loaded runner loses), never one of the ten. It ran and passed
here; expect it to come and go with machine load rather than treating its absence as a fix.

✅ That session checked the previously-failing specs had actually **run** rather than been skipped
(16 / 60 / 6 spec-starts) — the check that separates *a real pass* from *a pass that never
executed*.

⚠️ The only commit inside the run window was `4629dceb`, docs-only, so it cannot affect the reading.
