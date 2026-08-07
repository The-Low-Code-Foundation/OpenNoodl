# Phase 27 — what is left, and what each piece needs

**Rewritten 2026-08-02, after the closing batch.** The findings register in
[PROGRESS.md](./PROGRESS.md) says *what is wrong*; this file says *what closing each one takes*, so an
unowned row is a decision waiting rather than a paragraph nobody can act on. Every item was
re-verified on the date given, by running the check named. Where the previous version of this file was
**wrong**, it says so.

Sizes are honest estimates for someone who has not seen the code: **S** ≈ half a day, **M** ≈ 2–4
days, **L** ≈ a week or more.

---

## The phase's own work is done. Its verification is not.

All nine tasks are built. **Nothing in WFA-007 or WFA-009 has been driven in the running editor**,
because the checkout's editor belonged to a concurrent session for the whole of 2026-08-02, and two
sessions driving one Electron read each other's panels as defects. This is the largest open item in
the phase, and it is not a formality: every task here that ran a live pass found defects its own green
suites did not — WFA-001 found two, WFA-002 three, WFA-005 two, WFA-008 two, one of which **destroyed
a one-time secret**.

| What | Where the script is | Size |
|---|---|---|
| **WFA-007 live pass** — 9 ordered steps with exact tool calls, which panel, which button, expected result. Includes the two failure modes to watch for (step cards rendering as red unknowns = the library was not installed before the document opened; and the closure greying out dependent rows) and the unregressed-AIX-003 check | [WFA-007-NOTES.md](./WFA-007-NOTES.md), "Could not verify" | **S**, if the editor is free |
| **WFA-009 live pass** — 8 numbered steps. The headline ones: a name typed into `params` makes the port appear **with no backend running**; the Request mirror; `status = failure` hides them; the full author→wire→deploy→read-body loop, whose runtime half is proven and whose authoring half is not; and a workflow step reading `previous.result.total` from an editor-authored function — what WFA-003's `$path` was built for, and still never demonstrated end to end | [WFA-009-NOTES.md](./WFA-009-NOTES.md), "Could not verify" | **S–M** |
| **The 6 Jasmine specs WFA-007 added** typecheck but have **never executed** — `test:ci` launches Electron, which was off limits. They are the only automated cover for the review surface | `packages/noodl-editor/tests/workflow/workflowproposal.test.ts` | **S** |
| **F26's live check** — four menus to open, and one (the comment node) that must *still* be an eight-row gutter box. If it lost the gutter, that is the regression | [PHASE-27-SMALL-FIXES-NOTES.md](./PHASE-27-SMALL-FIXES-NOTES.md) | **S** |

---

## Unowned findings, and what each needs

### F66 — the editor runs a prebuilt backend bundle that nothing rebuilds

**New, 2026-08-02.** A dev-launched editor spawns `packages/nodegx-backend/dist/index.js`, and no
launch step rebuilds it. During this pass the route WFA-007 had just added answered *"Not found"* on a
freshly started backend, from a bundle a day old.

**Size: S.** What it needs is either a rebuild in the editor's backend-spawn path or a loud staleness
check — comparing the bundle's mtime against the package's newest source would do. Until then, **every
backend live pass must run `npm run build` in `packages/nodegx-backend` first**, because an unbuilt
change is indistinguishable from an unwritten one.

### F68 — a proposal that omits a server-defaulted field reads as changing it

**New, 2026-08-02.** A candidate that left out `concurrency` produced *"Changed
metadata.concurrency: 1 → (unset)"* in the review, beside the real changes.

**Size: S.** What it needs is a decision about where the default lives: either the change set ignores a
field the candidate never mentions, or `normalize` fills it before diffing. Cosmetic today, but the
review surface's whole value is that a reviewer reads every line — a class of change they learn to
skim is a real cost.

### F62 — `noodl.cloud.aggregate` cannot be configured or fired at all

**New, 2026-08-02**, found by WFA-009 while answering "what happens to the other node with this hook".
It carries four ports in the editor (`aggregates`, `fetched`, `failure`, `error`) and has no
`collectionName`, no `Do` signal and no filter.

**Size: M.** What it needs is a WFA-005-shaped task of its own: the node needs its parameters and its
signal before value-derived ports mean anything. WFA-009 deliberately left it alone rather than
furnish a node you still cannot run — giving it ports would have satisfied a success criterion while
leaving the node unusable, which is the worse outcome. It belongs in the `AggregateRecordsAdapter`
that already exists for the type.

### F65 — three suites are red on `cline-dev`, and a CI job is red with them

