# EXP-014 — The ground the headline sits on

**Status:** 🟢 **BUILT, GATED AND DRIVEN — session 97, 2026-09-06.** All eight acceptance criteria
graded below. `tests/the-ground.test.ts`, 32 rows; fixture `tests/fixtures/ground-desk`; ten
mutation arms, 10/10 killed. Driven on the installed landing-pages template: the hero headline
went from **1.03:1 to 17.24:1**, and the Business hero's photograph and its 14px frosted panel are
in the running app. One residual registered (§14.5).
**Owner:** P18. **Opened by:** the TPL-003 landing-pages export drive, 2026-09-06 (record at the end
of this file). Richard: *"Can we write some bug fixing tasks to sort this out please?"*
**Priority:** 🔴 **Highest of the three.** It is the first screen of all three shipped landing pages,
and the failure mode is an unreadable page rather than a missing feature.
**Difficulty:** 🟢 **Low.** The token already ships; the runtime's composition rule is eleven lines
and is written down. This is a fold rule in one file plus its mirror in the ledger.

## Objective

A Group carrying a background gradient, a background picture, or a backdrop blur exports with that
ground intact. Today all four ports are dropped, and the hero of every landing page comes out with
white display type on the page's cream ground.

## What is true today (measured 2026-09-06, both arms)

1. **The four ports are dropped with a note and no translation.** `emit/component.ts:269` pushes
   `parameter <name> on <id> has no style/content mapping — dropped, reported` for each. On
   `templates/landing-pages` that is **`backgroundGradient` ×5, `backgroundImage` ×1,
   `backgroundSize` ×1, `backgroundPosition` ×1, `backdropBlur` ×1** — 9 of the 139 refusals, and
   the only ones with a visible consequence.
2. **The consequence is an unreadable hero.** `Pages/Freelancer`'s `flHero` carries
   `backgroundGradient: 'var(--gradient-deep)'`. Exported, every ancestor of the headline computes
   `background-image: none`, the 94px headline is `rgb(255,255,255)`, and the page ground is
   `rgb(253,251,247)` — a contrast ratio of **1.03:1**. The eyebrow pill, the sub-paragraph and the
   secondary button go with it. Only the primary button, which paints its own dark fill, survives.
3. **The control says this is the export diverging, not the template.** The same project served
   through the NodeGX viewer (`scripts/devtools/render-from-disk.js`) computes
   `background-image: linear-gradient(160deg, rgb(31,26,23) 0%, …)` on that same ancestor. Same
   project directory, two renderers, one variable.
4. 🔴 **The token already ships in the exported app.** `--gradient-deep` is at line 219 of the
   emitted `src/styles/tokens.css`, with its nested `var()`s intact. **No token work is needed** —
   the value the export must emit is the string `var(--gradient-deep)`, which already resolves.
   This is why the task is Low and not Medium.
5. **The runtime's rule is explicit and worth transcribing rather than reinventing.**
   `node-shared-port-definitions.ts` `_updateBackgroundLayers` (≈line 1778):

   ```
   background-image: <gradient>, url("<image>")   ← gradient FIRST, the scrim idiom
   background-size:     internal.backgroundSize     || 'cover'
   background-position: internal.backgroundPosition || 'center'
   background-repeat:   'no-repeat'                 ← always, never a port
   ```

   With neither layer set it *removes* all four properties rather than emitting empty ones. The
   file argues the ordering at length: the gradient paints over the picture, and that is what lets
   a headline sit on a photograph and stay legible.
6. **`backdropBlur` is a separate, simpler rule** (same file, ≈line 1752): `cssLength(value)`, then
   `backdrop-filter: blur(<length>)` **and** `-webkit-backdrop-filter` together; a zero or absent
   value removes both rather than painting `blur(0px)`, because `blur(0px)` still promotes the
   element to its own compositing layer.
7. **`PASSTHROUGH` is the wrong home for these.** `emit/style.ts:213`'s set is camelCase → kebab-case
   1:1, which would emit `background-gradient` — not a CSS property. Two ports composing into one
   declaration with defaults is exactly the fold shape the file already uses for borders, radii and
   `_updateBoxShadow`'s counterpart, and its own comment says so: *"Everything with fold/gate
   semantics … is handled by the dedicated rules below and deliberately absent here."*

## Acceptance criteria

1. ✅ **The fold exists.** `computeNodeStyle` (`emit/style.ts:392`) composes `backgroundGradient` and
   `backgroundImage` into one `background-image` declaration, **gradient first**, and emits
   `background-size` / `background-position` / `background-repeat` with the runtime's defaults from
   §5. With neither port set, none of the four properties is emitted. `background-image` and its
   three companions take their place in `PROPERTY_ORDER` (`style.ts:313`).
