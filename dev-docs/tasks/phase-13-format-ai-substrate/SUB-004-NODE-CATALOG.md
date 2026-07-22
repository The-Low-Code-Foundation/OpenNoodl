# SUB-004: The Node Catalog

## Metadata

| Field | Value |
|-------|-------|
| **ID** | SUB-004 |
| **Phase** | Phase 13 — Format & AI Substrate (Revival Track A) |
| **Priority** | 🔴 Critical (keystone) |
| **Difficulty** | 🟡 Medium to build, 🔴 Hard to get *right* |
| **Estimated Time** | 1–2 weeks |
| **Prerequisites** | None technically; most valuable alongside SUB-001 |
| **Branch** | `task/sub-004-node-catalog` |
| **Recommended executor** | 🔵 **Fable 5** — the extraction is easy; the design is not. This artifact becomes the vocabulary every AI, validator, and code generator depends on, and its shape is hard to change later. Getting the schema, granularity, and semantics right is the deliverable — the code is incidental. |

## Objective

Generate a machine-readable catalog of every node type in OpenNoodl — its ports, parameters, types, and semantics — from the runtime's own registry, and publish it as both an in-repo artifact and a build output.

## Background

The v2 project format describes *structure* precisely and *meaning* not at all. A node has a `type` that is a free string. Its `parameters` are an open key-value bag. Connections name a `fromProperty` and a `toProperty` with no declared relationship to anything. The JSON schemas set `additionalProperties: true` by design, and component-level port declarations are usually absent.

The practical consequence is the finding that reframed the whole revival plan: **an AI given a v2 project and its schemas can produce perfectly schema-valid JSON that is complete nonsense** — nodes of types that do not exist, connections wired to ports that were never defined, parameters the node ignores. Structural validity is not semantic validity, and today nothing in the repository supplies the missing half.

This is the gap this task closes, and it is why the viability assessment called it the single highest-leverage unscoped piece of work in the plan. Everything downstream depends on it: the semantic validator (SUB-006) needs a vocabulary to validate against, the AI authoring loop (Phase 15) needs to know what nodes exist and what ports they expose, the MCP server (SUB-008) exposes it to external agents, and the code-export generators (Phase 18) need per-node-type contracts.

The good news, and the reason this is two weeks rather than two months: **the data already exists.** The runtime captures every node's inputs, outputs, types, display names, and grouping as neutral metadata at registration time. Nobody has ever written it out.

## Current State

- `packages/noodl-runtime/src/noderegister.js` — the registry. Node definitions are registered as plain objects and the register builds metadata for each input and output (name, type, display name, group, and related attributes). Signal ports are represented neutrally.
- `packages/noodl-runtime/noodl-runtime.js` — registers the framework-neutral logic/data/event nodes.
- `packages/noodl-viewer-react/src/register-nodes.js` — registers the visual nodes (roughly 27 React-bound types via `createNodeFromReactComponent`) plus many additional logic/data nodes that live in this package for historical reasons.
- Node definitions themselves live under `packages/noodl-runtime/src/nodes/std-library/` and `packages/noodl-viewer-react/src/nodes/`.
- **No catalog, manifest, or node-type enumeration exists anywhere in the repo** — not in `io/`, not in `schemas/`, not as a build artifact.
- Some ports are genuinely dynamic and cannot be fully enumerated statically: Function nodes discover output ports at runtime through a proxy, Expression nodes derive dependencies from the expression text, and several nodes generate ports from configuration. `dev-docs/reference/LEARNINGS.md` documents this explicitly, including a failed feature that assumed static port knowledge.

## Desired State

A generated `node-catalog.json` (plus TypeScript types) describing, for every registered node type:

- Canonical type string as it appears in project files, display name, category/group, and which package provides it
- Input ports: name, type, whether it is a signal, default value, enum options where applicable, display name, group
- Output ports: name, type, whether it is a signal
- Parameters and their types/defaults, where distinct from inputs
- **A dynamic-ports flag** and a description of the dynamism, for nodes whose real port set is only known at runtime
- Whether the node is visual (renders UI) or pure logic/data — this distinction matters directly to code export
- Deprecation status

Published as: a committed artifact for humans and AI to read, a build output regenerated on every CI run, and generated TypeScript types for compile-time use.

## Scope

### In Scope
- [ ] A generator that loads the node registries and serialises their metadata
- [ ] Coverage of both `noodl-runtime` and `noodl-viewer-react` registrations
- [ ] Explicit modelling of dynamic-port nodes (flagged, not silently misrepresented)
- [ ] Visual vs. logic classification
- [ ] Generated TypeScript type definitions alongside the JSON
- [ ] CI check that fails when the committed catalog is stale relative to the code
- [ ] A short `SCHEMA.md` explaining every field — the catalog is meant to be read by an AI with no other context

