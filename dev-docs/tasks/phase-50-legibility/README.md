# Phase 50 — Legibility (Track L: the review channel)

**Created:** 2026-08-06
**Status:** 📋 Specced, not started — 7 tasks. Post-alpha. Tasks are **[TASKS.md](TASKS.md)**
(LEG-001…007), written 2026-08-10.
**Origin:** [NODEGX-WHAT-IT-IS-FOR.md](../../reviews/NODEGX-WHAT-IT-IS-FOR.md) §7 item 1, and the
axis it comes from — [the spectrum](../../reviews/NODEGX-VS-CODE-THE-SPECTRUM.md) §2 and §7.

---

## ⚠️ Correction, 2026-08-10 — read [TASKS.md](TASKS.md) before this file

Everything below was written against a re-measurement that has since been done, and **the central
claim did not survive it.** Kept as written, because the reasoning about *why review is the control*
is the durable part and is unaffected.

What changed, measured across all 35 projects in `NodeGX test projects/` and all 65 `project.json`
in this repo:

- **Agent-authored graphs label 89.3% of their nodes** (1,003 of 1,123 across the eleven phase-55/58
  model runs; sonnet, deepseek and kimi each at 100%), with real labels — *"Gradient overlay"*,
  *"Three up, collapsing"*. `label` has been in the authoring vocabulary since AAQ-005
  (`authoringVocabulary.ts:143`) and it works.
- **`project-examples/agent-chat` is not agent output.** It was hand-built during AIX-005 on
  2026-07-27 (`b95eddb4`), before that vocabulary existed. Its 0-of-262 is a stale fixture, not a
  measurement of the agent, and the "one number" framing below rests on it.
- **Hand-authored graphs label 20.3%** (34 `library/` prefabs), which inverts LEG-002's polarity: the
  specced gate is aimed at the population that already complies.
- **What survives, and is sharper than the original claim: `metadata.comment` is empty.** One in
  2,045 agent-authored nodes; **zero** in 5,509 nodes across this repo. The mechanism is known —
  `metadata` is not in the authoring vocabulary and *"cannot be expressed in the editor at all"*
  (`SURFACE_DIVERGENCES`, AAQ-011 F14). That is LEG-001.
- **Three tasks are much smaller than budgeted**, because SUB-007, CAN-004 and `noodl-git` already
  shipped their substrate. Revised total ~2 weeks, not ~4.

Per-task corrections, including to exit criterion 2, are in the task files.

---

## The one number

**`agent-chat` — this repo's own demonstration of AI authoring — is 262 nodes with 0 labelled.**
Across all three complete example projects: 18 of 390 (4.6%).

That number breaks the platform's central promise. The product is not "an agent builds your app" —
plenty of tools claim that. It is *"an agent builds it and a non-engineer maintains it afterwards."*
The second half is what nothing else on the market offers, and **it is not currently kept by the
output**, because what the agent hands over is several hundred anonymous nodes.

## The mechanism — the substrate already exists

Same shape as [phase 41](../phase-41-accessibility/README.md)'s finding that four of six
accessibility primitives already had their port. Nothing here needs inventing:

| Capability | Where | State |
|---|---|---|
| Per-node comments | `NodeGraphNode.ts:653-663` — `metadata.comment`, with getter, setter and undo | **Built. Nothing produces one.** |
| Node labels | `label` on every node in `nodes.json` | Built. 4.6% usage. |
| Canvas comment regions | `models/commentsmodel.ts` | Built. |
| Comment/label/title export to code | [EXP-006](../phase-18-code-export-v2/EXP-006-EXPORT-AUTHORING-INTENT.md) | Specced. |
| Graph diff rendering | `VersionControlPanel/context/graphDiff.ts` | Built. Renders ids. |

So this is not a phase about building a documentation feature. It is a phase about **changing
defaults, requiring one thing of the agent, and making the existing fields load-bearing** — with a
check behind each. Cheapest phase on the roadmap per unit of envelope widened.

## Why this is the control, not the polish

⚠️ The built-world comparison argued that review friction was *"a human problem by definition"* and
therefore discountable in the agent case. **That was backwards, and it is the single worst line in
either comparison document.**

Review is not a cosmetic concern that humans happen to care about. **It is the channel that catches
the agent being wrong.** Every other verification mechanism on the roadmap — phase 46's tests, the
validator, the catalog — checks that the output is *well-formed*. Only a human reading a diff checks
that it is *what was wanted*. Degrading that channel to save the agent effort optimises the wrong
side of the loop.

