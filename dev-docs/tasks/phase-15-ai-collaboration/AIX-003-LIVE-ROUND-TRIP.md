# AIX-003 — the live author → review → partially-accept round trip

**Date:** 2026-08-02
**Model:** `claude-sonnet-5`, effort `low` (AIX-007's measured default)
**Spend:** $2.39 across 13 sessions
**Harness:** `packages/noodl-editor/scripts/aix15-live/`, `--mode=changeset`
**Artifacts:** `measurements/live/changeset/` + `measurements/live/changeset.jsonl`

AIX-003 shipped with four residuals. This closes the fourth — *"real end-to-end:
author with a live provider → review → partially accept"* — and produces the
artifact the second one (the 40+ node fresh-reviewer test) needs from a machine
before a human can do their half.

It is worth being precise about what kind of evidence this is, because the
properties tested here were already asserted. `tests/ai/authoring-apply.test.ts`
proves that all-accepted reproduces the proposal, that rejection closes over the
dependency edges, and that a partial result passes the SUB-006 gate. What it
cannot prove is that any of that survives a diff **nobody authored to be
reviewable**. Fixture proposals are written by the same hand as the assertions:
short explicit ids, one change per intent, new nodes appended at the end. A model
revising a real card does none of those things, and three of the four findings
below are exactly that difference.

---

## What was run

`--mode=changeset` drives the whole chain headlessly: a live `AuthoringSession`
against a real project component, then `buildChangeSet` → the closure
(`requiredWith`/`excludedWith`) → `materializeSelection` → the same
`validateCandidateComponent` gate the Build panel runs before staging. Nothing is
applied to a project; the run stops where the panel stops before a human presses
Accept.

Per proposal it then sweeps, in local compute:

- **all-accepted**, checked through the diff engine's own equality (zero changes
  between the materialized files and the proposal);
- **every single-change rejection** — each excludable change rejected on its own,
  closed, materialized and gated;
- **40 seeded random subsets** (seed `0x0a1c0003`, in the record);
- **a falsifier**: the same rejection through a change set with its `requires`
  edges stripped, so a closure that happens to be doing nothing on this diff says
  so instead of reading as a pass;
- **a relabel probe** (no API cost) on a kind neither corpus project contains.

Four scenarios, three to four samples each. `account-card` and `share-popup` are
updates to real components of the corpus project (19 and 40 nodes);
`notification-prefs` and `settings-page` are new components, which is where the
all-`Created` closure lives.

| Scenario | Samples | Base → proposed | Changes | Max closure | Independently rejectable | Single-rejection failures |
| --- | --- | --- | --- | --- | --- | --- |
| `account-card` (update) | 4 | 19 → 24–25 | 12–15 | 4 | 7–9 | 0 |
| `share-popup` (update) | 3 | 40 → 40–41 | 12–20 | 1–4 | 12–18 | **5 every time** |
| `notification-prefs` (new) | 3 | 0 → 15–18 | 27–33 | 23 | 15–18 | 0 |
| `settings-page` (new) | 3 | 0 → 38–46 | 40–48 | 38–46 | 26–30 | 0 |

---

## Four findings, three of which no fixture could have produced

### 1. A fully accepted proposal came out with its new rows in the wrong place

**The headline.** The first `account-card` run failed the criterion the notes call
settled: *all-accepted reproduces the proposal exactly*. The materialized graph
differed from the proposal by two `node-reordered` changes — the two Groups the
model had inserted rows in front of.

The mechanism is that `childIndex` is a per-parent number and every change carries
the index from **its own side of the diff**. An added node arrives with the
proposal's index (`joinedDate` at 1) while the neighbours it displaced still hold
the base's (`336e8f68` also at 1). Nothing in the diff reconciles them, because
`diffGraphs` correctly emits no `node-reordered` for the displaced children — on
the proposal's side those children never moved, an insert simply pushed them
along. Left alone the two numbering schemes collide and `orderedChildren` breaks
the tie on node id.

Every fixture in the spec suite appends its new nodes at the end of the parent, so
the two schemes never collide there. A model asked to *"show the join date
underneath their name"* inserts in the middle, which is the only way to satisfy the
request.

