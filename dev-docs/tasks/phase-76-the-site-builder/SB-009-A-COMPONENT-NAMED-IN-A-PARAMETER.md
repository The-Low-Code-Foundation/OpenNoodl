# SB-009 — A component named in a parameter is named nowhere any gate looks

**Status: ⬜ OPEN — measured, not fixed.** Found while designing SB-004 (2026-08-26 s2), filed
rather than absorbed because the fix is wider than SB-004's scope: it touches twelve ports across
eight node types, two of them outside the backend story entirely.

Evidence: `packages/noodl-mcp/tests/sb004RunTasksTemplate.test.ts` — four arms, two of them
known-firing controls, run green s2.

## The defect

A component can be named two ways. As a **node type** (`/Card` as an instance) — gated. As the
value of a **`component`-typed parameter** (`Run Tasks`' `taskTemplate`, `Show Popup`'s `target`,
the seven `repeaterComponent` ports) — gated for exactly one of the thirteen such ports.

- `checkRepeaterTemplate` opens `if (node.type !== REPEATER_TYPE) continue`
  (`validation/repeaterTemplate.ts:186`; `REPEATER_TYPE = 'For Each'`, `:82`). Its two resolution
  codes reach the browser Repeater and nothing else.
- `checkRuntimeContext` (SB-001) walks node **types**. A parameter value is not one.
- `checkNavigation` covers `RouterNavigate`, `PageStackNavigate`, `PageStackNavigateToPath`
  (`navigation.ts:34-37`) — **not** `NavigationShowPopup` / `NavigationClosePopup`, whose targets
  *are* `component`-typed.
- `parameterValues.component` is `nameTypeFormat('component')` (`parameterValues.ts:369`): a check
  on the value's *shape*. Not existence, not runtime.

The editor's interactive door is safe — `componentpicker.ts:109-129` filters by runtime and excludes
cloud functions, so a human picking a template cannot make either mistake. The **authored** door,
which SB-001 brought to parity for node types, cannot make the check at all.

## Measured (s2)

Four arms through the real MCP `create_component`, against the `demo-app` fixture:

| arm | graph | result |
|---|---|---|
| **A — control, must fire** | cloud component containing a `Text` node | ✅ **rejected**, `wrong-runtime-node` |
| **B — twin, must fire** | browser `For Each`, `template: "/Components/NoSuchComponent"` | ✅ **rejected**, `repeater-template-unresolved` (with alternatives offered) |
| **C — probe** | cloud `Run Tasks`, `taskTemplate: "/#__cloud__/NoSuchHelper"` | 🔴 **accepted**, `0 errors / 0 warnings / 0 infos`, written to disk |
| **D — probe** | cloud `Run Tasks`, `taskTemplate: "/Card"` (a real **browser** component) | 🔴 **accepted**, `0/0/0`, written to disk |

A and B are there so the two clean results mean something: A excludes "the gate never ran on this
path", B excludes "nothing in this codebase checks templates". Both fired.

**The runtime consequence is the silent kind.** `Run Tasks` is the only iteration primitive the
cloud runtime has, so a function that does a thing per record does it here. Name a helper that does
not exist, or one the cloud runtime cannot register, and the graph validates perfectly clean, runs,
iterates over nothing, and reports success having done no work. For SB-004 that is `publishPage`
returning 200 having published no sections.

This is the tenth instance of the pattern in `a-gate-can-have-a-hole-shaped-like-the-defect`.

## The population (from the catalog, s2)

Thirteen `component`-typed input ports exist. One has an owner.

| node | port | runtimes | owned by |
|---|---|---|---|
| `For Each` | `template` | browser | ✅ `checkRepeaterTemplate` |
| `RunTasks` | `taskTemplate` | browser, cloud | — |
| `DbModel2` (Record), `SetDbModelProperties` (Update Record), `DeleteDbModelProperties`, `AddDbModelRelation`, `RemoveDbModelRelation`, `Model2` (Object), `SetModelProperties` | `repeaterComponent` | browser, cloud | — |
| `NavigationShowPopup` | `target` | browser | — |
| `NavigationClosePopup` | `targetComponent` | browser | — |
| `net.noodl.ParentComponentObject`, `net.noodl.SetParentComponentObjectProperties` | `targetComponent` | browser | — |

## The fix, designed

One new precondition check, `checkComponentRefParameters`, in the shared set
(`authoredPreconditionDiagnostics`, so the editor gate and the MCP keep parity — SB-001's rule).
Generic over the catalog rather than a list of node types, so port fourteen is covered on the day
it is added:

For each parameter whose catalog port type is `component`, with a value set and no wire on it:
- names a component the project does not have → **`component-parameter-unresolved`** (new code)
- names one whose runtime differs from the owning component's → **`wrong-runtime-node`** (reuse:
  identical concept, already blocking, already SB-001's for the instance case)

Three guards, each for a reason already learned here:

1. 🔴 **Skip the (`For Each`, `template`) pair.** It has a dedicated owner with better messages and
   the children logic; a second producer over the same population is
   `a-check-in-a-second-pipeline-is-a-duplicate-first` — counts double, suites stay green. The spec
   must **assert cardinality**: exactly one diagnostic for the `For Each` case, not two.
2. **Skip a node whose type the catalog does not know** — `checkParameterValues` already emits an
   `unknownTypeSkip` naming that node, and two notices for one fact is the thing CN-002 forbids.
3. **Skip a wired port** (`connectedInputs`), the convention every value check here follows.

## Open decision before this lands

⚠️ **Whether `component-parameter-unresolved` joins `AUTHORED_BLOCKING_WARNINGS` is not settled by
this file, and must not be settled by argument alone.** Every entry in that set cites a corpus
measurement (`InstanceUnknownParameter`: 58 hits in one merge fixture; `RepeaterTemplateUnresolved`:
2, both legacy). SB-001's reasoning applies — for a graph an agent just wrote there is no benign
reading of a name that resolves to nothing — but the twelve newly-covered ports have **never been
measured against a real corpus**, and `repeaterComponent` in particular is set on ordinary data
nodes across every real project. Run the corpus sweep first; promote on the number, not on the
sentence. The cross-runtime half needs no such decision: it reuses `wrong-runtime-node`, which is
already blocking, and a browser component in a cloud graph has no benign reading at any severity.

## Acceptance

1. Arms C and D of `sb004RunTasksTemplate.test.ts` invert: both rejected, C naming the missing
   component and D naming the runtime boundary. A and B still fire unchanged.
2. A `For Each` with a missing template yields **exactly one** diagnostic (cardinality asserted).
3. A wired `taskTemplate`, and a node of a type the catalog does not know, each yield nothing new.
4. `Show Popup` naming a missing component is reported — the check is generic, and this is the
   proof it did not quietly become a `RunTasks` special case.
5. Corpus sweep run and its numbers recorded here before any blocking promotion.
