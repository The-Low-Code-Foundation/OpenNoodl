# Can Noodl Be Saved? — Viability Report

**Prepared for:** Richard
**Prepared by:** Claude (Fable), fresh-session assessment per `dev-docs/NOODL-VIABILITY-BRIEF.md`
**Date:** 2026-07-22
**Repo state:** branch `cline-dev`, last commit `d1dacbd` (2026-02-18)
**Companion doc:** [NOODL-REVIVAL-ROADMAP.md](./NOODL-REVIVAL-ROADMAP.md) — the unlimited-budget revival roadmap built on this report's findings

---

## 1. Verdict up front

**Can Noodl be saved? Yes. Disposition: Alive-needs-refocus.**

**The codebase is not the limiting factor.** Every feared deal-breaker was tested and none is fatal: the jQuery "mishmash" is 14 files in one package behind documented, verified containment boundaries; the runtime's node model has zero React imports and is genuinely framework-neutral; React 19/TS 5.9 already landed; the build failures are two hours-scale loose ends from a sprint that stopped mid-flight on 2026-02-18, not rot. The real debts are Electron (12 majors behind) and an untyped runtime — both fixable.

**The dream is alive only in narrowed form.** "Visual development instead of code" is dead; vibe coding took that market. What survives is **the legible substrate for human–AI co-building and for learning real engineering** — and the roadmap's own Phase 10 is the right bet on exactly that, but it is 4/42 tasks in, its decomposed format is wired into nothing, and the keystone (a node/port catalog an AI can consult) is not even scoped.

**The limiting factor is scope versus capacity**: a 12-phase, multi-year roadmap on an effectively solo project. Cut it to four moves (§5); ship the AI-authoring demo in ~3 months; let demand, not sunk cost, decide the rest.

## 2. The strategic case, tested

The vibe-coding threat is real and should be conceded up front: for "I want an app to exist," prompting an AI is faster than wiring nodes, and that market is gone. Noodl cannot win a speed race. The question is which of the three surviving theses hold. Ranked:

### 2.1 (Strongest) Agency & comprehension — *alive, and strengthened by the AI era, but only if repositioned*

The thesis holds better in mid-2026 than it did in 2023, for a reason the brief's framing almost reaches: the flood of AI-generated code has created a *new* problem — people shipping systems they cannot explain, audit, or safely change. A node graph is a live, structural, inspectable artifact in a way a generated repo is not. Crucially, the codebase can actually support the strong version of this thesis: the runtime's node model is a framework-neutral description of state, data flow, and events with **zero React imports in `packages/noodl-runtime/src`** (verified by grep — 0 hits), so "the graph is the legible spec; renderers and exporters are interchangeable consumers of it" is architecturally true, not marketing.

But the thesis only survives as **"the AI builds *with* you in a medium you can both read"** — not "build by hand instead of prompting." Hand-wiring alone loses to vibe coding on speed for almost everyone. The surviving product is an AI-collaborative visual builder: the AI authors pages/components *in the graph*, the human sees, understands, and owns the architecture. That is precisely Phase 10's bet, and it is the right bet — but it is mostly unbuilt (§4.2).

### 2.2 Pedagogy — *the most defensible wedge, and the one the roadmap serves least*

"Learn real engineering visually, not by prompting" is a genuine market position in 2026: educators are actively pushing back on prompt-only "learning," and there is a real gap between Scratch and professional tooling. Noodl's explicit state/dataflow/event model is honest engineering pedagogy in a way both Scratch and vibe coding are not. Two hard caveats:

1. **The roadmap doesn't serve this user.** The scoped work is overwhelmingly pro-dev: advanced GitHub integration scoped at 501–662 hours (`dev-docs/tasks/phase-3-editor-ux-overhaul/`), Universal Backend Adapter, cloud functions with Docker/Fly.io deploys, execution monitoring. A 14-year-old building their first app needs none of that; they need frictionless install (Phase 8, 0% done), templates, lessons (the lessons system exists in legacy code), and a gentle AI mentor. The product is currently trying to be two things, and the roadmap consistently picks the other one.
2. **Education is a distribution problem, not a feature problem**, and no phase addresses distribution to schools/learners at all.

So: pedagogy is the strongest *reason to exist* but currently the weakest *served* thesis. A pedagogy-first refocus is a viable smaller product; it is a strategy decision, not an engineering one.

### 2.3 (Weakest) Engineering discipline by construction — *mostly doesn't hold*

