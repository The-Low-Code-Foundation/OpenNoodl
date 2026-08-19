# NAT-003 — Less dark on dark

| Field | Value |
|---|---|
| **Tier** | 1 |
| **Effort** | M |
| **Surface** | `design-tokens`, `core-ui`, `editor`, `platform` |
| **Rulings** | ✅ D1 |
| **Depends on** | **NAT-001**; lands with or after **NAT-002** |

## The job

Richard: *"for the dark mode, let's make it less dark on dark, it's really depressing. Dark mode
can still look friendly and welcoming."*

The measurable half of that is the elevation ramp. `colors.css` documents its intent as
*"page < bg-0 (canvas) < bg-1 (panels) < bg-2 (cards/inputs) < bg-3 (hover/active). Steps are
deliberately distinct."* They are not:

| step | dark | light |
|---|---|---|
| `bg-0` → `bg-1` | **1.06** | 1.13 |

`#0b0e12` → `#12161b` is four points of lightness. A card does not sit *on* the canvas, it dissolves
into it, and with NAT-002's sub-AA grey on top the result is one flat near-black rectangle with
faint writing on it. That is the depression, and it is arithmetic.

Open the dark ramp so each elevation step is visible as a step, and lift the dark end off
near-black so the product reads as *dim*, not *off*.

## Acceptance criteria

1. **Every adjacent elevation step is separated by a stated minimum**, asserted in NAT-001's spec
   as its own table (surface-vs-surface, not text-vs-surface). The minimum is chosen and written
   down with its reasoning — a 1.06 that nobody had a target for is how this happened.
2. The dark canvas is lifted off near-black. `--base-color-neutral-0` (`#07090c`) and `-50`
   (`#0b0e12`) are within 4 points of pure black; the raise is deliberate and the new anchor is
   stated.
3. **Every text pair still passes 4.5:1 after the grounds move.** Raising the backgrounds spends
   contrast that NAT-002 just bought. The two tasks are measured **together** on the final palette,
   never each against its own intermediate state.
4. 🔴 **A control that is not a text pair:** borders and dividers currently readable against
   `bg-0`/`bg-1` are re-measured at 3:1. Lifting the ground can erase a border as easily as it can
   rescue a card.
5. `npm run tokens:sync` re-run, both platform token specs green.
6. The editor is driven and looked at in **dark and light**, on the canvas, a panel, a dialog and
   the launcher — the four places elevation actually stacks. The canvas is the one surface where
   node colours sit on `bg-0` and were tuned against the old value.

## Traps

- 🔴 **The node canvas is the highest-risk consumer.** Node body colours, wire colours and the grid
  were all chosen against today's `bg-0`. This task can make the graph unreadable while every spec
  stays green, because no spec knows what a wire is. Drive the canvas; do not infer it.
- 🔴 **CodeMirror carries its own theme** (`core-ui/src/components/code-editor/codemirror-theme.ts`).
  It reads some tokens and hardcodes others. A ground that moves under a syntax palette that
  doesn't is a new dark-on-dark, in the one place people read the longest.
- ⚠️ **`--theme-color-bg-1-transparent` is `rgba(0,0,0,0.8)`** — a *black* overlay, not a token that
  follows the ramp. Lifting `bg-1` while its transparent sibling stays pure black splits the two
  apart. NAT-001's gate cannot see this (it drops alpha), so it is a reading job.
- ⚠️ "Friendly and welcoming" is not a measurement and this task must not pretend otherwise. The
  arithmetic (step separation, AA, off-black anchor) is the acceptance criteria; the warmth of the
  neutral ramp is **Richard's call on a rendered screen**, and the task ships a proposal for it,
  not a decision.

---

## Done — 2026-08-19

**5 of 6 acceptance criteria met. AC6 is met in part and the gap is named below.**
Editor `4d6658df` (+ the syntax follow-up), platform `ad21f97`.

### The bar, and why it is this number

**Dark 1.15 on every step of `bg-0`→`bg-1`→`bg-2`→`bg-3`→`bg-4`. Light 1.09.**
Asserted as its own table in `tests-unit/nat-001/palette-contrast.spec.ts`, deliberately *not* as
rows in `PAIRS` — that table enforces `min ∈ {3, 4.5}`, and neither number governs two backgrounds.

