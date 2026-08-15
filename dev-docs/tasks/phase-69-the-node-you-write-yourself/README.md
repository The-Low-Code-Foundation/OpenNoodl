# Phase 69 — The Node You Write Yourself

**Created:** 2026-08-15, out of a live capability proof (see §1). **Prefix:** `CN`.
**Surfaces:** `runtime`, `editor`, `mcp`, `catalog`, `library`, `docs`.

> **The concept, in one sentence.** A NodeGX node is not a thing only NodeGX can make — anyone
> can write one, in one file, with no toolchain, and it is indistinguishable from a built-in
> everywhere it matters.

This phase is not "document a trick". It is the promotion of **custom nodes to a core concept**,
which means every system that currently assumes "a node type is something we shipped" has to stop
assuming it. That assumption is load-bearing in more places than anyone expected, and §3 is the
list.

---

## 1. What was measured (2026-08-15), and what it cost

Everything below was **built and driven**, not read from source. The proof project is
`NodeGX test projects/cashflow-command-centre`; the kit is `noodl_modules/cashflow-kit/`.

| Claim | Evidence |
|---|---|
| A custom visual node needs **no SDK, no bundler, no npm, no build step** | One hand-written `index.js` + a 2-line `manifest.json` registered 5 nodes |
| Hooks work | `useState`/`useLayoutEffect`/`ResizeObserver` all live in the kit; drag depends on them |
| It works on **both** runtimes | Byte-identical module on React 18.3.1 (default) and `runtimeVersion: 'react19'`; same drive, same result |
| The editor treats it as a real node | Node library reports all 5 as `category: "Visual"` with full port sets (Lane 9/11, Pill 23/14, Strip 16/10, Axis 12/8, Banner 19/9) |
| It composes with stock nodes | custom Pill → stock `Set Object Properties` → stock `Array Changed` → stock `Function` → custom Strip + Banner |
| Repeater-scoped writes are correct | Dragging one row moved exactly that record (`MOVED: ["Utilities"]`, 15→18) |
| It inherits built-in behaviour free | `Width`/`Height`/`screenPosition` outputs, `allowChildren` default true, **style variants**, `Did Mount` |

**Why it works, and why it nearly didn't.** The runtime delivers React as a browser global and maps
`react` to it through webpack `externals` — the contract every external module compiles against.
React 19 dropped UMD builds upstream, which would have ended that contract. `RUN-001`
(`1c6790cb`, 24 Jul) builds the globals from npm with esbuild instead, aliasing `react-dom`'s own
`require('react')` at the single global, so the one-dispatcher guarantee is enforced at build time.
The deployed filenames are identical across runtimes, so **a kit written once runs on both with
nothing to recompile**.

**What is *not* new:** `Noodl.defineModule({ reactNodes })` is inherited from Noodl and always
worked. What was broken was the only *documented* route to it — the SDK-plus-webpack path that
bundled a second React and produced `Invalid hook call`. This phase is about making the working
route real, supported and visible; it is not a claim that we invented the mechanism.

---

## 2. The two principles

Every task in this phase is measured against these. They are acceptance criteria, not sentiment.

**P1 — A custom node is a node: no *capability* difference.** Not a plugin, not an escape hatch, not
a second-class citizen with a warning triangle. Wherever the product knows something about `Group`,
it should know the same kind of thing about `mykit.Chip`: validation, the picker, the property
panel, the AI's vocabulary, docs, the catalog, deploy. Any place that special-cases "is this ours?"
to *withhold a capability* is a bug this phase either fixes or explicitly and permanently exempts
*in writing*.

> **Narrowed by ruling D1 (2026-08-15).** Provenance *display* is explicitly allowed and wanted — a
> node saying it came from *Cashflow Kit v1.2* is a feature, because when a node misbehaves you need
> to know who wrote it. P1 forbids capability gaps, not attribution.

**P2 — Ports are the product; JavaScript is the escape hatch.** A kit that buries thresholds,
colours, steps and formats in its source is a worse kit however good the source is. Policy belongs
in the graph (a `Function`/`Expression` node the user can open); presentation belongs on ports.
Every task that produces authoring guidance, a scaffold, a doc or an AI prompt must teach this, and
the reference kit must model it.

---

## 3. The load-bearing assumption, and everywhere it hides

**`node-catalog.json` is generated from the live register of built-ins only**
(`scripts/node-catalog/extractor-entry.js` loads `noodl-runtime` + `noodl-viewer-react` +
`noodl-viewer-cloud` and serialises what registers). A project's own module nodes are not in it and
cannot be — the catalog is built at repo-build time, the modules exist per project.

