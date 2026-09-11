# FIX-023 — One typeless node kills the whole project's write surface

**Report** · Tier 1 · Effort **S** (the guard) + **S** (the error) · Raised 2026-08-16 (session 47),
scoped and re-measured 2026-08-16 (session 48), ✅ **BUILT and DRIVEN 2026-08-17 (session 49)**

> ✅ **All five acceptance criteria met and driven.** Fixes **A + B + C** shipped together, C never
> alone. See §*What session 49 built* at the foot of this file — including **three corrections to
> the scoping above**, the most important being that this was **never an MCP-only defect**.

> Richard's own registered server, `nodegx-puppy-test-3`, cannot validate or author. Every write and
> `validate_project` fails with a message that names nothing.

---

## The symptom

```
io-error: Unexpected failure: Cannot read properties of undefined (reading 'startsWith')
```

`validate_project`, `create_component`, `update_component` — **every** tool that walks the graph.
✅ **Reproduced by s48** against the **registered, packaged server**
(`/Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs`, the Aug-13 build), so this is
the code on Richard's machine right now, not only a checkout artefact.

## The cause

One node object carrying **no `type`**:

```json
{ "id": "6d5ec795-be88-fdd9-b555-1bb2f6bba281", "x": 300, "y": 400 }
```

in `components/Pages/Admin Login/nodes.json` of `NodeGX test projects/Puppy test 3`.

It reaches `isComponentRef`, which is:

```ts
// validation/model.ts:70
export function isComponentRef(type: string): boolean {
  return type.startsWith('/') || type.startsWith('#');
}
```

🔴 **The parameter is typed `string`, so TypeScript sees nothing and no `tsc` gate can.** The value is
`undefined` at runtime. `strictNullChecks` does not help: the call sites pass `node.type`, whose
declared type is also `string`.

### 🔴 The guard exists in exactly one place, which is the tell

`packages/noodl-mcp/src/project/ProjectStore.ts:429` reads:

```ts
if (typeof node.type === 'string' && isComponentRef(node.type) && …)
```

**Nowhere else does.** Someone hit this before and patched the one line they were standing on. The
unguarded callers that walk every node are `rules/unresolvedComponentRef.ts:30`,
`rules/typeIncompatibleConnection.ts:40`, `tools/planTools.ts:324`, `describe.ts:123` and
`tools/read.ts:307`.

⚠️ **Which one fires first is not pinned**, and deliberately so — see *Fix direction*. To pin it:
copy `dist/noodl-mcp.cjs` to a scratch path and replace `Unexpected failure: ${err.message}` with the
same plus `${err.stack}`. 🔴 **Never patch the shared `dist/`** — peers load it.

## Census — done before scoping, not after