The graph makes structure *visible*, but visibility is not discipline. Nothing in the node model prevents a 300-node spaghetti page — visual programming history (LabVIEW, Max/MSP, Unreal Blueprints) shows large graphs rot exactly like large codebases, minus the refactoring tools. What Noodl genuinely enforces is *explicitness* (state, connections, and events cannot be hidden), which supports theses 2.1 and 2.2. As a standalone selling point against an AI that can be asked to "use clean architecture," it's weak. Fold it into legibility; don't lead with it.

### 2.4 Net strategic verdict

The dream survives **narrowed**: not "visual development instead of code," but **"the legible substrate for human–AI co-building, and for learning real engineering."** Both surviving theses point at the same technical prerequisites: a decomposed, AI-authorable project format (Phase 10) and a credible exit ramp (Phase 7 export). That convergence is what makes the refocus coherent rather than a pivot.

## 3. Codebase health scorecard

Scores: 1 = load-bearing wall you can't move, 5 = healthy.

| Axis | Score | Evidence (one line) | Disposition |
|---|---|---|---|
| Dependency health | **3/5** | React 19.0 / TS 5.9.3 / webpack 5.103 already landed (`packages/noodl-editor/package.json`), but Electron 31.3.1 vs 43.2.0 (12 majors, ≈2 yrs of Chromium security lag) and `npm audit`: 96 vulns (7 critical) / 36 prod (4 critical), mostly in build toolchain | **Fix** — Electron upgrade is the one real project (native modules: better-sqlite3, dugite); rest is routine |
| Architectural coherence (jQuery/TS/React) | **3/5** | jQuery = 14 files / 1 package / 2 subsystems, all boundaries contained via `ReactView.ts` + EventDispatcher (no entangled island found); but 554 `TSFixme`, 192 legacy .js in editor, 3,481-line `nodegrapheditor.ts` | **Fix incrementally** — island-by-island, pattern already proven |
| Runtime/compile pipeline | **4/5** | Framework-neutral engine, zero React imports in `noodl-runtime/src`; React confined to `react-component-node.js` binding hub; ~27 of ~100 node types React-bound | **Leave** (architecture) / **fix** (it's 98 .js vs 6 .ts — type it opportunistically) |
| Project format / decomposition | **2/5** | v2 format + 149 tests exist but **zero app call sites** (grep), saves still monolithic; exporter drops `comments`/`visualRoots`/`lesson` (`io/ProjectExporter.ts:73-74`); no node-type/port catalog for AI | **Fix** — finish STRUCT-005/006/008 + build the catalog; this is the strategic critical path |
| Code-export feasibility | **2/5** | Phase 7 = 0/8 tasks, no codegen code anywhere in `packages/`; but design (companion-lib + per-node generators) is credible and runtime neutrality makes it feasible; dynamic Function/Expression nodes (`simplejavascript.js:187`) cap fidelity | **Build (later)** — React-only, after Phase 10A |
| Test/build health | **3/5** | Typecheck: 17 errors, exactly 2 shallow causes (Ajv 6-vs-8 typings; missing `@noodl-viewer-cloud/execution-history` alias — module exists). Webpack renderer: compiles in 47s with 13 errors, **all** the same missing alias. Viewer builds clean. Prod-build script has a Node-22 ESM bug (`scripts/build-editor.ts:85` + `packages/noodl-editor/scripts/build.ts:3`). ~149 io tests, none skipped | **Fix** — restoring green is hours, not weeks |

The pattern across every row: **mid-flight, not decayed.** Each red mark is an artifact of a sprint stopping abruptly on 2026-02-18, with the sole exception of Electron/runtime typing, which are genuine accumulated debt.

## 4. The deal-breaker details

### 4.1 React lock-in — **survivable**

The lock-in is shallower than feared. The architecture is a clean two-tier split:

- `packages/noodl-runtime` is a framework-neutral push/dirty-flag engine: nodes are plain JS definitions with input setters, output getters, `flagOutputDirty` (`packages/noodl-runtime/src/node.js:557`), `sendSignalOnOutput` (`node.js:568`), and a scheduler that merely emits `scheduleUpdate` events (`src/nodecontext.js:184`) — it does not own a render loop. **Zero React imports** (grep of `packages/noodl-runtime/src`: 0 hits; React appears only in comments).
- React is confined to a binding layer: one hub file, `packages/noodl-viewer-react/src/react-component-node.js` (~1,190 lines), plus the visual components in `components/**`. Visual node *definitions* stay neutral metadata and acquire React only via `getReactComponent()` (e.g. `src/nodes/visual/group.js:20`). Of ~100 registered node types, only **~27 are React-bound** (files using `createNodeFromReactComponent`); only 3 node files import React directly. The other ~70+ logic/data/event/state nodes are framework-neutral plain objects.

So "React semantics baked into the node model" is **refuted**. A Svelte/Vue target would need a new binding hub + visual component library — real work, but bounded and additive, not a rewrite of the model. Phase 7's own ADR-001 chooses companion-library primitives explicitly to "enable future multi-framework support (same primitives, different renderers)."

The honest residual lock-in is not React — it's the **runtime-interpreted dynamic behaviors** (§4.3): Function/Expression nodes and dynamic ports whose semantics exist only at runtime. That's a Noodl-lock-in question, and it's where export gets hard.

### 4.2 Monolithic project JSON — **survivable, but only half-addressed, and the missing half is the strategic half**

What STRUCT-001…004 delivered (verified in `packages/noodl-editor/src/editor/src/io/`): a well-typed pair of pure transform libraries (legacy ⇄ v2 multi-file format: `nodegx.project.json`, `components/<Path>/{component,nodes,connections}.json`, `_registry.json` — layout at `ProjectExporter.ts:7-18`), 8 JSON schemas with human-readable field descriptions, a format detector, and ~149 tests with real `toEqual` fidelity assertions and zero skipped tests.

What it did **not** deliver — three findings that matter:

1. **v2 is wired into nothing.** Grep across `packages/` finds **zero application call sites** for the new `io/ProjectExporter`/`ProjectImporter`/`ProjectFormatDetector` — they are referenced only from `tests/io/`. (The `ProjectImporter` imported in `models/` and `EditorPage.tsx` is the *old, unrelated* `@noodl-utils/projectimporter`.) Day-to-day saves still write monolithic `project.json`. The pieces that would change that — STRUCT-005 lazy loading and STRUCT-006 component-level save — are unbuilt (specced at ~24–32h combined).
2. **The round-trip claim is overstated at the edges.** Tests are genuine equality checks but run only on synthetic fixtures; no golden real-project fixture, no whole-object `expect(roundTrip(p)).toEqual(p)`. And the exporter **silently drops `comments`, `visualRoots`, and `lesson`** (`ProjectExporter.ts:73-74`; importer rebuilds graphs from `{roots, connections}` only, `ProjectImporter.ts:344-347`) — untested because fixtures never set them. Fixable, but it must be fixed before any migration wizard touches a real project.
3. **The real blocker for "AI authors a page" is not in any STRUCT task: there is no node-type/port catalog.** The v2 format is structurally self-describing but semantically open — `node.type` is a free string, parameters and port names are unvalidated string bags, and component ports are usually absent (`ProjectExporter.ts:259-271`). An LLM could emit schema-valid JSON while wiring nonexistent ports. Nothing in the repo gives an AI the enumerable vocabulary of node types, parameters, and ports.

The mitigating discovery: **the catalog is cheap to build**, because the runtime already holds the data. `noderegister.js` captures every node's inputs/outputs/types/displayNames as neutral metadata at registration time. A script that walks the register and dumps a `node-catalog.json` turns the missing blocker into roughly a week of work — but someone has to decide to do it; it's currently unscoped.

Verdict: the decomposition bet is sound and ~45% of its plumbing exists, but "AI codes a whole Noodl page" is **not reachable on what's built today**. It's reachable with STRUCT-005/006/008 (+007 for migration) plus the unscoped catalog — call it 4–7 focused weeks.

### 4.3 Code export — **survivable as React-only export; "any framework" stays partly aspirational**

Status check first: Phase 7 is **0% built** (`phase-7-code-export/PROGRESS.md`: "Not Started", 0/8 tasks; no `@nodegx/core`, no codegen directory anywhere in `packages/` — the "nodegx" strings in `io/` are the v2 *file format*, not code generation).

Is the CODE-EXPORT-STUDY's pessimism still justified in 2026? **Partially — and less than it was.**

- What has aged: the study's worst-case framing ("a year building a compiler that produces questionable code") predates practical AI-assisted transpilation. The Phase 7 design that superseded it is already smarter than the study's "Eject with TODO stubs": a companion library (`@nodegx/core`, ~8KB) preserving the push-signal semantics, per-node-type generators, ts-morph AST output. That architecture is credible, and an LLM in the loop genuinely helps with the study's hardest cited problem — restructuring signal chains into idiomatic handler code — plus Function-node translation (LLMs are good at "rewrite this 20-line snippet against a documented API").
- What has *not* aged: the semantic gaps are real and verified in code, not hand-waving. Function nodes compile arbitrary user code at runtime via `new AsyncFunction` and **discover their output ports dynamically through a Proxy** (`packages/noodl-runtime/src/nodes/std-library/simplejavascript.js:19-37,187`); Expression nodes compile strings via `new Function` with runtime dependency detection (`expression-evaluator.js:177`); dynamic ports are pervasive and only fully known at runtime (`dev-docs/reference/LEARNINGS.md:1288,1300`). Deterministic 100%-fidelity export of arbitrary projects is not achievable; export will always be a spectrum from "clean idiomatic code" (visual/UI-heavy projects) to "mechanical output needing review" (dynamic-logic-heavy projects). The maintenance-parity burden (runtime and compiler must agree forever) also remains fully valid.

Ranked outcome per the brief's options: **(b) React-only export is realistic and is enough** — with (c) as the honest floor for dynamic-heavy projects. 12–16 weeks estimated by the docs; assume the upper end. Successful React export *does* substantially dissolve both objections: you can leave Noodl with a working React 19 + Vite codebase (Noodl lock-in), and once code exists, "AI, port this to Svelte" is a normal 2026 task on the *exported code* — meaning multi-framework arrives via AI-on-the-output, not via Noodl maintaining N backends. Direct multi-framework export from the graph (option a) should not be promised.

One sequencing note: export becomes much easier *after* Phase 10's decomposition + node catalog, because a generator and an LLM both consume per-component files with a typed vocabulary. Build 10A first; 7 second. And ship the graph-in-repo (v2 format is git-diffable JSON) as the near-term anti-lock-in story while export is built.

### 4.4 The jQuery/TS/React mishmash — **already-addressed in pattern, survivable in fact**

Richard's "mishmash of decades… beyond saving" is **refuted by measurement**. The blunt worry imagines entanglement; the evidence shows containment:

- **jQuery is 14 files in one package** (all `noodl-editor`; several are vendored bundles), zero jQuery in runtime/viewer/core-ui, no npm dependency — a vendored `src/assets/lib/jquery-min.js` provided as a webpack global. Usage clusters in exactly two subsystems: PopupLayer (`views/popuplayer.js`, 1,043 lines, 101 `$(` calls) and the property editor (`resizingview.js`, `marginpaddingview.js`, `DataTypes/*`), plus the canvas shell and a 278-line homegrown `View` base class (`src/shared/view.js`) with only ~21 subclasses. No Backbone. Underscore is utility-only.
- **The boundaries are architected, documented, and held.** `ReactView.ts` gives React a private div + single `createRoot` (`src/shared/ReactView.ts:28-44`); LEARNINGS codifies the rules ("NEVER put legacy canvas/jQuery in React component JSX… coordinate via EventDispatcher", `dev-docs/reference/LEARNINGS.md:524,602-606`). Every island inspected — CommentLayer, ColorType/property DataTypes, PopupLayer-as-host, the canvas's five React overlay roots — owns an exclusive DOM subtree and coordinates via events or public methods. **No case was found of React and jQuery co-managing the same element.**
- **Migration is demonstrably in progress**: `noodl-core-ui` is 100% TS/TSX (386 files, 1 .js); VersionControlPanel is fully React; the editor is majority-typed (537 .ts + 246 .tsx vs 192 .js).

The *actual* heterogeneity debt, which the jQuery framing obscures: (1) `noodl-runtime` (98 .js / 6 .ts) and `noodl-viewer-react` (131 .js) are still overwhelmingly untyped — stable, but hostile to contributors and to AI-assisted modification; (2) 554 `TSFixme` markers concentrate at the TS↔JS seams; (3) `nodegrapheditor.ts` is a 3,481-line hybrid god object — contained by design (jQuery shell + 5 independent React roots + EventDispatcher), but the single scariest file to change, which is why `CANVAS-MODERNISATION-PROJECT.md` exists.

Verdict: **fatal — no. Survivable — yes, incrementally, island-by-island**, and the containment pattern to do it is already established and battle-tested in this codebase.

## 5. Roadmap triage

Status per phase verified against `PROGRESS*.md` files **and git history** — note the top-level `PROGRESS.md` files are stale (several say "0%" for work git shows was completed in the Feb 2026 sprint; trust the per-dev files + commits).

| Phase | Still worth doing? | Why (one line) | Rough effort left |
|---|---|---|---|
| 0 Foundation stabilisation | done | 5/5 complete; patterns (EventDispatcher/React bridge) hold | — |
| 1 Dependency updates | done* | React 19/TS 5.9/Storybook 8 landed (48 `createRoot`, no legacy `ReactDOM.render`); *Electron upgrade was never in scope — add it | Electron 31→43: 1–3 wks |
| 2 React migration (editor) | done | 9/9 per tracker; corroborated by file-mix counts | — |
| 3 Editor UX overhaul | **partial — cut deep** | Dashboard/GitHub-basic done, but GIT-005–011 alone is scoped 501–662h of pro-dev plumbing that serves neither surviving thesis | Kill advanced GitHub scope; keep small UX fixes |
| 3.5 Realtime agentic UI | partial — defer | 0/7 built, spec stubs; relevant to the AI-collaborative story *eventually*, but not before Phase 10A exists | Defer; ~unknown (7 tasks) |
| 4 Canvas visualisation views | partial | ~60%: X-Ray/highlighting work; lineage disabled, 3 views are specs; diagnostic views support legibility thesis but aren't critical path | Finish only what's stable; park the rest |
| 5 Multi-target deployment | **no (park)** | 3/11; BYOB/SQLite has known bugs (in-memory fallback); five deploy targets unstarted; none of it serves the wedge | Park |
| 6 UBA system | keep (finish small) | UBA-001–009 actually done (git: 2026-02-18 sprint) incl. UBAClient, panels; needs E2E + a reference backend to be real | UBA-010 + Directus ref: 1–2 wks |
| 7 Code export | **yes — reframed** | The anti-lock-in answer; credible companion-lib design; do *after* 10A, React-only, AI-assisted | 12–16 wks (docs' own estimate) |
| 8 Distribution | **yes — small & mandatory** | 0% built; signing/auto-update/CI (~38–56h docs estimate); without it nothing ships to anyone | ~1.5–2 wks |
| 9 Styles overhaul | keep (finish small) | ~500 hardcoded colors tokenised; STYLE-005 built but banner not wired into property panel (2 unverified API calls) | Days |
| 10 AI-powered development | **yes — THE priority** | The repositioning bet; STRUCT-001–004 done (4/42 tasks), but v2 unwired + no node catalog + zero agent code; ~400–550h scoped for full phase | 10A completion: 4–7 wks; minimal agent: +4–6 wks |
| 11 Cloud functions | partial — park most | ~6/19 (execution history/overlay done); workflow nodes blocked on unfinished runtime; Docker/Fly deploys & Python runtime are scope creep for a solo project | Park beyond what's built |

### The minimum viable surviving roadmap

Four moves, in order — everything else is parked, not deleted:

1. **Reanimate & harden (1–3 weeks).** Fix the two build breakages (Ajv typings in `schemas/validator.ts`, the `@noodl-viewer-cloud/execution-history` alias, the build-script ESM bug); `npm audit fix` the easy vulns; upgrade Electron 31→43. Exit criterion: green typecheck, green tests, a packaged app on current Electron.
2. **Phase 10A — finish the decomposed format and make it real (4–7 weeks).** STRUCT-005/006 (editor actually reads/writes v2), fix the `comments`/`visualRoots`/`lesson` fidelity gaps, STRUCT-008 against real projects, STRUCT-007 migration. **Plus the unscoped keystone: auto-generate `node-catalog.json` from `noderegister.js` metadata** — the enumerable node/port/parameter vocabulary an AI needs. Exit criterion: a real project saved as per-component files, and an LLM given one component file + the catalog can author a valid sibling that loads.
3. **Phase 10B-minimal — one AI-authoring loop (4–6 weeks).** Not the 38-task vision: one flow — "describe a page → AI writes `components/<Page>/*.json` → editor hot-loads it → human inspects the graph." Also: point the existing AiAssistant at current models (it still targets `gpt-4o-mini`/`gpt-3.5-turbo` and the retired `text-davinci-003`, `AiAssistant/interfaces.ts:11,16`; only the migration helper uses a modern Claude model, `utils/migration/claudeClient.ts:56`). This is the demo that tests whether the dream has users.
4. **Phase 7 — React-only export (12–16 weeks) + Phase 8 distribution (~2 weeks)** — in whichever order market feedback from step 3 demands. Export dissolves lock-in; distribution makes any of it installable.

That is roughly **6–9 months of focused solo work to the full four moves** — or ~3 months to the end of move 3, which is the point where the strategic thesis gets its first real market test.

## 6. What would have to be true

Conditions under which my verdict flips — what I'd need to see to change my mind:

**Flip to "Dead" (or archive) if:**
1. **STRUCT round-trip fails on real projects in ways that can't be patched.** The v2 tests have never seen a real `project.json` (all synthetic fixtures). If STRUCT-008 against a real 200-component project reveals systematic loss beyond the known `comments`/`visualRoots`/`lesson` gaps, the decomposition bet — and with it the repositioning — loses its foundation.
2. **The Electron 31→43 upgrade is blocked by native modules with no path** (better-sqlite3, dugite, or the editor's window/IPC assumptions breaking hard across 12 majors). An unshippable, unpatchable desktop shell is a genuine load-bearing wall. (I rate this unlikely — but it's untested.)
3. **Move 3 (the AI-authoring demo) ships and nobody cares.** If, given a working "AI writes a page into your visible graph" loop, neither learners nor legibility-motivated builders show up within a quarter, the market has answered — the theses in §2 are hypotheses, not facts, and I have verified the code, not the demand.
4. **Sustained capacity stays below ~10 h/week.** The math in §5 assumes focused solo work. At drip-feed pace the 6–9 months becomes years, competitors (AI-native visual tools) close the legibility gap, and the honest move is archive-with-dignity: land the reanimation fixes, tag a release, write the README post-mortem.

**Flip to "Alive-as-is" (full 12-phase roadmap) if:**
5. Funded headcount of ~3+ materializes — the full roadmap is not irrational, it's just sized for a team that doesn't currently exist.

**Would strengthen (not flip) the verdict:**
6. The Electron upgrade landing cleanly in under a week; the 149 io tests passing on a real project fixture; one external contributor returning.

## 7. Recommended next move

**Revive-refocused.** Not as-is (the 12-phase roadmap is sized for a team you don't have, and half of it serves a pro-dev market that vibe coding already took), not archive (the hard architectural risks the brief feared — entangled mishmash, React-baked model, unbuildable code — were all checked and refuted), and not rewrite-the-core-first (the core is the healthiest part; a rewrite would burn the year the window may not give you).

**The single highest-leverage first task: the reanimation commit.** In one sitting: pin/upgrade Ajv to v8 to fix `schemas/validator.ts`, add the `@noodl-viewer-cloud/execution-history` alias to the editor's tsconfig + webpack resolve, and fix the ESM import bug in the build scripts. That takes typecheck from 17 errors to ~0, the renderer webpack build from 13 errors to 0, and unblocks the packaged build — the difference between "a stalled repo" and "a working project you're improving" for the cost of an afternoon. (Also fix the test harness boot — `test.js:51` gets `app` undefined from `require('electron')` in this environment — so the 149 io tests can actually gate the STRUCT work.)

Then execute §5's four moves in order. The strategic milestone to aim everything at is the end of move 3: **a stranger watches an AI build a page inside a graph they can read, in an app they can install.** Every task should justify itself by distance to that demo.

One further honest note: this report validates the codebase and the plan's coherence — it cannot validate demand. Move 3 is deliberately positioned as the cheapest possible market test of the §2 theses. Build to that test; let it, not sunk cost, decide what happens after.

## 8. Appendix: evidence log

### A. Environment
- Node v22.22.0, npm 10.9.4, macOS (Darwin 25.5.0)
- Branch `cline-dev` @ `d1dacbd` (2026-02-18), 11 packages under `packages/*`, Lerna 7 + npm workspaces

### B. Dependency probes (Workstream A, run 2026-07-22)

Key versions (from `packages/*/package.json` + `npm outdated`):

| Dep | Current | Latest (2026-07) | Gap |
|---|---|---|---|
| react / react-dom (editor, core-ui) | 19.0.0 | 19.2.8 | patch-level — **modern** |
| typescript (editor, root) | 5.9.3 | 7.0.2 | 2 majors, but 5.9 is fully serviceable |
| typescript (viewer-react, core-ui, viewer-cloud) | 4.9.5 | 7.0.2 | split-brain: 3 packages still on TS 4.9 |
| webpack | 5.103.0 | 5.108.4 | minor — fine |
| **electron (editor)** | **31.3.1** | **43.2.0** | **12 majors ≈ 2 years of Chromium/Node security lag** |
| electron-builder | 24.13.3 | 26.15.3 | 2 majors |
| storybook | 8.6.14 | 10.5.3 | 2 majors |
| @anthropic-ai/sdk | 0.71.2 | 0.112.5 | stale but low-risk |
| jquery | *not an npm dep at all* | — | vendored static file `packages/noodl-editor/src/assets/lib/jquery-min.js` |

- `npm outdated` full output: 129 rows (saved during audit; ~60 unique deps behind, most minor/patch).
- `npm audit`: **96 vulnerabilities (7 critical, 46 high, 30 moderate, 13 low)**.
  - `npm audit --omit=dev`: **36 vulnerabilities (4 critical, 14 high)**.
  - Critical: handlebars, lodash (no fix), minimist, mkdirp, shell-quote, tar, websocket-driver. High includes electron itself, electron-builder, storybook, lerna/nx toolchain, aws-sdk (no fix), underscore.
  - Most critical/high vulns are in **build/publish toolchain** (lerna, electron-builder, storybook, s3/aws-sdk upload path), not in code shipped to end-user apps — but Electron 31 itself is a real, user-facing security surface.
- Install state: `node_modules` present (1282 top-level entries), `package-lock.json` 1.1 MB, `npm install` resolves.

### C. Typecheck (2026-07-22)

`npm run typecheck:editor` → **17 errors, exactly 2 root causes**:
1. `src/editor/src/schemas/validator.ts` (5 errors) — Ajv v6 typings vs Ajv v8 API (`instancePath`, `strict` option). STRUCT-001 code was written against Ajv 8; `noodl-editor` resolves Ajv 6.12.6 (`npm outdated`: ajv 6.12.6 → 8.20.0 wanted).
2. `@noodl-viewer-cloud/execution-history` unresolved (12 errors) — the module **exists** (`packages/noodl-viewer-cloud/src/execution-history/{index.ts,ExecutionLogger.ts,store.ts,types.ts}`, commits `95bf2f3`, `7d373e0`, `83278b4`) but the editor's `tsconfig.json` lacks the path alias. Config fix, not missing code.

Both are hours-scale fixes left dangling by the mid-sprint stall, not structural rot.

### D. Build & test attempts (2026-07-22)

- `npm run build:editor` → **fails**, two script-level causes: (1) `packages/noodl-editor/scripts/build.ts:3` imports `../../../scripts/helper` extensionless, which Node 22's ESM resolver rejects (`ERR_MODULE_NOT_FOUND`); (2) `scripts/build-editor.ts:85` then errors on a debug `ls /node_modules/app-builder-lib/templates` (absolute-path bug). The **viewer bundle built successfully** before the editor step.
- `npx webpack --config=webpackconfigs/webpack.renderer.production.js` (editor, direct) → compiles in **47s with 13 errors — every one of them** `TS2307: Cannot find module '@noodl-viewer-cloud/execution-history'`, i.e. the same missing alias as typecheck. With that alias added, the renderer build is expected green.
- `npm run test:editor` → harness fails to boot: `test.js:51` `TypeError: Cannot read properties of undefined (reading 'on')` — `require('electron').app` is undefined (Electron ran as plain Node v20.15.1; possibly environmental/sandbox). **The ~149 io tests could not be executed in this assessment**; they are reported green in `PROGRESS-dishant.md` as of 2026-02-19. Consistent with last commit `b5f200c` "Trying to fix editor launch bugs".

### E. Mishmash quantification (Workstream B, agent-verified, key numbers)

- File mix (excl. node_modules/dist): noodl-editor 192 .js / 537 .ts / 246 .tsx; noodl-runtime 98 .js / 6 .ts; noodl-viewer-react 131 .js / 32 .ts / 35 .tsx; noodl-core-ui 1 .js / 151 .ts / 235 .tsx.
- jQuery: 14 files total, all in noodl-editor, mostly vendored bundles; no `import`/`require('jquery')` in source (webpack ProvidePlugin global). Top real users: `views/popuplayer.js` (101 `$(` calls), `views/projectsview.ts` (65), property editor views (~30 each), `src/shared/view.js` base class (30), `nodegrapheditor.ts` (10).
- Homegrown jQuery MVC: `src/shared/view.js` (278 lines, `bindView`/`watch` via `__defineGetter__`), ~21 subclasses; 47 runtime-loaded `.html` templates. No Backbone. `TSFixme`: 554 occurrences (my count; agent counted 520 with a narrower glob) + ~125 `: any`.
- Containment check (5 islands: ReactView bridge, CommentLayer, ColorType/DataTypes, PopupLayer, VersionControlPanel): **all contained** — exclusive DOM subtrees, single persistent `createRoot`, coordination via EventDispatcher/public methods (`src/shared/ReactView.ts:28-44`; `views/commentlayer.ts:147-154,386`; LEARNINGS.md:524,602-606). No entangled island found.

### F. Runtime coupling & export (Workstream C, agent-verified, key facts)

- `packages/noodl-runtime/src`: 0 React imports (verified independently). Neutral engine: `node.js:557` (`flagOutputDirty`), `node.js:568` (`sendSignalOnOutput`), `nodecontext.js:180-185` (scheduler emits `scheduleUpdate`, owns no render loop).
- React binding layer: `noodl-viewer-react/src/react-component-node.js` (~1,190 lines, `NoodlReactComponent` at `:88`, per-frame `forceUpdate` batching at `:603-614`); visual nodes stay neutral metadata + `getReactComponent()` (`nodes/visual/group.js:20`, `nodes/controls/button.ts:34`). 27 files use `createNodeFromReactComponent`; 3 node files import React directly; ~70+ node types are framework-neutral.
- Runtime-only behaviors resisting static export: Function node `new AsyncFunction` + Proxy-discovered dynamic output ports (`nodes/std-library/simplejavascript.js:19-37,187`); JS node parser `new Function` (`javascriptnodeparser.js:20`); expression compiler + runtime dependency detection (`expression-evaluator.js:177,279`); dynamic ports generally (`LEARNINGS.md:1288,1300`).
- Phase 7: 0/8 tasks started (`phase-7-code-export/PROGRESS.md`); no `@nodegx/core`/codegen code in `packages/`; design = companion library + per-node-type generators + ts-morph, 12–16 wks, React 19 target, DB/cloud nodes stubbed.

### G. STRUCT / Phase 10 (Workstream D, agent-verified, key facts)

- v2 layout per `io/ProjectExporter.ts:7-18,308-401`; pure transform classes (no fs); detector scoring `ProjectFormatDetector.ts:112-113`.
- Tests: `tests/io/` = 55 (Importer, ~18 round-trip) + 68 (Exporter) + 26 (Detector) `it()` blocks, zero skipped; real `toEqual` assertions (e.g. `ProjectImporter.test.ts:390-396,459-468,499-506`) but all fixtures synthetic; no whole-object round-trip equality; `comments`/`visualRoots` dropped (`ProjectExporter.ts:73-74`, `ProjectImporter.ts:344-347`).
- Integration: zero app call sites for the new io/ classes (all references in `tests/io/`); `models/`/`EditorPage.tsx` "ProjectImporter" hits are the old `@noodl-utils/projectimporter`. STRUCT-005…009 unbuilt (README scoping: 56–74h remaining).
- AI-authorability gap: schemas have per-field descriptions but `node.type`/params/ports are open strings; no node-type/port catalog exists anywhere; `_registry.json` is the only manifest an AI can consult. Catalog is generatable from `noderegister.js` metadata (inputs/outputs/type/displayName captured at registration).

### H. Roadmap & activity (Workstream E, agent-verified, key facts)

- Phase status: 0,1,2 complete; 3 ~30% (GIT-005–011 scoped 501–662h, barely begun); 3.5 = 0/7 spec stubs; 4 ~60% (some views unstable/disabled); 5 = 3/11 (BYOB SQLite falls back to in-memory mock); 6 = UBA-001–009 done (stale top-level PROGRESS.md says 0% — wrong); 7 = 0/8; 8 = 0 (~38–56h est.); 9 mostly done, STYLE-005 banner unwired; 10 = 4/42 (STRUCT-001–004); 11 ≈ 6/19.
- Git: activity window 2025-12-28 → 2026-02-19, then zero commits. Contributors since 2025-01-01: Richard 87 commits, dishant 11, Axel 4 — effectively solo + one sprint partner. Candid failure commits exist ("Tried to add data lineage view, implementation failed").
- AiAssistant (`models/AiAssistant/`): working node-generation copilot streaming against OpenAI (`context/ai-api.ts:17`), but model IDs are stale-to-retired: `gpt-4o-mini`/`gpt-3.5-turbo` (`api.ts:41,47`, `interfaces.ts:16`), `text-davinci-003` (`interfaces.ts:11`). Only the legacy-project migration helper uses a modern model (`utils/migration/claudeClient.ts:56`, `claude-sonnet-4-20250514`).
