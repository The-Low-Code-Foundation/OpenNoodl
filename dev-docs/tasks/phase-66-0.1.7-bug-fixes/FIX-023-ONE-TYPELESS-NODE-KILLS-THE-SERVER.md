# FIX-023 — One typeless node kills the whole project's write surface

**Report** · Tier 1 · Effort **S** (the guard) + **S** (the error) · Raised 2026-08-16 (session 47),
scoped and re-measured 2026-08-16 (session 48)

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
