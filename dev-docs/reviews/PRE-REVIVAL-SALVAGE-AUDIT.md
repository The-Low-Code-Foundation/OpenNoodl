# Pre-Revival Salvage Audit

**Date:** 2026-07-24
**Scope:** The seven pre-revival feature attempts, audited against what actually exists on `cline-dev` and against the revival work (phases 12–16) that has landed since: data flow tracker, local SQL database, canvas overlay, styles overhaul, code editor overhaul, expressions-as-values, cloud functions as an n8n alternative.
**Method:** Seven parallel code-level audits (docs cross-checked against source, wiring verified at call sites, git history consulted). Doc claims were only trusted where code confirmed them; several stale claims are corrected below.

## Verdict summary

| Feature | Real code | State | Salvage verdict |
|---|---|---|---|
| Canvas overlay | ~1,500 lines + mount infra | Live, load-bearing | **Already salvaged** — PLAT-001 upgraded it; Explain Mode depends on it; AIX-003 builds on it |
| Styles overhaul | ~6,000+ lines | Live, healthier than docs say | **Salvage — highest AI synergy per unit effort** |
| Expressions-as-values | ~1,300 lines | Live, works end-to-end (basic types) | **Salvageable, but needs a decision** — the AI substrate is blind to it |
| Data flow tracker | ~4,700 lines | Mixed: substrate good, headline features broken | **Partial salvage** — keep utils/X-Ray, rewrite or retire lineage |
| Code editor overhaul | Shipped + ~1,000 lines dead | CodeMirror live; Monaco TS intellisense orphaned | **Shipped; salvage = cleanup, plus optional intellisense revival via PLAT-003** |
| Local SQL database | ~8,700 lines | Wired UI, **no real database ever** | **Conditional salvage** — RUN-004 is the gate; smallest fix is large-value |
| Cloud functions / n8n | ~2,500 lines | Observability UI with no engine beneath | **Park** (Phase 19 already says so; audit confirms) |

## The pattern behind the "half-assed" feeling

Across all seven, the same failure shape recurs: **the top of the stack was built before the bottom existed.**

- The SQL database has a full schema-manager and data-browser UI — over an adapter whose real engine (`better-sqlite3`) was never installed in any package.
- Cloud functions have an execution-history panel and canvas overlay — over a logger that is never called and an IPC channel with no handler.
- Data lineage has a polished panel — over a tracing algorithm its own author documented as needing a ground-up rewrite (five failed fix attempts logged).

