# ERG-003 — One editor for every list input

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Prerequisites** | none |
| **Recommended executor** | Sonnet. The component exists; this is a storage decision plus a swap |
| **Origin** | Richard, 2026-08-01 — the stringlist "New entry" popup renders the comment editor |

## Objective

Give every list-shaped port one editor with three ways in: **a visual builder, a JSON code editor, or
a wire** — reusing the component that already exists rather than building a fourth list UI.

## §0 — What exists (measured 2026-08-01)

### The component is already built, already shared, and already has the right shape

[`JSONEditor`](../../../packages/noodl-core-ui/src/components/json-editor/JSONEditor.tsx) —
~1,300 lines across the component and its helpers, in **`noodl-core-ui`**, so nothing needs
extracting from the settings panel:

| Piece | What it is |
|---|---|
| `modes/EasyMode/` | The visual tree builder — the no-code path |
| `modes/AdvancedMode/` | Text editor with live validation |
| `utils/jsonValidator.ts` | Validation, with an `expectedType` of `object` / `array` / `any` |
| `utils/treeConverter.ts` | Value ↔ tree, both directions |
| props | `value`, `onChange`, `onSave`, `defaultMode`, `mode` (forced), `expectedType`, `disabled`, `height` |

**Used in exactly one place:** the app-level Variables section of the Settings panel
(`VariablesSection.tsx:88`). Richard's recollection was right — it was built for global static lists
and never applied anywhere else.

### The target surface, and it is concentrated

| Port type | Ports | Nodes include |
|---|---|---|
| `array` | 26 | Array, Create New Array, Query Records, Array Filter, Repeater, Array Map |
| `stringlist` | 25 | Cloud Function, Component Object, Send Event, Close Popup, Create New Object, Page Inputs |
| `object` | 11 | Query Records, On App Error, Global Store, HTTP Request, Send Email |
| `proplist` | 7 | Function, Script, Create Record, Component Stack, Update Record |

69 ports, funnelled through a handful of property-editor type handlers — not 69 separate places.

## §1 — ⚠️ The real work is the storage format, not the UI

**`stringlist` is stored as a comma-separated string, not an array.**
[`StringListType.ts`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/StringList/StringListType.ts)
normalises by `value.split(',')`, with a legacy branch for arrays-of-objects carrying `label` fields.

So this task has a §0 decision before any UI moves:

- **Option A — migrate to a JSON array**, with read-time tolerance for the old comma string (the
  normalise function already does exactly that, so the tolerance is free). Under the standing
  [compatibility policy](../../reference/COMPATIBILITY-POLICY.md) this is allowed and is the honest
  option: one representation, not two.
- **Option B — keep the comma string** and translate at the editor boundary. Cheaper today, and it
  keeps a format whose failure mode is "a value containing a comma".

**Recommendation: A.** A comma-separated string cannot represent a value containing a comma, and the
policy exists precisely so a correctness fix does not have to be dual-pathed. But it is a decision,
it touches saved projects, and it should be made explicitly rather than discovered halfway through.

⚠️ **Re-derive the encodings before deciding.** SUB-013 established the parameter encodings *by
observation* and found a bare-pattern assumption that had broken three checks. Do not trust this
section's summary of `stringlist` without re-measuring the other three types.

## §2 — The three-way affordance

The end state Richard described:

1. **Visual list/object builder** — `EasyMode`, the default.
2. **JSON code editor** — `AdvancedMode`, one toggle away.
3. **Connect a wire** for dynamic values — **this already works** on any port, so it is not built
   here; it is *shown*, so an author knows it is an option.

`expectedType` already distinguishes "must be an array" from "must be an object", which maps onto the
port types directly. `proplist` is the one that needs thought: it is a list of *named properties*, so
the natural shape is an object, not an array — check what `Function` and `Script` actually consume
before choosing.

## §3 — The bug this closes on the way past

The stringlist **"New entry" popup renders the comment/code editor** — an 8-row textarea placeholdered
`// Add your comment here...` — for a field that takes one short identifier. Found live on
`Page Inputs`; it affects every `stringlist` port in the library. The textarea is shared with the
comment editor, which is why it was left as a decision rather than patched.

## Success criteria

1. The storage decision is recorded in this file with the measurement it was made from.
2. Every one of the 69 list-shaped ports uses one editor. Derived from the catalog, not from §0's
   table.
3. An author can switch between visual and code on any of them, and the visual mode can produce
   every value the code mode can.
4. The comment-editor textarea no longer appears for any list input.
5. A port with a connection shows that it is driven by a wire rather than offering a stale local
   value.
6. Existing projects' list values still load — including a `stringlist` written in the old format, if
   Option A is chosen.
7. ⚠️ Live QA in the running editor on at least one port of each of the four types. The panel is
   exactly the surface where a static check passes and the UI is wrong — DV-ii's rule.
