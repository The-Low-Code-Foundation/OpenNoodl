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

🔴 **`execution_steps` is empty for all three.** The table exists and nothing writes to it for
cloud functions, so the log can say *that* a function hung and never *where*. That is the second
half of why this took a whole drive to characterise, and it is worth its own line in §5.

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

🔴 **This is deliberately left open**, and the four refutations above are why: each one *fitted*
the evidence and each one was wrong. Wiring the failures is what makes the backend answer the
question; guessing a fifth time and wiring second would waste the measurement.

The remaining candidates, both now instrumented, are the query reporting `failure` (a zero-row
query against a class auto-created in that same second) and a code node's guard returning
because an input is still `undefined`. The guard case is the quieter of the two — a guarded
`return` is not a `failure`, so it will show as *no response and no failure either*, and the
gate in AC2 should be read with that in mind.

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

1. **A person sees the failure.** With the site-builder deployed, a Publish that cannot succeed
   answers in well under thirty seconds with a failure status, and the row's menu stops being
   busy. Driven, not asserted from the graph.
2. **A gate over the artefact**: every failure-capable node in every `#__cloud__` component
   either wires `failure` to a Response `send` or is exempted **by name with a reason**, in the
   shape SBR-004 §9.5 uses. 🔴 An exclusion list cannot fail — grade the reason column, and add
   a mutant that reds when an exemption is removed from a node that still needs one.
   ⚠️ The three worker components (`SetSectionAccess`, `CopySectionToPage`, `ContactRecipient`)
   have no Response node at all — they answer through the Run Tasks contract's failure output,
   so they are a legitimately different population and the rule must say which one it is
   grading rather than quietly widening to both.
3. **The original question is then answered**: with failures wired, re-run publish on a page
   with zero sections and record which node reports. AC3 of SBR-006 unblocks on this, and the
   answer goes in §2.3 — including the case where it turns out to succeed, which would make the
   zero-section path the whole defect.
4. **`execution_steps` either records cloud-function nodes or the task says why it cannot.** A
   log table that exists and is always empty is worse than no table: SBR-006 reached for it
   first, exactly as intended, and it could not separate "never called" from "called and
   failed".

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
