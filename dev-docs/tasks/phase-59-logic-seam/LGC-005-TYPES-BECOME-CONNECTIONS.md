# LGC-005 — make the wrong connection impossible

**Status:** 🔨 §1 and §2 built 2026-08-11 · §3 deferred · **live verification not run** — see
[Deferred verification](#deferred-verification). **Track: the seam** · smallest task with the
largest beginner effect

> **Read [As built](#as-built) before the spec below.** The spec's §1 assumed the coercion trap
> was a property of a few port types. Reading the runtime in source made it a property of the
> whole read side, which changes what this task ships and puts one acceptance criterion
> out of reach. That is written up in [§1 as built](#1-as-built--what-the-runtime-actually-does),
> and it needs Richard's eye.

## The claim

Blockly has a real type system. Connections carry checks, and the built-in blocks use the values
`'Array'`, `'Boolean'`, `'Colour'`, `'Number'` and `'String'`; when an input's types intersect an
output's types the connection is allowed, and when they do not **the blocks do not snap together**.
Type is also encoded as colour — each expression block is coloured by its type, and each empty socket
shows the colour it accepts.

We do not use it. Our custom blocks
([`NoodlBlocks.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/NoodlBlocks.ts))
and generators
([`NoodlGenerators.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/NoodlGenerators.ts))
predate the typed-port work, and `detectIO` already reports **a Noodl port type name, or `'*'` when
the blocks do not declare one** — so the type information exists on our side and stops at the block
boundary.

**Wiring it through is a labelling pass, and it buys the strongest beginner affordance in the whole
phase: a mistake that cannot be made.** Structure, not documentation — the phase's own ordering rule
puts this above every explanatory fix in it.

## §1 — Map Noodl port types to connection checks

Write the map once, in one place, both directions:

| Noodl port type | Blockly check |
|---|---|
| `number` | `'Number'` |
| `string` | `'String'` |
| `boolean` | `'Boolean'` |
| `array` | `'Array'` |
| `color` | `'Colour'` |
| `object` | `'Object'` (ours; declare it) |
| `signal` | not a value connection — statement blocks only |
| `*` | **no check** — connects to anything |

⚠️ **`'*'` must mean permissive, not `'Any'`.** `detectIO` returns `'*'` when the blocks declare no
type, which is the common case for an undeclared port. If that becomes a check value it will refuse
to connect to everything instead of everything, and the failure will look like Blockly being broken.

⚠️ **Noodl's coercing ports are the trap.** The registers already record that Units ports write
strings, that `stringlist` stays comma-separated, and that `var()` on a coercing port produced
`"NaNpx"`. A Blockly check that says `Number` where the runtime will hand over a string is worse than
no check — it promises safety the port does not provide. **Where the runtime coerces, use no check**,
and note which ports those are.

## §2 — Colour follows type

Blockly's convention is that block colour *is* the type. Our theme
([`BlocklyTheme.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyTheme.ts))
colours by toolbox category instead, which is also a legitimate scheme — MakeCode does it, and users
learn it.

**Do not change both at once.** Pick one and say why in the file. If colour stays category-based, the
type signal is the socket shape and the refusal to snap, which is still the important half.

⚠️ **Colour-as-type is a colourblindness hazard**, and this repo has already been through one
accessibility phase where a fix deleted every focus ring. Blockly ships `theme-deuteranopia`,
`theme-tritanopia` and `theme-highcontrast`; taking them (LGC-006) is the shipped answer and is
cheaper than auditing our own palette.

## §3 — `strict-connection-checker`

`@blockly/strict-connection-checker` tightens Blockly's default rules. ⚠️ **Unverified** — confirm
what it actually tightens before adopting, because the default checker already refuses type
mismatches and the marginal gain may be small.

## Acceptance

- A `Get input` block declared `number` refuses to snap into a socket that requires a string, and the
  refusal is visible (Blockly's own bump/reject animation).
- An undeclared port (`'*'`) connects anywhere, and a spec pins that — this is the regression most
  likely to escape, because it looks like correctness.
- A port whose runtime coerces has **no check**, and the list of those ports is written down in this
  file rather than only in the map.
- Every existing example project's Visual Functions still load and run —
  `code-logic-builder-greeting.json` at minimum. ⚠️ A tightened checker can invalidate saved
  programs; if it does, that is a migration and this task stops until it is decided.
- Colour scheme decision recorded, and if colour encodes type, the three a11y themes are available.

## Register

| # | Finding | State |
|---|---|---|
| L13 | Blockly's connection checks are a real type system we are not using, while `detectIO` already reports the types. **The information exists and stops at the boundary** | ✅ wired, on the write side only — see L16 |
| L14 | `'*'` from `detectIO` means "unknown", and as a check value it would mean "matches nothing". Opposite meanings, same string | ✅ pinned — `blocklyCheckForNoodlType('*') === null`, and a spec drives real Blockly to show the string form connects to nothing |
| L15 | Coercing ports make a `Number` check a lie. Registers already hold three instances of coercion surprising us | ✅ resolved, and **larger than stated** — see L16 |
| L16 | **The read side cannot be checked at all.** The typecast table gates the wire and converts almost nothing, `'*'` outputs reach every input, and Logic Builder's own setter stores what it is given. A declared Noodl input type is not a claim about the value that arrives | 🔴 open — this is the [PORT-TYPE-CONTRACT.md](../../reference/PORT-TYPE-CONTRACT.md) "Direction C" gap, surfaced from a new direction |
| L17 | **No Blockly theme can recolour a single Noodl block.** All 15 blocks call `setColour(<hue>)` and all 12 toolbox categories pass raw hue strings, so the three a11y themes would half-apply — chrome yes, blocks no. Found by the LGC-006 lane, source-checked, not by a drive | 📋 open — prerequisite for LGC-006's a11y themes *and* for any future colour-encodes-type decision |
| L18 | `@blockly/theme-dark@^8.0.3` is a declared dependency of `noodl-editor` that nothing imports — the only mention left is a comment in `BlocklyTheme.ts` saying it is what the editor used to be | 📋 open — a removal, not this task's |

## As built

Landed in three files plus one spec:

| File | What |
|---|---|
| [`NoodlTypes.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/NoodlTypes.ts) | **new** — the map, both directions, and the policy that decides where a check is applied |
| [`NoodlBlocks.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/NoodlBlocks.ts) | the declaration tracker, the migration guard, and the five static checks re-sourced through the map |
| `BlocklyEditor/index.ts` | one export block (surgical; other lanes hold the rest of this folder) |
| `packages/noodl-editor/tests-unit/lgc-005/blockly-connection-checks.spec.ts` | 22 specs, run with `npx jest tests-unit/lgc-005` from `packages/noodl-editor` |

`NoodlGenerators.ts` was read and **not changed**: a generator turns blocks into text and has
nothing to do with connection legality.

### §1 as built — what the runtime actually does

The map is exactly the spec's table, and `'*'` → `null`. The part that changed is **where the
map is allowed to be applied**, and it changed because of what the runtime says in source.

The spec framed coercion as "some ports coerce, skip those". The stronger fact is that on the
**read** side of a Logic Builder — the value coming out of a `get input` block — the declared
type is not a claim about the value at all. Three reasons, each read in source on 2026-08-11:

1. **The typecast table gates the editor and converts almost nothing.**
   `nodelibraryexport.ts` `typecasts` lets `string` reach `number`, `boolean`, `object` and
   `array` inputs; `number` and `boolean` reach `string`; and so on. The **only** conversions
   the runtime performs are:
   - `object`/`array` source → `string` target = `JSON.stringify`, in `node.ts`
     `_setValueFromConnection`, and **only** when both ports declare their types;
   - `string` → `object`/`array` target = `eval`, in `node.ts` `setInputValue`;
   - `color` target = `styles.resolveColor`, same function.

   `string → number` converts **nothing**. The string arrives verbatim.
   [PORT-TYPE-CONTRACT.md](../../reference/PORT-TYPE-CONTRACT.md) says so in as many words —
   "The table gates the editor; it converts nothing" — and its unbuilt **Direction C** is the
   fix.
2. **`'*'` outputs reach everything and carry anything.** `nodelibrary.ts` `canCastPortTypes`
   returns `true` the moment either end is `'*'`, and `'*'` is the default type of an
   undeclared `Function` output (`simplejavascript.ts`). So even a type with no permissive
   inbound cast can be handed a value of any shape.
3. **Logic Builder's own input setter coerces nothing.** `logic-builder.ts`
   `registerInputIfNeeded` registers `type: typeOfPort(io, 'input', name)` and a setter whose
   whole body is `internal.inputValues[name] = value`. The declared type is published to the
   editor and never consulted again.

So: **a check on `get input` would promise safety the port does not provide** — which is the
sentence §1 already wrote — *and* would refuse constructions that work today. It is not given.
A check on `set output` **is** given, because both ends of that promise are inside the
workspace: the author's own `Define output` declares it and the author's own blocks fulfil it,
and nothing outside can falsify it.

That split lives in one function, `connectionCheckForDeclaredPort(type, plug)`. The day
`registerInputIfNeeded`'s setter runs `coerceToType` (it already exists, in
`expression-type-coercion.ts`, and `node.ts` already imports it), one `return null` here turns
every read-side check on.

#### The coercing / non-guaranteeing ports, written down

The spec asks for the list in prose. Scoped to what a Logic Builder block program can actually
declare — the `Define input`/`Define output` dropdown offers exactly `any`, `string`, `number`,
`boolean`, `object`, `array` — the list is:

| Declared | Guaranteed at `Inputs[name]`? | Why |
|---|---|---|
| `number` | **no** | `string`, `boolean` and `signal` may all be wired in, and none is converted |
| `string` | **no** | `number`, `boolean`, `date`, `color` and `textStyle` may be wired in unconverted; only `object`/`array` sources are stringified |
| `boolean` | **no** | `string`, `number` and `signal` may be wired in unconverted |
| `object` | **no** | the declared inbound cast (`string`) *is* converted by `eval`, but any `'*'` output bypasses the table entirely |
| `array` | **no** | same as `object`; `collection` → `array` is a rename, `'*'` is the hole |
| `*` | n/a | means unknown, and is the honest default |

And the three coercion instances the registers already hold, confirmed still true and named so
nobody re-derives them:

- **Units ports write strings and objects, not numbers.** A port declared
  `{ name: 'number', units: [...] }` is delivered `{ value, unit }` or a `var(--token)` string
  (`react-component-node.ts`). Not reachable from a Logic Builder declaration — the dropdown
  has no units — but it is the clearest proof that a declared `number` is not a number.
- **`stringlist` carries one comma-separated string, not an array** (`tocsv.ts` says so at the
  point of use). Every `stringlist` in the library is `allowEditOnly`, so it is a parameter
  type and never a connection target.
- **`var()` on a coercing port produced `"NaNpx"`** — same mechanism as the units row, and the
  reason `node.ts` now raises `node/nan-input` when a NaN arrives over a wire.

### §2 as built — colour stays category-based. Decided, not to be re-opened.

**Colour continues to encode toolbox category. It does not encode type.** Nothing in this task
touched `BlocklyTheme.ts` or any `setColour` call. The reasons, in order:

1. The spec forbids changing both at once, and the type signal is the half that had never been
   built. Socket shape and the refusal to snap are, in the spec's own words, "the important
   half".
2. Category colour is already shipped and already learned. MakeCode does the same, so it is a
   convention users may arrive with rather than an idiosyncrasy.
3. **Colour-as-type is a colourblindness hazard**, and this repo has been burned by an
   accessibility fix before — a previous phase shipped one that deleted every focus ring. The
   a11y answer is the three shipped Blockly themes, which is LGC-006's business, not this
   task's.

⚠️ **And the a11y themes are not a plugin install.** The LGC-006 lane read this in source while
this task was in flight (register **L17**): all **15** Noodl blocks call `setColour(<hue>)` and
all **12** toolbox categories pass raw hue strings, so `theme-deuteranopia`,
`theme-tritanopia` and `theme-highcontrast` would recolour the chrome and none of the blocks.
Our chrome is fine — `buildBlocklyTheme` passes `componentStyles` explicitly. **The real cost of
ever making colour mean anything — a11y theme or type — is converting 15 blocks and 12
categories from raw hues to named block and category styles**, and that work lives in this
task's files. It is deliberately not done here, because doing it is the "change both at once"
the spec forbids.

### §3 as built — `@blockly/strict-connection-checker` is unevaluated

**Not rejected on merit. Not evaluated at all.** It is not installed, and adopting it needs an
`npm install`, which the lane this task was worked in was forbidden from running (`node_modules`
is symlinked to a shared checkout, so an install there mutates another session's tree). Nothing
here should be read as a judgement of the plugin. What *is* now known, and narrows the question
for whoever picks it up: Blockly's default `ConnectionChecker.doTypeChecks` treats a `null`
check as permissive and otherwise requires the two check arrays to intersect — verified against
the bundled `blockly@12.3.1` and pinned by a spec. The plugin's advertised job is to tighten
exactly that. Given L16, the marginal gain on the read side is zero (there are no read-side
checks to tighten), so the honest question is whether it improves anything on the write side.

### Acceptance, as it stands

| Criterion | State |
|---|---|
| A `Get input` declared `number` refuses to snap into a string socket | 🔴 **not met, deliberately** — see L16 and §1 as built. The read side gets no check. **Richard to rule**: accept the reasoning, or accept it as a route into fixing the runtime (coerce in `registerInputIfNeeded`) and then turn the checks on |
| An undeclared port (`'*'`) connects anywhere, and a spec pins it | ✅ pinned twice — as a map assertion and by driving real Blockly, plus a counter-test showing the string form connects to nothing |
| A port whose runtime coerces has no check, and the list is written down here | ✅ — the table above |
| Every existing example project's Visual Function still loads and run | ✅ for load, on the one that exists. `code-logic-builder-greeting.json` is the **only** saved Visual Function in the repository — `project-examples/` and `library/` contain no `Logic Builder` node at all (grepped 2026-08-11). A spec loads that exact workspace JSON out of the example file into a real Blockly workspace, settles the event queue, and asserts the serialisation is byte-identical and the program is still one connected stack. **Running it is deferred** — see below |
| Colour scheme decision recorded | ✅ §2 as built |

**No migration was needed, and the design is what makes that true rather than luck.** Two
properties do it, and both are pinned by specs that were proved red:

- Checks are applied by a `setOnChange` handler, which is a workspace change listener — and
  `BlocklyWorkspace` deserialises inside `Blockly.Events.disable()`, so **no check is
  recomputed while a saved program is loading**.
- `setCheckWithoutBreakingWires` refuses to apply a tightening that would sever a live
  connection. `Connection.setCheck` disconnects silently when the new check no longer admits
  what is attached; a program saved before checks existed would otherwise lose a block on the
  author's next click, and blame the click. The connection stays permissive until the author
  disconnects it themselves.

## Deferred verification

Nothing below has been run. The lane this task was built in could not launch the editor, so
**no block has been seen to refuse to snap**, and the refusal animation is a claim about
Blockly, not an observation.

**Setup.** Open a project, drop a `Logic Builder`, double-click it to open the block editor
(`nodeDoubleClickAction` focuses the `workspace` port).

1. **The refusal, which is the whole task.** From `Inputs / Outputs`, drag in `Define output`,
   set its name to `total` and its type dropdown to `number`. Drag in `set output` and set its
   name to `total`. Now drag a `text` block (Text category) toward the `set output` socket.
   **Pass:** it does not connect — no highlight as you approach, and it bumps away on release.
   Then drag a `math_number` block to the same socket. **Pass:** it snaps and stays.
2. **The undeclared port still connects anywhere (L14).** Delete the `Define output`. Drag the
   `text` block to the `set output` socket again. **Pass:** it snaps. A failure here is the L14
   bug and looks like "Blockly is broken".
3. **The declaration is live.** Re-add `Define output total` as `number` while the `text` block
   is plugged in. **Pass:** the `text` block **stays connected** — this is the migration guard.
   Now pull it out. **Pass:** it will no longer go back in.
4. **The read side is deliberately permissive.** Add `Define input` named `count`, type
   `number`, and a `get input` named `count`. Plug it into `text_length`'s socket. **Pass:** it
   connects. This looks wrong and is not — see L16. If someone later "fixes" it, they have
   promised a guarantee the port does not provide.
5. **The shipped example still works.** Import `code-logic-builder-greeting.json`, open its
   `Build greeting` node, and check the block program is one connected stack: `Define input` →
   `Define output` → `set output greeting` ← `text_join` ← (`Hello, `, `get input name`).
   **Pass:** nothing is detached and nothing is sitting loose on the canvas. Then run the app,
   type a name, press Greet, and read the Text. **Pass:** "Hello, <name>". This is the half the
   headless spec cannot reach — the spec proves the *blocks* survive; only a run proves the
   node still computes.
6. **What a failure looks like.** A block that silently drops out of a stack on the first click
   in the workspace, or a saved program that comes back with a block sitting loose beside it.
   Both mean a check was applied over a live wire, and both would be the migration this task
   was told to halt on rather than perform.
