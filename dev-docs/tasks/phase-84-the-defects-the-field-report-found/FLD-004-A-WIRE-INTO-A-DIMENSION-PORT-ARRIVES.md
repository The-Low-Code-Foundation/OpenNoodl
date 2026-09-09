# FLD-004 — A wire into a dimension port is honoured, or refused out loud

Accepted, silently discarded, and taking the static fallback with it. The reporter's own words:
*"the third state — accepted, then silently discarded — is the worst of the three."* Underneath it
is a one-word typo that has been in the runtime since the initial commit.

## 1. The person sentence

**Someone wires a number into a Group's height. Either the Group is that tall, or the editor says
why not. It is never silently 100%.**

## 2. What was reported, and what the code says

[#26](https://github.com/The-Low-Code-Foundation/NodeGX/issues/26): a wire into `height` validates
clean and does nothing, and the static `height` that would otherwise apply is ignored too. `width`
and `paddingTop` accept the identical connection and work.

🔴 **The reporter's two hypotheses are both wrong, and the truth is more general.** The ports are
declared **identically** — `node-shared-port-definitions.ts:1175-1192` (width) against `:1193-1209`
(height): same type, same default, same `onChange`. Nothing reads only at init and nothing
overwrites the parameter.

Three separate mechanisms, measured 2026-09-09:

1. **The unit is the answer to "why height and not width".** A bare number arriving over a wire is
   merged into the port's *current unit* (`noodl-runtime/src/node.ts:396-410`), and that unit is the
   port default `%`, seeded by `nodedefinition.ts:173-191`. So **wiring `400` into `height` means
   `400%`**. In a column parent, `layout.ts:93-101` converts a percentage height into
   `flexGrow`/`flexShrink` while leaving `height: 100%` in place — and against a content-sized parent
   there is no free space to grow into, so nothing moves. The same `400` into `width` is 400% of a
   real CSS width and is visible. `paddingTop` is an ordinary style port applied literally. That is
   exactly the three-way result reported.
2. **The lost static value is a `delete`.** `react-component-node.ts:627-644` — the units setter
   does `props[name] = value.value + value.unit` and otherwise **`delete props[name]`**. A wire
   carrying a non-numeric value skips the merge at `node.ts:402`, reaches this setter with no
   `.value`, and removes the property **and its default**.
3. 🔴 **The typo, which is the root of it.** `noodl-runtime/src/node.ts:124-142` — `registerInput`
   seeds a units port as `{ value, **type**: defaultUnit }`, while `setInputValue:402` tests
   `currentInputValue.**unit**`. Wrong key. Library nodes are unaffected because `nodedefinition.ts`
   seeds them correctly with `unit`; **every dynamically registered units port** — `Function`,
   `Expression`, query dynamic ports — has therefore never had bare-number merging. Present since
   `b9c60b07d`. Two research passes found this independently, from #26 and from #22.

⚠️ `validation/diagnostics.ts:355-360` documents `unitless-dimension` as *"only a warning, because
`setInputValue` merges it into the port's current unit"*. That justification is **true for library
ports and false for dynamic ones**, and the diagnostic is currently softer than the runtime warrants.

## 3. Scope

Three separable pieces. Land them in this order, and measure between them.

- **(a) Say it out loud.** A percentage dimension wired into the parent's own main axis is inert.
  Raise it — the node already has `raiseRuntimeError` (`node-shared-port-definitions.ts:1167-1172`
  uses it for `sizeMode`), and mirror it as an authoring diagnostic beside `inert-dimension`
  (`validation/parameterValues.ts:1022`, `layoutInertCombination.ts`). **This is the deliverable the
  issue actually asks for**: make the third state impossible.
- **(b) Stop the `delete`.** A non-conforming value on a units port should **abstain** — keep the
  current prop — per the Empty-Value Contract that `sizeMode.onChange:1159-1161` already implements.
- **(c) The typo.** `node.ts:137` `type:` → `unit:`. One word, and it **switches on** a coercion
  that has been dead for every dynamic units port since the initial commit. **R4 gates this.**
- Correct the `unitless-dimension` justification comment once (c) lands, or it documents a fiction.

## 4. Acceptance criteria

1. **(person)** Wire a number into a Group's `height` in a column parent. Either it takes effect, or
   the editor names the port and says why it cannot. Remove the wire: the authored static value
   comes back.
2. **(a)** A spec asserts the diagnostic fires for a percentage dimension on the parent's main axis,
   and **does not fire** for the same value on the cross axis. Both arms, or it is not a discriminator.
3. **(b)** A spec sends a non-numeric value to a units port and asserts the prop keeps its previous
   value. Reverted arm: restore the `delete` and it goes undefined.
4. **(c)** A spec registers a units port through `registerInput`, sends a bare number, and asserts it
   merges into the default unit. 🔴 **Reverted arm required**: restore `type:` and the merge does not
   happen. This is the arm that proves the typo was load-bearing.
5. 🔴 **A blast-radius measurement, not a claim.** Before (c) ships, enumerate the dynamically
   registered units ports in the shipped library and record, per port, what a bare number does today
   and what it does after. "Mostly it makes wrong things right" is not a measurement.
6. The corpus renders identically before and after (a) and (b): a render drive over the existing
   corpus shows no geometry change. (a) adds a message; it must not move a pixel.

## 5. Traps

- 🔴 **(c) is not a one-word change in consequence.** It alters values reaching every visual node
  through a dynamic port. Do not land it in the same commit as (a) or (b), or the blast radius
  becomes unattributable.
- 🔴 **Do not "fix" the percentage-to-`flexGrow` conversion.** `layout.ts:93-101` is deliberate and
  is what makes percentage heights work at all. This task makes the inert case *audible*, not absent.
- ⚠️ #27 is very probably this defect wearing a different hat — a component input named `height`
  wired to a Group root's `height`. **Re-measure #27 against the reporter's project after this
  lands** before anyone builds `input-shadows-root-port`. See the register.
- ⚠️ A spec that asserts "the wire had no effect" passes just as well when the wire was never made.
  Assert the *connection exists* alongside the geometry.
