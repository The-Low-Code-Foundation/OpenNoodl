# Phase 84 — The defects the field report found

**Scoped:** 2026-09-09, from 15 confirmed community issues, re-measured against `cline-dev` HEAD
(`11b2d3a9`) rather than against the 0.2.2 AppImage they were filed from.
**Status: OPEN — 3 of 17 built (FLD-001 2026-09-09; FLD-007 and FLD-009 2026-09-10).** **Prefix: `FLD`.** **Release: ⬜ NOT RULED** (see §2).

On 2026-09-08 an unattended agent session on one Fedora machine installed NodeGX, drove it entirely
through the bundled MCP server, measured it, and filed **21 issues**. Richard filed **2** more the
same day against the Columns node. This phase owns the **15 that survived re-measurement** as real,
current and ours. Seven others are scoped by [phase 83](../phase-83-behind-a-click/README.md); four
can be closed; five are filed against something other than the defect they describe (§3).

> "Score: 5 of 9 for my use case. And the gap is not architectural." — @dishant-kumar-thakur

> "Blocks me — I cannot work around it." — @richardosborne14,
> [#21](https://github.com/The-Low-Code-Foundation/NodeGX/issues/21)

## 1. The person sentences — this phase has two tracks, and pretending otherwise would be a lie

**Track A — it went wrong and said nothing.** Eight of the fifteen are the same shape: the product
does something wrong and reports nothing. A wire is accepted and discarded. A breakpoint never
fires. A filter is dropped and an aggregation answers anyway. A page is five times too tall with
zero validation errors. A button reports 100% and does not move.

> **A person is never wrong without being told. When the product cannot do what the graph asks, it
> says so — at the port, on the canvas, or in the report — instead of rendering something plausible
> and staying quiet.**

**Track B — it costs too much to install and to drive.** The other seven are ergonomics and
packaging: what the release ships, what a Linux user hits on first launch, what an agent has to
spend to verify a page or learn what will not export.

> **A person installs NodeGX on a current Linux distribution and it starts; an agent verifies ten
> pages without spending half a megabyte of context and thirty-seven seconds of sleeping.**

🔴 **Track A outranks track B in every ordering decision in this phase.** A silent wrong answer is
worse than an expensive right one.

## 2. 🔴 Rulings needed before session 2 — do not guess these

| # | question | why it changes the work |
|---|---|---|
| R1 | **Which release does this ship with — 0.2.3, or split?** | FLD-001 is a blocker on a shipped node. It may not want to wait behind the rest. |
| R2 | **Charts: a kit, or core nodes?** (FLD-015) | The kit route exports **today** and is days; core nodes are weeks and duplicate arc maths across runtime and emitter. But a kit is not in the picker by default, so "there is no chart primitive" stays true for anyone who does not install it. Product call, not engineering. |
| R3 | **The Advanced Columns prefab (FLD-003) — build it, or add ports?** | Richard proposed the prefab himself and argued against "a hundred new fields". Confirm before anyone authors library content. |
| R4 | **Does FLD-004 ship in a patch release?** | It switches on a value coercion that has been dead for every dynamically registered units port **since the initial commit**. Mostly it makes wrong things right. "Mostly" is the problem. |
| R5 | **Is enabling minification (FLD-017) in scope, or deferred?** | It is one line and −35 MB, and it needs a full QA pass this phase may not want to own. The −86 MB sourcemap fix does not. |
| R6 | **Does FLD-010 include the advisory lock, or only `session_status`?** | The measured answer is that the lock is largely unnecessary once FLD-009 lands — the editor already refuses to clobber. Confirm before building a locking protocol. |

🔴 **DO NOT SCOPE BY TIME** — standing rule from phase 77. Dependency order only. No estimates.

## 3. What the re-measurement corrected in the issues

The issues were a report, not a diagnosis. This is what challenging them against the code found.
**Nine claims did not survive.** These four matter to the tasks below; the rest are in §6.

- 🔴 **#26's suspected cause is wrong, and the real one is a one-word typo elsewhere.** The reporter
  guessed the height port is read only at init, or that a connection overwrites the parameter. The
  ports are declared **identically** to `width`. A bare number arriving over a wire is merged into
  the port's *current unit*, which defaults to `%` — so wiring `400` means **400%**, which becomes a
  `flexGrow` in a column parent with nothing to grow into. Underneath that, `registerInput` seeds a
  units port as `{value, **type**: defaultUnit}` while every consumer reads `.unit`
  (`noodl-runtime/src/node.ts:135` vs `:402`). **Two independent research passes found that typo
  from two different issues.** FLD-004.
- 🔴 **#21 is not a breakpoint bug; the breakpoint code is correct and unreachable.** The
  `ResizeObserver` is attached in a `useEffect` with `[]` deps that reads `containerRef.current` at
  mount — and `Columns.tsx:431` returns `null` when the node has no children, so there is nothing to
  observe at that mount. Children arrive by `forceUpdate`, a **re-render, not a remount**, so the
  effect never runs again. `containerWidth` stays `null` for the life of that node instance and
  `pickBreakpointLayout` is never called. FLD-001.
- ⚠️ **#37's requested field would not have prevented the problem #37 describes.** `Circle` is
  `status: "translated"` in the ledger. The refusal is per **parameter source**, not per type — a
  wire into any of thirteen structure ports refuses the node. Shipping `{status, badge, reason}`
  alone would have read **green** on the type that caused all 23 refusals. FLD-013 ships the
  structure-port list too, or it ships a lie.
- ⚠️ **#32's proposed discriminator misses the case that produced half the noise.** The slider thumb
  is a plain unclassed `<div>` (`Slider.tsx:175`) whose parent is also unclassed; only its `<input>`
  *sibling* carries `ndl-controls-range2`. Neither the tag test, the `appearance` test nor the class
  test reaches it. FLD-012.

## 4. The measured findings (2026-09-09, `cline-dev` HEAD — read from source, not from a task file)

| # | finding | measured at | task |
|---|---|---|---|
| 1 | 🔴 Observer effect has `[]` deps and reads the ref at mount; `if (!props.children) return null` means a childless Columns has no ref to give it. The comment above that early return says it was added to fix a hook-count crash on live editing — **the fix for one bug created this one** | `Columns.tsx:358`, `:431` | FLD-001 |
| 2 | The measured width comes from `container.offsetWidth` on a div declared `width: calc(100% + marginX)` — "container width" reads **16px wide** by default, so "Medium Below 700" fires below 684 | `Columns.tsx:367`, `:502` | FLD-001 |
| 3 | 🔴 `registerInput` writes `{value, type: defaultUnit}`; `setInputValue` tests `currentInputValue.unit`. Present since `b9c60b07d` (initial commit). The comment two lines above the reader states the contract the writer breaks | `noodl-runtime/src/node.ts:135` vs `:402` | FLD-004 |
| 4 | A non-conforming value on a units port reaches a setter that does `delete props[name]`, taking the port's default with it — which is how #26's static fallback is lost | `react-component-node.ts:627-639` | FLD-004 |
| 5 | `Group`'s `sizeMode` defaults to `explicit` with `width`/`height` `100%` from the shared mixin; **9 of the shipped style recipes** set `width` and never `sizeMode` | `node-shared-port-definitions.ts:1115`, `StyleCompositions.ts` | FLD-005 |
| 6 | 🔴 This is **already an open register row with an unbuilt owner** — V1 and V17 in phase 81, owned by **VIB-005 "The Ambush Defaults"**, which is ⬜ never built and also owns V2/V14/V21/V38. ⚠️ **FLD-005 collides with it** | `phase-81/README.md:149`, `:173`, `:188`; `NEXT-SESSION-PROMPT.md:73` | FLD-005 |
| 7 | `centerOn` returns `scale: 1` as a **literal** and never reads `graphAABB`; it centres on the *mean of node centres*, not the bounding-box midpoint. Its own docstring says "at scale 1", so the function is honest — **the button is wired to the wrong function** | `CanvasViewport.ts:122-138` | FLD-006 |
| 8 | `route.substring(0, route.indexOf('?'))` returns `''` for any route with no query string, so a `viewerpatheq` condition on a plain route can never match. Verified: `'/task-page'` → `''`. 🟢 **Fixed `4068d139`.** ⚠️ The scoping note that this therefore broke *most* conditions was **wrong** — measured, it broke exactly one of eight; see FLD-007 §4b and register rows P17–P19 | `CanvasView.ts:58` | FLD-007 |
| 9 | A filter translation failure is reported through `context.editorConnection`, **which does not exist in a deployed cloud function**; the resulting throw is swallowed and the aggregation runs with `where: {}` — a **wrong answer where there should have been a loud failure**. Same hole in Query Records | `aggregatenode.js:218-254`, `dbcollectionnode2.ts:1031` | FLD-008 |
| 10 | 🔴 **The editor cannot clobber a component file** (watch → three-hash decide → `refuse-dirty`; autosave re-reads via `findExternallyChanged`) — **but project-level files have none of it.** `componentPathFromRelativePath` returns `null` for anything not `components/<path>/{component,nodes,connections}.json`, and `saveProjectLevelFiles` compares only its own in-memory hashes and writes unconditionally | `ProjectFileWatcher/decide.ts:41-57`, `ProjectStructure/index.ts:391-417` | FLD-009 |
| 11 | 🔴 …and the MCP server **does** write `nodegx.project.json`, through three methods: design tokens, project settings, cloud service bindings | `ProjectStore.ts:164`, `:190`, `:234` | FLD-009 |
| 12 | The render settle waits are three **fixed timers** (`BOOT_MS 3500`, `REFLOW_MS 1200`, `PAGE_NAV_MS 2000`) — nothing observes the page. 10 pages × 2 viewports = **45.5 s of pure sleeping**, which brackets the reported 37.0 s | `render-report.js:1195-1207` | FLD-011 |
| 13 | `out_dir` is **90% built**: a sibling entry point already writes `${out}-${name}.png` and sets `report.viewports[name].screenshot` to the path | `measure-from-disk.js:96-105` | FLD-011 |
| 14 | ⚠️ Screenshots are captured **per viewport, not per page** — a 10-page render returns **2** images, not 20. The reported cost is right; the reason in the issue is not | `render-report.js:1585-1605` | FLD-011 |
| 15 | 🔴 The `visible` helper the whole measure file is built on tests `offsetParent` and **ignores `opacity` and `visibility`** — so `empty-decorated-box`, `elements-overflowing`, the accent count and the rhythm bands all inherit one blind spot | `nodegx-render-measure/src/index.js:124` | FLD-012 |
| 16 | 176 ledger entries (translated 124, deferred 35, backend-only 16, stubbed 1) — **counted from the JSON**, matching the issue. All 143 picker rows join. Adding `status` to every row costs **+12.9%**; the badge on only the 10 deferred costs **+10.6%** | `coverage-ledger.json` | FLD-013 |
| 17 | The "noodl-mcp cannot import @nodegx/export" premise is **false** — `editor-deps.ts` already imports another package's TypeScript by relative path and esbuild bundles it. Proved by running a spec that imports both | `noodl-mcp/src/editor-deps.ts:29` | FLD-013 |
| 18 | MCP inputs are **majority camelCase** (108 vs 20), split into two dialects by file — the issue's "every parameter is snake_case" is wrong. The sharper bug: `visual_roots` in, `visualRoots` out; `allow_unknown_types` in, `allowUnknownTypes` out | `noodl-mcp/src/tools/*.ts` | FLD-014 |
| 19 | Operation ids are assigned from the **submitted** index and the array is then **stably sorted by kind** (`provision, create, update, doc`), so an update submitted first keeps `op-1` and returns after every create | `planTools.ts:610`, `AiAssistant/authoring/plan.ts:504` | FLD-014 |
| 20 | `applyOperations` is **already exported and pure**, and `stage_plan_operation` already reads the baseline it would need — the full-graph requirement is not structural | `noodl-mcp/src/graph.ts:169`, `planTools.ts:807` | FLD-014 |
| 21 | A kit node is dispatched **before** any visual role, never reaches `visualDeferReason`, and `renderCustom` **emits wired inputs as props** — so a chart shipped as a kit exports with dynamic data **today**, while the same chart built from Group/Circle refuses | `emit/component.ts:5034`, `:5631-5649` | FLD-015 |
| 22 | `renderCircle` computes arc geometry **at generation time from literals** — the opposite of data-driven. The claim that "the emitter half exists" is false; what exists is the SVG plumbing and the maths as an algorithm | `emit/component.ts:5520-5554` | FLD-015 |
| 23 | AppImage `toolsets` is unset, so electron-builder defaults to the legacy runtime — which is what needs FUSE 2 **and** what injects `--no-sandbox` into the desktop entry. **One config line removes both** | `AppImageTarget.js:25-28`; `noodl-editor/package.json` build block | FLD-016 |
| 24 | `devtool: 'source-map'` in the production renderer config, and `build.files` has **no `!**/*.map`** — so every map ships. `optimization.minimize: false` has **exactly one commit in its history: the initial fork commit**, with no comment and no linked issue. Not deliberate | `webpack.renderer.production.js:6-11` | FLD-017 |
| 25 | Two always-on timers run with nothing open: a UDP multicast **every 2 s forever**, and a user-profile file poll **every 2 s forever** in the renderer. `backgroundThrottling` is at its default and the reporter's window was **visible**, so the fix they proposed would not have helped | `main.js:1309`, `UserProfile/install.ts:97` | FLD-017 |

## 5. Tasks

**Track A — it went wrong and said nothing.**

| id | task | issue | depends on |
|---|---|---|---|
| FLD-001 | 🟢 **BUILT 2026-09-09** — The Columns node measures itself. Observer keyed off the element; gutter subtracted. 8/8 spec, both reverted arms measured, driven in the editor (690px fires Medium Below 700, 710px does not). Unblocks FLD-002 and FLD-003 | [#21](https://github.com/The-Low-Code-Foundation/NodeGX/issues/21) | — |
| FLD-004 | **A wire into a dimension port is honoured, or refused out loud** — the `type`/`unit` typo, the `delete`, and the third state | [#26](https://github.com/The-Low-Code-Foundation/NodeGX/issues/26) | — (**R4**) |
| FLD-005 | **A column of Groups does not multiply out** — the recipes, and a diagnostic; inherits phase 81's V1/V17 | [#35](https://github.com/The-Low-Code-Foundation/NodeGX/issues/35) | — |
| FLD-006 | **Fit view fits** — bounding box and a real scale, not a literal | [#33](https://github.com/The-Low-Code-Foundation/NodeGX/issues/33) | — |
| FLD-007 | 🟢 **BUILT 2026-09-10** — A lesson step that can be completed. Both writers of the preview-route global now share `previewRoutePath`. 8/8 spec through the real evaluator, two reverted arms, three should-fail arms. Sweep: **8 conditions ship, 1 was dead** — the other 7 passed on a race or on a stray page parameter (§4b). Reply to #5 drafted (§4c). AC1 **driven** — a real click on a query-less route publishes `/create-card-page`, and the reverted arm evaluated in the same renderer reads `''` | [#5](https://github.com/The-Low-Code-Foundation/NodeGX/issues/5) | — |
| FLD-008 | **An aggregation that cannot answer says so** — the swallowed refusal, in both nodes that have it | [#14](https://github.com/The-Low-Code-Foundation/NodeGX/issues/14) | — |
| FLD-009 | 🟢 **BUILT 2026-09-10** — The editor does not overwrite what an agent wrote. A disk baseline and a re-read before every project-level write, the watcher mapping that was missing, and the reload that makes the refusal a pause rather than a wall. 15 specs, a reverted arm each for the guard and the watcher, four presence controls. **Driven in the real editor: five arms, the reverted pair on an identical payload, and the refusal toast verbatim.** 🔴 The AC1 sequence as written was **green before the work** — the loss needs an editor change to a project-level file, not a component touch (§4b) | [#41](https://github.com/The-Low-Code-Foundation/NodeGX/issues/41) | — |
| FLD-012 | **The empty-box warning stops crying wolf** — the controls, and the `opacity` blind spot under them | [#32](https://github.com/The-Low-Code-Foundation/NodeGX/issues/32) | — |

**Track B — it costs too much to install and to drive.**

| id | task | issue | depends on |
|---|---|---|---|
| FLD-002 | **The Columns node says which breakpoint it is at** — `Breakpoint`, `At Medium`, `At Small` | [#22](https://github.com/The-Low-Code-Foundation/NodeGX/issues/22) | FLD-001 |
| FLD-003 | **Advanced Columns, as a prefab** — Richard's own proposal, shipped | [#22](https://github.com/The-Low-Code-Foundation/NodeGX/issues/22) | FLD-002, FLD-004 (**R3**) |
| FLD-010 | **An agent can ask whether a human has the project open** — `session_status` over the existing relay | [#41](https://github.com/The-Low-Code-Foundation/NodeGX/issues/41) | FLD-009 (**R6**) |
| FLD-011 | **The render report writes to disk and stops sleeping** | [#40](https://github.com/The-Low-Code-Foundation/NodeGX/issues/40) | — |
| FLD-013 | **An agent learns what will not translate before it designs** — status *and* structure ports | [#37](https://github.com/The-Low-Code-Foundation/NodeGX/issues/37) | — |
| FLD-014 | **The MCP surface stops costing a round trip** — four papercuts, and the round-trip bug under them | [#43](https://github.com/The-Low-Code-Foundation/NodeGX/issues/43) | — |
| FLD-015 | **Charts that export** — as a kit, if R2 agrees | [#39](https://github.com/The-Low-Code-Foundation/NodeGX/issues/39) | **R2** |
| FLD-016 | **The Linux install works on a current distribution** — FUSE, the sandbox flag, the display abort, RPM | [#29](https://github.com/The-Low-Code-Foundation/NodeGX/issues/29) | — |
| FLD-017 | **The release stops shipping what it never runs** — maps, the Blockly edge, the two idle timers | [#42](https://github.com/The-Low-Code-Foundation/NodeGX/issues/42) | — (**R5** for minification only) |

## 6. The end condition

This phase closes when the fifteen issues are each **fixed and closed, or answered on the thread
with the measurement that changed our mind**. Not when the tasks are green — when the reporters
have been told. Two of these people have waited since 2024 and 2025.

🔴 **Every task in this phase carries a reply.** The register in
[DEFECTS-THE-FIELD-REPORT-FOUND.md](./DEFECTS-THE-FIELD-REPORT-FOUND.md) tracks what has been said
to whom, because a fix nobody was told about is a fix that gets re-reported.
