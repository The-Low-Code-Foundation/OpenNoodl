# The built world: NodeGX vs. code, with every phase shipped

**Written:** 2026-08-06
**Companion to:** [NODEGX-VS-CODE-A-REAL-APP.md](NODEGX-VS-CODE-A-REAL-APP.md) — the same comparison
run against NodeGX **as it is today**, which concluded *"build it in code, the margin is not close"*.
**Same reference app:** Communauté Coiffure v2 — 54 tables, 83 migrations, ~63k LOC Python, 71,923
LOC of tests, 211 Svelte components, a 24-tool LLM assistant, an NL→SQL analyst, Stripe, pgvector.

> ### ⛔ SUPERSEDED VERDICT — read [THE SPECTRUM](NODEGX-VS-CODE-THE-SPECTRUM.md) instead
> A commissioned adversarial [counter-review](NODEGX-VS-CODE-THE-COUNTER-REVIEW.md), independently
> verified, moved this document's 60/40-for-NodeGX to roughly **55/45 for code**. Four corrections
> matter most: the ~36-week roadmap is **~70 weeks plus two unestimated phases** at a team size of
> one; **DAT-003 cannot deliver an availability boundary** because `node:sqlite` has no `interrupt`
> and is synchronous; §4's "three permanent costs" are **six** (add: no structural merge, no
> compatibility contract, no multi-tenant hosting); and §6's *"an agent does not mind that a 600-node
> graph is ugly"* is backwards — **review is the control that catches the agent.** Everything
> measured here still holds; the weighting did not.

## What "the built world" means

Every phase in `dev-docs/tasks/` is shipped. Specifically the ones that matter here:

| | What it gives us |
|---|---|
| [44 — Compute Ceiling](../tasks/phase-44-compute-ceiling/README.md) | Curated module kit, **danger mode**, project-local `lib/` shared code |
| [45 — Streaming](../tasks/phase-45-streaming/README.md) | A cloud function can emit a stream the app renders |
| [46 — Verification](../tasks/phase-46-verification/README.md) | Cases + a headless runner + trace replay + `nodegx test` in CI |
| [47 — i18n](../tasks/phase-47-internationalisation/README.md) | Extraction-free multilingual apps, RTL, locale SSR |
| [48 — Data Ceiling](../tasks/phase-48-data-ceiling/README.md) | Vector search, Query Views, schema history, Postgres |
| [49 — Discovery](../tasks/phase-49-discovery/README.md) | Sitemap, robots, JSON-LD, ISR (SSR/SSG already shipped) |
| [41 — Accessibility](../tasks/phase-41-accessibility/README.md) | Accessible output by emission, ATAG A **and** B |
| [40 — AI Authoring Quality](../tasks/phase-40-ai-authoring-quality/README.md) | The agent sees its work, iterates, decomposes, and has a visual identity |
| [18 — Code Export v2](../tasks/phase-18-code-export-v2/PROGRESS.md) | A project exports to a React 19 repo a React dev accepts |
| [26 — Deployment](../tasks/phase-26-deployment/README.md) | Full-stack deploy without being a sysadmin |

**This is a thought experiment with a purpose**: it says what the roadmap is *for*, and — more
usefully — it isolates what does **not** get fixed by any of it.

---

## 1. The blockers, revisited

Every 🔴 from the original review, and what happens to it.

| Original blocker | Built world | By what |
|---|---|---|
| No test harness — 71,923 LOC of tests had nowhere to live | ✅ Closed | 46: cases pin pure functions; traces pin recorded sessions; `nodegx test` runs in CI with no editor |
| `require` is a ReferenceError — no Decimal, Stripe, xlsx, PDF | ✅ Closed | 44: kit covers all four; danger mode covers everything else |
| 3,915 LOC of interlocking calculations had nowhere to live | ✅ Closed | 44 MOD-009: project `lib/`, versioned, diffed, **directly testable without a graph** |
| No SQL surface, no joins, no least-privilege role | ✅ Closed | 48: Query Views; the view namespace **is** the NL→SQL boundary, enforced at resolution |
| No vector search for RAG | ✅ Closed | 48 DAT-001: `sqlite-vec` |
| No server→app streaming | ✅ Closed | 45: publish/subscribe channels; survives a page reload, which the HTTP variant could not |
| No SEO | ✅ **Was never true** — SSR and SSG already shipped | corrected in the original review; 49 adds the edges |
| No i18n | ✅ Closed, and better than the code baseline | 47: extraction-free; strings are already addressable parameters |
| No schema migration history | ✅ Closed | 48 DAT-006 |
| One SQLite box | ✅ Closed for scale | 48 DAT-005: Postgres adapter |
| Lock-in | ✅ Closed | 18: export to a React repo |

**Every capability blocker falls.** That is the honest read, and it is worth sitting with, because
the original review's verdict rested entirely on them.

---

## 2. So what does the app look like?

Rebuilding Communauté Coiffure in the built world, by layer:

