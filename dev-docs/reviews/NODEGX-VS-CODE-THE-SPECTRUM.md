# The spectrum: NodeGX vs. code, both positions, axis by axis

**Written:** 2026-08-06. **Supersedes the verdicts** in
[NODEGX-VS-CODE-A-REAL-APP.md](NODEGX-VS-CODE-A-REAL-APP.md) and
[NODEGX-VS-CODE-THE-BUILT-WORLD.md](NODEGX-VS-CODE-THE-BUILT-WORLD.md) — their evidence stands, their
single-voice conclusions do not.

## Why this document exists

The first two comparisons were written from inside this repo, using its own docs as evidence. Richard
called the bias and commissioned an adversarial counter-review
([NODEGX-VS-CODE-THE-COUNTER-REVIEW.md](NODEGX-VS-CODE-THE-COUNTER-REVIEW.md)) from a reviewer briefed
to find roadblocks rather than be fair. **I independently verified every load-bearing claim in it.
All of them held.** Including the ones that make my own work look worst.

So each axis below carries three things: the **soft** position (mine, from the first two documents),
the **hard** position (the counter-review's), and **where I now land** having checked. Sometimes I
land on the skeptic's side. Twice I land past it.

## The bias, named precisely — because it was not the one I expected

I assumed my bias was enthusiasm. It was not. It was **asymmetric verification**.

The "today" document claimed NodeGX had no SSR. That was wrong; I found the machinery, corrected it,
and drew the lesson *"I was too pessimistic — re-check the 🔴s."* The counter-review drew the right
one: **I trusted a capability's existence as proof of its quality.** So I verified every pessimistic
claim in source and took the optimistic ones on trust.

SSR exists. It also:

| Defect | Evidence, re-verified by me |
|---|---|
| Mutates `globalThis.location` per request inside an awaited settle loop → two concurrent requests render each other's routes | `static/ssr/server-core.js:53-59`, `render-gate.js:33-53` |
| `new NodeCache()` with no TTL, `set()` with no expiry, keyed on path alone → renders once, serves that HTML until restart | `static/ssr/index.js:10-17, 83-84` |
| `app.get('*')` renders any path with no validation or rate limit → unbounded cache growth from a `curl` loop | `static/ssr/index.js:79` |
| Pins React 18.3.1 while the repo resolves 19.0.0 → React-19 projects server-rendered by ReactDOMServer 18, hydrated by 19 | `static/ssr/package.json` vs `node_modules/react` |

I turned a false negative into a false positive, and the false positive was worse because it was
labelled a correction. **Every ✅ in the original tables deserves the treatment the 🔴s got.** Only
one has had it.

---

## The axes

Each row: **◀ hard-skeptic** … **soft** ▶, then where I land.

### 1. Time to first working app

- **Soft:** NodeGX ~30–40% faster to a working multi-tenant app with auth, 60 screens and CRUD.
- **Hard:** Faster to a demo, par to a *correct* app, and the comparison is meaningless — comcoi went
  from empty repo to deployed paying product in **under four months with one person** (276 commits,
  first 2026-04-10, verified). The plumbing was never the constraint. And the platform's own AI path
  produced *"basic shit creations"* six weeks ago.

**Where I land: with the skeptic, and this is the single most useful thing the review produced.** I
never calibrated against how long comcoi actually took, and it invalidates the framing rather than
the number. "30–40% faster on the plumbing" is probably true and answers a question nobody asked. The
honest form: **NodeGX saves weeks on the 70% that was never expensive.**

### 2. Long-term maintenance, years 2–5

- **Soft:** Worse — canvas density and review friction, mitigated by components-by-default and `lib/`.
- **Hard:** Much worse, and the mechanism is *comprehension*, not volume. 4.6% of nodes in this
  repo's own examples carry a label; **`agent-chat`, the AI flagship, has 0 of 262 labelled**
  (verified). The RGDU function's asset is not its six lines of arithmetic — it is the forty-five
  lines of décret citation, reform changelog and documented precision compromise around it
  (`social_charges.py:234-293`). A wire has no comment field.

**Where I land: with the skeptic, and past them on one point.** The "nowhere to put the why" argument
is stronger than anything in my documents and I missed it entirely. I would add: this is not
inherent to graphs — node comments exist and EXP-006 specs their export — it is that **nothing
requires or rewards them, and the AI path produces none.** That makes it a fixable defect rather than
a property of the representation, which is a better framing for the roadmap and a worse one for
anyone shipping today.

### 3. Density and canvas legibility

- **Soft:** A 1,679-line page is "several hundred nodes"; graphs are superb at 30 and poor at 600.
- **Hard:** Wrong page and wrong number. The largest is `mon-mois-typique` at **4,129 LOC**, which
  extrapolates to **700–1,500 nodes on one component**. And the largest component ever authored in
  this repository is **83 nodes, 78% of them `Text` and `Group`** (verified). The honest statement is
  not "poor at 600" — it is **"nobody has ever tried."**

**Where I land: with the skeptic.** "Nobody has ever tried" is the correct and more alarming framing.
Both of us agree the *renderer* is fine — PLAT-001 measured ~2,900-node corpora at 10.4ms — so this is
legibility and review, never frame rate, and anyone conflating them is arguing badly.

### 4. Testing and verification

- **Soft:** Code wins decisively — 71,923 LOC of tests have nowhere to live; phase 46 closes it.
- **Hard:** Code wins narrowly and only in the backend. comcoi has **no CI at all** (no `.github/`
  directory), tests run against a shared live database, teardown is delete-by-email-domain, zero
  property tests, and **zero coverage of `src/routes/`** — 29,025 LOC including the 4,129-line wizard.
  Meanwhile phase 46's stated structural advantage — four enumerable nondeterminism seams — **is
  destroyed by phase 44, which ships first**, because `lib/` is arbitrary CommonJS.

**Where I land: between, and the skeptic is right about the flaw in my own phase doc.** The 44/46
conflict is my error and it is now recorded in both phase READMEs. But D.8 cuts the other way harder
than the skeptic allows: *"71,923 lines of tests"* was my strongest pro-code claim and roughly the
frontend's share of it is theatre. The defensible residue — the décret-cited, oracle-based
calculation suite — is still decisive, but it is a much smaller fortress than I described.

### 5. The data layer

- **Soft:** The constraint is the CloudStore contract, not SQLite; Query Views raise the ceiling
  without a migration; the view namespace is "arguably cleaner" than a Postgres role.
- **Hard:** Code wins and it is not close. comcoi's analyst boundary is **five layers**, not one, and
  DAT-003 can only replace the first. I probed `node:sqlite` on v22.22.0: **no `interrupt`, no async
  API, no statement timeout, and `DatabaseSync` is synchronous.** So a model-written query blocks
  every other tenant until SQLite finishes, where Postgres kills it at 5s and hands the model a retry
  message. Plus: Postgres is *not in the 36-week plan*, and Node prints
  `ExperimentalWarning: SQLite is an experimental feature`.

**Where I land: with the skeptic, decisively.** I verified the probe myself. **DAT-003 cannot deliver
an availability boundary on this engine at any price**, and an adversarial test suite cannot test a
resource limit that does not exist. The analyst is 🟡 in the built world, not ✅. This is the largest
single correction to the built-world document.

### 6. The compute / logic layer

- **Soft:** Phase 44's kit + `lib/` closes it; the calculation core stays ~3,900 lines and moves
  across unchanged.
- **Hard:** Roughly par after 44 — **and the concession is the interesting part.** MOD-009 is the
  right answer, and the right answer is *"the moat stays code, in a directory, next to the graph."*
  Also: `lib/` is CommonJS-only and **untyped**, so type-hinted `Decimal` Python becomes untyped
  CommonJS — a real regression exactly where correctness matters most, uncosted.

**Where I land: with the skeptic, and their reframing is better than my own.** *"Once you accept the
moat stays code, the question is no longer visual-vs-code for the hard part — only whether the graph
is the best home for the other 70%."* That is the sharpest sentence in either document and neither of
mine drew it out. The untyped-`lib/` regression is a real gap in phase 44 and is now recorded there.

### 7. AI and agent authoring

- **Soft:** The strongest conclusion in either document — *NodeGX becomes the better choice for an
  AI-built app before a human-built one*, because an agent's characteristic failures (hallucinated
  APIs, half-applied edits, forgotten scoping, forgotten a11y) are structurally impossible.
