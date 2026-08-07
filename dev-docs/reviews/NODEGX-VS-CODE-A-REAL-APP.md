# Building a real SaaS: NodeGX vs. code — an objective comparison

**Written:** 2026-08-06
**Reference app:** Communauté Coiffure v2 (`~/vscode_projects/comcoi-v2`) — a live, multi-tenant
French SaaS: SvelteKit + FastAPI + PostgreSQL 16 + pgvector, deployed on Hetzner.
**Question asked:** if Claude Code were told *"build Communauté Coiffure with NodeGX"* instead of
*"build it with code"*, what would actually happen — and which is the better instruction?
**Position:** written by the thing that would do the building, and asked to be objective rather than
loyal. Where NodeGX is worse, this says so. Where it is better, it says that too, and the "better"
list is longer than the platform's own docs currently claim.

> ### ⛔ SUPERSEDED VERDICT — read [THE SPECTRUM](NODEGX-VS-CODE-THE-SPECTRUM.md) instead
> The evidence in this document stands. Its single-voice conclusion does not. A commissioned
> adversarial [counter-review](NODEGX-VS-CODE-THE-COUNTER-REVIEW.md) found — and I independently
> verified — that the correction below **over-corrected**: SSR exists and is broken in four specific
> ways. The bias here was never enthusiasm; it was **asymmetric verification** (every 🔴 got a
> `file:line`, every ✅ got the benefit of the doubt). Both positions are placed side by side, per
> axis, in the spectrum document.

> **Companion:** [NODEGX-VS-CODE-THE-BUILT-WORLD.md](NODEGX-VS-CODE-THE-BUILT-WORLD.md) reruns this
> comparison assuming every phase in [POST-ALPHA-INDEX.md](../tasks/POST-ALPHA-INDEX.md) is shipped.
> This document is what is true today; that one is what the roadmap is for.

