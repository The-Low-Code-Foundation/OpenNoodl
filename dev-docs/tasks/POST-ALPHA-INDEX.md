# Post-alpha index — the road from "alpha" to "why would I use anything else"

**Created:** 2026-08-06
**Origin:** [NODEGX-VS-CODE-A-REAL-APP.md](../reviews/NODEGX-VS-CODE-A-REAL-APP.md) — an objective
comparison against a real 250k-LOC SaaS, which concluded *"build it in code, the margin is not
close"* and then enumerated exactly what would change that verdict.

This file is that enumeration turned into phases. Its companions:
[the built-world comparison](../reviews/NODEGX-VS-CODE-THE-BUILT-WORLD.md) (what this index is
*for*), [the counter-review](../reviews/NODEGX-VS-CODE-THE-COUNTER-REVIEW.md) (a commissioned
adversarial read of both), and [the spectrum](../reviews/NODEGX-VS-CODE-THE-SPECTRUM.md) (both
positions, axis by axis — **the one to read if you read one**).

> ### ⚠️ Revised 2026-08-06 after adversarial review
> Estimates in this file went **up**, not down, and the revision found two omissions that matter more
> than any estimate. Read [§What this actually costs](#what-this-actually-costs) before the ordering.

## The six new phases

| Phase | Track | Weeks | Closes |
|---|---|---|---|
| [44 — The Compute Ceiling](phase-44-compute-ceiling/README.md) | M | ~6 | A cloud function can't import anything, **and two functions can't share a line of code**. Curated kit + danger mode + project `lib/`. |
| [45 — Streaming](phase-45-streaming/README.md) | S | ~3 | A cloud function can't emit a stream. Gates the entire AI-app category. |
| [46 — Verification](phase-46-verification/README.md) | V | ~7.5 (3.5 + 4) | Nothing can be proven. The one that makes the AI story honest. |
| [47 — Internationalisation](phase-47-internationalisation/README.md) | I | ~7 | No i18n at all — and the one axis where the graph beats code structurally. |
| [48 — The Data Ceiling](phase-48-data-ceiling/README.md) | D | **~12** | No vector search, no multi-collection reads, no schema history. ⚠️ DAT-002/006 re-estimated. |
| [49 — Discovery](phase-49-discovery/README.md) | W | **~6–7** | Sitemap, robots, JSON-LD — and ⚠️ **rewriting the SSR server**, which races on process globals and caches forever. |

Plus three already-specced phases that the comparison independently found load-bearing:

| Phase | Weeks | Why the comparison cares |
|---|---|---|
| [41 — Accessibility](phase-41-accessibility/README.md) | scheduled | The strongest *strategic* argument the platform has: correct output by emission, not by the author remembering. Currently the runtime emits one aria attribute and deletes every focus ring. |
| [18 — Code Export v2](phase-18-code-export-v2/PROGRESS.md) | 20–26 | Kills the lock-in objection outright, which is the first thing every technical evaluator raises. 0/7 built. |
| [26 — Deployment](phase-26-deployment/README.md) | ~7 | Today "deploy" writes a frontend folder and leaves the backend as a shell script you're expected to find. |

## Recommended order, and the reasoning

**Q1 — the unblocking quarter (~12 weeks).** 44 → 45 → 46 Tier 1.

Rationale: 44 is the cheapest item with the loudest demand and unblocks the most (three 🔴s in the
comparison). 45 is ~3 weeks and gates a *category* rather than a feature — no streaming, no credible
AI product. 46 Tier 1 is 3 weeks and converts every claim of correctness from assertion to proof.

⚠️ **The tension, named rather than hidden.** Imports before tests means the community gets a much
bigger foot-gun: the moment functions can import, the volume of untested logic in a NodeGX project
jumps sharply. Shipping 44 first is defensible on demand and cost, but **46 Tier 1 must land the same
quarter, not the same year**. Reversing the order is also defensible and nobody should fight about
it — what is not defensible is shipping 44 and letting 46 slip two quarters.

**Q2 — the differentiation quarter (~12 weeks).** 47 → 48 first half (DAT-001/002/003) → 49.

Rationale: i18n is where the substrate beats code rather than matching it, and it opens every
non-English market at once. DAT-001–003 closes RAG and multi-collection reads — the last two
capability 🔴s. 49 is small, mostly polish on an engine that already exists, and makes anything built
findable.

**Then, on evidence:** 46 Tier 2 (trace replay — also unblocks EXP-003), DAT-005 (Postgres, for
scale not capability), DAT-006 (schema history), 18 (code export), 26 (deployment).

Phase 41 keeps its scheduled slot ahead of all of this. It is a launch-quality problem, and the
comparison's judgement stands: a runtime that emits one aria attribute is a worse thing to ship than
a missing new capability.

## What this actually costs

⚠️ **The ~36-week figure above is not the bill**, and the first version of this file let that stand by
counting six phases while the built-world comparison evaluated **ten**. Complete:

| Phase | Estimate |
|---|---|
| 44 · 45 · 46 · 47 · 48 · 49 (revised) | **~41 wks** |
| [18 — Code Export v2](phase-18-code-export-v2/PROGRESS.md) | **20–26 wks, 0/7 started** |
| [26 — Deployment](phase-26-deployment/README.md) | ~9 wks serial ("5–6 realistic") |
| [41 — Accessibility](phase-41-accessibility/README.md) | **no task list, no estimate** |
| [40 — AI Authoring Quality](phase-40-ai-authoring-quality/README.md) | **no estimate; exit = "Richard judges"** |

**~70 weeks of estimated work plus two unestimated phases, at a team size of one.** Eighteen months
to two years, optimistically — and 40 and 41 are the two the built-world comparison leans on hardest.
Phase 40 supplies AAQ-007, which that document calls one of *"the two rows that mattered"* in the
entire agent argument, and it has the least defined completion condition on the roadmap.

**The calibration that should frame every decision here.** Communauté Coiffure's `git log`:
**2026-04-10 → 2026-08-06, 276 commits, one author.** Under four months to a live, deployed,
revenue-taking product with 54 tables, 63k LOC of Python, 211 components, an LLM assistant and an
NL→SQL analyst. So the proposition is: *spend ~70 weeks building a platform so the next app like that
one takes maybe 12 weeks instead of 17.* **For a portfolio, a good trade. For one app, a bad one.**

## The two things this index did not say, and should have

Neither appears anywhere in the three comparison documents, and an outsider named both within an hour.

### 1. Concentration risk — the sharpest version is not about the platform at all

`git shortlog`: **1,496 of 1,557 commits by one author (96%)**. 1,486 unpushed. `origin/main` last
moved **2025-09-09**. Nothing published to npm. A lineage — Noodl → OpenNoodl — already abandoned
once by a better-resourced owner, then dormant for fourteen months.

And: **the sole maintainer of NodeGX is the sole author of the app being evaluated.** Every week
spent here is a week not spent on the product. That is a calendar problem, not a supply-chain one,
and no phase in this index addresses it.

**The cheapest, highest-leverage item on this whole page is not a phase.** It is: publish to npm under
semver, push the branch, write a compatibility and EOL policy, and get a second maintainer with
commit rights. An adversarial reviewer put that alone at moving their confidence against adoption
from 95% to ~70%.

### 2. Two engineers cannot edit the same component

[`MergeConflicts.tsx:10-17`](../../packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/components/MergeConflicts.tsx)
— structural conflicts (a node one side deleted and the other edited, cross-side reparents, rewiring
against a deleted node) are *"shown for review and dismissed, not auto-applied."* You take one side of
the whole component and redo the other by hand. There is no browser editor and no collaborative
session, so the only concurrency model is git on an artifact git cannot three-way-merge structurally.

**The team size this tool currently supports is approximately one**, and that compounds with the AI
story rather than being rescued by it: an agent's characteristic output is a large structural change
to one component. **The property that makes agent authoring safe in isolation is the property that
makes it unmergeable in a team.**

This deserves its own phase and does not have one.

## What this does to the verdict

The comparison's own answer, re-stated as a checklist:

> With **44, 45, 46** and **48's first half**, the verdict for a real SaaS flips from *"code, not
> close"* to *"genuinely arguable"* — roughly a quarter of focused work.
> With **47, 49, 41 and 18** as well, it flips to *"probably NodeGX"*, because the platform's
> existing advantages do not go away when the gaps close.

## What none of this fixes

Worth writing down at the top of the road rather than discovering at the end. These survive
everything in this index:

1. **Canvas density — and the honest number is worse than this file first said.** The reference app's
   largest page is 4,129 LOC, which extrapolates to **700–1,500 nodes on one component**. For
   calibration, **the largest component ever authored in this repository is 83 nodes** (`agent-chat`,
   the AI flagship, 262 nodes across 7 components), and 78% of those are `Text` and `Group` — pure
   layout scaffolding. So the honest statement is not "graphs are poor at 600 nodes"; it is **nobody
   has ever tried.** Mitigated by AAQ-008, the Logic Builder and `lib/`; never eliminated.
   (The *renderer* is fine — PLAT-001 measured ~2,900-node corpora at 10.4ms. This is legibility.)
2. **Graph review — and this is the one to fix, because it is the control on the agent.** A wire in a
   diff is two raw UUIDv4s. And `nodes.json` does not rescue it: **18 of 390 nodes across this repo's
   complete examples carry a label (4.6%), and in `agent-chat` it is 0 of 262.** GraphDiffPanel
   narrows this *inside the editor, for the person who already has the project open*; GitHub's PR
   view, `git log -p`, `git blame`, `git bisect` and every reviewer on a phone see the raw artifact.
   ⚠️ **Downgrading this because "an agent doesn't mind an ugly graph" is backwards** — review is the
   channel that catches the agent. Labels-by-default and meaningful diffs are cheap and belong on
   this roadmap.
3. **Talent pool.** Any senior engineer maintains FastAPI. Far fewer read node graphs. Phase 18 is
   the mitigation — you can leave — not a cure.
4. **Type inference across the whole app.** A catalog and typed ports are not `tsc`. FH-019 gives
   intellisense inside a function; nothing gives end-to-end inference across a graph.

5. **No structural merge** (above). 6. **No compatibility contract** — a project records only
`runtimeVersion: 'react17' | 'react19'`; there is no catalog version and no runtime semver, so a
changed node default silently changes every deployed app's behaviour on next build.
7. **No path to multi-tenant hosting**, because cloud functions are unsandboxable by explicit
decision (MOD-005) — you can never host two customers' backends on one machine.

Numbers 1 and 2 are the honest permanent residue; 5–7 are permanent until someone schedules them. Any
pitch that pretends otherwise will be found out by the first serious engineer who tries it.
