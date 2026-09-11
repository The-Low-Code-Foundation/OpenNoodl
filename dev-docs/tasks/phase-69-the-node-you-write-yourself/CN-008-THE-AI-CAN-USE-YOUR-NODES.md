# CN-008 — The AI can use your nodes

| Field | Value |
|---|---|
| **Tier** | 3 |
| **Effort** | M |
| **Surface** | `editor` (`AiAssistant`, prompts) |
| **Rulings** | ✅ **D7** — "this project", not "the shelf" |
| **Depends on** | CN-003 |

> ## ✅ BUILT 2026-08-17 (s16) — AC2–AC5 met, **AC1 needs a live model**
>
> `AuthoringContextBuilder.nodeKitOverview()`, a `THIS PROJECT'S NODE KITS` block in the
> cache-stable half immediately after the catalog, wired at both `AuthoringSession` call sites.
> **17 tests, all seven mutations killed.** Editor suite **3555 passed / 229 suites**.
>
> 🔴 **Two of this task's own clauses were false, and the second would have shipped a feature that
> passed every mechanical criterion while handing the model nothing.** Both are now pinned as tests
> under `the premises this task was written on`, so re-introducing either fails:
>
> | The spec said | Measured, before building |
> |---|---|
> | *"the AI does not know the lane exists"* | **It does.** A kit node is `inNodePicker`, so `catalogOverview()` already names `demo.kit.Badge`/`demo.kit.Meter`, and `nodeTypeDetails()` already renders their full ports, defaults and descriptions. What was missing is **attribution and salience**, not existence — see below. |
> | *"the ports an instance would actually set — **the inputs with no default**"* | **That selector matches ZERO ports** on either kit in this phase. A kit author declares a `default` on essentially every port, and ✅ **D8** pushes them harder that way. Following it literally prints a kit name and a node name per node with an **empty list** under each — while `charge()` reports a cost, the block lands in the stable half, and AC2/AC3/AC4 all pass. |
> | *"the `docs` string authors already write"* (s15's finding) | False a **third** way, beyond s15's. See "one field, two vocabularies" below. |
>
> ### What was actually missing
>
> A kit node arrived buried in an alphabetical run of ~30 names on the `- Visual:` line of the
> catalog block, with **no kit named anywhere in the prompt**, no display name, and nothing saying
> the user wrote it for this project. So the handout is about **salience and attribution**, and
> deliberately *names* ports rather than describing them — duplicating what `get_node_types` already
> answers correctly for kit types would be paying twice for the half that was never broken.
>
> ### 🔴 One field, two vocabularies: `docs`
>
> On a **shipped** catalog node `docs` is a **URL** — 158 of 175 built-ins carry one and **158 of 158
> of those are `https://docs.noodl.net/…`; zero are prose**. On a **kit** node it is prose, because
> that is what the runtime's definition shape means by it. Reading the field without splitting the
> two would have put a docs.noodl.net link where a summary goes on 158 node types. Callers gate on
> provenance, and `kitDocs` rejects a URL anyway so a caller that forgets cannot emit one.
>
> ✅ **A real defect fixed on the way past:** `renderNodeType` sourced its summary from
> `enrichedNode()`, a catalog generated at repo-build time and keyed by type name — so **a kit type
> can never have one**. The kit author's `docs` string was carried all the way into the overlay by
> `@nodegx/kit-catalog` and then dropped, and every kit node reached the model with a heading, a
> placement line and no statement of what it is for. Now falls back to `kitDocs`, kit types only.
>
> ### The inherited-port exclusion, and why it is a named set
>
> Subtracting the ports `react-component-node.ts` puts on *every* kit node
> (`cssClassName`/`styleCss`/`mounted`/`variant`, and eight outputs) takes `demo.kit.Badge` from
> 12 inputs and 9 outputs to **the 8 and 1 its author declared**.
>
> 🔴 **It is not derived, because both obvious derivations are wrong.** An intersection over the
> shipped catalog's visual nodes is the **empty set** — `Component Children` is a visual node with
> zero inputs and empties it. An intersection over the *project's own* kit nodes also swallows
> `radius`, which both demo-kit authors declared and both meant. ⚠️ The gate asserts **containment**
> (every base name present on every kit node in the recorded payload), which catches the runtime
> *dropping* one; it cannot catch the runtime *adding* one.
>
> ### Budget, measured
>
> | Shape | Chars | ≈ tokens |
> |---|---|---|
> | Fixed preamble | 383 | ~96 |
> | Marginal per node (8 author ports) | 261 | ~65 |
> | Demo kit (2 nodes) — real | 934 | ~234 |
> | Cashflow-shaped (5 nodes × 12 ports) | 2,217 | ~554 |
> | 40-node kit, at the `MAX_KIT_NODES = 30` cap | 8,869 | ~2,217 |
>
> Against `DEFAULT_BUDGET.maxChars` of 120,000 the worst case is ~7%, in the **cached** half.
> ⚠️ This is the *context* budget, not the 8,280-token MCP tool-surface bar — that one is CN-009's
> and this task spends none of it. Overflow past the cap is **stated in the text**: a silently short
> list of a project's own nodes is indistinguishable from a project that does not have them, which
> is the failure this handout exists to fix.
>
> ### ⚠️ Still open
>
> - **AC1 is the consequence and is NOT met.** It needs a live model in a project with the cashflow
>   kit, and the task's own trap applies: the Build composer authors on a one-character prompt and
>   `ed.undo()` does not undo an AI apply, so `cp -R` the project first. Everything asserted here is
>   mechanism, and mechanism is exactly what AC1 says would also be true of a broken feature.
> - **A session captures its catalog at construction.** A kit scaffolded mid-session is not in that
>   session's handout. That is CN-014's measured behaviour (no watcher delivers a mid-session kit; a
>   viewer reload is necessary *and* sufficient), not a new defect — but the task's debounce trap
>   asked about it, so it is answered rather than left open.
> - **The scaffold still emits no `docs` key**, so a scaffolded node has no purpose line here and its
>   picker preview reads *"No documentation yet."* Absent is therefore the **common** case, rendered
>   as omission rather than as an empty sentence. Making CN-006's scaffold emit one is the P2-shaped
>   fix and is left to that task.

## The problem

> 🔴 **Measured false in s16 — kept for the record, corrected above.** The AI *could* see the type
> name and fetch its full ports; what it could not do was tell a kit node from a built-in, or name
> the kit.

The built-in authoring loop composes from the catalog, so it composes from **built-ins only**. A user
who has just built a `Cashflow Lane` and asks the AI to "add another row" gets a `Group` and a
`Text`, because the AI does not know the lane exists. The user's own best building blocks are the
ones it cannot see.

There is already a precedent for exactly this shape: ERG-002 added
`AuthoringContextBuilder.libraryOverview()` — one line per registered UMD library naming its global,
threaded through `AuthoringSessionOptions` → the builder → `initialUserMessage` /
`updateUserMessage` → `referenceBlocks`'s **stable (cache-prefix) half** in `prompts/authoring.ts`.

## What to build

`nodeKitOverview()` beside it, listing the project's kit node types with their ports.

✅ **Follow `libraryOverview`'s conventions exactly** — this is a well-trodden path and deviating from
it costs more than it gains:

- the `charge()` accounting, so the cost is visible rather than discovered later;
- **absent means omitted** — a project with no kits adds *nothing*, not an empty section. 🔴 An
  omitted context section reads as a claim: a heading with nothing under it tells the model "there
  are no custom nodes here" in a way that silently becomes "and there never can be";
- placement in the **stable half** of `referenceBlocks`, so it participates in prompt caching. Kits
  change rarely; putting them in the volatile half wastes the cache on every turn.

## What to include per node, and what to leave out

The tension is that a kit can be large — the cashflow kit's five nodes carry ~60 ports between them,
and a naive dump would swamp the prompt.

- **Include**: type name, display name, what it is for (the `docs` string authors already write), and
  the ports an instance would actually set — ~~the inputs with no default~~ 🔴 **matches zero ports;
  the discriminator is the runtime-added base set — see the outcome block above** — plus signals out.
- **Exclude**: the inherited visual ports. Every visual node has `Width`/`Height`/margins; repeating
  them per kit node is pure cost, and the model already knows them from the built-in vocabulary.
- **Budget it explicitly.** State the per-node and per-project token cost in the task's own notes,
  and decide a cap before a user with a 40-node kit finds one for us.

## Acceptance criteria

1. In a project with the cashflow kit, asking the AI for another cashflow row produces a graph using
   **`Cashflow Lane` + `Money Pill`**, not a hand-rolled `Group`. 🔴 This is the consequence; "the
   handout appears in the prompt" is the mechanism and would be equally true of a broken feature.
2. A project with no kits produces a prompt **byte-identical** to today's.
3. The handout sits in the cache-stable half — verified by inspecting the assembled prompt, not by
   intent.
4. Cost is reported through `charge()` like every other handout.
5. Tests run headlessly. `AuthoringContextBuilder` and the prompt builders are pure by design and
   ERG-002's four tests already prove the pattern — no Electron, no `ProjectModel`.

## Traps

- ⚠️ **The Build composer authors on a one-character prompt**, and `ed.undo()` does not undo an AI
  apply. Any live drive of this task must `cp -R` the project first.
- ⚠️ **A debounce boolean swallows the urgent request** — the recorded failure mode in this area.
  Kits changing mid-session (a scaffold, an install) must invalidate the handout without being
  coalesced away.
