# CN-005 — The definition, typed

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Effort** | M |
| **Surface** | `runtime`, one no-build package |
| **Rulings** | ✅ **D2** — JS is the supported path; types ship; **zero build step for the author** |
| **Depends on** | nothing hard; best written beside CN-006 so the scaffold consumes it |

---

# ✅ BUILT 2026-08-16 (session 8)

`packages/nodegx-node-kit-types` — `@nodegx/node-kit-types`, one self-contained `src/index.d.ts`,
no build step, **60 tests across 3 suites**, registered in all four places a new workspace package
needs. All four acceptance criteria met; **AC1 only after its premise was measured false and
replaced**. What follows is what the build settled — the original spec is below the line.

## 🔴 AC1's premise was false, and both arms are now asserted in the suite

The criterion asks for autocomplete in a project with **no `node_modules`**, through
`import('@nodegx/node-kit-types')`. Measured first, before anything was written, by driving the
**TypeScript language service** — the process VS Code runs to build its completion list:

| Arm | Completions on the definition | Diagnostic |
|---|---|---|
| Package in `node_modules` (control) | the definition's own fields | typo flagged |
| **AC1 as written** — no `node_modules` | **none**; ~1,200 DOM globals instead | `Cannot find module '@nodegx/node-kit-types'` |
| **Relative path** to a copy in the kit folder | the definition's own fields | typo flagged |

A bare specifier resolves only when the package is physically installed above the file, and a kit
inside a NodeGX project has no `package.json` and no `node_modules` to make that true. So the
delivery mechanism is a **copy of the `.d.ts` in the kit** (`types/node-kit.d.ts`), reached
relatively — which is what CN-006's scaffold will write.

Both arms live in `tests/resolution.test.js`. The failing one is kept deliberately: it is the
evidence for why delivery looks the way it does, and it will speak up if TypeScript changes its mind.
🔴 **The check that makes it mean anything is `not.toContain('document')`** — a completion list that
merely *contains* `inputCss` would pass in both worlds.

## 🔴 The two holes, and both were found by building the caller

Neither is a hole in a kit. Both are holes in **the types package**, and each was invisible until
something real was annotated.

**1. The globals a kit runs against were undeclared.** Every annotated kit — the fixture and the
cashflow kit alike — reported `Cannot find name 'Noodl'`. A types package for kit authors that does
not declare `Noodl.defineModule` and `React` hands every author a spurious error on line one. Now
declared, and the three bootstraps disagree in a way worth publishing: viewer and deploy set
`Env: {}`, **the SSR bootstrap does not set `Env` at all**, so it is optional with the reason stated.

**2. 🔴 The index signature silently disabled the thing the package exists for.**
`react-component-node.ts` declares `[extra: string]: unknown` on `ReactNodeDefinition`. Mirror it
faithfully and `dispayNodeName` matches the index signature — **no diagnostic**. And
`createNodeFromReactComponent` builds the compiled definition by naming every field it forwards, one
at a time, so the runtime drops it silently too. *Silent at both ends*, on the most common authoring
mistake there is.

The published type therefore **omits it** — the one deliberate divergence. It cannot produce a false
error: a field the interface does not list is a field the bridge does not forward. ⚠️ **An index
signature is not a property, so the property-set drift check is blind to it** — it is asserted
separately, in both directions, or it would have been the one piece of drift the drift check could
not see.

## The drift check (AC2), and what it is worth

`tests/drift.test.js` compares the **fully resolved** property sets — via the compiler's checker, so
it follows `extends Omit<InputPortDefinition, 'set'>` into `@noodl/types` rather than seeing three
declared members and calling the mirror complete. 18 types: 16 exactly equal, 2 (`NodeInstance`,
`ReactNodeInstance`) subset-only because they are deliberately partial.

**Mutation-proven, three ways** — the tree was restored byte-identical after each:

| Mutation | Result |
|---|---|
| Delete `mountedInput` from the runtime `ReactNodeDefinition` | ✅ 1 failed — AC2 exactly |
| Make runtime `ReactNodeDefinition.name` optional | ✅ 1 failed (the optionality check) |
| Invent a member on the published `ReactNodeInstance` | ✅ 1 failed (the subset check) |

