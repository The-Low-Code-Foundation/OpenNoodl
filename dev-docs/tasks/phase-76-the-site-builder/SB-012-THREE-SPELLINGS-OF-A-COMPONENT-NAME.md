# SB-012 — Three spellings of "a component by name", three different answers

**Status: ⬜ MEASURED s6 (2026-08-26), worked around in SB-005, not fixed.**

Found while authoring SB-005's admin panel, which is the first thing this phase has built that has
**more than two pages that link to each other**. That is the whole of why it turned up now: a
one-page app never asks the question.

## 1. The measurement

A component can be named by another component in at least three ways. All three are "a reference to
a component", and the authoring door treats each of them differently — including at the *plan* door,
where two of them disagree about the same plan.

| spelling | example | resolved at `create_component`? | resolved against an **unapplied sibling** in one plan? |
|---|---|---|---|
| node **`type`** | `type: '/#__cloud__/site/ContactRecipient'` | ✅ blocking `unresolved-component-ref` | ✅ **yes** — SB-004 §6 F6 |
| `RouterNavigate.target` | `parameters: { target: '/Pages/Admin' }` | ✅ blocking `unresolved-navigation`, with a *did you mean* | 🔴 **no** |
| `For Each.template` | `parameters: { template: '/Admin/PageRow' }` | ✅ blocking `repeater-template-unresolved`, with the available names | 🔴 **no** (same path) |
| `RunTasks.taskTemplate` | `parameters: { taskTemplate: '/#__cloud__/site/SetSectionAccess' }` | 🔴 **not checked** — accepted `0/0/0` | n/a |

The last row is **SB-009**, already filed. The new finding is the middle two: they *are* checked,
which is welcome, but they are checked **only against what is already on disk**, while a node `type`
is checked against the plan's own unapplied operations as well.

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
