# FUN-001 — One notation, written down once

**Status:** 📋 open · **Track: the words** · ⚠️ **contains a decision for Richard (§2)** · blocks the
copy in FUN-002, FUN-004, FUN-005, FUN-006

## Why this is first and why it is not documentation

Every other task in this phase writes a sentence a beginner reads at the worst possible moment: the
seed body, the fix-it message, the rail's tooltips, the help bar. **If those four surfaces disagree
about the notation, the phase makes things worse than blank.**

There is currently no source to disagree with. Verified 2026-08-09:

- `Noodl.Inputs` / `Noodl.Outputs` appear **nowhere** in the product except the alias assignment
  itself ([`simplejavascript.ts:359-360`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts))
  and one built deploy artifact.
- The enriched catalog entry for `Function` has **two fields**, `typeName` and `displayName`
  ([`node-catalog-enriched.json`](../../../packages/noodl-types/src/node-catalog-enriched.json)).
  The node picker, the docs site and the AI authoring path all read from there.
- The only prose in the product is the `functionScript` port description at
  [`simplejavascript.ts:163`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts):
  *"JavaScript run when Run fires, reading Inputs.name and writing Outputs.name"* — correct, and
  displayed as a tooltip on the row the user clicks **through**.

So this is not a doc-writing task. It is **choosing the string** that four pieces of UI will contain,
and putting it somewhere they can all cite.

## §1 — The facts the string has to be true to

Read in source, not recalled:

| Fact | Where |
|---|---|
| The body compiles as `new AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', script)` | [`simplejavascript.ts:447`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts), and again for the validate-only path at `:558` |
| `Noodl.Inputs` / `Noodl.Outputs` are assigned **after**, as aliases, under a comment naming them legacy | [`:356-360`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts) |
| A value output is an **assignment**; a signal output is a **call** — `Outputs.Done()` — and the runtime types them differently | [`javascriptnodeparser.js:353-366`](../../../packages/noodl-runtime/src/javascriptnodeparser.js) |
| An output is *both*: `Outputs.done` is callable **and** carries `.send()` | [`simplejavascript.ts:346-347`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts) |
| Mentioning a name **creates the port** — `Inputs.x` in the text is what `x` being a port means | [`javascriptnodeparser.js:294-387`](../../../packages/noodl-runtime/src/javascriptnodeparser.js) |
| Ports carry `in-` / `out-` prefixes internally; the display name is the bare name | [`simplejavascript.ts:711-714`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts) |

⚠️ **The last row is a trap for every task downstream.** A fix-it or a rail that inserts the *port
name* rather than the *display name* writes `Inputs.in-Input_1` — valid JavaScript, silently wrong,
and it mints a second port called `in`. Strip the prefix once, in the shared helper, not at five call
sites.

## §2 — ⚠️ The decision

**Recommended, and what the rest of the phase assumes unless Richard says otherwise:**

> **`Inputs.` and `Outputs.` are the notation.** `Noodl.Inputs` stays working forever and is never
> written by us — not in a seed, not in a fix-it, not in a docs example, not in an AI prompt.

The arguments for it: it is what the runtime injects; it is what `minePorts` and the ESLint globals
already assume ([`esLintDiagnostics.ts:69-76`](../../../packages/noodl-core-ui/src/components/code-editor/utils/esLintDiagnostics.ts));
it is shorter, which matters when the string is a hint in a one-line bar; and the node's own port
description already says it.

The argument against, which is real: **saved projects contain `Noodl.Inputs`**, and a user reading
their own old code beside our new hint sees two notations and no explanation. FUN-004 §4 handles that
case explicitly rather than pretending it away.

**What must not happen** is the third option — leaving it unstated and letting each surface pick. The
NDA-017 shape applies: when a port description is the only place a behaviour is written down, a wrong
one is worse than none.

## §3 — Where the string lives

One module in `noodl-core-ui`, beside the code editor, exporting the copy the UI consumes — not a
markdown file, because a markdown file cannot be imported by a lint message.

```
packages/noodl-core-ui/src/components/code-editor/utils/notation.ts
```

It exports, at minimum:

- the one-line rule per mode (`function`, `script`, `expression`);
- `readExpression(portName)` → `Inputs.Foo` / `Inputs["Foo Bar"]` when the name is not an identifier;
- `writeExpression(portName, type)` → `Outputs.Foo = ` for a value, `Outputs.Foo()` for a signal;
- the seed body FUN-002 uses.

⚠️ **The bracket case is not hypothetical.** Port display names come from a proplist a human typed
into, so `My Value` is reachable, and `Inputs.My Value` is a syntax error. The runtime mines
`Inputs["x"]` as readily as `Inputs.x`
([`javascriptnodeparser.js:343`](../../../packages/noodl-runtime/src/javascriptnodeparser.js)), so
the correct output exists — it just has to be chosen per name. Every downstream task calls these two
functions rather than concatenating a dot.

## §4 — The surfaces that adopt it

| Surface | Change |
|---|---|
| The enriched catalog entry for `Function` | gains a summary and **one worked example** — the two-line pass-through. It is what the node picker, the docs site and the AI prompt all read |
| Same for `Expression` and `Script` | the three `CustomCode` nodes get one sentence each; phase 59's LGC-001 needs the same three sentences for the picker, so **write them once and let both phases cite them** |
| `functionScript` port description | already correct. Leave it |
| The AI function prompt (`FUNCTION_CODE_CONTEXT`, [`templates/function.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/templates/function.ts)) | ⚠️ it currently instructs the model that *"Inputs follow `Inputs[InputName]` format"* — bracket notation, unquoted, which is **not** what the runtime mines. Check it against §1 and fix it here |

## Acceptance

- One module exports the notation copy and the two expression builders, and **the seed, the fix-it,
  the rail and the bar all import it** — grep proves no second string exists.
- `writeExpression` returns a call for a signal port and an assignment for a value port.
- A port display name containing a space produces `Inputs["My Value"]`, and that name is mined back
  as the same port by `minePorts`. **Round-trip it in a unit test** — this is core-ui's `node`
  test environment, so it must stay DOM-free (CED-001).
- The enriched catalog entry for `Function` contains a worked example that compiles.
- ⚠️ The AI function prompt no longer teaches a notation the runtime does not mine.
- Richard has signed §2, and the decision is recorded **in this file**, not only in a commit message.

## Register

| # | Finding | State |
|---|---|---|
| F1 | The brief's `Noodl.Inputs` is the **legacy alias**; the runtime injects `Inputs` / `Outputs` directly | ✅ verified in source, `simplejavascript.ts:356-360, 447` |
| F2 | There is **no documentation to have read**: the enriched catalog entry for `Function` has two fields and no prose | ✅ verified, `node-catalog-enriched.json` |
| F3 | Internal port names carry `in-` / `out-` prefixes — inserting one raw produces valid, silently wrong code | ⚠️ ours to handle once, in `notation.ts` |
| F4 | The shipped AI prompt teaches `Inputs[InputName]`, which is not one of the six mined patterns | ⚠️ unverified against every mining regex; check before editing |
