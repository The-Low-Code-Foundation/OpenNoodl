# SBR-015 — A failure with nowhere to go

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

1. ⬜ **A person sees the failure.** With the site-builder deployed, a Publish that cannot
   succeed answers in well under thirty seconds with a failure status, and the row's menu stops
   being busy. Driven, not asserted from the graph.
   🔴 **Driven 2026-08-29 and it does NOT pass — see §2.3b.** The backend half is done: 30,004 ms
   became **19 ms** with `HTTP 400 This page could not be published.` The browser half was never
   wired — `/Admin/PageRow`'s three `CloudFunction2` nodes carry `done` and no `failure` — so the
   admin still sees nothing at all, for 47 s observed. The success arm through the same button
   closes the menu at 211 ms, which is the control proving the wiring and not the drive is what
   is missing.
2. **A gate over the artefact**: every failure-capable node in every `#__cloud__` component
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

## 4a. 🔴 AC2's population, measured — and it is already blocking someone else

**2026-08-29, s12.** DEF-002 §2 landed a rule (`b91d696a`): in a cloud function, a `failure`
edge that reaches no `noodl.cloud.response` is reported by `validate_project` /
`validate_component`. Its author tried promoting it to `AUTHORED_BLOCKING_WARNINGS`, hit **8
failing specs** across `sb007Template` / `sb004Authoring` / `tpl001Template`, and read them as
*"publishPage, duplicatePage and submitContactForm really do leave failure edges unanswered"*.

**They do not.** Counting, over the shipped artefact, `failure` wires whose target is not a
`noodl.cloud.response`:

| component | responses | `failure` wires | **not → response** |
|---|---|---|---|
| `publishPage` | 2 | 5 | **0** |
| `duplicatePage` | 2 | 8 | **0** |
| `submitContactForm` | 1 | 2 | **0** |
| `claimSite` | 2 | 6 | **0** |
| `site/SetSectionAccess` | 0 | 1 | **1** |
| `site/CopySectionToPage` | 0 | 1 | **1** |
| `site/ContactRecipient` | 0 | 1 | **1** |

The component set agrees with the artefact (`sb004Components.ts:419–431`, `:737–…`): endpoints
go `failure → deny.send`; the three workers go `failure → outputs.Failure`. Both populations,
same answer.

🔴 **So the templates are not the blocker — the rule's population is.** The endpoints were
repaired at `48ad4dfc`. The only three offenders have **no Response node at all**, by design:
they answer through the Run Tasks contract's failure output, which is what
`failure → Component Outputs.Failure` *is*. Three workers × three regeneration paths ≈ the 8.

**Promoting the rule as written would demand a "fix" to three components that are correct.** AC2
above already names those three and says the rule *"must say which one it is grading rather than
quietly widening to both"* — this is that warning arriving as a real cost, in someone else's
lane, before the gate was even written here. ⚠️ Whoever writes AC2's gate and whoever promotes
DEF-002 §2 are writing **the same predicate**; write it once.

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
