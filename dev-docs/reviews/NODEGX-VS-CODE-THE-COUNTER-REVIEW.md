# Counter-review: the hard-skeptic position

**Written:** 2026-08-06
**Author:** a commissioned adversarial reviewer — brief: senior full-stack engineer, 15 years, daily
Claude Code user, two completed escapes from low-code platforms, hired to scope Communauté Coiffure
and find the roadblocks rather than be fair to a tool.
**Commissioned because:** the first two comparisons
([today](NODEGX-VS-CODE-A-REAL-APP.md), [built world](NODEGX-VS-CODE-THE-BUILT-WORLD.md)) were
written from inside this repo, using its own docs as evidence, and inherited its framing of what
counts as a problem. Richard's call, and it was correct.

## Verification note — read this before the review

I re-checked the claims this review turns on, independently, against source and by measurement.
**Every one held.** Specifically:

| Claim | Verified |
|---|---|
| SSR mutates `globalThis.location` per request inside an awaited settle loop | ✅ `static/ssr/server-core.js:53-59` |
| SSR cache is `new NodeCache()` with no TTL, keyed on path alone, `set` with no expiry | ✅ `static/ssr/index.js:10-17, 83-84` |
| `app.get('*')` renders any path with no route validation | ✅ `static/ssr/index.js:79` |
| The SSR template pins React 18.3.1 while the repo resolves 19.0.0 | ✅ `static/ssr/package.json` vs `node_modules/react` |
| `agent-chat` — the AI flagship — is 262 nodes with **0 labelled**, largest component 83 | ✅ measured |
| 1,496 of 1,557 commits by one author (96%); 1,486 unpushed; `origin/main` last moved 2025-09-09 | ✅ `git shortlog`, `git rev-list` |
| `node:sqlite` has no `interrupt`, no async API, no statement timeout | ✅ probed on v22.22.0 |
| comcoi: 276 commits, first 2026-04-10 → live paying product in under four months, one person | ✅ `git log` |

**The meta-finding is the one that stings and it is correct.** The "today" document was wrong about
SSR, corrected itself, and drew the lesson *"I was too pessimistic — re-check the 🔴s."* The right
lesson was *"I trusted a capability's existence as proof of its quality."* SSR exists; it also races
on process globals, caches forever on a path key, renders any URL an attacker sends, and
server-renders React 19 under React 18. My correction turned a false negative into a false positive.

Two things this review found that **neither** of my documents mentioned at all, and both are
first-order:

1. **Vendor and concentration risk** (§B.1) — and the sharpest form of it: the sole maintainer of
   NodeGX and the sole author of Communauté Coiffure are the same person. That is a calendar
   argument, not a platform-quality argument, and for this app it may be decisive.
2. **Two engineers cannot edit one component** (§B.2) — structural merge conflicts are shown and
   dismissed, not resolved.

Where the two positions are now placed side by side, axis by axis, see
[NODEGX-VS-CODE-THE-SPECTRUM.md](NODEGX-VS-CODE-THE-SPECTRUM.md).

The review follows verbatim.

---

## A. Claims that are wrong or overstated

**WRONG** = false against source. **OPTIMISTIC** = directionally true, materially under-costed.

### A.1 — WRONG: "SEO-indexed landing page + blog | ✅ … Better than most visual builders offer at all"

The SSR server template is 887 lines. Four defects; three are correctness bugs, not gaps.

**1. Not concurrency-safe.** The per-request render mutates two process globals (`server-core.js:53`,
`:56-59`), then awaits a settle loop yielding at least ten `setTimeout(…,1)` turns and up to 3,000
(`render-gate.js:33-34, 53`), plus a `PAGE_READY_TIMEOUT` defaulting to 10s (`index.js:55`). Express
serves concurrently. Two overlapping requests both write `globalThis.location`; the second wins; the
first renders the second's route. No mutex, no async-local storage, no per-request context. The
code's own comment calls `Noodl.SEO` *"a per-process singleton reused across requests"* — stated as
design, not caveat.

**2. The cache never expires and is keyed on path alone.** `new NodeCache()` (`index.js:10`) —
`node-cache`'s documented default is `stdTTL: 0`, unlimited — and `set()` is called with no TTL
(`:17`), keyed `cache__${path}` (`:83`). Each path renders once and is served until the process
restarts. Not SSR: a build-on-first-request permanent cache. The key ignores query string, locale,
cookies and principal.

Compose 1 and 2: a wrong-page render caused by the race is cached forever under the wrong key. Add
`runtime-globals.js:66`, which installs **one process-wide `localStorage`** whose own comment
(`:77-78`) says the runtime uses it for `localStorage['Parse/<appId>/currentUser']`. I cannot
demonstrate an end-to-end session leak — the SSR path forwards no cookies, so it renders anonymous —
but every ingredient of cross-tenant cache poisoning is present in 100 lines of a shipped template,
in the exact subsystem the review upgraded from 🔴 to ✅. **The bug class the built-world document
calls structurally impossible ("Forgotten tenant scoping → Impossible — ACLs") is architecturally
available in the platform's own SSR server.** ACLs protect the data layer. They do not protect a
response cache.

**3. A free denial-of-service.** `app.get('*', …)` (`index.js:79`) renders *any* path. No route
validation, no rate limit. Each unknown path costs a full runtime boot plus a settle loop bounded at
3,000×1ms, then stores an HTML document in an unbounded in-memory cache. A loop over `/a1`, `/a2`, …
exhausts memory and pins the event loop. A blog with 10,000 slugs does the same without an attacker.

