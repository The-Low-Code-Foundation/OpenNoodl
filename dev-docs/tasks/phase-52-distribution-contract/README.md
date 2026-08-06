# Phase 52 — The Distribution Contract (Track P: becoming dependable)

**Created:** 2026-08-06
**Status:** 📋 Specced, not started — 7 tasks. Post-alpha.
⚠️ **Mostly not engineering**, and that is the point. Roughly a third of this phase is measured in
hours and is the highest-leverage work anywhere on the roadmap.
**Origin:** [the counter-review](../../reviews/NODEGX-VS-CODE-THE-COUNTER-REVIEW.md) §B.1 and §B.5 —
the largest omission in three comparison documents, none of which contained the words "maintainer",
"bus factor", "fork" or "abandoned".

## The position, measured

| | Value |
|---|---|
| Total commits | 1,557 |
| By one author | **1,496 (96%)** |
| Next contributor | 27 |
| Unpushed vs `origin/main` | **1,486** |
| Last commit on public `origin/main` | **2025-09-09** |
| Published npm packages | **none** — `@noodl/runtime`, `@noodl/mcp`, `@noodl/nodegx-backend` all 404 |
| Commits 2024-12 → 2026-01 | **5, across 14 months** |
| Platform version contract | `runtimeVersion: 'react17' \| 'react19'`, and nothing else |

The lineage: Noodl, commercial, discontinued by its owner → OpenNoodl, the GPL fork, opened Jan 2024
→ dormant fourteen months → revived. **The platform has already been abandoned once by a
better-resourced owner**, which is the fact every technical evaluator will find in ten minutes and
which no feature answers.

## Why this is a fitness-envelope phase and not housekeeping

[The envelope](../../reviews/NODEGX-WHAT-IT-IS-FOR.md#1-the-fitness-function-as-thresholds) has a row
called *blast radius*: green is "rewritable in weeks", red is "the company dies". That row —
**not any capability** — is what currently excludes the most valuable category of project. An agency
will not put a client's operations on an unpublished branch. A council will not procure it. A
founder should not bet on it.

Nothing else on the roadmap moves that row. This phase is the only thing that does, and most of it
is not code.

## The sharpest version, which no task can fix

**The sole maintainer of NodeGX and the sole author of Communauté Coiffure are the same person.**
Every week spent on a phase is a week not spent on the product. That is a calendar problem, not a
supply-chain one, and it is the strongest argument for **doing the cheap items in this phase first**:
they buy credibility per hour better than anything else available.

## Tasks

| ID | Title | Est. | Notes |
|---|---|---|---|
| **PUB-001** | Push the branch | **hours** | 1,486 commits exist on one laptop. Nothing else in this repo is a single-point-of-failure of that size, and the fix is `git push`. Do this before reading further. |
| **PUB-002** | CI runs on the branch people use | **hours** | `.github/workflows/pr.yml` triggers on `main` and `cline-dev`. The gates are good — typecheck, lint, four suites, catalog freshness, library check, artefact check — and **they have not seen 95% of the code they gate.** |
| **PUB-003** | Publish the runtime packages | 1 wk | `@noodl/runtime`, `@noodl/nodegx-backend`, `@noodl/mcp` to npm under semver. Turns "vendor a git SHA off a branch" into "pin a version". Prerequisite for every other claim about dependability. |
| **PUB-004** | A compatibility contract | 1.5 wks | Today a project records `runtimeVersion: 'react17' \| 'react19'` and nothing else. **No catalog version, no runtime semver, no compatibility range.** So fixing a node's default — *this repo's most-repeated recorded trap* — silently changes every deployed app's behaviour on next build. Stamp catalog + runtime version into the project; declare a supported range; refuse or warn on mismatch. |
| **PUB-005** | A changelog a project author reads | 3 d | Not a commit log. "What changed that could alter how your app behaves" — node defaults, port semantics, validator rules. PUB-004 makes it enforceable; this makes it legible. |
| **PUB-006** | A written support and EOL policy | 2 d | Which versions are supported, for how long, what a breaking change means, how a security fix reaches a deployed app. Two days of writing that changes a procurement conversation. |
| **PUB-007** | Bus factor | — | **Not schedulable by me and stated anyway**: a second maintainer with commit rights who has landed non-trivial work. An adversarial reviewer put this item *alone* at moving their recommendation against adoption from 95% to ~70% confidence — a larger swing than any feature on the roadmap. |

**Total: ~4 weeks of work, of which PUB-001 and PUB-002 are hours.**

## The React problem this phase inherits

PUB-004 has to resolve something already shipping. **Three React versions are live in one product's
surface:**

- `react17` is still a supported `runtimeVersion` — and React 17 is EOL
- `react19` is what the repo resolves and what new projects declare
- **`react@^18.3.1` is pinned in the SSR template's `package.json`**, so a React-19 project is
  server-rendered by ReactDOMServer 18 and hydrated by 19 (see
  [phase 49](../phase-49-discovery/README.md) DIS-004)

A compatibility contract that does not answer "which React am I actually running" is not a contract.
Coordinate with phase 49.

## Deliberately out of scope

- **A foundation, governance model or trademark policy.** Real, later, and premature at one
  maintainer.
- **Paid support tiers.** A business decision, not a phase.
- **Resolving the GPL-3.0 (root, editor) vs MIT (runtime packages, `noodl-viewer-react/LICENSE`
  © Future Platforms AB) question.** The practical answer is probably benign — editor GPL, shipped
  runtime MIT, so an app built with it is uninfected — but it is unresolved *in the repo* and an
  acquirer's IP diligence will make you resolve it in writing, with a lawyer, on their timeline.
  **Worth an hour with a solicitor long before that meeting**, and that hour is not a task here.

## Exit criteria

1. `origin/main` (or the public default branch) is what people build against, and CI has run on it.
2. `npm view @noodl/runtime version` returns a number.
3. A project records the catalog and runtime version it was authored against, and opening it under a
   newer platform says what changed.
4. A node-default fix appears in a changelog before it appears in someone's app.
5. A written answer exists to *"what happens to my app if you stop working on this"* — and it is not
   "phase 18 will be finished eventually."