| Layer | Code (as built) | Built-world NodeGX | Δ |
|---|---|---|---|
| Auth, sessions, resets, magic links, verification | ~2,500 LOC + tests | **0** — nodes + backend subsystem | gone |
| Routers / API surface | 22,257 LOC | ~2,000 LOC of cloud functions | −90% |
| Pydantic schemas + SQLAlchemy models | 9,895 LOC | **0** — one shape, introspected | gone |
| Tenant scoping (`salon_id` everywhere) | woven through every query | **0** — per-record ACL | gone, *and* a bug class removed |
| Services (email drip, billing alerts, imports, reports) | 37,521 LOC | ~8,000 LOC across functions + `lib/` + workflows | −80% |
| **Calculations** | 3,915 LOC | **~3,900 LOC in `lib/`** | ≈0 |
| Frontend | 77,045 LOC / 211 components | ~180 components; the simple 80% smaller, the dense 20% worse | contested |
| Tests | 71,923 LOC | ~35,000 — roughly half tested infrastructure NodeGX now warrants | −50% |
| Infra (4× compose, Caddy, nginx, monitoring) | ~1,500 lines of config | one artifact + a deploy flow | gone |

Two rows carry the whole argument.

**The calculations row is ≈0, and that is the point of MOD-009.** Three thousand nine hundred lines
of French social-charge logic is *code*, it stays code, and the built world's contribution is
letting it sit in `lib/` beside the graph — versioned, imported by four cloud functions, and unit
tested — instead of forcing it to be drawn. A tool that made you draw a tax engine would not be
principled; it would be unusable. The built world's honesty is that it stops pretending otherwise.

**The frontend row is the one that stays contested**, and §4 is about why.

---

## 3. What genuinely flips — NodeGX better, not merely adequate

These are not "gaps closed". These are places where the built world is **better than the code app
that actually exists**:

1. **Multi-tenancy.** comcoi filters by `salon_id` in application code, in every query, forever. One
   missed filter leaks a stranger's payroll. Per-record ACLs make that unwritable, and
   `check_backend_access` answers "what can this principal do" before you ship. This is the single
   most valuable safety property in the comparison and it is available today, not in the built world.

2. **Accessibility.** comcoi almost certainly has WCAG failures — 95.9% of home pages do, and its
   frontend was written by the same model-and-human mix as everyone else's. A phase-41 NodeGX app is
   accessible *because of what the runtime emits*. The author never decided to be.

3. **i18n.** Better than `svelte-i18n`, not equal to it. In a graph, strings are already discrete
   addressable parameters, so extraction is a walk. In JSX they are text nodes in a syntax tree, so
   extraction is a build step, a lint rule and a discipline — which is why so many codebases have
   i18n architecture *and* hardcoded strings simultaneously. comcoi's own README declares "all
   strings externalised from day one" as a rule, and rules of that kind are enforced by vigilance.

