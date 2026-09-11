# `@nodegx/node-kit-types`

The authoring surface of a NodeGX node kit, as **one self-contained `.d.ts`**.

A kit is plain JavaScript — no SDK, no bundler, no `npm install` (ruling **D2**, phase 69). The cost
is that an author's editor knows nothing about the object they are writing. This file is the fix, and
it costs the author no toolchain either.

## How an author uses it

Copy `src/index.d.ts` into the kit and point a JSDoc annotation at it:

```
noodl_modules/my-kit/
  manifest.json
  index.js
  types/node-kit.d.ts   ← a copy of src/index.d.ts
```

```js
// @ts-check
/** @type {import('./types/node-kit').ReactNodeDefinition} */
const Chip = {
  name: 'mykit.Chip',
  getReactComponent: function () { return ChipComponent; }
  //  ↑ autocomplete, inline errors, and the docs on hover — from here down
};

Noodl.defineModule({ reactNodes: [Chip] });
```

No `tsconfig`, no build step, no `node_modules`. `.d.ts` files emit nothing, so the kit ships exactly
as it did before. CN-006's scaffold writes this layout; until then it is a copy.

## 🔴 Why a relative path and not `import('@nodegx/node-kit-types')`

Because the bare specifier does not work, and it was measured rather than assumed. A bare specifier
resolves only when the package is physically installed above the file, and a kit inside a NodeGX
project has no way to arrange that — there is no `package.json` and no `node_modules` in the tree.
With one absent, the annotation is dead (`Cannot find module`) and the editor falls back to offering
~1,200 DOM globals.

`tests/resolution.test.js` asserts **both** arms. The failing one is kept deliberately: it is the
evidence for the delivery mechanism, and it will speak up if TypeScript ever changes its mind.

## What keeps it honest

A `.d.ts` is a claim about code it does not live next to, and a type that lies is worse than no type
because it is believed. Three things guard it, and all three are mutation-proven:

| Guard | What it catches |
|---|---|
| `tests/drift.test.js` | The runtime gains, loses or re-optionalises a field. Compares the **fully resolved** property sets — via the compiler's checker, so it follows `extends Omit<…>` into `@noodl/types` — for 18 types. |
| `tests/fixtures/kit-broken` | The types stop *reporting* anything. Five planted mistakes that must each be named. |
| `tests/resolution.test.js` | The annotation stops resolving, or the completion list quietly becomes the global scope. |

Sources of truth: `packages/noodl-viewer-react/src/react-component-node.ts` for the React half, and
`packages/noodl-types/src/runtime/node-definition.d.ts` for ports and the logic half.

## The one deliberate divergence

`ReactNodeDefinition` drops the runtime's `[extra: string]: unknown` index signature. Keeping it
would mean a misspelled field (`dispayNodeName`) matches the index signature and is never reported —
while the runtime drops it silently too, because `createNodeFromReactComponent` forwards fields by
naming them one at a time. Silent at both ends is the worst outcome available and it is the most
common authoring mistake.

Omitting the index signature cannot produce a false error: a field this interface does not list is a
field the bridge does not forward. `drift.test.js` asserts the divergence explicitly, because an
index signature is not a property and a property-set comparison is blind to it.

## ⚠️ The logic half is provisional

`NodeDefinitionOptions` (and `NodeKitModule.nodes`) mirror what the runtime declares, so they will
not send an author somewhere that does not exist. But *whether a logic node in a kit reaches that
path at all*, and how it behaves in the cloud runtime, is CN-012's question and has not been
established. The types say so where an author will read it.
