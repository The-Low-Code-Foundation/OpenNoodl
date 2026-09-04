# REL-014 — The value the field destroys

**Opened** 2026-09-04 from Richard's testing pass · **Data loss** · Effort: **S** (the defect) ·
🔴 **the surrounding feature is FIX-015's, not this row's**

> *"When you accidentally click them in the wrong way and delete the var value, it goes back to
> 'auto' and you can't get the var thing back. So this is currently really confusing."*
> — Richard, 2026-09-04

## 🔴 The defect: a parse failure is treated as a deletion

`views/panels/propertyeditor/DataTypes/Dimension.ts` — and its twin `NumberWithUnits.ts`:

```
parseNumberWithUnit("var(--space-4)") → parseFloat → NaN → value undefined
...
} else {
  this.parent.setParameter(this.name, undefined);   // the parameter is GONE
}
```

Two gestures reach it, neither of them destructive-looking, neither confirmed:

1. **the reset dot** — `PropertyPanelRow.tsx` renders a *"Reset to default"* affordance beside any
   changed property;
2. **any edit at all** — the field displays the literal string `var(--space-4)`, so clicking in,
   touching one character and blurring runs `commitIfChanged` → `updateValue` → NaN → **wiped**.

**And it cannot be typed back.** `updateValue` discards any non-numeric text silently, so entering
`var(--space-4)` sets the parameter to `undefined`. The node falls back to its declared default —
for Text that is literally `width: 'auto'`. Richard's sentence is the code path, exactly.

### ⚠️ The asymmetry that makes it feel arbitrary

Colour fields **do** survive: `ColorPicker/ColorType.ts` commits any non-empty trimmed string, so
`var(--primary)` can be retyped there. Same-looking values, opposite behaviour, no explanation.

### 🔴 He never typed those values — the editor did

`ElementConfigRegistry.applyDefaults` stamps `var(--…)` onto **every newly created node**
(`TextConfig` writes `fontSize: 'var(--text-base)'` and `color: 'var(--foreground)'`;
`CheckboxConfig` writes `var(--space-4)` and `var(--border-1)`). So the product authors a value the
product's own field then destroys on contact.

## Acceptance criteria

- **AC1** — a `var(--token)` value typed into a dimension/number field is **kept verbatim**, not
  parsed to NaN and dropped.
- **AC2** — a `var(--token)` value already on a port **survives** an edit-and-blur of the field and
  survives a focus/blur with no change.
- **AC3** — the reset dot still resets. 🔴 **Resetting must stay possible** — this row makes an
  accident recoverable, it does not remove the deliberate action.
- **AC4** — the paired control: a genuinely invalid entry (`"banana"`) is still refused, and refused
  **visibly**. AC1 must not become "accept anything".
- **AC5** — graded on **both** `Dimension.ts` and `NumberWithUnits.ts`. They are twins and a fix to
  one is the classic second-copy-drifts hazard.

## ⚠️ Traps

1. 🔴 **Do not widen this into the picker.** See below — that work is ruled and owned.
2. **`allowVisualStates` / variant stamping** writes these same parameters. Check a fix does not make
   a `var()` string survive into a place that previously stored a number, e.g. the export path.
3. **The value is displayed as a raw string today** (`Dimension.ts` returns it when
   `typeof !== 'object'`). Whatever accepts it back must round-trip *that* representation.
4. ⚠️ **A gate here needs a known-firing arm**: assert the token value survives **and** that an
   invalid one is still rejected, on the same field. Only asserting survival passes a field that
   accepts everything.

## 🔴 Scope: this row is the DEFECT only

The surrounding feature — *"how do I select, add, edit or delete these?"* — is **already ruled and
owned**:

- [**FIX-015**](../phase-66-0.1.7-bug-fixes/FIX-015-THE-TOKENS-NOBODY-CAN-EDIT.md) is a ruled scope
  with eight rulings and a **green-lit successor phase**. Its slice 1 is *"make tokens visible and
  editable — un-gate the panel, editable rows via the already-built TokenPicker."*
- `TokenPicker.tsx` **exists, is complete at 397 lines, and has zero JSX call sites.**
- The Design Tokens panel is registered `experimental: true` **inside `if (config.devMode)`**, and
  `devMode` is set in no shipped config — so in a packaged build **it is not registered at all.**