4. **Operational visibility.** comcoi has Sentry and logs. The built world has a durable execution
   record per workflow run, a run inspector, node-level provenance ("which node produced this value,
   and why"), and an audit trail of every privileged action. Most FastAPI codebases have none of
   this, and nobody budgets for it.

5. **One data shape.** The model → schema → TypeScript-type triangle is a standing source of drift
   bugs in every typed full-stack codebase. It simply does not exist here.

6. **The domain expert can read the logic.** The pricing methodology came out of a consultant's
   Excel model. He can read `cost per minute → × duration → + margin` as a graph. He cannot read
   `pricing.py`. For a product whose value *is* one expert's methodology, that closes a review loop
   that is currently open — and no amount of code quality opens it.

7. **Deployment.** Four compose files, a Caddyfile, an nginx conf and a `DEPLOYING.md` become a
   flow.

---

## 4. What does **not** get fixed, by anything on the roadmap

This is the section that makes the document worth writing.

### 4.1 Canvas density — the permanent one

comcoi's month-detail page is 1,679 lines: ~40 reactive statements, 6 child components, conditional
grids, inline editing. As a graph that is several hundred nodes and roughly as many wires.

Node graphs are superb at 30 nodes and poor at 600. Code's legibility degrades far more gracefully
with size — a 1,679-line file is unremarkable and navigable by search. Components-by-default
(AAQ-008) and the Logic Builder help; `lib/` moves the *computation* out; neither changes the fact
that dense interactive UI is more legible as text than as a plane.

**No phase fixes this and none should pretend to.** It is a property of the representation.

### 4.2 Review at scale

A 200-node change is harder to review than a 200-line diff, even with per-component v2 files,
GraphDiffPanel, the Explain panel and provenance. Code review is a mature social practice with forty
years of tooling and shared vocabulary. Graph review is not, and will not be by the end of this
roadmap.

This bites hardest exactly where it matters most: a human checking what an agent did.

### 4.3 Type inference across the whole app

A node catalog with typed ports is not `tsc`. FH-019 gives intellisense inside a function; MOD-004
extends it to kit modules; nothing gives end-to-end inference from a database column through a
cloud function to a rendered prop. In a TypeScript monorepo, renaming a field breaks the build. In a
graph it breaks at runtime — and phase 46 catches it, which is a strictly weaker guarantee than not
compiling.

### 4.4 Talent pool

Any senior engineer maintains FastAPI on their first day. Far fewer read node graphs, and the ones
who can are not applying to your job ad. Phase 18 is the mitigation — you can leave with a React repo
— not a cure, and a mitigation you have to exercise is a cost you have already paid.

### 4.5 A new security boundary is a newer security boundary

DAT-003 replaces comcoi's Postgres role with a view namespace enforced at resolution. I argued in
the phase doc that this is arguably *cleaner*, because the allowed surface is an explicit artifact
rather than a grant someone remembered to narrow.

It is also five years younger. For a security boundary, boring and proven has real value that
elegance does not substitute for. A CISO reviewing both will prefer the role, and will be making a
defensible call.

### 4.6 The team you have

Underdiscussed and often decisive: if the team is four senior Python engineers who have shipped
FastAPI for a decade, **code wins on velocity regardless of tooling**, because fluency beats
substrate. The built world changes what is *possible*; it does not change who is in the room.

---

## 5. The verdict, rerun

### For Communauté Coiffure, in the built world

**NodeGX — call it 60/40, and the 40 is concentrated and nameable.**

The reasoning is not that NodeGX becomes faster. It is that **the entire category of infrastructure
bug disappears**: no tenant-scoping leak, no schema/type drift, no WCAG regression, no hand-rolled
session handling, no untraceable cron job. Those are the bugs that hurt a small team a year in, and
they are structurally absent rather than carefully avoided.

The 40 is: a dense frontend that is genuinely better as code, review friction on large changes, and
a talent pool that does not exist. None of those is fatal and all of them are permanent.

The recommendation would be *"build it in NodeGX"* with a written risk register naming §4.1 and §4.4
— **not** *"NodeGX is now strictly better"*, which would be a marketing claim rather than a finding.

### What would still make me say code, in the built world

1. The team is already fluent in a code stack (§4.6) — the strongest single reason, and it has
   nothing to do with either tool's merits.
2. The app is 80% dense interactive UI rather than 30% (a spreadsheet, an IDE, a design tool, a
   game). §4.1 dominates.
3. A regulated environment where a new security boundary needs a proven pedigree (§4.5).
4. The app is fundamentally a computation with a thin UI — a solver, a compiler, a data pipeline.
   Then you are writing `lib/` with a graph strapped to it, and you should just write `lib/`.

---

## 6. The conclusion I did not expect

Rerunning Part II of the original review — Claude Code + NodeGX vs. Claude Code + code — the built
world produces a sharper result than the human comparison does:

> **NodeGX becomes the better choice for an AI-built app before it becomes the better choice for a
> human-built app.**

The reason is that the two tools' weaknesses land on different parties.

**An agent's characteristic failure modes are exactly what the substrate prevents:**

| Failure mode | In code | In built-world NodeGX |
|---|---|---|
| Hallucinated API or package | Common; needs a build to catch | Impossible — closed 172-type vocabulary, validated before write |
| Half-applied multi-file change | 14 files edited, 3 wrong, manual unwind | Impossible — plans are atomic and discard byte-identically |
| Forgotten tenant scoping | Silent breach | Impossible — ACLs |
| Forgotten accessibility | Near-certain (95.9% baseline) | Impossible — emitted |
| Dependency / environment breakage | A large share of real agent wall-clock | Absent |
| Unprovable correctness | Solved by tests | Solved by tests (phase 46) |
| Can't see its own output | Solved by running it | Solved (AAQ-007) |

The last two rows are the built world's entire contribution to the agent story, and they are the two
that mattered. Everything above them was already true.

**Meanwhile NodeGX's weaknesses land mostly on humans.** §4.1 (density) is an aesthetic and
navigational problem — an agent does not mind that a 600-node graph is ugly, it minds whether it can
validate it, and phase 46 says it can. §4.2 (review) is a human problem by definition. §4.4 (talent
pool) does not apply to an agent at all.

That asymmetry is the strategic finding, and it suggests the positioning is not *"a better way to
build software"* — that fight is decided by density and review culture, and it is close. It is:

> **The substrate where an agent cannot make the expensive mistakes.**
>
> It cannot invent an API, cannot half-apply a change, cannot leak a tenant, cannot ship an
> inaccessible control, and — once phase 46 lands — cannot claim something works without proving it.

That claim is not true today. Every phase in the post-alpha index is a step toward making it true,
and the two that matter most for it are **46** and **41** — verification and emission — neither of
which is a feature anyone asks for by name.

---

## 7. Honest limits of this document

- **This is a thought experiment.** Nothing here was measured, because none of it exists. The
  *today* document was measured; this one is reasoned from it, and estimates are estimates.
- **Phase estimates are optimistic** the way all phase estimates are. Reading §4 as "in six months"
  rather than "eventually" would be a mistake.
- **The comparison app is one app.** It is a good stress test precisely because it is hostile —
  computation-heavy, regulated, multilingual, AI-native. A CRM, an ops dashboard or a client portal
  would flip to NodeGX today, without any of these phases.
- **I am the thing being compared.** The Part II conclusion says the platform is unusually good for
  agents. That is the conclusion most worth distrusting from this author, and the reason §4 is
  longer than §3.
