# Revival Phases 12–22 — Index

**Created:** 2026-07-22
**Source:** [NOODL-REVIVAL-ROADMAP.md](../reviews/NOODL-REVIVAL-ROADMAP.md), which derives from [NOODL-VIABILITY-REPORT.md](../reviews/NOODL-VIABILITY-REPORT.md)
**Status:** All phases Not started

These phases document the unlimited-budget revival plan. They sit alongside the original phases 0–11 rather than replacing them: phases 0–2 are complete, several later phases contributed work that these build on, and a few are explicitly superseded (noted below).

## Phases

| Phase | Track | Tasks | Focus | Start when |
|---|---|---|---|---|
| [12 — Reanimation](./phase-12-reanimation/) | Horizon 0 | REV-001…008 | Green build, working tests, CI, current Electron, shipped v0, trustworthy dev loop | **Now** |
| [13 — Format & AI Substrate](./phase-13-format-ai-substrate/) | A | SUB-001…011 | v2 format in real use, node catalog, semantic validator, graph diff, MCP server | After REV-001/002 |
| [14 — Editor Platform Health](./phase-14-editor-platform-health/) | B | PLAT-001…005 | Canvas decomposition, retire jQuery, type the runtime | After REV-003 |
| [14.5 — Revival Debt](./phase-14.5-revival-debt/) | Cross-track | DEBT-001…013 | Defects, owed live verification, and orphaned follow-ups surfaced by the 2026-07-24 audits of phases 12–14 and of the pre-revival features | Now (added 2026-07-24; DEBT-001/002 first, DEBT-007 before first signed release) |
| [15 — AI Collaboration](./phase-15-ai-collaboration/) | C | AIX-001…006 | Modern AI client, the authoring loop, graph-native review, explain mode, style vocabulary | After Phase 13 core |
| [16 — Runtime & Deploy Health](./phase-16-runtime-deploy-health/) | D | RUN-001…004 | Runtime React 19, SSR/SSG, finish UBA, fix local backend | Parallel; RUN-004 after REV-004 |
| [17 — Noodl Learn](./phase-17-noodl-learn/) | E | LEARN-001…006 | Lessons engine, curriculum, web viewer, classroom mode, pilots | Horizon 2 |
| [18 — Code Export v2](./phase-18-code-export-v2/) | F | EXP-001…005 | `@nodegx/core`, generators, AI translation with trace verification | After Phase 13 |
| [19 — Cloud & Workflows](./phase-19-cloud-workflows/) | G | WF-001…007 | The backend leg of the full stack: standalone service (speaks the Parse-wire subset), workflow engine, triggers, observability, one deploy target, Parse-framework retirement (re-scoped 2026-07-24 — see [BACKEND-GAP-ASSESSMENT](./phase-19-cloud-workflows/BACKEND-GAP-ASSESSMENT.md)) | After G2-critical work; WF-006 + RUN-004 loud-failure anytime |
| [20 — Ecosystem](./phase-20-ecosystem/) | Horizon 3 | ECO-001…005 | Collaboration, marketplace, multi-project, hosting, rebrand | 🔒 **Gated on G3** |
| [21 — Library & Import](./phase-21-library-and-import/) | Cross-track | LIB-001…006 | Library source of truth + pipeline, prefab repair/restyle, module hygiene/expansion, import engine v2, import UX (created 2026-07-25); legacy-import best-effort + AI repair (LIB-006, added 2026-07-30 with the fresh-start decision) | Anytime — not gated; precondition for ECO-002's sharing test |
| [22 — Production Backend](./phase-22-production-backend/) | H | BAK-001…009 | BaaS parity for `nodegx-backend`, tiered: realtime (SSE), email/SMTP + reset/verify, access control (CLPs/ACLs/roles/keys), backups & promotion; then OAuth/magic links, served admin dashboard, files v2; then FTS5 search, ops hardening (created 2026-07-25) | After Phase 19's WF-004; tiers are stopping points |
| [23 — Visual Refresh](./phase-23-visual-refresh/) | I | UIX-001…009 | The NodeGX look, tiered: token re-palette (azure accent, red→danger-only, elevation) + hardcoded-hex ratchet; then control kit, editor chrome, canvas re-palette + node cards, launcher/first-run, iconography; then light theme + switching, long-tail sweep + screenshot-QA harness (created 2026-07-26; mocks in the phase folder) | Anytime — not gated; UIX-001 first; tiers are stopping points |
| [26 — Deployment](./phase-26-deployment/) | K | DEP-001…008 | The three ways a NodeGX app reaches the world, tiered: un-freeze the baked backend endpoint + decide what is in an artifact; then a local full-stack folder that runs on one Node process and direct-upload publishing to Netlify/Cloudflare Pages with no GitHub; then deploy targets, secrets and SSH deployment to a server you own with automatic TLS; then Hetzner provisioning and a read-only deploy assistant (created 2026-07-27) | Anytime — not gated; DEP-001 and DEP-008 first; tiers are stopping points |
| [27 — Visual Backend Authoring](./phase-27-visual-backend-authoring/) | L | WFA-001…007 | Make the backend something you can see, edit and debug, tiered: reconnect cloud function authoring (a regression — the editor hides the cloud sheet, WF-007 deleted the panel that showed it, and nothing deploys functions) and switch on WF-006's run inspector; then step data mapping, which the canvas needs before it can express the obvious; then the workflow canvas on the existing canvas, triggers as entry nodes, and descent from a step into its function graph; then AI proposals arriving as a reviewable diff instead of invisible JSON (created 2026-07-27) | Anytime — not gated; WFA-001 and WFA-002 are independent and independently valuable; tiers are stopping points |
| [28 — Canvas Legibility & Authoring Intent](./phase-28-canvas-legibility/) | M | CAN-001…005 | A graph knows more than it shows, and what it shows does not survive export. Tiered: un-gate WFA-004's wire label for every canvas and make node comments findable without hovering; then author-written wire text and endpoint-drag rewiring (which retires the two-click wire delete); then carry labels, titles, comments and comment-box regions into exported code as comments and identifiers. Rescues the orphaned phase-7 CODE-008 (created 2026-07-28, from using the WFA-004 canvas) | Anytime — not gated; CAN-004 then CAN-001 are small and independent; CAN-005 executes in Phase 18 |
| [29 — Code Editor](./phase-29-code-editor/) | N | CED-001 | The CodeMirror 6 editor that replaced Monaco is built on the right library and then fights it: stock bracket/indent extensions switched off for a hand-rolled Enter handler, autocomplete `override`n down to 25 hardcoded strings, a linter defined and never wired, a character-loop formatter that can corrupt code, a second diff implementation, and — the real defect — up to 20 full copies of every code parameter persisted into `project.json`. Slice A is mostly deletion, B gets history out of the project file, C adds an inline AI copilot on AIX-001's `AiClient` where suggestions arrive as an accept/reject diff (created 2026-07-28, from a code-editor audit) | Anytime — not gated; A and B are independent and ship alone; C needs A |