- **Hard:** The closed-vocabulary and validate-before-write arguments are conceded fully. But the
  conclusion rests on AAQ-007, in a phase with **no estimate and a subjective human exit criterion**
  (*"Richard judges"*). And it discounts review friction as *"a human problem by definition"* —
  **review is not a human problem; it is the control that catches the agent.** A substrate optimised
  for the agent's convenience at the reviewer's cost has optimised the wrong side of the loop.

**Where I land: the skeptic wins the rebuttal, and it is the best argument in the review.** My §6
sentence *"an agent does not mind that a 600-node graph is ugly"* was the weakest thing I wrote.
Legibility is not aesthetics — it is the verification channel for everything the agent does, and
downgrading it because the agent is indifferent is precisely backwards.

The claim survives, weakened and now conditional: **NodeGX is the better substrate for an AI-built app
if and only if the human review channel is fixed** — labels by default, meaningful diffs, and a
demonstrated review of a large AI-authored component. Untouched, the agent advantage buys speed at
the cost of the only thing that catches the agent being wrong.

### 8. Hiring and team scaling

- **Soft:** Worst axis; any senior engineer maintains FastAPI on day one; phase 18 is the mitigation.
- **Hard:** Worse than that — **two engineers cannot edit the same component.** `MergeConflicts.tsx:10-17`,
  the platform's own words: structural conflicts *"are shown for review and dismissed, not
  auto-applied… Take the other side wholesale."* No browser editor, no collaborative session, so the
  only concurrency model is git on an artifact git cannot three-way-merge structurally. **The team
  size the tool supports is approximately one.**

