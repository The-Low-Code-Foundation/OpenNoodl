# Phase 56 — handover after session 2 (2026-08-08)

**What ran:** BEN-004, end to end, **and driven in a live editor**. That last part is the difference
from session 1: BEN-001 and BEN-006 were built with every Live criterion open because there was no
surface to prove them on. There is one now, and driving it closed BEN-004's six criteria, closed one
of BEN-001's two, confirmed register **B4**, and found **two real defects that no spec could have
caught**.

Read [HANDOVER-SESSION-1.md](HANDOVER-SESSION-1.md) first if you have not — its B5 finding (the plug
inversion is *two* inversions) still governs anything that reasons about `plug`.

## What is on the branch

| Commit | What |
|---|---|
| `cc6e069d` | **BEN-004/1** — `views/SandboxSurface/`: the shared sandbox toolbar and viewer plumbing, extracted while there was still only one caller |
| `1414f53e` | **BEN-004** — the preview surface gets a second mode; 18 specs |
| (this one) | the two fixes the live drive found, plus the docs |

## The two defects the drive found

Both were invisible to the suite, and one of them was catastrophic.

### 1. `useTrackBounds` threw the whole React tree away (register B9)

[`noodl-core-ui/src/hooks/useTrackBounds.ts`](../../../packages/noodl-core-ui/src/hooks/useTrackBounds.ts)
calls `observer.observe(ref.current)` inside a **layout** effect with no null guard, while the two
lines around it already write `ref.current?.`. Point that hook at a conditionally-rendered element
and it does not degrade to "no measurements" — it throws, and React unmounts the tree it was used in.
**The editor lost its entire preview panel**, and the symptom was `[data-preview-mode]` simply not
existing in the DOM.

Fixed twice over: the bench frame is now rendered unconditionally (the empty state lives *inside*
it), and the hook guards.

⚠️ **The guard is not a substitute for mounting the element.** The effect keys on `[ref]`, which
never changes, so an element that appears later is still never observed. If you need bounds for
something conditional, render the box and put the condition inside it.

### 2. Flex centring clipped the frame and lied about its width

`.Stage` used `justify-content: center`. Measured live with the frame at 1280 in a 916-wide stage:
the frame sat at `x = -1138`, `scrollLeft` could not reach it, and **only 1114 of 1280 was ever
visible**. A frame you set to 1280 and can only see 1114 of is precisely the wrong-width lie the
control exists to catch. Now `margin: auto` on the item, which centres identically while it fits and
pins the start edge when it does not. Verified after the fix: `leftEdgeReachable: true`,
`scrollWidth: 1312` = 1280 + the 32px of padding.

## B4 confirmed, on the first component ever mounted

`ecommerce-example`'s `ProductCard` reports **0 inputs, 11 outputs**, and the bench's summary names
all eleven — `name`, `tagline`, `price`, `compareAtPrice`, `image`, `imageAlt`, `category`, `badge`,
`rating`, `reviewCount`, `slug` — as declared on a `Component Inputs` node with plug `"input"`, which
publishes them as component *outputs*. The card renders as an almost-empty box with placeholder text.

This is LAS-001's inversion, and the bench is the first surface in this product that tells a human
*why* instead of leaving them to conclude the component is broken. **Fixing `ProductCard` is not this
phase's job** — but it is a live example for BEN-002 and BEN-007 to keep using.

## ⚠️ Two driving traps — read before driving anything (register B10)

Both made working code look broken, and one cost real time.

1. **An occluded Electron renderer delivers no `ResizeObserver` callbacks.** No rendering steps means
   no `requestAnimationFrame` (measured: `document.hidden === true`, `rafFrames: 0` over three
   seconds) and ResizeObserver is delivered as part of those steps. Every measured read-out looks
   frozen while the DOM underneath is correct. **`npm run cdp -- screenshot` forces the pending frame
   and unsticks it** — take one after any action whose consequence you intend to measure. This is the
   same family as the standing "occluded Electron clamps timers ~1000×" note, but the symptom is
   different enough to miss: nothing is slow, one specific callback simply never arrives.