| [30 — Node Library Audit & Remediation](./phase-30-node-library-audit/) | O | NDA-001…012 | 155 nodes that feel individually broken because three contracts were never written down. **Reactivity**: `Collection` notifies on 5 of ~15 mutating operations and `items` hands out the raw array, so `push` from a Function node is invisible; `States` can transition twice in a frame and signal zero times. **Empty values**: four layers guard differently on `null` vs `undefined`, and a String variable fed `null` stores the text `"null"`. **Failure**: 32% of action nodes have no failure output, 10 emit no signal at all, and `sendWarning` is editor-only. Plus 95% of 2,650 ports undocumented — the AI authoring loop's biggest single input. Tier 1 is the three contracts and stands alone (created 2026-07-28, from Richard's list of eight bad nodes) | Anytime — not gated; NDA-001 (a red corpus) must precede any fix |

| [31 — Readiness & Operations](./phase-31-readiness-and-operations/) | P | OPS-001…009 | Richard's own AI-coding guide, ported inward. Almost every chapter of it is a *prosthetic* for something a visual tool gives free — a service registry, a flow visualiser, a style inspector — so the port is not "build a control panel" but "derive what a code project has to author". Three things in it are not prosthetics and NodeGX has none of them: the irreversible plumbing (source maps + release tagging, capturable only at build time, and we own the build), proof that what is running is what you built, and a **declared maturity level** — Playing / Sharing / Live / Scale — that lets one product serve a nine-year-old and someone with two thousand users. Tiered: the ladder + build identity + a graph-aware findings store; then the Ops panel and observability plumbing; then the security sweep (a key on a frontend node ships to every visitor, and only NodeGX knows which side of the wire a node runs on) and content/links/meta panels; then the authored quarter of the Project Brain plus an AI budget meter (created 2026-07-30) | Anytime — not gated; OPS-001's taxonomy first and in prose; tiers are stopping points |
| [32 — Reality Check](./phase-32-reality-check/) | Q | RCK-001…008 | The only phase whose subject is the *user of the user's app*. Builders skip user testing for three excuses — "I don't know 5 people", "someone will steal my idea", "it's embarrassing" — and all three are removable, in that order. Tiered: **user journeys as first-class objects** anchored to components, giving static coverage and a regression suite that self-heals from the *edit* rather than from a diff (this half is worth building alone); then a **blind** synthetic tester — perception is a screenshot, action is a coordinate, no DOM, no selectors, no names — driven by six behavioural archetypes with intent generated at run time, whose report carries a coverage number the builder cannot argue with; then the prediction artefact (written before anyone tests, diffed against reality on the canvas) and the observer view whose only control is **"I wanted to help here"**; then the two-step gate before strangers, where the synthetic round can never satisfy it and unlocks the recruiting kit instead (created 2026-07-30) | After OPS-001/003/009; RCK-001+002 ship alone and are independently valuable |