⚠️ Two guards exist because a green drift check proves nothing on its own: the resolution guards
(`ReactInputPropDefinition` must carry the inherited `tooltip`; `NodeDefinitionOptions` must have
>30 members) fail *first* and say why, because a program whose imports did not resolve reports
interfaces with only their own members — which would make the partial checks pass for the wrong
reason.

## AC3 and AC4

**AC3.** `tests/fixtures/kit-annotated` typechecks clean. 🔴 **`kit-broken` is what makes the clean
one mean anything** — a `.d.ts` full of `any`, or one that never resolved, produces identical
silence. Five planted mistakes, each asserted **by the identifier it names**, not by counting.
⚠️ **One fault per definition, and that was measured:** a single literal holding all five reported
**two**. TypeScript elaborates an assignability failure and stops early, so a test "passing" for the
third fault would have been passing on someone else's error.

### 🔴 `skipLibCheck: true` made the standalone-compile gate measure nothing

Worth its own heading because it was believed for about twenty minutes and written into this file
before the control ran. `skipLibCheck` skips type checking of **every `.d.ts`**, not just the bundled
lib files. So both the new jest gate *and* the hand-run
`npx tsc --noEmit --strict --skipLibCheck src/index.d.ts` that this file originally cited as ✅
passed happily **with `NoSuchTypeAtAll` substituted into the published types**. A `.d.ts` cannot be
graded by a tool configured to skip `.d.ts` files, and nothing says so.

Corrected to `skipLibCheck: false` and mutation-proven. Which immediately surfaced a real conflict
the vacuous version had been hiding:

