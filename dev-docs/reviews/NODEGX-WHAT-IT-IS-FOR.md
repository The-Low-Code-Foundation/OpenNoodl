# What NodeGX is for

**Written:** 2026-08-06
**Companion to:** [the spectrum](NODEGX-VS-CODE-THE-SPECTRUM.md) and
[the counter-review](NODEGX-VS-CODE-THE-COUNTER-REVIEW.md), which between them established what
NodeGX is *not* for by taking a hostile app and finding every place it broke.

This document does the other half, and it is not a rebuttal. **Everything the counter-review found
stands.** The point of a fitness envelope is that a tool having a boundary is not a criticism of the
tool — it is the definition of the tool. WordPress is a superb way to build a magazine and an
appalling way to build a payroll engine, and nobody thinks the second sentence damages the first.

Richard's framing, 2026-08-06, and it is the correct one:

> *"If someone asked you to make an enterprise-grade integration layer for Salesforce and a company
> that uses 80 different tools, choosing n8n would be like saying 'I've got an entire wild Dordogne
> garden to tame, I'll go find my bonsai scissors.'"*

Communauté Coiffure was the Dordogne garden. This document is about what the scissors are excellent
at — derived from the same measured constraints, not from enthusiasm.

---

## 0. Two corrections that widen the envelope

Both found while checking the counter-review's own claims. Stated first because they change which
categories below are viable.

### 0.1 The broken SSR server does not touch SSG

The counter-review's §A.1 is correct and I verified all four defects. But `ssg.js` does **not** use
the server:

```js
// static/ssr/ssg.js:59-76 — sequential, one process, no express, no NodeCache
for (const route of routes) {
  const { html } = await renderPage(…);
  await fs.promises.writeFile(outFile, html);
}
```

The concurrency race needs two simultaneous requests. The permanent cache is `index.js`'s. The
`app.get('*')` DoS is a server route. **None of the three can occur in a sequential build step.** Only
the React 18/19 mismatch carries over, because both share a `package.json`.

**So: any project whose output is static is unaffected by the worst of it today.** Marketing sites,
blogs, docs, brochureware, event sites, and any app whose public half is prerendered are fine now.
The SSR server is what phase 49 must rewrite, and it gates *dynamic per-request rendering*, not SEO
in general.

### 0.2 "You can never host two customers on one machine" is true of a *platform*, not a *product*

The counter-review's §B.6.1 says the unsandboxable cloud function permanently removes multi-tenant
hosting. The premise is right — a Function node has full `process` authority (TALK-007 §3.1) — but
the conclusion over-reaches, and the distinction matters enough to state precisely.

**Cloud functions are build-time artifacts.** They are components in the project
(`/#__cloud__/…`), compiled into the deployed bundle. There is no runtime endpoint that creates or
uploads one — I checked the route table. So the trust model the platform states —
*"the author of a function is the person who deploys the backend"* — **holds intact for a normal
SaaS**, where the vendor writes every function and customers only use the app. Tenants are isolated
by ACLs at the data layer, which is exactly what ACLs are for.

The constraint is therefore narrower and sharper:

> **Do not build a platform where your *users* author logic.** Multi-tenant SaaS where *you* author
> the logic is fine.

That rules out "Zapier for X", "a plugin marketplace", "customer-supplied scripts" — and rules in
essentially every ordinary SaaS. It also re-flags the case the phase docs already name: an **agent**
writing functions that ship without a human reading them re-opens the hole, which is why MOD-007
exists.

---

## 1. The fitness function, as thresholds

Not vibes. Every number traces to something measured in the other reviews.