- `STYLE-004/CHANGELOG.md` records the wiring as *"blocked on STYLE-001 Phase 3"*. The component
  landed; the mount never did.

**Why the split is right:** FIX-015's gap list A–J names the missing *editing surface*. It does not
name a field that destroys a value on contact. That is a defect, it is small, it is data loss, and it
should not wait for a phase.

⚠️ Richard's *"I think I've missed something where the kind of 'global styles' thing is defined"* is
answered by FIX-015, not here — and his instinct that it belongs beside the project **Variables**
section in project settings is worth carrying into that phase.

---

## Findings — built 2026-09-04

### What changed

| File | Change |
| --- | --- |
| `views/panels/propertyeditor/DataTypes/NumberWithUnits.ts` | `parseNumberWithUnit` → exported `readNumberFieldEdit` / `isTokenReference`; `updateValue` rewritten; `rejectEdit()` + `refusals` key |
| `views/panels/propertyeditor/DataTypes/Dimension.ts` | its own copy of the parser **deleted**, imports the one above; same `updateValue` rewrite, same `rejectEdit()` |
| `tests-unit/rel-014/tokenFieldValue.test.ts` | new — AC1–AC5, both rows, through the `onCommit` the real input calls |

### The shape of the fix: two outcomes became four

`parseNumberWithUnit` answered *a number* or `undefined`, and `undefined` is the value that
**clears** a parameter — so every parse failure was a deletion. There are now four:

- **clear** — an empty field. Still `undefined`. Deleting on purpose is untouched (AC3).
- **token** — `var(--name)` / `var(--name, fallback)`, stored **verbatim as a bare string** (AC1).
- **number** — unchanged, including `parseFloat`'s old tolerance (`50abc` still commits `50`).
- **refuse** — anything else. **Nothing is written**: no value, no undo entry (AC4).

🔴 **One copy, not two.** The twins each carried a byte-identical `parseNumberWithUnit`.
`Dimension.ts` now imports `readNumberFieldEdit` from `NumberWithUnits.ts`, so AC5 is closed by
construction rather than by remembering — and the spec's disposition table would catch a re-fork.

### AC4's second half: a refusal that nothing could see

Refusing is not enough on its own, and this is the part that needed a mechanism rather than a
branch. `NumberUnitInput` holds the typed text in `useState` and re-seeds it from the `value` prop
only through `useEffect(..., [value])`. On a refusal nothing is written, so `value` does **not**
change, so the effect does **not** fire — the field would sit there showing `banana` while the
model still held `50`. That reads as accepted.

So a refusal bumps `refusals`, which is the React `key` on the element. The key is otherwise
constant — a scrub re-renders the row on every mousemove and must not remount — so the input is
remounted **only** when an edit was turned down, and its state is re-seeded from the model: the
typed text snaps back to the value that survived.

