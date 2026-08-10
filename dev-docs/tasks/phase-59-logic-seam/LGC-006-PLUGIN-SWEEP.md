# LGC-006 — eleven things we specced by hand that are already on npm

**Status:** 📋 open · **Track: adopt over build** · cheapest task in the phase, de-scopes three others

## Why this is second in the order

Three tasks in this phase describe behaviour that Google already publishes as official plugins. Doing
this early **shrinks LGC-003, LGC-004 and LGC-007** rather than duplicating them, and one plugin
(`disable-top-blocks`) delivers half of LGC-003 §2 for the price of a config line.

We are on **`blockly: ^12.3.1`** ([`packages/noodl-editor/package.json:132`](../../../packages/noodl-editor/package.json)).

⚠️ **Every row below is unverified against our workspace, our custom blocks and Blockly 12.** The
descriptions are the plugins' own. Confirm each before adopting — and note that the bundle already
lazy-loads Blockly precisely because it is ~1.1 MB before its message bundle
([`CanvasTabs.tsx:7-12`](../../../packages/noodl-editor/src/editor/src/views/CanvasTabs/CanvasTabs.tsx)),
so **every plugin taken is weight on that chunk**. Measure the chunk before and after.

## The sweep

| Plugin | What it claims | What it replaces here |
|---|---|---|
| `@blockly/workspace-backpack` | store block stacks in a backpack for later retrieval and reuse | **LGC-007's storage half** — and it is Scratch's backpack, which non-technical users already know |
| `@blockly/block-shareable-procedures` | procedures "backed by explicit data models", **shareable between workspaces** | **LGC-007's hard half** — the definition store and cross-workspace reference we specced |
| `@blockly/cross-tab-copy-paste` | copy blocks between tabs | copy blocks between two Visual Function nodes. Near-zero cost, large ergonomic win |
| `@blockly/disable-top-blocks` | greys out blocks not connected to anything runnable | **LGC-003 §2's static half** — the didn't-execute tell, for free |
| `@blockly/toolbox-search` | search the toolbox | LGC-001's arithmetic intercept, *inside* the workspace: typing `round` finds `math_round` |
| `@blockly/continuous-toolbox` | always-open flyout, all categories in one scroll | this is what makes Scratch and MakeCode feel fluid; it removes a click per block |
| `@blockly/suggested-blocks` | recommends blocks from usage | cheap "it learns you" magic; no equivalent specced |
| `@blockly/block-plus-minus` | add/remove block inputs **without mutator dialogs** | **LGC-004 §4** — mutators are a documented novice cliff |
| `@blockly/workspace-minimap` | minimap | the scale problem (below) |
| `@blockly/workspace-search` | find blocks in a large workspace | the scale problem |
| `@blockly/zoom-to-fit` | fit the program to the viewport | the scale problem |
| `theme-deuteranopia`, `theme-tritanopia`, `theme-highcontrast` | accessible themes | **LGC-005 §2** — Blockly encodes type as colour; these are the shipped answer, and cheaper than auditing our own palette |

`@blockly/strict-connection-checker` is listed in **LGC-005 §3**, not here, because its value depends
on that task's decision.

## The scale problem is not polish

Three of these look like nice-to-haves and are not. App Inventor projects run to a **median of 54
blocks** with a coin-flip chance of exceeding 30, and the literature names the failure directly:
block environments lower the barrier for *learning and developing* but not for *reading, tracing and
maintaining*.

**Our workspaces will get there.** Minimap, search and zoom-to-fit are the difference between a
program a builder can return to next week and one they rewrite.

## Two things to check before adopting anything

1. **Theme compatibility.** [`BlocklyTheme.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyTheme.ts)
   builds our theme from `CanvasTheme` and re-colours on a theme flip. A plugin that injects its own
   chrome must follow the light/dark flip, or it will be correct in one theme and invisible in the
   other. ⚠️ This repo has shipped exactly that defect before.
2. **Locale.** [`BlocklyLocale.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyLocale.ts)
   delays injection until the language bundle resolves, so the toolbox is built with the right labels
   rather than rebuilt a frame later. Any plugin contributing UI strings joins that sequence, or it
   ships English into a translated workspace.

## Acceptance

- Each adopted plugin is listed here with **verified** replacing ⚠️ **unverified**, and one sentence
  on what it actually did in our workspace — not what its README says.
- The lazy Blockly chunk size is recorded before and after. If it grows materially, the rows that
  earned it are named.
- Both themes screenshotted with every plugin's UI visible. ⚠️ Per the register, an occluded Electron
  renderer fires no `ResizeObserver` and clamps timers — take the screenshot to force a frame, and do
  not trust a headless assertion about layout.
- A locale other than English shows translated plugin UI, or the gap is written down.
- Any plugin **rejected** gets a line saying why, so the next person does not re-evaluate it.

## Register

| # | Finding | State |
|---|---|---|
| L16 | Google publishes 39 official plugins. At least eleven cover behaviour this phase specced by hand, and two of them are LGC-007's hard part | ✅ found 2026-08-09 |
| L17 | Blockly is lazy-loaded because it is ~1.1 MB. **Every adopted plugin is weight on a chunk the codebase already went out of its way to defer** | ⚠️ measure, do not assume |
| L18 | Colour-as-type is Blockly's native convention and a colourblindness hazard. The a11y themes are shipped; writing our own would repeat phase 41 | 📋 open |