**4. Server-renders under the wrong React.** `react`/`react-dom` are webpack `externals`
(`webpack.common.js:6-9`, `webpack.ssr.common.js:31-34`), so the deploy bundle reads
`globalThis.React`. The SSR template supplies it from its own `package.json`, pinned `^18.3.1`. The
repo resolves 19.0.0 and projects declare `runtimeVersion: "react19"`. A React-19 project is
server-rendered by ReactDOMServer 18 and hydrated by React 19 — not a supported configuration in any
React release. Also present: `xmlhttprequest@^1.8.0`, the abandoned XHR polyfill, load-bearing for
every data node during SSR (`runtime-globals.js:63-64`).

**Consequence for phase 49.** DIS-004 is scoped as *"SSR renders every request… should not re-run the
graph for every visitor"* — 1 week. The premise is backwards: it renders once and never again. The
work is removing a broken cache, adding request isolation, adding principal-aware keys, and bounding
the render. Not one week, and not "polish on an engine that already exists."

**Verdict:** 🟡 with a named defect list, not ✅.

### A.2 — WRONG: "the four sources of nondeterminism… closed by construction" (phase 46)

True today for a graph with no Function nodes. False the moment phase 44 ships — **and the roadmap
ships 44 first, deliberately.** Once a cloud function can `require('./lib/social-charges')`, `lib/`
is arbitrary CommonJS: `Date.now()`, `Math.random()`, `crypto.randomUUID()`, host-locale `Intl`,
`process.env` — none of them catalog nodes, none enumerable. You are back to Python's problem
exactly, whose answer is `freezegun` plus a habit. Phase 46 does not spec it.

The index names the 44/46 tension as *"a bigger foot-gun"* — a volume argument. The sharper one:
**44 does not merely give 46 more work, it invalidates 46's central design claim**, which both
documents quote as a differentiator.

### A.3 — WRONG: DAT-003's view namespace is "arguably cleaner" than a Postgres role

That framing counts one layer. comcoi's boundary is five:

| Layer | Where |
|---|---|
| `SELECT` on `analytics`, `REVOKE ALL` on `public` | `072_analyst_role_grants.py:101-125` |
| `default_transaction_read_only = on` at **role** level | `:118-125` — survives any connection |
| `statement_timeout = '5s'` at role level, per connection, **and** per transaction | `072`; `analyst_sandbox.py:96-113, 303-309` |
| `idle_in_transaction_session_timeout = '10s'` | same |
| 500-row cap + explicit `ROLLBACK` in `finally` | `analyst_sandbox.py:285, 341-346` |

DAT-003 replaces layer one. It cannot replace two through four — **not a scheduling matter, not
implementable on the chosen engine.** Probed on the platform's own Node v22.22.0:

```
DatabaseSync methods: open, close, prepare, exec, function, location,
  aggregate, createSession, applyChangeset, enableLoadExtension, loadExtension
```

No `interrupt()`, no progress handler, no statement timeout — and `DatabaseSync` is *synchronous*. A
model-written query joining three views without a usable predicate runs to completion on the
single-threaded event loop and **blocks every other request for every other tenant.** In comcoi the
same query is killed at 5,000ms by the database, and the sandbox classifies SQLSTATE `57014` as
`error_kind: "timeout"` and hands the model a French retry message
(`analyst_sandbox.py:259-265, 332-333`).

An adversarial suite tests a namespace. It cannot test a resource boundary that does not exist.
**The analyst is 🟡 in the built world, not ✅** — you get the privilege boundary, not the
availability boundary, and for multi-tenant SaaS the availability boundary is the one that pages you
at 3am.

The same probe: Node prints `ExperimentalWarning: SQLite is an experimental feature and might change
at any time`. The entire data layer sits on an API whose vendor reserves the right to break it.

### A.4 — OPTIMISTIC by 2.5×: "1,679 lines… several hundred nodes"

Both documents build the density argument on the **fourth-largest** page. The largest is
`(app)/mon-mois-typique/+page.svelte` at **4,129 LOC** — 2,139 script — with 24 `$:` blocks, 34
top-level `let`s, 73 function bodies, 65 `{#if}`, 14 `{#each}`, 23 `bind:`, 59 `on:` handlers and
three child components. Distribution: 33 files over 500 LOC, 74 over 300.

Calibrated against what this platform has actually built — every complete example project in the
repo:

| Project | Components | Total nodes | Largest component |
|---|---|---|---|
| `project-examples/agent-chat` (the AI flagship) | 7 | **262** | 83 |
| `library/prefabs/table` | 11 | 83 | 19 |
| `dev-docs/qa-fixtures/nodegx-qa-fixture` | 21 | 45 | 6 |

**The largest component ever authored in this repository is 83 nodes**, and 65 of those (78%) are
`Text` and `Group` — pure layout scaffolding carrying no logic. That ratio *is* the density problem:
a graph spends most of its canvas on the part of a UI that is cheapest in text.

Extrapolating the observed markup-to-node ratio, `mon-mois-typique` is **700–1,500 nodes on one
component**, plus as many wires, plus `parent`/`children` double-bookkeeping on each. Both documents
say "several hundred." The honest statement is not "graphs are poor at 600 nodes" — it is **"nobody
has ever tried."**

To be fair: the *renderer* is fine. PLAT-001 records ~2,900-node corpora at 10.4ms worst-case frame
time. This is legibility and review, not frame rate. See §D.6.

### A.5 — WRONG: "the v2 format was explicitly designed for readable diffs and it is a real improvement"

Per-component files improve *granularity*, not *legibility*, and the difference is the argument. Node
IDs are raw UUIDv4. An actual wire from the flagship AI-authored example:

```json
{"fromId":"59756b87-c634-4c77-80e1-6a3d6b8d76a1","fromProperty":"onTextChanged",
 "toId":"8466e2dd-7aef-47f1-8068-a1b85a27741b","toProperty":"in-Prompt"}
```