## Tasks

| ID | Title | Est. | Notes |
|---|---|---|---|
| **LEG-001** | The agent names what it builds | 3 d | Authoring vocabulary: every non-trivial node carries a `label`; every node whose *purpose* is not obvious from its type and label carries a `metadata.comment`. **The highest-value three days on the whole roadmap** — it is a prompt change plus a validator rule. |
| **LEG-002** | An unlabelled graph is a diagnostic | 3 d | A `SemanticValidator` warning on unlabelled non-trivial nodes, in the same ProblemsPanel that already reports everything else. Blocking for *authored* output (the AAQ-009 `BLOCKING_WARNINGS` precedent), advisory for hand-built. Without this, LEG-001 is a suggestion the next prompt edit silently undoes. |
| **LEG-003** | The diff speaks English | 1 wk | `graphDiff.ts` renders `Button "Submit Order" → Navigate "Checkout"` rather than two UUIDs. Covers GraphDiffPanel and the Explain panel. |
| **LEG-004** | Readable diffs outside the editor | 4 d | A `.gitattributes` + `textconv` driver so `git diff`, `git log -p` and `git blame` render graph JSON legibly on the command line. ⚠️ **Honest limit: GitHub's web PR view does not run `textconv`**, so the browser case needs a rendered artifact or a bot and is explicitly out of scope here. Say which case is fixed rather than implying both. |
| **LEG-005** | The "why" has somewhere to live | 4 d | `metadata.comment` surfaced as a first-class row at the *top* of the property panel, not buried — the ACC-007 alt-text lesson (a port at `index: 1000` is a port nobody finds). This is where a décret citation or a "disabled for auto-entrepreneurs because…" goes. |
| **LEG-006** | Components describe themselves | 3 d | A component `description` shown in the picker, the Explain panel and the MCP `list_components` row. An agent instantiating a component should be able to read what it is for without reading its graph. |
| **LEG-007** | Labels survive paste | 2 d | Paste remints node ids (`NodeGraphNodeSet.ts:40`) — correct and necessary. But the **label and comment must be carried**, or duplicating a component produces a diff where nothing correlates *and* the copy is anonymous. |

**Total: ~4 weeks.** LEG-001 + LEG-002 alone (~1 week) close most of the gap and should not wait for
the rest.

## Deliberately out of scope

- **Auto-generating labels from node type.** `Button 3` is not a label; it is a UUID with extra
  steps, and it would make LEG-002's check pass while changing nothing.
- **Requiring a comment on every node.** Noise defeats the purpose. The rule is *purpose not obvious
  from type and label* — judgement, and the validator warns rather than blocks for hand-authored
  graphs.
- **A GitHub app or diff bot** (see LEG-004). Real, and a different phase.

## Exit criteria

1. An agent-authored page of 40+ nodes has a label on every non-trivial node, and a human who did
   not watch it being built can say what each does.
2. ~~`agent-chat` is regenerated and its label coverage is above 90% — the same fixture that
   currently reads 0 of 262, so the number is comparable.~~ **Struck 2026-08-11. It is not
   comparable.** The criterion assumed `agent-chat` was a sample of agent output. It is not: it was
   hand-built during AIX-005 on 2026-07-27 (`b95eddb4`), *before* the authoring vocabulary existed.
   Regenerating it would measure a current model, not anything this phase changed —
   `phase55-replay-sonnet` already reads 196/196 with no LEG task shipped, and eight of twelve model
   runs are at 100%. A criterion this phase would pass without doing any work is not a criterion.

   **Replaced by, measuring the arm LEG-001 actually closed:** one phase-55 fixture is re-authored
   with `metadata.comment` declared, and the share of nodes carrying a comment is compared against
   the **1-in-2,045** baseline. ⚠️ **Judged, not counted** — twenty of the comments are read and
   assessed in the register, because a run producing 100% coverage of *"This is a Group"* has failed
   this task while passing a coverage check.

   Regenerating `agent-chat` is still worth doing on its own terms — the repo's flagship
   AI-authoring demonstration having 0 labels and 0 comments is embarrassing — but it is **fixing a
   stale fixture, never evidence for this phase**.
3. A wire change in `git diff` on the command line names both endpoints.
4. Duplicating a component preserves every label and comment.
5. A décret-style citation has an obvious home in the property panel, and it exports (EXP-006).
