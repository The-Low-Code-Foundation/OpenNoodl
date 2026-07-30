# PAR-004: The parity deltas the live pass recorded and nobody owned

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PAR-004 |
| **Phase** | Phase 24 — Mock Parity |
| **Priority** | 🟡 Medium — visible, small, and the phase cannot close without it |
| **Difficulty** | 🟢 Low, except the one item that is a feature |
| **Estimated Time** | 2–3 days |
| **Prerequisites** | PAR-001, PAR-002, PAR-003 (all merged and live-verified 2026-07-26) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟢 **Sonnet 5** — the deltas are enumerated and each is mechanically checkable against the mock |

## Objective

Close the residual parity deltas the 2026-07-26 live pass recorded, so phase 24 can
be marked complete on evidence rather than on "close enough".

## Why this is a task and not a note

All three PAR tasks merged and were live-verified from the primary checkout. The
verification log then recorded a list of small deltas "for a PAR-004 polish pass" —
and PAR-004 was never filed. The phase has sat at 🚧 In progress ever since, with
three tasks marked done and nothing saying what remains. This file is that list,
lifted verbatim from the log and given owners.

## Scope — the recorded deltas

### 1. DIMENSIONS row still renders the legacy glyph boxes

The row renders the legacy width/height-mode glyph boxes (a dispositioned
`ResizingType` fallback) rather than the mock's Width/Height rows. The largest of the
deltas and the only one with a design question inside it: revisit as the mock's
Width/Height rows, or record why the glyph boxes stay.

### 2. Alignment icon rows are close to but not exactly the seg-icons container

Measure against the mock CSS. PAR-002 extracted normative values once already; use
those rather than eyeballing.

### 3. The node-name header is a bordered input, the mock shows plain text

Note the prior art: F13 in phase 25 was the same shape one level over — a label
rendered as a permanently-mounted `TextInput` with `isDisabled` toggled — and was
fixed there. Check whether that fix applies here before rebuilding it.

### 4. The launcher sort select shows filter state, not "Last opened"

**This one is not a polish item.** No sort state exists; the control is showing the
only state it has. Either build sorting or change the control to stop implying a
feature that is not there. Decide which, and say so — a select that lies about what
it does is worse than one that is absent.

### 5. Traffic-light inset, light theme, and the ⌘K / ⌘J keystrokes need eyes-on

CDP cannot capture OS window chrome and cannot send app-level keystrokes, so these
were explicitly *not* verified rather than verified-and-passed. They need a human at
the machine. Fold into ALPHA-001's first-hour pass rather than scheduling a separate
sitting — it is walking the same surfaces anyway.

## Out of scope, and where it went instead

The **Material-icons-as-text** bug was diagnosed during this phase's live pass and is
not a parity delta: the Icon node renders `iconIconSource.class` as a CSS class plus
ligature text, and the class only resolves when the project has the matching iconset
module installed. An AI-generated project referencing the class without the module
renders the raw word `dehaze`.

That is a silent-failure class, and its product fix — the semantic validator or the
authoring loop flagging an icon class with no installed iconset module — belongs to
the node-library and validator work, not here. It is recorded in
[ALPHA-004](../phase-33-alpha-launch/ALPHA-004-USER-DOCS.md) §4 as a troubleshooting
entry and remains **unowned as a product fix**. Filing it properly is worth doing.

## Acceptance criteria

1. Deltas 1–3 either match the mock, or carry a written reason they do not.
2. Delta 4 is resolved as a decision — sorting exists, or the control no longer
   implies it.
3. Delta 5 is walked by a human on macOS, in both themes, with real keystrokes.
4. Phase 24's `PROGRESS.md` status moves off 🚧, and its residual-deltas paragraph is
   replaced by the outcome rather than left standing beside it.