| Dimension | Green | Amber | Red | Why that number |
|---|---|---|---|---|
| **Screens** | ≤ 30 | 30–60 | > 60 | Not a hard limit; a review limit |
| **Nodes per component** | ≤ 80 | 80–200 | > 200 | **The largest component ever authored in this repo is 83.** Beyond ~200 nobody has tried |
| **Screen complexity** | forms, lists, detail, dashboards | wizards, inline-edit grids | editors, canvases, IDE-likes | 78% of nodes in real examples are `Text`/`Group` — graphs spend their canvas on the cheapest part of a UI |
| **Concurrent builders** | 1 | 2, disciplined | 3+ | Structural merge conflicts are *dismissed, not resolved* (`MergeConflicts.tsx:10-17`) |
| **Active users** | ≤ ~2,000 | 2k–10k | > 10k | One SQLite file, one synchronous writer |
| **Write throughput** | low | moderate | sustained high | `DatabaseSync` on the request thread |
| **Computation** | rules and arithmetic | moderate, in `lib/` (post-44) | solvers, decimal money math, actuarial | No test harness until phase 46; no `Decimal` until 44 |
| **Compliance load** | low–moderate | moderate | payroll, medical, KYC, financial advice | No DSAR tooling, no SOC2 path, no SBOM |
| **Languages** | 1 | 1 | 2+ | No i18n at all until phase 47 |
| **Blast radius if the platform stalls** | rewritable in weeks | months | the company dies | 96% single-maintainer, nothing published to npm |
| **Who authors logic** | you | you | your users | §0.2 |

## 2. The three properties that must co-occur

A single green column is not the test. NodeGX wins decisively when **all three** of these are true,
and each one it loses degrades the case fast.

1. **High plumbing-to-logic ratio.** The app is mostly auth, records, forms, lists, permissions,
   files, notifications and scheduled jobs. Its distinctive part is *rules*, not an *engine*.
2. **The eventual maintainer is not a software engineer** — or is a builder who would rather not own
   a repo, a CI pipeline, a dependency tree and a database. This is where value is *created*, not
   merely saved.
3. **Small blast radius.** If the platform stalled tomorrow you could rewrite this in weeks, or the
   app is not what keeps the lights on.

All three → excellent, and better than Claude Code writing React.
Two → fine; a defensible choice.
One or none → **use code**, and the other documents explain why at length.

---

## 3. Where NodeGX is outstanding

### 3.1 Internal business tools — the heartland

This is the category the platform is *shaped* for, and where every one of its structural advantages
is load-bearing rather than incidental.

**Factory-floor QA and shift checklists** (manufacturing, food production, print). A tablet on the
line: shift start, per-batch checks, photo capture on a defect, supervisor dashboard, a nightly
summary emailed to the plant manager. Eight simple screens. Why it wins: the photo upload with signed
URLs, the roles, and the nightly workflow are all free; the *production manager* adds a checklist
field on Tuesday without raising a ticket. In code this is a repo somebody has to keep alive.

**Equipment, room and vehicle booking** (schools, labs, studios, churches, community centres,
sports clubs). Calendar, request, approval, conflict rules, confirmation emails, reminders. The
approval flow with a wait and a nudge is genuinely tedious to hand-roll and is a five-step workflow
here — with a durable run record and an inspector that most bespoke versions never get.

**Field service dispatch** (plumbers, electricians, pest control, mobile vets). Office creates the
job; the engineer sees only their list on a phone; photos and a signature on completion; completion
triggers the invoice email. **The ACL story's cleanest demo**: "an engineer sees only their own jobs"
is a permission rule, not a filter you must remember in nineteen queries.

**Property maintenance portals** (letting agents, housing associations, facilities management).
Three principals — tenant, contractor, manager — over one dataset. This is the single best argument
the platform has, because the code version is 111 hand-written scoping filters defended by discipline
(counter-review §D.1), and here it is a rule table plus `check_backend_access` to prove it before you
ship.

**Grant and application review** (councils, foundations, arts bodies, research offices). Applicant
portal, reviewer scoring, panel decision, decision letters. Deadline-driven, workflow-shaped,
seasonal, and maintained by an administrator rather than an engineer.

**Batch and traceability logs** (breweries, bakeries, cosmetics, small-batch manufacturing). Records,
QR labels, "which batches used lot #4471" as a recall query. Small data, real regulatory value, and
the audit trail is already there.

**Recruitment and referral pipelines** (agencies, clinics, legal intake). Records with stages, CV or
report attachments, email templates, and *"no contact in 14 days → nudge the owner"* as a scheduled
workflow — which is exactly the shape the engine is best at and exactly what small firms never build.

### 3.2 Agencies and consultancies — the prototype that is not a throwaway

