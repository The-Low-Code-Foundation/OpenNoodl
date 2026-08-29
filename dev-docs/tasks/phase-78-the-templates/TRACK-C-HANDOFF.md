# Track C — handed to phase 80, with the measurements already taken

**Written 2026-08-29 (P78 s8) for whoever picks these up.** Richard scoped the members'-area repair
into three tracks and ruled that **Track C is phase 80's**, not phase 78's: it is product source
(`StyleCompositions.ts`, the viewer's control CSS), and this phase has deliberately never touched
editor source — that isolation is what has stopped it colliding with P77/P80 all week.

🔴 **Everything below is measured, with file and line.** Lift it wholesale; do not re-derive it. The
last time a phase-78 finding sat in a chat message instead of a task file it cost a day — phase 80's
own words on D20: *"an agreement is not an owner."*

---

## C1 — 🔴 D26: the kit has exactly one content surface, and the second one is already a token

**Why this is the highest-leverage item on the list.** Richard, on first seeing the finished landing
page: *"It's definitely got that standard bootstrap feel about it."* Touring all eleven pages says
why, and it is not the template's styling.

### The measurement

`packages/noodl-editor/src/editor/src/models/StyleTokensModel/StyleCompositions.ts` — every
`backgroundColor` in the file:

| line | composition | fill |
|---|---|---|
| 120 | `bandSurface` | `var(--surface)` |
| 170 | `card` | `var(--surface)` |
| 206 | `primaryButton` | `var(--primary)` |
| 228 | `outlineButton` | `transparent` |

So of eighteen compositions, **two carry a content fill and both are the same value.** The other two
are the buttons. There is exactly one way to make something look like a distinct object.

The consequence, counted on the shipped template: **nine kinds of thing wear that one box** —
announcement rows, meeting rows, request rows, directory rows, notices, form panels, the moderator
toolbar, the landing tiles, and the setup card. An agent told to style on-system reaches for the only
surface there is, every time. That is the Bootstrap feel, and it will hit **every** template we ship.

### 🔴 The part that makes this cheap

**`--surface-raised` (`#ffffff`) is already in the token set and no composition reads it.**

```
compositions referencing --surface-raised : 0
node parameters painting it in members-area : 0
declarations of it in the project token block : 1
```

This is the same shape as the standing lesson *a token nothing reads is a theme nobody sees*. The
second surface does not need designing — it needs a reader. The work is a composition, not a palette
decision.

### What phase 78 would ask for (not a design ruling — yours)

⚠️ **Not more variants of `card`.** Ten flavours of filled-rounded-hairline would not help. What is
missing is *contrast between* compositions:

- a **raised** treatment reading `--surface-raised` on a `--surface` ground (the token pair already exists), and
- a **ruled** treatment — a row separated by a hairline rather than boxed — so a list of things stops
  looking like a stack of cards.

⚠️ **The other half is ours and we own it.** The template uses **none** of `band`, `bandSurface`,
`cardImage`, `columnsTwoUp`, `gridAutoFit` — five of eighteen, and precisely the ones that create
layout variety. Phase 78 is fixing that in Track B and it is not phase 80's problem. C1 is the part
that no template can fix for itself.

### Blocks

Phase 78's **B3** (make a row look unlike a panel) is capped until C1 lands. Everything else in
Track B proceeds without it.

---

## C2 — 🔴 D18 / D19: nine of ten control classes never receive the app's font

**Small, unowned, and currently visible in five of the eleven screenshots.** If only one thing in
Track C gets done, this is the cheapest.

### The measurement

`packages/noodl-viewer-react/src/assets/style.css` contains **exactly one `font-family` declaration
in the whole file**:

```
 98:  .ndl-controls-select {
…
107:    font-family: inherit;
```

Ten `.ndl-controls-*` classes ship — `button`, `textinput`, `checkbox`, `radio`, `radiobutton`,
`range`, `fieldset`, `abs-center`, `pointer`, `select`. **One** inherits the page font.

Rendered, on `Pages/Landing` and `Pages/Post` of the shipped template, via `getComputedStyle`:

| element | `font-family` |
|---|---|
| `Text` nodes (eyebrow, headline, blurb, labels' siblings) | `Source Sans Pro` ✅ |
| `net.noodl.controls.button` — every button on every page | **`Arial`** |
| `net.noodl.controls.textinput` → `<input>` | **`Arial`** |
| the same node with `type: 'textArea'` → `<textarea>` | **`monospace`** |

D19 is the same family, smaller: a control's own `<label>` renders pure `#000` rather than
`--foreground`, while the input's text beside it is correctly tokenised.

### 🔴 The line that must change with it, or the defect regenerates

`StyleCompositions.ts:382` — the `body` composition's description:

> *"Never set `fontFamily` — the project body already carries `var(--font-sans)`."*

True for `Text`. **False for `<button>`, `<input>` and `<textarea>`, which do not inherit
`font-family` from `body` in any browser.** This is what an agent reads *before deciding not to set a
font*. Repair the CSS and leave that sentence, and the next generator writes the same defect.

### Why it is not DEF-001

Ruled with phase 80 on 2026-08-29 and recorded in
[THE SWEEP](../phase-77-the-site-builder-rescue/THE-SWEEP-2026-08-29.md): **D18 is a fidelity defect,
not an accessibility one.** Monospace is perfectly legible; it is simply not the app's typeface.
Filing it under an a11y-scoped task would widen that task silently. D19 is genuinely either way.

⚠️ **`select` is the one control that would have looked right.** Anyone who spot-checked "does the
app's font reach the controls" using a dropdown would have seen it work and stopped — which is a
plausible account of how this survived into a shipped template, and a reason to distrust
single-control checks of any design token.

---

## C3 — D20: already yours

Filed by phase 80 at `f9367dc7` as **DEF-006 §0(c)**. Noted here only so the three C items read as a
set. Its stated relationship to D10 stands: D20 is the *mechanism* behind D10, so fixing it may make
D10 fixable without fixing it, and **D10 must be re-measured rather than closed on it**.

---

## What phase 78 is doing meanwhile

Track A (five template bugs: D22–D25 plus a primary action on the five pages that have none) and
Track B (a header carrying the association's name, real navigation, the type ramp, and the five
unused layout compositions). None of it touches editor source. **B3 waits on C1.**
