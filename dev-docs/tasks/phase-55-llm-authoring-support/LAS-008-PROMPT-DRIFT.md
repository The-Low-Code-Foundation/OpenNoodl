# LAS-008 — Fix `DESIGN_AUTHORING`, pin the doctrine against drift

**Status:** 📋 open · **Track 3 (drift)** · fixes audit **F1** · small — pair it into a gates
session

## The defect, verified

The 556-char per-turn authoring preamble `DESIGN_AUTHORING`
([design.ts:246-252](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/design.ts#L246))
still teaches:

> "a grid item needs its own percentage width (a wrapped flex row does not shrink its children)"

— the wrapped-row pattern that §7/§8 of the *same file's* full doctrine deprecates ("a wrapped
Group cannot collapse at any width. Prefer `Columns`"), and it never says the word `Columns` at
all. It ships in **every in-editor authoring turn** via
[authoring.ts:164](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/authoring.ts#L164).
This is HANDOVER wrong-premise #3 surviving in the one string that always reaches the model —
found by the audit as the predicted "fourth wrong premise", alongside the never-built Strands
harness (documented, memory corrected, nothing further to do there).

Sonnet's replay shows the cost is real: an otherwise-excellent build shipped **zero `Columns`
nodes**, its grids collapsing at 390px only by luck of fixed card widths.

## Build

1. **Rewrite the paragraph.** Derive from Richard's §7 — the constraint is the doctrine text is
   his; compress, do not compose from taste. It must name `Columns` as the multi-column default
   (autoFit for repeated content, layoutString + breakpoints for fixed arrangements), keep the
   per-record-connection / `visible`-falsiness sentence (that half is correct and earned), and
   stay within per-turn budget (~600 chars — it rides every authoring request).
2. **Sweep for the deprecated advice** everywhere prompt text lives: `authoring/prompts/*.ts`,
   the style vocabulary strings, the `ui-*` example descriptions, `docs/CONVENTIONS.md` template
   output. HANDOVER premise 3 says a recipe shipped the wrapped-grid guidance before being caught
   — confirm the correction actually landed in every copy.
3. **The tripwire spec.** A jest test over the *exported prompt constants* asserting: (a)
   `DESIGN_AUTHORING` contains `Columns`; (b) no exported prompt/doctrine constant matches the
   known-bad phrasings ("percentage width" + "wrapped" without "Columns" in reach — write the
   assertion against the actual strings, tight enough to catch the regression, loose enough not
   to fight legitimate edits). Write the check FIRST, watch it fail on today's string, then fix —
   the phase-39 habit, and the check is the deliverable that outlives the fix.

## Acceptance

- The tripwire spec exists, failed before the fix (note it in the commit message), passes after.
- `typecheck:editor` + editor jest green, counts compared.
- Grep transcript of the sweep recorded here (which files were checked, which needed changes).

## Register

| # | Finding | State |
|---|---|---|
| — | | |