🔴 **The number is derived from this product, not imported.** The steps that produced Richard's
complaint measured **1.065** and **1.072**; the steps nobody has ever complained about measured
**1.156** and **1.180**. The threshold therefore lies between 1.07 and 1.16, and 1.15 sits above
everything that failed and at-or-below everything that passed. Holding a card edge to WCAG's 3:1
would have been [a gate rejecting a correct answer](../../../packages/noodl-editor/tests-unit/nat-001/palette-contrast.spec.ts) — no dark theme separates a panel from its canvas by 3:1.

⚠️ **Light's 1.09 is a LIMIT, not a preference, and the file says so.** Its raised surface is pure
white and cannot go higher, so the ramp is squeezed between white and the darkest ground AA text
survives on. 1.09 is close to the most that budget affords without darkening the light foregrounds.

### The finding: you cannot open the ramp by moving backgrounds

This is the part worth carrying forward. **The top of the ramp is capped by the AA text sitting on
it.** `fg-default-shy` had 0.17 of headroom on `bg-4`, so `bg-4`'s `(L+0.05)` could rise 3.8% and no
more. Four steps of 1.15 from a *lifted* `bg-0` needs far more than that — with the foregrounds
held still, it would require `bg-0` to be blacker than `bg-page` was. **It is arithmetically
impossible.** So the quiet inks moved with the grounds, which is what AC3 anticipated.

✅ **NAT-002's D11 split is what made it affordable.** Accent *text* went to `azure-300`;
`--theme-color-primary`, the **fill**, did not move at all. Without D11 this task would have had to
lighten the brand azure itself.
⚠️ The step is **two**, and the skipped one is deliberate: `azure-400` measures 4.45 on the new
`bg-4` *and* is `--theme-color-primary-highlight`, which is a link's hover. NAT-002 hit that same
rock; this is it recorded a second time.

| | before | after |
|---|---|---|
| `bg-page` | `#07090c` | `#0e1117` |
| `bg-0` (canvas) | `#0b0e12` (L\* 3.9) | `#161c24` (L\* 10) |
| `bg-1` (panels) | `#12161b` | `#212932` |
| `bg-2` (cards/CodeMirror) | `#181d24` | `#2b3440` |
| `bg-3` (hover) | `#222933` | `#333e4d` |
| `bg-4` (dialogs) | `#2c3540` | `#3c4857` |

⚠️ The ramp is derived by **multiplicative** scaling, not by blending toward white. Blending keeps
the absolute channel spread and so drops the relative chroma — `#0b0e12` would have become
`#191c20`, a flat grey. On a brief that says *friendly and welcoming*, shipping the desaturated
answer would have satisfied the arithmetic and missed the ask.

### AC4 — the control that is not a text pair, and what it caught

🔴 **`border-default` / `-subtle` / `-strong` are literals and did not follow the ramp.** A divider
is not a colour, it is a fixed distance off the surface it divides. With the ground lifted and these
left behind, `border-default` stopped being a hair off `bg-3` (**1.01**) and became a visible line
on it (**1.34**) — the opposite of its job. **VFN-002's negative control is what found it**: that
spec asserts `border-default` is *invisible* on `bg-3` (<1.2), and it went red for a reason that had
nothing to do with dividers. Each is re-placed at the ratio it held against `bg-1`.

### The trap that turned out to be the biggest one: CodeMirror

The task file flagged it and it was right, but not for the reason given — the theme is *fully*
token-driven (70 token reads, zero hardcoded surface hexes). The problem is that its editing
surface is **`bg-2`**, and **`PAIRS` had no syntax row at all.**

🔴 **`colors.css` claimed in a comment that the light syntax values were "all AA on bg-1/bg-2".
Three of them never were.** Measured on the palette as it shipped *before* this task: `type` 4.35,
`number` 4.36, `brace` 4.36, and `meta` 4.12/4.29. Nothing failed because nothing looked.

Nine values moved, and the record says which were this task's doing:

| token | before | after the ramp | now | |
|---|---|---|---|---|
| dark `keyword` | 5.74 | 4.27 | 4.64 | NAT-003 broke it |
| dark `comment` | 5.08 | 3.78 | 4.61 | NAT-003 broke it |
| dark `string-special` | 4.79 | 3.56 | 4.63 | NAT-003 broke it |
| dark `invalid` | 4.71 | 3.50 | 4.62 | NAT-003 broke it |
| dark `meta` | **4.29** | 3.19 | 4.64 | ⚠️ already sub-AA |
| light `meta` | **4.12** | 4.12 | 4.62 | ⚠️ already sub-AA |
| light `type` | **4.35** | 4.16 | 4.63 | ⚠️ already sub-AA |
| light `number` / `brace` | **4.36** | 4.17 | 4.62 | ⚠️ already sub-AA |

Every `--theme-color-syntax-*` token is now graded on `bg-2` in both themes, **generated from the
token list rather than hand-listed** — a hand-listed table is exactly how three of twenty-one went
unwatched. ⚠️ `control` (4.60) and `string` (4.58) survive on thin margins; if `bg-2` moves again
they go first, and the gate will say so.

### The new gate: `tests-unit/nat-003/palette-copies.spec.ts`

Three places keep their own copy of palette values because they cannot read a stylesheet. **That
class of copy has now drifted twice with nothing going red** — NAT-002 caught the canvas scheme
test holding `fg-muted` at a retired value, and a comment saying *"keep this in sync"* is what was
there both times. So this walks the **real source tree** and compares every literal claiming to be
a token's value against `colors.css`.

🔴 **It found 19 on its first run, and five were already wrong before this task**: `bg-1` recorded
as `#11151b` (one digit out), `fg-default` as `#c9d2dd`, `fg-muted` as `#8a97a6` and as `#6b7682`.
All repaired.

### AC6 — the drive, and what it did NOT cover

Editor launched, `uni011-ac3-drive` opened, screenshots read in both themes.

- ✅ **dark**: launcher, rail, side panel (the UNI-011 Community panel), node canvas with node
  cards and wires, toolbar, and a `bg-4` popout (Deploy Options) over the canvas.
- ✅ **light**: rail, side panel, node canvas with node cards, toolbar.
- 🔴 **NOT covered: the launcher in light, and a dialog in light.** Neither was reached before the
  stack came down. ⚠️ **CodeMirror was never opened in either theme** — the syntax numbers above are
  computed, and the one surface this task changed most is the one nobody has looked at. That is the
  honest gap and it should be the first thing the next session does.

Node cards read as raised in both themes: they derive as `mix(bg-1, accent, 0.2)`, so they moved
**with** the canvas — deliberately, since a card that dissolves into its ground still dissolves if
only the ground is rescued. `nodelibraryexport.ts`'s literals were re-derived by the same mix.

### The reading job the task asked for

⚠️ **`--theme-color-bg-1-transparent` stays `rgba(0,0,0,0.8)` and does not follow the ramp.** Its
consumers are scrims and `box-shadow`s — `BaseDialog`, `PopupToolbar`, `popuplayer.css`,
`SideNavigation` — and a shadow is an occlusion, not a surface; a modal scrim's job is to darken
what is behind it wherever the panel ramp sits. **The name is the defect, not the value**, and
renaming a token 20 call sites use is not this task's change.

### Platform (AC5)

`npm run tokens:sync` re-run twice (once after the ramp, once after the syntax fix).
`uni013-token-drift` + `uni013-contrast` **172/172**. Two of the failures there were real, not pins:
`--site-fg-accent` was pointing at the **fill** while every consumer is a `color:` declaration
(4.13:1 on `bg-3`), and `--site-avatar-ink` was reaching the dark ramp through `neutral-0` while
painting a gradient that follows no theme.

### Still open

- ⚠️ **`AskAboutNodeDialog.module.scss` carries a stale comment** — it states `bg-4` resolves to
  `#2c3540`, which is now `#3c4857`. Left alone deliberately: that file is another session's
  uncommitted work and editing it would have swept it into this commit.
