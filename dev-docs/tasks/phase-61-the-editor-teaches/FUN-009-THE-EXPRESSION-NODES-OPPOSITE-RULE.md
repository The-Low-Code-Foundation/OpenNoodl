# FUN-009 — The Expression node's opposite rule

**Status:** 📋 open · **Track: the sibling** · small, and it explains the original mistake

## Why the user's guess was reasonable

The Expression node's rule is the **inverse** of the Function node's:

```
Expression:  a + b          →  bare identifiers ARE the inputs
Function:    Inputs.a + Inputs.b  →  bare identifiers are undefined variables
```

`parsePorts` extracts every identifier in the expression text and the setter diffs them against the
current inputs, adding and removing ports to match
([`expression.ts:399-404`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts),
regex at [`:724-726`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts)). The
port description says so: *"every identifier in it becomes an input port"*
([`:393`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts)).

So a user who has met an Expression first and then opens a Function is **transferring a rule that was
true five minutes ago**. `var Output_1 = Input_1` is not ignorance of NodeGX; it is correct
generalisation from the sibling node. Two nodes in the same `category: 'CustomCode'` have opposite
scoping rules and neither says so.

That is worth stating in the phase, because it changes what "onboarding" means here: the fix is not
teaching a notation, it is **marking a boundary**.

## §1 — One line, in the Expression editor

FUN-006's bar, in the Expression mode, with the rule that applies here:

> *"Every name you use here becomes an input port on this node."*

And when the expression currently references names, the honest second half — which is the thing that
actually confuses people about this node:

> *"`price`, `quantity` → 2 input ports."*

⚠️ The removal half matters more than the addition half. Deleting a name from the expression
**deletes the port**, along with whatever was wired to it — `inputsToRemove` at
[`:404`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts). Editing text destroys
a connection, which is not a thing text editors usually do. The bar should say so in the state where
it is about to happen.

## §2 — What completion offers here

`Objects.`, `Arrays.` and `Variables.` are available in an Expression and come from the project
context that already exists — `variables`, `objects`, `arrays` on `CodeAuthoringContext`
([`authoringContext.ts`](../../../packages/noodl-core-ui/src/components/code-editor/authoringContext.ts)).
Verify these fire in expression mode; the registry is populated for the whole editor but the
completion sources are registered per mode.

⚠️ **Bare identifiers must not be completed from anything.** Offering a name here would create a port
named after a suggestion the user did not mean — the destructive inverse of FUN-008, and the reason
that task is gated on mode.

## §3 — What this task must not do

- **No `no-undef`.** Off for expressions on purpose, and turning it on underlines every input the
  author just created ([`esLintDiagnostics.ts:26-32`](../../../packages/noodl-core-ui/src/components/code-editor/utils/esLintDiagnostics.ts)).
- **No seed.** FUN-002 does not apply: any seeded identifier would silently create ports on a node
  the user has not begun.
- **No rail.** FUN-005 has nothing to list — the ports are the words on screen.
- ⚠️ **No suggestion that the two nodes work the same way.** If the copy here and the copy in the
  Function editor are written to sound consistent, they will be describing two different rules in one
  voice, which is how this confusion started.

## §4 — The cross-reference worth making

Phase 59's LGC-001 writes the picker copy that chooses between Expression, Function and Visual
Function. **The one-sentence rule for each node is the same sentence both phases need.** Write it
once in FUN-001's module and have LGC-001 cite it, rather than two phases independently describing
the same three nodes and disagreeing.

## Acceptance

- The Expression editor shows a line stating that names become ports, naming the current ones.
- The line says what happens on deletion, in the state where deletion would disconnect something.
- `Objects.`, `Arrays.` and `Variables.` complete in expression mode against the project context.
- Bare identifiers are **not** completed and **not** linted in expression mode.
- The Function editor and the Expression editor state **different** rules, in wording that makes the
  difference obvious rather than smoothing it over.
- The three one-sentence node descriptions live in one module and phase 59 can cite them.

## Register

| # | Finding | State |
|---|---|---|
| F31 | The Expression node's scoping rule is the **inverse** of the Function node's, and nothing tells anyone | ✅ verified, `expression.ts:393-404` |
| F32 | The originating mistake is correct **transfer** from the sibling node, not ignorance — which is why marking the boundary beats teaching a notation | ✅ inference, stated as such |
| F33 | Deleting a name from an expression deletes the port **and its connections** — a text edit with a graph consequence | ✅ verified, `expression.ts:404` |
| F34 | The three `CustomCode` one-liners are needed by both this phase and phase 59's LGC-001 | ✅ write once, cite twice |
