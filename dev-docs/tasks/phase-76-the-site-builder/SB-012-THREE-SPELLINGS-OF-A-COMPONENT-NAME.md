# SB-012 — Three spellings of "a component by name", three different answers

> 🔴 **PHASE 76 IS CLOSED. THIS TASK IS OPEN AND IS NOW OWNED BY PHASE 80 AS DEF-013.**
> Carried forward by reference on 2026-08-29 — this file keeps the measurements; phase 80
> keeps the schedule. See
> [phase 80's task list](../phase-80-the-defects-the-templates-found/TASKS.md).


**Status: ✅ FIXED at the PLAN door, s24 (2026-08-30). Re-driven first; the `create_component`
door is deliberately unchanged — see §6.**

Found while authoring SB-005's admin panel, which is the first thing this phase has built that has
**more than two pages that link to each other**. That is the whole of why it turned up now: a
one-page app never asks the question.

## 1. The measurement

A component can be named by another component in at least three ways. All three are "a reference to
a component", and the authoring door treats each of them differently — including at the *plan* door,
where two of them disagree about the same plan.

| spelling | example | resolved at `create_component`? | resolved against an **unapplied sibling** in one plan? |
|---|---|---|---|
| node **`type`** | `type: '/#__cloud__/site/ContactRecipient'` | ✅ blocking `unresolved-component-ref` | 🔴 **no — this cell was WRONG**, see §5.1 |
| `RouterNavigate.target` | `parameters: { target: '/Pages/Admin' }` | ✅ blocking `unresolved-navigation`, with a *did you mean* | 🔴 **no** |
| `For Each.template` | `parameters: { template: '/Admin/PageRow' }` | ✅ blocking `repeater-template-unresolved`, with the available names | 🔴 **no** (same path) |
| `RunTasks.taskTemplate` | `parameters: { taskTemplate: '/#__cloud__/site/SetSectionAccess' }` | 🔴 **not checked** — accepted `0/0/0` | n/a |

The last row is **SB-009**, already filed. The new finding is the middle two: they *are* checked,
which is welcome, but they are checked **only against what is already on disk**, while a node `type`
is checked against the plan's own unapplied operations as well.

> 🔴 **That last clause was wrong, and the s24 re-drive is what found it — see §5.1.** A node
> `type` resolved against a sibling that was **already staged**, which is the *sequential* case
> SB-004 §6 F6 actually measured. Against a sibling merely **declared** in the plan it failed
> exactly like the other two. All three spellings were broken on a cycle; the table said one of
> them was fine.

Measured s6, on a live server built from `src`, with two throwaway pages `Pages/A` and `Pages/B`
that navigate to each other, staged into one plan:

```
STAGE A → validation-failed: stage_plan_operation "Pages/A" rejected — nothing was staged.
  WARN [unresolved-navigation] /Pages/A › node go › port "target": navigates to "/Pages/B",
  which is not a component in this project.
    → did you mean `Set "target" to one of these component names: /App, /Card, /Pages/Home, /Pages/A.`?
STAGE B → the same, mirrored.
APPLY   → invalid-argument: Not every operation is staged. Nothing was written.
```

Note what the *did you mean* lists: `/Pages/A` is offered to `Pages/A` itself, and `/Pages/B` — which
is sitting unstaged in the same plan, three lines above — is not offered at all.

## 2. Why it matters, in one sentence

**An app whose pages link to each other cannot be authored in one pass by any door this server has.**

The dependency graph of a real admin panel has genuine cycles — SB-005's is
`PageRow → PageEditor → Admin → PageRow`, plus `Admin ⇄ ThemeEditor` — so no topological order
exists, and the plan door, which is the mechanism built for exactly this ("decide the component tree
FIRST"), does not close the gap. The agent's experience is a blocking rejection with a helpful
*did you mean* that names every component **except** the one it is about to write.

⚠️ This is not a data-loss bug and nothing ships broken because of it: the door fails **closed** and
says what is wrong. The cost is a wasted round-trip per cycle edge and an agent that has to work out
the two-pass trick for itself — and, less visibly, an agent that "fixes" the rejection by pointing
the button somewhere that does resolve.

## 3. The workaround SB-005 uses

Author every component with the unresolvable links **omitted**, in an order where each forward
reference resolves, then a second `update_component` (`set:`, full replacement) restores them. For
SB-005 that is six creates and two updates; the two updates are exactly the cycle-closing back
buttons. `noodl-mcp/tests/sb005Components.ts` carries it as a `deferred: string[]` field and a
`createPass()` helper, and `sb005AdminPanel.test.ts` grades it with a known-firing control — the
whole component, back-link and all, offered to the create door on an empty project, refused by code.

## 4. What a fix would have to decide, and why it is not obvious

Same disposition as SB-009 and SB-010: **the fix needs a corpus sweep, not an argument.**

- **Resolve against unapplied siblings** (make `target`/`template` behave like a node `type`) is the
  smallest change and fixes the plan door completely. It does nothing for `create_component`, which
  is the door an agent reaches for first and the one SB-005 actually used.
- **Downgrade to a warning** on the create door would let one pass through, and is the wrong trade:
  `repeater-template-unresolved` is one of SB-009's two *known-firing controls*, i.e. this project
  relies on it blocking, and a Repeater whose template resolves to nothing is silently empty at run
  time. A door that fails closed and names its own fix is the better half of this defect.
- **A `create_components` (plural) call**, validated as a set, is what actually matches the shape of
  the problem — an app is authored as a graph of components, not one at a time. It is also the
  largest change, and it overlaps the plan door's remit enough that shipping both needs a decision
  rather than an implementation.

🧭 Which of the three is Richard's call. The measurement above is what the call needs; nothing is
blocked on it, because the two-pass workaround is cheap and is now written down.

## 5. Session log

- **s6 (2026-08-26)** — measured while building SB-005. Two throwaway pages, one plan, both stages
  refused; the `create_component` half was found first, by the panel's own six components failing in
  every order tried. Recorded rather than fixed: SB-005 needed a workaround, not a core change, and
  the choice between the three fixes above is a product decision.

## 5.1 The re-drive — s24 (2026-08-30)

Richard's ruling was *re-drive before deciding*, because the door's component list had been rebuilt
from `authoredProjectViews` since the table was written and the row might have cost nothing.

**It did not.** `noodl-mcp/tests/def013SiblingResolution.test.ts` reproduces §1's transcript
character for character on a live in-process server built from `src` — including the *did you mean*
that offers `/Pages/A` to `Pages/A` itself and omits `/Pages/B`:

```
STAGE A → REFUSED  WARN [unresolved-navigation] /Pages/A › node a_go › port "target":
                   "go" navigates to "/Pages/B", which is not a component in this project.
                     → did you mean `… /App, /Card, /Pages/Home, /Pages/A.`?
STAGE B → REFUSED  (mirrored)
APPLY   → REFUSED  Not every operation is staged. Nothing was written.
```

**And the drive found more than the table held.** A fourth arm put a node-`type` cycle (`Widgets/D`
places `Widgets/E`, `E` places `D`) through the same door and it was refused too, with a blocking
`unresolved-component-ref`. The `✅ yes` in row 1 was never a statement about a cycle — it was
measured on a sibling that had already been staged. Corrected in the table above rather than
quietly.

**Why it read as fine.** `overlayProject` and `stagedOverlay` both build from `plan.staged` — the
candidates *submitted so far*. A plan's declared-but-unstaged operations were in neither. So the
door resolved a sibling exactly when the fan-out happened to reach it first, which no order does
when the dependency graph has a cycle.

## 6. The fix, and what it deliberately does not reach

**Option 1 of §4, as ruled**: the plan's own declared operations resolve as names.
`plannedComponentNames(plan)` (`planTools.ts`) returns every non-doc operation's legacy name, and it
is fed to both halves of the gate:

- the **semantic** half, through `overlayProject`'s `refNames` — this is what the node-`type` arm needs;
- the **precondition** half, through a new `alsoResolvable` argument on `preconditionDiagnostics`
  (`validate.ts`) — this is what `RouterNavigate.target` and `For Each.template` need.

🔴 **Names only, never as component *views*.** A planned component has no nodes yet, and adding it
to `views` would give it an *empty interface* rather than *no interface* — turning "unknown, do not
check" into "this component has no ports" for every instance of it. That is a false positive the
size of the fix.

✅ **Safe against a partial apply.** `apply_plan` re-validates every operation against
`applyPlanView`, whose `operations` list has the skipped ones removed — so a component left pointing
at a **skipped** sibling is refused at apply, with nothing written.

⚠️ **`create_component` is unchanged**, which is the ruling's named and accepted weakness: that door
has no plan in flight, so there is nothing to resolve against. `validate.ts`'s three other callers
pass no extra names, deliberately. **The two-pass workaround in §3 is still the answer there**, and
`sb005AdminPanel.test.ts` still grades it with its known-firing control.
🔴 **Option 2 (downgrade to a warning) stays ruled out permanently.**

### Specs and mutants

`def013SiblingResolution.test.ts` — 5 arms, all green; the full noodl-mcp suite **999/999**,
`tsc --noEmit` clean.

| mutant | arms it kills |
|---|---|
| M1 — precondition half reverted (`alsoResolvable` dropped) | THE MEASUREMENT · THE THIRD SPELLING |
| M2 — semantic half reverted (planned `refNames` dropped) | SCOPE (the node-`type` cycle) |
| M3 — over-permissive (names that were never planned) | CONTROL · CONTROL 2 |

🔴 **M2 survived its first run and the arm was the reason, not the fix.** SCOPE had been written as
an exploratory probe asserting `expect(typeof stageD.isError).toBe('boolean')` — a tautology. The
door refused and the arm still read green. It asserts the outcome now. *An arm that cannot fail is
not a gate*, and a surviving mutant is the only thing that says so.

⚠️ The first run of the whole drive had **every** arm "refused" — by argument-schema validation,
because the tool takes `plan_id`/`operation_id` and `fromId`/`toId`, not the camelCase I guessed.
Both controls were "passing" while the rule under test had never been reached. The controls now
assert the diagnostic **code** and the absence of `Input validation error`.
