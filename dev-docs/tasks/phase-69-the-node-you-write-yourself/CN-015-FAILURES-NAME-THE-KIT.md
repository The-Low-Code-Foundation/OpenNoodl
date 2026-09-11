# CN-015 — Failures name the kit

> ## ✅ COMPLETE — s22 the headless/CLI half, s23 the editor half, **s28 the two surfaces both missed**.
>
> ### s28 — a failure now names the kit where the author is actually looking
>
> 🔴 **s23's "AC1 met" and s27's "AC1 not met" were both right, about different surfaces.** The kit
> **is** named — in **Settings → Kits**, which `KitsSection.tsx` renders from `kitDiagnostics`. It
> was **not** named in the two places an author is when a node stops rendering: the devtools
> console, and the exception that kills the viewer. s27 read those and recorded "not met"; nothing
> was broken that s23 built. **Reconciled by reading the code, not by picking a session to believe.**
>
> Three seams, all naming-only — **no behaviour moved**:
>
> 1. **`nodedefinition.ts`** — `Node must have a category` / `Node must have a name` now name the
>    node and the kit. 🔴 The data was always there: `registerModule` stamps `node.module` **before**
>    calling `registerNode`, and `opts.name` was literally the next check. A kit definition also gets
>    the consequence stated (*"the preview renders nothing at all"*), because nothing connected one
>    missing field to a blank app. ⚠️ A **built-in** gets the node name only — no kit, no kit advice.
> 2. **`registerModule`** — any throw under the registration loop is caught, prefixed with the kit
>    and the node (or its **index**, when the definition is the one missing its name), and
>    **rethrown**. This covers `setup` and `nodeRegister.register`, which `defineNode` does not.
> 3. **The capture preamble** (`@nodegx/module-inject`) — `console.error`s a line naming the kit
>    **and the file**, and carries the file into the captured record too. s27's exact complaint was
>    `SyntaxError: Unexpected identifier 'Noodl'` naming *"neither the kit nor the file"*; with four
>    kits installed that does not say which to open.
>
> ⚠️ **The blast radius is deliberately unchanged, and there is a test asserting so.** One bad
> definition still aborts its module and still takes the viewer down. Making it cost only its own
> node trades a loud dead app for a quietly missing one — **a ruling, not a naming fix**, so it is
> queued rather than decided here (RULINGS-OPEN-QUEUE #14).
>
> **Tests: module-inject 21 → 27, runtime +12. 8/8 mutants killed** (4 per side, each restored and
> re-run green). 🔴 **The six new module-inject tests EXECUTE the preamble** against a fake `window`
> rather than string-matching it — the existing block's own comment concedes that *"a string
> assertion cannot show that an event fires"*, so the guard had no gate.
>
> ⚠️ **`expected-inject.snapshot.txt` was re-recorded deliberately.** The diff is exactly the
> preamble, in both `pathPrefix` sections, and nothing else — checked against `git show HEAD:` before
> writing. Behaviour that moved: the injected page now names the kit and the file on the console when
> a kit fails to load.
>
> ✅ **`test:ci` came back 2849 / 10 against a recorded floor of 2843 / 6, and it was A/B'd rather
> than argued.** s28's four files were reverted to `HEAD` and the same suite re-run at the same seed:
> **identical failure set, by name — delta zero.** The ten (4 × `AIX-006 style vocabulary`,
> 2 × `AI model registry`, 1 × `AIX-011`, 3 × `SUB-011`) are pre-existing and the recorded floor is
> simply **stale**. ⚠️ A count alone would not have settled it; the comparison had to be by name.
> ✅ **The injector golden RAN and PASSED in both runs** — that, not the totals, is what cleared the
> capture-preamble change.
>
> 🔴 **What this does NOT do: the shipped viewer bundle is not the repaired one.** The editor runs
> `src/external/viewer/noodl.viewer.js`, a **built** artifact carrying the old messages. A drive on a
> stack that has not rebuilt the viewer will read the old anonymous text and look like the change did
> not land.

> ## ✅ COMPLETE 2026-08-18 — s22 built the headless/CLI half, s23 the editor half.
>
> ### s23 — AC1's editor half, built and driven
>
> **All five acceptance criteria are now met.** The editor can tell *"this kit threw"* from
> *"this kit is not installed"*, which it could not before: it reads the payload a viewer sent
> (✅ D3), and a kit that threw was simply absent from it.
>
> 🔴 **The fact had to be caught in the page, because nowhere downstream still has it.** A kit whose
> `index.js` throws never calls `Noodl.defineModule`, so `registerModule` is never called, nothing
> lands in the register, and no later inspection of any process can distinguish it from a kit nobody
> installed. `@nodegx/module-inject` now emits a capture preamble before the first kit script and
> closes it after the last; `NoodlRuntime.getNodeLibrary` stamps what it caught onto the payload
> (as `projectsettings` already was); `NodeLibraryImporter` holds it per client; `KitsSection`
> renders `kitDiagnostics`' own words.
>
> ✅ **Measured in real Chromium, not assumed** — all three failure modes, attributed by the CN-003
> marker: a `throw` at import, a syntax error, and an `index.js` that 404s.
>
> 🔴 **`capture: true` on the listener is load-bearing, and the A/B proves it.** A resource error
> does not bubble, so in bubble phase the 404 case vanishes and **only** that case — measured both
> ways in Chromium against the injector's real output. A missing `main` would otherwise have stayed
> exactly the silent failure this task exists to end.
>
> ⚠️ **Attribution is bounded by a second flag, not by clearing `__noodl_module_name`.** Clearing
> would also have bounded it — and would have broken CN-003 for a kit that defers its `defineModule`
> into a callback, the case that mechanism's own comment calls out. Without any bound, the *last*
> kit is blamed for every runtime error the app throws afterwards.
>
> 🔴 **The failures are held per client, NOT merged into `currentNodeLibrary`.** `mergeUpdates` walks
> `nodetypes` and nothing else, so a top-level field arriving on a *second* import is silently
> ignored — the list would have frozen at the first client's report and gone on accusing a kit the
> author had already fixed. **Driven live:** with one kit repaired and one left broken in the same
> project, the panel showed the repaired kit's node and went on naming the other.
>
> ⚠️ **Scope, stated rather than left to be discovered:** a kit's own `main`, not its dependencies.
> Dependency tags are deduped across kits and carry no marker, so a failing dependency has no one kit
> to name — it stays uncaptured rather than attributed to a guess.
>
> ⚠️ **The `expected-inject.snapshot.txt` golden was re-recorded deliberately.** It matched on
> committed code and went red only from this change (checked both ways before rewriting); the diff is
> exactly the preamble and the epilogue. Behaviour that moved: the injected page now opens and closes
> a kit-load capture window around the module scripts.
>
> **Tests: module-inject 15 → 21, runtime +5, editor `tests-unit/cn-015` +7. 6/6 mutations killed,
> plus the capture-phase A/B in Chromium.**
>
> ### s22 — the headless/CLI half
>
> `kitDiagnostics` / `formatKitDiagnostic` in `@nodegx/kit-catalog` (`src/health.js`), wired into
> `scripts/validate-project.ts`. **55 tests in the package (38 → 55), 8/8 mutations killed**, and
> driven end to end against a fixture project carrying a deliberately broken kit, a silent kit and a
> shadowing kit — all four diagnostics fire, and **the same project with the faults removed produces
> zero**, which is AC5 measured rather than argued.
>
> **Status after s22: AC3 ✅ · AC4 ✅ · AC5 ✅ · AC2 ✅ (already covered — see below) · AC1 ◐ CLI only.**
> (AC1 closed by s23.)
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
> ⚠️ **AC1's editor half was left open by s22 — s23 built it (above).** The MCP/headless route already
> captured `failures` before this task (`entry.js:124-152`, with a comment naming CN-015) and the CLI
> reports them. What s22 could not do was tell the *editor*: it reads a payload the viewer sent
> (✅ D3), and a kit that threw is simply absent from it. `kitDiagnostics` already took
> `assumeLoaded: false` for exactly that caller, so the zero-node check is **skipped rather than
> guessed** — CN-006b's `joinKitNodes` keeps "installed, not yet loaded" apart from "0 nodes"
> deliberately, and s23 did not collapse them.


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