The consequence is not cosmetic. Sibling order **is** layout in a Group: accepting
the whole of a reviewed proposal could put the new row somewhere other than where
the review canvas showed it. Fixed in `materializeSelection` by rebuilding sibling
order after the selection is applied (`reindexChildren`) — the proposal's order for
everything it places, with anything kept from the base that the proposal does not
have (a rejected removal, a rejected reparent, an explicitly rejected reorder)
slotted back behind the base sibling it used to follow.

Verified twice: replaying the exact proposal that exposed it
(`changeset/account-card.order-defect.candidate.json`, kept for that reason) now
materializes with zero residual, and three subsequent live `account-card` runs —
all of which interleave — reproduce their proposals exactly. Three new specs pin
it, including the rejected-reorder case, which is the one the fix could plausibly
have broken.

### 2. Some changes cannot be rejected, and the change set has no way to say so

`share-popup` produced the same result in all three samples: **five of its
single-change rejections make the whole selection invalid at the gate**, and
29–32 of 40 random subsets with it. That is not a closure defect. The closure is
correct; the dependency is of a kind `requires` does not model.

`/Pop-ups/Share/Share Popup` contains five nodes whose types are not in the
catalog — one `Markdown` and four `module.inlineHtml`. Update mode hands the model
the base component and the model resubmits it, so the SUB-006 strict gate rejects
the first submit over node types **the base already had**. Every session recovered
the same way: rewrite those five nodes into catalog types. Which means the review
the user is shown is dominated by work they did not ask for — in one sample, 16 of
17 rows were the rewrite and one was the requested feature — and then:

- the rail says each of those rows is independently rejectable (`requires: []`),
  because structurally it is;
- rejecting one restores an unknown node type;
- the Build panel refuses the *entire* selection with an error naming a node the
  reviewer never touched.

A reviewer's only correct move is to accept a rewrite of five nodes they did not
ask about. That is a legibility failure of the exact kind the spec's risk table
worries about ("large change sets are unreadable, so users blind-accept"), reached
by a different route than the one it anticipated.

Filed, not fixed — it needs a decision, not a patch. The candidates are: teach the
change set semantic requirements (a change whose rejection re-introduces a gate
error requires the changes that fixed it), and/or mark gate-forced repairs
distinctly in the rail so the reviewer can tell "you asked for this" from "I had
to do this to submit at all". Both are AIX-002/AIX-003 design questions.

Five other corpus components carry the same unknown types (`/Pop-ups/Privacy/Terms
of Use Popup`, `/Pop-ups/Sign in or Sign up /Sign up`, `/Visual
Components/Article/Article`, `/Visual Components/Article/Reference Component`), so
this is a property of update mode on real projects, not of one popup.

### 3. Wire labels never reach the diff, because the v2 layer drops them

CAN-002 added `connection-relabelled` as a semantic change, and SUB-007 handles it
properly — `normalizeConnection`/`denormalizeConnection` carry `label` and
`labelT`, and `GraphDiff` compares them. AIX-003 predates it and never caught up:

- `rawChangeId` had no `case` for the kind, so a relabel's change id was
  `undefined` — the key the rail, the closure and the rejection set all use, and
  two of them would have collided on it;
- `applyChange` had no case either, so an **accepted** relabel was silently
  dropped: all-accepted did not reproduce the proposal (measured, on a probe over
  a real proposal: residual `[connection-relabelled]`);
- `buildReviewComponent` gave it no annotation, so the one row in the rail about
  meaning was the one with nothing to look at on the canvas.

Chasing why the probe could not be reached through the product path found the
larger defect underneath: **`io/ProjectExporter.buildComponentV2Files` and
`io/ProjectImporter.reconstructLegacyComponent` both copy only the four endpoints
plus `annotation`**. A wire label does not survive a v2 export → import round
trip, and since both sides of the AIX-003 diff go through that serializer, a
relabel was unreachable in review no matter what the adapter did. The same path is
used by AI staging, project export/import and library import.

