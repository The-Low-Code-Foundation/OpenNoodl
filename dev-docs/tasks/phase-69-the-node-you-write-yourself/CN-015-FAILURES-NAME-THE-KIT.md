# CN-015 — Failures name the kit

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
