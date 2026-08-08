# LAS-008 — Fix `DESIGN_AUTHORING`, pin the doctrine against drift

**Status:** ✅ done 2026-08-08 · **Track 3 (drift)** · fixes audit **F1**

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

- ✅ The tripwire spec exists, failed before the fix (note it in the commit message), passes after.
  [`tests-unit/phase-55/designAuthoringPrompt.test.ts`](../../../packages/noodl-editor/tests-unit/phase-55/designAuthoringPrompt.test.ts)
  — 3 failed / 6 passed against the shipped text, 9/9 after.
- ✅ `typecheck:editor` clean; editor jest **72 suites / 982 specs**, up from phase-54's 71/973 by
  exactly this one suite's 9 — the count compared, not the colour.
- ✅ Sweep recorded below.

## The sweep — every place prompt text lives

`grep -rniE "wrapped (flex )?(row|group|grid)|percentage width|does not shrink its children"` over
`packages/` and `docs/`, minus `node_modules` and bundles. Five real hits, **one** of them wrong:

| Location | Verdict |
|---|---|
| `design.ts:250` (`DESIGN_AUTHORING`) | ❌ **the defect** — prescribed the wrapped row, never said `Columns`. Rewritten. |
| `design.ts:187-192` (doctrine §8) | ✅ correct — describes the trap and ends "**Prefer `Columns`** … a wrapped Group cannot collapse at any width". |
| `design.ts:172` (doctrine §7) | ⚠️ correct in context but not self-contained — "the gutter between columns" (lower-case prose) sat one bullet away from its own subject. Tightened to "the gutter between `Columns` tracks" so the sentence names its alternative without relying on the heading. |
| `docs/node-catalog/examples/ui-card-grid-repeater.json` | ✅ correct — leads with `Columns`/`autoFit`, then "Do NOT reach for a Group with flexWrap". |
| `docs/node-catalog/examples/ui-split-hero.json` | ✅ correct — "an UNWRAPPED row shrinks them to half each". |
| `node-catalog-enriched.json` / `enrichment/net.noodl.visual.columns.json` (`marginY`) | ✅ not advice — a factual port description of Group's vertical gap between wrapped rows. |
| `ProjectDocs/docsText.ts` (the `CONVENTIONS.md` template) | ✅ nothing to sweep — it carries no layout advice at all. |

**So HANDOVER premise 3's correction had landed everywhere except the one string that ships on every
turn.** The recipes were fixed; the per-turn preamble was not. That asymmetry is the finding.

## What replaced it

The paragraph now compresses Richard's §7 rather than contradicting it — `Columns` as the
multi-column default, `autoFit`+`minWidth` for repeats, `layoutString`+`mediumLayout`/`smallLayout`
for a fixed arrangement — and keeps the earned half (per-record connections, the `visible`-falsiness
trick) verbatim. 720 → **697 chars**, inside the per-turn budget the spec now enforces.

## Register

| # | Finding | State |
|---|---|---|
| 1 | `DESIGN_AUTHORING` taught the wrapped-row pattern and never named `Columns` — shipped into every in-editor authoring turn (audit F1) | ✅ fixed, tripwire-pinned |
| 2 | Doctrine §7's `marginX` bullet described the wrapped-Group trick without naming `Columns` in the same breath — correct under its heading, wrong if read alone (and a model reads bullets alone) | ✅ tightened |
| 3 | The `ui-*` recipes and the enriched catalog were already correct. The correction had reached the retrievable material and missed the pushed material — **fixing the docs is not fixing the prompt** | 📌 noted, informs LAS-007 |
| 4 | The tripwire is paragraph-scoped over an **explicit list** of exported constants. A new prompt constant is not covered until it is added to `PROMPT_CONSTANTS` | ⚠️ accepted limit, documented in the spec |
