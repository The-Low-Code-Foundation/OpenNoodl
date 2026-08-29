# SBR-015 — A failure with nowhere to go

> 🟢 **AC1, AC2 and AC3 are met (2026-08-29, s13).** The drive is in **§2.3d** — 30,004 ms of
> silence became a named refusal on screen in **29 ms**, with a success control arm at 31/48 ms
> through the same button. **AC4 stays 🟡 by design**: `execution_steps` is 0 rows and the task
> already says why. 🔴 **Read §2.3d before re-driving anything here** — a project is a *copy* of
> the template at mint time, so the older drive fixtures cannot test this fix.

**Found by SBR-006's drive (§5.7), which could not own it.** Two row actions on the admin
page list — Publish and Duplicate — both answered nothing at all and 504'd after thirty
seconds. The drive recorded them as *"one symptom over at least two causes"* and handed the
question on. It is one cause, and `claimSite` — the same file, the same author, the same
mechanism — is the control that proves it.

**`publishPage` and `duplicatePage` do not wire a single `failure` edge.** Every node in both
graphs has exactly one way out: the happy path. Any error, anywhere, in either function is a
thirty-second hang with no status, no message and no log line naming a node.

## 1. The person sentence

**An admin who clicks Publish on a page that cannot be published is told so, and the menu stops
being busy.** Today they watch a spinner for thirty seconds and are then told nothing — and the
page is not published, which is the one thing the screen does not say.

## 2. The evidence

From the drive backend's own `executions.sqlite`
(`~/.noodl/backends/backend_mtdg3sdziq5nw`), all three calls in one session against one
backend:

| function | status | duration | effect on the record |
|---|---|---|---|
| `claimSite` | success | **29 ms** | wrote both singletons |
| `publishPage` | error | 30004 ms | **nothing** — `published` still `0`, `updatedAt` unchanged |
| `duplicatePage` | error | 30010 ms | **the copy WAS created** |

`Cloud function "…" did not send a response within 30000ms`, `timedOut: true`. The requests
arrived intact — `{"publish":true,"pageId":"0826ed8b…"}` — so this is neither the transport nor
SBR-006's wiring.

🔴 **`execution_steps` is empty for all three**, so the log can say *that* a function hung and
never *where*. That is the second half of why this took a whole drive to characterise.

⚠️ **CORRECTED 2026-08-29 — the cause written here first was wrong, twice, and this is the third
reading.** It is **not** that "nothing writes to it for cloud functions". The recorder is complete
and the cloud path **does** call it: `WorkflowRunner.ts:261` mints a step per **author log line**
(`nodeType: 'net.noodl.Log'`). The site-builder ships **zero `Log` nodes**, which is the entire
explanation of *3 executions, 0 steps*. `execution_steps` records **what the author logged, never
what the graph ran** — a much smaller gap than this row first claimed.

🔴 **The method error is the reusable part**: the first cause was concluded from a *caller list*
(`grep` for `.startNode(` returned two files) without opening either caller to see what it was.
A caller list answers *"is it called?"* and never *"called for what?"*

### 2.1 The audit that settles it

Over the shipped artefact
(`noodl-editor/src/editor/src/models/template/templates/site-builder.content.json`), counting
`failure` wires and edges into a Response's `send`:

| function | `failure` wires | edges → `send` | failure-capable nodes answering nothing |
|---|---|---|---|
| `claimSite` | **5** | **7** | **none** |
| `publishPage` | **0** | 1 | `prep`, `sections`, `withFlag`, `tasks` |
| `duplicatePage` | **0** | 1 | `prep`, `newProps`, `copy`, `afterCopy`, `sections`, `tasks` |
| `submitContactForm` | 1 | 2 | 2 |
| `SetSectionAccess` / `CopySectionToPage` / `ContactRecipient` | 1 | 0 | worker components — see §4 |

`claimSite` answers in 29 ms because **every** way it can end reaches a Response: five `failure`
edges into a `Refused` node carrying `status: 'failure'`, plus the deliberate case where the
theme write's `failure` answers `Claimed` because the claim itself already succeeded. The
pattern is already written, already reviewed, and already in this file — it was simply never
applied to the two functions the admin screen calls.

### 2.2 Why the two "disagree"

They do not. Both graphs stall at the same *kind* of point; they differ only in where their
write sits relative to it.