To know what that does you resolve two UUIDs against `nodes.json`. So does `nodes.json` help?
**18 of 390 nodes across the three complete examples carry a label (4.6%). In `agent-chat` — the
AI-authored one — it is 0 of 262.** Resolving yields "a `net.noodl.controls.textinput`" on a page
with nine buttons.

GraphDiffPanel does not close this. GitHub's PR view, `git log -p`, `git blame`, `git bisect`, a
review bot, and every reviewer on a phone see the raw artifact. The built-world doc says review is
"narrowed" by the panel — narrowed *inside the editor*, on the machine with the project open, for
the one person already there. Every other consumer of your history gets UUIDs.

Compounding: **paste remints IDs** (`NodeGraphNodeSet.ts:40`). It must — duplicates would corrupt the
graph — but duplicating a component produces a diff in which nothing correlates with anything.

### A.6 — OPTIMISTIC: "71,923 → ~35,000 — roughly half tested infrastructure NodeGX warrants"

The arithmetic is unsupported. Sampling the largest of 209 test files: `test_billing_alerts.py`
(1,033), `test_task_2_30_5_next_best_offer.py` (872), `test_task_1_9_coco.py` (869),
`test_task_2_13_3_payslip_inbound.py` (794), `test_task_2_31_3_analyst_agent.py` (745) — product
logic and integration over Stripe reconciliation, IMAP, an LLM tool loop, an NL→SQL agent. Phase 46
Tier 1 covers **cloud functions only**; Tier 3 is explicitly "not now." The tests that survive are
the pure ones; the ones you lose pinned the integrations — including the incident recorded in
`test_billing_account_reconciliation.py:5-12`, five paying customers dropped from a cohort census
because a second Stripe customer record existed.

And *"NodeGX now warrants it"* is the sentence that always precedes an outage. The infrastructure you
stop testing is infrastructure maintained by someone else — §B.1.

### A.7 — OPTIMISTIC: "strings are already discrete addressable parameters. Extraction is a walk."

The extraction is. The *keys* are the problem: INT-001 derives them from *"component path + node id +
port"*, and node ids are UUIDs. So a key is `Pages/Home/4fa882ec-…/text`.

1. **A translator sees an opaque key.** comcoi's `fr.json` has **3,905 leaf keys** across 95
   namespaces; `en.json` is at 1,729 — **44% covered**, silently falling back. That is the real
   target, handed to a freelancer as GUIDs.
2. **Moving or renaming a component orphans every translation in it** — the path is in the key.
3. **Duplicating a component discards its translations** — paste remints the node id (A.5).

INT-001 correctly warns against a key containing the string it keys (the POL-013 trap), then chooses
a key containing two things that change under ordinary authoring. Same trap, different payload.

### A.8 — OPTIMISTIC: "Deployment is one artifact… a single ~690KB esbuild bundle"

That is the *backend*, and it is a genuine advantage. Nobody states the client number, and the client
is what a hairdresser on a phone downloads. The checked-in deploy runtime
(`external/deploy/noodl.deploy.js`) is **13.68 MB raw, 3.32 MB gzipped, unminified** — webpack
bootstrap comments intact. Three copies in the tree (`deploy/`, `ssr/`, `viewer/`), ~102,000 lines
each, checked into git, and this repo's operational memory records nothing rebuilds them. React is
external on top.

I did not verify what the production path emits — `webpack.deploy.prod.js` may minify. But there is
**no bundle-size gate anywhere in CI** (I read all of `.github/workflows/pr.yml`), so the number is
unmeasured by the people shipping it. For a consumer SaaS with a stated SEO strategy, "unmeasured"
is the finding.

### A.9 — Overstated framing: "Every capability blocker falls"

Defensible read literally against the phase docs; not defensible read as it will be read. Two of the
ten phases listed as shipped have **no estimate and no task breakdown**:

- **Phase 41 (accessibility)** — `README.md` and `NORTH-STAR.md`, no task table; the index lists its
  weeks as "scheduled."
- **Phase 40 (AI authoring quality)** — no estimate, no total, exit criterion *"Richard judges;
  'passes validation' is explicitly not the bar."*

Phase 40 supplies AAQ-007 ("the agent sees its work"), which the built-world doc's §6 calls one of
*"the two rows that mattered"* in the entire agent comparison. **The most load-bearing capability in
the strongest conclusion has the least defined completion condition on the roadmap.**

---

## B. The roadblocks neither document mentions

### B.1 — Vendor risk, and it has already happened to this exact codebase

Neither document contains "maintainer", "bus factor", "fork" or "abandoned". `git` says:

| | |
|---|---|
| Total commits | 1,556 |
| By Richard Osborne | **1,493 (96%)** |
| Next contributor | Eric Tuvesson, 27 |
| First commit | 2024-01-26, Michael Cartner |
| Commits 2024-12 → 2026-01 | **5, across 14 months** |
| Commits in 2026-07 + 08 | **1,368 (88% of all history)** |
| Unpushed vs `origin/main` | **1,485** |
| Last commit on public `origin/main` | **2025-09-09** |
| Published npm packages | **none** (`@noodl/runtime`, `@noodl/mcp` → 404) |

The lineage: Noodl, commercial, discontinued by its owner; OpenNoodl, the GPL fork, opened Jan 2024;
dormant fourteen months; revived six weeks ago by one person with an AI agent. **The platform you
would bet a payroll SaaS on has already been abandoned once by a better-resourced owner.**

Second-order, and worse:

- **Nothing is published.** No package to pin, no semver, no changelog. You vendor a git SHA off a branch.
- **Nothing is pushed.** 95% of the codebase exists on one laptop — including, incidentally, both documents I am reviewing.
- **The public artifact is 11 months stale.** Any acquirer, investor, auditor or new hire looks at the GitHub repo, sees September 2025, concludes the platform is dead, and you spend that meeting explaining that the good version is on someone's laptop.
- **You adopt more code than you own.** Platform source is **1,010,003 LOC**, ~620,000 of it three checked-in copies of a generated bundle; call it **~390,000 hand-written**. comcoi is ~250,000 including tests. **1.5× your own codebase as an unvendored, unpublished, single-maintainer dependency you cannot realistically fork-and-fix**, because fixing it means understanding a graph runtime, a Canvas2D editor and a bespoke backend.
- **Licence ambiguity.** Root `package.json` says `GPL-3.0-only` and the README calls it a GPL-3.0 fork; runtime packages declare MIT; `noodl-viewer-react/LICENSE` is MIT © Future Platforms AB. The practical answer is probably benign — editor GPL, shipped runtime MIT, your app uninfected — but it is unresolved *in the repo*, and IP diligence will make you resolve it in writing, with a lawyer, on their timeline.

**Cost:** unbounded. **Evidence I would want:** a published semver-tagged npm release; a second maintainer with commit rights who has landed non-trivial work; the public default branch matching what you build against; a written support/EOL policy; and a fork-and-maintain cost estimate you have actually done.

**And the sharpest form is not vendor risk — it is concentration risk. The sole maintainer of NodeGX
and the sole author of Communauté Coiffure are the same person.** Every week on phase 44 is a week
not on the product. That is a calendar, not a supply chain.

### B.2 — Two engineers cannot edit the same component

`MergeConflicts.tsx:10-17`, the platform's own words:

> *"value conflicts (parameters, state values and transitions, labels, variants) are applied to the
> live project. **Structural conflicts** — a node one side deleted and the other edited, cross-side
> reparents, rewiring against a deleted node — **are shown for review and dismissed, not
> auto-applied**… Take the other side wholesale by re-running the merge if that is what you want."*

If Alice adds a node to `/Pages/Dashboard` and Bob reparents a sibling in the same component, **there
is no merge.** You take one side of the whole component and redo the other by hand. In git that is a
three-line conflict resolved in forty seconds; here it is "somebody's afternoon is deleted."

This worsens with the AI story. An agent's characteristic output is a large structural change to one
component. The built-world doc celebrates that plans are *"atomic and discard byte-identically"* —
true within one apply, irrelevant to two humans and an agent on one branch. **The property that makes
agent authoring safe in isolation is the property that makes it unmergeable in a team.**

Compounding: the editor is Electron-only. No browser editor, no collaborative session. The only
concurrency model is git, on an artifact git cannot three-way-merge structurally.

**Cost:** for a two-person team, a full day a week of coordination and rework, forever, plus a "one
person per component at a time" practice you will forget under deadline. **Evidence I would want:** a
demonstrated three-way structural merge of two independent node additions to one component, reviewed
as a diff.

### B.3 — What a 3am incident actually looks like

Credit first: `nodegx-backend/src/ops/logger.ts` is genuinely good — one-line JSON on stdout,
`ts`/`level`/`event` first so `jq` and `grep` both work, request IDs, and every field through
`redact()` so a caller *cannot* log a secret. Better than most FastAPI codebases including comcoi's,
and both documents undersell it.

Now the part neither mentions. **The trace substrate is an editor feature.** It runs against a project
open in Electron on a developer's machine. At 3am you have a JSON log line, an execution-history row,
and a graph you cannot attach a debugger to. No breakpoint on a wire in production. No `pdb` into a
Function node on the box. No stack trace naming a business operation, because the identifiers are
UUIDs (A.5).

- **A cloud function's timeout cannot stop a spinning function.** `timeoutMs` is per-function,
  `0 = no limit` (`admin-security.ts:243, 286`). But a Function node is `new AsyncFunction` on the
  host event loop and the SQLite handle is `DatabaseSync` — synchronous. A tight loop or slow
  synchronous query cannot be interrupted from the same thread. Your mitigation is restarting.
- **A restart kills in-flight workflows** (`WorkflowEngine.ts:311-325`) — marked `interrupted`, no
  resume, and checkpoint/resume is on no phase in the index. So your remediation for the previous
  bullet destroys work in progress, and the payslip approval flow the review recommends modelling as
  a workflow with waits is exactly what dies.
- **You cannot roll back to a known-good artifact**, because there are none (B.1).

**Cost:** MTTR at 3–5× the code baseline for the first year. **Evidence I would want:** one recorded
production incident on a NodeGX app, alert to root cause, with the timeline.

### B.4 — Onboarding engineer #4, and what "the AI built it" means for whoever inherits it

Both documents name the talent pool and treat phase 18 as the mitigation. Neither names what actually
bites: **comprehension latency for a person already in the room.**

In comcoi the moat is legible. The RGDU reduction — the most valuable 60 lines in the company
(`social_charges.py:234-293`):

> *"Formula — décret n°2025-887 du 4 septembre 2025 (JORFTEXT000052194026). [Source:
> Lefebvre-Dalloz, Editions Tissot, Baker Tilly — all three cite same values]"*
>
> *"WHY T_DELTA changed (0.3781 → 0.3773 for <50): The 2026 reform (LFSS 2025) suppressed the reduced
> taux for maladie (7%→13% flat)… reducing RGDU at SMIC by ~€17/year — negligible in practice but
> technically required to match the official formula."*
>
> *"WHY float for the power operation: Python Decimal does not natively support non-integer
> exponents…"*

