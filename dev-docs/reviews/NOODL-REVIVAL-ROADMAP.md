# The Unlimited-Budget Revival Roadmap

**Companion to:** [NOODL-VIABILITY-REPORT.md](./NOODL-VIABILITY-REPORT.md) (read that first — this roadmap assumes its findings)
**Premise:** Time and money are not constraints. Team capacity, sequencing discipline, and honesty about demand still are.
**Task documentation:** Every item below is now written up as a full task in [`dev-docs/tasks/`](../tasks/) — see the [phase index](../tasks/REVIVAL-PHASES-INDEX.md).
**Date:** 2026-07-22

---

## 0. What unlimited budget does and does not change

Unlimited budget changes three things: you run tracks **in parallel** instead of in sequence, you take on the **expensive-but-right** projects (typed runtime, canvas decomposition, web editor, collaborative editing) instead of deferring them forever, and you can afford **product/education/community people**, not just engineers.

It does *not* change three things:

1. **Dependency order.** The node catalog must exist before AI authoring works; the decomposed format must be wired in before either matters; export is easier after both. Money compresses the calendar, not the graph.
2. **The strategic verdict.** "Visual development instead of code" stays dead at any budget. Everything below builds the narrowed thesis: **the legible substrate for human–AI co-building, and for learning real engineering.** A funded team that ignores this just fails more expensively.
3. **The need for gates.** The viability report validated the codebase, not demand. Even a rich roadmap keeps kill/pivot gates (§6), because the most expensive failure mode is building all twelve phases of a product nobody adopts — which is, bluntly, what the original roadmap risked at any funding level.

**Team shape assumed at full ramp:** ~12–16 people — Platform (3–4), Format & AI Substrate (3), AI Experience (2–3), Runtime & Export (2–3), Education/Product (2), Community/DevRel (1), plus Richard as architect/product owner. Scale up only as tracks unblock; hiring ahead of sequencing burns money for churn.

---

## 1. Horizon 0 — Reanimation (Weeks 1–4, 2–3 engineers)

→ **[Phase 12: Reanimation](../tasks/phase-12-reanimation/)** — REV-001…007

Everything else stacks on a green, shippable, current base. This horizon is deliberately boring.

| ID | Task | Notes / evidence anchor | Est. |
|---|---|---|---|
| REV-001 | **The reanimation commit**: Ajv→v8 (fixes `schemas/validator.ts`), add `@noodl-viewer-cloud/execution-history` alias to editor tsconfig + webpack, fix ESM import bug in `packages/noodl-editor/scripts/build.ts` / `scripts/build-editor.ts` | Report §3, Appendix C/D — takes typecheck 17→0 and renderer build 13→0 errors | 1–2 days |
| REV-002 | **Fix the Electron test harness** (`test.js:51` — `app` undefined) and get the ~149 io tests + full suite running locally and headless | Last commit `b5f200c` was already fighting this | 2–4 days |
| REV-003 | **CI/CD on GitHub Actions**: typecheck, lint, tests, editor+viewer builds as merge gates; nightly packaged builds | Nothing gates merges today; the Feb sprint's dangling breakages prove the need | 1 wk |
| REV-004 | **Electron 31→43 upgrade** | The one real dependency project; risk is native modules (better-sqlite3, dugite) and 12 majors of main-process API drift | 1–3 wks |
| REV-005 | **Dependency hygiene**: `npm audit` remediation, unify TypeScript at 5.9 across all packages (kills the 4.9 split-brain in viewer-react/core-ui/viewer-cloud), dedupe webpack-cli/babel | Report Appendix B | 1 wk |
| REV-006 | **Docs truth pass**: reconcile stale `PROGRESS.md` files with git reality (phase 6 says 0%, is ~100%; phase 10 says 0/42, is 4/42) | Report Appendix H — an AI-assisted repo needs docs that don't lie to the AI | 2–3 days |
| REV-007 | **Ship v0 now**: signed macOS/Windows/Linux builds + auto-update (pulls Phase 8 forward) | With budget there is no reason to defer distribution; every later milestone becomes a release, and release infrastructure debugs itself on low-stakes builds first | 2 wks |