This was not sloppiness; it was solo-capacity ambition split across twelve parallel phases (Phase 19's README says exactly this). The consequence for salvage is favorable: **the expensive-looking parts (UI) mostly exist and work; what's missing is usually a small, well-defined engine or wiring layer.** The revival has also already paid down the risks that would have made salvage dangerous — PLAT-001 gave overlays a clean mount, PLAT-002 removed the jQuery substrate these features would have collided with, PLAT-003 typed the runtime these features touch.

---

## 1. Canvas overlay — already salvaged; it's now load-bearing

**What exists.** `views/CanvasOverlays/` holds two live overlays: `HighlightOverlay/` (~697 lines, phase-4 PREREQ-004, backed by `services/HighlightManager/`) and `ExecutionOverlay/` (~809 lines, CF11-007, the only piece with a test). Both mount through PLAT-001's `OverlayViews.ts` + `OverlayHost.ts` and re-render on pan/zoom. PLAT-001 did **not** delete this work — it extracted the wiring verbatim out of the old god-file and gave overlays a documented single mount path.

**Why it matters to the revival.** Shipped Explain Mode (AIX-004) drives `HighlightManager` from `ExplainPanel/canvasLink.ts` for its hover-highlight/click-navigate citations — the pre-revival overlay is a dependency of a shipped revival feature. AIX-003's planned `DiffOverlay/` is designed as a third sibling in the same directory, and its design doc names PLAT-001's overlay host as the thing that de-risks it.

**Loose ends.** `BoundaryIndicator.tsx` (component-boundary highlighting) is skeleton-only. If a fourth viewport-tracked overlay lands, batch the pan/zoom re-renders.

**Verdict: nothing to decide.** This one stopped being a half-assed attempt and became infrastructure.

## 2. Styles overhaul — shipped, and the best AI-synergy candidate

**What exists (all live and wired):** `StyleTokensModel/` (~1,196 lines) with CSS-variable injection into preview **and deployed builds**; `DesignTokenPanel` + `TokenPicker` (~700 lines); `ElementConfigs/` variant/size registry (~871 lines) consumed by the property editor and node picker; five `StylePresets/`; `StyleAnalyzer/` (~605 lines + 693 lines of tests) with the `SuggestionBanner` **already wired** into the property editor via `ElementStyleSectionHost`.

**Stale doc alert:** PLAT-005's headline deliverable — "wire the dangling STYLE-005 banner" — **is already done** (commit `6e0ad68`, pre-PLAT-002, mounted via React from the start, survived the property-panel rewrite intact; both "unverified" APIs verified at `StyleTokensModel.ts:126` and `NodeGraphNode.ts:649/731`). PLAT-005 should be re-scoped to: verify suggestion *quality* on a real project, and finish the one real stub — `applyVariantAction()` only sets `_variant`, it can't persist a new variant (`ElementConfigRegistry` has no `addVariant`).

**The salvage opportunity.** There is currently **zero connection** between the token system and the AI substrate (grep confirms neither SUB-004 nor AIX-002 mentions tokens). Yet the pieces map one-to-one onto the substrate thesis:

- The resolved token set is a **style vocabulary** — the exact analogue of the node catalog. An agent that emits raw hex values is producing schema-valid nonsense the same way an agent inventing port names does. Expose tokens/`TOKEN_CATEGORIES` in AIX-002's context assembly and generated UI lands on-system.
- `ElementConfigRegistry.getVariantNames/getSizeNames` gives the agent a legal enum per element.
- `StyleAnalyzer.analyzeProject()` is a **ready-made post-generation style linter** — the style-side twin of SUB-006's semantic validator, already written and tested.

**Verdict: salvage, cheap.** This is days of integration work for a visible jump in AI output quality ("a stranger could look at it and want it" is largely a styling bar). It is the single best effort-to-payoff item in this audit.

## 3. Expressions-as-values — it works; the substrate just doesn't know it exists

**Correction to the premise:** this was *not* a half-assed attempt. The n8n-style `fx` toggle (TASK-006 phase 2 + TASK-006B) **works end-to-end** for text/number properties: `ExpressionInput`/`ExpressionToggle`/`PropertyPanelInput` in core-ui, `BasicType.ts` dispatched live from `Ports.ts:401`, evaluation inside the typed runtime (`node.ts:137-205`, called from `setInputValue`), reactive re-evaluation with subscription cleanup, canvas-crash fix in the painter. It survived PLAT-003's typing of the runtime — the evaluation path is *in* the typed core now.

**The real gaps:**
1. **Coverage:** only `BasicType` (string/number) ports have the UI. Color/enum/boolean/slider were specced but never wired (coercion module exists; UI doesn't).
2. **Substrate blindness — the strategic issue.** An inline expression turns a parameter from a primitive into `{mode:'expression', expression, fallback, version}` on a port still typed `string`. Today nothing breaks because the revival machinery ignores parameter values entirely: SUB-002's roundtrip corpus has **no fixture** for object-valued expression parameters; the SUB-006 validator's `NormNode` carries no parameter values; the MCP server has no expression awareness — an agent reading a project sees opaque blobs, and an authoring agent doesn't know the object form exists. The feature violates the substrate's implicit assumption that graph semantics live in nodes + connections.

**Verdict: salvageable, but decide deliberately.** Two coherent positions:
- **Embrace:** add a roundtrip fixture (cheap, do this regardless — fidelity is currently *untested*, not proven), add expression-parameter awareness to catalog/validator/MCP (a carve-out analogous to the existing dynamic-port carve-outs), and teach AIX-002 to emit expressions. Payoff: agents get a massively terser way to express bindings than wiring Expression nodes — very much the n8n idiom, and n8n's agents use it heavily.
- **Freeze:** keep it working as-is for humans, add the roundtrip fixture as a regression guard, and defer substrate integration until after Gate G2. Do **not** extend to more port types until the substrate question is settled.

The one thing *not* to do is extend the UI to more port types while the substrate is blind — that widens the blind spot.

## 4. Data flow tracker — keep the substrate, retire or rewrite the headliners

Not one feature but a phase-4 cluster, all landed 2026-01-04 and abandoned at various depths. (Phase 3.5 "realtime agentic UI" is a false lead — zero code exists; it's deferred into AIX-005 by design.)

**Keep (works):** `utils/graphAnalysis/` (~2,029 lines — traversal, cross-component, categorization, duplicate detection), Component X-Ray panel, and the Highlighting API (see §1). These are sound and already consumed by shipped features.

**Broken, honestly documented:** Data Lineage (VIEW-005, 562-line engine + 833-line panel) — the panel is *reachable today* (`router.setup.ts:114-123`; the "disabled" claim in its own docs is stale — only the canvas right-click entry is off), but the algorithm enumerates all ports instead of following wires, producing 40+ noise steps for a 3-node chain. Five fix attempts failed; the author's own verdict was "requires rethink." Trigger Chain (VIEW-003, ~1,800 lines) is genuinely live-wired to real `connectiondebugpulse` events from the running preview — the only piece that taps actual data flow — but a 5ms dedup threshold **drops legitimate signal** and there's no noise filtering. Topology Map is built but its registration is fully commented out (shelved). Census/Impact/Semantic layers: docs only. Zero automated tests across the phase.

**The AI-era reframe.** Explain Mode already ships the *human-facing* answer to "where does data flow" via AI narration — it is the de facto successor to Data Lineage's intent. But the AI substrate itself has the opposite need: **deterministic** data-flow answers an agent can consult (the validator is connection-structural only; it cannot see flow). A lineage rewrite therefore shouldn't recreate the panel — it should be a *substrate service* (catalog-aware trace over the v2 format) that Explain Mode, the validator, and future agents all consume, with the panel as a thin view if wanted.

**Verdict: partial salvage.** Concretely: (a) keep graphAnalysis/X-Ray/Highlighting as-is; (b) fix Trigger Chain's dedup data-loss bug — it's small and it's the only live data-flow instrumentation the AI collaboration story has; (c) either delete the Data Lineage panel or rewrite the engine as a substrate service — do not incrementally patch it (five attempts already failed); (d) leave Topology shelved.

## 5. Code editor overhaul — it shipped; the salvage is a cleanup decision

**Correction to the premise:** the Monaco→CodeMirror overhaul (TASK-009/010/011) **shipped and is the default**. Editing Function/Script/Expression code today uses the CodeMirror 6 `JavaScriptEditor` (~2,400 lines incl. history/diff/format), dispatched from `CodeEditorType.ts:213`.

**What it left behind:** the swap silently *downgraded* intellisense. The old Monaco path carried a per-node TypeScript language service (~1,000+ lines under `utils/CodeEditor/typescript/` — ambient `.d.ts` injection, per-node types). Verified: no port type routes to it anymore (`'javascript'` → CodeMirror; the one `'json'` port hits Monaco's plaintext early-return). CodeMirror replaced it with a 109-line static completion list. Monaco (`monaco-editor@0.34.1` + webpack plugin) is still bundled solely for that plaintext JSON fallback.

**Verdict: two-step salvage, both aligned with revival work already done.**
1. **Cleanup (do regardless):** move the JSON port to CodeMirror's JSON mode, delete the Monaco wrapper + dead TS subsystem, drop the dependency. Bundle-size and dead-code win; no functionality lost (the dead code serves nothing today).
2. **Optional intellisense revival (post-PLAT-003):** PLAT-003 explicitly wants "a node author, human or AI, gets autocomplete and compile-time errors" and plans emitting real `.d.ts` from the typed runtime — but nothing is scoped to wire those types back into the editor. If hand-written node code remains part of the product (it does, even in the AI-authored world — humans review and touch up), feeding PLAT-003's generated types into a CodeMirror language service restores what was lost, on a foundation that didn't exist when the overhaul was written. Scope it small; it is not critical path.

## 6. Local SQL database — one missing dependency away from real, but gated

**The headline finding:** ~4,100 lines of core (adapter registry, `LocalSQLAdapter` 779, `QueryBuilder` 717, `SchemaManager` 594; `BackendManager` 801, `LocalBackendServer` 595, `WorkflowRunner` 400) plus ~4,600 lines of live UI (Backend Services panel, schema manager, data browser) — all wired into `main.js` and the router, no feature flag — and **`better-sqlite3` was never installed in any package.** Not removed: never added. Every "SQLite" operation ever run in this repo hit the in-memory mock (`LocalSQLAdapter.js:98-103`), which behaves correctly within a session and **silently loses all records on restart**. Schema/config persist as JSON files, which makes the data loss look like a bug rather than what it is: there has never been a database.

Also: `deleteTable` has an IPC handler but zero UI callers; auth, migration/export, and standalone deploy were never started; zero tests; and the orphaned `execution-history` store (§7) is a second SQLite-shaped component that no production code ever feeds a real DB.

**Why it's still worth something:** the education/learn wedge (Phase 17) and any local-first demo need a zero-config data story, and the UI for one already exists and works. The revival already owns the fix: **RUN-004** (make the fallback loud, get the native module building) — not started, and note its doc points at the wrong path (`editor/src/local-backend/` — the real code is `main/src/local-backend/` plus the runtime adapter).

**Verdict: conditional salvage, minimum-fix only.** Do RUN-004's core: install `better-sqlite3` (post-Electron-upgrade, native ABI permitting), make fallback loud and visible in the UI, wire `deleteTable`, add a handful of persistence tests. That converts ~8,700 orphaned lines into a real feature for roughly days of work. Do **not** expand scope (auth, external adapters, export) — the viability report's "park Phase 5" still holds for everything beyond making what exists honest. Until RUN-004 lands, consider a loud warning banner in the Backend Services panel; silent data loss in reachable UI is the worst state of all.

## 7. Cloud functions as n8n alternative — park it; the audit confirms Phase 19's call

**Honest state:** a user today can author a classic single-shot cloud function (request → JS → response) and call it over HTTP locally. That's it. Verified missing: **no workflow engine** (`CloudRunner` is a 99-line request/response invoker — no ordering, error-routing, cancellation, or timeouts; `WorkflowRunner` is a 400-line loader that delegates straight to it and silently no-ops if `noodl-viewer-cloud` doesn't resolve); **no Series-1 nodes** (IF/switch/foreach/try/retry/wait — specs only); **no triggers whatsoever** (full route table read: no cron, no webhook registration, no queue — the README's claim that Phase 5 delivered trigger nodes is not borne out by code); and the observability pipeline is severed at both ends (`ExecutionLogger` never called by any runtime; the History Panel's IPC channel has **no** `ipcMain.handle` anywhere). The deeper runtime work on `feature/task-007c-workflow-runtime` is not in this clone — likely never pushed. DEBT-001 (the client-side cloudfunction2 crash) is genuinely fixed (`cc2efd5`).

**Verdict: park, per Phase 19 — and don't feel bad about it.** The n8n dream needs a graph-execution engine, trigger infra, and a deploy story, against competitors (n8n, Make, Zapier + every AI-agent workflow startup) in the one market segment the viability report says isn't yours. Two genuine assets to protect while parked: the tested-but-unwired execution-history library (648-line store, real schema, 500+-line tests) — it's the observability layer WF-001 would need on day one — and the WorkflowRunner→LocalSQLAdapter injection pattern, which means §6's RUN-004 fix automatically gives future workflows real persistence. If the thesis ever earns a Phase 19 restart (post-G2), the interesting reframe is *agents authoring workflows* through the same substrate — AIX-002 explicitly scoped this out for now, and that was correct.

---

## Recommended actions, in order

1. **Styles → AI substrate integration** (§2). Token vocabulary + variant enums into AIX-002 context; `StyleAnalyzer` as post-generation linter. Days of work, directly improves the Gate-G2 demo. Re-scope PLAT-005 (banner already wired).
2. **Decide expressions-as-values posture** (§3). Either way, add the missing SUB-002 roundtrip fixture for object-valued parameters now — it's a latent data-fidelity risk regardless.
3. **RUN-004 minimum-fix for the local backend** (§6), sequenced after the Electron/native-module question. Loud-failure banner sooner if RUN-004 waits.
4. **Code editor cleanup** (§5): retire Monaco + dead TS subsystem. Optionally scope a small post-PLAT-003 intellisense task.
5. **Trigger Chain dedup fix + Data Lineage decision** (§4): fix the one live data-flow instrument; delete or substrate-rewrite lineage, never patch it.
6. **Cloud functions stay parked** (§7). Protect the execution-history library from bit-rot (it's blocked on the `@noodl-viewer-cloud/execution-history` alias REV-001 owns).

## Unowned gaps surfaced by this audit

No current task claims: the Data Lineage rewrite, the Topology re-wire, the Trigger Chain dedup bug, the ExecutionLogger→runtime wiring + missing IPC handlers, the `better-sqlite3` install (TASK-007K is a DRAFT with no owner; RUN-004 covers it but points at a wrong path), the STYLE-005 variant-persistence stub, and the expression-parameter roundtrip fixture.

---

## Disposition (2026-07-24, same day)

Every unowned gap above now has an owning task. Note one deliberate departure from this audit's recommendations: **§7's "park cloud functions" verdict was overruled** — the backend gap was re-assessed as the remaining leg of the full-stack story and Phase 19 was re-scoped accordingly (see [BACKEND-GAP-ASSESSMENT.md](../tasks/phase-19-cloud-workflows/BACKEND-GAP-ASSESSMENT.md) for the argument; the "no integration library, ever" discipline and the Series 4/5 parking survive).

| Audit item | Owner |
|---|---|
| Styles → AI substrate | **AIX-006** (phase 15, new) |
| Expression-parameter fixture + posture decision | **SUB-011** (phase 13, new) |
| Monaco cleanup | **DEBT-011** (phase 14.5, new) |
| Trigger Chain dedup + Data Lineage retirement | **DEBT-012** (phase 14.5, new) |
| Local backend persistence | **RUN-004** (corrected: real paths, never-installed finding; engine decision shared with WF-004) |
| STYLE-005 variant persistence + analyzer quality | **PLAT-005** (re-scoped: banner-wiring premise was stale — already wired) |
| ExecutionLogger wiring + IPC handlers | **WF-006** (phase 19, new) |
| Backend service extraction / engine decision | **WF-004** (phase 19, new) |
| Workflow engine | **WF-001** (revised: lost-branch finding resolved to "restart with reference") |
| Triggers (schedule/webhook/DB-change) | **WF-005** (phase 19, new) |