> ### ⚠️ Correction, 2026-08-06 (same day)
> The first version of this document claimed **NodeGX has no SSR**. That was wrong, and it was the
> single most consequential error in it. NodeGX has **both SSR and SSG**, wired into
> Deploy → Self Hosting as a rendering-mode dropdown
> ([`DeployToFolderTab.tsx:23-34`](../../packages/noodl-editor/src/editor/src/views/DeployPopup/tabs/DeployToFolderTab/DeployToFolderTab.tsx#L23-L34)),
> with a real render gate, an `SSR_PageLoading`/`SSR_PageReady` handshake, SEO head injection, and
> per-page `description` / `og:*` / `twitter:*` meta on the Page node. §3, §4.4, §6 and §11 have
> been corrected. The failure was mine: I grepped `packages/noodl-viewer-react/src` and the exporter,
> and the machinery lives in `packages/noodl-viewer-react/static/ssr/`. **Treat every other 🔴 in
> this document as a claim to re-check the same way** — this repo's recurring lesson is that
> capabilities exist but are unreachable from where you looked.

---

## 0. Method, and what I did not do

Everything factual about NodeGX below was **read out of this repo today**, not recalled: the node
catalog (`packages/noodl-types/src/node-catalog.json`), the backend contract
(`packages/nodegx-backend-contract/src/`), the cloud runtime, the workflow step kinds, the MCP tool
surface, and the phase docs for accessibility, code export, streaming and AI authoring quality.
Everything factual about Communauté Coiffure was read out of that repo.

I did **not** build the app in NodeGX. So the numbers about NodeGX are measured; the estimates about
effort are estimates, and are flagged as such. Two claims I checked specifically because the verdict
turns on them, and both held:

- **There is no test harness for an authored NodeGX app.** No node in the catalog matches
  test/assert/expect; no phase doc specifies one. The e2e drivers in `phase-16-runtime-deploy-health/`
  are the *platform's* drivers, not something an app author gets.
- **Workflow runs do not survive a restart.** `WorkflowEngine.ts:311-325` — an in-flight run is
  marked `interrupted`, loudly and never silently, and does not resume. Checkpoint/resume is v2.

---

## 1. The reference app, in numbers

This matters because the answer changes completely with scale, and "a complex app" is doing a lot of
work in the question.

| | Communauté Coiffure v2 |
|---|---|
| Database tables | **54** (`__tablename__` count) |
| Schema migrations | **83** Alembic revisions |
| Backend source | ~63k LOC Python (22.3k routers · 37.5k services · 3.9k pure calculations · 6.0k schemas · 3.9k models) |
| Backend tests | **71,923 LOC** |
| Frontend | 211 Svelte components, ~77k LOC, 60+ routes |
| AI surface | CoCo assistant with **24 tools**, incl. 5 that *drive the user's UI* (`fill_field`, `click_element`, `navigate_user`, `set_select`, `scroll_to_field`) |
| Second AI surface | An NL→SQL analyst: `describe_views` / `run_sql` / `make_chart`, executing model-written SQL against a real database |
| Money | Stripe subscriptions **and** a prepaid wallet charged at €28.80 TTC per payslip |
| Ingest | IMAP polling every 5 min, PDF text extraction, `.xlsx` accounting/caisse imports, a Bubble.io migration importer |
| RAG | pgvector embeddings over blog articles |
| Other | GDPR consent records, email drip engine, admin panel, PWA, i18n from day one, Sentry |

Two features deserve singling out because they are the *product*, not the plumbing:

**The calculation core** (`backend/app/calculations/`, 3,915 LOC): French social charges, RGDU
reduction, TNS estimation, auto-entrepreneur rates, versement libératoire, pricing methodology,
break-even. Its own header says: *"All calculations use Python `Decimal` — never float for
intermediate steps."* Rates carry a reform tracker keyed to décret numbers. There are regression
tests named after individual tax bugs (`test_bug_6_versement_liberatoire.py`).

**The analyst sandbox** (`services/analyst_sandbox.py`). Its docstring is the best piece of security
writing in either repo: *"The security boundary is the database, not this module."* A dedicated
Postgres role `comcoi_analyst` has `SELECT` on an `analytics` schema and **no privilege at all** on
`public`, so a hallucinated query for `public.users.password_hash` fails on a permission error
regardless of SQL cleverness. Regex validation is explicitly labelled defence-in-depth that must
never be mistaken for the boundary.

---

## 2. What NodeGX actually offers, measured

| Surface | Measured |
|---|---|
| App node vocabulary | **172** catalog types — 29 Visual, 43 Data, 22 Cloud Services, 18 Utilities, 9 Logic, 8 Navigation, 5 CustomCode, 3 String, 2 Math |
| Cloud function vocabulary | **48** types (58 registered, 10 browser-only unregistered on 2026-08-05) |
| Workflow step kinds | 15 — Call Function, Branch, Switch, For Each, Merge, Transform, Validate, Filter, Sort, Deduplicate, Split, Stop/Error, Return, Wait, Wait Until |
| Data adapter | **15 methods** (`query` `count` `distinct` `aggregate` `fetch` `create` `save` `increment` `delete` `addRelation` `removeRelation` `uploadFile` `signFileUrl` `deleteFile`) |
| Filter dialect | **31 operators**, with a declared lower-vs-gate policy so a built-in-backend user never sees greyed-out operators |
| Storage engine | **SQLite** (`node:sqlite`), one file per backend under `<dataDir>/data/local.db` |
| Access control | Per-record ACL + class-level permissions + roles + scoped API keys + read-only admin tier; a SQL predicate with a property-tested JS twin so query filtering and realtime filtering cannot drift |
| Built-in subsystems | auth · users · roles · files (local + S3 + signed URLs) · email (SMTP, templates, tokens) · realtime (SSE) · FTS search · triggers (cron / webhook / db-change) · execution history · audit log · rate limits · backups |
| Agent surface | ~35 MCP tools: read, author, validate, plan/stage/apply, provision a backend, manage permissions/roles/keys, query the audit trail |

That is a *lot* of pre-solved surface. It's important to hold that in mind while reading section 3,
because section 3 is the bad news and it would be easy to read it as the whole picture.

---

## 3. Could Communauté Coiffure be built on it? Feature by feature

Verdicts: ✅ **better than code** · 🟢 **fine** · 🟡 **workaround, costs real time** · 🔴 **not
buildable on the built-in stack today**.

| Feature | Verdict | Why |
|---|---|---|
| Auth, sessions, password reset, magic links, email verification | ✅ | 11 user nodes + backend subsystem. comcoi hand-wrote all of it. |
| Multi-tenancy (salon scoping) | ✅ | Per-record ACL + `creator-owns` + roles is *structurally* safer than comcoi's hand-written `salon_id` filter in every query — that's an IDOR class removed rather than avoided. `check_backend_access` is a server-side dry run naming the deciding rule. |
| Roles, admin panel, API keys, audit trail | ✅ | Built in, with a read-only admin credential tier. comcoi wrote `admin_audit.py` and 19 admin routers. |
| CRUD over 54 collections | 🟢 | Record / Query Records / Create / Update / Delete / relations. Schema is introspected, not migrated. |
| Forms, 60+ screens, calculators UI | 🟢 | Form, Field Set, Text Input, Dropdown, Radio, Checkbox, Range, Repeater, Router, Component Stack. Tedious but real. |
| File upload + signed URLs (payslip PDFs) | ✅ | `Upload File` / `Sign File URL`, S3 driver, orphan sweep, sigv4. comcoi wrote `object_storage.py` + boto3 wiring. |
| Scheduled jobs, webhooks, record-change reactions | ✅ | Triggers + workflows with retry policy, waits, branching **and a durable run record with an inspector**. comcoi uses APScheduler and has no run inspector at all. |
| Email drip | ✅ | Scheduled trigger → workflow → Send Email. comcoi hand-wrote a dispatcher, a registry and 7 template modules. |
| Stripe subscriptions + prepaid wallet | 🟡 | No `stripe` SDK — see §4.1. Raw `fetch` against Stripe's REST API works; webhook signature verification is doable with the HMAC node. Idempotency store exists. Costs maybe a week you wouldn't otherwise spend, and you hand-roll what a maintained SDK gives you. |
| Charts (Chart.js dashboards) | 🟡 | No chart node. `noodl_modules` custom React component, or Script Downloader + CSS. Real but off-platform. |
| Rich text blog editor (Tiptap) | 🟡 | Same answer: a custom module. |
| `.xlsx` import (Noly Compta journal, Hairnet caisse) | 🔴 | No `openpyxl`, no `require` in a cloud function. XLSX is a zip of XML; you would be writing a spreadsheet parser by hand inside a Function node. |
| PDF text extraction for payslip matching | 🔴 | Same. No `pypdf`, no way to get one. |
| Decimal money math | 🟡→🔴 | JS has no decimal type and a cloud function cannot import one. You can paste a decimal implementation into a Function node body, or work in integer cents throughout. For a product whose entire value proposition is *being right about a hairdresser's tax bill*, doing it on IEEE-754 doubles is not acceptable, and the mitigation is unpleasant enough to call a blocker. |
| pgvector RAG over blog articles | 🔴 | No embeddings, no vector index. SQLite FTS (`textSearch`) is keyword search, not semantic. Workaround is an external vector service — i.e. leaving the platform for the feature. |
| CoCo streaming chat | 🔴 | A cloud function cannot stream to the app. CWF-007 is an **unowned design doc, explicitly scheduled after alpha**. The app-side nodes exist (SSE, WebSocket, Text Accumulator, JSON Stream Parser) — the server half does not. Calling Anthropic from the browser would expose the key. |
| CoCo's 5 UI-driving tools | 🟡 | Action Dispatcher / Action Handler could carry them, but there is no equivalent of "the assistant fills field #3 on the current page" — you'd build a per-screen dispatch table by hand. |
| NL→SQL analyst | 🔴 | There is no SQL surface at all, and no way to create a least-privileged database role. The feature's security model *is* a Postgres role; the platform has no Postgres and no roles below the ACL layer. |
| SEO-indexed landing page + blog | 🟡 | **Corrected twice.** First 🔴 (wrong — SSR/SSG do ship, selectable at deploy). Then ✅ (also wrong). The *design* is good; the 887-line server template is not: it mutates `globalThis.location` per request inside an awaited settle loop (two concurrent requests render each other's routes), caches forever with no TTL keyed on path alone, renders **any** path via `app.get('*')` with no validation or rate limit, and pins React 18.3.1 while projects declare `react19`. Buildable after [phase 49](../tasks/phase-49-discovery/README.md) rewrites the server; not before. |
| i18n (FR now; BE/CH/QC/Africa next) | 🔴 | Zero i18n in the catalog. Every string is a node parameter. No string table, no locale switch. A stated day-one requirement with no answer. |
| 83 schema migrations over a year | 🟡 | Schema is managed through an admin surface, not reviewable up/down migrations in git. No data-backfill migrations. Governance gap on a 54-table app that evolves. |
| 71,923 LOC of tests | 🔴 | **No test harness exists for an authored app.** Verified: no node, no phase doc, nothing. You test by clicking. |
| Scale: "tens of thousands of hairdressers" | 🟡 | One SQLite file, one process. Backups and prod-ops exist (BAK-007/BAK-009). No Postgres, no replicas, no read scaling. Workable for thousands; a known cliff beyond. |

---

## 4. The five things that actually decide it

Most of the 🟡s above are annoyances. These five are structural.

### 4.1 A cloud function cannot import anything

Measured in TALK-007 §3.1, and it is the most consequential single fact in this comparison. A
Function node compiles via `new AsyncFunction(...)`, whose body runs in global scope. So a cloud
function gets **Node 22's globals** — `fetch`, `crypto.subtle`, `Buffer`, `TextEncoder`, `Intl`,
`WebAssembly`, all 79 env vars — and gets **no `require`, no `module`, no `import`**.

The upside is real and under-sold: hashing, HMAC, JWT, base64, UUIDs, date maths and calling any
third-party REST API with a stored credential all work today with no dependency.

The downside is that the npm ecosystem is not available at all. For this app that is: no `stripe`,
no `@anthropic-ai/sdk`, no `decimal.js`, no xlsx parser, no PDF parser. Some of those have a REST
answer. Some do not. And there is a second-order cost that is easy to miss: **there is no module
system inside the compute layer**, so 3,915 lines of interlocking calculation code cannot be
organised as a library. Each Function node's script is an island. You can centralise by making each
calculation its own cloud function and calling it — that is a legitimate architecture — but you are
paying an HTTP-shaped hop for what was a function call, and you still have no shared types.

### 4.2 There is nothing to verify against

This is the one I would put first if I could only keep one.

comcoi has 71,923 lines of tests. Not for ceremony: `test_bug_6_versement_liberatoire.py`,
`test_2_6_1_ae_tva.py`, `test_grandfathering_schema.py`. Each is a French tax edge case that was once
wrong, is now right, and is pinned so it stays right through the 2026 reform tracker.

In NodeGX there is no way to write `assert calc_rgdu(1823.03) ≈ 20.50`. Not "it's awkward" — the
surface does not exist. For a calculator product, that is disqualifying on its own, before any
argument about visual programming.

It is also the crux of the *agent* comparison in Part II, because the single most reliable behaviour
Claude Code has is "write a test, run it, iterate until green." Take that away and you take away the
mechanism that makes agentic building trustworthy rather than merely fast.

### 4.3 The data layer is a document store wearing a relational costume

15 methods, 31 operators, no joins, `Aggregate Records` for data at rest only, and a workflow value
language that explicitly serves *"No arithmetic, string interpolation or function calls. Compute in a
cloud function."*

That is a coherent, defensible design — it is why a workflow definition is safe to let an agent
write. But comcoi's monthly report joins salons, employees, salaries, primes, expenses and brand
purchases and aggregates across a fiscal window. Expressing that as N round-trips through
`Query Records` and reassembling in a Function node is both slower and more code than the SQL it
replaces, and there is no query planner to save you.

### 4.4 No i18n (SSR is fine — corrected)

Both were day-one requirements in this product's own README. **SSR is not a gap**: see the
correction at the top. NodeGX's SSR is more capable than the stated requirement, and the remaining
work there is small and specific — no sitemap generation, no `robots.txt` surface, no ISR/caching
layer, and SSG cannot enumerate dynamic routes from data.

**i18n is a real gap.** Zero i18n anywhere in the catalog or the runtime, verified. Every string is
a node parameter with no key, no string table, and no locale switch. The product's stated plan is
Belgium, Switzerland, Quebec and West Africa; the stated rule is "all strings externalised from day
one". There is no way to comply.

### 4.5 The moat lives in the part that doesn't work

Roughly 70% of Communauté Coiffure by volume is plumbing — auth, CRUD, forms, scheduling, files,
permissions, admin. NodeGX is genuinely good at all of it, in several places better than what the
Python codebase actually does.

Roughly 30% is computation and correctness — the tax engine, the analyst, RAG, streaming, the
importers. That 30% *is the company*. The plumbing is a commodity any competent team ships; the
French social-charge engine with a reform tracker is why anyone pays.

**You do not build the moat in the environment that can't test it.**

---

## 5. Where NodeGX genuinely wins, and it is not a short list

Objectivity cuts both ways. Reading §3 and §4 alone would give the wrong impression, because
comcoi's Python codebase spends enormous effort on things NodeGX simply has.

1. **Authentication and account lifecycle, gone.** Sessions, password reset tokens, magic links,
   email verification, role membership: `auth.py` + `models/auth.py` + `routers/auth.py` +
   `test_task_1_3_auth.py` in comcoi. Zero lines in NodeGX.

2. **Multi-tenancy as a structural property.** comcoi scopes by `salon_id` in application code, in
   every query, forever. One missed filter is a cross-tenant data leak of somebody's payroll. NodeGX's
   per-record ACL makes that class of bug *unwritable*, and `check_backend_access` will tell you what
   a hypothetical principal can do before you ship. This is a real safety advantage and it is
   under-claimed in the platform's own marketing.

3. **Workflows beat what most teams build.** comcoi's email drip is a hand-written dispatcher plus
   APScheduler; the payslip inbound is a 5-minute IMAP poll. Neither has a run inspector, retry
   policy, or a durable execution record. NodeGX has all three, plus a Wait Until step and a run
   history UI, out of the box.

4. **The workflow/function split is better security architecture than the alternatives.** A workflow
   is declarative JSON with a 19-operator condition language served *by the backend*, so the editor
   cannot offer an operator the backend won't evaluate, and there is no eval surface in a definition
   that executes with admin authority. Compare n8n, where orchestration and compute are one pot. This
   is a genuinely good decision and worth defending.

5. **Observability the code app doesn't have.** comcoi has Sentry and logs. NodeGX has a trace
   substrate with a provenance walk — *which node produced this value, and why*. For a domain expert
   debugging a pricing result, that is a different category of tool.

6. **Legibility to the person who owns the domain.** The pricing methodology in this product came out
   of a hairdressing consultant's Excel model. He can plausibly read a graph that says
   `cost per minute → × duration → + margin`. He cannot read `pricing.py`. For a product whose logic
   *is* one expert's methodology, that closes a review loop that is currently open.

7. **Deployment is one artifact.** comcoi is four docker-compose files, a Caddyfile, an nginx conf,
   a monitoring stack and a `DEPLOYING.md`. NodeGX's backend is a single ~690KB esbuild bundle on
   plain Node.

8. **Accessibility as a property of the emitter.** Phase 41's position — the runtime should emit
   accessible output because of what it emits, not what the author remembered — is the single
   strongest strategic argument the platform has, and it generalises far beyond a11y. WebAIM's 2026
   *Million* found 95.9% of home pages have detectable WCAG failures; every model learned from that
   corpus and reproduces its median. A framework that emits correct markup structurally beats a model
   that must remember to. (Today the runtime emits one aria attribute and deletes every focus ring —
   so this is a position, not yet a fact. But it is the right position, and it is scheduled.)

---

## 6. Verdict for Communauté Coiffure

**Build it in code. The margin is not close, and the reason is narrow and specific.**

Not because visual programming is worse. Because this app's difficulty is concentrated in exactly the
four places where NodeGX's ceiling is lowest — a compute layer with no library ecosystem, no test
harness, no SQL surface, and no streaming — and those four places are the product rather than the
packaging.

The honest counterfactual: if you had built comcoi on NodeGX, you would have reached a working
multi-tenant app with auth, 60 screens, permissions, files, email and scheduled jobs **faster** than
the Python team did — plausibly 30–40% faster to that milestone. And then you would have stalled,
permanently, at the tax engine's test suite, the analyst, the streaming assistant and the blog's SEO.
Being faster to 70% and unable to finish is worse than being slower throughout.

### What would change this verdict

Not all of these are equal; roughly in order of leverage for *this class of app*:

1. **A test harness for authored apps** — the ability to assert on a cloud function's output and run
   it in CI. Nothing else on this list matters as much, and it is the cheapest of the four large ones.
2. **Imports in a cloud function** — even a curated, vetted allowlist of ~20 packages (a decimal
   library, an xlsx reader, a PDF reader, Stripe) would move three 🔴s to 🟢.
3. **Streaming from a cloud function** (CWF-007) — table stakes for any LLM product in 2026, and the
   design is already written.
4. **i18n** — cheap relative to the others, and it gates every non-English-speaking market.
5. **SSR polish** — sitemap, `robots.txt`, ISR. The engine is already there; these are the edges.
6. **A Postgres adapter** — the contract already has translators for four external backends, so the
   seam exists; this is the scale answer.

With 1, 2 and 3, the verdict for this app flips to *"genuinely arguable"*. With all six it flips to
*"probably NodeGX"*, because §5 does not go away when §4 is fixed.

---

# Part II — Claude Code + NodeGX vs. Claude Code + code

This is the more interesting question, and it is not the same question. A tool can be worse for a
human and better for an agent, or the reverse.

## 7. Where NodeGX is genuinely better *for the agent*

**A closed, enumerable vocabulary.** 172 node types with enriched semantics, `whenToUse`, and
validated example fragments. Contrast npm: unbounded, versioned, and the single richest source of
model hallucination there is. An agent authoring NodeGX cannot import a package that doesn't exist,
cannot pick a version with a CVE, and cannot invent an API signature. That eliminates an entire
failure mode, not just reduces it.

**Write-time validation that teaches.** Every MCP write is JSON-schema validated, then semantically
validated with unknown node types promoted to errors, and **nothing is written on rejection**. The
rejection carries a `suggestion` and `alternatives` — literally *"did you mean `Group`?"*. That is a
tighter, cheaper feedback loop than "write TypeScript → run `tsc` → parse the output", and it happens
before any bad state exists. Pre-existing errors don't block edits ("don't make it worse"), which is
exactly the right policy for an agent working in a real codebase.

**Transactional multi-file changes.** `create_plan` → `stage_plan_operation` → `apply_plan` validates
each operation against the project *plus the plan's other staged operations*, applies all-or-nothing,
and a discarded plan leaves the project byte-identical. Compare the code equivalent: the agent edits
14 files, 3 are wrong, and unwinding is `git checkout` if you're lucky and manual if you're not.

**No environment.** No `npm install`, no lockfile drift, no venv, no Docker build, no "works on my
machine". A meaningful fraction of Claude Code's wall-clock time on real projects is environment
management, and it is entirely absent here.

**The backend arrives in one call.** `provision_backend` creates, starts and binds a backend with
collections pre-seeded. In comcoi, an agent writes 22.3k lines of routers and 6.0k lines of Pydantic
schemas — a large share of which is the same data model restated three times (SQLAlchemy model →
Pydantic schema → TypeScript type). NodeGX has one shape and no restatements. Three-way drift between
those restatements is one of the most common real bugs in typed full-stack codebases.

**Structural correctness beats remembered correctness.** ACLs instead of hand-written tenant scoping.
A workflow that cannot eval. Accessible output by emission. Each of these converts "the agent must
remember" into "the agent cannot get it wrong" — and given the WebAIM statistic, that is the more
reliable of the two mechanisms by a wide margin.

## 8. Where NodeGX is worse *for the agent* — the honest core

**The agent cannot see its work.** The pipeline is one-directional: plan → author → apply.
`AAQ-007` is literally titled *"the agent sees its work"* and is not built; `AAQ-004` records that
nothing persists an in-editor build conversation. In code, the loop is: run it, screenshot it, read
the stack trace, fix, re-run. That loop is the difference between an agent and a code generator, and
right now NodeGX supports the generator half.

**Verification has no bottom.** §4.2 again, from the agent's side. Claude Code's most trustworthy
mode is red→green. Without a test harness there is no green, so every claim of correctness is an
assertion rather than a demonstration. This repo's own history is the evidence: recorded incidents
include catalog gates that read the working tree and went green while `HEAD` advertised an
unregistered node, and a font check that passed twice while the wrong font shipped. If the platform's
own gates can go green wrongly, an agent with no gates at all should not be trusted about a tax
calculation.

**Diffs are ids, not names.** The v2 format was explicitly designed for readable diffs and it is a
real improvement over a 4MB `project.json`. But a wire change still reads
`{"fromId":"n3","fromProperty":"onClick","toId":"nav7",...}`. Human code review is a mature social
practice with 40 years of tooling; graph review is not, and the agent's own strongest analytical
skill — reading a diff and reasoning about intent — is weaker on identifiers than on named code.

**Density degrades badly.** comcoi's month-detail page is 1,679 lines with ~40 reactive statements
and 6 child components. As a graph that is several hundred nodes and roughly as many wires, on one
canvas, with `parent`/`children` double-bookkeeping to maintain. An agent emitting 1,679 lines of
Svelte is routine. An agent placing 600 nodes correctly is a different and much more fragile
proposition. Node graphs are superb at 30 nodes and poor at 600; code's legibility degrades far more
gracefully with size.

**The quality gap is measured, and it is yours.** Phase 40 exists because a real end-to-end build
through the AI wizard produced, in the maintainer's own words, *"basic shit creations that nobody will
believe was worth switching from Claude Code"* — with the bar set at *"legendary creations rivaling
the best Opus landing page artifacts"*. Twelve findings from one session. The diagnosis is honest and
mostly *not* about the model: pages weren't registered in the Router because nothing in the AI stack
mentions the Router; every page was born unscrollable because `bodyScroll` defaults off; the planning
prompt actively argued against component decomposition. Those are seam bugs, and seam bugs are
fixable. But until they are fixed, the comparison is being made against Claude Code writing React,
which has no such seams.

**Escape hatches are asymmetric.** On the client, `noodl_modules` lets you drop in a real React
component and the ceiling lifts. In the compute layer there is no equivalent — §4.1 — so when the
agent hits the ceiling on the server it has nowhere to go but out of the platform entirely.

## 9. The two ledgers, side by side

**Claude Code + NodeGX**

| Pros | Cons |
|---|---|
| Closed 172-type vocabulary — no hallucinated APIs or packages | Cannot run, see, or screenshot what it built |
| Validation before write; nothing bad ever lands | No tests, therefore no proof of anything |
| Atomic, discardable multi-component plans | Diffs are node ids; human review is harder |
| Zero environment/dependency management | Falls off a legibility cliff past ~200 nodes/component |
| Backend provisioned in one call; no 3-way model restatement | No imports server-side — ceiling has no escape hatch |
| Whole classes of bug structurally unwritable (tenancy, eval-in-orchestration) | Known seam defects still being closed (phase 40) |
| Auth/files/email/roles/scheduling/audit already exist | No i18n, no server→app streaming, SQLite only |
| Domain expert can review the logic | Graph review is not an established practice for anyone |

**Claude Code + React/Svelte + FastAPI + Postgres**

| Pros | Cons |
|---|---|
| Red→green verification — the agent can *prove* it works | Must write and maintain auth, tenancy, files, email, scheduling from scratch |
| Full npm + PyPI: Decimal, Stripe, Anthropic SDK, pypdf, openpyxl | Dependency surface = supply-chain risk + upgrade tax + hallucination surface |
| Diffs are code; review is a solved practice | Environment management eats real agent time |
| Density scales — 1,679-line files are unremarkable | Tenant scoping is remembered, not enforced — one missed filter is a breach |
| Real SQL: joins, window functions, least-privilege roles | Same data model restated 3× with drift between restatements |
| i18n, PWA, streaming all solved by the ecosystem | No run inspector, no provenance, no built-in audit trail |
| Postgres scales past one box | Accessibility depends on the model remembering — 95.9% of the web says it won't |
| Every senior engineer can maintain it | Domain expert cannot read or verify the business logic |

## 10. The rule I'd actually apply

Not "visual vs code". **Where does the app's difficulty live?**

- **Difficulty in plumbing** — CRUD, auth, forms, lists, roles, a scheduled job, a webhook, a file
  upload, an admin panel: **NodeGX wins**, for a human and for an agent, because the plumbing is
  pre-solved and largely unwritable-wrong. This is most internal tools, client portals, ops
  dashboards, and a surprising amount of commercial SaaS.
- **Difficulty in computation and correctness** — decimal money math, 83 migrations, a regression
  suite, an NL→SQL sandbox, streaming, vector search, SEO: **code wins**, and it isn't close.

Communauté Coiffure is 70/30 plumbing to computation, and the 30 is the whole business. So: code.

Concretely, my honest sizing for this app:

| | NodeGX | Code (as built) |
|---|---|---|
| To a working multi-tenant app with auth + 60 screens + CRUD | **~30–40% faster** | baseline |
| To the tax engine, verified | not reachable | done, with 72k LOC of tests |
| To the AI analyst | not reachable on the built-in backend | done |
| To streaming CoCo | not reachable today | done |
| To an SEO-indexed blog | ✅ reachable — SSR mode | done |

## 11. The architecture I'd actually recommend if you insisted on NodeGX

There is a real hybrid, and it is not a fudge.

**NodeGX owns the app surface and the plumbing:** all 60 screens, auth, multi-tenancy via ACLs,
CRUD over the 54 collections, file upload for payslip PDFs, roles and the admin panel, the email drip
as a scheduled workflow, the payslip approval flow as a workflow with waits and retries.

**A small Python service keeps the engine:** `calculations/` unchanged with its `Decimal` and its
71,923 lines of tests; the analyst with its `comcoi_analyst` Postgres role; the xlsx and PDF
importers; the embedding pipeline; the streaming CoCo endpoint.

**They join over HTTP.** A cloud function calls the Python service with the `HTTP Request` node and a
`Secret`-node credential. This is exactly the join the backend authoring model already describes —
*"a workflow orchestrates, a cloud function computes"* — with one more level: a cloud function
delegates the hard computation to a service that can be tested.

You would get NodeGX's plumbing advantages and keep the moat testable. The honest costs: two deploy
targets, two auth models to reconcile (NodeGX session token vs. the service's own), no shared types
across the boundary, and the frontend still has no i18n — so a multilingual rollout stays blocked
until that lands. The marketing site and blog can stay inside NodeGX, on SSR.

## 12. What this says about positioning

The comparison flatters NodeGX everywhere the work is *structural* and punishes it everywhere the
work is *computational*. That is a coherent identity, and it suggests the pitch is not "replace
Claude Code" — a fight decided by the test harness NodeGX doesn't have — but:

> **The parts of an app that every team rebuilds and half of them get wrong, you don't build at all.
> And the agent that builds the rest cannot get the tenancy, the eval surface, or the accessibility
> wrong, because the platform won't let it.**

That is a true claim today, and it is a better claim than a speed claim, because speed is the one
axis where a frontier model writing React is already very hard to beat.

The class of app to aim at is the 2-to-8-week multi-tenant business app whose logic is CRUD plus
moderate rules, built by or with someone close to the domain — not the 12-month product whose value
is a computation. Communauté Coiffure is emphatically the second kind, which is why it is a good
stress test and a bad flagship.

---

## Appendix — the evidence, so this can be re-checked

| Claim | Source |
|---|---|
| 172 catalog node types, by category | `packages/noodl-types/src/node-catalog.json` |
| 48 cloud node types; no `require` in a Function node; 79 env vars readable | `dev-docs/tasks/phase-42-first-hour/TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md` §1, §3.1 |
| 15 data-adapter methods; 31 filter operators | `packages/nodegx-backend-contract/src/data.ts`, `src/filter.ts` |
| SQLite (`node:sqlite`), one file per backend | `packages/nodegx-backend/src/persistence/createAdapter.ts` |
| Workflow runs do not resume after restart | `packages/nodegx-backend/src/workflow/WorkflowEngine.ts:311-325` |
| Streaming is an unowned design doc, post-alpha | `dev-docs/tasks/phase-42-first-hour/CWF-007-STREAMING-RESPONSES.md` |
| Code export 0/7 tasks, not started | `dev-docs/tasks/phase-18-code-export-v2/PROGRESS.md` |
| No test node exists in the catalog | catalog query, 2026-08-06 — zero matches for test/assert/expect |
| ACL + CLP + roles + read-only admin tier | `packages/nodegx-backend/src/security/model.ts` |
| ~35 MCP tools incl. plans and provisioning | `packages/noodl-mcp/README.md` |
| Runtime emits one aria attribute; 95.9% WCAG failure rate | `dev-docs/tasks/phase-41-accessibility/NORTH-STAR.md` |
| *"basic shit creations…"* and the 12 findings | `dev-docs/tasks/phase-40-ai-authoring-quality/README.md` |
| 54 tables, 83 migrations, 71,923 LOC of tests | `comcoi-v2` — `__tablename__` count, `alembic/versions/`, `wc -l backend/tests` |
| Analyst security boundary is a Postgres role | `comcoi-v2/backend/app/services/analyst_sandbox.py` docstring |
| `Decimal`, never float | `comcoi-v2/backend/app/calculations/social_charges.py` header |