2. **`MenuDialog` renders every row twice** — once in place and once portalled — and only the second
   one's click handler fires. `document.querySelectorAll(...)` returns both; a driver that clicks
   `[0]` gets nothing and no error. Tag them and click the last.

And the standing one, re-confirmed the hard way: **`npm run cdp -- reload` white-screens the editor.**
Restart the stack instead.

## What was measured, and how

Every number below came out of the running editor, not out of the export.

| Claim | Evidence |
|---|---|
| R3 — the app preview survives a round trip | A `window` global and `scrollY: 900` planted in the app preview, then app → bench → bench → app. Both intact afterwards. A window global cannot survive a reload, which a restored form value could |
| Frame width is real | `document.documentElement.clientWidth` **inside the bench webview**: Small `360`, Medium `768`, Large `1280`, field `320` → `320`, Stretch `884` in a 916 stage. The strip's read-out matched every one |
| Design tokens reach the bench | `<style id="noodl-design-tokens">`, 4921 chars; `var(--primary)` computes to `rgb(180, 82, 47)` = the project's `#b4522f` |
| R2 | Two screenshots, title cropped: full-bleed page vs framed card on a flat black stage under a naming strip |
| The clamp works on real input | Typed junk (`768320`) into the width field; on blur it became `4096` and the bench document measured 4096 |
| BEN-006 has a second client | The **Data** panel opens on the bench with no bench-specific code |

## Gates

- `npx jest` (tests-main + tests-unit): **80 suites, 1085 tests, all passing** — unchanged count.
- `npm run test:ci`: **`Jasmine: 2484 specs, 6 failures`**, against session 1's `2466 / 6`. That is
  **18 new specs, all mine, all passing**, and the **same 6 inherited failures** — 4 in
  `AIX-006 style vocabulary`, 2 in `AI model registry`, neither file in this diff. Compare the count,
  not the summary.
- `typecheck:editor`, `typecheck:editor-tests`: clean. `eslint` clean on every new file (the 5 errors
  under `views/VisualCanvas/` are all inherited — 3 `any`s in `CanvasView.ts`, 2 webview attributes
  in `VisualCanvas.tsx` — verified by linting the versions at the base commit).
- ⚠️ `typecheck:core-ui` is red and is **not a gate** — it typechecks editor files under the wrong
  project config and fails on `@noodl-versioning`. `noodl-core-ui`'s own eslint config is also broken
  (missing the `react-app` preset). Both predate this session; the `useTrackBounds` change is a null
  guard with no type surface.

## What to do next, in order

1. **BEN-002**, the inputs rail. It is now the only thing standing between the bench and its whole
   point — `ProductCard` proves you can mount a component and still not be able to feed it. Use
   `benchInterface()` and do not re-derive `getPorts()` (**B5**). Decide **B2** (client targeting on
   `modelUpdate`) first and as its own commit; note that the bench currently rebuilds on the topbar's
   existing **Refresh** rather than following the model, which is deliberate and is the cheap option
   B2 would replace.
2. **BEN-003**, and answer its channel question in writing before any UI, as it asks.
3. **BEN-005**.
4. **BEN-007** last, live. It inherits **B3** and **B8** (`stretch` versus what a flex parent actually
   does — unmeasured at the *rendered* end), **B7** (the bench is unmounted on the way back; nobody
   has measured either the cost of keeping it or the annoyance of dropping it), and one live
   observation worth chasing: **`SiteHeader` renders six literal `Text` placeholders on the bench
   while the app shows real labels**, with 0 declared inputs and no cause established. That is the
   README's own "a component isolated from its page can lie", arriving on cue.

Do not let anything close on "the code looks right". This session's own headline finding is that the
build passed every gate, typechecked clean, and destroyed the editor's preview panel the first time a
human-equivalent driver touched it.
