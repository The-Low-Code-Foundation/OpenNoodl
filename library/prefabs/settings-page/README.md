# Settings Page

A settings form in three sections, and a save bar that is **not there** until
something has actually changed.

```
┌──────────────────────────────────────────────────┐
│  Settings                                        │
│  Manage your profile and how we get in touch.    │
│                                                  │
│  ┌ (◕) Profile ───────────────────────────────┐  │
│  │  Display name  [ Ada Lovelace          ]   │  │
│  │  Email address [ ada@example.com       ]   │  │
│  └────────────────────────────────────────────┘  │
│  ┌ (🔔) Notifications ────────────────────────┐  │
│  │  Email digest  [ Once a week          ▾]   │  │
│  │  ☑ Product updates    ☐ Weekly report      │  │
│  └────────────────────────────────────────────┘  │
│  ┌ (🎨) Appearance ───────────────────────────┐  │
│  │  Theme         [ Match my system      ▾]   │  │
│  └────────────────────────────────────────────┘  │
│  ⚠ 1 unsaved change      [Discard] [Save changes]│  ← only when dirty
└──────────────────────────────────────────────────┘
```

Without the dirty tracking this is just a form, so that is the part this file
is about.

| Input | What it does |
|---|---|
| `Settings` | The record to load: an object (or a Record) with `Display Name`, `Email`, `Digest`, `Product Updates`, `Weekly Report`, `Theme`. Unconnected, a sample record renders instead, so the component shows what it is the moment you place it. |
| `Title` / `Description` | The page heading. Unconnected, the built-in copy stands. |

| Output | When |
|---|---|
| `Values` | The values as they stand now — read this when `Saved` fires and write it wherever settings live. |
| `Is Dirty` | True while at least one field differs from what it loaded with. |
| `Change Count` | How many fields differ. |
| `Saved` | **Save changes** was pressed. |
| `Discarded` | **Discard** was pressed. |

Saving is deliberately *not* done here. The page tells you what changed and
when to write it; where it goes is your graph's business — a Set Record, a REST
call, a Cloud Function. What it does own is the baseline, so pressing Save
re-bases "unchanged" on the values you just saved.

## The graph

```
Static Data ─┐
             ├─> Choose settings ─> Settings state ──> field values (6)
Settings ────┘                        ▲   │      └───> Is Dirty ──> Save bar.Mounted
                                      │   │      └───> Summary  ──> Save bar text
   Save.onClick ──> Counter ──────────┤   │
Discard.onClick ──> Counter ──────────┤   │
                                      └───┘  out-State ──> in-State   (self-loop)
```

Everything else is `Text Field`, `Select Field` and `Toggle Field` — the same
chrome as the `form-fields` prefab (40px controls, 6px radius, `--border`,
`--ring` on focus, helper text underneath), so the two sit together.

## Six things that look right and are not

Every one of these is a *measured* failure on this shape, not a worry. The first
is the one that shipped broken and was caught by the first render.

**A control's value output already has a value before anything runs, and making
a connection copies it.** `Node.connectInput` reads the source output's current
value and pushes it into the target the moment the wire is created — unless it is
`undefined`. A **Dropdown** seeds its own `Value` to its first default option and
a **Checkbox** seeds `Checked` to `false`, both in `initialize`, so both outputs
are already defined then; a **Text Input**'s `Value` is not, so its copy is
skipped. The first build of this page therefore started life believing the two
dropdowns held `option-1` and the two checkboxes held `false` — before the loaded
record had reached either — and, because the value outputs *mirror* what the
controls say, it echoed those defaults straight back and never delivered the
loaded values at all. On screen: two empty dropdowns, two unticked boxes, two
correct text fields, and a save bar reading **"3 unsaved changes"** (`option-1` ≠
`weekly`, `option-1` ≠ `system`, `false` ≠ `true`; the fourth field's `false`
happened to match). One defect, four symptoms, and the text fields were fine for
a reason.

The fix is a `settled` flag per field, kept in the tracker's state: **a control
is not believed until it has agreed with the baseline at least once.** Until it
does, it is handed the baseline again on every run — which costs nothing, since
an unchanged output publishes nothing — and it is invisible to the change count.
That makes both halves impossible by construction: the loaded record arrives
whatever a control claimed about itself beforehand, and nothing can be counted as
changed before it was ever set.

**A naive comparison shows the save bar on load anyway.** At boot the loaded
record has arrived but a control may not have reported, and `undefined` is not a
difference — it means "has not reported". That guard is still there; `settled` is
the stronger one above it.

**The tracker keeps its own memory, and it must not re-run on it.** A Function
holds nothing between runs, so `Settings state`'s `State` output is wired back
into its own `State` input with *Run on value change* **unticked**
(`runOnChange-in-State: false`). The value still arrives — only the *re-run* is
suppressed — so the next run reads it. Ticked, the node re-runs on the state it
has just written; that is the shape that walks a Stepper to its last step on one
click.

**`Save presses` and `Discard presses` are Counters, not remembered booleans.**
A Counter publishes `0` at load, so the tracker has run before anybody presses
anything. A Function with no input that ever arrives never runs at load, and then
the first press is silently consumed as the boot run it never had. (Their
`Limits Enabled` is *off*: enabled with no `Max Value`, the max is `0` and
`Increase` never moves — Save and Discard become dead buttons that look wired.)

**Discard would work exactly once if the outputs parked on the baseline.** A
Function output only publishes when it **changes**. An output that has held the
baseline since load cannot re-send it, so the second Discard would do nothing at
all while the graph looked perfectly correct. The six value outputs therefore
mirror whatever the controls currently hold — once settled — and swing to the
baseline on a Discard, which is always a real change.

**Reverting a Text Input needs the blur as well as the value.** Unlike the
Dropdown and the Checkbox, a Text Input does not update its own copy of the text
when you type into it, and `setText` abstains while the field has focus. So
`Discard` is wired to each text field's **`Blur` and `Set`**, and the order they
arrive in does not matter — `Blur` runs synchronously as the click is dispatched,
`Set` is deferred until after the inputs have updated. A real user's click on
Discard also blurs the field through the viewer's own click handling; a *driven*
click does not, which is why the wire is there.

### One thing to know about the Drop Down node

A Dropdown whose `Value` matches none of its `Items` has `selectedIndex === -1`,
and then it draws **nothing at all** — no label, and at `contentSize` no width
either. That is the empty box above, and it is the same shape as a Dropdown that
renders as a collapsed bar. It is not a bug in the node; its own source records
the behaviour. But it means a mismatch is invisible rather than obvious, so every
Dropdown here carries a `Placeholder` ("Select an option"): if a value ever fails
to match, the field says so instead of vanishing.

## What a drive has to assert

A sequence, not a final state — the final state was right in every prefab that
failed its first drive. In order:

1. **At rest**: no save bar (`Is Dirty` false, no Save/Discard buttons in the
   DOM), and the fields already show the sample record.
2. **Type into Display name**: the bar appears, and says `1 unsaved change`.
3. **Type into it again** (a second field, or more of the same one): the count
   moves, and does not double-count one field.
4. **Discard**: the bar goes, *and the field reads `Ada Lovelace` again*. Assert
   the field, not just the bar — the bar going is the easy half.
5. **Type again, then Save**: the bar goes and `Saved` fires once.
6. **Type again, then Discard**: the field goes back to the value **saved in
   step 5**, not to the one the page loaded with. This is the step most likely
   to be wrong, and it is invisible in every earlier step.
7. **Discard twice in a row** (edit, discard, edit, discard): the second one
   must revert too. A Discard that publishes a value it has already published
   does nothing.
