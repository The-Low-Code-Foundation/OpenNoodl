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
| [21 — Library & Import](./phase-21-library-and-import/) | Cross-track | LIB-001…005 | Library source of truth + pipeline, prefab repair/restyle, module hygiene/expansion, import engine v2, import UX (created 2026-07-25) | Anytime — not gated; precondition for ECO-002's sharing test |
| [22 — Production Backend](./phase-22-production-backend/) | H | BAK-001…009 | BaaS parity for `nodegx-backend`, tiered: realtime (SSE), email/SMTP + reset/verify, access control (CLPs/ACLs/roles/keys), backups & promotion; then OAuth/magic links, served admin dashboard, files v2; then FTS5 search, ops hardening (created 2026-07-25) | After Phase 19's WF-004; tiers are stopping points |
| [23 — Visual Refresh](./phase-23-visual-refresh/) | I | UIX-001…009 | The NodeGX look, tiered: token re-palette (azure accent, red→danger-only, elevation) + hardcoded-hex ratchet; then control kit, editor chrome, canvas re-palette + node cards, launcher/first-run, iconography; then light theme + switching, long-tail sweep + screenshot-QA harness (created 2026-07-26; mocks in the phase folder) | Anytime — not gated; UIX-001 first; tiers are stopping points |
| [26 — Deployment](./phase-26-deployment/) | K | DEP-001…008 | The three ways a NodeGX app reaches the world, tiered: un-freeze the baked backend endpoint + decide what is in an artifact; then a local full-stack folder that runs on one Node process and direct-upload publishing to Netlify/Cloudflare Pages with no GitHub; then deploy targets, secrets and SSH deployment to a server you own with automatic TLS; then Hetzner provisioning and a read-only deploy assistant (created 2026-07-27) | Anytime — not gated; DEP-001 and DEP-008 first; tiers are stopping points |
| [27 — Visual Backend Authoring](./phase-27-visual-backend-authoring/) | L | WFA-001…007 | Make the backend something you can see, edit and debug, tiered: reconnect cloud function authoring (a regression — the editor hides the cloud sheet, WF-007 deleted the panel that showed it, and nothing deploys functions) and switch on WF-006's run inspector; then step data mapping, which the canvas needs before it can express the obvious; then the workflow canvas on the existing canvas, triggers as entry nodes, and descent from a step into its function graph; then AI proposals arriving as a reviewable diff instead of invisible JSON (created 2026-07-27) | Anytime — not gated; WFA-001 and WFA-002 are independent and independently valuable; tiers are stopping points |
| [28 — Canvas Legibility & Authoring Intent](./phase-28-canvas-legibility/) | M | CAN-001…005 | A graph knows more than it shows, and what it shows does not survive export. Tiered: un-gate WFA-004's wire label for every canvas and make node comments findable without hovering; then author-written wire text and endpoint-drag rewiring (which retires the two-click wire delete); then carry labels, titles, comments and comment-box regions into exported code as comments and identifiers. Rescues the orphaned phase-7 CODE-008 (created 2026-07-28, from using the WFA-004 canvas) | Anytime — not gated; CAN-004 then CAN-001 are small and independent; CAN-005 executes in Phase 18 |
| [29 — Code Editor](./phase-29-code-editor/) | N | CED-001 | The CodeMirror 6 editor that replaced Monaco is built on the right library and then fights it: stock bracket/indent extensions switched off for a hand-rolled Enter handler, autocomplete `override`n down to 25 hardcoded strings, a linter defined and never wired, a character-loop formatter that can corrupt code, a second diff implementation, and — the real defect — up to 20 full copies of every code parameter persisted into `project.json`. Slice A is mostly deletion, B gets history out of the project file, C adds an inline AI copilot on AIX-001's `AiClient` where suggestions arrive as an accept/reject diff (created 2026-07-28, from a code-editor audit) | Anytime — not gated; A and B are independent and ship alone; C needs A |

| [30 — Node Library Audit & Remediation](./phase-30-node-library-audit/) | O | NDA-001…012 | 155 nodes that feel individually broken because three contracts were never written down. **Reactivity**: `Collection` notifies on 5 of ~15 mutating operations and `items` hands out the raw array, so `push` from a Function node is invisible; `States` can transition twice in a frame and signal zero times. **Empty values**: four layers guard differently on `null` vs `undefined`, and a String variable fed `null` stores the text `"null"`. **Failure**: 32% of action nodes have no failure output, 10 emit no signal at all, and `sendWarning` is editor-only. Plus 95% of 2,650 ports undocumented — the AI authoring loop's biggest single input. Tier 1 is the three contracts and stands alone (created 2026-07-28, from Richard's list of eight bad nodes) | Anytime — not gated; NDA-001 (a red corpus) must precede any fix |

Phases 24 (mock parity) and 25 (side panel) exist on disk but were never added to this table.

## The critical path

Not everything is equally load-bearing. In dependency order, the spine is:

**REV-001** (build works) → **SUB-002** (no data loss) → **SUB-001** (editor uses v2) → **SUB-004** (node catalog) → **SUB-006** (semantic validator) → **AIX-002** (the authoring loop) → **Gate G2** (does anyone want this?)

Everything else supports, parallels, or follows that line. If capacity is contended, protect it.

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
