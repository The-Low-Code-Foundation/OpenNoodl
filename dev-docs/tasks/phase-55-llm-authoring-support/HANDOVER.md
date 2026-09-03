# Phase 55 — the handover prompt

Paste the block below into a fresh session. It is written to be read cold, by a model that has not
seen phase 54.

---

You are opening **Phase 55 — Any LLM can build in NodeGX**. Read
`dev-docs/tasks/phase-55-llm-authoring-support/README.md` first, then
`dev-docs/best-practices/` in full — especially `05-WORKED-EXAMPLE-STOREFRONT.md`, which is Richard's
own architecture for the app this phase is calibrated against.

**The phase's own rule applies to its documents, including this one: read the mechanism in source
before trusting any stated fact.** Phase 54 was opened on a premise that turned out to be wrong three
separate times, and each wrong premise cost real work:

1. *"The catalog does not surface conditional ports."* It does — the port descriptions carry the
   dependency and `InactiveConditionalParameter` already checks it. The memory saying otherwise was
   stale.
2. *"NodeGX has no default font, that's why AI pages render in Times."* It has one —
   `TokenResolver.generateCss` emits `body { font-family: var(--font-sans) }`. The **measuring
   harness** was reconstructing that CSS and had dropped it. A product bug was very nearly filed for
   a harness defect.
3. *"A wrapped flex grid with percentage tracks is the responsive answer."* It is not. `Columns` is
   the only node in the runtime with a breakpoint concept; a wrapped Group can never collapse. This
   was shipped as guidance in a recipe before being caught.

Assume a fourth exists.

## Start here, in this order

1. **Do the audit before proposing anything.** README §"The audit" has five questions. The
   deliverable of your first session is a written, evidence-backed answer to them — not a design.
2. **Replay the brief cold, on more than one model.** The storefront brief is the calibration. Opus
   already produced a pretty, badly-architected result; that is the baseline. What is missing is the
   same run on a mid-tier hosted model and a mid-tier **open-weight** model. Everything this phase
   builds must be evaluated against those, not against Opus — a support system that only works with
   the strongest model is a demo.
3. **Classify every failure** as knowledge / ordering / capability / seam. The distinction decides
   the fix, and conflating them is how phase 40 spent two sessions on prompt wording for a problem
   that was a missing port.

## What already exists, so you do not rebuild it

- `authoring/prompts/design.ts` — the design doctrine, wired into the planner, the authoring prompt
  and `get_project_info.designDoctrine`. ~12k chars; only the 556-char `DESIGN_AUTHORING` goes in the
  per-turn prompt.
- `authoring/prompts/decomposition.ts` — components doctrine, same three consumers.
- `docs/node-catalog/examples/ui-*.json` — six validated composition recipes, gated by
  `npm run catalog:examples` (strict, warnings-as-errors), cross-referenced from nine node types.
- `validation/rules/repeatedSiblingSubtree.ts` — three identical siblings is a warning.
- `scripts/devtools/render-from-disk.js` — renders a v2 project from disk against the working-tree
  runtime. **This is the single most valuable tool in the repo for this work**; three of phase 54's
  real defects were found by measuring a DOM and none by reading a graph.
- `NodeGX test projects/ecommerce-example` — pretty, and architecturally wrong. Both halves are data.

## Facts worth not re-deriving

- **`Static Data` ("Static Array") is the "JSON in the repeater" primitive.** Inline JSON authored in
  the editor, emitted as an array of objects. It is the piece nobody finds, and half of Richard's
  architecture depends on it.
- **`net.noodl.visual.columns` is the ONLY node with a breakpoint concept.** No responsive node
  exists. Breakpoints are container width, not viewport. It handles a Repeater child by design
  (`partitionColumnChildren`), pinned by 35 corpus specs.
- **Visual states are asymmetric.** Button has hover/pressed/focused/disabled; Group, Text and Image
  have hover only. This is why a `States` node is needed whenever one interaction must change two
  nodes together with a shared transition.
- **`fontSize` has no responsive form.** Type does not scale, at all.
- **A wrapped flex row does not shrink its children; an unwrapped one does.** This is why a plain row
  appears to work and a wrapped grid does not.
- **The MCP server's backend dies with the server process**, so a one-shot tool call provisions a
  database and then reaps it. Drive a persistent session if you need a backend to stay up.
- **`provision_backend` can never reuse a backend for a v2 project** — the ownership check reads
  `nodegx.project.json → id`, and nothing writes one (phase 54 register F2, still open). Every
  restart orphans the data and makes a new backend.
- **The editor holds the project in memory** and pushes that to its preview. An MCP write reaches
  disk and is invisible to a running editor. Do not restart the editor to "pick up" MCP work; ask
  for the project to be reopened, and do not write while a human has it open.
- 🔴 **CORRECTED 2026-09-03 — the old wording of this bullet was WRONG, and it was relayed four times.**
  It said *"quitting the editor can flush its stale copy back over your work."* **A quit does not do
  that.** Driven in
  [REL-009 §2.1](../phase-82-0.2.2-the-first-row-on-the-shelf/REL-009-THE-WRITE-THE-EDITOR-CANNOT-SEE.md):
  on a v2 project the save is incremental and hash-baselined, so a real `app.quit()` with no pending
  human edit wrote **nothing at all** — 21/21 files byte-identical — and a component the human never
  touched is never in the change set. An MCP-**added** component survives, registry entry included.
  **The real exposure is narrower and it is about the COMPONENT, not the quit:** if the human edits
  *the same component* an agent wrote, the editor writes its whole in-memory copy over the file and
  the agent's change is gone — no conflict, no prompt, no diagnostic. The worst shape of it is a page
  the agent added being silently dropped from the router while its files and registry entry stay,
  so nothing on any surface looks wrong. ✅ **The practical rule is unchanged and the reason is now
  right: do not have both sides editing the same component. `render_report` is read-only and safe at
  any time, and an MCP write is still invisible to a running editor until the project is reopened.**

## The gates

`npm run catalog:examples`, `catalog:check`, `catalog:merge:check`, `typecheck:editor`, and
`npx jest` in `packages/noodl-editor` (71 suites / 973 specs at phase-54 close). ⚠️ **`pr.yml` runs on
push to `cline-dev` and `Lint` and `Test (editor)` are currently RED** — phase 54 fixed the
`Node catalog freshness` job and deliberately did not touch the other two. Do not read a red run as
"my change broke it" without checking which job.

## The bar

Richard's, unchanged since phase 40: *"legendary creations rivaling the best Opus landing page
artifacts."* Phase 55 adds the harder half — **the same architecture from a model that is not Opus.**
If a weak model produces a well-architected app with mediocre spacing, this phase succeeded. If a
strong model produces a beautiful 66-node page, it did not.