- ⚠️ **"Friendly and welcoming" is still Richard's call on a rendered screen.** The arithmetic is
  done and the proposal is shipped; the warmth of the neutral ramp is not something this task can
  mark itself green on.

---

## AC6 closed — 2026-08-19, fourth session

**All six acceptance criteria are now met.** The three surfaces the previous session named as unseen
were driven: **CodeMirror in both themes**, **the launcher in light**, **a dialog in light**.
Project `leg003-drive` ("Kiln & Co.", 20 `JavaScriptFunction` nodes), code popout opened on the
`Date Picker` script node.

The syntax numbers are no longer computed-only. Measured off the running renderer, they agree with
the stylesheet exactly: editor ground `#2b3440` dark / `#f2f4f6` light, gutter `#333e4d` / `#e5e9ed`,
line numbers 5.37 / 5.07. **Both themes read.**

### 🔴 The finding: the syntax palette is graded on a ground CodeMirror only half paints

**`PAIRS` grades every `--theme-color-syntax-*` token on `bg-2`. The line the cursor is on is not
`bg-2`.** `codemirror-theme.ts:83` paints `.cm-activeLine` with `--theme-color-bg-hover`, and
`highlightActiveLine()` is enabled (`codemirror-extensions.ts:357`) — so this is live, not dead CSS.

🔴 **`bg-hover` is translucent** — `rgba(255,255,255,0.1)` dark, `rgba(23,32,43,0.06)` light — so it
does not replace the ground, it **composites over it**: `#2b3440` → **`#404853`**, `#f2f4f6` →
**`#e5e7ea`**. Confirmed against `getComputedStyle` in the running editor, both themes.

⚠️ **The gate is not alpha-blind — it simply has no row for this pair.** `Pair` already carries an
`over` field, `ground()` composites a translucent token over the opaque surface named by it, and it
**throws** if a translucent background is graded without one (`palette-contrast.spec.ts:335-348`);
two rows already use it. So the capability was there the whole time and the missing thing is two
`describe.each` blocks, not an instrument. **That makes this cheaper to close than it first looked**
— and it is a sharper version of the same lesson: the hole was a missing *row*, exactly as the
absent syntax rows were before this task added them.

| | on `bg-2` (graded) | on the active line (ungraded) | sub-AA |
|---|---|---|---|
| **dark** | all 21 ≥ 4.5 | **8 of 21 below 4.5** | `control` 3.31, `comment` 3.37, `invalid` 3.38, `string-special` 3.39, `keyword` 3.40, `meta` 3.40, `string` 3.49, `angle` 4.45 |
| **light** | all 21 ≥ 4.5 | **10 of 21 below 4.5** | `meta`/`brace`/`number`/`type` 4.12, `bracket`/`property-special`/`comment` 4.15, `invalid` 4.33, `angle`/`control` 4.41 |

Live confirmation on the real document, which contains a subset of the palette: **4 of the 11
distinct colours dark** (`if` 3.31, regex 3.39, `function` 3.40, string 3.49) and **3 of the 9
light** (`{` 4.12, `[` 4.15, `if` 4.41) are sub-AA on the highlighted line.

⚠️ **This is not NAT-003's defect, and it is not untouched by NAT-003 either.** Measured across
revisions with one instrument: at `b668638e` (before this task) it was **5/21 dark, 7/21 light**;
after, **8/21 and 10/21**. The hole pre-dates the task by a long way; **the task widened it by three
tokens in each theme** and should say so.

✅ **Worth carrying: an instrument pinned to line numbers reads a different file wrongly.** The first
version of this sweep hard-coded `colors.css`'s current block boundaries and, run against older
revisions, reported a *dark* active line of `#eaecef` and "21/21 sub-AA" — nonsense that looked like
a finding. Derive the blocks by brace-matching. The tell was a light hex under a dark label, the
same shape as [[a-theme-flip-does-not-apply-in-the-same-eval]]'s consistent-and-wrong label.

**Not fixed here.** Re-tuning ten tokens against a second ground is a palette change with a taste
call attached, and there is a second, probably better lever: **give the active line its own token**
instead of reusing `bg-hover`, tuned so the graded palette still holds. Either way it is a decision,
not a mechanical fix.
See the recommendation in the handover.

