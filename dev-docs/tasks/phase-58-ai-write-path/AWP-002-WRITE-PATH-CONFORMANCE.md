# AWP-002 ⭐ — The conformance gate: MCP must not write what the editor could not

**Status:** ✅ **DONE 2026-08-08** — §1, §2 and §3 built; §2's "delete the second reader" option
**decided and deferred**, reasoning below · **Track: the writer** · **the flagship** · generalises **F43**

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

## As built — 2026-08-08

[`tests/writePathConformance.test.ts`](../../../packages/noodl-mcp/tests/writePathConformance.test.ts),
9 specs in `noodl-mcp`'s own jest gate. Fixtures: 3 authored **live** through the real
`create_component` door (page / visual / logic-only) plus all **13** components of the vendored
`replay-deepseek-v4-pro`. The suite asserts its own census both ways.

### ⚠️ §1 does not catch F43, and this task said it would

> *"On today's code this fails immediately and correctly: MCP writes no `visualRoots`, the editor's
> re-export adds it, and the diff names the field."*

**Measured: it does not.** `reconstructLegacyComponent → buildComponentV2Files` is a **fixed point** for
`visualRoots` — the reader copies `nodesFile.visualRoots` onto `graph.visualRoots` and the writer copies
it back, so absent-in is absent-out. The derivation lives in `NodeGraphModel.toJSON()`, which sits
*between* those two in the real editor pipeline and is unreachable from node (it imports NodeLibrary,
UndoQueue, WarningsModel, EventDispatcher).

So the structural diff is necessary and **not sufficient**, and §2 is not the optional half — it is the
half that catches F43. Had this been built as specced, the flagship gate would have shipped green while
blind to the defect it was named for.

### What §1 found instead — four fields, all drift toward the editor

Every one of these is the **editor's writer dropping something MCP wrote**, so each is allow-listed with
a written reason and filed rather than fixed here (the fix is in `ProjectExporter`, which this package
must not be the one to change):

| field | consequence of an editor open+save |
|---|---|
| `description` | **authored prose deleted.** A component's own documentation, written by the agent, gone. The most consequential of the four |
| `created` | creation timestamp dropped on every MCP-authored component |
| `modifiedBy` | provenance dropped; harmless, nothing reads it to decide anything |
| `type` | `inferComponentType` recognises a root only by `%rootcomponent`, so a project rooted at `/App` is relabelled **`root` → `visual`**. Its declared return union also includes `logic`, which no branch can return |

The allow-list is enforced in both directions: an unlisted difference fails, **and a listed entry that
nothing exercises fails too** — a dead entry is a claim nobody is checking.

### §2, and being seen to fail

Two readers, one file: the harness reads `nodesFile.visualRoots || []`, `ProjectImporter` builds roots
from the node tree. Run against the writer as it stood **before AWP-001**, §2 named **13** components —
both authored live, and 11 of the replay project's 13, independently reproducing AWP-001 §3's corpus
census without being told it. Runs without a browser; "the same set of visual root ids" is the whole
assertion.

### §2's stronger form: decided, and deferred

**Not done, and the reason is not scope.** Making `render-from-disk` import
`reconstructLegacyComponent` instead of paraphrasing it would make this class of defect structurally
impossible, and finding A3 argues for it. But the harness is standalone plain JS *by constraint* — it
runs from a fresh checkout with no build step — and the editor's reader is TypeScript. Importing it
means a build step in front of the one tool that deliberately has none.

Interim: the harness now derives, reading the **predicate from the catalog JSON** rather than restating
it, so the paraphrase surface is the tree walk alone. **Revisit when something else already forces a
build step in front of the harness** — do not add one for this.

### The fourth component type is not covered, and says so

`cloud` is asked for by §3 and is **absent**: `inferComponentType` derives it from a `__cloud__` path
segment that `create_component` does not mint. The fixture spec asserts the types it actually has
(`page`, `root`, `visual`) so the omission fails loudly if someone assumes otherwise, rather than
passing as covered.