✅ **28 v2 projects on disk scanned, every `nodes.json`, objects only.** Exactly **one** project
carries a typeless node: `Puppy test 3`, **1 of its 119 node objects**. (`puppy-test-3-fix008c` is
s47's copy of it and carries the same one.)

⚠️ **Count node OBJECTS, not array entries.** A `children` array holds **id strings**, so a naive
walk that treats every array element as a node reports ~83 "typeless nodes" in this project and ~40
in healthy ones. The first pass at this census did exactly that.

🔴 **The census is what makes this Tier 1 rather than a curiosity.** One project in 28 is a rounding
error — except it is *the* project Richard has a registered MCP server for, so his own
`nodegx-puppy-test-3` cannot author or validate.

## The two defects, and the second is the bigger one

1. **No guard.** One malformed node crashes the walk.
2. 🔴 **The error names neither the node nor the component.** `io-error: Unexpected failure: …` with
   a raw JS message turns a one-node problem into an unexplained dead server. A user cannot act on
   it, and an agent cannot either — there is nothing in the string to search for.

⚠️ **Defect 2 is what to fix first if only one gets done.** A guard makes this project work; a
diagnostic makes the *next* malformed-project bug survivable.

### 🔴 Where the asymmetry comes from

The editor tolerates this node — it was hardened against this class on 2026-08-11 (s47's finding,
**not independently re-verified here**). The MCP server never was. In the editor one bad node costs
you that node; here it costs **the entire project's write surface**.

## Fix direction

| # | Fix | Where | Effort |
|---|---|---|---|
| A | **Guard at the boundary, not at the call sites.** Normalise or reject typeless nodes where a project is loaded, so the five unguarded walkers stop being five separate bugs. | `noodl-mcp` load seam | S |
| B | **A diagnostic that names the node and the component** — id, component path, and what is missing — instead of `Unexpected failure`. Emit it as a validation diagnostic, not a thrown `io-error`. | error wrapper + validator | S |
| C | Make `isComponentRef` accept `string \| undefined` and return `false`. ⚠️ **Defence in depth only** — it silences the crash without telling anyone the project is malformed, so **do not ship C alone**. | `validation/model.ts` | XS |

## Acceptance criteria

1. `validate_project` on `Puppy test 3` returns diagnostics instead of throwing.
2. One of those diagnostics names **`6d5ec795-be88-fdd9-b555-1bb2f6bba281`** and
   **`Pages/Admin Login`**.
3. `create_component` on that project succeeds.
4. A spec covers a typeless node in a fixture. 🔴 **A fixture of one component cannot see this** —
   the node has to sit beside well-formed siblings, or a walker that stops at the first node passes.
5. The other 27 v2 projects still validate exactly as before — **quote the before numbers**, do not
   assert "unchanged" from a clean run.

## Not a regression — do not bisect

The packaged **Aug-13** bundle fails identically (s47, and s48's reproduction was *on* that bundle).
`isComponentRef` has been unguarded for as long as it has existed.

## Notes for whoever builds this

✅ **`puppy-test-3-fix008c`** (under `NodeGX test projects/`) is kept on purpose: a copy of the one
project that reproduces this, so the fix can be built and driven without touching the real
`Puppy test 3`.

⚠️ **`packages/noodl-mcp/dist/` is gitignored and is what registered servers load.** s47 rebuilt it
to HEAD. A fix is not testable through a registered server until that is rebuilt — and Richard's
`nodegx-puppy-test-3` points at `/Applications/NodeGX.app/…` instead, so **it needs the repackage
that is already owed** before he sees any of this.

---

# What session 49 built

**Commit:** see `git log` for `fix(fix-023)`. Six source files, one spec, one fixture.

## The build — A + B + C, and why all three

| Fix | Where | What it does |
|---|---|---|
| **A** | `validation/normalize.ts` — `normalizedType()` | The **one** place `node.type` crosses from "whatever was on disk" into the model's `type: string` promise. Substitutes `MALFORMED_NODE_TYPE` (empty string) and records `malformed: ['missing-type']`. Applied at **both** boundaries — `normalizeV2Component` (v2/MCP) *and* `flatten` (legacy / `ProjectModel.toJSON()`), so the editor's own in-memory path is covered too. |
| **B** | `validation/rules/malformedNode.ts` (new), registered **2nd** in `ALL_RULES` | An `error` diagnostic naming the node id and the component path **in the message text**, not only in `location` — the identifying detail has to survive whatever formatter it passes through. `unknownNodeType` now defers to it, so nobody meets `Unknown node type ""` (the placeholder blamed on the author). |
| **C** | `validation/model.ts` — `isComponentRef(type: string \| undefined \| null)` | Defence in depth, **shipped with A and B, never alone**. For the callers that walk **raw v2 files** and never pass through normalisation. |

`malformedNode` is **2nd**, not 1st: `duplicateNodeId` must keep leading, because this rule reports
*by id* and a colliding id would send the reader to the wrong node. That ordering is asserted by
`tests/validation/duplicate-node-id.test.ts:40` and still holds.

## Acceptance criteria — all five

| AC | Result |
|---|---|
| 1. `validate_project` returns diagnostics instead of throwing | ✅ **Driven** against a real MCP server over stdio |
| 2. A diagnostic names `6d5ec795-…` **and** `Pages/Admin Login` | ✅ **Both, in the message string** |
| 3. `create_component` succeeds | ✅ **Driven** — `"created": "Fix023 Probe"`, registry updated, 0/0/0 |
| 4. A spec covers a typeless node in a fixture | ✅ 11 tests, **mutation-checked** |
| 5. The rest of the corpus validates exactly as before | ✅ **54 of 56 identical diagnostic-for-diagnostic** |

### AC5 — the before numbers, quoted

`npm run validate:project --json` over every project directory under `NodeGX test projects/`,
**before the change and after it**, compared **diagnostic-for-diagnostic** (code + nodeId + message),
not by summary counts:

- **56 targets before, 54 identical after.**
- The **only** two that changed are `Puppy test 3` and `puppy-test-3-fix008c` (its kept copy):
  `THREW: Cannot read properties of undefined (reading 'startsWith')` → `1 error / 1 warning`
  (`malformed-node` + a pre-existing `repeated-sibling-subtree`).
- ⚠️ A peer created `cn069-s15-drive` between the two runs (57 targets after). It validates
  `0e/0w` and is excluded from the comparison, which iterates the *before* set.

### AC4 — why the fixture is shaped the way it is

The task file warned that a fixture of one component cannot see this. It is sharper than that:
**"it no longer throws" is satisfied just as well by a walk that aborts silently.** So the fixture
puts the typeless node **third of four** in a component whose **fourth** node carries an
independently-detectable defect, and lists that component **first** in the registry ahead of a second
component carrying another. The two assertions that actually matter are that the node *after* it and
the component *after* it are still reported.

✅ **Mutation-checked.** Fixes A and C reverted in one shell call (each mutant announced that it
applied, restored from a scratchpad backup, `diff`ed back identical): **10 of 11 tests failed**, with
`does not throw the walk (AC1)` failing on the original `Cannot read properties of undefined`. The
one survivor is `still answers correctly for real types`, which does not exercise the guard — correct.

## 🔴 Three corrections to the scoping above

1. 🔴 **This was never an MCP-only defect.** The section *"Where the asymmetry comes from"* says the
   editor was hardened and "the MCP server never was". But `isComponentRef` lives in
   **`noodl-editor/src/editor/src/validation/model.ts`**, shared, and the repo's own
   **`npm run validate:project` CLI crashed identically** on this project — verified before any code
   was changed. The crash belonged to the **shared validator**, whichever client called it. What the
   editor tolerates is a typeless node in its *runtime graph*; that says nothing about its validator.
2. 🔴 **"The guard exists in exactly ONE call site" was wrong, and the real number is worse.** A
   census of every `isComponentRef(` call site: **20 calls, 2 guarded** — `ProjectStore.ts:429` *and*
   `models/AiAssistant/authoring/plan.ts:544` — plus a third, independently-safe local copy of the
   function in `utils/import-engine/legacy/assess.ts:112` that already took `string | undefined`. So
   **three** people hit this before and each patched the line they were standing on. The task file
   listed five unguarded callers; there were about seventeen, **seven of them in the editor's own
   validation rules**, which the file did not mention at all.
3. ⚠️ **The corpus is 56 project directories, not 28.** 28 are v2 (a `components/_registry.json`);
   the rest are legacy v1 and validate through `loadLegacyProject`. s48's census of *28 v2 projects,
   exactly one affected* is correct and reproduced — but the fix had to be measured against all 56,
   because the legacy path goes through `flatten()`, a **second** boundary the scoping did not name.

## What is deliberately NOT built

- ⚠️ **The `io-error: Unexpected failure: ${err.message}` wrapper is untouched.** This fix removes
  the one crash that reached it; it does not improve what the *next* unexpected throw will say. That
  is still a real defect — a wrapper that names neither the tool nor the project — and it wants its
  own task.
- ⚠️ **A missing `id` has the same shape and is not guarded.** `MalformedNodeReason` is a list-typed
  union precisely so the next such field joins it rather than growing a second mechanism.
- ⚠️ **`refToPath` is still typed `(ref: string)`.** Every call site is short-circuited behind an
  `isComponentRef` check, so it is unreachable with a non-string today. That is a property of the
  callers, not of the function.

## Gate readings — session 49, this tree

| Gate | Reading |
|---|---|
| **`tests-unit/fix-023`** | ✅ **11/11**, and **10/11 fail** under the reverted-fix mutant |
| **`test:main`** (noodl-editor) | ✅ **228 suites / 3538 tests**; 1 pre-existing timing flake |
| **root `npm run typecheck`** (the PR gate) | ✅ exit 0, empty output |
| `tsc -p packages/noodl-editor/tsconfig.json` | ✅ exit 0, empty |
| `tsc -p packages/noodl-editor/tsconfig.tests.json` | ✅ exit 0, empty |
| **`noodl-mcp` jest** | ✅ **50 suites / 585 tests**, exit 0 |
| **`tests/validation/*` (7 suites)** | ✅ **86 tests** — incl. `false-positive-corpus` and the `ALL_RULES` ordering assertion |
| **The drive** | ✅ 2 arms × 2 tools, byte-identical project copies |

⚠️ **`test:main`'s one failure is `tests-unit/aib-009/turnDeadline.test.ts`** — a timing suite whose
assertions are 1004 ms and 157 ms. It **passes in isolation** (8/8) and does not touch validation.
s48's floor was 227 suites / 3527 tests; **228 / 3538** is exactly this session's one new suite and
its 11 tests.

⚠️ **The 7 `tests/validation` suites were run under jest, not under the electron/jasmine harness
`test:ci` uses.** Same source, different runner. `test:ci` itself was **not** taken.

⚠️ **`packages/noodl-mcp`'s own `tsc --noEmit` reports 13 errors — all pre-existing.** Proven by
restoring all six changed files to `HEAD` and re-running: **the same 13**. That config is not a PR
gate (the workflow runs the *root* `typecheck`), and none of the 13 are in or about validation.

## The drive — 2 arms × 2 tools, and the old arm is the known-firing signal

A minimal MCP stdio client (`scratchpad/fix023/drive.js`) called `validate_project` and
`create_component` against a real server. Two arms differing **only in the bundle**, over
`cp -R` copies of `puppy-test-3-fix008c` verified byte-identical with `diff -rq` first:

| | `validate_project` | `create_component` |
|---|---|---|
| **OLD bundle** (`packages/noodl-mcp/dist/`, what registered servers load) | ❌ `io-error: Unexpected failure: Cannot read properties of undefined (reading 'startsWith')` | ❌ **the same error** |
| **NEW bundle** (this session's build) | ✅ `1 error / 1 warning`, 119 nodes, 114 endpoints | ✅ `"created": "Fix023 Probe"`, `"registry": "updated"` |

✅ **The old arm wrote nothing to disk** — `diff -rq` against the kept fixture afterwards is empty,
so `create_component` failed *before* writing rather than half-way through.

✅ **The kept fixture `puppy-test-3-fix008c` was never written to.** Both arms ran on scratch copies.

⚠️ **Built to a scratch path, not to the shared `packages/noodl-mcp/dist/`** — peers' registered
servers load that, and a rebuild mid-session would land inside someone's measurement.

## 🔴 Still owed before Richard sees this

**The repackage.** Richard's `nodegx-puppy-test-3` resolves to `/Applications/NodeGX.app/…` — the
**Aug-13** bundle. It will keep crashing until the app is repackaged. That is now the **third**
reason the repackage is owed.