### 🔴 The dialog in light found a defect that has been there since the initial commit

`DeployPopup.tsx:18` set **`backgroundColor: '#444444'` inline** — a literal, on the dialog's own
container. `git log -L` dates it to **`b9c60b07`, the initial commit (2024-01-26)**. It has never
followed the theme.

It survived because it is close enough to the *old* dark `bg-4` (`#2c3540`) to pass as correct, and
**the only theme that exposes it is light**, which is the one surface class nobody had looked at.
In light it renders as a grey slab: the dialog is 400px wide, the tab strip occupies 105px, and the
remaining **~295px sits bare beside the single "Self Hosting" tab**. Anything unstyled landing on it
inherits `color: #000` — **2.16:1**.

🔴 **It is invisible to both gates that exist.** `palette-copies.spec.ts` compares literals that
*claim to be a token's value*; this one names no token. UIX-002's legacy-hex mop-up is scoped to
**stylesheets** — this is an inline style object in a `.tsx`. The defect sits in the gap between
them, which is the more useful half of this finding.

✅ **Fixed** — `var(--theme-color-bg-4)`. Verified live *before* editing source, by patching the
inline style over CDP and re-screenshotting: the band goes. (Editing editor source while the dev
stack is up wedges `webpack-dev-middleware` permanently, so proving the fix in the running app first
is not just tidiness.)

### One reading corrected by measuring

The dark screenshot appeared to show the property panel's colour dropdowns keeping **light**
backgrounds while the panel went dark. A sweep for controls with background luminance > 0.6 returned
**zero**. They are dark; what read as a light field was the colour *swatch* beside each one.
A screenshot is not a measurement, in this direction too.

### Drive notes

- `leg003-drive` was opened, so it now carries the three files opening writes and every component is
  dirtied. It is a drive fixture outside the repo. The recents store was **not** written — the
  project was already listed, so no backup/restore was needed.
- Two recents share the display name "FIX003 Drive" (`fix016-s50-drive` and `fix003-drive`).
  `leg003-drive` was chosen partly because "Kiln & Co." matched exactly one card of 49.

### The electron suite, which had never been run against this palette

`npm run test:ci`, alone on the machine, seed pinned to **39393**:
**`Jasmine: 2849 specs, 10 failures`** — **exactly the floor of 08-19 (`853c1da3`), matched by name**:

4× `AIX-006 style vocabulary` · 2× `AI model registry` · 1× `AIX-011 — update mode is judged against
its own base` · 3× `SUB-011 expression parameters — the validator stays silent`.

✅ **`CanvasThemeNodeSchemes.test.ts` ran and passed.** That was the specific worry: it compares
CanvasTheme's derived node scheme against `nodelibraryexport.ts`'s literals within 16 per channel,
and **both sides were edited in the same session**. They were re-derived by the same `mix()`, so
they *should* have agreed — but that was a calculation. It is now a measurement.

⚠️ `test-results.json` was **18 hours stale** when this session started (00:18 for an 18:28 run) and
was deleted first; the run above is confirmed by a fresh 18:39 mtime, not by an exit code. The exit
code was **1**, which is also what the clean floor exits — the summary line is the readout.

`npm run typecheck:editor`: **0 errors**. `npx jest tests-unit/nat-001/palette-contrast.spec.ts`:
**185/185**, including the six new rows.

### The ratchet this session added

`palette-contrast.spec.ts` now grades every syntax token on `bg-hover` **composited over `bg-2`**,
and pins the sub-AA count at **8 dark / 10 light** — the count may only go down.

🔴 **It was verified to fail, not just to pass.** Tightening the ceilings to 7/9 turns both rows red
and prints the offending tokens with their ratios; the counts and the membership agree with an
independent Python sweep over `colors.css`. A ratchet that has never been seen red is a hypothesis.
It carries a control of its own: if `bg-hover` ever stops being translucent, the composited ground
equals `bg-2` and every row becomes a silent duplicate of the table above — that control fails first.