The arithmetic is six lines. **The asset is the forty-five lines of prose around it** — a citation, a
changelog of a French social-security reform, and a documented deliberate precision compromise. That
prose has a home because it is a docstring in a file.

In a graph there is nowhere to put it. A wire has no comment field. A parameter has no citation
field. Node comments exist and export is specced (EXP-006) — but 4.6% of nodes in this repo's own
examples carry even a *label*. MOD-009's `lib/` solves this for the calculation core, and I credit it
in §D. The other 70% — orchestration, forms, conditional visibility, the reasons a field is disabled
for auto-entrepreneurs — lives in the graph, and the graph has no place for *why*.

The AI dimension makes it acute. **`agent-chat`, the repo's demonstration of AI authoring, has 0 of
262 nodes labelled.** Engineer #4 inherits several hundred UUID-identified nodes, no labels, no
comments, no meaningful commit message because the diff was UUIDs, and a wire topology encoding a
decision nobody wrote down. In code, an agent producing 1,679 unexplained lines still produces
*named functions*, and `grep` works. The floor is higher.

**Cost:** double the ramp for a new engineer, plus a permanent "only two people understand the
dashboard" risk. **Evidence I would want:** hand a 200-node AI-authored component to an engineer who
has never seen NodeGX and time them to a correct one-line behaviour change.

### B.5 — Platform upgrades have no compatibility contract

A project records `runtimeVersion: 'react17' | 'react19'` (`projectmodel.ts:125`). That is it. No
catalog version, no runtime semver, no compatibility range.

So NodeGX fixes a node's default — this repo's most-repeated recorded trap is *"a declared `default`
never runs its setter"* — and every deployed app's behaviour changes on next build, silently, with no
version to pin and no migration to write. npm gives you a semver major and a changelog. Here you get
a git SHA and a hope.

Note also `react17` is still a supported runtime and React 17 is EOL. Two React runtimes maintained,
a third (18.3.1) shipped in the SSR template — **three React versions in one product's shipping
surface** (A.1).

**Cost:** every platform bump is a full-regression event with no suite to run it against until phase
46, and no changelog even then.

### B.6 — A security audit will not go the way you expect

Credit: the security *model* is good — per-record ACL + class permissions + roles + scoped keys + a
read-only admin tier, with a SQL predicate and a property-tested JS twin so query and realtime
filtering cannot drift. Better architecture than comcoi's. See §D.

What an auditor will find:

1. **A cloud function has full authority on the box, and the platform says so.** Phase 44 README §2,
   unprompted: *"`process.env` is readable in full… `process.exit` is callable… An author who can
   write a Function node already has close to unlimited authority on that box."* MOD-005 then
   explicitly **rejects** a sandbox as "dishonest." I agree with the honesty and note the uncosted
   consequence: **you cannot host two customers' backends on one machine, ever.** Not a scaling
   constraint — a hard architectural one that removes the cheapest topology permanently.
2. **The class of bug has already shipped twice.** FH-024 (local admin API cross-origin readable
   *and writable*) and OBS-004 (observability relay readable by any web page). Both "reachability
   mistaken for access control." Phase 45's own README flags a third waiting in STR-004. An auditor
   reads that as a pattern in a codebase with one reviewer.
3. **No SBOM, no advisory channel, no patch path for the curated kit.** MOD-002 compiles ~12–15
   packages *into the backend bundle*. A CVE in the xlsx reader requires a platform release **and**
   every customer rebuilding. No `npm audit` equivalent, no way to answer "am I affected." For
   payroll under GDPR, a finding on its own.
4. **No compliance tooling.** comcoi has GDPR consent records. NodeGX has an audit log and no
   DSAR/erasure tooling on any phase, no SOC2 path, no access-review export, no retention surface.

**Cost:** a quarter of unplanned remediation before the first enterprise or acquirer review.

### B.7 — A single synchronous writer, and the phase that fixes it is not in the plan

Phase 48 concedes *"Single writer… Fine to low thousands of active tenants. A cliff, not a wall."*
The stated target is "tens of thousands of hairdressers."

- **The writes are not incidental.** Every payslip, wallet/Stripe transition, IMAP-ingested email,
  audit row, execution-history row and workflow step outcome. NodeGX's own good features — durable
  execution records, audit trails — are write amplification on a single-writer database.
- **It is synchronous, on the request thread.** One slow query is head-of-line blocking for the whole
  process. With A.3's uninterruptible analyst query there is no isolation between "an admin ran a
  report" and "the app is down."

And **DAT-005 (Postgres, 3 wks) is not in the 36-week plan** — the index puts it under *"then, on
evidence."* So the "built world" both documents evaluate still runs on one SQLite file on one box.

### B.8 — Acquirer diligence

Technical DD produces, in order: (a) the core asset is a graph in a proprietary format; (b) the
format's tooling is a single-maintainer GPL fork of a discontinued product, unpublished and 11 months
stale on its public branch; (c) the escape hatch is phase 18, **0 of 7 tasks**, whose critical path
EXP-003 is *"machine-checked AI translation of Function/Expression/dynamic-port nodes"* at 6–8 weeks.
Your exit route depends on an LLM translating your logic and a trace harness verifying it. That is
not an exit route; it is a research project you have not started.

The consequence is not a discount. It is that a strategic acquirer whose org is React/TypeScript
prices in a full rewrite, and the deal shape changes from acqui-hire to asset purchase.

### B.9 — Smaller ones, each real

- **No SSO/SAML/SCIM on any phase.** Kills B2B upsell to salon chains.
- **The i18n string table is one file per locale** and merges "never collide across languages" — but
  *do* within one, and 3,905 keys in one JSON is a guaranteed conflict surface for two people.
