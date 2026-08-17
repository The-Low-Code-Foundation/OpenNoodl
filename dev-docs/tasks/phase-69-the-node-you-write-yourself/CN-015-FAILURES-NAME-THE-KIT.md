# CN-015 — Failures name the kit

> ## ✅ Built 2026-08-18 (s22) — the headless/CLI half. AC1's editor half is open.
>
> `kitDiagnostics` / `formatKitDiagnostic` in `@nodegx/kit-catalog` (`src/health.js`), wired into
> `scripts/validate-project.ts`. **55 tests in the package (38 → 55), 8/8 mutations killed**, and
> driven end to end against a fixture project carrying a deliberately broken kit, a silent kit and a
> shadowing kit — all four diagnostics fire, and **the same project with the faults removed produces
> zero**, which is AC5 measured rather than argued.
>
> **Status: AC3 ✅ · AC4 ✅ · AC5 ✅ · AC2 ✅ (already covered — see below) · AC1 ◐ CLI only.**
>
> 🔴 **The headline finding, and it is bigger than this task: precedence is two rules that
> disagree.** The catalog gives the **built-in** priority (the kit's node is dropped, a collision
> recorded). The **runtime gives the kit priority** — `NodeRegister.register` is an unguarded
> assignment and `viewer.jsx` registers built-ins *before* module nodes, so `createNode` returns the
> kit's constructor. **Measured with a probe that asserted the built-in so the failure would print
> the truth.** The consequence is the worst of both: **validation checks the built-in's ports while
> the app runs the kit's code.** And the message that shipped said the opposite — *"The built-in
> wins; the kit's node is not available"* — so anyone who trusted it debugged the wrong node. The
> wording is corrected and a regression test forbids it drifting back. ⚠️ **Whether the runtime
> should change so built-ins win everywhere is a ruling, not a tidy-up** — see the handover.
>
> 🔴 **AC2 needed no code, and finding that out cost a wrong probe.** The spec is right that
> `createNodeFromReactComponent` has no guard on `name`, and a probe calling `NodeRegister.register`
> **directly** did register a nameless definition under the literal key `'undefined'`. **That probe
> skipped a layer.** A kit always goes `registerModule` → `registerNode` → `NodeDefinition.defineNode`,
> which **throws `'Node must have a name'`** (`nodedefinition.ts:252-254`), and the extractor already
> catches it. So a nameless node in a real kit is *already* reported — a separate check could never
> fire, and this task's own trap list forbids shipping one. **The dead diagnostic was written, then
> deleted when the fixture proved it unreachable.**
>
> ⚠️ **What that fixture found instead is worse and is now reported:** the throw happens
> *mid-module*, so `registerModule`'s loop leaves the kit **half-registered** — nodes before the bad
> definition are live, everything after is silently gone. Observed live (a kit produced *both* a load
> failure *and* a collision for a node that must therefore have registered). `kit-load-failed` now
> carries a `partial` flag and says *"only PARTIALLY registered"* rather than the flat
> *"none of its nodes are available"*, **which was an over-claim in my own first draft** — the same
> class of false statement this task exists to remove.
>
> 🔴 **AC4's "three known-zero shipped modules" is a list that does not exist.** LBR-006 asserts it
> and **names none of the three**. A census of all 29 shipped modules was run instead
> ([notes/cn-015-premise-census.md](notes/cn-015-premise-census.md)): **15 register ≥1 node, 1
> registers zero** (`form-validation/noodl-validation-module` — AC4's real known-broken input), **5
> are unmeasured** because they need a browser the harness lacks, and 7 have no `main` and register
> zero by design. ⚠️ **The census itself lied twice before it was right** — without `window.React` 9
> healthy modules read as broken, and collecting only `defineModule` missed `defineNode` entirely.
> **`asked − answered = absent`: one zero-node module is confirmed, the other two are NOT disproven.**
>
> ⚠️ **AC1's editor half is not built.** The MCP/headless route already captured `failures` before
> this task (`entry.js:124-152`, with a comment naming CN-015); the CLI now reports them. **The
> editor still cannot tell "this kit threw" from "this kit is not installed"** — it reads a payload
> the viewer sent (✅ D3), and a kit that threw is simply absent from it. That is the remaining work,
> and `kitDiagnostics` takes `assumeLoaded: false` for exactly that caller, so the zero-node check is
> **skipped rather than guessed** (CN-006b's `joinKitNodes` keeps "installed, not yet loaded" apart
> from "0 nodes" deliberately, and this must not collapse them).


| Field | Value |
|---|---|
| **Tier** | 5 |
| **Effort** | S/M |
| **Surface** | `runtime`, `editor` |
| **Rulings** | — |
| **Depends on** | CN-003 (collision detection needs the overlay) |

## The promise that already exists, and where it stops

`projectmodules.ts` opens with an explicit contract:

> *"**Loud, never silent**: a manifest that cannot be read or parsed is skipped from the output *with
> a console warning naming the module*, and one that parses but fails the schema is kept
> (best-effort, to never regress a working project) *with a warning naming the module*. Nothing is
> dropped in silence."*

That promise covers the **manifest**. It stops before the thing most likely to go wrong: the
**definitions**. This task extends the same guarantee one layer down.

## The failures to cover

1. **The kit throws at load.** `index.js` runs as a plain script; a syntax error or a throw at import
   time currently produces… something, in a console nobody is watching. The node simply never
   appears. 🔴 **A missing node reads as "I typed the type wrong", so the author debugs the wrong
   thing.**
2. **A malformed definition.** No `name`, no `getReactComponent`, a port with an unknown `type`
   string. `createNodeFromReactComponent` will do *something*; the author should be told what.
3. **A type-name collision.** Two kits claiming `mykit.Chip`, or a kit shadowing a built-in.
   CN-003 gives built-ins precedence; this task makes the shadowing **visible** rather than a silent
   override. A kit that quietly replaces `Group` would be both a bug and a security surface.
4. **A kit that registers nothing.** P65 / LBR-006 found **three shipped modules that register zero
   nodes**. Today that is indistinguishable from success.

## What to build

For each: an error that names the **kit**, the **node** where applicable, and what to do about it —
surfaced where the author is looking. That means the editor (kits list, CN-006b) and the validation
diagnostics, not only `console.warn`.

⚠️ Match the existing severity philosophy rather than inventing one: `diagnostics.ts` already
distinguishes *definitely wrong* (error), *probably wrong* (warning), and *a check deliberately not
performed* (info). A kit that throws is an **error**; a kit registering zero nodes is a **warning**
(it might be an iconset); a shadowed built-in is an **error**, because the consequence is a node
behaving unlike its name.

## Acceptance criteria

1. A kit with a deliberate syntax error produces a message naming the kit and the failure, visible in
   the editor without opening devtools.
2. A kit registering a definition with no `name` is reported, not silently dropped.
3. Two kits colliding on a type name are reported, and the resolution is documented and
   deterministic.
4. A kit registering zero nodes is reported. Run this against the three known-zero shipped modules —
   they are a **known-broken input**, which is exactly what a new probe needs.
5. Nothing here fires for a healthy kit. 🔴 Run against a **known-good** kit too: a check that only
   ever passes on good input has not been shown to work, and one that fires on good input is worse
   than nothing.

## Traps

- ⚠️ **A "10000 listeners" flood is normal** in this codebase — do not treat console noise as
  evidence a kit is broken.
- ⚠️ **`forEachNode` stops on a truthy return.** If collision detection walks the graph, an early
  truthy return will silently stop the walk and under-report.
- 🔴 **A behavioural guard can be decoration.** Assert that the error *fires*, on a fixture built to
  trigger it. A guard nobody has seen fail is a guard nobody has seen.
