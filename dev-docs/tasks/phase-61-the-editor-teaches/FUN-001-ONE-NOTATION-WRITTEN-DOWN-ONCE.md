# FUN-001 — One notation, written down once

**Status:** ✅ **built 2026-08-12** · **Track: the words** · §2 taken on the recommendation, recorded
below · blocks the copy in FUN-002, FUN-004, FUN-005, FUN-006

`notation.ts` + 19 DOM-free unit tests; the module is exported from the `code-editor` barrel. The AI
prompt half is done and was **three** copies, not one. **§4's catalog half needed no work** — see F2,
which is refuted. Four findings were measured against the real parser while building it, and one of
them says FUN-002's specced seed body is wrong: **F5**.

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

### ✅ Decision taken, 2026-08-12 — the recommendation, unchanged

**`Inputs.` / `Outputs.` is the notation. `Noodl.Inputs` stays working forever and is never written
by us** — not in a seed, not in a fix-it, not in a docs example, not in an AI prompt. Nothing may
flag a user's existing `Noodl.Inputs` code as wrong.

Recorded here rather than only in a commit message, per §2's own instruction. It is enforced, not
just stated: `notation.test.ts` asserts that no rule string and no seed body contains the alias, and
the module's doc comment carries the decision and its date. Reversing it means changing one module
and re-running one test file — the cost of the decision is deliberately low, which is the point of
taking it now rather than blocking four tasks on it.

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
| ~~The enriched catalog entry for `Function`~~ | ✅ **already done — nothing to build.** See F2. `JavaScriptFunction`, `Expression` and `Javascript2` each carry `summary`, `description`, `whenToUse`, `ports`, `runtimeBehavior`, `patterns`, `antiPatterns`, `relatedNodes` and a validated example, landed by **SUB-005 on 2026-07-23** — seventeen days *before* this task was written. The Function description already teaches the notation correctly, including that a signal is the call and not the assignment |
| ~~Same for `Expression` and `Script`~~ | ✅ same. Phase 59's LGC-001 should **cite these three entries** rather than write a fourth version of the sentence |
| `functionScript` port description | already correct. Leave it |
| The AI function prompt | ✅ **fixed, and it was three prompts not one.** `FUNCTION_CODE_CONTEXT` **and** `FUNCTION_CODE_CONTEXT_EDIT` in [`templates/function.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/templates/function.ts), plus `FUNCTION_QUERY_DATABASE_CONTEXT_GPT3_GENERAL_RULES` in [`function-query-database/gpt-3-version.ts:216`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/templates/function-query-database/gpt-3-version.ts). The first two now share one `FUNCTION_NOTATION_RULES` const built from `NOTATION_RULES.function`, so the sentence the model reads and the sentence the editor shows a beginner cannot drift |

## Acceptance

- ✅ One module exports the notation copy and the two expression builders. ⏳ **"the seed, the fix-it,
  the rail and the bar all import it" cannot close until those exist** — FUN-002/004/005/006 are the
  consumers, and the grep that proves no second string exists is only meaningful once there is
  something to grep. Re-run it at phase exit, not now.
- ✅ `writeExpression` returns a call for a signal port and an assignment for a value port — **and
  brackets an underscored signal name**, which is F6 and was not anticipated here.
- ✅ A port display name containing a space produces `Inputs["My Value"]` and is mined back as the
  same port. Round-tripped through `minePorts` in `tests/code-editor/notation.test.ts`; DOM-free, 19
  specs, and the whole `tests/code-editor/` directory is green at **11 suites / 129 specs**.
- ✅ The enriched catalog entry for `Function` contains a worked example that compiles — it already
  did, since 2026-07-23. See F2; nothing was written for this.
- ✅ The AI function prompt no longer teaches a notation the runtime does not mine. Three prompts.
- ⏳ **§2 is taken on the recommendation and recorded above, not signed.** Richard has not seen it
  yet. It is asserted in a test rather than only stated, and reversing it is one module and one test
  file — deliberately cheap, because blocking four tasks on a signature costs more than reversing it
  would.

## Register

| # | Finding | State |
|---|---|---|
| F1 | The brief's `Noodl.Inputs` is the **legacy alias**; the runtime injects `Inputs` / `Outputs` directly | ✅ verified in source, `simplejavascript.ts:356-360, 447` |
| F2 | ~~There is **no documentation to have read**: the enriched catalog entry for `Function` has two fields and no prose~~ | 🔴 **REFUTED 2026-08-12.** The claim reads the *node* object, whose first two keys are `typeName` and `displayName`, and misses its `enrichment` sub-object. `JavaScriptFunction` carries a summary, a 1,100-character description that teaches the notation correctly, `whenToUse`, per-port prose, `runtimeBehavior`, patterns, anti-patterns and the validated example `function-compute-on-run` — landed by **SUB-005 in `c0d6c86f`, 2026-07-23**, i.e. the entry was already full when this task was written on 08-09. The README's *"premise correction 2"* is therefore half wrong: what is missing is not documentation, it is documentation **anywhere the person in the code editor can see**. The catalog feeds the AI path, the picker and the docs site — not the blank editor. The phase's premise survives; §4's catalog work does not exist |
| F3 | Internal port names carry `in-` / `out-` prefixes — inserting one raw produces valid, silently wrong code | ✅ handled once, `stripPortPrefix()`, asserted |
| F4 | The shipped AI prompt teaches `Inputs[InputName]`, which is not one of the six mined patterns | ✅ **CONFIRMED and fixed.** Measured: unquoted brackets match **none** of the six patterns — the mined bracket form is quoted. And it was **three prompts**, not the one the task names. The prompt's own worked example already used `Inputs.City`, so each prompt contradicted itself |
| F5 | 🔴 **FUN-002's specced seed body mints FOUR ports, not two** | ✅ **measured against `parseAndAddPortsFromScript`.** The runtime's comment-stripping line is commented out, so comments are mined — and the specced comment *"Read an input with `Inputs.Name`, write an output with `Outputs.Name`"* mints an input `Name` **and** an output `Name` beside `Value` and `Result`. The phase exit test says *"with two ports on the node to prove it"*; as specced, a beginner's first Function node arrives with two extra ports that do nothing and cannot be explained. `SEED_FUNCTION_BODY` states the rule without spelling either prefix followed by a name, and is asserted to mine exactly `input:Value` / `output:Result`. **FUN-002 must not restore the specced string** |
| F6 | 🔴 **`Outputs.Done_1()` creates a VALUE port, not a signal** | ✅ measured. The signal-by-dot pattern is `/Outputs\.([A-Za-z0-9]+)\s*\(\s*\)/` — **no underscore in the class** — so an underscored signal name falls through to the regular-output pattern. `Outputs["Done_1"]()` types it correctly. This is the concrete mechanism behind TASKS.md's *"any inserter that does not know the type will silently create the wrong kind of port"*, and `writeExpression` forces bracket form for it |
| F7 | ⚠️ **Two bracket-form reads on one line do not round-trip** | ✅ measured. The bracket patterns capture with a greedy `(.*)`, so `Inputs["My Value"] + Inputs["Other"]` mines **one** port literally named `My Value"] + Inputs["Other`. `minePorts` reproduces the defect faithfully, which is correct of it. **This is a constraint on FUN-005's rail**: an insert-at-cursor affordance can put two bracket reads on one line, and the ports it then shows will not be the ports the node grows. Dot-form names are unaffected |
| F8 | A display name containing `"` has **no** expressible form | ✅ the regular-output pattern is `[^"]*` with no escape. `canExpressPort()` returns false; the honest answer for such a port is to rename it, and no downstream surface should offer an insertion for it |
