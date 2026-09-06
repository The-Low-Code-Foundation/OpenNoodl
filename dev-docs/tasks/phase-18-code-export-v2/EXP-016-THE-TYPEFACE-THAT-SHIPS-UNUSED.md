# EXP-016 — The typeface that ships unused

**Status:** 🟢 **BUILT, GATED AND DRIVEN — session 97, 2026-09-06.** All six acceptance criteria
graded below. `tests/the-typeface.test.ts`, 14 rows; four mutation arms, 4/4 killed. Driven: body,
heading and button all compute Inter in the running export, and `document.fonts` moved from
**four faces `unloaded`** to four `loaded`.
**Owner:** P18. **Opened by:** the TPL-003 landing-pages export drive, 2026-09-06.
**Priority:** 🟡 Medium. Visible on every page and cheap, but it degrades to a legible page rather
than an unreadable one, so it sits behind EXP-014 and EXP-015.
**Difficulty:** 🟢 Low. The scaffold writes one wrong declaration; the runtime's correct one is a
single line of source to copy.

## Objective

The exported app renders in the project's typeface. Today it downloads four Inter weights, links
their stylesheet, defines a token that names Inter first — and then renders every word in the
platform UI font, with buttons falling through to Arial.

## What is true today (measured 2026-09-06, running app)

1. **Everything needed is present and correct.** The emitted `index.html` links
   `/noodl_modules/inter/styles.css`; the four TTFs travel through the `copies` channel;
   `src/styles/tokens.css:186` defines `--font-sans: "Inter", system-ui, -apple-system, "Segoe UI",
   sans-serif`. `document.fonts` reports **4 Inter faces loaded** in the running app.
2. **And nothing uses it.** `src/styles/base.css:10` writes `font-family: system-ui, sans-serif` on
   `body` — a literal, not the token. Measured computed values in the running export:

   | element | computed `font-family` |
   |---|---|
   | `body` | `system-ui, sans-serif` |
   | section heading | `system-ui, sans-serif` |
   | hero headline | `system-ui, sans-serif` |
   | a button | **`Arial`** |

   The buttons are the tell: a `<button>` does not inherit `font-family` from `body` without being
   told to, so it lands on the UA default while everything else lands on the wrong-but-deliberate
   `system-ui`. Two different wrong fonts on one page.
3. **The runtime's rule is one line and it is the thing to copy.**
   `models/StyleTokensModel/TokenResolver.ts:155` emits, after the `:root` block:

   ```css
   body {
     font-family: var(--font-sans);
     color: var(--foreground);
   }
   ```

   Note the second declaration. The export's `body` sets no `color` either. Text nodes carry their
   own colour so the pages look right today, but the default a user's own added markup inherits
   differs between the two renderers, and copying half a two-line rule is how that stays true until
   somebody adds a `<p>` by hand.
4. **The control.** The same project through the NodeGX viewer computes
   `Inter, system-ui, -apple-system…` on the same headline. Same project, two renderers.
5. **The shipped default that makes this a real divergence rather than a preference.** Inter's
   `manifest.json` states the intent plainly: *"styles.css declares the four weights the shipped
   Text/Button defaults reference (400/500/600/700) and is what makes `var(--font-sans)` resolve to
   Inter. Delete this folder and the design token falls back to the platform UI font; nothing
   breaks."* The fallback is designed for a **deleted** folder. Here the folder ships and the
   fallback fires anyway.

## Acceptance criteria

1. ✅ **The scaffold's `body` rule matches the runtime's**, both declarations: `font-family:
   var(--font-sans)` and `color: var(--foreground)`. Emitted by `emit/scaffold.ts` into `base.css`.
2. ✅ **Form controls inherit.** `button, input, select, textarea { font: inherit }` (or an
   equivalent the spec pins), so no element on the page reaches a UA default. Grade the button
   explicitly — it is the arm that was wrong in a second, different way.
3. ✅ **The token is the only name for the typeface.** No literal `"Inter"` anywhere in the emitted
   CSS outside `tokens.css`'s own definition. A project that overrides `--font-sans` re-fonts the
   whole app, which is the behaviour the token exists for.
4. ✅ **The fallback still works.** A project with **no** `noodl_modules/inter` exports, builds and
   renders in the platform UI font with no missing-resource error and no dangling `<link>`. This is
   the manifest's documented case and it must not regress — it is also the arm that proves AC1 is
   reading the token rather than hardcoding a different literal.