- `publishPage`: the only edge into `Answer.send` is `page.done`, and `page.store` is triggered
  by `tasks.completed`. Break anywhere upstream and nothing is written and nothing answers.
- `duplicatePage`: the only edge into `Answer.send` is `tasks.completed`, and the copy is
  created **before** that. Break at the same relative point and the copy exists and nothing
  answers.

One cause, two positions, two different-looking outcomes. A hang is the one outcome downstream
cannot react to, so it presents identically wherever it happens — which is exactly why "they
disagree" was the wrong reading, and why the fix has to come before the diagnosis.

### 2.2b 🔴 A second defect, found while proving the first

`RunTasks` was wired by its **`completed`** port in both graphs — `tasks.completed → page.store`
in publishPage, `run.completed → res.send` in duplicatePage. `completed` is the one outcome port
that cannot mean success:

> *"Fires after every invocation, whatever the outcome — wire this to carry on regardless.
> Failure still fires and still carries its reason, so this cannot hide an error"*
> — `outcome.ts`, `COMPLETED_WITH_OTHER_OUTCOMES`

So publishPage marked a page `published` **after a Run Tasks that failed to set a single
section's access rules** — a publish that answers 200 having published nothing the world can
read. duplicatePage answered with the new page id after a section copy that failed, which is
precisely the partial-copy-reported-as-success that `afterCopy`'s own comment calls "the worst
of the three outcomes". Both are now `done`, the port that means the work happened.

⚠️ This also **narrows the original stall**. Because `completed` fires on failure too, neither
RunTasks node can have been *invoked at all* — an invocation would have answered whatever it
did. The stall is therefore upstream of Run Tasks: the code node's `built()` signal never fired,
which happens when its guard returns (an input still undefined) or its script throws. Both are
now wired to a Response, so the next run names it.

### 2.3 What is *not* yet established, and must not be guessed

Which node actually broke is **unknown**, and three plausible readings were each refuted:

| candidate | refuted by |
|---|---|
| undeclared custom signal port (the documented deployed `Outputs.x is not a function`, sb004Components.ts §1) | the shipped artefact **does** declare every one — `out-ready`, `out-built` etc. are present on all six JS nodes, and `claimSite`'s `out-ok`/`out-denied` work deployed |
| `RunTasks` hangs on an empty list | `runtasks.ts` ends an empty run as `done` (NDA-012 §B3), and `[]` is truthy so the `items` setter stores it |
| the empty query never publishes `items` | `setCollection` flags `items`, `count`, `isEmpty` and `firstItemId` dirty unconditionally |
| the code nodes throw calling `.map` on a Collection rather than an array | `Collection extends Array` (`collection.ts`), so `.map` is inherited and works |

What *is* established: the `Section` class was auto-created with empty columns at
`21:14:56 UTC`, **the same second `publishPage` started**, and the site had `Section: 0` rows.
So the query reached the backend and the break is at or after `fetched`, on a zero-row path.

🔴 **This was deliberately left open** until the failures were wired, and the four refutations
above are why: each one *fitted* the evidence and each one was wrong. Wiring first and guessing
second is what made the backend answer the question rather than the next reader.

### 2.3a 🟢 ANSWERED by the drive of 2026-08-29 (s12)

**It is the query, and the cause is one column that does not exist yet.**

A project minted from the regenerated template, its own wizard-attached backend
(`backend_mte3mrsp5qtbd`, port 8597), `SITE_SETUP_TOKEN` provisioned through the Secrets panel,
claimed through `/admin/setup`, two pages created through the dialog, **zero sections anywhere**.
Publish clicked on the first row.

| | before SBR-015 (SBR-006 §5.7) | after SBR-015 (this drive) |
|---|---|---|
| `publishPage`, zero sections | `error`, **30,004 ms**, `timedOut: true` | `error`, **19 ms**, `HTTP 400` |
| what the caller receives | nothing, then a timeout | `{"error":"This page could not be published."}` |

That body is `deny`'s `errorMessage`, verbatim. **The thirty-second hang is gone** — 30,004 ms to
12–19 ms, with a named refusal. This is the middle row of the outcome table the handover wrote:
a node genuinely failed, and SBR-015's wiring is what made it speak.

**Which node, measured rather than inferred.** The same query the `sections-3` node runs, issued
directly with the admin's session token:

```
GET /classes/Section?where={"pageId":"baa851b3-…"}
→ 500 {"error":"no such column: \"pageId\" - should this be a string literal in single-quotes?"}
```

The auto-created `Section` table holds **exactly four columns** — `objectId`, `createdAt`,
`updatedAt`, `ACL` — and zero rows. A filter on a column the class has never been given is a
**500, not an empty result set**. `sections-3` reports `failure`, `failure` reaches `deny`, and
`deny` answers 400.

**The control pair that settles it.** One variable moved — whether `Section` has a `pageId`
column. The column was created by writing a Section row against the *other* page, so the page
under test still had **zero** sections in both arms:

| `Section.pageId` | publish `baa851b3` (zero sections either way) |
|---|---|
| absent | **400** `This page could not be published.` — 12 ms |
| present | **200** `{"pageId":"baa851b3-…","published":true}` — 24 ms |

Everything else held: same page, same user, same backend, same request body.

**Three readings the handover made are therefore confirmed, not merely unrefuted:**

1. `withFlag`'s guard passes on an empty fetch — the 200 arm ran the whole chain.
2. **`Run Tasks` on an empty list fires `done`, not `unchanged`** — the 200 came through
   `tasks.done → page-6.store → page-6.done → res.send`, and `tasks.unchanged → deny.send` did
   not fire.
3. **A page with no sections is legitimately publishable.** The refusal is a bug, not policy —
   the second arm publishes it correctly, world-read ACL and all.

🔴 **And the consequence nobody had stated: a brand-new site can never publish its first page.**
Until *some* Section row with a `pageId` exists anywhere in the backend, every publish 400s. The
template's own first-run story — claim, create a page, publish it — is blocked at the last step,
on every new site, every time. That is a defect in its own right and it is **not** SBR-015's; see
§2.3c.

### 2.3b 🔴 AC1 is NOT met — the fix landed on the cloud half only

The same button, two arms, both driven through the UI:

| backend answered | what the admin sees |
|---|---|
| **400 in 19 ms** | **nothing, for 47 s observed** — the menu stays open, the pill stays `Draft`, no message anywhere. A `MutationObserver` over `document.body` recorded **zero** text changes |
| **200 in 24 ms** | menu closes at **211 ms**; at **228 ms** the pill reads `Published` and the count sentence becomes *"Two pages, one published"* |

`/Admin/PageRow`'s `publish`, `unpublish` and `duplicate` `CloudFunction2` nodes wire **`done`
only**. There is no `failure` wire on any of the three. So the backend now produces a fast,
correct, well-worded refusal and the browser throws it away.

AC1's person sentence — *"an admin who clicks Publish on a page that cannot be published is told
so, and the menu stops being busy"* — is still false. The half of it that changed is that the
answer now **exists**; nothing renders it. ⚠️ The fix is in **`sb005Components.ts`** — PageRow
and Setup live there; `sb004Components.ts` holds the cloud endpoints this task already changed.

#### 🔴 DRIVEN 2026-08-29 (s20) — **AC1 STILL FAILS, and the wiring is not why**

Project `SBR-015 AC1 Refusal`, minted fresh from the regenerated template, wizard-attached backend
`backend_mteswypad9d4u` on 8602, `SITE_SETUP_TOKEN` provisioned under the `functions` namespace,
claimed through `/admin/setup`, one page created through the dialog.

**The happy path is verified and is better than it was:**

| | measured |
|---|---|
| publish a page with **zero sections** | **succeeds**, 16 ms — row reads `Published`, count sentence becomes *"One page, one published"*, menu closes |
| the title | `About us` renders — the dialog's `prop-*` reach the record now |
| the empty list before that | *"No pages yet. Use New page to make your first one."* (SBR-016) |

🔴 **s12's trigger is gone.** A brand-new site publishing its first page was a 400 because the
auto-created `Section` class had no `pageId` column; that is fixed (phase-80 **DEF-014**), and a
zero-section page is now publishable exactly as §2.3a said it should be. **AC3 is therefore
satisfied and AC1 lost its cheap repro in the same change.**

**So the refusal was driven against a dead backend instead** — `kill` the listener on 8602, then
Unpublish:

| | measured |
|---|---|
| the call | `publishPage` fired, **1 ms**, `transferSize: 0` — connection refused |
| the refusal text | **absent**, 35 s later. No node matching `/could not\|did not work\|failed/` |
| anything in `--destructive` | **0 elements** at `rgb(220, 38, 38)` |
| the menu | **still open** — `Duplicate` still hit-testable |
| the row | still `Published` |

🔴 **Both `failure` wires failed to act** (`to-Refused` and `to-Closed`), which is the tell: this
is not the Text or the `States` node, it is the signal never arriving.

**And it is not a missing graph.** Measured on the minted project rather than assumed:
`components/Admin/PageRow/nodes.json` contains the refusal Text and `connections.json` contains
**6 `failure` wires**. The wiring shipped.

⚠️ **What this drive does NOT establish.** It ran **one** failure mode — a backend that is not
listening. `CloudFunction2`'s `error` callback does call `setError`, which does
`reportOutcomes(…, 'failure')` (`cloudfunction2.ts:182`), so the node is *capable*. Whether a
**connection refusal** reaches that callback at all is the open question, and it is a different
claim from "the wiring never fires". **The missing arm is an HTTP-error failure** — a call that
reaches a live backend and is refused by it. Until that arm is run, "AC1 fails" is true and
"the fix does not work" is not yet earned.

#### 🟢 AC1 PASSES — second arm, 2026-08-29 (s20)

The missing arm, supplied by the DEF-014 session: make a **live** backend refuse. Cheapest form is
to point the call at a function that is not deployed (sabotage, not reasoning). Same project, same
backend, backend **up** throughout (`404` on `/` = healthy):

| | measured |
|---|---|
| the call | 1 request to `noSuchFunction` |
| the refusal | **rendered** — `Function 'noSuchFunction' not found`, the **server's own sentence** |
| its colour | `rgb(220, 38, 38)` = `--destructive` |
| the menu | **closed** (`Duplicate` no longer hit-testable) |
| elapsed | 18 s observed, rendered well inside it |

**Both halves of the person sentence are true**: *"an admin who clicks Publish on a page that
cannot be published is told so, and the menu stops being busy."* ✅ **AC1 CLOSED.**

#### 🔴 …and the two arms together are a control pair with a defect in them

One variable — whether the backend is reachable — and opposite results from the same wiring:

| backend | `failure` fires? | what the admin sees |
|---|---|---|
| **up**, function refuses (404 from the runner) | **yes** | the refusal, in `--destructive`, menu closed |
| **down**, connection refused (1 ms, `transferSize: 0`) | **no** | nothing, for 35 s. Menu still open |

So the earlier negative was **not** the wiring, and saying so was worth the restraint: this is
`CloudFunction2` **not reporting `failure` when the backend cannot be reached at all.** Its `error`
callback does `reportOutcomes(…, 'failure')` (`cloudfunction2.ts:182`), so the node is capable —
whatever a connection refusal does, it does not arrive there.

🔴 **It is the same defect as SBR-015's, one layer further out.** SBR-015 fixed cloud functions
whose failures reached nobody; this is a *call* whose failure reaches nobody — and it is the
failure mode a person is most likely to meet, because "the backend is not running" is the ordinary
way this breaks. **No owner. It belongs in phase 80, not here.**

#### 🟡 WIRED 2026-08-29 (`379f4dec`) — the graph is done, the **drive is not**

`failure → callState.to-Refused` on all three calls, `done → to-Quiet` so a later success
**resets** it, `callState.refused → rowRefusal.mounted`, and `error → rowRefusal.text` so the
admin reads the server's own sentence rather than a generic one — duplicate's *"a partial copy
may exist"* is true and not interchangeable. `failure → menuState.to-Closed` is the second half
of the person sentence; only `done` closed it before.

