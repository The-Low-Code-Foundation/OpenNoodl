# AAQ-009 — A bespoke visual identity per project

**Finding:** #9's first half, plus Richard's third lesson: *"So far all the things I've created with
AI in NodeGX have been white background, black text, blue buttons."* His decision on the mechanism
question: **fully bespoke tokens** — not preset-picking, not preset-plus-tint.
**Status:** open

## The mechanism, verified

The infrastructure already exists and the AI path simply never touches it:

- `StyleTokensModel.applyPreset()` bulk-applies token overrides and persists them
  (`StyleTokensModel.ts:263-268, 398-405`).
- The launcher's CreateProjectModal can set a pending preset (`StylePresetsModel.ts:40-75`); five
  built-ins exist (Modern/Minimal/Playful/Enterprise/Soft).
- The AI creation path sets nothing → every AI project is Modern → `--primary: #3b82f6`
  (`DefaultTokens.ts:15-16`) → white/black/blue forever.

## What to build

### Slice 1 — the scope carries a visual identity

The scoping conversation already asks what the app is and who it's for; it now also agrees a **look**:
mood words, palette direction, typographic voice, radius/density character. Recorded on the scope as
structured intent (not hex values — the wizard is a conversation, not a color picker).

### Slice 2 — the agent designs the token set

A design step (in the AAQ-006 session, before any component is authored) turns the identity intent
into a **complete token set**: full palette (primary/hover/foreground, surfaces, borders, semantic
colors), type scale + families, spacing scale, radii, shadows. Written through a `set_design_tokens`
substrate tool onto the `applyPreset` seam. Bespoke means bespoke: the model may *consult* the five
presets as references, but the output is its own set, derived from the brief.

### Slice 3 — the guardrail is a lint, not a floor

Fully bespoke without a floor risks unreadable output, so the tokens are validated mechanically at
submit (blocking, same channel as parameter validation):

- WCAG contrast: every foreground/background token *pair the vocabulary declares as a pair* meets
  4.5:1 (body) / 3:1 (large text, controls against their surface — the muted-button lesson: 143 call
  sites at 1.00:1 taught us pairs must be checked against their own surface).
- Structural completeness: every token name the default set defines exists (a partial set silently
  falls back to Modern for the gaps — the samey look sneaks back through the holes).
- Both themes if/where the token model carries a dark variant — resolve how project tokens interact
  with theme switching (`nodegx:themechanged` recolors the *editor*; what the *viewer* does per
  theme must be pinned down here, verified, and written into this file).

### Slice 4 — distinctness is tested

The three benchmark briefs must come out visually distinct from each other, and none may equal the
default set. Mechanical floor: pairwise token-set distance above a threshold on primaries, font
families, radius character. Richard's eye is the real bar; the mechanical check just prevents silent
regression to blue.

## Decisions taken

- **`set_design_tokens` is declared in [AAQ-005](AAQ-005-ONE-AUTHORING-SUBSTRATE.md) and
  implemented here** — Richard, 2026-08-06. The question was *"does it land in AAQ-005 or AAQ-009?"*
  and the answer is **both**, split along the line AAQ-005 exists to draw: **the declaration is a
  vocabulary question, the behaviour is a styling question.**

  AAQ-005 adds the tool to `packages/noodl-editor/src/editor/src/validation/authoringVocabulary.ts`
  — the one table rendered into both schema languages — so the editor's agent and an external agent
  driving `noodl-mcp` cannot diverge on what a token payload may contain. This task builds slice 2's
  design step behind it, on the `applyPreset` seam.

  What that means for sequencing: **slice 2 is blocked on AAQ-005 declaring the tool**, and nothing
  else here is. Slices 1, 3 and 4 (the identity conversation, the contrast lint, the distinctness
  test) do not touch the vocabulary.

  ⚠️ **The contrast lint of slice 3 is this task's, not AAQ-005's.** A shared vocabulary declares
  the *shape* of a token payload; it cannot know that a foreground and a background token are a
  pair. That knowledge is here, and the muted-button lesson (143 call sites at 1.00:1) is what it
  costs to not have it.

## Acceptance criteria

1. Cold puppy replay: the project's Style Tokens panel shows a bespoke set; the rendered page shows
   it (tokens resolve — seam 3 regression check rides along).
2. The three benchmark briefs produce three visibly different identities; the contrast lint passes
   on all three; zero raw hex in authored parameters (the style lint already exists for this).
3. A user-stated constraint ("our brand green is #1DB954") is honoured exactly, and the rest of the
   set is designed around it.
4. Deleting/regenerating identity is safe: re-running the design step replaces the set through the
   same seam, undoably.
5. The launcher's manual preset flow is untouched (hand-created projects keep their five presets).

## Traps

- Two `colors.css` copies exist (phase-23 memory) — the editor's own chrome tokens are NOT the
  project token system; do not let the design step write anywhere near editor chrome.
- The `url:false` font trap (UIX-001): font tokens referencing families must resolve through the
  project's font pipeline; a named family that isn't loaded renders as serif — which is exactly the
  failure this phase opened on, wearing a new hat. Font *loading* for bespoke families needs an
  explicit decision (ship a curated embeddable font list? Google Fonts at export?) — resolve with
  Richard, record here.
- `fonts.check()` lies (pol-006) — verify font rendering by pixels, not by API.
- AI styling was discarded by four silent mechanisms once already; slice 1 of any verification is
  "did the token set reach the runtime?"
