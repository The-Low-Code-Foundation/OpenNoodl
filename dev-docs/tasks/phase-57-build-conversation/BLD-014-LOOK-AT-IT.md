# BLD-014 — Look at it

**Status:** 📋 not started · **Track B** · ⭐ **the payoff of the track** · after BLD-011, BLD-012 ·
depends on **F22** (LAS-005) for the CDP half

## What it is

*"Ability to render either the existing app or a web URL in a headless browser and take a screenshot
for context."* — Richard, 2026-08-08.

This closes doctrine §11 — *you have not finished until you have looked at it* — **inside the editor,
for the first time**. Today only an agent on the MCP surface can look at anything.

## Most of this is already built

**The harness exists and already returns images to a model.**
[render-report.js](../../../scripts/devtools/render-report.js) launches Chrome with
`--headless=new`, drives raw CDP, and calls `Page.captureScreenshot`;
[renderTools.ts:91](../../../packages/noodl-mcp/src/tools/renderTools.ts#L91) returns
`{ type: 'image', data, mimeType }`. It reports, per viewport, the width the page refuses to collapse
below, horizontal overflow, font-weight and font-size sets, broken images, empty decorated boxes,
repeated groups that came out one column wide, and texts still rendering a node-type default like
`"Text"`.

It renders **a project from disk**. Pointing CDP at an arbitrary URL is a new entry point on a
working harness, not a new harness.

**And a second, much cheaper capture path exists and is unused.**
[SandboxPreview.tsx:86](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/SandboxPreview.tsx#L86)
holds an `Electron.WebviewTag`, and `PreviewTokenInjector` already reaches into it on `dom-ready`
([:135-144](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/SandboxPreview.tsx#L135)).
Electron webviews have `capturePage()`.

## Two paths, one control — and they answer different questions

| | **Webview grab** | **CDP render** |
|---|---|---|
| Speed | instant | ~8s + a Chrome launch |
| Needs | nothing new | a Chrome/Chromium binary, the built viewer bundle |
| Answers | *"what does it look like right now?"* | *"what does it look like at 390×844, and what is measurably wrong?"* |
| Returns | one image | images **+ findings** per viewport |
| Can hit a URL | no | **yes** |
| Blocked by F22 | no | the editor half, yes |

**Ship the webview grab first.** It needs no packaging decision, and it is the one a user reaches for
mid-conversation.

## F22 — the blocker, already filed and already diagnosed

LAS-005 §5 descoped the editor client and named the blocker precisely
([LAS-005-RENDER-REPORT.md](../phase-55-llm-authoring-support/LAS-005-RENDER-REPORT.md), F22):

> *"The real blocker is **where the shared substrate lives**. The pure half (`measureExpression` +
> `summarise` + the thresholds) is plain CJS under `scripts/` precisely so the CLI runs in a fresh
> checkout with no build step — and the editor bundle cannot import it without either dragging
> `child_process`/`ws` into the renderer or compiling it, and `scripts/` is not shipped in a packaged
> editor at all."*

Three named ways out: a dependency-free `render-measure.js` both import; a new no-build package; or
move it into the editor and give the CLI a build step. **It is a packaging decision, not a wiring
one**, and the remaining work after it is ~50 lines plus live QA.

⚠️ **Make the packaging decision before starting the CDP half.** Do not discover it mid-task.

## Build

1. **`capture` reference kind** with two producers behind one `◎ Look at it` control:
   *"what's on screen"* (webview) and *"render it properly"* (CDP, with viewport and URL options).
2. **Webview grab:** `capturePage()` on the live preview, downscaled, attached as an image reference.
3. **CDP render:** reuse the existing harness. New entry point for `Page.navigate` to an arbitrary
   URL. Same viewport vocabulary as `render_report` (`desktop,phone` or explicit `390x844`).
4. **Always return findings alongside the picture.** This is what makes the feature work on a model
   that cannot see, and it is already how `render_report` is built. **Never ship a capture path that
   returns only an image.**
5. **Rule 7 applies hardest here.** A capture of your own app is true for about one turn. Carry the
   age and the apply-count; grey and offer refresh after the next apply; never silently re-send.
6. **Offer it at the right moment.** Q6 is open: assumed a **one-click offer on the receipt** after
   an apply — *"Look at it?"* — rather than an automatic ~8s render on every apply. Doctrine §11
   argues for automatic; the cost argues against. **Richard's call.**
7. **A URL capture is a network egress.** Say so before the first one — the user is handing a
   third-party page to their model provider.

## Acceptance

- [ ] `◎ Look at it` with the preview open returns an image in < 1s, attached as a reference.
- [ ] A CDP render at `390x844` returns a screenshot **and** findings, both visible in the thread.
- [ ] A capture of `https://example.com` works and is labelled as external.
- [ ] Against a text-only model the capture degrades to findings, **declared** (BLD-012).
- [ ] A capture greys after the next apply and states its age if sent anyway.
- [ ] The F22 packaging decision is recorded in this file's register before the CDP half is built.
- [ ] Live: build a page with a known responsive defect, ask the agent to look at it on phone, and
      confirm it names the real defect. **A graph is a claim; a render is evidence — and so is this
      acceptance criterion.**

## Register

| # | Finding | State |
|---|---|---|
| 1 | F22 (LAS-005) — the shared render substrate has no home the editor bundle can import. Inherited, not caused by this task | 🔴 open — decide before the CDP half |
