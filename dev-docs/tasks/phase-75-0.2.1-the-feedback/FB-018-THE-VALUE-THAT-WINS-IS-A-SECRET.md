# FB-018 — the value that wins is a secret

**Filed:** 2026-08-22, test-user session, item 3. **Status: ⬜ open — partial machinery exists
(the BindingChip), stopped rolling out three phases ago; the precedence rule is documented
nowhere.** Size: M.

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