| Environment | Result |
|---|---|
| **A kit project** (`types: []` — no `node_modules`, what it ships for) | ✅ clean |
| **A project that already has `@types/react`** (this repo; CN-007's examples) | ⚠️ exactly one: `Cannot redeclare block-scoped variable 'React'` |

The file declares a global `React: any` because a kit has none to resolve and every kit opens by
reaching for it. React publishes its own UMD global, so the two collide wherever both are in scope.
**Pinned by a test asserting exactly that one diagnostic** — a stated limitation rather than a hidden
one, and if it ever becomes two, somebody hears about it. The remedy is in the `.d.ts` beside the
declaration: delete that line and use React's own types, which are better than `any`.

**AC4 — the cashflow kit, annotated: 0 diagnostics.** All five nodes, ~60 ports.
🔴 **A clean run is exactly the reading that must not be trusted**, so three faults were injected into
the real kit and each was caught: a top-level typo (`dispayNodeName` → *"Did you mean
`displayNodeName`?"*, which only fires because of the divergence above), a port-level typo, and a
numeric `type`. Restored byte-identical, 0 diagnostics.

✅ The kit still loads identically: `@nodegx/module-inject`'s real scan returns one module, zero
warnings, `main: index.js`. The scan enumerates directories directly under `noodl_modules/` and reads
only `manifest.json`, so the added `types/` folder is invisible to it. (The kit is **not** under
version control — backed up before editing.)

## ⚠️ What was published as *provisional*, and one claim the spec got backwards

- **The logic half** (`NodeDefinitionOptions`, `NodeKitModule.nodes`) mirrors the runtime's own
  declarations, marked provisional where an author reads it: the names will not send anyone somewhere
  that does not exist, but whether a logic node *in a kit* reaches that path is CN-012's question.
- 🔴 **Spec item 4 was wrong about `frame`, and publishing it as instructed would have been the lie
  in the other direction.** "Nothing in the repo sets it and `useFrame` is always false" is true *of
  in-repo nodes*. Traced: `useFrame = !!def.frame` at the bridge, and each sub-field registers real
  shared ports (`frame.dimensions` → `addDimensions`, `position` → `addTransformInputs`, and three
  more). For a kit — the exact audience of these types — **both halves are live code**. Published as
  working, with the honest caveat that it is *unexercised in-repo*, not as dead.

## Registration — all four, in one commit

`test:packages` scope (15th) · a `test` script · `package-lock.json` (via
`npm install --package-lock-only`, peer-safe) · the `node_modules/@nodegx/node-kit-types` symlink.
✅ **The lockfile diff is 13 lines and contains nothing but this package** — read and confirmed,
unlike CN-003's run which folded in an unrelated version correction. No consuming package declares a
dependency yet: it is types-only and nothing imports it at runtime until CN-006.

✅ **`npx lerna run test --scope @nodegx/node-kit-types` runs it** — the gate reaches it, proven,
not assumed.

---

## Why types are the deliverable

The authoring surface is already fully typed and heavily documented — `react-component-node.ts`
carries `ReactNodeDefinition`, `ReactInputPropDefinition`, `ReactInputCssDefinition`,
`ReactOutputPropDefinition`, `ReactNodeInstance` and their prose. It is the best documentation of
this mechanism that exists anywhere, and **a kit author cannot reach it**: it lives inside
`noodl-viewer-react`, compiled into the runtime bundle, not published anywhere an author's editor
will resolve.

The gap is distribution, not authorship.

## ✅ The D2 constraint, stated so it cannot be misread

**No compile step on the author's side. Ever.** The entire proof this phase rests on is that a kit
needs no toolchain; a supported TypeScript route would reintroduce exactly what was removed and
create a second path to maintain. An author gets types the way a plain-JS author always has:

```js
/** @type {import('@nodegx/node-kit-types').ReactNodeDefinition} */
const MyNode = { name: 'mykit.Chip', /* … autocomplete from here … */ };
```

That gives autocomplete and inline errors in VS Code with **no `tsconfig`, no build, no
`node_modules` in the project**. It is also exactly what an agent needs: a resolvable type name it
can cite.

## What to build

1. **`@nodegx/node-kit-types`** — a no-build workspace package on the `@nodegx/render-measure`
   pattern: `types` in `package.json`, hand-written or generated `.d.ts`, nothing to compile.
2. **Content**: the visual definition (`ReactNodeDefinition` and its port shapes) and the logic-node
   definition. ⚠️ The logic half is **unverified** — CN-012 has not run yet. Ship the visual half
   complete; mark the logic half provisional in a comment rather than implying a guarantee this
   phase has not earned.
3. **Keep it honest about generated fields.** `ReactInputPropDefinition.set` and friends are
   *generated by the bridge onto the object the author wrote*. The source already marks these
   "Generated by this module. Authors do not write it." That distinction must survive into the
   published types, or authors will write `set` and be confused when it is overwritten.
4. **Drop what is dead.** `frame` is retained by DEBT-006 for third-party modules but nothing in the
   repo sets it and `useFrame` is always false. Publish it marked as such, or an author will build
   on a branch that never runs.
5. **A drift check.** The published `.d.ts` and `react-component-node.ts` must not diverge silently.
   Either generate one from the other, or add a test that fails when they disagree.

## Acceptance criteria

1. A project with **no** `node_modules` and **no** `tsconfig` gets autocomplete on a kit definition
   through the JSDoc annotation above. Verify in a real editor, not by inspecting the `.d.ts`.
2. Deleting a field from `ReactNodeDefinition` in the runtime makes the drift check fail.
3. The published types compile under `tsc --noEmit` in a fixture that imports them.
4. **Build the caller**: the cashflow kit — the only real kit that exists — annotated with the
   published type, and every error it surfaces either fixed in the kit or explained in the types.
   🔴 This repo is 5 for 5 on "building the caller finds the hole". A types package with no consumer
   is an assertion, not a deliverable.

## Traps

- ⚠️ **A `.d.ts` is a claim about the runtime, and claims go stale.** The reason `frame` and the
  generated-`set` cases matter is that a type that lies is worse than no type: it is believed.
- ⚠️ `@noodl/types` is shared with the **cloud runtime, which has neither React nor a DOM** — which
  is exactly why `react-component-node.ts` declares its types locally. Do not "tidy" these into
  `@noodl/types`; the separation is deliberate and documented.

## Out of scope

- The scaffold that uses these types (CN-006).
- Docs prose (CN-007) — though the types are what CN-007's examples must typecheck against.
