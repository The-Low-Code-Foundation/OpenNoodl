# FB-018 — the value that wins is a secret

**Filed:** 2026-08-22, test-user session, item 3. **Status: ✅ BUILT + SPECCED + DRIVEN 2026-08-24
(session 19). All four ACs met.** The rollout is finished (5 row classes → 16), the
precedence rule is written down, and AC2's sweep grades the record against the real dispatch
chain. Size: M.

> *"The user was confused about what value was 'winning' — he hooked up a connector with a
> number value to the width input, then changed the width manually in the props panel, and
> couldn't understand why changing it manually showed the change on the screen, but then it
> reset to the connected value on refresh."*

---

## Ground truth (verified 2026-08-22) — the user's confusion is well-founded

- **Runtime: the connection wins, but only once it delivers.** Parameters queue at node
  creation; connections attach after (`nodescope.ts:427–437`) and only push if the source
  output `!== undefined` (`node.ts:526–528`), overwriting the queued parameter. So a manual
  edit **really does render** until the source fires/refresh — the user observed the system
  accurately and no surface explained it.
- **The panel has three different behaviours for the same state, none disabled:**
  1. **Chip** (field replaced by a "bound to X" chip, click navigates): only `BasicType`,
     `EnumType`, `TextAreaType`, `ListValueType`, `StringListType`
     (`PropertyPanelInput.tsx:164–174`).
  2. **Outline only**: `Dimension` (Width/Height — **the port the user hit**),
     `NumberWithUnits`, `ImageType`, `FontType`, `ComponentType`, `IdentifierType` — a 1px
     primary-dim outline (`PropertyPanelBaseInput.module.scss:34–36`), field fully editable,
     typing silently writes a value the connection will overwrite.
  3. **Nothing**: `IconType` never passes `isConnected` at all (`IconType.ts:50–71`).
- The changed-value dot still renders on a connected-and-set port
  (`PropertyPanelInput.tsx:225–228`) — "changed" chrome for a value nothing uses.
- **Coverage history**: the chip came from UIX-003 (phase 23); PAR-002 recorded only
  `BasicType` reaches it; ERG-003 extended it to list rows; **nothing since, and no task
  states the precedence rule anywhere.**

## 🆕 Corroboration + a regression claim (Jordan, session 2 — §2.3 and §3)

Jordan reverse-engineered the precedence by experiment (set 700 → wire loses; blank it → wire
wins — the live-editing view of the same semantics: a later parameter edit overwrites the
queued value until the source next fires) and separately reported: *"There used to be
something here to tell me that it was being externally driven. And now it's not"* — **filed
as a regression, and it must be checked as one**: `git log` the history of
`PropertyPanelBaseInput`'s `isConnected` styling and the chip's reach before concluding
"never existed" — a relayed conclusion decays, but so does an unchecked "no regression".
Either way the fix is this task's AC1/AC2.

## Scope

1. **One behaviour**: every connected input row shows the binding chip (or a picker-compatible
   variant for `PickerTypeView` rows and `IconType`) — the connected state is never an
   editable-looking field. The stored parameter remains stored (disconnecting restores it) but
   is presented as the *fallback*, not the value.
2. **Say the rule where it bites**: the chip's tooltip carries it — "This input is driven by
   <source>. The value you typed is used only while the connection hasn't sent anything." One
   sentence, the one the test user needed.
