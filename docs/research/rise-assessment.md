# Rise — salvage assessment for the OpenNoodl / MCP work

**Date:** 2026-07-30
**Assessed repo:** `/Users/richardosborne/vscode_projects/rise` @ `8b15983` (last commit 2025-12-02)
**Method:** read-only. Docs first, then source. No builds, no installs, no test runs.
**Overall confidence: 8/10.** High on what the code *is* (I read it). Lower on runtime behaviour — `node_modules` is absent, so I could not execute the 483 test cases and cannot confirm they pass. Every "works" claim below is inferred from source and git history, never from a running app; those are marked inline.

---

## Summary

**The single most useful finding: the thing Rise is famous for in its own docs — the schema and its validator — is the part you should not take, because OpenNoodl already has a better version of it.** `packages/noodl-editor/src/editor/src/validation/` (SUB-006) independently arrived at the same design as Rise's `SchemaValidator` — data-not-strings diagnostics, stable machine codes, actionable suggestions, warning-not-error for unknown types — but graph-native, catalog-driven, and actually wired into CLI, MCP and the editor. Rise's validator is wired into nothing: it is commented out of the only code path that would call it ([manifest-handlers.ts:242](../../../rise/electron/manifest-handlers.ts#L242)).

What *is* worth taking is smaller and less glamorous: one genuinely excellent utility class (`FileChangeTracker`), a code-marker convention for an eject path, and a prompt-construction pattern. Roughly 600 lines of a 11,000-line core, plus one idea.

Rise's docs describe a far larger system than exists. Treat the `docs/` folder as a pitch deck, not a specification. Ground truth lives in `src/core/*/types.ts` and the git log.

---

## What actually exists in Rise

### Built and load-bearing

| Area | Evidence | Verdict |
|---|---|---|
| Manifest type model (Level 1 / 1.5) | [src/core/manifest/types.ts](../../../rise/src/core/manifest/types.ts) — 501 lines, complete, coherent | Real |
| Logic IR types | [src/core/logic/types.ts](../../../rise/src/core/logic/types.ts) — 857 lines, discriminated unions + type guards | Real |
| React codegen pipeline | [src/core/codegen/](../../../rise/src/core/codegen/) — 6 builders, 2,900 lines, Prettier integration | Real, narrow |
| Flow → handler codegen | [FlowCodeGenerator.ts](../../../rise/src/core/codegen/FlowCodeGenerator.ts) — topological sort, 512 lines | Real |
| File writing + incremental regen | [FileManager.ts](../../../rise/src/core/filemanager/FileManager.ts) (951), [ChangeDetector.ts](../../../rise/src/core/filemanager/ChangeDetector.ts) (520) | Real |
| Hash-based edit attribution | [FileChangeTracker.ts](../../../rise/src/core/FileChangeTracker.ts) — 525 lines, 50 tests | Real, excellent |
| React Flow logic canvas | [src/renderer/components/LogicEditor/](../../../rise/src/renderer/components/LogicEditor/) — 2,392 lines, 4 node types registered at [LogicCanvas.tsx:98](../../../rise/src/renderer/components/LogicEditor/LogicCanvas.tsx#L98) | Real |
| API key storage (keytar) | [APIKeyManager.ts](../../../rise/src/core/security/APIKeyManager.ts) | Real |
| AI component generation | [AIComponentGenerator.ts](../../../rise/src/main/ai/AIComponentGenerator.ts), [promptTemplates.ts](../../../rise/src/main/ai/promptTemplates.ts) | Real |

### Built but dead — not reachable from the running app

This is the important column and the docs never mention it.

- **The entire `src/core/validation/` package (2,650 lines) is orphaned.** `SchemaValidator` is imported by exactly one file outside its own directory: its test. The only production caller has it commented out with `// TODO: Fix module resolution` ([manifest-handlers.ts:70](../../../rise/electron/manifest-handlers.ts#L70)), and both the load and save paths log `(validation disabled)` ([:247](../../../rise/electron/manifest-handlers.ts#L247), [:315](../../../rise/electron/manifest-handlers.ts#L315)). Rise ships with **no schema validation at runtime at all**.
- **`Level15SchemaValidator` (793 lines) has no callers and no tests.** It is the validator for the schema level Rise actually shipped, and nothing has ever exercised it. `CircularReferenceDetector` (349 lines) is reachable only via the orphaned `SchemaValidator`.

### Specified but never built

- **Bidirectional sync** — [docs/BIDIRECTIONAL_SYNC.md](../../../rise/docs/BIDIRECTIONAL_SYNC.md) is thorough and entirely aspirational; its own header says "Stretch goal for post-MVP". No reverse parser exists; grep finds only comment mentions.
- **Plugin system** — [docs/PLUGIN_SYSTEM.md](../../../rise/docs/PLUGIN_SYSTEM.md) describes a framework-adapter interface. In code, `plugins` is a hardcoded literal type `'@rise/plugin-react'` ([manifest/types.ts:94](../../../rise/src/core/manifest/types.ts#L94)). There is no adapter, no interface, no seam.
- **Levels 2 and 3** — expressions, sandboxing, computed props, data connections, routing, debugger, hosted backend. All documented at length, none implemented.

### Documentation integrity — poor

Judge the docs harshly; they will mislead you:

- **[docs/COMPONENT_SCHEMA.md](../../../rise/docs/COMPONENT_SCHEMA.md) is not a schema specification.** It is a memo *proposing edits to* a schema doc, complete with a checklist and "Status: 🔴 Pending Implementation". The README links to it as "Complete JSON manifest specification". The actual schema is only expressible from the TypeScript types.
- **README and RISE_PROJECT_OVERVIEW contradict each other.** README: "Phase 3 In Progress, ~95%". Overview: "Level 1.5 Complete, Phase 4 95%". Both dated within days of each other.
- Docs claim "Test Coverage: 90%+ target" and a jest `coverageThreshold` of 90 is configured — but the project runs Vitest, and the jest block in `package.json` is vestigial. **Unverified** whether coverage was ever met.

### A real defect in the shipped IR

The event→flow binding is stored **twice, in two places, with no single source of truth**:

- `components.<id>.events.onClick.flowId`
- `flows.<flowId>.trigger.componentId`

Both appear in [tests/fixtures/manifests/valid/level-15-with-logic.json](../../../rise/tests/fixtures/manifests/valid/level-15-with-logic.json). The codegen reads only the second and says so explicitly: *"NOTE: The relationship is stored in flow.trigger.componentId, NOT in component.events"* ([ReactCodeGenerator.ts:172](../../../rise/src/core/codegen/ReactCodeGenerator.ts#L172)). The validator, meanwhile, warns when the *first* disagrees ([Level15SchemaValidator.ts:753](../../../rise/src/core/validation/Level15SchemaValidator.ts#L753)). Two components disagree about which field is canonical. The git log shows the cost: `c72807d "Fixed logic not hooking up to components"`, `c333154 "Fixed bug with multiple logic triggers for multiple elements"`.

This matters for your question 2: it is direct evidence that Rise's schema was **not** rigorously maintained as an IR.

---

## Schema quality — Rise vs Noodl (question 2)

Rise's manifest is a **component tree with a bolted-on flow sidecar**. Noodl's `project.json` is a **node graph**. They are not the same kind of object, and the comparison mostly favours Noodl for your purposes.

Where **Rise is genuinely better**:

1. **Typed property wrappers.** `{ type: 'static', value: 'Click me', dataType: 'string' }` carries its own kind and type. Noodl's `parameters` is an untyped bag whose keys encode meaning by string convention — from the toggle-switch prefab: `"value-true-pos": 100`, `"type-bg color": "color"`, `"transitiondef-on": {...}`. An LLM must learn those prefix conventions; Rise's form is self-describing. **This is the one real schema lesson.**
2. **Readable, stable ids.** `comp_button_001` vs Noodl's `8ff029ae-b91f-d219-65c4-aa5487f3f1bd`. Cheaper in tokens, and a model can refer to a node without copying a UUID correctly.
3. **Declared capability level.** `level: 1.5` on the manifest states what subset of the language this document uses.

Where **Noodl is better**:

1. **Connections are first-class.** `{fromId, fromProperty, toId, toProperty}` at graph level is a clean edge list. Rise's children-as-id-array plus a separate flows map cannot express dataflow at all — only containment and click handlers.
2. **It describes a real runtime.** Noodl's schema is executable; Rise's is a codegen input for a React subset.
3. **`dynamicports` acknowledges that some nodes define their ports at runtime** — a hard problem Rise never had to face, and which your validator already handles deliberately (`DynamicPortSkipped`).
4. **It survived contact with reality.** Noodl's format carries years of real projects. Rise's carries a demo.

**Net:** Rise's schema is *tidier* but *thinner*. It is a good IR for "a static React component tree", which is not the problem you have. Do not port it. Do consider stealing idea (1).

---

## Harvest candidates — ranked

### 1. `FileChangeTracker` — hash-based tool-vs-user edit attribution — **confidence 9/10**

**What it is:** 525 lines ([src/core/FileChangeTracker.ts](../../../rise/src/core/FileChangeTracker.ts)) solving one problem completely: when a tool writes a file and a watcher is listening, how do you tell your own write apart from a human's? SHA-256 of intended content stored before write; per-file pause during write; 100 ms filesystem settle; **5-second auto-resume watchdog so a crashed generator cannot permanently deafen the watcher**; fail-safe to "assume user edit" on any error. Ten enumerated edge cases, 50 tests.

**Why it helps:** OpenNoodl has no file watching at all (`grep` for chokidar/`fs.watch` across `noodl-editor/src` and `noodl-mcp/src`: zero hits) and no edit attribution. But you demonstrably have the *problem class* — the autosave allowlist work (F46), spurious project writes, and the editor rewriting `project-examples/agent-chat/project.json` on launch are all "who wrote this file and should we react to it" questions. If the MCP server ever writes `project.json` while the editor is open, you need exactly this.

**Effort:** Low. Zero Rise coupling — imports only `node:crypto` and its own types file. Lift the class, keep the tests, delete the `FileChangeTypes.ts` indirection if you like. Half a day.

**Risks:** It is a *component* with no *socket* — you would be adopting the answer before you have built the watcher that asks the question. Do not port it speculatively; port it the day you add a watcher. The 100 ms settle constant is tuned for network drives and is probably too conservative locally.

### 2. `@lowcode` comment markers + `parseCommentHeader` — **confidence 8/10**

**What it is:** Generated files carry a JSDoc header with `@lowcode:generated`, `@lowcode:component-id`, `@lowcode:level`, `@lowcode:last-generated`, plus a matching parser ([CommentHeaderBuilder.ts](../../../rise/src/core/codegen/CommentHeaderBuilder.ts), ~175 lines).

**Why it helps:** If you ever build a Noodl → React eject path, this is the cheapest possible identity link from an emitted file back to the node/component that produced it — the thing that makes regeneration safe and makes "is this file stale?" answerable without a database. It is the only part of Rise's bidirectional-sync ambition that actually got built, and it is the part that carries the load.

**Effort:** Trivial — it is a convention plus a regex. An hour to adapt.

**Risks:** The marker set is a design decision to make deliberately, not to inherit. Note Rise's own bug: `CommentHeaderBuilder` hardcodes `LEVEL: 1` ([:90](../../../rise/src/core/codegen/CommentHeaderBuilder.ts#L90)) even when generating from a Level 1.5 manifest — the freshness marker lies. If you adopt this, make the level/version field come from the source document, not a literal.

### 3. Prompt architecture: pattern-detect → inject exemplar → state negative constraints — **confidence 7/10 — FLAGGED**

**What it is:** [promptTemplates.ts](../../../rise/src/main/ai/promptTemplates.ts) (546 lines). Keyword-match the user's request to one of nine UI patterns ([`detectRequestedType`](../../../rise/src/main/ai/promptTemplates.ts#L369)), splice in a concrete structural exemplar for that pattern, and pair it with an explicit ❌/✅ list of what the current schema level forbids.

**Why it helps:** This is the shape your LLM-readable node library guide probably wants — not one giant document, but *retrieve the relevant exemplar and state the prohibitions inline*. The negative-constraint block ("NO type: expression — only static or prop") is doing real work: it enforces the schema level in the prompt, which is the only enforcement Rise has, given the validator is switched off.

**Effort:** Low to port the pattern; the content is worthless to you (it is Tailwind/React specific). Call it a day to prototype against the node catalog.

**Risks and why this is flagged:** I cannot verify it works. There is no test, no eval, no recorded output quality — and per your memory the Anthropic key is out of credit, so I could not have run it anyway. Keyword matching is brittle (`"contact"` routes to `form`, so "a card showing contact details" gets a form exemplar). Treat this as a **hypothesis worth testing**, not a proven technique. It also overlaps heavily with work you have already done in AIX-002/AIX-011; check there first.

### 4. `ChangeDetector` — component-level incremental regeneration — **confidence 7/10 — FLAGGED**

**What it is:** Hashes each component definition, **deliberately excluding volatile `metadata.updatedAt`**, to compute added/modified/removed sets plus an `appNeedsUpdate` flag when a root changes ([ChangeDetector.ts](../../../rise/src/core/filemanager/ChangeDetector.ts), 520 lines).

**Why it helps:** The one transferable insight is a single line of policy — *exclude volatile fields from the identity hash* — which is exactly the class of bug behind spurious-write problems like F46. Worth reading for the idea.

**Effort/risk:** The code itself is coupled to Rise's `Record<string, Component>` shape and is not worth porting; a Noodl equivalent would hash nodes and connections. **Flagged because the value here is one paragraph of thinking, not a module** — I would not open a task for it. Read it, write the rule down, move on.

### 5. Schema *levels* as a capability profile for LLM output — **confidence 6/10 — FLAGGED**

**What it is:** Rise gates features by declared level (1 / 1.5 / 2 / 3), with rules tables per level ([ValidationRules.ts](../../../rise/src/core/validation/ValidationRules.ts)) and an explicit `blockedFeatures` list carrying "available in Level 2" messaging.

**Why it might help:** Reframed away from Rise's meaning (roadmap phases), the useful idea is: *declare which subset of the node vocabulary a generated graph is allowed to use, and reject the rest with a message naming the alternative.* That could be a useful lever for constraining LLM output to nodes you have good catalog coverage for.

**Effort:** Not a port — a design idea. Days, if you decide you want it.

**Risks and why this is flagged low:** In Rise this mechanism **failed on its own terms**. The level ladder became a scope-management fiction: the docs are littered with "Weeks 13-24" promises that never arrived, and the validator enforcing the levels was switched off rather than fixed. There is also a design smell baked in — `SchemaValidator` hard-rejects any manifest where `level !== 1`, forcing `Level15SchemaValidator` to lie to it (`{...manifest, level: 1}` at [:101](../../../rise/src/core/validation/Level15SchemaValidator.ts#L101)) to reuse the base checks. Inheritance by falsification. **I would not adopt this without a concrete reason; I flag it mainly so you can consciously reject it.**

---

## Do not harvest

**`SchemaValidator` / `Level15SchemaValidator` / the whole validation package.** This is the direct answer to your question 3: **no, it is not reusable as your correctness gate, because you already have a better one.** Compare honestly —

| | Rise `SchemaValidator` | OpenNoodl `SemanticValidator` (SUB-006) |
|---|---|---|
| Diagnostics as structured data | ✅ | ✅ |
| Stable machine codes | ✅ `ERROR_CODES` | ✅ `DiagnosticCode` enum |
| Actionable suggestions | ✅ | ✅ + valid alternatives listed |
| Unknown types → warning not error | ❌ (hard-rejects) | ✅ deliberate, documented |
| Runtime-dynamic ports handled | n/a | ✅ `DynamicPortSkipped` |
| Graph-native (connections, refs) | ❌ tree only | ✅ |
| Source-agnostic normalized model | ❌ | ✅ [model.ts](../../packages/noodl-editor/src/editor/src/validation/model.ts) |
| **Actually wired into anything** | **❌ commented out** | ✅ CLI + MCP + panel |

Your `diagnostics.ts` header already articulates the design principle better than Rise's code does: *"a diagnostic must be actionable by an AI with no other context"*. There is nothing to import. Rise's validator is worth thirty minutes as a sanity check that you reached the same conclusions independently — that is all.

**The React codegen (`JSXBuilder`, `PropsBuilder`, `ImportBuilder`, `CodeAssembler`).** Question 4: too coupled to be useful. It is a template-string emitter over Rise's specific component tree, where `component.type` *is* an HTML tag name and styling *is* a Tailwind class array ([JSXBuilder.ts:162](../../../rise/src/core/codegen/JSXBuilder.ts#L162), [:302](../../../rise/src/core/codegen/JSXBuilder.ts#L302)). A Noodl eject path starts from nodes with typed ports and a connection graph — structurally a different problem, closer to dataflow-to-hooks than tree-to-JSX. The only transferable pieces are the pipeline decomposition (imports/props/JSX/header/assemble, then Prettier last) and the marker convention already listed as candidate 2. Note it also carries unfinished edges: label wrapping is stubbed out and deferred ([:200](../../../rise/src/core/codegen/JSXBuilder.ts#L200)).

**The manifest schema as an IR.** See question 2 above. Tidier than Noodl's, but tree-shaped, cannot express dataflow, and demonstrably not maintained rigorously (the dual-encoded event binding).

**`APIKeyManager` / the security package.** You already have `SecretsStore` (`packages/nodegx-backend/src/config/SecretsStore.ts`) and a provider-agnostic AI client from AIX-001. Rise's keytar approach is sound but solves a problem you have solved, and `keytar` is an unmaintained native dependency you do not want in the tree.

**`docs/` wholesale.** BIDIRECTIONAL_SYNC, PLUGIN_SYSTEM, SCHEMA_LEVELS, EXPRESSION_SYSTEM, DEBUGGER_DESIGN, HOSTED_BACKEND describe unbuilt systems in confident present tense. RISE_PITCH_DECK and RISE_PROJECT_OVERVIEW are investor documents with a market-gap table scoring Rise ✅ on six axes. Importing any of this reintroduces the "documented ≠ built" gap that your REV-006 truth pass spent effort eliminating.

**The Level 1.5 logic model itself** (onClick-only, 4 node types, static values only, no chaining). It is a deliberately crippled demo. Your workflow canvas (WFA-004/005) and step-DAG engine already exceed it in every dimension.

---

## Open questions for you

1. **Is an "eject to React" path actually on the roadmap?** Harvest candidate 2 (`@lowcode` markers) is only worth anything if it is. If eject is not a real ambition, candidates 2 and 4 both drop off and the harvest reduces to `FileChangeTracker` plus one prompt idea.

2. **Does the MCP server write `project.json` while the editor may be open?** This decides whether `FileChangeTracker` is the top candidate or a solution in search of a problem. I could not determine the write topology from the assessment scope, and it changes the ranking materially.

3. **The typed-property-wrapper idea (`{type, value, dataType}`) — is Noodl's `parameters` bag actually hurting you in practice?** I can see the theoretical case for LLM legibility, but you have live evidence from the node catalog and MCP work that I do not. If models already handle the `value-true-pos` convention fine, the one genuine schema lesson from Rise evaporates and my answer to question 2 becomes "take nothing".

4. **Do you want me to verify the test suite?** It would need `npm install` in Rise, which your constraints forbade. 483 test cases exist across 16 files; whether they pass is currently unknown, and it is the main gap in my confidence rating. Say the word and I will run it in a scratch copy rather than in place.

5. **Was Rise's `.implementation/` per-task logging convention** (confidence ratings, human-review gate at <8, lessons-learned sections — [.implementation/README.md](../../../rise/.implementation/README.md)) **something you found valuable at the time?** It closely resembles what `dev-docs/tasks/` already does, so I have not listed it as a candidate — but you have the retrospective view on whether it earned its keep, and I do not.