2. ✅ **`backdropBlur` maps** to `backdrop-filter` **and** `-webkit-backdrop-filter`, both or
   neither, with zero and absent emitting nothing. Grade the zero arm explicitly — it is the case
   the runtime went out of its way to handle.
3. ✅ **A token reference survives as a token reference.** `var(--gradient-deep)` is emitted
   verbatim, not resolved to a literal gradient at export time. A themed gradient must re-theme with
   the project, which is the whole reason the runtime keeps the port a plain string. Assert the
   emitted CSS contains `var(--gradient-deep)`.
4. ✅ **The picture path resolves.** `backgroundImage` pointing at a `noodl_modules/` asset emits a
   URL that resolves in the built app, and the asset travels through the existing `copies` channel
   (EXP-010 AC5). ⚠️ Grade this on an **installed** project — see the fixture warning below.
5. ✅ **The four refusal notes disappear** from `EXPORT-REPORT.md` for a project that sets these
   ports, and no new note replaces them. `export-ledger:check` stays OK.
   ⚠️ **Checked 2026-09-06: the ledger says nothing about these parameters** — `backgroundGradient`
   and `backdropBlur` appear **0 times** in `coverage-ledger.json`, and the `Group` entry is
   `status: translated, note: "flex group → div"`. So there is no false ledger claim to correct
   here, and no row to tick. That is itself worth noting: **a node can be `translated` in the
   ledger while dropping the parameter that decides what it looks like.** If the ledger ought to
   carry per-parameter coverage, that is an EXP-008 question, not this task's.
6. ✅ **The hero is legible, measured not eyeballed.** On the exported `templates/landing-pages`,
   the headline's computed colour against its nearest painted ancestor clears **4.5:1**. The
   pre-fix reading is 1.03:1 and belongs in the spec as the reverted arm — build it, per
   `a-recommendation-carries-a-measurement-of-some-property-not-the-right-one`.
7. ✅ **Gates.** `nodegx-export` tsc 0 and jest green; whole-package run as the pin sweep (a grep
   will not find the `dropped:` note pins that move); editor `tsc -p tsconfig.json --noEmit` 0;
   `export-ledger:check` OK; picker floor unchanged — **no node's translation status moves**, this
   is a parameter fix inside already-translated nodes.
8. ✅ **Driven.** Export the landing-pages template, `npm install && npm run build && npm run dev`,
   and photograph the hero beside the viewer control at 1280px. Both pictures in the scratchpad.

## What was built — session 97, 2026-09-06

**Shape.** `emit/style.ts` `computeNodeStyle` grew one block, transcribed from the runtime's
`_updateBackgroundLayers` rather than reinvented: the two layer ports compose into one
`background-image` with the gradient FIRST, then `background-size` / `background-position` from the
catalog defaults (`cover` / `center` — the same effective values as the runtime's `|| 'cover'`,
because an unset port never reaches its setter there either) and an unported
`background-repeat: no-repeat`. With neither layer set nothing is emitted and the authored
companions are still consumed, because the runtime drops them just as silently. `backdropBlur` is a
separate rule: `blurLength()` is the runtime's `cssLength` followed by its zero gate, and both
spellings are pushed together or not at all. Four new `PROPERTY_ORDER` entries and two exported
helpers (`cssUrl`, `blurLength`) that the spec grades directly.

🔴 **The one thing that is NOT a transcription is the leading slash, and it had to be.** The port
holds a project-relative path and the asset is copied to `public/<same path>`. A *relative* `url()`
in a CSS module resolves against the **stylesheet's** URL, not the document's, so the verbatim value
would be resolved by Vite against `src/pages/` at build time. `cssUrl` makes it root-absolute —
the same shape `scaffold.ts` already gives a module stylesheet's `<link href>`, and for the same
reason. Confirmed in the built app: `dist/assets/index-*.css` carries
`url(/noodl_modules/starter-imagery/people-coffee-shop.webp)` and the file serves `200`, 84,368 bytes.

**The grading (AC6, AC8), both arms, same fixture, same instrument.** The reverted arm is a real
`git worktree add --detach HEAD` export, built and served beside the fixed one:

| reading, `templates/landing-pages` installed | before | after |
|---|---|---|
| Freelancer headline vs its nearest painted ancestor | **1.03:1** (`rgb(255,255,255)` on `rgb(253,251,247)`) | **17.24:1** (white on `linear-gradient(160deg, rgb(31,26,23) 0%, rgb(116,42,17) 100%)`) |
| elements computing a `background-image` | 0 | 1 per page, the hero |
| elements computing a `backdrop-filter` | 0 | `bzHeroNumbers blur(14px)` |
| Business hero ground | `background-image: none` | `linear-gradient(rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.78) 100%), url("…/people-coffee-shop.webp")` |
| `parameter background*/backdropBlur … dropped, reported` | 9 | **0**, and no note replaces them |
| `npm install && tsc -b && vite build` | exit 0 | exit 0, 82 modules, no hand edits |