**New, 2026-08-02**, verified at the merge base so the attribution is not a guess: `nodegx-backend`'s
`email-flows.test.ts` fails 2 tests on 30-second timeouts in the Send Email node's `WorkflowRunner`
integration, and `noodl-mcp`'s `tools.test.ts` fails `create_component validates, writes and updates
the registry`. Both suites are in `test:packages`, a required CI job.

**Size: S–M, and it is BAK-002's and the MCP owner's, not this phase's.** What it needs first is
someone to say whether the email timeouts are a real regression or a fixture that stopped resolving —
30 seconds is the jest default, so it is a hang, not an assertion.

### F55 — the TSFixme / `any` ratchet is red, with a long-stale baseline

**Still open, and now measured rather than estimated.** The 2026-08-02 batch ran the ratchet at the
merge base and after merging all three branches: **18 entries both sides, identical lists.** So this
phase adds nothing to it — every marker belongs to other sessions' recent work.

**Size: S to re-pin, M to do it honestly.** What it needs, in order, is unchanged:

1. **A tree nobody else is dirtying.** The gate writes every uncommitted `.ts/.tsx` file into the
   baseline as if it were part of that commit. The checkout was shared all through 2026-08-02, so this
   still cannot be done — the only item here blocked by *when*, not by *who*.
2. **Someone who can say which markers are intended.** PLAT-004's rule is that the baseline is raised
   *deliberately and said so*, not laundered. A genuine escape hatch stays and is documented in
   [TYPE-ESCAPE-HATCHES.md](../../reference/TYPE-ESCAPE-HATCHES.md); a to-do gets fixed or filed.
3. **A commit of its own**, touching only `.tsfixme-baseline.json`.

Until then the gate is red for everyone, which is its own cost — and F63 is what that costs. CI's
`typecheck` job had been failing since SUB-007 and nobody saw it, because no branch reaches the
workflow that runs it.

### F61 — an out-of-process write does not reach an open canvas

**Unchanged, and still deferred — but its condition has arguably been met.** `TRIGGERS_CHANGED` lives
on `TriggerBackendClient`'s write functions, so MCP or `curl` changing a trigger leaves the entry
nodes stale until the Workflows panel refreshes.

**Size: M.** This file set the condition "wait for a second consumer of the same signal" on
2026-07-28. WFA-007 now gives MCP a second way to change what a canvas is showing — a staged proposal
— so a `triggers`/`workflows` topic on BAK-001's `ChangeBus` would close it for every surface and
every writer at once. **Meanwhile it is not silent:** Refresh re-reads deliberately, and
`backend:statusChanged` covers a backend starting, stopping or dying.

### F60(b) — the panel-hide fix is verified live only

**Unchanged.** `ModelBindings` needs a real `NodeGraphEditor` and the editor suite has no harness for
one.

**Size: M**, and it is really a request for a *harness*: a headless `NodeGraphEditor` over a
`NodeGraphModel` would make this and the whole selection/panel policy testable. **Four** tasks in this
phase have now wanted it — WFA-004, WFA-006, WFA-008, and WFA-007, whose six Jasmine specs exist only
because there was nowhere else to put them.

---

## Closed since the last version of this file

- **F26** — closed 2026-08-02. The previous entry's call-site list was wrong in both directions:
  `PropListType` and `StringListType` no longer call the popup at all (ERG-003 §3), and two callers it
  never knew about do. **Five sites, not four**, found by grepping rather than trusting the list.
- **F27** — closed by WFA-009, 2026-08-02, and the corrected diagnosis it carried was itself wrong on
  the point the whole §1 decision rested on. See PROGRESS.md.
- **F36** — closed 2026-08-02, having gone green *and red again* in between: it was green when the
  batch started, then `62fdc4ec` changed the generator without regenerating the artefact. This file's
  instruction to "do it before WFA-009 regenerates the same file" was sound and is now moot. The
  standing lesson is the gate's own — **a file generated by one commit and committed by another will
  keep going stale**; the fix is to regenerate and require an empty diff after every merge, not to
  remember.
- **F37** — closed as **data, not code**, 2026-08-02. Three writers ruled out repo-wide, a spec that
  drives the real schedule path added, and `countOrdercountOrderss` identified as an anagram of
  `countOrderscountOrders` — a hand-transcription of `name + name`. The backend that produced it is
  gone, so it cannot be settled further.
- **F63 / F64** — new and already fixed; recorded in PROGRESS.md because both are lessons about gates
  rather than about this phase.
- **F55** — closed 2026-08-02. The first clean tree since 07-28 made the re-pin honest; raised
  deliberately with the reasons per cluster, TSFixme unchanged at 539, and the generated
  `TYPE-ESCAPE-HATCHES.md` regenerated so the gate and the targeting document agree.
- **F57** — closed 2026-08-02, and it never needed the human click. `elementFromPoint` at the
  toggle's centre returned the faux div, not the input: a **PAR-002 regression** that left every
  boolean in the property panel and every settings toggle mouse-dead for a week. The lesson is worth
  more than the fix — "a synthetic click did nothing" was treated for five days as possibly an
  artefact of driving, when one hit-test would have settled it.
- **F67** — accepting a proposal left the panel advertising it; fixed and verified live.

## What is deliberately not here

- **Durable / resumable workflow runs** — WF-001's headline residual, out of phase 27's scope and
  unchanged by it.
- **DEP-002 / DEP-005 promotion of workflows to a production backend** — a phase-26 conversation.
- **`db-change` filter authoring** — out of scope since WFA-005 and still out.
- **Reviving the three other dynamic-port managers** (`numbered`, `portchannel`, `expand`) — WFA-009
  added one rule and did not resurrect the commented-out block; that remains a separate, larger
  question about machinery nothing has needed for two years.
