# DEF-028 — what a build contains depended on when it was taken, not on what the project says

**Found by phase 77, filed as [D13](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d13).**
✅ **Closed s30 (2026-08-31).**

D13 sat open and `NONE`-owned for the whole of phase 77 and cost that phase **four sessions of
evidence pointing two ways** — s9, s12 and s14 read a symptom, s15 measured a fixture identical on
every static axis and recorded that it "did not reproduce". Both readings are what this mechanism
produces.

## 1. The person sentence

**Someone exports or deploys their project twice, changing nothing in between, and gets two
different apps.** Wires that are on the canvas are missing from one build and present in the other.
There is no error, no warning, and nothing in the artefact recording which one they got — so the
first thing they have to doubt is their own memory of what they built.

## 2. The mechanism — a verdict read from a clock

Three links, each read from the source rather than inferred:

1. **`exportComponent`** (`utils/exporter/util.ts`) drops every connection `getConnectionHealth`
   calls unhealthy.
2. **`getConnectionHealth`** (`NodeGraphModel.ts:662`) **reads no ports.** It asks `WarningsModel`
   whether a warning is recorded and returns `healthy: true` when none is — *which is also the
   answer when none has been evaluated yet.*
3. The warning it reads, `con-no-target-port`, is written by **`evaluateHealth`, which only ever
   ran on a debounce** (~2 s lazy, ~50 ms on FIX-007's urgent lane). Nothing forced that pass to
   settle before an export: no caller of `evaluateHealth()` existed in the deploy path, the
   viewer-bundle path or `ViewerConnection`.

So the filter asked a question whose answer depended on whether a timer had fired.

🔴 **This was never deploy-only, and the register undercounted it.** D13 recorded "one filter,
three callers". Measured this session: **eight `exportComponent` call sites across seven entry
points** — the viewer's component bundles (`editorapi.js:88`), incremental preview updates
(`ViewerConnection.ts:993`), the full export and deploy (`json.ts:107/159/178/217/224`,
`deployer.ts:108`), cloud functions (`cloudFunctions.ts:291`), and **two AI-authoring paths D13
never named** (`sandboxExport.ts:210`, `componentBench.ts:437`). A "works in preview" observation
is not a control for this.

`getConnectionHealth` itself has exactly **two** callers: this filter, and
`NodeGraphEditorConnection.ts:672`, which repaints a wire.

## 3. What was built

**`models/nodegraphmodel/NodeGraphModel.ts`** — `flushEvaluateHealth()`: cancel any pending
debounced pass, clear its bookkeeping, and run `evaluateHealth()` synchronously.

**`utils/exporter/util.ts`** — `exportComponent` calls it before reading any verdict.

### Two design choices that carry the fix

🔴 **The flush is unconditional, and that is the point.** The obvious cheaper version — *run the
pending pass if one is scheduled* — would be a **no-op in the window D13 is actually about.** A
freshly imported graph has never scheduled a pass at all, and that is exactly what a build taken
shortly after opening a project is made of. One of the four specs exists only to pin this case.

🔴 **The flush lives in the filter, not at the call sites.** With eight call sites, "remember to
settle health first" is a rule that gets broken by the ninth — and a caller that forgets is this
defect again, silently. Inside `exportComponent` every export path gets it by construction,
including paths not yet written.

⚠️ **Deliberately NOT inside `getConnectionHealth`.** Its other caller repaints once per wire per
frame; a synchronous graph-wide health pass there would be a performance defect traded for a
correctness one.

⚠️ **Cost.** One walk of the graph's nodes and connections — the same order as the export about to
walk them anyway — and `setWarning` coalesces its listeners through `scheduleNotifyChanged`, so it
does not fan out one notification per warning written.

⚠️ **It inherits `evaluateHealth`'s guards.** With the node library unloaded or the component's
module unregistered it is a no-op and the last recorded verdict stands. Those are states in which
a build should not be taken at all; this declines to invent an answer for them rather than making
them safe. **Named because a future session should not read the fix as stronger than it is.**

### The direction the fix settles in

A build now contains **what the editor would say about the project if you asked it** — the same
answer the canvas paints. That is a choice over "keep every wire": a wire onto a port that does not
exist cannot carry a value at runtime, so keeping it ships a graph the runtime cannot honour. The
alternative D13 offered — carry the health verdict *in* the artefact so a build says what it
dropped and why — is the larger change, and D13's own note that "the first is the smaller change
and the one that makes the second honest" is why this is the half built.

## 4. Acceptance criteria

- **AC1 — two builds of one project agree.** `exportComponent` taken before and after a settled
  health pass returns the same connections. ✅
- **AC2 — they agree in the settled direction.** The unresolvable wire is dropped and the good one
  kept, asserted **by wire name**, not by count. ✅
- **AC3 — a graph on which no pass was ever scheduled settles anyway.** ✅
- **AC4 — the floor does not move.** `test:ci` returns to exactly its known 4. ✅

## 5. The measurement

`tests/nodegraph/def-028-build-determinism.spec.ts`, registered in `tests/nodegraph/index.ts`
(a spec absent from that barrel never runs, and the barrel says so itself).

| run | seed | failures | reading |
| --- | --- | --- | --- |
| **unfixed** | 25387 | **7** | 4 AIX-006 floor (by name) + **3 DEF-028** |
| **fixed** | 19613 | **4** | 4 AIX-006 floor, **0 DEF-028** |

The decisive unfixed reading, in the real model at the real filter:

```
DEF-028 … exports the same connections before and after the health pass settles
    Expected $.length = 2 to equal 1.
    Unexpected $[1] = 'screenX->thisPortDoesNotExist' in array.
```

Two exports of one project, no edit between them, different contents. Different seeds across the
two runs, so this is not a pinned order.

### 🔴 What the first run caught in the spec itself

The first unfixed run mapped the wrong field names: `exportConnection` renames a wire from
`from/toProperty` on the graph to `source/targetPort` in the artefact, so the helper produced
`'undefined->undefined'` for every wire — and **AC3's `not.toContain(...)` passed vacuously**, on a
list of the wrong shape rather than on a wire that had been dropped.

✅ **An absence assertion needs a known-firing signal beside it.** The precondition now asserts
`toContain('image->image')` — a wire that survives in *both* directions, so it reads the same
before and after the fix and cannot itself hide a defect — which is what proves the helper can see
real wire names at all. AC3 was re-measured red before being made green.

## 6. What this does not cover — owed, with an owner

🔴 **A `level: 'warning'` wire is dropped exactly like an error one, and nothing grades it.**
`getWarnings` does not filter by level, so **any** warning key on a connection makes
`getConnectionHealth` return `healthy: false` and the filter drops the wire. That includes FB-021's
`con-target-port-gated`, whose own comment says the wire *"is valid and its value is ignored"* —
a different thing from the deleted port the red verdict is for.

This fix does not create that, but it **makes it deterministic**: a wire into a `basic`-gated port
now always leaves the build. Registered as **DEF-034**. `grep -a` puts `con-target-port-gated` in
exactly one file — its writer — so no spec anywhere grades it, and nothing ties it to the export.
⚠️ **Derived from source, blast radius unmeasured**: whether any shipped template actually wires
into a gated port is the open half, and FB-021 measured **328** `basic`-gated input ports on the
catalog against 21 `extended` ones, so the population is not small.

⚠️ **`SchemaHandler`'s second session-dependent input is untouched.** D13's other half:
`utils/schemahandler.ts:72` fetches the backend schema on **`window-focused`** and
`recordFieldPorts` mints one port per column, so *which ports exist* still depends on whether the
editor window happened to get focus with the backend up. This fix makes the export read a settled
verdict about **the ports that exist at that moment**; it does not make the port set itself a
function of the project. **A build taken with the schema cold still differs from one taken warm,
and this fix does not close that.** It is the smaller, static half that is now deterministic.
Registered as **DEF-035**.
