# FB-026 — the field that is not always text

**Filed** 2026-08-27 by Richard. **Built, specced, gated and driven the same day** — see
*Driven on the canvas*.

> When I add an input, I change the 'type' from string to number, but the output port is still
> listed as 'string', and the value that comes out of the input is a string type with double
> quotes, and the connector goes dotted and errors when I connect it to a number port because it
> expects a number and gets a string.

and, in the same message:

> the 'text' value (which we should rename to 'value' I think because it's not always text)

⚠️ **The subject was ambiguous and Richard settled it**: this is the **Text Input** node's `Type`
property, not the Visual Function's `Define input` TYPE dropdown. Both were live candidates — the
Blockly dropdown's options are labelled exactly `any / string / number / …`, which matches the
wording — and the two would have been different work. Asked and answered rather than guessed.

## Three symptoms, one defect, and the third one was telling the truth

`event.target.value` is a **string for every `<input>`**, `type="number"` included. So a field set
to Number really did publish `"5"`, and both value ports were hard-declared `type: 'string'`. FIX-025's
dashed wire was not a false positive — it was the only thing in the product that had noticed.

Fixing the value is what makes the port type worth narrowing, and narrowing the port type is what
stops the wire dashing. Neither alone is the fix.

## What changed

1. **`nodes/controls/textInputValue.ts`** — new, and the single source for the three answers that
   follow from `Type`. It has **four** callers that must not drift: the component converting a
   keystroke, the node converting a `Set` that lands before the field has mounted, `Clear` deciding
   whether it changed anything, and `updatePorts` telling the canvas what the ports are.
   - `number` → a real number; every other Type → text. `email`/`url`/`password` are strings with a
     keyboard and a validation hint, and widening them would be a claim the value cannot support.
   - Empty or unparseable → **`null`, never `NaN`** (`EMPTY-VALUE-CONTRACT.md` E3/E4; a `NaN` would
     raise OBS-003's `node/nan-input` several hops downstream from the empty field that caused it).
   - The **field keeps the raw string**. Converting the component's own state would delete a
     half-typed `-`, `1.` or `1e` as it was typed.
2. **The ports are declared `'*'` and narrowed per instance.** `'*'` is the only true answer where
   nothing is running — a deployed viewer, the node catalog, the docs site — and a new module-level
   `setup` republishes `startValue` and `onTextChanged` as `string` or `number` from the `type`
   parameter, following it when the author changes it.
3. **`NodeGraphNode.getPorts` lets a dynamic port replace a static one** of the same name *and
   plug* (`portOverrides.ts`). It only ever concatenated before, and nothing collided because every
   producer in the library takes care not to — the Visual Function filters `RESERVED_INPUTS` /
   `RESERVED_OUTPUTS` precisely so it cannot mint a second `run`. The collision was **avoided,
   never resolved**, so a node needing a static port narrowed had no way to ask.
4. **The rename Richard asked for**: `Text` → `Value` on both ports, `Text Changed` → `Value
   Changed`. **Display names only** — `startValue`, `onTextChanged` and `textChanged` are the ids in
   every saved `project.json` and stay frozen.

## The catalog would have published a lie, and now checks instead

Adding a `setup` that calls `sendDynamicPorts` made the generator classify this node
`runtime-discovered`, which carries the sentence *"the static port list below is incomplete for such
instances"* — **false here** — and dropped its `parameterEncoding` from `known: true` to
`known: false`, which tells an AI reading the catalog it cannot trust a port list that is exactly
right.

So the generator learned the distinction: `RETYPES_DECLARED_PORTS` in `derive-encoding.js`, for a
node that republishes ports it already declares and mints none.

🔴 **The entry is a claim, and it is checked rather than believed.** `retypesEncoding` drives the
node's `setup` headlessly — twice, once per branch of the narrowing — and **throws**, failing the
build, if it publishes a name that is not in the static list, or if it publishes nothing at all.
The emptiness guard is not decoration: without it the name check passes vacuously the day the hook
stops emitting. **Mutation-tested**: injecting one fabricated port name into the observed set fails
generation with the right message.

⚠️ **Near neighbour, deliberately not moved.** `Set Variable` is described in `RESIDUE_REASONS` as
*"the single dynamic port is `value`, whose type follows the `setWith` parameter"* — the same shape —
and is still `known: false`. Re-classifying it is a separate claim that wants its own measurement.

## What was measured

| | |
|---|---|
| `noodl-viewer-react` | **1079 pass, 0 fail** (8 new rows) |
| editor `test:main` | **5791 pass, 0 fail** (6 new rows) |
| editor `test:ci` | **2856 specs, 4 failures** — the recorded `AIX-006` floor |
| generated artefacts | `catalog:check`, `catalog:merge`, `docs:nodes`, `cloud-library:check`, `catalog:groups:check`, `catalog:examples` (62/62) all clean, regenerated and committed |

⚠️ **`docs:nodes:check` said *clean* while the docs were stale**, because it reads the *enriched*
catalog and that had not been merged yet. The doc really did change once `catalog:merge` ran. A
green check on a stale input.

## Driven on the canvas, 2026-08-27 — both directions, through the real dropdown

Fixture `NodeGX test projects/fb025-drive`: a Text Input whose `Value` is wired into a Visual
Function's declared **`number`** input. `Type` was changed from the **property panel's own dropdown**,
not by writing the model — a model write never re-renders that panel, so the panel reading would
have been of the old value.

| | `Type` = **Number** | `Type` = **Text** |
|---|---|---|
| panel `Type` row reads | `Number` | `Text` |
| `startValue` port | `number`, display `Value` | `string`, display `Value` |
| `onTextChanged` port | `number`, display `Value` | `string`, display `Value` |
| rows named `Value` on the node | **exactly one per plug** | **exactly one per plug** |
| wire into the `number` port, read at **+4 s** | `{healthy: true}` — **solid** | `{healthy: false}` — **dashed**, *"connects a **string** to a **number** port…"* |
| the field publishes | `5`, `typeof "number"` | a string |
| the Visual Function's `n` holds | `5`, `typeof "number"` | — |

✅ **Richard's three symptoms are all gone, and the fourth thing — the dashed wire — is still there
when it should be.** Flipping to `Text` and back was not decoration: it is what makes
`{healthy: true}` evidence rather than a constant. The same wire, the same instrument, the same
+4 s wait, opposite answers, driven by the one control under test.

✅ **The `getPorts` override is confirmed at the surface it was written for**: `ti2.getPorts()`
returns **one** `startValue` and **one** `onTextChanged`, not two of each. Before
`portOverrides.ts` the dynamic and static declarations concatenated and the panel would have shown
`Value` twice.

⚠️ **The debounce is real and 2 s is not enough margin.** Both transitions were read at +4 s; a read
at +0.5 s would have returned the previous verdict on a correct build.

⚠️ **Driving trap, cost ~5 minutes:** the `Type` dropdown's options render **twice at identical
coordinates** — `BaseDialog` draws a measuring copy. The measuring copy is the one under
`BaseDialog-module__MeasuringContainer`; it fails `elementFromPoint`, and clicking it succeeds and
does nothing. Pick the copy that hit-tests to itself.

## What is left

⬜ **`Set Variable`'s classification**, above — untouched, and still wants its own measurement.