| [33 — Alpha Launch](./phase-33-alpha-launch/) | R | ALPHA-001…005 | The thin layer between "it works on our machine" and "a stranger can use it and tell us when it doesn't" — and the only phase whose tasks were owned by nobody, because three of the five are not engineering. Tier 1 gates the alpha: the **cold-install first hour**, one pass that discharges seven tasks' worth of code-complete-never-seen-by-a-human work clustered on the first ten minutes of use; and a **release that reaches a Mac**, filed because the v0.1.0 draft carries Windows and Linux artifacts and *no macOS artifact of any kind*. Tier 2 makes the alpha worth running: crash reporting and a feedback path (there is no log file, so a user hitting a bug has nothing to attach), user documentation (everything in `docs/` is developer reference — there is no "what is a node"), and the privacy/terms paperwork for a binary that sends project content to third-party AI providers (created 2026-07-30) | Anytime — not gated; ALPHA-002's credential steps have the longest lead time and should start first |

| [34 — One Backend Contract](./phase-34-one-backend-contract/) | S | BCN-001…010 | NodeGX ships two node families that appear to do the same thing — 25 Parse-wire nodes and 5 BYOB nodes — and **nobody decided to keep both**: RUN-003 decided the opposite on 2026-07-25 ("one panel, one node UX"), the panel merged, the node UX did not, and WF-007 then fenced the other family out of its scope. Three findings set the size: `CloudStore`'s 18 methods and `UserService`'s 10 are **already a backend-neutral contract** (Parse lives only in `_makeRequest` and the `where` dialect — 9 Parse-shaped identifiers survive in the record nodes); the neutral filter model **already exists in two independent implementations**; and `nodegx-backend` **already answers both wires**, so the coin-flip between families has no functional consequence against our own backend. Tiered: the contract, Parse-wire moved behind it with no behaviour change, and one filter translator per backend; then the REST adapter (retiring the BYOB family), relations, auth with the token lifecycle Parse has nothing to teach us about, files and realtime; then one preset list of six, and capability gating so a gap is a disabled port with a sentence rather than a runtime silence. **Blocks phase 30's data audit** (created 2026-07-31, from Richard asking why there are two) | Anytime — not gated; BCN-001's contract in prose first; tiers are stopping points |

Phases 24 (mock parity) and 25 (side panel) exist on disk but were never added to this table.

## The critical path

Not everything is equally load-bearing. In dependency order, the spine is:

**REV-001** (build works) → **SUB-002** (no data loss) → **SUB-001** (editor uses v2) → **SUB-004** (node catalog) → **SUB-006** (semantic validator) → **AIX-002** (the authoring loop) → **Gate G2** (does anyone want this?)

Everything else supports, parallels, or follows that line. If capacity is contended, protect it.

## Standing decisions (bind every phase)