- **`sqlite-vec` costs the zero-ABI-matrix property** the phase says WF-004 chose `node:sqlite` to
  get, and DAT-007's answer is that a backend without it "reports the capability as absent." So RAG
  can be silently missing in production. Fine for a feature; not for a feature you sold.
- **The generated bundle is committed** — three copies, ~102k lines each, nothing rebuilds them.
  Every branch touching the viewer conflicts in a generated file.
- **No CI has run on 95% of the platform.** `pr.yml` triggers on push to `main`/`cline-dev`; 1,485
  commits are unpushed. The gates are good and have not seen most of the code they gate.

---

## C. The estimate critique

**The headline first.** The index totals ~36 weeks across 44–49 and says that flips the verdict. But
the built-world document evaluates **ten** phases as shipped:

| Phase | Estimate |
|---|---|
| 44–49 | ~36 wks |
| 18 — Code Export v2 | **20–26 wks, 0/7 started** |
| 26 — Deployment | ~9 wks serial, "5–6 realistic" |
| 41 — Accessibility | **no task list, no estimate** |
| 40 — AI Authoring Quality | **no estimate; exit = "Richard judges"** |

**~66–71 weeks plus two unestimated phases, by a team of one.** Eighteen months to two years,
optimistically — and 41 and 40 are the two the built-world document leans on hardest.

**The calibration that should decide this.** comcoi's `git log`: **2026-04-10 to 2026-08-06, 276
commits, one author** — under four months, two of them slow. That produced 54 tables, 82 migrations,
63k LOC Python, 72k LOC tests, 211 Svelte components, a 24-tool assistant, an NL→SQL analyst, Stripe,
IMAP, importers and RAG. **Live, deployed, taking money.**

So the proposition, plainly: *spend 66–71+ weeks building a platform, by the same person, so the next
app like this one takes maybe 12 weeks instead of 17.* For a portfolio of ten apps, a good trade. For
one app, a catastrophe — and Communauté Coiffure is one app.

**44 — ~6 wks. Plausible core, missing scope.** MOD-001 at 2 days is honest. MOD-009 is the best task
on the roadmap. Missing: no security-patch path for the kit (B.6.3); no per-project kit version pin
(a kit major changes `require('decimal')` semantics for every project at once); **`lib/` is
CommonJS-only and untyped** — MOD-004 ships `.d.ts` for *kit* modules, nothing types project `lib/`,
so comcoi's type-hinted `Decimal` Python becomes untyped CommonJS, a real regression exactly where
correctness matters most, uncosted. (`net_to_brut()` is a 25-iteration fixed-point solver inverting
the non-linear RGDU curve to €0.01 — `social_charges.py:591-729`. Fine in `lib/`; nowhere else.)

**45 — ~3 wks. Optimistic ~2×.** STR-002 gives *"backpressure and a bounded buffer"* 3 days —
backpressure over an SSE hub with reconnection is not 3 days. Exit criterion 2 (reattach mid-stream)
requires server-side buffering with a replay cursor and no task funds it. Missing: proxy/CDN
buffering for SSE; fd and memory ceilings for long-lived connections; and the recorded fact that
`server.close()` hangs on SSE (BAK-009) — **graceful restart with live streams is known-unsolved and
this phase multiplies the connections.** Deeper: comcoi's CoCo is `coco_tools.py` (2,570 LOC) +
`coco.py` (1,276) + SSE routes (415), 24 tools, four client-executed via suspend/resume, a
Haiku/Sonnet cost split, `MAX_TOOL_TURNS` enforced by dropping `tools` on the last call, per-call
usage accounting. **Phase 45 delivers `Publish To Channel`. It does not deliver an agent loop.**

**46 — ~7 wks. Tier 1 plausible, Tier 2 fantasy, premise broken.** Tier 1 at 3 weeks is aggressive but
defensible. Then: the determinism premise is invalidated by 44, which ships first (A.2); **VER-006 at
1.5 weeks** owns *"the hard part is not replay, it is what counts as a mismatch"* — correct
diagnosis, and every company that has attempted record/replay regression testing spent quarters on
the flakiness taxonomy. The phase already names the failure mode: *"get this wrong and every trace
test is flaky and the feature dies."* Missing: test data management; a coverage definition for a
graph; any story for the 70% that is UI.

**47 — ~7 wks. Plausible engineering, wrong keys, missing product.** INT-004 gets 1.5 weeks for a
3,905-key, N-locale surface with grouping, filters and inline editing. The out-of-scope list —
*"translation memory, glossaries, TMX import/export, translator seats"* — cuts exactly what a French
product expanding to Belgium/Switzerland/Quebec/Africa pays a localisation vendor for. So the phase
closes "the app can render Dutch" and leaves "the business can ship Dutch" open. Also uncosted:
variable interpolation inside graph strings, which a large share of comcoi's keys use.

**48 — ~9 wks. The least credible phase.** DAT-002 at **2 weeks** for definition format, registration,
typed column introspection, parameter binding, an editor authoring surface and catalog exposure —
that is a mini-ORM plus an IDE surface; I would not accept 2 weeks for the introspection alone.
DAT-003 at 1 week cannot deliver what it claims at any price (A.3). DAT-006 at **1.5 weeks** is
rebuilding Alembic — comcoi's 82 revisions include guarded destructive backfills
(`025_migrate_dirigeant_to_employee.py`), a heuristic money correction that deliberately does not
reverse (`049_majoration_default_15pct.py:57-65`), two documented no-op migrations existing purely as
audit record, and one that **`import`s Python constants from application code** so a view's cohort
boundaries cannot diverge from the classifier (`071_analytics_views.py:74-79`). And DAT-002's premise
is author-written **SQLite** SQL; exit criterion 4 says a project moves to Postgres "with no graph
changes" — the graph maybe, the *views* no. Type affinity, `||`, `strftime` vs `to_char`, JSON
operators, window-frame defaults, `GROUP BY` strictness all diverge. Every view is a hand-port.
Uncosted.