Probably the highest-value commercial category, because agencies have budget and repeat need.

Build a **working** app — real auth, real data, real permissions, deployed — during a discovery
engagement. Not a Figma prototype: something the client's staff can log into and use badly, which is
how you find out what they actually need. Iterate live in the room.

Then a real fork in the road: ship it, or export (phase 18) and rebuild. Both are honest outcomes,
and the second one is *evidence-gathering that produced a working reference implementation* rather
than a discarded mockup.

### 3.3 Non-profit and public sector

The distinguishing property here is not cost — it is **institutional memory surviving staff
turnover.** A charity's system is inherited every eighteen months by whoever is there. A repo is
abandoned within one handover; a graph the next coordinator can open and read is not.

**Food bank volunteer and stock coordination** — shifts, stock levels, collection rounds, donor
thank-yous. **Museum and archive collection catalogues** with a volunteer roster. **School parent
communications** — trip consents, permissions, absence forms. **Community energy or allotment
societies** — membership, plots, dues, waiting lists. **Mutual aid coordination** — requests,
volunteers, matching.

⚠️ **Caveat with teeth:** logistics and coordination, yes. **Not** protected-category personal data —
safeguarding records, health information, immigration casework — until there is DSAR and erasure
tooling and someone has done a real DPIA. The ACL model is genuinely appropriate; the compliance
surface around it is not built.

### 3.4 AI-adjacent tooling — where the strengths compound

The strategically interesting category, because NodeGX's own machinery is unusually well-suited to
*building tools that watch and steer AI systems*.

**Human-in-the-loop review queues.** An agent proposes; a human approves. A workflow with `Wait Until`
plus a simple queue UI plus an audit trail. This is one of the most common needs of 2026 and the
platform already has every part of it — triggers, waits, durable runs, roles, an audit log.

**Agent operations consoles.** Run history, cost dashboards, approve/reject, replay. Execution
history, the run inspector and provenance already exist as *product* features here, where every other
stack builds them from scratch.

**Internal "ask our docs" assistants.** Upload → embed → retrieve → chat. ⚠️ Honestly gated: needs
[DAT-001](../tasks/phase-48-data-ceiling/README.md) for vectors and
[phase 45](../tasks/phase-45-streaming/README.md) for token streaming. Today this is clunky; after
those two it is a weekend.

**AI-authored apps handed to a human.** The flagship: Claude Code builds it end to end over MCP —
`provision_backend`, plans, validated writes — and then a non-engineer maintains it visually. ⚠️ And
the honest gate, from the counter-review: **`agent-chat`, this repo's own AI-authored example, has 0
of 262 nodes labelled.** Until labels-by-default lands, "hand it to a human" is a promise the output
does not currently keep. It is a cheap fix and it should be near the front of the roadmap.

### 3.5 Hobbyist and personal

Where the "one artifact, no infrastructure" property is simply *fun*, and the blast radius is zero.

Home-lab dashboards. Tabletop campaign managers with NPCs, sessions and loot tables. Running-club
race results. Allotment society plot registers. Wedding RSVP and seating. Model railway control
panels. Reading and media trackers. A parkrun volunteer rota.

Runs on a €5 VPS or a Raspberry Pi. No `npm audit`, no Dockerfile, no Postgres to keep alive. The
category most likely to produce the advocates every developer tool actually grows on.

### 3.6 Education

Genuinely differentiated, not a consolation prize. **You can watch a signal propagate.** Reactivity,
event flow, state and data binding are abstract in text and literal in a graph — and the trace
substrate makes causality visible in a way no debugger does for a beginner.

Teaching data flow and app architecture. Student capstones and hackathons. A computing teacher
building the school's own internal tools, inherited by the next teacher rather than abandoned.

---

## 4. Where it is fine, but not special

Worth naming so the pitch does not overclaim.

- **Marketing sites, blogs, docs.** SSG works and is unaffected by the SSR defects (§0.1). But
  Astro, Hugo and Eleventy are excellent and free, and this is not where NodeGX's advantages live.
  Use it when the site is *attached* to an app you are already building here.
- **Simple CRUD SaaS at low scale.** It works. So do a dozen other things. The differentiator only
  appears when permissions, workflows and a non-engineer maintainer are all in play.