| Decided | Decision | Where |
|---|---|---|
| 2026-07-30 | **NodeGX is a fresh start. Existing Noodl projects will not reliably import.** No task may be halted, narrowed, or dual-pathed to protect pre-NodeGX projects; best-effort conversion plus an honest report is the whole promise, and the remainder is the importing user's AI assistant's problem or a rebuild. Every pre-dating "existing projects must keep working" clause is void. | [`COMPATIBILITY-POLICY.md`](../reference/COMPATIBILITY-POLICY.md) |

## Decision gates

The roadmap places three gates in the plan. They are pre-committed decisions, not review meetings:

| Gate | When | Question | If it fails |
|---|---|---|---|
| **G1** | ~month 3 | Can an external agent author a valid page via catalog + MCP? (SUB-008's exit demo) | The substrate thesis is wrong; halt Tracks C and F, rethink |
| **G2** | ~month 9 | After the authoring demo ships for a quarter and two pilots run — do people **return unprompted**? | Wind down: ship export so nobody is trapped, open-source, stop |
| **G3** | ~month 15 | Which wedge pulled harder — education or the AI-collaborative builder? | Concentrate Horizon 3 there; refusing to choose repeats the original mistake |

## Executor recommendations

Every task file carries a **Recommended executor** row. The criteria, applied consistently across all nine phases:

| Tier | Use when |
|---|---|
| 🟢 **Sonnet 5** | The root cause is known, the fix is specified, and success is mechanically verifiable |
| 🟠 **Opus 4.8** | Substantial engineering against a clear target, with a large surface or opaque failure modes needing iterative diagnosis |
| 🔵 **Fable 5** | The task *defines* semantics, an interface, or a strategy — where the hard part is deciding what to build, and the decision is expensive to reverse |

Two rules of thumb. **Escalate** when a task stops being "apply the known fix" and becomes "work out what the right thing is." **Delegate down** once a design is settled — most Fable-tier tasks contain Opus- or Sonnet-tier implementation work, and the task files say where.

These are efficiency recommendations, not gates. Several tasks (LEARN-002 curriculum, LEARN-006 pilots) additionally require *humans* in roles no model fills — a learning designer, real pilot cohorts — and say so explicitly.

## Relationship to phases 0–11

| Original phase | Disposition |
|---|---|
| 0–2 (foundation, dependencies, React migration) | Complete |
| 3 (editor UX) | Mostly cut. Small items survive in PLAT-005; advanced GitHub integration is explicitly dead |
| 3.5 (realtime agentic UI) | Deferred into AIX-005, gated on the authoring loop proving out |
| 4 (canvas views) | Partially complete; PLAT-001 makes further work tractable |
| 5 (multi-target deployment) | Parked. RUN-004 fixes the local backend; export (Phase 18) replaces the target matrix |
| 6 (UBA) | UBA-001…009 complete; RUN-003 finishes it |
| 7 (code export) | **Superseded by Phase 18**, which implements its design plus trace-verified AI translation |
| 8 (distribution) | **Pulled forward into REV-007** |
| 9 (styles) | Mostly complete; the STYLE-005 banner turned out to be already wired (salvage audit 2026-07-24) — PLAT-005 re-scoped to suggestion quality + variant persistence; AIX-006 exposes the token system to AI authoring |
| 10 (AI-powered development) | STRUCT-001…004 complete and are Phase 13's foundation; Phase 13 + 15 supersede the rest |
| 11 (cloud functions) | CF11-004…007 delivered their UI/store halves (wiring severed — WF-006); Phase 19, re-scoped 2026-07-24, builds the backend gap properly and still parks Series 4/5 |

Note that several phase 0–11 `PROGRESS.md` files understate what was actually delivered — the February 2026 sprint landed work that was never recorded in the shared trackers. **REV-006** corrects that record, and until it does, prefer the per-developer progress files and git history.

## A note on these documents

They were written on 2026-07-22 from the viability assessment, before any of the work began. They will be wrong in places — estimates especially, and any task whose first step is "assess what actually exists" may find something that changes its shape substantially.

Treat them as briefs rather than contracts. Where a task's assessment step contradicts its own plan, the assessment wins; record the deviation in that task's `CHANGELOG.md` and move on.