**49 — ~3.5 wks. Mis-scoped because its premise is wrong** (A.1).

**Second-order work counted nowhere:** documentation for every new surface; migration of existing
projects; support load from danger mode; a compatibility policy (B.5); a bundle-size budget (A.8);
and the regression cost of shipping six phases into a 390k-LOC codebase whose CI has not run on 95%
of its history.

---

## D. Where I concede

### D.1 — Multi-tenancy. The strongest pro-NodeGX argument, and the evidence exceeds the claim.

Both documents say comcoi scopes by `salon_id` in application code. It is worse than stated:

- **No Postgres RLS.** Zero hits for `ROW LEVEL SECURITY`, `CREATE POLICY`, or a tenant GUC.
- **Ten routers each define their own `_get_owned_salon`** (`accounting_import.py:42`,
  `caisse_import.py:53`, `employees.py:41`, `payslip.py:130`, `monthly_reports.py:63`, +5).
- **~90 call sites in `payslip.py` alone; 111 raw `salon_id ==` filters across the routers.**
- **No base repository, no query hook, no scoping dependency.** `core/dependencies.py` is 214 lines
  and provides none.
- The isolation test covers **one field on one endpoint**.
- A second implicit tenancy model hides inside the first: `require_ccpilot_access` resolves "the
  user's salon" as *the oldest one by `created_at`*.

**111 opportunities to leak a stranger's payroll, defended by discipline.** NodeGX's per-record ACL
makes the class unwritable and `check_backend_access` answers it before you ship — **available
today**, not in the built world.

**What it costs me:** not the recommendation, because the code mitigation is cheap and known — one
scoping dependency or an RLS policy set, a week, and the class closes structurally in Postgres too.
But it is a week comcoi has not spent, and I would spend it before anything else.

### D.2 — i18n as an emitted property. Correct, and comcoi proves it.

**706 genuinely un-extracted French strings** in `.svelte` files (excluding 886 deliberate
`data-coco-desc` attributes), concentrated in the biggest — 128 in `mon-mois-typique`, 64 in
`control-panel`. Plus `en.json` at 1,729 of 3,905. comcoi's own README declares the day-one rule. The
vigilance argument is right and the evidence is in the reference app.

**Cost:** none to the recommendation, because the key design is broken (A.7) — but the doctrine is
correct and I would steal it. Building comcoi again in code, I would add an ESLint rule failing the
build on a bare string in JSX, day one.

### D.3 — Accessibility by emission. The right position, and comcoi is the argument for it.

comcoi has 582 `aria-*` and 122 `role=` — which sounds like effort until you look: **261 (45%) are
`aria-hidden`**, the cheapest kind. Twelve `role="dialog"` and ten `aria-modal` against **six
`tabindex` in the entire codebase** — no focus trapping anywhere. One `aria-sort` across many data
tables. **Seventeen hand-written `<!-- svelte-ignore a11y-* -->` suppressions.** And no ESLint at all:
`"lint": "prettier --check . && eslint ."` with **eslint not installed**, so the script cannot run.

Meanwhile NodeGX's runtime emits **one** aria attribute (`IconGlyph.tsx:41`) and `outline: none`
appears eight times in `assets/style.css`. So the platform is currently *worse*.

**The concession is to the position, not the product.** "Correct output because of what the emitter
emits" beats "because the author remembered," and comcoi's numbers are the proof. **Cost:** phase 41
has no task list and no estimate (A.9), so this remains a position — but it is the right one and the
argument I would lead with if I were selling this platform.

### D.4 — One data shape. Real, measurable, and I have watched it cause outages.

**46 exported TS interfaces** mirroring **225 Pydantic `BaseModel` classes** across 21 files,
synchronised by a docstring: *"Keep in sync with backend/app/schemas/*.py"* (`types.ts:1-6`). No
OpenAPI codegen — zero hits for `openapi`. A second hand-synced contract too: a 16-regex
`DEMO_COMPUTE_ALLOWLIST` in `api.ts:28-45` mirroring `app/core/demo_mode.py`.

Three instances of a standing drift-bug generator. NodeGX has one shape. **Cost:** small — the fix is
`openapi-typescript` in CI, a day — but it is a genuine structural advantage, not just a tidier one.

### D.5 — Workflows and scheduling. Better than what got built, for a reason worth naming.

comcoi's scheduler is APScheduler in-process (`main.py:98-195`), three jobs with
`max_instances=1, coalesce=True`. Those guards are **process-local**. **Zero** advisory locks, zero
`FOR UPDATE SKIP LOCKED`, zero leases anywhere. The moment there is a second API replica, the daily
drip double-sends and IMAP double-polls. Safe today only because deployment is a single container.

**Cost:** partial — NodeGX's version is also single-process, so it does not *solve* distributed
scheduling, it cannot exhibit the bug because it cannot scale to two processes. Better ergonomics,
same ceiling.

### D.6 — The canvas renderer is not the problem.

PLAT-001 records ~2,900-node corpora at 10.4ms worst-case frame time with everything visible — about
a third of frame budget — on an imperative Canvas2D renderer with viewport culling. Rejecting React
Flow was a performance decision and it was correct. **My density objection (A.4) is entirely about
human legibility and reviewability, not frame rate**, and conflating them is arguing badly.

### D.7 — Structured backend logging, and the workflow/function split.

