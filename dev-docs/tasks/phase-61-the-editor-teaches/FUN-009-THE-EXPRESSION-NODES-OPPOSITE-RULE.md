# FUN-009 — The Expression node's opposite rule

**Status:** 📋 open · **Track: the sibling** · small, and it explains the original mistake ·
🔴 **no longer only copy — it now owns a measured defect**

🔴 **The Expression editor does not run in `'expression'` mode, and never has.**
`validationTypeForEditType` tests the *type's* name (`'string'` for every JS code port) rather than
the port's, so Function, Script and Expression all resolve to `'function'`. Measured live
2026-08-12 — the table and reproduction are in **FUN-003 F17**.

**The user-visible half is this task's exact subject.** `no-undef` is switched off in `'expression'`
mode precisely because bare identifiers *are* the inputs — the inverse rule below. Because the mode
never selects, the rule runs, and the Expression node **underlines its own inputs**:

```
total * 2   →   ⚠ 'total' is not defined.  eslint:no-undef      …and the port `total` is then created
```

So the editor is currently teaching the opposite of this task's sentence. ⚠️ The fix is not a swap to
the port name — `functionScript` contains `script` and the Script node's port is `code`, which would
invert those two. **Decide the discriminator here**, because this is the task that knows why the two
rules differ. FUN-004 is blocked until it lands.

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
| F35 | Four other `codeeditor: 'javascript'` ports declare no notation and fall back to `function` — and at least two of them are not Function bodies | 📋 filed, deliberately not fixed |
| F36 | `NOTATION_RULES` has **no consumer that renders it**; its only reader is the AI prompt template. The phase's copy has never been on screen | ✅ verified by grep, 2026-08-12 |
| F37 | LGC-001 shipped its own copy for the same three nodes before F34's "write once" could happen | ✅ resolved as two documents that must agree — see below |

---

# The build, as run — 2026-08-12 (second session)

## What was built

**§0, which the task acquired after it was written: the discriminator.** The mode a JavaScript code
port opens in is now **declared by the port**, as `type.codenotation`, beside the `codeeditor`
language it has always carried.

| File | Change |
|---|---|
| `CodeEditorType.ts` | `validationTypeForEditType` reads `codenotation`; the `type.name` guess is gone |
| `expression.ts` | `codenotation: 'expression'` |
| `simplejavascript.ts` | `codenotation: 'function'` |
| `javascript.ts` (`Javascript2`) | `codenotation: 'script'` |
| `node-catalog.json` + `-enriched.json` | regenerated — `catalog:check` went red on the port edits; the diff is exactly those three ports |

**Why a declaration and not any derivation.** The task file already warned that the port name inverts
Function and Script. That warning is now an **assertion** rather than a comment: the guess is
reimplemented inside the spec and the ports it gets wrong are named. Nothing about a code port
implies its scoping rule — the rule is knowledge the node has and the editor does not.

**The fallback is `'function'`, and it is a compatibility floor, not a claim.** Every JavaScript port
in the product resolved to `function` before this change, because both name branches were dead. A
port that declares nothing therefore behaves exactly as it did. F35 is the debt this leaves standing.

## What the old spec was

⚠️ `codeeditor-mode.test.ts` **asserted the two dead branches** using type names — `stringWithExpression`,
`scriptString` — that **no port in the product has**. It passed for as long as the feature did
nothing, which is the whole of its life. Replaced with rows that pin the declaration, the fallback,
and the fact that the type name is now ignored.

⚠️ A mapping spec alone cannot see the defect it is meant to guard: nothing in the editor suite can
import a node definition, so a `codenotation` table with no declarations behind it would pass while
every editor still opened in Function mode. The declarations are pinned separately, in the two
packages that own them:

- `noodl-runtime/test/nodes/fun-009-code-notation.test.ts` — Expression and `JavaScriptFunction`
- `noodl-viewer-react/tests/fun-009-code-notation.test.ts` — `Javascript2`

Two files rather than one because the packages compile under different TypeScript targets and a
cross-package import fails to build (`RegExpStringIterator` wants `downlevelIteration`). The fact is
one fact; the packaging is not.

## §1 — built, and **not** closed

`expressionPortNote(names)` is in `notation.ts` with 5 specs. It states the rule, names the ports the
current expression has grown, and — only in the state where it could happen — says that deleting a
name takes the port and its wires with it.

🔴 **Nothing renders it.** §1 asks for it in *FUN-006's bar*, and FUN-006 is unbuilt. F36 is the
larger version of the same finding: `NOTATION_RULES` has never been on screen either. The copy is
exported from the code-editor barrel and ready for FUN-006; the two §1 acceptance criteria stay open
and are not being claimed.

⚠️ The spec asserts the note over **both** states through `minePorts` — no string it can produce
contains `Inputs.` or `Outputs.`, or mines a port. A help surface in this editor that offers the
Function notation creates a port called `Inputs`.

## §2 — already built, and unreachable until now

No code was needed. `noodl-completions.ts` and `noodl-api-surface.ts` already do exactly what §2
asks: bare `Variables.` / `Objects.` / `Arrays.` resolve in expression mode and only there,
`Inputs.` / `Outputs.` port completions are withheld, and bare identifiers are completed from a fixed
API surface rather than from anything project-shaped. **It has simply never run**, because the mode
never selected. That is the shape of the whole finding: the expression-mode behaviour throughout this
package was written correctly and gated behind a branch that could not fire.

## §4 — the plan was not followed, deliberately

F34 said the three one-liners live in one module and phase 59 cites them. **Phase 59 shipped first**,
with its own `NodePicker.chooser.ts`. Reading both, one string cannot serve:

- the chooser card is **comparative and pre-choice** — "which of these three" — and covers
  `Logic Builder`, which has no code editor at all;
- `NOTATION_RULES` is **instructional and mid-edit** — "how do I read an input here" — and covers
  `Javascript2`, which is not in the picker's triad.

They already **agree** on the fact they share, down to the worked example (`price * quantity`). Both
files now say so, and say to read the other before editing either. F34 is closed as answered rather
than as done; if one string is still wanted, it is a small change and this is the note that says so.

## Gates

- `catalog:check` — red on the port edits, as it should be; regenerated, diff is the three ports only
- `catalog:merge` — 175/175 documented
- `typecheck:editor-tests` — clean
- `noodl-core-ui` `notation.test.ts` — 24 pass
- `noodl-runtime` `fun-009-code-notation.test.ts` — 5 pass
- `noodl-viewer-react` `fun-009-code-notation.test.ts` — 3 pass

🔴 **A gitignored artifact was breaking `test:packages` before any of this.**
`packages/noodl-runtime/dist-types` was a **symlink pointing at itself**, created 15:27 on
2026-08-12. `build:types` died on it with `ELOOP`, and `build:types` is viewer-react's `pretest`, so
`npm test` in that package could not run at all. Removed and rebuilt. Nothing in git saw it — the
path is ignored — and no gate reported it as anything but a build failure.