⚠️ **Cost, named:** a refusal on <kbd>Enter</kbd> takes focus out of the field, because the input
is remounted. On blur (the common path, and Richard's) there is nothing to lose.

### Trap 2 — does a `var()` string survive into a place that wanted a number?

**Already answered, and not by this row.** `noodl-viewer-react/src/react-component-node.ts` has
carried `isTokenReference(value) = value.startsWith('var(')` since **AIB-001**, applied at four
sites on units-typed inputs and their defaults, precisely so a token reaches the style untouched
instead of being fitted with a unit (`var(--space-4)px`). `nodegx-export/src/emit/kits.ts` carries
the same test. The editor's rule here is a strict **subset** of the runtime's, so there is no value
this field can now store that the runtime cannot render.

### Residual defects found while building — NOT fixed, named for an owner

1. 🔴 **`components/MarginPaddingInput.tsx:207-208` is a third copy of the same defect**, out of
   this row's surface. `const parsed = parseFloat(text); const value = isNaN(parsed) ? undefined
   : { value: parsed, unit }` — identical shape, identical consequence. It matters because
   `TextInputConfig` stamps `paddingTop/Bottom: 'var(--space-2)'` and `paddingLeft/Right:
   'var(--space-3)'` onto **every new Text Input**, and margin/padding ports are claimed by
   `isOfMarginPaddingType` four branches ahead of the numeric rows — so those tokens never reach
   the code fixed here. Owner: **NONE**.
2. 🔴 **`DataTypes/BasicType.ts:111` is a fourth**: `parseFloat(String(value))` → `isNaN ?
   undefined`, for plain `number` ports with no units. Same deletion-on-parse-failure. Owner:
   **NONE**.
3. ⚠️ **The Fixed tick is inert while a token is set** (`Dimension` only). `onFixedToggle` calls
   `updateValue(String(this.value), this.unit)`, which for a token re-commits the token — a bare
   string has nowhere to carry `isFixed`. Before this row the same gesture *destroyed* the token,
   so this is strictly better, but the checkbox still appears live and does nothing. Owner:
   **NONE**.
4. ⚠️ **A drag still overwrites a token with a number.** `scrubStartValue('var(--space-4)')` finds
   no number, falls back to the port default, and `onScrubEnd` writes `{ value, unit }` over the
   token. That is unchanged by this row and is arguably correct (a drag is a deliberate
   magnitude), but it is the one remaining gesture that removes a token without saying so.
   Owner: **NONE**.

### What the spec does NOT grade

`NumberUnitInput` cannot be loaded by the plain-Node runner — it reaches `PropertyPanelSelectInput`,
which imports an `.svg`, and there is no loader for one — so it is mocked and the **props the row
computed** are what is asserted. Two claims therefore live in the component and are owed to a drive:
that `commitIfChanged` skips a blur with no change, and that the remount actually re-seeds the
visible text. `../utils` is mocked too, for resolution only (`@noodl-contexts` is unmapped here);
`getEditType` is restated verbatim.

---

## Findings — the last two copies, closed 2026-09-04 (second pass)

### What changed

| File | Change |
| --- | --- |
| `components/marginPaddingEdit.ts` | **new** — the widget's parse, display text, drag origin and link-agreement key, all as pure functions over `readNumberFieldEdit`. Not a third parser: it *asks* the shared one and maps its four answers onto `{value, unit}` |
| `components/MarginPaddingInput.tsx` | `commitEdit`'s `parseFloat` → `isNaN ? undefined` deleted; it is now a five-line hand-off to `commitMarginPaddingEdit`. A token labels as `--space-2` (full text in `title`), seeds its edit box in full, previews on linked siblings, and a refusal snaps the box back |
| `DataTypes/MarginPaddingType.ts` | `values`/`defaults` widened to `MarginPaddingParam`; `refreshDefault` keeps a token verbatim instead of wrapping it as `{value:'var(--space-2)', unit:'px'}`; the link seed compares tokens as values |
| `DataTypes/BasicType.ts` | `onChange`'s `parseFloat(String(value))` → `isNaN ? undefined` replaced by `readNumberFieldEdit`; a `refusals` React key, as `NumberWithUnits` has; the dead legacy `onPropertyChanged` copy fixed too |
| `noodl-core-ui/.../PropertyPanelNumberInput/numberInputEdit.ts` | **new** — the field's three outcomes, lifted so they can be graded |
| `noodl-core-ui/.../PropertyPanelNumberInput.tsx` | 🔴 **the missing `else`** — see below |
| `tests-unit/rel-014/tokenFieldValueRemainingCopies.test.ts` | **new** — 31 cases / 81 assertions across both sites (the `it.each` adds 11 more), beside the existing gate rather than inside it |

### 🔴 `BasicType` alone would have been dead code

`BasicType` is the **only** row that selects `PropertyPanelInputType.Number`, and
`PropertyPanelNumberInput.handleUpdate` was `const n = extractNumber(text); if (!isNaN(n)) {…}` —
**with no else**. Text the field could not read as a number never reached `onChange` at all:
nothing written, nothing snapped back, and the input left showing text the model never held.
`extractNumber('var(--space-2)')` strips to `---2` → `NaN`, so a token has *always* died in that
branch. Fixing the row without the caller would have been a green assertion over a line no token
can arrive at. The component now hands non-numeric text down and the row decides — and the
snap-back to the model's value happens **before** the hand-off, because on a refusal the `value`
prop does not change and the re-seeding effect never fires.

⚠️ `PropertyPanelNumberInput` deliberately does **not** learn what a token is: it is core-ui, a
fourth cross-package copy of the token rule is exactly this row's hazard, so its third outcome is
`passthrough` — *"not a number, your call"*.

### The margin/padding widget was worse than the twins

A token stored on a side rendered as **`0`** (a bare string has no `.value`) and opened its edit box
showing the literal text **`undefined`** (`String(values[comp].value)`). So the value was invisible
and read as a zero somebody had typed *before* any edit destroyed it. `TextInputConfig` puts four of
them on every Text Input.

### What the new gate grades vs asserts

Graded by running: `readMarginPaddingEdit`, `commitMarginPaddingEdit`, the display/drag/agreement
helpers, `readNumberInputText`, and **both rows through the props they hand their components** —
including a widened AC5 table (11 inputs) proving the margin/padding widget and a plain number port
dispose of the same text the same way, with a control proving that comparison can disagree.

Not graded, owed to a drive: the two components' own local state. `MarginPaddingInput.tsx` imports
`common/Icon` (webpack `require.context`) so no runner here can load it, and both call hooks. That
is why every decision was lifted out of them; what is left in each is a hand-off.

### Residual defects — re-stated after this pass

1. ✅ **CLOSED** — `MarginPaddingInput.tsx:207-208`, above.
2. ✅ **CLOSED** — `DataTypes/BasicType.ts:111`, above, together with the caller that ate the value.
3. ⚠️ **STILL OPEN, untouched** — the **Fixed tick is inert while a token is set** (`Dimension`
   only). Nothing in this pass touches `Dimension.ts`; the tick still appears live and still does
   nothing. Owner: **NONE**.
4. ⚠️ **STILL OPEN, and now reaching one more site** — **a drag overwrites a token with a number.**
   - Dimension / NumberWithUnits: unchanged.
   - Margin/padding: still overwrites, but **less badly** — `scrubStartOf` falls back to the side's
     default instead of `start.value || 0` on a bare string, which used to begin every such drag at
     **0 with `unit: undefined`**.
   - 🔴 **New site**: a plain `number` port can now hold a token, and `scrubStartValue` reads
     `Number('var(--space-2)')` → `NaN` → the port default → 0. Same trade already accepted for the
     twins, named here rather than discovered later. Owner: **NONE**.
5. ⚠️ **A token on a unitless `number` port is a real value the runtime passes through untouched**
   (`react-component-node`'s plain `input.set` branch assigns it, and cannot fit it with a unit) —
   but nothing stamps one there today, and a port whose consumer wanted arithmetic will receive a
   string. That is an author's own visible, undoable edit, where before it was a silent deletion.
6. 🧹 `MarginPaddingType.ts` carried a **literal NUL byte** inside the `sidesAgree` sentinel string,
   which made the whole file read as *binary* to `grep` (`git diff` still shows `Bin` against the
   old blob). Removed.

### Gate

```
cd packages/noodl-editor && npm run test:main -- tests-unit/rel-014
```

**The revert that reddens it**, per site:

- `MarginPaddingInput`: restore `const parsed = parseFloat(text); const value = isNaN(parsed) ?
  undefined : { value: parsed, unit }` in place of `commitMarginPaddingEdit` — or change
  `readMarginPaddingEdit`'s `refuse` arm to return `{ kind: 'clear' }`. Either reddens the AC2/AC4
  cases and the AC5 table.
- `MarginPaddingType.refreshDefault`: drop the `isMarginPaddingToken` branch — reddens
  *"the four tokens a new Text Input is born with reach the widget as tokens"*.
- `BasicType.onChange`: restore `parseFloat(String(value))` → `isNaN ? undefined` — reddens AC1,
  AC2, AC4 and the AC5 table for the plain number port.
- `BasicType`'s `key`/`refusals`: remove — reddens *"the refusal is visible"*.
- `PropertyPanelNumberInput.handleUpdate`: drop the passthrough branch (or make
  `readNumberInputText` return `{kind:'number'}` for everything) — reddens the caller pair.