That single fact propagates:

- **Validation goes quiet, not loud.** `unknown-node-type` is a **warning by default**, and the
  comment in `diagnostics.ts` says exactly why: *"real projects legitimately use module-provided or
  version-specific nodes the catalog cannot enumerate; erroring on those would cry wolf."* The
  policy is right. The consequence is that **everything downstream is skipped**:
  `parameterValues.ts` skips unknown-typed nodes entirely, and unknown-port checks are skipped for
  dynamic-port nodes. So a custom node is *accepted but unverified* — a silent hole, exactly the
  shape this repo has been burned by before.
- **Strict mode hard-fails.** `validate_component`'s `strict` flag ("greenfield mode") promotes
  unknown node types to errors. A greenfield project that uses a kit **cannot pass its own gate**.
- 🔴 **A lesson cannot teach a kit node** (found 2026-08-15 reconciling with phase 67, which neither
  phase had recorded). `lessonverify.ts` is a **fifth catalog consumer**, and it is the strictest one:
  `unknown-node-type` is `severity: 'error'` there
  ([`lessonverify.ts:214`](../../../packages/noodl-editor/src/editor/src/models/lessonverify.ts)), not
  the warning `diagnostics.ts` uses. That error is failure class **F1**, and `REQUIRED_CLASSES` in
  `lessoninstallpolicy.ts` demands F1 of **every** provenance — `curated`, `org`, `local` and
  `local-ai` alike. So a lesson whose condition names `nodegx.cashflow.Pill` is **refused at install**,
  by every route, with a message telling the author their own node type does not exist. See §4.
- **Visual-root detection guesses.** `visualRoots.ts` falls back to `componentIsVisual(typeName)`
  when `catalogIndex().hasType()` is false — so a custom *visual* node is classified by a heuristic
  meant for project components, which affects page authoring.
- **The AI cannot see them.** `list_node_types` / `get_node_type` / `find_tools` are catalog-backed.
  The built-in authoring loop has a `libraryOverview()` handout (ERG-002) for UMD libraries but
  nothing for a project's own node types.
- **The agent's eyes are blind.** `render-from-disk.js:351-357` hand-writes its HTML with **two
  hardcoded module stylesheets** and never calls `injectIntoHtml`. A project using a custom node
  renders as an **empty box** through `render_report` — a blank, not an error. Every other HTML path
  (preview web-server, deploy `HtmlProcessor`, `noodl-preview`, `ViewerConnection`) injects
  correctly. The verification tool is the only blind one.

**The keystone is therefore a project-scoped catalog extension** (CN-003). The good news is that the
technique already exists and is proven: the catalog extractor works by loading the **live register**
rather than parsing sources, and a project's `index.js` registers into that same register. The
architecture is not new — its input set is.

---

## 4. Prior-art reconciliation

> 🔴 **Read this before starting any task.** Two phases already own pieces of this ground.

- **P65 / LBR-008 "The library the AI can see"** already scopes *"0 module node types in the
  catalog. Give `list_node_types`/`find_tools` the library"*, and already carries the token-budget
  constraint. **CN-003/CN-009 overlap it directly.** Needs ruling **D7**: does phase 69 absorb
  LBR-008, depend on it, or supersede it? They must not be built twice — see
  [[parallel-agents-solve-it-twice]].
- **P65 / LBR-004** records that **0 of 29 shipped modules have ever been run**, either preview or
  deploy. Any claim this phase makes about "modules work" is currently proven by *one* kit — mine.
  CN-016 must not assume the existing fleet is healthy.
- **P65 / LBR-006** found three shipped "modules" that register **zero nodes**, and `type` drives
  install routing. The taxonomy is already known to be wrong.
- **P35 / ERG-002** built `registerLibrary` / `verifyLibrarySource` / `libraryNeedsSsrWarning` and a
  **Libraries** settings section — for third-party UMD globals, not for node kits. It is the closest
  existing surface and the obvious thing to extend rather than duplicate. `verifyLibrarySource`'s
  sandbox-and-check pattern is directly reusable for CN-017.
- **RUN-001** (phase 16) is the reason any of this works; its assessment doc is the authority on the
  `window.React` contract. Do not re-derive it.