**Exit criterion:** a stranger can download a signed, auto-updating OpenNoodl on current Electron, and CI blocks regressions. *(This was the entire "minimum viable" plan's first move; here it's just the warm-up.)*

---

## 2. Horizon 1 — Four parallel foundation tracks (Months 1–6)

### Track A — Format & AI Substrate *(the strategic spine — staff it best)*

→ **[Phase 13: Format & AI Substrate](../tasks/phase-13-format-ai-substrate/)** — SUB-001…008

The end state: **the project format is a language.** Decomposed, documented, diffable, validatable, and manipulable by any tool or AI — not just Noodl's own editor.

| ID | Task | Notes | Est. |
|---|---|---|---|
| A-01 | STRUCT-005/006: editor natively reads/writes v2 (lazy loading, component-level atomic saves) | Specs exist (`phase-10.../README.md`); currently zero app call sites | 3–4 wks |
| A-02 | Fix round-trip fidelity gaps: `comments`, `visualRoots`, `lesson` (`io/ProjectExporter.ts:73-74`) + whole-object `roundTrip(p) ≍ p` tests + golden fixtures from real projects | Must land before any real project migrates | 1–2 wks |
| A-03 | STRUCT-007/008: migration wizard + real-project test suite (200+ component projects, cloud components, corruption cases) | | 3–4 wks |
| A-04 | **The node catalog** (unscoped keystone): generate `node-catalog.json` from `noderegister.js` metadata — every node type, port, parameter, type, enum, with descriptions; ship it in-repo and as a build artifact | The single highest-leverage new task in this entire document | 1–2 wks |
| A-05 | Catalog enrichment: per-node usage examples, semantic docs, connection-compatibility rules (encode what `LEARNINGS.md:1288-1300` says is runtime-only today, as far as statically possible) | Turns "schema-valid" into "semantically valid" AI output | 3–4 wks |
| A-06 | **Semantic validator**: lint a v2 project against the catalog (unknown types, nonexistent ports, dangling connections, orphan nodes) — CLI + editor integration | The AI's compiler-errors; also catches human mistakes | 2–3 wks |
| A-07 | **Graph-native git**: replace `utils/projectmerger.js` (666 lines, legacy) with v2-aware diff/merge; human-readable graph diffs in the editor; sane merge conflicts per component file | v2's per-component files make this finally tractable; unlocks real team workflows and PR review of graphs | 4–6 wks |
| A-08 | **Noodl MCP server**: expose project read/author/validate operations (backed by A-01…A-06) as a Model Context Protocol server, so *any* agent — Claude Code, IDE agents, CI bots — can open, inspect, and author Noodl projects | This is the 2026 move the 2025 roadmap couldn't have made: instead of only building one in-house agent, make Noodl a first-class *target* for the whole agent ecosystem | 3–4 wks |

**Exit criterion:** an external AI agent, via MCP + catalog, authors a valid new page into a real project without ingesting the whole project, and the semantic validator + editor both accept it.

### Track B — Editor Platform Health *(the "never again" track)*

→ **[Phase 14: Editor Platform Health](../tasks/phase-14-editor-platform-health/)** — PLAT-001…005