5. ✅ **Measured in the running app, not the source.** The computed `font-family` on `body`, on a
   heading and on a button all resolve to Inter, and `document.fonts` shows the faces in use. A
   source-text assertion passes on a rule that a later cascade overrides.
6. ✅ **Gates.** `nodegx-export` tsc 0 and jest green; the scaffold fixtures update as one change;
   editor tsc 0; `export-ledger:check` OK; picker floor unchanged.

## What was built — session 97, 2026-09-06

**Shape.** `emit/scaffold.ts` `baseCss()`, three lines of output. The `body` block is the runtime's
own, transcribed from `TokenResolver.generateCss` — `font-family: var(--font-sans)` and
`color: var(--foreground)`, both, because copying half a two-line rule is how the halves drift. Then
`button, input, select, textarea { font: inherit }`: a `<button>` does not inherit `font-family`
from `body`, which is why the buttons were wrong in a *second, different* way from everything else
on the page. A node's own class still wins — a class selector outranks these element selectors
whatever the sheet order.

🔴 **A `var()` fallback was written, and then measured away.** The first version emitted
`var(--font-sans, system-ui, sans-serif)`, reasoned from "39 of this package's 40 fixtures have no
`designTokens` in their `nodegx.project.json`, so a bare `var()` naming an undefined token would
drop the body to the browser's serif". That reasoning was **wrong, and the spec caught it**:
`parseProject`'s `effectiveTokens` merges the shipped `DEFAULT_TOKENS` underneath every project, and
both `--font-sans` and `--foreground` are in that set, so `tokens.css` carries them whether or not
the author ever opened the token editor. The fallback was a divergence from the runtime with no
measurement behind it; it is gone, and `§D` pins the fact that makes the bare `var()` safe.
✅ a "token-less project" inferred from a project file is not a token-less project — read what the
parser emits.

**The grading (AC5), in the running app, both arms.** The reverted arm is a real
`git worktree add --detach HEAD` export, built and served beside the fixed one:

| computed on `templates/landing-pages` installed, `/freelancer` | before | after |
|---|---|---|
| `body` `font-family` | `system-ui, sans-serif` | `Inter, system-ui, -apple-system, "Segoe UI", sans-serif` |
| `body` `color` | `rgb(0, 0, 0)` (nothing set it) | `rgb(31, 26, 23)` = `--foreground` |
| the 94px hero headline | `system-ui, sans-serif` | `Inter, …` |
| a `<button>` | **`Arial`** | `Inter, …` |
| `document.fonts` | **`Inter 400/500/600/700 unloaded`** | `Inter 400/500/600/700 loaded` |

🔴 **The `document.fonts` row is a correction to §1 and it is the sharper instrument.** §1 recorded
"4 Inter faces loaded" before the fix. Measured cold on the reverted arm, the four faces read
**`unloaded`**: the stylesheet *declares* them, and a browser does not fetch a face nothing uses. So
the pre-fix app downloaded the four TTFs into `dist/` and never sent a single request for them.
`unloaded` → `loaded` is a one-word readout of this whole task, and it is the row to take first on
any repeat, exactly as §"Fixture warning" says.

**The control.** §4 recorded the viewer computing `Inter, system-ui, -apple-system…` on the same
headline. The exported app now computes the same string from the same project directory.

**Gates.** `nodegx-export` jest 83 files / 3126 rows exit 0 · package `tsc` 0 · editor `tsc` exit 0,
empty log · `export-ledger:check` OK 176/124 · picker 117/127 unchanged · editor `test:ci` 2943
specs, 4 failures = the floor by name (AIX-006 ×4, seed 61662). Scaffold fixtures: nothing pinned
`base.css`'s content anywhere in the package before this task, which is why nothing moved — the new
spec is the pin.

## Not in scope

- Font loading strategy — no preload, no `font-display` tuning, no subsetting. Copy the runtime.
- Which typeface a project uses. This task makes the export honour the project's choice.
- Any other divergence in `base.css`. If the reset diverges elsewhere, register it as a row here
  rather than widening this task silently.

## 🔴 Fixture warning

Export an **installed** project — see [EXP-014](./EXP-014-THE-GROUND-THE-HEADLINE-SITS-ON.md)'s
warning for the three copies that build one. This task is the one most affected by getting it
wrong: exported from the bare `templates/landing-pages/` directory there is no
`noodl_modules/inter` at all, the `<link>` dangles, and the missing font reads as this defect when
it is only a missing fixture. **The 4-faces-loaded reading in §1 is what separates them**, and any
session working this task should take that reading first.