All four are fixed (adapter id, materializer, review annotation, and the
exporter/importer carry, with `label`/`labelT` declared in
`connections.schema.json`), with two specs. What is *not* verified is that a
labelled wire authored on canvas today survives a full export→import in the
running editor — that needs the editor, which this pass deliberately did not
touch.

Also worth recording: `buildCandidate` maps connections to the four endpoints too,
so an agent cannot author or preserve a wire label. Left alone — the tool schema
does not offer labels either, so carrying them would mean copying from the base by
connection key, which is an AIX-002 design decision.

### 4. The closure does real work, and the sweeps say so

On both new-component scenarios the falsifier fires hard. Rejecting the root Group
of the `settings-page` proposal closes to 46 of 47 changes and materializes to a
valid one-node component; the same rejection with `requires` stripped leaves a
dangling wire and fails the gate. `notification-prefs` is the same shape with 11
dangling wires. Across all thirteen sessions, **no kept change ever survived with
a rejected requirement, and no materialized selection introduced a dangling
connection or an orphaned node** — 318 single-change rejections and 520 random
subsets.

The one honest caveat: on the `share-popup` samples the closure had almost nothing
to close over (max closure 1 in two of three), because a diff made entirely of
in-place modifications has no structural dependencies. The falsifier reports that
as "untested by this diff" rather than as a pass, which is the point of having it.

---

## The fresh-reviewer artifact (residual 2)

`measurements/live/changeset/settings-page.review.md` is a real 38-node,
40-change proposal rendered through the product's own change-rail presentation
(`presentChanges` / `summarizeChanges` / `describeSide` from
`graphChangePresentation.ts` — not a formatter written for this document). The
request that produced it is in `settings-page.request.md`, deliberately separate:
a spoiler at the top of the page answers the question the test asks.

**For whoever runs it:** read `settings-page.review.md` only, say what happened,
then read `settings-page.request.md` and judge whether the review told you. The
same pair exists for `share-popup` (a modification rather than a creation, and the
more interesting one — the request is three small things and the review is
dominated by finding 2's collateral).

This does not close residual 2. It removes the excuse.

---

## Stale premises found on the way

- **`--model=` is now required.** `LIVE-PROVIDER-PASS.md`'s reproduce block omits
  it, but the Anthropic provider throws `No model specified for the Anthropic
  provider.` when the flag is absent — the registry default is applied by the
  panel, not by `chatStream`. Every mode is affected, not just this one.
- **Saved candidates are only valid against the catalog of their run.** Replaying
  2026-07-27's `update/pill-dot.candidate.json` reports an error today, because
  ERG-001's outcome contract renamed `CollectionInsert.modified` to
  `completed/done/error/failure/unchanged` in the intervening week. The proposal
  was correct when it was made. The harness therefore judges every selection
  against the proposal's *own* gate result rather than against "valid", so a
  drifted baseline can never be read as a review defect.
- **A lead on AIX-011's unexplained `update /App` failures.** `/App` has no `id`
  in the corpus project, so `buildComponentV2Files` produces base files with no
  `id`/`componentId` and all three of them fail the Ajv structural check. That is
  the base handed to an update session, not the candidate, so it is a lead rather
  than a diagnosis — but it is the only corpus component that fails structurally,
  and it is the one that failed twice.

---

## Gates

`npx tsc --noEmit` clean · `npm run test:ci` **2022 specs, 0 failures** ·
`npm run catalog:check` green (153 node types).

Worth recording for the next worktree: the Git suites need
`packages/node_modules/dugite` to exist (a symlink to the root `node_modules`
copy), which `git worktree add` does not create — without it three specs die on a
missing git binary. And running the suite alongside another heavy job killed the
renderer mid-git-spec once; alone, it passes.

## Reproducing

```bash
node packages/noodl-editor/scripts/aix15-live/build.mjs
node packages/noodl-editor/scripts/aix15-live/dist/aix15-harness.cjs \
  --mode=changeset --model=claude-sonnet-5 --only=settings-page
```

`--mode=changeset` is AIX-003's graph-native review of a change. `--mode=review`
is AIX-010's project-docs review. Different features, same English word.