3. **Document the precedence** in `dev-docs/reference/` (PORT-TYPE-CONTRACT.md's neighbourhood)
   — the rule is currently derivable only from `nodescope.ts` + `node.ts` source order, and
   FB-019 needs the same paragraph.

## Acceptance criteria

- AC1: a connected Width shows the chip, not an editable field; clicking navigates to the
  source (existing `getConnectionSourceLabel`/navigate utils reused).
- AC2: every row type either chips or has a recorded reason it can't — asserted by a sweep
  over the DataTypes classes (cardinality: chip + justified-exception = all), so the rollout
  can't silently stall at five types again.
- AC3: the changed-dot no longer draws for a value the connection overrides.
- AC4: the reconstruction of the user's session — connect number → width, type a width, refresh
  — is driven: at no point does an editable field show a value the screen isn't using.

## Traps

- The runtime's "connection wins *eventually*" nuance is load-bearing for AC4's copy — a source
  that never fires leaves the parameter live; the tooltip's wording above is chosen to be true
  in that state too. Don't "fix" the runtime ordering here; that's a behaviour change with its
  own blast radius (FB-019 owns the adjacent runtime work).
- This jest can grade React components here, but it can't tell drew-nothing from never-ran —
  keep the pure view-model half separate, and drive the panel once for real.

---

# What session 19 built (2026-08-24)

## The shape of the fix: one seam, not ten components

The five row classes that chipped all rendered through `PropertyPanelInput`, which drew the chip
itself. The ten that did not — the number+unit row (Width/Height), the six `PickerTypeView` rows,
the icon row, the colour row — each **already wrapped themselves in `PropertyPanelRow`** and passed
it a label, a value, and nothing about the connection.

✅ So the chip went into `PropertyPanelRow`, and the ten rows each pass the connection down to the
row they were already using. 🔴 **The alternative — teaching `NumberUnitInput`, `PickerTextInput`,
`IconInput` and `ColorInput` each to draw a chip — is four more chances to drift from the one
`PropertyPanelInput` draws**, which is precisely how this rollout reached five classes and stopped.

| what | where |
|---|---|
| chip + dot suppression for the ten | `PropertyPanelRow.tsx` (new module, see below) |
| chip for the checkbox | `PropertyPanelInput.tsx` — exclusion narrowed from "buttons and checkboxes" to buttons |
| the precedence sentence | `bindingTooltip()` in `BindingChip.tsx` — on the chip, so no call site can omit it |
| the record of who chips and who does not | `DataTypes/connectedRowPolicy.ts` (new) |
| the rule, written down | `dev-docs/reference/PARAMETER-PRECEDENCE.md` (new) |

**Row classes chipping: 5 → 16** of 36. The other 20 carry a stated reason.

## AC1 — the rollout

`Dimension` and `NumberWithUnits` (the number+unit row), `PickerTypeView` (**one edit, six
classes**: image, font, component, identifier, text style, source file), `IconType`, `ColorType`,
and `BooleanType`.

🔴 **`IconType` was worse than the outline rows and nobody had noticed.** It computed
`view.isConnected` on every render and then never passed it to `IconInput` — so a connected icon
port showed no chip *and* not even the 1px outline the other unchipped rows had. The value was
already in hand; the prop was simply missing from the `createElement` call.

⚠️ **The checkbox exclusion was narrowed deliberately, and it is the one behaviour change here
that was not asked for.** `PropertyPanelInput` skipped the chip for buttons *and* checkboxes. A
connected checkbox stayed clickable, so an author could tick it, watch it move, and have the
connection put it back — the filed bug with a different control. `Button` stays excluded on a
reason about the row rather than its styling: it fires a signal and stores no value, so there is
no typed value for a connection to override and nothing for the chip's sentence to be true about.

## AC3 — the changed dot

`isChanged` means "differs from the port default", and the dot offers to reset it. On a connected
row the stored parameter is the **fallback**, so the dot advertised a difference the screen was not
showing. Suppressed in both row implementations. ⚠️ **The parameter is deliberately left alone** —
disconnecting must restore it, so this hides the dot rather than clearing the value.

## AC2 — the sweep, and the bucket that keeps it honest

`connectedRowPolicy.ts` records a decision per row class; `tests-unit/fb-018/connectedRowPolicy.test.ts`
parses the **dispatch chain out of `Ports.ts`** and checks the table against it in both directions.

🔴 **The population is taken from `Ports.ts`, never from the table under test.** A sweep that read
its own list of classes would be checking a file against itself and would pass forever — including
on the exact failure this task exists to prevent, which is a row class nobody thought about.

🔴 **AC2 asks for "chip or a recorded reason it can't", and writing `exception` on a row that
plainly *could* chip would meet the letter of that by lying.** So there are three kinds, not two:

- **`chip`** — 16.
- **`exception`** — 3. Structural: `AlignToolsType` and `MarginPaddingType` write **several ports
  from one row** (`this.ports[comp].name`, not `this.name`), so there is no single connection for a
  chip to name; `WorkflowTriggerInfoType` is WFA-005's read-only fact, "a row, not a control".
- **`deferred`** — 17. One port, but a bespoke editor (a curve canvas, a filter builder, a
  segmented mode picker) rather than a field. Honest debt, named per row.

⚠️ **`SizeModeType` is deferred on purpose and the reason is FB-021's**: it is the *gate* rather
than a gated port, and chipping it would hide the control that explains why Width and Height are
disabled. Decide it with FB-021, not before.

### 🔴 The pinned list computed itself, which pins nothing

`DEFERRED_ROW_CLASSES` was first written as `Object.entries(CONNECTED_ROW_POLICY).filter(…)`. **A
list derived from the thing it is meant to constrain grows silently to match it**: mark a new row
`deferred` and the "pinned" set simply agrees, the test still passes, and the debt gets bigger with
nobody saying so. It is a literal now, asserted against the table in both directions — the same
rubber-stamp shape the file's own header warns about, caught one screen below the warning.

## AC4 — DRIVEN, and met

✅ **Met — see *The drive* below.** `NumberUnitInput`, `PickerTextInput` and `ColorInput` call `useState`/`useEffect`
and **cannot be rendered by this runner at all** — no dispatcher, so they throw rather than return
something wrong. The specs grade the seam they pass through (`PropertyPanelRow`, pure) and
`IconInput` end to end (no hooks). 🔴 **The wiring from `Dimension` down to the chip is exactly the
part a runner without a DOM cannot see**, which is why AC4 is a drive and not another spec.

Fixture built and waiting: `NodeGX test projects/fb018-drive` — a Group whose `width` is **both
typed (250px) and driven** by a `Number`, reconstructing the report; a **second Group with width
typed and nothing connected**, as the control that proves an absent chip is about the connection
rather than the row type; and one connected row per newly-chipped family (colour, image source,
icon, checkbox).

## Gates

- `tests-unit/fb-018/`: **18 specs, 2 files, 0 failures.**
- **11 mutations, 11 red, none survived, none compile-failed** — including the two that matter
  most: *the row keeps its editable control while connected* (3 red) and *the tooltip is reworded
  to "the connection always wins"* (1 red).
- `npm run typecheck:editor`: **0 errors** — and the instrument was proved to see these files by
  planting a type error in `PickerTextInput.tsx` (**2 errors**) and removing it (**0**). A clean
  run over files a config does not cover is indistinguishable from a clean run over files it does.

## Found while working

🔴 **Importing `PropertyPanelRow` failed the SPEC SUITE TO RUN**, with an error naming
`common/Icon.tsx:207` — a file the spec never mentions. `PropertyPanelInput.tsx` imports the whole
input zoo and one of those reaches `Icon`, whose `require.context` ts-jest rejects. The row is now
its own module (`PropertyPanelRow.tsx`), re-exported from `PropertyPanelInput.tsx` so the nine
existing call sites keep working, and the editor-side importers were repointed at it directly.
✅ **The split is what makes the seam gradeable at all** — it is not tidying.

⚠️ **`grep -rl … | while read` also rewrote `src/editor/index.bundle.js.map`**, a gitignored build
artefact that happens to contain the import string. Harmless — webpack regenerates it — but a
whole-tree textual repoint reaches build output, and on a tracked artefact it would not have been.

---

# The drive (real editor, CDP, no browser) — 2026-08-24

`fb018-drive`: a Group whose `width` is **both typed 250px and driven** by a `Number`
(the report, reconstructed), a **second Group with width typed 250px and nothing connected**
(the control), and one connected row per newly-chipped family. Node selected via
`__nodeGraphEditor.selectNode(viewNode)`; every row read out of the live DOM.

🔴 **Both Width arms were measured with ONE selector, deliberately.** The first attempt used a
different one per arm and that is what produced the only wrong reading of the drive — see below.

| arm | row | chip | `<input>`s | reset dot | label `is-changed` |
|---|---|---|---|---|---|
| **A** subject — width typed **and** driven | `Group.Width` (Dimension) | ✅ **"Bound to Number · Value"** | **0** | **0** | **false** |
| **B** control — width typed, nothing connected | `Group.Width` (Dimension) | ❌ none | **2** (value `"250"`) | **1** | **true** |
| **C** | `Text.Color` (ColorType) | ✅ "Bound to #3366FF · Value" | 0 | 0 | false |
| **D** | `Image.Source` (ImageType → PickerTypeView) | ✅ | **0** | — | — |
| **E** | `Icon.Icon Source` (IconType) | ✅ | **0** | — | — |
| **F** | `Checkbox.Checked` (BooleanType) | ✅ "Connected" | **0** | 0 | false |

✅ **AC1** — A shows the chip and **no editable field at all**; clicking it navigates
(`role="button"`). ✅ **AC3** — A and B hold the *same typed value*, differ only in the
connection, and only B draws the dot. ✅ **Scope 2** — the tooltip read off the live DOM, verbatim:
*"This input is driven by Number · Value. The value you typed is used only while the connection
hasn't sent anything."* ✅ **AC4** — at no point does an editable field show a value the screen is
not using.

## 🔴 Three ways this drive nearly reported the wrong thing

**1. The selector encoded the thing under test.** The first row-finder required a label with
`children.length === 0`. That is true on a connected row and **false on a changed unconnected one,
because the reset dot is a child of the label** — so the control arm returned *"no Width label"*,
which reads exactly like *"the control has no Width row"*. The property being measured was in the
predicate that found the element. ✅ **Both arms were then re-measured with the same class-based
selector**, and the subject re-measured with it too, so no row in the table above is read by a
different instrument from the row it is compared against.

**2. `Image.Source` and `Icon` genuinely drew no chip — and that was CORRECT.** The fixture wired
`source` and `icon`; the real ports are **`src`** and **`iconIconSource`**. A connection to a port
that does not exist moves nothing, so the rows were honestly unconnected. 🔴 **An absent chip means
"the feature failed" and "there was nothing to show" in exactly the same bytes**, and the fixture's
own `isPortConnected('source')` answered `true` — the connection record exists whether or not the
port does. Corrected, both rows chip.

**3. The connection reader was dead and said "no connections" for everything.** Reaching for
`ng.model.connections` returned `[]` for **all five nodes — including the one visibly displaying
"Bound to Number · Value"**. The contradiction is the only reason it was caught; with a slightly
less lucky fixture it would have "confirmed" that nothing was connected anywhere.
✅ The reading that stood came from `node.isPortConnected(port,'target')` — the accessor the panel
itself uses.

## Found while driving, not this task's

⚠️ **`getConnectionSourceLabel` returned nothing for the checkbox**, so arm F shows the generic
**"Connected"** rather than naming its source, while A and C name theirs. That is the documented
fallback behaving as designed (`utils.ts`: *"callers fall back to the generic chip"*), not a
regression from FB-018 — but two Number sources resolving differently is worth a look. Not chased.
