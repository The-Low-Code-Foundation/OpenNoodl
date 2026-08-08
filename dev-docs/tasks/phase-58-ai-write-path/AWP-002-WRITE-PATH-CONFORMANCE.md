# AWP-002 ⭐ — The conformance gate: MCP must not write what the editor could not

**Status:** 📋 open · **Track: the writer** · **the flagship** · generalises **F43** · depends on
AWP-001 only for its first fixture

## Why this is the flagship and AWP-001 is not

AWP-001 fixes `visualRoots`. This fixes *the reason `visualRoots` was broken for three days without
anyone noticing*, which is worth more, because there is no argument that `visualRoots` is the last
field of its kind.

**The format has a conformance guard for one producer and none for the other.** Both of these test
the editor's own writer:

- the whole-object round-trip suite (`tests/io/` — editor model → v2 → editor model)
- `tests/io/schema-drift.test.ts`, which walks every real fixture and asserts each property is
  representable in the v2 schemas *"rather than the field vanishing on the next save"*
  ([schema-drift.test.ts:1-16](../../../packages/noodl-editor/tests/io/schema-drift.test.ts))

**Nothing tests MCP → v2 → editor/runtime.** `noodl-mcp` is now a first-class producer of the project
format — for agent-authored projects it is the *only* producer — and it has never been held to the
format's own contract. F43 is what that gap looks like when it fails: not a schema violation (the
file validates), not a rule violation (`validate:project` reports 0 errors on 108 nodes), but a file
that is *legal and unrenderable*, in a way the editor's writer structurally cannot produce.

## The contract to test

> **Anything `noodl-mcp` writes must survive `ProjectImporter` → `ProjectExporter` unchanged in
> meaning, and must render the same before and after that round trip.**

Two halves, and the second is the one that catches F43:

### §1 Structural conformance — the round trip must be a fixed point

Take a component written by MCP. Run it through the editor's own reconstruct-and-re-export:
`reconstructLegacyComponent` ([ProjectImporter.ts:185](../../../packages/noodl-editor/src/editor/src/io/ProjectImporter.ts#L185))
then the v2 writer ([ProjectExporter.ts:300](../../../packages/noodl-editor/src/editor/src/io/ProjectExporter.ts#L300)).
**Diff the result against what MCP wrote.** Any field the editor *adds* is a field MCP should have
derived; any field it *drops* is a field MCP should not be writing; any field it *changes* is drift.

On today's code this fails immediately and correctly: MCP writes no `visualRoots`, the editor's
re-export adds it, and the diff names the field. That is precisely the failure that cost DeepSeek
18 turns, caught by a test that costs milliseconds.

⚠️ **Expect a legitimate-difference allow-list, and keep it short and *justified in writing*.**
Timestamps (`modified`) and `modifiedBy` differ by construction. Anything else on that list is a
decision, not a detail — the whole value of this gate is that the list is short enough to read.

### §2 Render equivalence — the two readers must agree

Structural equality is necessary and not sufficient: the *harness* has its own opinion of the file
(`roots: nodesFile.visualRoots || []`) which differs from `ProjectImporter`'s (roots from the node
tree). Two readers, one file, two answers — and the disagreement is invisible until something
renders blank.

So: **render the component both ways and compare the outcome.** The cheap version is a node-count and
text-count comparison between `render-from-disk`'s reconstruction and `ProjectImporter`'s, without a
browser — both produce an in-memory tree, and "same set of rendered root ids" is the assertion.

Better long-term: **delete the second reader.** `render-from-disk` reverse-engineered the export
contract by hand — its own header lists six things that "had to be reverse-engineered", and warns
that getting the interface lift wrong "is how this harness spent two phases certifying a page the
editor cannot render" ([render-from-disk.js:36-53](../../../scripts/devtools/render-from-disk.js#L36)).
That warning is the same defect class as F43, already fired once. If the harness imported the
editor's own `reconstructLegacyComponent` instead of paraphrasing it, §2 would be structurally
impossible rather than tested. **Scope that properly before committing to it** — the harness runs
from a fresh checkout with no build step, which is why it is standalone plain JS, and that
constraint is real.

### §3 Where it runs

This must be a **gate, not a script somebody remembers to run** — the phase-55 register has a row
for a check that was omitted from CI and one for a suite that reported `Tests: 0` while not
compiling. So:

- Fixtures: at minimum one MCP-authored component per component `type` (`page`, `visual`, `logic`,
  `cloud`), plus the four session-8/session-6 replay projects, which are real agent output and free.
- Runs in `packages/noodl-mcp`'s own jest suite (already a gate — 24 suites / 250 specs) so it fails
  the producer that broke the contract, in that producer's own repo package.
- **Assert the fixture count**, not just green. A conformance suite that silently stops loading
  fixtures passes forever.

## What this gate would have caught, and what it will catch next

Known today, and each is a candidate finding to confirm or dismiss while building §1 — **read them
in source, do not assume from this list**:

| Suspect | Why it is suspect |
|---|---|
| `visualRoots` | F43. Editor derives, MCP omits. **Confirmed.** |
| component-level `ports` | the editor writes `componentFile.ports` via `extractPorts(component)` ([ProjectExporter.ts:314](../../../packages/noodl-editor/src/editor/src/io/ProjectExporter.ts#L314)); `assembleCreateFiles` writes no `ports` key at all, and the harness reads `nodesFile.ports` — **three different homes for the interface**, worth settling |
| `comments` | editor writes them, MCP has no concept — harmless, but confirms the diff's allow-list works |
| `metadata` | editor writes `componentFile.metadata` when non-empty; MCP's create path has no parameter for it |

The point of the gate is that this table stops needing to be maintained by hand.

## Acceptance

- A round-trip conformance suite exists in `packages/noodl-mcp`'s jest gate, over fixtures covering
  all four component types plus the four replay projects.
- **On today's code (before AWP-001) it fails, naming `visualRoots`.** Demonstrate that, then land
  AWP-001 and watch it go green — a gate never seen failing is not known to work, which is this
  repo's own rule and has caught two green-looking checks already.
- The legitimate-difference allow-list is enumerated in the test file with a written reason per entry.
- The suite asserts its own fixture count.
- §2's render-equivalence assertion runs without a browser.
- A written decision on §2's "delete the second reader" option: do it, or record why not.

## Register

| # | Finding | State |
|---|---|---|
| A3 | `render-from-disk`'s header already documents that paraphrasing the export contract cost two phases of false certification. **The same class of defect has now fired twice.** That is the argument for §2's stronger form | 📋 decide in §2 |
| A4 | `noodl-mcp` is the *only* producer for agent-authored projects, and the only one with no format conformance test. Phase 13 built the guard for the editor; nobody built the mirror when the second producer arrived | 📋 the premise |