⚠️ **The 17.24:1 is the honest number and the 21:1 on the Business page is not.** Freelancer's hero
paints a known gradient, so the ratio is exact. Business paints a scrim **over a photograph**: 21:1
is the headline against the scrim's first colour stop, and the true value varies with the pixels
underneath. That is the template's own design decision and the viewer renders it identically — this
task's claim is that the export stopped diverging, not that the template is contrast-audited.

**The control is now a three-way agreement.** §3 recorded the viewer computing
`linear-gradient(160deg, rgb(31,26,23) 0%, …)` on `flHero`. The exported app now computes the same
string, from the same project directory. The pre-fix arm computes `none`.

**Gates.** `nodegx-export` jest **83 files / 3126 rows exit 0** (was 80/3012 — the three new specs
are 78 rows and the seven fixture-walking specs picked up the two new fixtures) · package `tsc` 0 ·
editor `tsc -p tsconfig.json --noEmit` **exit 0, empty log** · `export-ledger:check` OK, 176 types,
124 translated · **picker 117/127 unchanged**, no translation status moved · editor `test:ci` 2943
specs, **4 failures = the floor by name** (AIX-006 ×4, seed 61662, readout fresh 12:13, 3112 bytes).

**Pictures.** `before-business.png` / `after-business.png` and `before-freelancer.png` /
`after-freelancer.png`, 1280px, in the session-97 scratchpad `26fc68ac-…`.

## Residual — §14.5, owner NONE

⬜ **An `<img src>` is still emitted project-relative, and that is a latent 404 one route-depth
away.** `contentAttrs` prints `src="noodl_modules/starter-imagery/food-grocer.webp"` verbatim, the
emitted `index.html` carries no `<base>` (measured), and a relative URL resolves against the
**document**: on `/business` that is `http://host/noodl_modules/…` and correct, on a two-segment
route it is `http://host/blog/noodl_modules/…` and a 404 (`new URL()` in the running app, both
cases). Every route this template emits is one segment, which is exactly why the drive read **0
broken images** and why this is a residual rather than a finding. The fix is `cssUrl`'s rule applied
to the `attr:src` channel — `Image.src`, `Image.srcSet`, `Video.src` and `Video.poster` — and it
wants a fixture with a nested `urlPath` to grade it.

## Not in scope

- Any node's translation status (EXP-011).
- The semantic element the ground sits on — that is [EXP-015](./EXP-015-THE-TAG-THE-AUTHOR-CHOSE.md).
- The body font — [EXP-016](./EXP-016-THE-TYPEFACE-THAT-SHIPS-UNUSED.md).
- Resolving design tokens to literals anywhere. §5's AC3 is deliberately the opposite.

## 🔴 The fixture warning, and it cost this session an arm

**Export an INSTALLED project, never `templates/landing-pages/` itself.** That directory has no
`noodl_modules/`: the editor injects Inter, lucide-icons and starter-imagery at install time from
`models/template/starterAssetList.ts`. Exporting the bare template gives **0 copied assets**, six
broken `<img>` elements and a spurious *"icon set 'lucide' is not a noodl_modules icon set in this
project"* refusal — none of which a real user would ever see.

Building the installed arm is three copies:

```
cp -R templates/landing-pages/. <proj>/
cp -R packages/noodl-editor/src/assets/starter-project/noodl_modules <proj>/noodl_modules
cp packages/noodl-editor/src/assets/Inter/Inter-{Regular,Medium,SemiBold,Bold}.ttf <proj>/noodl_modules/inter/
```

Re-exported that way: **62 assets copied, 0 broken images, the lucide refusal gone, and the
parameter drops byte-identical**. That last clause is what makes §1's numbers trustworthy — the
fixture error moved the asset findings and left this task's subject untouched. Standing shape:
`a-budget-measured-on-a-fixture-is-a-budget-on-the-fixture`.

## The record — 2026-09-06, the landing-pages export drive

Export → `npm install` → `tsc -b && vite build` → `vite` dev server, **all exit 0, no hand edits**,
50 emitted files and 82 modules bundled. The app is close to the original: photographs, cards,
forms, footer, colour system and spacing all come through. Three things diverge, and this task is
the first. Instruments: `scripts/emit-app.ts` for both arms, `scripts/devtools/render-from-disk.js`
for the control, `scripts/devtools/drive-page.js` for every measurement and picture.

⚠️ **One candidate was disproved and is recorded so nobody re-finds it.** The 21 dropped `alignX`
parameters looked like a layout defect and are not: every one of the 21 is `center`, the parent's
`align-items: center` already does that job, and the shell measures **left 40, width 1200 in both
renders**. `alignX` may still matter on a project where a sibling disagrees, but it is **not** a
finding on this template and must not be written up as one.