| ID | Task | Notes | Est. |
|---|---|---|---|
| B-01 | **Canvas decomposition** per `future-projects/CANVAS-MODERNISATION-PROJECT.md`: break the 3,481-line `nodegrapheditor.ts` god object into modular, testable units; keep HTML5 canvas rendering (explicitly not a React Flow rewrite) | The scariest file in the repo; blocks confident canvas work and AI-assisted editing of the editor itself | 6–8 wks |
| B-02 | **Retire the jQuery islands**: PopupLayer (1,043 lines) and the property-editor legacy views (`resizingview.js`, `marginpaddingview.js`, `proplist.js`, `DataTypes/*`) rebuilt in React via the proven `ReactView`/core-ui pattern; delete `src/shared/view.js` + vendored jQuery when the last of ~21 View subclasses dies | Containment is verified; with budget, finish the job and remove the seam entirely | 6–8 wks |
| B-03 | **Type the runtime**: convert `noodl-runtime` (98 .js) and `noodl-viewer-react` (131 .js) to TypeScript incrementally, tests-first; publish the node-definition API types | Directly improves AI-assisted contribution and export-generator correctness; do it *after/with* A-04 since types and catalog share source-of-truth | 8–12 wks |
| B-04 | TSFixme burn-down: 554 → <100, with ESLint ratchet in CI | Concentrated at seams B-02/B-03 eliminate anyway | ongoing |
| B-05 | Property panel & editor UX polish (the still-relevant slice of phase 3), incl. wiring the built-but-dangling STYLE-005 banner | Days-scale loose ends from the Feb sprint | 2–3 wks |

**Exit criterion:** zero jQuery in the repo, no file over ~800 lines in the canvas subsystem, runtime fully typed, TSFixme trending to zero.

### Track C — AI Collaboration Experience *(the product bet)*

→ **[Phase 15: AI Collaboration](../tasks/phase-15-ai-collaboration/)** — AIX-001…005

| ID | Task | Notes | Est. |
|---|---|---|---|
| C-01 | **Modern AI client**: replace the stale AiAssistant plumbing (`gpt-4o-mini`/`gpt-3.5-turbo`/retired `text-davinci-003`, `AiAssistant/interfaces.ts:11,16`) with a provider-agnostic client — current Claude/GPT models, configurable endpoints, and **local models (Ollama) for schools/privacy** | The migration helper (`utils/migration/claudeClient.ts`) already shows the pattern | 2–3 wks |
| C-02 | **The authoring loop**: "describe a page → agent writes `components/<Page>/*.json` (via A-04/A-06) → editor shows the new graph → accept/refine/reject." Streaming, with the graph appearing live on canvas | Depends on Track A exit; this is *the demo* | 4–6 wks |
| C-03 | **Graph-native review**: visual diff of AI-proposed changes (builds on A-07) — added/removed/rewired nodes highlighted on canvas before acceptance | The legibility thesis made tangible: you *see* what the AI did, which no code tool offers | 3–4 wks |
| C-04 | **Explain mode**: select any node/subgraph → AI narrates what it does, where data flows, what triggers what; inverse of authoring, same catalog | Serves both theses (comprehension + pedagogy) for near-zero marginal cost once C-01 lands | 2 wks |
| C-05 | Phase 3.5 (realtime agentic UI nodes: SSE/WebSocket/state-store) — build once C-02 proves out, so Noodl apps can themselves *be* agent frontends | 0/7 today; genuinely differentiating but not before the loop exists | 6–8 wks |

**Exit criterion:** the demo from the viability report — *a stranger watches an AI build a page inside a graph they can read, in an app they can install* — plus visual diff review of the AI's work.

### Track D — Runtime & Deploy Health

→ **[Phase 16: Runtime & Deploy Health](../tasks/phase-16-runtime-deploy-health/)** — RUN-001…004

| ID | Task | Notes | Est. |
|---|---|---|---|
| D-01 | Runtime React 17→19 migration per `future-projects/PHASE-RUNTIME-REACT-19-MIGRATION.md` (dual-runtime, per-project opt-in) | Editor is on 19; deployed apps aren't — close the gap | 4–6 wks |
| D-02 | SSR/SSG support per `future-projects/SSR-SUPPORT.md` (CSR/SSR/SSG per project) | Prereq (React 19) now met; matters for real-world credibility of deployed apps | 4–6 wks |
| D-03 | Finish UBA: UBA-010 E2E + Directus reference backend + docs; then 1–2 more adapters (Supabase first, per `NATIVE-BAAS-INTEGRATIONS.md` — "#1 new-user question") | UBA-001–009 already built (Feb sprint) | 3–5 wks |
| D-04 | Stabilize BYOB/local-SQLite (better-sqlite3 currently falls back to an in-memory mock) | Known-buggy shipped surface | 2 wks |