`ops/logger.ts` routes every field through `redact()` so a caller cannot log a secret by handing it a
config object — a design most teams reach after their first leak. And the workflow/function split
(declarative JSON orchestration, a backend-served condition language, no eval surface, versus n8n's
one pot) is genuinely good architecture. Both documents call it out; both undersell how rare it is.

### D.8 — And the one that should sting: comcoi's test suite is less of a fortress than the review implies.

The "71,923 LOC of tests" argument is the load-bearing pro-code claim in the "today" document. What
those tests actually are:

- **No CI.** There is no `.github/` directory in the comcoi repo at all. Nothing runs the suite
  automatically, ever.
- **They run against the shared live migrated dev database** — not a container, not `create_all` —
  with the reason documented (`test_task_1_3_auth.py:46-55`).
- **Teardown is delete-by-email-domain**, not transactional rollback, and one file explains it must
  grant trials to all of a user's salons because *"a user can already own older orphan salons"* left
  by historical runs.
- **No property tests.** Zero `hypothesis`.
- **Frontend: 15 test files, 1,619 LOC, zero coverage of `src/routes/`** — 29,025 LOC of route code
  including the 4,129-line wizard untested; component testing excluded by config
  (`vite.config.ts:11-16`).

So the honest form is not "code gives you verification." It is: **"the backend's pure calculation core
has an excellent, oracle-based, décret-cited regression suite, and everything else is about as tested
as it would be anywhere."** I still think that suite is decisive — see §E — but the review overstates
the fortress by roughly the size of the frontend.

---

## E. Recommendation

### Today

**Build it in code. Confidence: very high (95%).**

I agree with the existing verdict and disagree with its reasoning, which matters because reasoning
generalises. The existing document says four capability gaps decide it. I say the capability gaps are
recoverable and **the vendor position is not**: one maintainer, 1,485 unpushed commits, nothing
published, a public branch eleven months stale, and a lineage already abandoned once.

Note the counterfactual. The existing document says NodeGX reaches the working app *"30–40% faster."*
Faster than what? comcoi went from empty repo to deployed, paying product in **under four months with
one person.** The plumbing was never the expensive part.

### In the "everything shipped" world

**Still code. Confidence: high (80%).** I put the built-world doc's 60/40 at roughly **35/65
against.**

1. **The built world is 66–71+ weeks away by its own estimates, plus two unestimated phases, from one
   maintainer.** It is not a place you can choose to build in; it is a place someone has to build
   first, and that someone is the person who would otherwise build your product.
2. **Two closed 🔴s don't close.** The analyst gets a privilege boundary and no availability boundary
   (A.3). Streaming gets a channel and not an agent loop. Both are product, not plumbing.
3. **The permanent residue is bigger than admitted.** The built-world doc names three (density,
   review, talent). I count six: those, plus **no structural merges** (B.2), **no compatibility
   contract** (B.5), and **no path to multi-tenant hosting because cloud functions are unsandboxable
   by design** (B.6.1).

**What would change my mind, specifically:**

1. NodeGX published to npm under semver, with a written compatibility and EOL policy, and a second
   maintainer who has landed non-trivial work. *Biggest lever, cheapest item.* Alone it moves me from
   95% to ~70%.
2. A demonstrated three-way structural merge of two independent node additions to one component.
3. Phase 46 Tier 1 shipped and used to pin the actual RGDU reference table — SMIC, 2200 €, 2500 €,
   PASS — with the phase-44 nondeterminism hole closed for `lib/`.
4. One 600+ node component authored, reviewed as a git diff by someone who did not write it, and
   modified correctly. Current ceiling of demonstrated practice: 83 nodes.
5. The SSR server rewritten with per-request isolation, a bounded correctly-keyed cache, and route
   validation.
6. One deployed NodeGX app surviving a real production incident, with the timeline published.

1, 3 and 4 take me to genuinely arguable. All six and I would recommend it for the *next* app.

### The architecture I would actually build

The existing §11 hybrid — NodeGX owns the app surface, a Python service keeps the engine, joined over
HTTP — is reasonable and I would not build it: **two auth models, two deploy targets, no shared types,
and a frontend that still cannot do i18n.** You take all of NodeGX's vendor risk and keep all of
Python's operational surface. Worst square of the matrix.

If someone insisted, I would invert it: **keep SvelteKit + FastAPI exactly as it is, and use NodeGX
for what it is genuinely best at that comcoi has not built** — internal admin/ops tooling, the
workflow-shaped back-office processes (payslip approval with waits and retries, the drip with a run
inspector), and any client-facing portal. Separable, no tax-calculation risk, and if the platform
stalls you have lost an internal tool rather than a product.

**And the honest version of the whole exercise: before any of this, spend one week in comcoi.** Add
the tenant-scoping dependency (D.1); add `openapi-typescript` to kill the 46-vs-225 drift (D.4); add
ESLint with the a11y rules and a no-bare-string rule (D.2, D.3); add a GitHub Actions workflow that
runs the 71,923 lines of tests **nobody currently runs** (D.8). Five days that close four of the six
weaknesses NodeGX is being proposed to solve — the calculation any founder should see before
committing eighteen months of platform work.

---

## F. Closing note

Both documents are honest, well-evidenced and unusually willing to argue against their author's
interest — the "today" document's correction is the right instinct and most reviews never do it. My
disagreement is not that they are boosterish. It is that **the correction taught the wrong lesson.**
It concluded *"I was too pessimistic, re-check the 🔴s."* The correct lesson was *"I trusted a
capability's existence as proof of its quality."*

SSR exists. I read it. It races on process globals, caches forever on a path key, renders any URL an
attacker sends, and server-renders React 19 under React 18. **Every ✅ deserves the treatment the 🔴s
got, and this review has only had time to give it to one of them.**