### Out of Scope
- Prose documentation, usage examples, and connection-compatibility rules (SUB-005 enriches the catalog with these)
- Validation logic that consumes the catalog (SUB-006)
- Any UI surface

## Technical Approach

### New Files to Create

| File | Purpose |
|------|---------|
| `scripts/generate-node-catalog.ts` | The generator: load registries, serialise metadata |
| `packages/noodl-types/src/node-catalog.ts` | Generated TypeScript types for the catalog |
| `node-catalog.json` (repo root or `packages/noodl-types/`) | The committed artifact |
| `docs/node-catalog/SCHEMA.md` | Field-by-field explanation for human and AI readers |

### Approach notes

Prefer **extraction from the live registry** over static parsing of node source files. The registry is the source of truth the runtime itself uses; parsing definitions statically would drift and would miss registration-time transformations. The generator should import the runtime, register everything as the app does, then walk the register.

The awkward part is `noodl-viewer-react`, whose nodes assume a browser/React environment. Determine early whether its registration can be driven headlessly (likely, since registration is metadata-only and does not render), or whether a lightweight DOM shim is needed. Resolve this in step 1 — it is the main technical unknown in the task.

## Implementation Steps

1. **Spike registry access** for both packages headlessly; settle the environment question before designing anything.
2. **Design the catalog schema.** This is the substantive work. Optimise for a reader with no other context: explicit names over clever compression, descriptions inline, no implicit conventions. Review the design against the three consumers (SUB-006 validator, Phase 15 AI authoring, Phase 18 generators) before writing the generator.
3. **Implement the generator**; serialise deterministically (stable key ordering) so diffs are meaningful.
4. **Handle dynamic-port nodes explicitly** — a catalog that claims a Function node has fixed outputs is worse than one that says "this node's outputs are determined at runtime by user code." Model the truth, including any statically-known base ports.
5. **Classify visual vs. logic** using the registration path (`createNodeFromReactComponent` and the React-bound node set versus the neutral definitions).
6. **Generate TypeScript types** from the same run so code and catalog cannot disagree.
7. **CI staleness check** — regenerate in CI and fail if the committed artifact differs.
8. **Write `SCHEMA.md`** and validate it by the acceptance test below.

## Testing Plan

- Generator produces a catalog covering every registered type; compare counts against the registration lists in both packages.
- Deterministic output: two runs are byte-identical.
- Round-trip sanity: for a sample of real projects, every `node.type` and every connection endpoint appearing in the project resolves against the catalog (this both validates the catalog and previews SUB-006).
- **Acceptance test that matters:** give an LLM only the catalog, the v2 schemas, and one example component file, and ask it to author a small valid component. It should be able to name real node types and wire real ports. If it cannot, the catalog is not yet fit for purpose — that failure is the signal to iterate on the schema, not to proceed.

## Success Criteria

- [ ] Every registered node type from both packages appears in the catalog
- [ ] Ports, parameters, types, defaults, and enums captured
- [ ] Dynamic-port nodes explicitly flagged and described
- [ ] Visual vs. logic classification present
- [ ] TypeScript types generated from the same source
- [ ] Deterministic output; CI fails on a stale committed catalog
- [ ] `SCHEMA.md` complete
- [ ] The LLM acceptance test passes

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `noodl-viewer-react` registration cannot run headlessly | Spike this first (step 1); a minimal DOM shim is the fallback, since registration is metadata-only |
| The catalog schema proves wrong once consumers arrive, and is expensive to change | Review the design against all three consumers before implementing; version the catalog format from day one |
| Dynamic ports are misrepresented as static, and AI output is confidently wrong | Model dynamism explicitly as a first-class concept; treat any node whose ports depend on user code or configuration as dynamic by default |
| The catalog drifts from the code | CI staleness gate; regenerate as part of the build rather than by hand |

## References

- [Viability report — §4.2 (the missing catalog is the real blocker)](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Track A, and Gate G1](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- `dev-docs/reference/LEARNINGS.md` — dynamic ports and why static port assumptions have failed before
- `dev-docs/reference/NODE-PATTERNS.md` — how node definitions are written
- Consumers: SUB-005, SUB-006, SUB-008, Phase 15 (AIX-002), Phase 18 (EXP-002/003)

## Checklist

- [ ] Branch `task/sub-004-node-catalog`
- [ ] Spike headless registry access for both packages
- [ ] Design and review the catalog schema against all three consumers
- [ ] Implement the generator with deterministic output
- [ ] Model dynamic-port nodes explicitly
- [ ] Generate TypeScript types; add CI staleness gate
- [ ] Write `SCHEMA.md`; run the LLM acceptance test
- [ ] CHANGELOG; open PR