- 🔴 **P67 / UNI-007 + UNI-010 — added 2026-08-15, and it was missing in both directions.** Neither
  phase referenced the other; a grep for `phase-69|CN-0|custom node|kit` across phase 67 and for
  `phase-67|UNI-0|lesson` across phase 69 returned **zero hits each way**, while the two share three
  live surfaces:
  - **`lessonverify.ts` is a catalog consumer** — §3's new bullet. CN-003 must overlay it and CN-004
    must reason about it; today a lesson teaching a kit node is refused at install.
  - **The MCP token budget is P67's spend.** UNI-010's `lesson` group consumed 56 of LEG-001's 58
    banked tokens and renegotiated the bar 8,200 → **8,280**. CN-009's numbers were written against
    the old bar and have been corrected.
  - **CN-001 fixes the instrument UNI-010's F4 grades with.** `measure-from-disk.js` →
    `render-report.js:41` → `render-from-disk.js` is the chain behind `NODEGX_RENDER_CLI`. CN-001
    carries the ordering consequence.

  ⚠️ Phase 67's own `TASKS.md` and `NEXT-SESSION-PROMPT.md` now carry the mirror of this entry. If you
  change one of the three surfaces, change both sides — this reconciliation exists because a hole
  recorded in one phase reads as covered from the other.

---

## 5. Rulings — ✅ **all 8 ruled (2026-08-15); the queue is empty**

> The register is **[RULINGS.md](RULINGS.md)**, which carries the reasoning and the binding
> obligations. This table is the index.

| # | Question | Status |
|---|---|---|
| **D1** | First-class concept, or folder convention? | ✅ **First-class, with provenance shown.** P1 narrowed to *no capability difference*; provenance display is explicitly wanted. ⚠️ Does **not** gate CN-003 |
| **D2** | **JS-only** authoring, or a supported **TypeScript** path? | ✅ **JS is the supported path**, plus a published `.d.ts` reachable from JSDoc with **zero build**. A compile step on the author's side breaks this ruling |
| **D3** | Where does the catalog overlay run, and is it cached? | ✅ **MCP extracts (headless, via the existing dom-shim); the editor reuses `sendNodeLibrary`.** 🔴 **No on-disk cache** — in-memory per session if speed demands it |
| **D4** | Strict-mode policy once custom types are knowable | ✅ **Kit-declared ⇒ known and fully checked.** Only the truly unresolvable errors under `--strict`. Expect it to surface real kit bugs |
| **D5** | A first-party reference kit — and is it the cashflow kit? | ⚠️ **A new, smaller kit** (ruled against the recommendation). **Required mitigation: CN-007's docs must still carry the cashflow kit as the worked example**, or P2 loses its only demonstration |
| **D6** | **Trust posture** for third-party kits | ✅ **Local kits run freely; third-party verified on install** (reuse `verifyLibrarySource`), provenance recorded, **explicit consent** to run non-first-party |
| **D7** | Relationship to **P65 LBR-008** | ✅ **P69 owns the spine.** CN-003 = "this project", exact. LBR-008 = "the shelf", cheap, layered on top. P65's row updated |
| **D8** | Do kits declare **design tokens** and participate in variants? | ✅ **Tokens by default in the scaffold, not enforced.** AIB-001's `var(--token)` passthrough already exists. ⚠️ The cashflow kit hardcodes hex today and must be moved onto tokens before CN-007 uses it |

---

## 6. What "extended and flexible" means here

The definition surface is far richer than the minimum viable node suggests, and almost none of it is
documented for module authors. `ReactNodeDefinition` already supports `dynamicports`, `visualStates`,
`useVariants`, `methods`, `setup`, `getInspectInfo`, `nodeDoubleClickAction`, `connectionPanel`,
`ssr` and `deprecated` — plus a `frame` field that nothing in the repo sets and DEBT-006 deliberately
retained *because a third-party module could legitimately use it*. That decision already treated
external node authors as real users. This phase finishes the thought.

Flexibility axes the tasks must keep open:

1. **Visual and logic.** `module.nodes` (via `defineNode`) is the non-visual half and is untested here.
2. **Browser and cloud.** The manifest's `runtimes` filter and the `ssr` compat field exist; a kit on
   an SSR/SSG deploy is unproven.
3. **Static and dynamic ports.** A node whose ports come from data is the difference between a widget
   and a building block.
4. **Local and distributed.** The same kit should work as a folder in one project and as a library
   entry installed into fifty.
5. **Hand-written and generated.** Claude Code writing a kit is a first-class use, not an afterthought
   — which is what CN-006/CN-008/CN-009 are for.

---

## 7. Definition of done for the phase

- A person, or an agent, can go from "I want a node that does X" to a working node **without reading
  runtime source**.
- A project using custom nodes **passes its own validation** and does not render blank in any
  verification tool.
- The AI authoring loop **uses** a project's custom nodes rather than ignoring them.
- A kit can be **published, installed, versioned and trusted** through the existing library channel.
- The reference kit teaches **P2** by example.

See [TASKS.md](TASKS.md).