## Register

| # | Finding | State |
|---|---|---|
| A3 | `render-from-disk`'s header already documents that paraphrasing the export contract cost two phases of false certification. **The same class of defect has now fired twice.** That is the argument for §2's stronger form | 📋 decide in §2 |
| A4 | `noodl-mcp` is the *only* producer for agent-authored projects, and the only one with no format conformance test. Phase 13 built the guard for the editor; nobody built the mirror when the second producer arrived | ✅ the premise, now gated |
| A12 | An editor save **drops `created`** from every MCP-authored component — `buildComponentV2Files` never emits it | 🔴 filed not fixed (ProjectExporter) |
| A13 | An editor save **deletes a component's `description`** — authored documentation, silently discarded | 🔴 filed not fixed (ProjectExporter) |
| A14 | `inferComponentType` relabels a project rooted at `/App` from **`root` to `visual`** on save, and its return union declares a `logic` no branch can produce | 🔴 filed not fixed (ProjectExporter) |
| A18 | **The task's own §1 prediction was wrong** — the pure round trip is a fixed point for `visualRoots`, so the flagship gate as specced would have shipped green and blind. Verified by running it | ⚠️ **corrected**, the suite's header records it |
| **A19** ⭐ | **`update_node.set.children` is accepted, reported applied, and silently discarded.** `children` is part of the authoring vocabulary at `create_component` (`{id:'a', children:['b']}` → `b.parent = 'a'`, verified), but `update_node`'s `set` declares only `label/x/y/variant/parent` and **zod strips unknown keys by default**, so the operation returns `applied: ["update_node band"]`, `0 errors, 0 warnings`, and changes nothing. One vocabulary, two doors, one of which lies. **Caught by consequence, not by inspection:** in the 2026-08-10 re-replay DeepSeek parented its hero content with exactly this operation, and the hero — headline, lead, two CTAs, photo — is in the file and cannot draw | 🔴 **OPEN**, minimal repro below |
| **A20** ⭐ | **`add_node` never re-derives `visualRoots`, so a node added without a parent can never draw.** At create time two parentless visual Groups both become roots (`["a","b"]`, verified); the same second Group added via `operations:[{op:'add_node'}]` yields `["a"]` — it is neither parented nor a root. **AWP-001 fixed the `set` path** (`assembleSetFiles` always recomputes) **and the operations path was not in its scope**, so F43's exact failure mode survives on the door DeepSeek used 20 times | 🔴 **OPEN** |
| A21 | ⚠️ **Every instrument passed the page with a section missing.** `validate:project` 0 errors/0 warnings on 115 nodes; `render_report` *"Rendered clean"*, 63 texts, 8 images, 0 placeholders, 0 broken images, no overflow at 390px. An orphaned subtree draws as **nothing**, and "nothing" is not an empty decorated box, a node-type default, or a broken image — so none of AWP-004's three checks can see it. **A fourth check earns its place here:** a component with a top-level node that is neither a visual root nor anybody's child | 📋 **the next AWP-004 check** |

### A19/A20 — the minimal reproduction

Both fire from one `update_component` call against a component whose only node is `band`:

```json
{ "path": "Components/Probe", "operations": [
  { "op": "add_node", "node": { "id": "wrap", "type": "Group" }, "index": 0 },
  { "op": "update_node", "id": "band", "set": { "children": ["wrap"] } } ] }
```

**Returns** `isError: false`, `applied: ["add_node wrap (Group)", "update_node band"]`,
`validation: {errors: 0, warnings: 0}`, `visualRoots: ["band"], visualRootsDerived: true`.
**On disk**: `wrap` has no `parent`, `band` has no `children`, and `wrap` is not a root.

⚠️ Note the response *confidently reports a derivation* (`visualRootsDerived: true`) whose answer
omits the node just added — which is AWP-001 §2's own reporting field saying the thing is fine.