**Where I land: with the skeptic, and this is my largest outright omission.** Neither document
mentions merge at all. The compounding point is the sharp one: an agent's characteristic output is a
large structural change to one component, so *the property that makes agent authoring safe in
isolation is the property that makes it unmergeable in a team.*

### 9. Lock-in and exit

- **Soft:** Phase 18 kills the objection; export to a React repo a React dev accepts.
- **Hard:** Severe. Phase 18 is **0 of 7 at 20–26 weeks**, and its critical path EXP-003 is *AI
  translation of Function/Expression nodes verified by a trace harness* — a research project, not an
  engineering task. Plan the exit as a rewrite and price accordingly.

**Where I land: with the skeptic.** I listed phase 18 as "shipped" in the built world and counted its
weeks nowhere in the 36. That is the arithmetic error in §A.9 and it is mine.

### 10. Security posture

- **Soft:** The model is better than comcoi's — ACL + CLP + roles + scoped keys + a property-tested
  filter twin. Whole classes of bug unwritable.
- **Hard:** Split, and both halves true. The *model* is better and conceded fully — comcoi has **no
  RLS, ten separately-defined `_get_owned_salon` helpers, 111 raw `salon_id ==` filters, and one
  isolation test on one field.** The *posture* is weaker: cloud functions are unsandboxable **by
  explicit decision**, so multi-tenant hosting is permanently off the table; two "reachability
  mistaken for access control" bugs have already shipped with a third flagged in phase 45's own
  README; and there is no SBOM, advisory channel or patch path for a kit compiled into the bundle.

**Where I land: the skeptic's split is right, and their evidence for my own argument is stronger than
mine was.** 111 filters defended by discipline is a better statement of the ACL case than anything I
wrote. But **"you can never host two customers on one box"** is a permanent architectural consequence
of MOD-005's honesty that phase 44 does not cost, and the SSR cache (§the bias, above) is a live
counter-example to my own *"forgotten tenant scoping → impossible"* row.

### 11. Operational debugging

- **Soft:** NodeGX wins — durable execution records, a run inspector, node-level provenance, an audit
  trail. Most FastAPI codebases have none of it.
- **Hard:** Code wins. **The trace substrate is an editor feature** — it runs against a project open
  in Electron on a developer's machine. At 3am you have a log line and a graph you cannot attach a
  debugger to. A `timeoutMs` cannot stop a synchronous function on the host event loop; restarting
  kills in-flight workflows irrecoverably (`WorkflowEngine.ts:311-325`); and there are no versioned
  artifacts to roll back to.

**Where I land: with the skeptic, and they were fairer to us than I was.** `ops/logger.ts` routing
every field through `redact()` so a caller *cannot* log a secret is better than comcoi's logging, and
neither of my documents said so. But "the provenance walk is an editor feature" is decisive for the
3am case and I presented it as an operational advantage without checking where it runs.

### 12. Accessibility and i18n

- **Soft:** The strongest strategic argument the platform has — correct output by emission beats the
  author remembering; and in a graph strings are already addressable, so i18n beats code structurally.
- **Hard:** Doctrine conceded on both, with comcoi as the proof — **706 un-extracted French strings**,
  `en.json` at 44% coverage, **261 of 582 aria attributes are `aria-hidden`**, twelve dialogs against
  **six `tabindex` in the whole codebase**, seventeen hand-written a11y suppressions, and an `eslint`
  that is **not installed** so the lint script cannot run. But today the runtime emits one aria
  attribute and deletes every focus ring; phase 41 has no task list; and INT-001's key format
  (component path + UUID) **orphans translations on rename and discards them on paste**.

**Where I land: with the skeptic on the product, and I keep the doctrine.** The key design is broken
and it is my phase doc that broke it — the same POL-013 trap I warned against, with a different
payload. But the doctrine survives both reviews intact, and the skeptic's own concession is the
strongest evidence for it: they would now add a no-bare-string lint rule to a code project *because
of this argument.*

### 13. Vendor risk and total cost of ownership