- **Forms and surveys.** Typeform exists and is better at exactly that.

---

## 5. The ringfence — where it will be exposed

Stated plainly, because a tool that names its own boundary is trusted more, not less. Do not reach
for NodeGX when:

1. **Correctness of computation is the product.** Tax, payroll, actuarial, scientific, trading,
   billing engines. No test harness until phase 46; no decimal arithmetic until 44. *This is
   Communauté Coiffure, and it is why that verdict was code.*
2. **The data is regulated.** Medical records, payments processing, KYC, safeguarding. No DSAR
   tooling, no erasure, no SBOM, no SOC2 path on any phase.
3. **Three or more engineers work concurrently.** Structural merges are dismissed, not resolved.
4. **The UI is dense and interactive.** Editors, design tools, IDEs, trading terminals, games,
   dashboards with forty interlinked controls. The reference app's largest page extrapolates to
   700–1,500 nodes; the largest ever built here is 83.
5. **Scale is the point.** Tens of thousands of active users, sustained write throughput, replicas,
   failover.
6. **It must ship in more than one language** (until phase 47).
7. **Your users author logic** (§0.2) — a plugin marketplace, "Zapier for X", customer-supplied
   scripts.
8. **You are betting the company and could not rewrite it.** 96% single-maintainer, nothing published
   to npm, `origin/main` eleven months stale. This is the constraint that most deserves fixing, and
   fixing it is cheap.

Richard's own test, and it is a good one: *nobody would build Communauté Coiffure in WordPress, and
that says nothing bad about WordPress.*

---

## 6. What NodeGX uniquely is

The purpose question is really a competitive question, and the honest map:

| | App | Backend | Workflows | Code escape | Self-host | AI-authorable |
|---|---|---|---|---|---|---|
| n8n / Zapier | ✗ | ✗ | ✓ | melting pot | n8n ✓ | ✗ |
| Retool / Appsmith / Budibase | internal only | partial | weak | limited | some | ✗ |
| Bubble | ✓ | ✓ | ✓ | ✗ | ✗ | partial |
| Supabase / Directus / PocketBase | ✗ | ✓ | ✗ | n/a | ✓ | ✗ |
| Windmill | basic | ✗ | ✓ | ✓ | ✓ | ✗ |
| **NodeGX** | ✓ real reactive runtime | ✓ | ✓ | ✓ functions + `lib/` | ✓ one artifact | ✓ **MCP with plans + validation** |

Three things are genuinely NodeGX's own:

1. **One project contains the app, the backend, the workflows and the functions**, self-hosted, as a
   single deployable artifact. Not a stack you assemble — a thing you open.
2. **An AI agent can author all four through a typed, validated tool contract** — plans that apply
   atomically or not at all, writes rejected before they land, a backend provisioned in one call. No
   competitor has this.
3. **The output is maintainable afterwards by someone who is not an engineer.** That is the actual
   product, and it is the one that survives the agent building it.

### The sentence

> **NodeGX is for the business app whose difficulty is plumbing, not computation — built with an
> agent in an afternoon, and kept alive for years afterwards by whoever inherits it.**

Its natural size is the two-to-eight-week app that a small organisation depends on and no software
team maintains. That is not a consolation category. It is most of the software in the world, it is
overwhelmingly built badly or not at all, and nothing else on the market covers the whole of it in
one artifact.

## 7. The four things that most widen this envelope

Not the whole roadmap — the items that move the *boundary* rather than deepen the middle:

1. **Labels by default on authored nodes** (cheap, days). Without it §3.4's flagship promise —
   hand it to a human — is not kept by the output. 0 of 262 in this repo's own example.
2. **Publish to npm under semver, push the branch, name a second maintainer** (cheap, not a phase).
   Directly attacks the blast-radius row, which is the constraint that excludes the most valuable
   projects.
3. **Phase 46 Tier 1** — moves the computation row from "rules only" to "rules and arithmetic you can
   prove", which unlocks a large slice of §3.1 that currently has to be caveated.
4. **Structural merge** (unscheduled) — moves concurrent builders from 1 to 3+, which is the
   difference between a solo tool and an agency tool.