---

## 3. Horizon 2 — Product wedges (Months 4–12, overlapping Horizon 1 tails)

### Track E — "Noodl Learn" *(pedagogy as a product, not a hope)*

→ **[Phase 17: Noodl Learn](../tasks/phase-17-noodl-learn/)** — LEARN-001…006

The report's finding: pedagogy is the strongest reason to exist and the least-served user. With budget, treat it as a product line with its own team — not a feature.

| ID | Task | Notes | Est. |
|---|---|---|---|
| E-01 | Revive & modernize the lessons engine (legacy `lessons/` code + the `lesson` project field the exporter currently drops — A-02 saves it for a reason) | Interactive in-editor lessons already existed in classic Noodl; the machinery is dormant, not absent | 4–6 wks |
| E-02 | Curriculum v1: 10–15 lessons teaching state, data flow, events, componentization — *real engineering concepts through the graph*, with the AI as tutor (C-04 explain mode), not as ghostwriter | Hire a learning designer; engineers don't write curriculum well | 8–10 wks |
| E-03 | **Web read/present layer**: browser-based graph *viewer* (read-only) so lessons, shared projects, and AI-built pages are one link away — Chromebook-viable | The full editor is Electron-bound; a viewer is 10% of the cost and unlocks classrooms + sharing | 6–8 wks |
| E-04 | **Web editor spike → decision**: assess porting the editor shell to the browser (the renderer is webpack/React already; Electron-specific surface is `noodl-platform-electron` + main process) | Unlimited budget makes this askable; education distribution realistically demands it long-term. Time-boxed spike, then an explicit go/no-go — it's a 6–12 month project if "go" | 4-wk spike |
| E-05 | Classroom mode: teacher dashboard, project sharing, local-model AI (C-01), no-account offline start | Distribution features, driven by pilot feedback | 6–8 wks |
| E-06 | **Two real-world pilots** (a school program, a code club / bootcamp) with instrumentation and interviews | This is Gate G2 (§6) — buy evidence, not opinions | ongoing |

### Track F — Code Export *(Phase 7, reframed and properly funded)*

→ **[Phase 18: Code Export v2](../tasks/phase-18-code-export-v2/)** — EXP-001…005

Sequenced after Track A because generators and LLMs both consume per-component files + the catalog.

| ID | Task | Notes | Est. |
|---|---|---|---|
| F-01 | `@nodegx/core` companion library (reactive primitives preserving push-signal semantics) | Per `CODE-EXPORT-overview.md` ADR-001; explicitly designed for future multi-framework renderers | 3 wks |
| F-02 | Deterministic generators: visual nodes, state stores, events, routing, scaffolding (CODE-002/003/005/006), ts-morph + Prettier output, Vite build | The mechanical 70% | 6–8 wks |
| F-03 | **AI-assisted logic translation**: Function/Expression/dynamic-port nodes translated by LLM against the documented `@nodegx/core` API, with a **verification harness** — run original (interpreted) and exported (compiled) side-by-side on recorded input/output traces; humans review only mismatches | This is what 2026 adds to the 2025 design: the study's hardest problem becomes tractable when every translation is machine-checked rather than trusted | 6–8 wks |
| F-04 | Export report + honesty UX (what's clean, what's best-effort, what needs review) | Keep the study's honesty; it was right about expectations | 1 wk |
| F-05 | **Multi-framework via post-processing**: AI ports the *exported React codebase* to Svelte/Vue, verified by the same trace harness; ship as a supported pipeline, not a promise of native export | Dissolves the last lock-in objection without maintaining N compilers | 4–6 wks |