- **Soft:** *Not mentioned in either document.*
- **Hard:** The dominant term, and it is concentration rather than supply chain. Verified: **1,496 of
  1,557 commits by one author (96%)**; **1,486 unpushed**; `origin/main` last moved **2025-09-09**;
  **nothing published to npm**; a lineage already abandoned once by a better-resourced owner; ~390k
  hand-written LOC adopted as a dependency against comcoi's ~250k. **And the sole maintainer of
  NodeGX is the sole author of Communauté Coiffure.**

**Where I land: entirely with the skeptic. This is the biggest omission in my work and it changes the
verdict on its own.** Not a platform-quality argument — a calendar argument. Every week on phase 44 is
a week not on the product, and both weeks are the same person's.

---

## Two corrections found while checking the counter-review — both widen the envelope

Recorded here because they are the only places the adversarial read over-reached, and both were found
by verifying it rather than by defending against it.

1. **The broken SSR server does not touch SSG.** `ssg.js:59-76` renders routes **sequentially in one
   process** — no express, no `NodeCache`. The concurrency race needs two simultaneous requests; the
   permanent cache is `index.js`'s; the `app.get('*')` DoS is a server route. None can occur in a
   build step. Only the React 18/19 mismatch carries over. **So static-output projects are unaffected
   today**, and phase 49's DIS-004 gates dynamic per-request rendering, not SEO in general.
2. **"You can never host two customers on one machine" is true of a platform, not a product.** Cloud
   functions are build-time artifacts compiled into the deployed bundle — there is no runtime
   endpoint that creates one (checked the route table). So *"the author of a function is the person
   who deploys the backend"* holds intact for ordinary SaaS, where the vendor writes every function
   and tenants are ACL-isolated. The real constraint is narrower and sharper: **do not build a
   platform where your users author logic.**

Neither rescues the comcoi verdict. Both matter for
[what NodeGX *is* for](NODEGX-WHAT-IT-IS-FOR.md), which is the companion this exercise was missing.

## The revised verdict

| | Soft (mine) | Hard (skeptic) | **Where I land** |
|---|---|---|---|
| **comcoi, today** | Code, not close | Code, 95% confidence | **Code.** We agree; the skeptic's reasoning is better — vendor position, not capability gaps. |
| **comcoi, built world** | NodeGX 60/40 | Code 65/35 | **Code, ~55/45.** I moved most of the way. The deciders are concentration risk, the analyst's missing availability boundary, and merge. |
| **The class NodeGX should target** | 2–8 week multi-tenant business apps | Internal tools, ops, portals | **We agree**, and the skeptic reached it independently, which is the strongest signal in the exercise. |

The skeptic's §E recommendation and my §10 rule are the same rule. They wrote *"keep SvelteKit +
FastAPI, use NodeGX for internal admin/ops tooling, workflow-shaped back-office processes and client
portals."* I wrote *"difficulty in plumbing → NodeGX; difficulty in computation and correctness →
code."* An adversarial reviewer working from the same evidence landed on my rule while rejecting my
conclusion — which means **the rule is probably right and my application of it to comcoi was wrong.**

### The five days that should happen before any of this

The skeptic's closing argument, and I cannot improve on it. In comcoi, this week:

1. One tenant-scoping dependency, replacing 111 hand-written filters.
2. `openapi-typescript` in CI, killing the 46-interfaces-vs-225-models drift.
3. ESLint installed and running, with the a11y rules and a no-bare-string rule.
4. A GitHub Actions workflow that runs the 71,923 lines of tests **nobody currently runs.**

Five days closing four of the six weaknesses NodeGX was proposed to solve. Any founder should see
that number before committing eighteen months of platform work.

## What this exercise says about me as a reviewer

Worth recording, because it generalises past this comparison.

1. **I verified in one direction.** Every pessimistic claim got a `file:line`. Optimistic claims got
   the benefit of the doubt. The SSR correction was the visible instance; §5 (the data layer) and
   §11 (debugging) were the same error where nobody caught it.
2. **I omitted the two things an outsider names first** — who maintains this, and can two people work
   on it. Both are obvious. Neither is discussed anywhere in the repo I read, which is exactly why I
   did not think of them: **I inherited the repo's blind spots along with its evidence.**
3. **I discounted the human channel.** *"An agent does not mind that a 600-node graph is ugly."* The
   reviewer is the control on the agent, and I optimised the wrong side.

The constructive counterpart — the fitness envelope these three documents implied and none of them
stated — is [NODEGX-WHAT-IT-IS-FOR.md](NODEGX-WHAT-IT-IS-FOR.md).

The counter-review cost one subagent and about twenty minutes. It changed one verdict, corrected two
phase docs, and found a shipping SSR server that races on process globals. **Commission the skeptic
earlier next time.**
