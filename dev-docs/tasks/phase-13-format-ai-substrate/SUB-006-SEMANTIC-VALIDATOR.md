# SUB-006: Semantic Validator

## Metadata

| Field | Value |
|-------|-------|
| **ID** | SUB-006 |
| **Phase** | Phase 13 — Format & AI Substrate (Revival Track A) |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 2–3 weeks |
| **Prerequisites** | SUB-004 (catalog); SUB-005 improves message quality |
| **Branch** | `task/sub-006-semantic-validator` |
| **Recommended executor** | 🟠 **Opus 4.8** — well-specified rules over a known vocabulary, but error-message design and the handling of dynamic-port nodes need care. Sonnet can implement individual rules once the framework and diagnostic format are set. |

## Objective

Provide a validator that checks a v2 project against the node catalog — unknown node types, connections to ports that do not exist, dangling endpoints, orphaned nodes, type-incompatible wiring — available both as a CLI and inside the editor.

## Background

Structural validation already exists: Ajv checks v2 files against the JSON schemas, confirming shapes and required fields. What it cannot check is whether the content means anything, because the schemas deliberately leave node types and port names open.

This task supplies the missing layer. Its role in the revival plan is best understood by analogy: **the catalog is the language definition, and this validator is the compiler's error output.** An AI authoring a component needs to be told, mechanically and immediately, that `Butonn` is not a node type and that `Group` has no port called `onClick`. Without that feedback loop, AI authoring degenerates into generating plausible text and hoping; with it, the model can iterate to correctness the same way a developer iterates against a type checker.

The same validator serves humans directly — catching broken references after a refactor, a merge, or a hand-edit — and serves CI, where a project that no longer validates is a build failure.

## Current State

- `packages/noodl-editor/src/editor/src/schemas/validator.ts` — Ajv-based structural validation against the 8 v2 schemas. (Note: REV-001 fixes its Ajv v6/v8 typing issue; this task builds on the fixed version.)
- No semantic validation of any kind. A project referencing a nonexistent node type or wiring a nonexistent port passes structural validation and fails, if at all, at runtime.
- The editor surfaces some invalid states visually (broken connections render differently) but there is no programmatic check.
- SUB-004's catalog supplies the vocabulary this task validates against.

## Desired State

A validator that, given a v2 project (whole or a single component) plus the catalog, produces a list of diagnostics with:

- Severity (error / warning / info)
- A precise location: component path, node id, port name
- A message written to be actionable by both a human and an AI
- Where possible, a suggested fix ("did you mean `Group`?" / "`Text` has no input `onClick`; available signal inputs are …")

Available as a library (for the editor and the MCP server), a CLI (for CI and scripting), and integrated into the editor's UI.

## Scope

### In Scope
- [ ] Rule: every `node.type` resolves to a catalog entry (or is a known component reference resolvable via the registry)
- [ ] Rule: every connection endpoint names a port that exists on its node
- [ ] Rule: no dangling connections (endpoints referencing missing nodes)
- [ ] Rule: no orphaned nodes where the graph structure requires parentage
- [ ] Rule: type compatibility across connections, using SUB-005's matrix where available
- [ ] Rule: component references resolve against `_registry.json`
- [ ] Correct handling of dynamic-port nodes — never report a false error for ports that are legitimately runtime-determined
- [ ] "Did you mean" suggestions via string distance over catalog entries
- [ ] CLI entry point and machine-readable (JSON) output mode
- [ ] Editor integration: a problems panel or equivalent surface

