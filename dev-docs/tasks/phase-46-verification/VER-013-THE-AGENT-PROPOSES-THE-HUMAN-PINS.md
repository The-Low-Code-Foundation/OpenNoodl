# VER-013 — The agent proposes the states; the human pins the truth

**Status:** 📋 specced, not started · **Est. 3 d** · depends on **VER-009**, **VER-010**, and folds
into **VER-007**'s MCP surface rather than adding one

> Richard, 2026-08-09: *"The AI can help you make a test? Or maybe just knowing the nodes is enough
> to help suggest what test to make? Or both?"*

**Both, and the split between them is the whole design.** The agent is good at the question *"which
states should this component survive?"* and structurally unable to answer *"is this output correct?"*
The task exists to keep those apart.

## Why the split is not a style preference

An AI that authors a component and then authors the assertion that blesses it has proved one thing:
the graph does what the graph does. If the component quietly renders the literal word `Text` four
times — a real, measured phase-55 outcome — the AI-written expectation pins four `Text`s and the
suite goes green forever on a broken component. The test has laundered the defect.

The value of a test is the difference between *what the thing does* and *what you wanted*. Only the
person who wanted something can supply that. So:

| | Agent | Human |
|---|---|---|
| Which states are worth having (`Empty`, `Loaded`, `Long name`, `Error`, `Narrow`) | ✅ proposes | approves / edits |
| The input values for each state | ✅ proposes | edits freely |
| **The expected outputs** | ❌ never | ✅ **pins, by looking** (VER-009 §4) |

The agent gets the tedious half — enumerating the states, filling plausible values, remembering the
80-character-name case nobody thinks of — and the human gets the half that carries the meaning, which
is one click per row rather than a file to write.

## Why the agent is unusually good at the first column here

It is not guessing from a name. It can read the component's **declared interface** and its **graph**:

- `getPorts()` gives every input, its type and its default
  ([componentmodel.ts:91](../../../packages/noodl-editor/src/editor/src/models/componentmodel.ts#L91));
- the graph shows which inputs feed a condition, so the branches are enumerable rather than imagined;
- `explain_component` and `get_component` already exist on the MCP surface.

A `Card` with `title`, `imageUrl`, `badgeCount` and an `onSelect` output has an obvious and
*derivable* state set: all set, none set, `badgeCount: 0` versus `99`, a title long enough to wrap.
That is a list a code-side tool would have to infer from types alone; here the boundaries are in the
graph.

⚠️ **The proposal must be inputs-only and must say so in its own output.** A response that includes an
`expect` block — even a helpful one — invites a human to accept it wholesale, which reintroduces
exactly the circularity above. The refusal is in the tool contract, not in a prompt.

## The surface — and the budget it has to fit in

⚠️ **The MCP surface already costs ~27k tokens per turn**, and `get_node_type` on `Group` alone is
~11k. Adding tools is not free, and a new tool per idea is how that number got where it is.

So this task adds **no new tools**. It extends VER-007's three:

| VER-007 tool | What VER-013 adds |
|---|---|
| `run_tests` | Accepts component scenarios, not just function cases. Same report shape |
| `get_test_failures` | Returns component/scenario/port and the observed-vs-expected pair |
| `record_case` | Gains a component mode: **propose scenarios** (name + inputs), returned for approval, **never written with an `expect`** |

⚠️ **Measure the added cost on the wire, pretty-printed.** Measuring the payload object rather than
the serialised text halves every figure — that mistake is already recorded against this repo's MCP
measurements. Record the real per-turn delta in this file before the task is called done.

## The loop this closes

Phase 46's fourth exit criterion is *"an agent makes a change, runs the tests, sees a failure, and
fixes it without a human in the loop."* VER-007 delivers that for cloud functions. This task delivers
it for components, which is where most of a NodeGX project actually lives.

The honest boundary: the agent can only close that loop against expectations **a human pinned**. An
agent working on a component with no pinned scenarios is exactly as unverified as it is today, and
the tool should say so rather than inventing a baseline — *"3 of 14 components in the blast radius
have pinned scenarios"* is a useful sentence and a truthful one.

## Not in scope

- **An agent pinning expectations**, under any flag or any "the user said it was fine" framing. The
  whole task is this line.
- **Auto-generating scenarios on component creation.** Proposals are requested, not emitted. A build
  that silently attaches six scenarios to every new component produces a coverage number that means
  nothing and a review nobody reads.
- **The agent editing an existing scenario's pinned values.** It may propose a *new* scenario; it may
  not quietly move a goalpost a human set. ⚠️ This is the one that will be requested — "the
  expectation is out of date, let me update it" — and it converts the suite into a record of what the
  code does. Refuse it here so the refusal is written down before it is asked for.

## Acceptance

- [ ] `record_case` in component mode returns proposals containing `name` and `inputs` and **no
      `expect`**, asserted by a spec, not by a prompt.
- [ ] Proposals for a component with a conditional input include both sides of the condition.
- [ ] `run_tests` reports component scenarios with the same verdict vocabulary as function cases —
      one dialect, per VER-009.
- [ ] `get_test_failures` returns observed and expected, so an agent can act without a second call.
- [ ] The per-turn token delta of the extended tools is **measured on the wire** and recorded here.
- [ ] **Live, and this is the phase's exit criterion 4 for components:** an agent changes a
      component, runs the tests, sees a human-pinned scenario fail, fixes it, and re-runs green —
      with no human in the loop for the middle three steps.

## Risks

| Risk | Mitigation |
|---|---|
| The agent's expectations get accepted as truth | Tool contract cannot emit `expect`; enforced by spec |
| The MCP surface grows again | No new tools; measured delta on the wire is an acceptance criterion |
| Proposals become noise | Requested, never automatic; returned for approval, never written |
| Agents "fix" tests instead of components | Editing a pinned value is out of scope and refused, by design |
