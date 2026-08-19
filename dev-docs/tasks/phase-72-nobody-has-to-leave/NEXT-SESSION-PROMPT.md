# Next session — phase 72

**Written 2026-08-19, third session.** Tier 0 and Tier 1's palette work are **built and committed**.
NAT-003 is done bar one gap, and that gap is the first thing to close.

## Read first, in this order

1. [NAT-003](NAT-003-LESS-DARK-ON-DARK.md) §"Done" — the bar, why it is 1.15, and **the finding
   that the ramp could not be opened by moving backgrounds alone**.
2. [TASKS.md](TASKS.md) §The order — **NAT-014 is still the highest-value unstarted task** and has
   been since it was added. NAT-004 and NAT-005 are the rest of Tier 1.
3. [README §4](README.md) — five rulings still open (D5, D6, D7, D8, D10).

## 🔴 Close this first — it is 20 minutes and it is owed

**CodeMirror was never opened, in either theme.** NAT-003 moved **nine** syntax colours and
`bg-2`, the surface CodeMirror paints, and every one of those numbers is *computed*. The one
surface the task changed most is the one nobody has looked at.

Also unseen: **the launcher in light**, and **a dialog in light**. Everything else was driven —
canvas, node cards, rail, side panel and a `bg-4` popout in dark; canvas, rail, panel and toolbar
in light.

Launch (`npm run dev:debug -- --quiet`), open any project, open a code node or the Blockly/JS
editor, and look at it in both themes. If it reads, say so in NAT-003's task file and AC6 closes.

## What happened this session

**The UNI-011 tranche is committed** (`d2062ea8`), on Richard's instruction — nine files that had
never been tracked, one `git clean` from gone. It is a snapshot for survival, **not** a close-out:
no verification run stands behind it and UNI-011's own ACs are unchanged.

**NAT-003 ✅ (5.5 of 6 ACs)** — `4d6658df` + the syntax follow-up; platform `ad21f97` + `e1082c2`.

- **The bar is 1.15 dark / 1.09 light and it is defended, not borrowed.** WCAG governs neither
  side of a surface-vs-surface pair. The number comes from the product: the steps that drew the
  complaint were 1.065/1.072, the ones nobody complained about were 1.156/1.180.
- 🔴 **The ramp could not be opened by moving backgrounds.** The top is capped by the AA text
  sitting on it — `fg-default-shy` had 0.17 of headroom on `bg-4`. With foregrounds held still,
  four steps of 1.15 would have needed `bg-0` blacker than `bg-page` was. **Arithmetically
  impossible.** The inks had to move, and NAT-002's **D11 split is what made it affordable**:
  accent *text* went to `azure-300` while `--theme-color-primary`, the fill, never moved.
- 🔴 **`border-default`/`-subtle`/`-strong` are literals and did not follow the ramp.**
  `border-default` went from 1.01 on `bg-3` (a hair off it, its job) to 1.34 (a visible line on it).
  **VFN-002's negative control found it** — a spec that went red for a reason having nothing to do
  with dividers.
- 🔴 **`colors.css` claimed in a comment that the light syntax palette was "all AA on bg-1/bg-2".
  Three of them never were.** Nothing failed because nothing looked.

**New gate — `tests-unit/nat-003/palette-copies.spec.ts`.** Walks the real source tree and compares
every literal claiming to be a token's value against `colors.css`. **19 on its first run, five
already wrong before this task** (`bg-1` as `#11151b`, one digit out). It caught a second batch
later the same session. ⚠️ It cannot see a copy that stores a colour *without naming the token* —
`nodelibraryexport.ts`'s node blob is that shape, and is bound instead by
`tests/canvas/CanvasThemeNodeSchemes.test.ts`, which lives in the **electron** suite.

## 🔴 The electron suite has not been run against this palette

`npm run test:main` is 260 suites / 4117 tests green. **`npm run test:ci` was not run.**
`CanvasThemeNodeSchemes.test.ts` lives there, it compares CanvasTheme's derived node scheme to
`nodelibraryexport.ts`'s literals within 16 per channel, and **both sides were edited this
session**. They were re-derived by the same `mix()` so they should agree — but that is a
calculation, not a measurement. Run it, alone, and compare **by name** against the floor.

## Where to start

**If you are continuing the LOOK:** close AC6 above (20 min), then **NAT-004** (light by default on
the web — small, independent of everything) or **NAT-005** (the tab that is a list of grey lines —
⚠️ *this is the vocabulary Tier 3 reuses; build it once here or four tasks reinvent it*).

**If you are picking the highest-value unstarted work: NAT-014.** Unchanged from the last two
handovers — no dependencies, blocks NAT-009/010/013, and it is still the only task whose defect is
*currently telling users something untrue* (no mail leaves the platform; `drainOutbox` has no
production caller). ⚠️ Several of its ACs need Richard: a real send to a real MX, a registered
relay domain with SPF/DKIM/DMARC, and a claim made against the deployed box. **D10 is open.**

## Loose ends

- ⚠️ **`AskAboutNodeDialog.module.scss` carries a stale comment** — it states `bg-4` resolves to
  `#2c3540`; it is now `#3c4857`. Left alone on purpose: that file is another session's
  uncommitted work, and editing it would have swept it into a NAT-003 commit.
- ⚠️ **~99 files still paint words with a fill role** (NAT-002's remainder, 202 declarations, sub-AA
  in light). Unchanged. NAT-005 should take the community surfaces; the rest want their own task
  **with a ratchet spec**.
- ⚠️ **"Friendly and welcoming" is Richard's call on a rendered screen.** The arithmetic is done.
  The palette is a proposal and he has not seen it yet.

## Verification notes that earned their place

- 🔴 **A gate can have a hole shaped exactly like the defect.** `PAIRS` graded 36 pairs and had
  **no syntax row at all**, so a false claim in a comment stood for years. The replacement rows are
  **generated from the token list** — a hand-listed table is how three of twenty-one went unwatched.
- 🔴 **Ask whether YOUR change broke it or whether it was always broken, and say which.** Nine
  syntax values moved; five were sub-AA before this task. Reporting all nine as regressions would
  have been as wrong as reporting none.
- 🔴 **A derived palette beats a picked one, and the derivation itself has a taste failure mode.**
  Blending a dark blue-grey toward white keeps the channel spread and drops the relative chroma —
  it would have shipped a flat grey that satisfied every assertion. Multiplicative scaling keeps
  the hue. **The arithmetic can be right and the answer still wrong.**
- ⚠️ **A peer's red can be stale.** A peer reported `uni013-token-drift` red and was deferring work
  on it; it had been green since `ad21f97`, committed before their message. Worth one short reply.