**Exit criterion:** a UI-heavy real project exports to a React 19 + Vite repo that builds, passes trace verification, and a React developer accepts as inheritable. Lock-in objection: dissolved in practice.

### Track G — Cloud & workflows *(bounded resurrection of Phase 11)*

→ **[Phase 19: Cloud & Workflows](../tasks/phase-19-cloud-workflows/)** — WF-001…003

Finish the workflow runtime (TASK-007C) → Series 1 workflow nodes → one managed deploy target done well (not Docker+Fly+Railway simultaneously). Execution history/overlay (CF11-006/007) already exist. Python/AI runtime stays parked until Horizon 3. Est. 8–10 wks for the bounded slice.

---

## 4. Horizon 3 — Ecosystem (Year 1–2)

→ **[Phase 20: Ecosystem](../tasks/phase-20-ecosystem/)** — ECO-001…005 (specifications only; gated on G3)

Only after the wedges hold. In rough priority order:

1. **Real-time collaborative editing** — CRDT-based multiplayer graphs (v2's per-component files are the right granularity). The classroom killer feature (teacher watches 25 graphs live) and the team feature. Big: 4–6 months.
2. **Component marketplace & community registry** — share components/UBA adapters/lesson packs; v2 + catalog make components genuinely portable units. Includes the community/DevRel hire actually having something to build community *around*.
3. **Multi-project workspaces** (`future-projects/MULTI-PROJECT.md` Option B first — multi-window — exactly as that doc recommends, given the `ProjectModel.instance` singleton).
4. **Hosted platform** — one-click deploy + hosted collaboration + classroom accounts (the commercial engine, if there is one).
5. **Rebrand/identity decision** (the Phase 8 "Nodegex" question) — deliberately late: rename after there's traction to rename.

---

## 5. What stays dead (at any budget)

Discipline is what unlimited budgets usually lose first. Explicitly not on this roadmap:

- **Advanced GitHub integration** (GIT-005–011, 501–662h) — A-07's graph-native diff/merge serves the actual need; deep GitHub-workflow plumbing serves a pro-dev persona vibe coding already owns.
- **Five simultaneous deploy targets** (Phase 5's PWA/Capacitor/Electron-app/Extension matrix) — export (Track F) is the universal escape hatch; one good web deploy + export beats five mediocre wrappers.
- **Native multi-framework compilers** — F-05's verified AI post-processing, not N maintained backends.
- **Competing with vibe-coding on speed** — no feature whose pitch is "faster than prompting." The pitch is always comprehension, ownership, learning.

---

## 6. Gates (the honesty mechanism)

Unlimited money makes it *easier* to ignore bad news, not harder. Three gates, each with a pre-committed question:

- **G1 (≈Month 3) — Substrate gate.** Track A exit demo: external agent authors a valid page via MCP + catalog into a real project. *Fail → the AI-authorable-format thesis is wrong at the foundation; halt Tracks C/F, rethink.*
- **G2 (≈Month 9) — Demand gate.** C-02 demo shipped in a signed build for a full quarter + two E-06 pilots run. Question: do legibility-motivated builders and learners **return unprompted** (retention, not signups)? *Fail → the dream is a museum piece; wind down to maintenance + export (leave no one locked in), open-source everything, exit with dignity.*
- **G3 (≈Month 15) — Wedge gate.** Which wedge pulled harder — Learn (education) or the AI-collaborative builder? Concentrate Horizon 3 investment there; the other becomes a supporting feature. *Refusing to choose is how a 12-phase roadmap happens twice.*

---

## 7. The one-sentence version

**Make the graph a language every human and every AI can read, write, and verify (Track A); make the editor worthy of it (B); make the AI a visible collaborator inside it (C); teach a generation real engineering with it (E); and guarantee everyone a way out of it (F) — shipping from week 4, gated by demand, with the courage to stop at G2 if nobody comes.**