### Out of Scope
- Auto-fixing problems (a later idea; suggestions only for now)
- Style/lint opinions about graph design (this checks correctness, not taste — patterns live in SUB-005)
- Runtime behavioural verification (Phase 18's trace harness does that)

## Technical Approach

### New Files to Create

| File | Purpose |
|------|---------|
| `packages/noodl-editor/src/editor/src/validation/SemanticValidator.ts` | Rule engine over project + catalog |
| `packages/noodl-editor/src/editor/src/validation/rules/*.ts` | One file per rule, independently testable |
| `packages/noodl-editor/src/editor/src/validation/diagnostics.ts` | Diagnostic type, severity, formatting |
| `scripts/validate-project.ts` | CLI entry point (human and JSON output) |
| `packages/noodl-editor/tests/validation/` | Rule tests, including false-positive guards |

### Design notes

Keep rules independent and individually toggleable — a rule that produces false positives must be disableable without losing the rest. Diagnostics should be data, with formatting applied at the edge, so the MCP server and CLI can emit JSON while the editor renders UI from the same objects.

**The dynamic-port problem is the crux of this task.** A Function node's outputs are created at runtime by user code; an Expression node's dependencies come from parsing its expression. Reporting "port does not exist" for these would flood real projects with false errors and destroy trust in the validator. Use SUB-004's dynamic flags: for dynamic nodes, validate what is statically knowable and explicitly skip the rest, ideally emitting an info-level note rather than silence.

## Implementation Steps

1. **Diagnostic model and rule framework** first — severity, location, message, suggestion, plus enable/disable per rule.
2. **Implement rules in order of value**: unknown node type → nonexistent port → dangling connection → unresolved component reference → type incompatibility → orphaned node.
3. **Dynamic-node handling** as an explicit, tested concern rather than an afterthought. Write the false-positive guard tests before the rules that could trip them.
4. **Suggestions** via edit distance over catalog type and port names.
5. **CLI** with human-readable and JSON output; non-zero exit on errors so CI can gate.
6. **Editor integration** — surface diagnostics in a panel, and ideally on-canvas at the offending node.
7. **Validate the entire fixture corpus** from SUB-002 and any real projects available. Every false positive found here is a bug in this task; a validator that cries wolf on real projects will be ignored.

## Testing Plan

- Per-rule unit tests with deliberately broken fixtures for each rule.
- **False-positive suite**: every known-good real project and fixture validates clean. This is the most important test in the task.
- Dynamic-port nodes (Function, Expression, and any configuration-driven port nodes) produce no spurious errors.
- CLI exit codes correct; JSON output parses and carries full location data.

## Success Criteria

- [ ] All listed rules implemented, independently toggleable and tested
- [ ] Zero false positives across the SUB-002 fixture corpus and available real projects
- [ ] Dynamic-port nodes handled explicitly with no spurious errors
- [ ] Suggestions produced for near-miss type and port names
- [ ] CLI available with JSON output and correct exit codes
- [ ] Editor surfaces diagnostics with navigation to the offending node
- [ ] An AI given a deliberately broken component receives diagnostics sufficient to fix it without further context

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| False positives on dynamic nodes destroy trust in the tool | Treat as the primary correctness concern; guard tests first; validate the whole real corpus before declaring done |
| Validator is too slow for editor-time use on large projects | Validate per-component incrementally; whole-project validation on demand and in CI |
| Rules encode assumptions the runtime does not actually hold | Derive from catalog + runtime behaviour, not from intuition; where uncertain, warn rather than error |
| Messages are precise but unhelpful to an AI | Include available alternatives in the message body (the AI's next attempt should be informed by the error alone) |

## References

- [Revival roadmap — Track A, Gate G1](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [Viability report — §4.2](../../reviews/NOODL-VIABILITY-REPORT.md)
- Depends on: SUB-004, SUB-005. Consumers: SUB-008, Phase 15 (AIX-002), CI

## Checklist

- [x] ~~Branch `task/sub-006-semantic-validator`~~ — committed directly to `cline-dev` per project workflow
- [x] Diagnostic model + rule framework (`validation/diagnostics.ts`, `validation/rules/`)
- [x] Implement rules in value order, with per-rule tests (6 rules, `tests/validation/rules.test.ts`)
- [x] Dynamic-port false-positive guards written first (`tests/validation/dynamic-ports.test.ts`)
- [x] Suggestions; CLI with JSON output and exit codes (`scripts/validate-project.ts`, `npm run validate:project`)
- [x] Editor panel integration (`views/panels/ProblemsPanel/` + `ProjectValidationService`)
- [x] Clean run across entire fixture corpus + real projects (`tests/validation/false-positive-corpus.test.ts`, zero errors)
- [x] Progress tracker updated (PROGRESS.md Change Log). ~~Live in-editor smoke test pending~~ **Live smoke passed 2026-07-24 (DEBT-002):** panel renders real diagnostics, badge count updates, click-to-navigate selects the offending node on canvas. Caveat found: the panel is registered `experimental: true` and hidden until `experimental.panel.problems` is enabled — decide whether it should be on by default.