⚠️ **`mounted`, never `visible`** — an absent refusal must take no space, and P78 D16 was that
exact bug in this template. `--destructive` (#dc2626), which is **4.83 on `--background` and
4.62 on `--surface`**, both over AA 4.5 as text. (First attempt used `var(--danger)`, which is
not a token this system has — it would have shipped an unresolvable reference straight into
SBR-012's gate.)

🔴 **AC1 is still ⬜ until it is driven.** What is asserted is that the failure signal *leaves
the node*; what AC1 claims is that **a person is told**. Those are not the same statement and
no spec here can close the gap — the whole reason this AC exists is that the last graph which
looked correct rendered nothing for 47 seconds. Repro: publish a page with zero sections in a
site whose `Section` class has no `pageId` column, expect the refusal text under the title and
the menu closed.

🔴 **Why this task's own gate could not see it, which is the reusable half.** The gate derives
its population as *a component holding a `noodl.cloud.request`* — cloud endpoints. That is a
better rule than a hand list, and it **still** could not see the same defect one layer up in
the component that *calls* one. Deriving a population removes the "I forgot one" failure and
leaves "I framed it too narrowly". The gate now grades browser `CloudFunction2` callers as
well, and says in the file that it is **necessary and not sufficient**.

**Three things established after the drive, by the task's author, so nobody re-derives them:**

1. **The browser-side hole is exactly three nodes**, measured across the whole artefact:
   PageRow's `publishPage(true)`, `publishPage(false)` and `duplicatePage`. Every other
   `CloudFunction2` in every other browser component already wires `failure` or `error`. It is
   contained, not systemic.
2. **The precedent is `claimSite` again, in the same file.** `/Pages/Setup` already does the
   shape: `claim.failure → claimGate.eval → claimRefusal.visible`, with `claim.error`
   deliberately not read (a fixed string, not the server's). PageRow wants the same plus
   `failure → menuState.to-Closed` for the "stops being busy" half. ⚠️ **`visible` holds its
   space and `mounted` does not** — P78 D16 was exactly that bug.
3. 🔴 **AC2's gate, as designed, structurally could not have caught this.** Its population is
   *"components holding a `noodl.cloud.request`"* — cloud endpoints only — so a browser
   component that **calls** one is invisible to it. A cloud function that could only succeed was
   fixed, and a panel that could only succeed was left one layer up, behind a checker whose
   population guaranteed it would not be noticed. **A checker's population is part of the
   checker** — third time in this phase. AC2 must grade `CloudFunction2` **callers** too, or
   this returns.

### 2.3c Two rows this drive owes elsewhere, so they are not lost here

- 🔴 **The column-less auto-created class** (§2.3a). `publishPage` is *correct* to refuse a query
  that errored; the defect is that a filter against a never-written column is a 500 rather than
  zero rows, and that the template therefore cannot publish its first page. **Owner: NONE** —
  raised as a phase 80 row; see `../phase-80-the-defects-the-templates-found/TASKS.md`.
- 🔴 **The admin page list never queries on load.** Arriving at `/admin/pages` cold renders the
  shell, the heading and `New page` and **nothing else**, while `GET /classes/Page` with the same
  session returns both rows. Measured, not inferred: `performance.getEntriesByType('resource')`
  after load showed **0 requests to :8597** and **5 to :8574** as the control. This is *not*
  SBR-006 §5.8's refused query — there is no query. **Owner: NONE** — phase 80 row.


### 2.3d 🟢 AC1 IS MET — driven 2026-08-29 (s13), both arms, one instrument

**A person is told, in 29 ms, and the menu stops being busy.** The wiring of `379f4dec` was
never driven; this is that drive.

**Why a fresh project was necessary, and it is the reusable part.** A project is a *copy* of the
template taken at mint time. `SBR-015 Zero Section Drive` was minted before `379f4dec`, so its
`/Admin/PageRow` carries `done` and no `failure` — **re-driving the old fixture would have
re-measured the old defect and read as a regression.** Verified before driving: the newly minted
project's `components/Admin/PageRow/connections.json` holds all **9** of the new edges (3×
`failure → callState.to-Refused`, 3× `error → rowRefusal.text`, 3× `failure → menuState.to-Closed`).

**The fixture.** `SBR-015 AC1 Drive` (`~/vscode_projects/NodeGX test projects/`), wizard-attached
backend `backend_mte62ofkj8whc` on **port 8598**, `SITE_SETUP_TOKEN=drive-token-ac1` provisioned
through the Secrets panel (verified in `secrets.json`), claimed as `owner@ac1.test`, one page
created through the dialog, **zero sections**. At mint the `Section` table **did not exist at all**
— a stronger starting state than s12's column-less class, and the filter fails identically.

#### The two arms, same button, same page, one variable

The variable is whether `Section` has a `pageId` column. It was created by writing a Section row
against a *different* page id, so the page under test carried **zero** sections in both arms
(`GET /classes/Section?where={"pageId":"8ad6f2f1-…"}` → `200 {"results":[]}`).

| `Section.pageId` | backend | what the admin sees, from the click |
|---|---|---|
| **absent** | `error`, **11 ms** | **29 ms** — `This page could not be published.` under the title, menu closed |
| **present** | `success`, **12 ms** | **31 ms** — menu closed *and refusal cleared*; **48 ms** — pill `Published`, count sentence updates |
| absent again | `error`, **11 ms** | **29 ms** — refusal returns, menu closed |

Three publishes in that order, from `workflow_executions`: `error 11ms · success 12ms · error 11ms`.
The middle row is the control that proves the instrument can read a success, and the third proves
the refusal is repeatable after one.

🔴 **`done → to-Quiet` does reset a prior refusal** — the 31 ms event carries `refusal:false` on a
row that had been showing one since the previous arm. That was asserted from the graph in §2.3b
and is now observed.

**What renders.** `rgb(220, 38, 38)` — `#dc2626`, `--destructive`, exactly as §2.3b said — at
14 px, **210 × 33 css px**, `mounted` so it takes space only when present, inside the viewport.

#### 🔴 The measurement error this drive made, and corrected

The first refusal arm was recorded as **5,827 ms**. That number is **wrong and was nearly
reported**. The clock was started when the button was *stamped*, from one `npm run cdp` process,
and the click arrived from a *second* process — so the interval measured **CLI process startup
plus app latency**, and the app's share of it was invisible. The fix was to anchor `t0` inside the
page, in a capture-phase `click` listener, so the interval begins at the event the person causes.
Re-measured: **29 ms**.

⚠️ **The trap generalises to any cross-process drive**: if the clock and the cause live in
different processes, the number is about the harness. The question that caught it — *what would
this number be if the app were instant?* — still ~5,800 ms.

#### What this closes and what it does not

- **AC1 ✅.** Both halves of the person sentence: told, and the menu stops being busy.
- **SBR-006 AC3 ✅** — its refusal half was blocked on exactly this.
- **AC4 🟡 unchanged, and re-confirmed**: `execution_steps` is **0 rows** across all four
  executions. The prediction in AC4 held — the readout was the Response's own sentence, not the log.
- ⚠️ **`net` was empty in the fetch recorder**: `CloudFunction2` does not go through `window.fetch`.
  The DOM and the backend's own execution table are what carried this; a fetch hook alone would
  have read as "no request was made", which is SBR-016's signature and would have been wrong here.

#### Independently reproduced on a brand-new backend, so both are stronger

- **DEF-014** — `GET /classes/Section?where={"pageId":…}` → **500 `no such column: "pageId"`**, on a
  backend where the table did not exist. A brand-new site cannot publish its first page.
- **DEF-015** — the card warned `site/ContactRecipient`, `site/CopySectionToPage`,
  `site/SetSectionAccess` were *"in the project, not on this backend"* while reading
  **"pushed just now"**, on a project minted minutes earlier.
- **SBR-008** — the created `Page` row has columns `objectId/createdAt/updatedAt/ACL/published/showInNav/navOrder` and **no `title`, no `slug`**.

⚠️ **Fixture state, deliberately left**: `Section.pageId` is renamed to **`pageId_hidden`**, so the
backend sits in the *refusal* arm. Rename it back to `pageId` to get the success arm. Do not
overwrite this project until DEF-014 is fixed.


## 3. Scope

- `sb004Components.ts` — `ENDPOINT_NODES`/`ENDPOINT_WIRES` (publishPage) and the duplicatePage
  pair: add a `status: 'failure'` Response to each and wire every failure-capable node's
  `failure` into it, mirroring `CLAIM_WIRES`' last five lines.
- Decide per node whether `failure` means "refuse" or "answer anyway" — `claimSite`'s theme-row
  case is the precedent, and `duplicatePage`'s created copy is the same shape: the copy exists,
  so refusing outright tells the admin nothing was made when something was.
- 🔴 **The `completed` → `done` correction on both Run Tasks nodes** (§2.2b) — a separate defect
  from the missing failure edges, found while proving them, and the one with a *wrong answer*
  rather than no answer. Sweep the other cloud components for the same port choice.
- Regenerate the artefact (`npm run template:site-builder`).
- The count pins move deliberately: `sb-007/site-template.test.ts` id count (194) and the
  backend helper's connection total (101).

## 4. Acceptance criteria

1. ✅ **A person sees the failure.** — **DRIVEN 2026-08-29 (s13), see §2.3d.** On a project minted
   *after* `379f4dec`, a Publish that cannot succeed puts `This page could not be published.`
   under the title at **29 ms** and closes the menu; the success arm through the same button is
   **31 ms / 48 ms** and also *clears* the refusal. Backend: `error 11ms · success 12ms ·
   error 11ms`. 🔴 The first latency reading (5,827 ms) was the CLI, not the app — anchor the
   clock inside the page.

   *Original text, kept because its warning is what made the drive necessary:*

   ⬜ **A person sees the failure.** With the site-builder deployed, a Publish that cannot
   succeed answers in well under thirty seconds with a failure status, and the row's menu stops
   being busy. Driven, not asserted from the graph.
   🔴 **Driven 2026-08-29 and it does NOT pass — see §2.3b.** The backend half is done: 30,004 ms
   became **19 ms** with `HTTP 400 This page could not be published.` The browser half was never
   wired — `/Admin/PageRow`'s three `CloudFunction2` nodes carry `done` and no `failure` — so the
   admin still sees nothing at all, for 47 s observed. The success arm through the same button
   closes the menu at 211 ms, which is the control proving the wiring and not the drive is what
   is missing.
2. ✅ **A gate over the artefact** — `sb007Template.test.ts:576-830`, **9 specs green at HEAD**
   (verified s13). All three halves are present, checked rather than assumed: the population is
   **derived** (`components holding a noodl.cloud.request`) and asserted non-empty *and* split
   from the three workers; exemptions carry a reason that is graded for **staleness** (`stillNeeded`)
   **and** for length (`< 40 chars` reds); and the mutant cuts one `failure` wire and asserts the
   grader **names the node**, with the unmutated original clean beside it. §2.3b's widening to
   browser `CloudFunction2` callers is in at `:793-826`, labelled necessary-not-sufficient.

   *Original text:*

   **A gate over the artefact**: every failure-capable node in every `#__cloud__` component
   either wires `failure` to a Response `send` or is exempted **by name with a reason**, in the
   shape SBR-004 §9.5 uses. 🔴 An exclusion list cannot fail — grade the reason column, and add
   a mutant that reds when an exemption is removed from a node that still needs one.
   ⚠️ The three worker components (`SetSectionAccess`, `CopySectionToPage`, `ContactRecipient`)
   have no Response node at all — they answer through the Run Tasks contract's failure output,
   so they are a legitimately different population and the rule must say which one it is
   grading rather than quietly widening to both.
3. ✅ **The original question is then answered** — 2026-08-29, in §2.3a. The node is
   **`sections-3`**, and the cause is measured with a one-variable control pair: the auto-created
   `Section` class has no `pageId` column, so its filter is a **500**, not an empty result set.
   Add the column and the identical zero-section publish returns **200** in 24 ms. SBR-006 AC3 is
   unblocked; the residue is two rows carried to phase 80 (§2.3c), not more work here.
4. **`execution_steps` either records cloud-function nodes or the task says why it cannot.** A
   log table that exists and is always empty is worse than no table: SBR-006 reached for it
   first, exactly as intended, and it could not separate "never called" from "called and
   failed".
   ⚠️ **Smaller than it reads, since §2's correction**: the recorder works and is wired to the
   `Log` node. This AC is about *graph* nodes being recorded, not about building a recorder.
   🔴 **For anyone driving this task: do not expect `executions.sqlite` to name the failing node,
   before or after the fix.** It will not, because the template has no `Log` nodes. The fix's own
   Response — `This page could not be published.` — is the readout, not the log.

## 4a. 🔴 AC2's population — and a counter-measurement of mine that was blind

**2026-08-29, s12. This section originally claimed something false. It is rewritten, not
deleted, because the way it was wrong is the reusable part.**

DEF-002 §2 landed a rule (`b91d696a`): in a cloud function, a `failure` edge that reaches no
`noodl.cloud.response` is reported. Promoting it to `AUTHORED_BLOCKING_WARNINGS` failed 8 specs,
and its author read those as the shipped endpoints leaving failure edges unanswered.

**I said the blocker was the rule's population** — that it counted the three Run Tasks workers,
which have no Response by design — and offered this table, over the shipped artefact, counting
`failure` wires whose target is not a `noodl.cloud.response`:

| component | responses | `failure` wires | not → response |
|---|---|---|---|
| `publishPage` / `duplicatePage` / `submitContactForm` / `claimSite` | 2 / 2 / 1 / 2 | 5 / 8 / 2 / 6 | **0** each |
| the three `site/*` workers | 0 | 1 each | **1** each |

🔴 **Both halves of that were wrong, and the second is the one worth keeping.**

1. **The exclusion I proposed already existed.** `failureReachesNothing.ts:109` —
   `if (responses.size === 0) continue;` — with a spec. The workers never fired. I recommended a
   fix that was already in the file I had not read.
2. 🔴 **My metric was structurally blind to the case that was actually firing.** The rule grades
   an **unwired `failure` port** (`:167` walks nodes that *have* a `failure` port, then asks
   whether it reaches a Response). **An unwired port is not a wire**, so it can never appear in a
   count of wires. I measured *misrouted edges* and concluded about *unanswered failure paths* —
   a different property — and the `0`s in that table could not have come out any other way.

**Verified on `submitContactForm` at `e0772246`**, the exact tree I made the claim against:

| node | outgoing wires | `failure` |
|---|---|---|
| `compose` | `out-subject`, `out-text` | **unwired** |
| `mail` | `completed → res-3.send` | **unwired** |
| `save-3`, `stored` | … `failure → res-3.send` | wired |

My count saw the two wired ones, reported `2`, and reported `0` misrouted. The two firings were
`compose` and `mail`, invisible to it.

**What was actually blocking it** — found by its author reading the rejections rather than either
summary: those two are **false positives**, and both are legitimate unwired-`Failure` shapes on
the one graph written to honour this task's own trap (*"a bounced mail must still answer the
visitor"*):

- `mail.failure` is unwired because `mail.completed → res.send` already answers — and
  **`completed` fires after every invocation whatever the outcome**, so it answers the failure
  path too. (§2.2b, from the other direction: the port that cannot mean success *can* mean
  answered.)
- `compose.failure` is unwired because a parallel branch (`recipient → save → stored → mail →
  res`) still answers around it. A throw there costs the work, not the reply.

Both are now exits with arms and controls (`d3461020`). The second asks *"is a response reachable
**without** this node"* — the inverse of the 14th-hole mutant, so pre-SBR-015 `publishPage` still
fires, because its one worker is the only route. Corpus **249 → 182 → 33**.

**Residue: 4 specs**, from two deliberately malformed probes (`probe/RunTasksCrossRuntime`,
`probe/RunTasksMissing`) that exercise a different check. Wire their `failure` or exempt them by
name and the promotion is free.

### 4b. The lesson, because it cost two sessions between us

✅ *"The endpoints are already repaired"* was **true**. I reached it with an instrument that could
not have told me otherwise. 🔴 **A right answer from a blind instrument is not a measurement**, and
it is more dangerous than a wrong one, because it gets believed and repeated.

🔴 **Before offering a counter-measurement, state what your metric CANNOT see.** Mine counted
edges; the defect was an absent edge. The question that would have caught it in one line: *what
would this number look like if the defect were present?* — `0`, exactly as observed.

⚠️ **And read the rule before diagnosing the rule.** I inferred its population from its symptom
and recommended a guard that was on line 109.
## 5. Traps

- 🔴 **`claimSite` is the control and must stay one.** It is the only cloud function in the
  template that answers every path; any change here that touches it removes the comparison that
  made this diagnosable.
- 🔴 **A Response can only send once.** `submitContactForm` and `claimSite` both have two edges
  into one Response deliberately. Adding a failure edge to a Response that also carries the
  success path is legitimate and is *not* a duplicate — but it does mean an error after a
  successful send is silent again. Prefer a second Response node unless the `claimSite`
  reasoning (the contract already succeeded) actually applies.
- 🔴 **The artefact and the component set are two populations** — edit the set, regenerate, or
  `sb007Template.test.ts` reddens.
- ⚠️ A parameter is not a connection; the export filters wires and copies parameters verbatim.
- ⚠️ The 30s timeout is the backend's, not the browser's — a fix that merely answers faster
  without answering *correctly* still passes a naive "did it respond" check. Grade the status
  and the record, not the latency.
