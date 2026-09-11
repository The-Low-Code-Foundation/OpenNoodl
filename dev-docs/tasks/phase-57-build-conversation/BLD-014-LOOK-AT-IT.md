# BLD-014 — Look at it

**Status:** ✅ **both producers built** — webview half driven session 15, **CDP half built and driven
session 17** (2026-08-10) · **Track B** · ⭐ **the payoff of the track** · after BLD-011, BLD-012 ·
✅ **F22 resolved**, and ✅ **a second packaging decision (R5) that F22 did not cover**

> 🔴 **And the finding worth more than the transport, from Richard's review: a capture was the one
> reference kind nobody could look at.** *"We can't leave users in the dark about what the AI has
> seen."* The viewer proved itself immediately — the first tablet capture is a **blank white page**
> behind a chip reading a healthy `Your app · tablet · 8 KB`. See R14.

> 🔴 **The finding worth more than the task: "reuse the existing harness" was unreachable, and
> nothing said so.** `scripts/` is not in the packaging `files` list, and the harness additionally
> needs a Chrome binary, the built viewer bundle and `ws`. F22 freed the *measurement*; the
> *transport* had its own blocker that no register had named. Electron **is** Chromium, so the same
> CDP commands now go over `webContents.debugger` with no Chrome, no `ws` and no packaging change.
> **A resolved blocker on one half of a task is not a resolved blocker on the other.**

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

⚠️ **The "Needs" and "Speed" rows below were written against the CLI harness and are now wrong** —
see R5. Hosting CDP in Electron removed the Chrome dependency and the launch wait entirely. The two
columns that still hold are the ones that matter: what each *answers*, and which can hit a URL.

| | **Webview grab** | **CDP render** |
|---|---|---|
| Speed | instant | ~4s (no browser launch — R5) |
| Needs | nothing new | ~~a Chrome binary, the built viewer bundle~~ **nothing new** |
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
6. **Offer it at the right moment. ✅ Q6 ANSWERED** — Richard, 2026-08-10: **a one-click offer on the
   receipt**, not an automatic render on every apply.

   ⚠️ Shipped as the *other* half of that decision too: `◎ Look at it` also sits in the composer.
   A receipt-only offer would make "one click after an apply" the only moment the feature is ever
   reachable, and the question a user most often wants to ask — *does this look right?* — arrives
   mid-conversation, not at an accept.
7. **A URL capture is a network egress.** Say so before the first one — the user is handing a
   third-party page to their model provider.

## Acceptance

- [x] `◎ Look at it` with the preview open returns an image in < 1s, attached as a reference. —
      **driven**: control greyed with no preview, un-greyed itself within 500ms of the bench
      mounting, one click produced `App screenshot 3 KB`, unpinned.
- [x] **Always return findings alongside the picture** (build item 4). — ✅ **closed for the webview
      producer** once F22 was resolved. Verified live: `0 errors, 1 warning (empty-decorated-box).
      preview 800×150px, 2 texts, 2 on screen, 0 images.`
- [x] Against a text-only model the capture degrades, **declared** (BLD-012). — the twin carries the
      measurements and tells a model that cannot see to act on them and say so.
- [x] ⚠️ **"Measured clean" and "measurement failed" are distinguishable.** `measure()` swallows its
      own failure so a throw never costs the screenshot — which makes an empty findings list
      ambiguous. Only a present `summary` means it ran, and the twin's wording differs.
- [ ] A capture greys after the next apply and states its age if sent anyway. — **half.** The
      *sentence* is driven against a real capture for the first time (`tests-unit/bld-014/`); the
      **on-screen** grey is not. See R2.
- [x] A CDP render at `390x844` returns a screenshot **and** findings. — ✅ **driven, no billed call.**
      An 8,810-byte PNG plus a twin reading *"MEASURED AT 390×844 — this is a real device viewport,
      not a resized pane. Rendered clean: 3 texts, 3 on screen, 0 images."* The app at
      `desktop,phone` returned two chips carrying a real `empty-decorated-box` warning off the
      running project.
- [x] A capture of `https://example.com` works and is labelled as external. — ✅ **driven.** The chip
      reads **`example.com · 390x844`**, the twin says *"A screenshot of an external page,
      https://example.com"*, and the egress notice appears **before** the render, naming both halves
      (the editor loads the page, and the picture then goes to the provider).
- [x] The F22 packaging decision is recorded in this file's register before the CDP half is built.
      ✅ **And a second packaging decision was needed and is recorded as R5** — F22 freed the
      *measurement*; the *transport* had its own unnamed blocker.
- [ ] Live: build a page with a known responsive defect and confirm the agent names it. — needs a
      billed authoring call. **Filed to BLD-010.**
- [x] ✅ **Added by Richard's review:** the user can see the capture before it is sent, and can pick
      Desktop / Tablet / Mobile rather than typing a size. Both driven — R14, R15.

## What the CDP half measured (session 17, driven against `ai-test`, no billed call)

| | result |
|---|---|
| `https://example.com` at `390x844` | **8,810-byte PNG**, twin 348 chars, `Rendered clean: 3 texts, 3 on screen, 0 images` |
| chip label, external | **`example.com · 390x844`** — host, not the whole URL |
| the app at `desktop,phone` | **two chips**, 6,504 and 3,153 bytes — genuinely different pictures |
| findings off the running project | `empty-decorated-box`, 1 per viewport, real |
| per-viewport summary | `desktop 1280×900px` / `phone 390×844px`, **1 warning each** — see R12 |
| egress notice | fires on an external URL **before** the render; **absent** for the user's own app |
| viewport refusal | `tablet` → *"Unknown viewport… Use desktop, phone, or WIDTHxHEIGHT such as 390x844"* |
| transport, `about:blank` fix | `Page.enable` **238ms → 4ms**; whole capture ~7s for one viewport |
| control row, popup open vs shut | **67px both**, at 340px — the popup is out of flow |
| horizontal overflow, 248 → 800px | **0** for the row, the composer and `document.body` |
| the 4th button's cost | **0px at 340 and 400**, +37px at 500–599, 0px at 600+ |
| egress sentence, dark / light | **6.66** (`#a6b0bb` on `#222933`) / **6.54** (`#4a5663` on `#ecf0f4`) |
| chosen target, dark / light | **6.66 / 6.54** |
| unchosen target, dark / light | **7.70 / 7.10** |
| `Viewports` label, dark / light | **5.57** (`#8b95a1` on `#181d24`) / **5.06** (`#616c79` on `#f7f9fb`) |

### What the second pass added (Richard's review, same session)

| | result |
|---|---|
| the capture is **full page**, not a viewport grab | a page **9.6× its viewport** (8093px at 390×844) produced a PNG covering **8094px** — measured, not assumed |
| downscale | 0.5, `render-report.js`'s own factor: 195×4047 at 76KB for that page |
| preview, tablet capture | image **512×683** natural — exactly 1024×1366 at 0.5 — from the reference's own bytes |
| 🔴 what the preview revealed | the `ai-test` tablet render is a **blank white page**, behind a chip reading a healthy `Your app · tablet · 8 KB` |
| preview contrast, dark / light | title, twin summary and twin text all **7.70 / 7.10** |
| presets | `Desktop 1280×900`, `Tablet 1024×1366`, `Mobile 390×844`; lit state derived from the spec |
| preset round trip | click Tablet → `desktop,phone,tablet`; type `tablet` → only Tablet lit |
| Escape | closes the viewer, chip and its control survive |

⚠️ **Not driven:** the `Live: build a page with a known responsive defect and confirm the agent names
it` criterion needs a billed authoring call and is filed to BLD-010. Everything above was reached
without one.

⚠️ **A cosmetic wart, not fixed:** when a viewport's *name* is its dimensions, `summarise`'s own
format prints `390x844 390×844px`. Named viewports read normally (`desktop 1280×900px`). Fixing it
means changing shared `summarise` output that the CLI and MCP tool also print.

## Register

| # | Finding | State |
|---|---|---|
| 1 | F22 (LAS-005) — the shared render substrate had no home the editor bundle could import. ✅ **Richard decided 2026-08-10: a new no-build package.** `@nodegx/render-measure` holds `measureExpression`, `summarise`, the thresholds and the finding vocabulary, with no `require` in it (asserted by a spec, inverted). `render-report.js` re-exports every name it used to own, so `noodl-mcp`'s 41 recorded-measurement specs stayed green across the move. ⚠️ Plain CJS with a hand-written `.d.ts`, unlike the repo's seven other no-build packages — `measure-from-disk.js` is run by bare `node`, which cannot `require` a `.ts` file | ✅ **resolved** |
| 2 | ⚠️ **Staleness is still not on screen — BLD-011's R4 is half-closed, not closed.** `capturedAtApply` now comes from a real capture and `tests-unit/bld-014/capture.test.ts` grades the whole rule against one; first time the mechanism and its subject have both been real. But `noteApply()` fires only on the accept path, so *watching a chip grey* costs a billed authoring session. The paint was verified to exist (`.Chip.is-stale`/`.is-warned` compile as two-class selectors, not `MISSING` — BLD-005's defect shape) | 🟡 mechanism driven, on-screen transition not |
| 3 | ⚠️ **`hasLivePreview()` is polled at 500ms, not subscribed.** The registry is written from a `<webview>` ref callback in a different document tree; there is no React path to the panel. Half a second is under the time it takes to look down at the composer — but it is a poll | 🟢 accepted, documented at the call site |
| 14 | 🔴 **A capture was the one reference kind nobody could look at.** Richard, 2026-08-10: *"The user can preview the rendered page, otherwise how would they know if the browser rendered the right part? … we can't leave users in the dark about what the AI has seen."* Every other kind is inspectable by construction — a component is on the canvas, a doc is in the docs panel, a mention names a thing the user picked. A capture is made by a browser window that **by definition nobody can see**, and the chip could only say how many kilobytes it was: a cookie banner, a loading state, a wrong viewport and a good render are **identical on the chip**. `ReferencePreview` shows the reference's own base64 block — byte-identical to what the provider receives, never a re-render — plus the twin verbatim, because "what was it shown" and "what was it told" are two different questions. ⚠️ **It proved itself on the first drive**: the `ai-test` tablet capture is a **blank white page**, and the chip read a perfectly healthy `Your app · tablet · 8 KB`. ⚠️ Offered for **any** reference carrying an image, not just a capture — a pasted screenshot (BLD-013) had the same gap and nobody had noticed, because that is the one route where the user has just seen the file | ✅ **built, driven** |
| 15 | ✅ **Device presets — Desktop / Tablet / Mobile — instead of typing `390x844`.** Richard: *"If the user is creating a mobile app, they should be able to select a mobile, tablet or desktop render."* ⚠️ **`tablet` went into a new `NAMED_VIEWPORTS`, deliberately NOT into `DEFAULT_VIEWPORTS`** — the name has to be spelled the same way in the CLI, the MCP tool and here, but adding it to the *default* set would silently make `render_report` measure a third viewport on every call it has ever been asked to make, changing its cost and its recorded output. **A vocabulary and a default are different things**, and a spec now holds both. 🔴 **The buttons are derived from the spec text, not stored beside it** — BLD-016's rule applied a second time: a `Set` of chosen devices *plus* a text field is two stores, and every *"I typed `390x844` and Mobile did not light up"* bug is a missing edge in that graph. Driven both ways: clicking Tablet wrote `desktop,phone,tablet`; typing `tablet` lit Tablet and unlit the other two | ✅ **built, driven** |
| 16 | ⚠️ **A spec that could not fail, caught by inverting it.** The `firstImage` guard test asserted a *doc* was not viewable — but a doc has no `images` array, so deleting the `status === 'ready'` check passed anyway. Rewritten against a **failed reference that still carries bytes**, which is the only state the guard exists for. **An inversion that does not go red is the finding**; three of the twelve inversions this session were re-aimed because of it | 🟢 fixed |
| 12 | 🔴 **`summarise` must see every viewport at once, and its summary must then NOT be reused per viewport.** The whole-report sentence was pasted onto each capture, so the **desktop** chip's twin read *"2 warnings … desktop 1280×900px …; phone 390×844px …"* — telling a model looking at one picture that it had 2 warnings when that viewport had 1, and reciting measurements from an image it cannot see. ⚠️ **Every spec passed with this wrong**, and the findings *were* correctly split — only the sentence above them was not. `summaryLine` now re-derives it from the one viewport and its own findings. **A right mechanism (summarise sees all) with a wrong presentation (its summary describes all)** | ✅ **fixed, driven** |
| 9 | 🔴 **A `BrowserWindow` with no `loadURL` has no renderer process, and the first CDP command hangs forever.** `attach('1.3')` succeeds — it is local and synchronous — and then `Page.enable` **never resolves**. Measured in a standalone probe: attach at 238ms, then silence to a 45s timeout. Adding `await win.loadURL('about:blank')` before attaching brings `Page.enable` back to **4ms**. ⚠️ **The failure mode is the worst shape available**: not a throw, not an error result, a promise that never settles — the control sat on *"Rendering…"* indefinitely, which reads as a slow network rather than a dead call. **No spec could have caught this**, because the transport is deliberately not mocked; only a live drive reaches it | ✅ **fixed, driven** |
| 10 | 🔴 **And the hang had no deadline, which is why it was silent.** Every CDP step can hang the same way, so the fix is not a guard on the one command now known to misbehave: the whole operation gets a deadline (20s + 20s per viewport, against a ~7s real render). ⚠️ **The cleanup must sit outside the race** — `Promise.race` does not cancel the loser, so destroying the window in `finally` is what actually ends an abandoned command | ✅ **fixed** |
| 13 | ⚠️ **The `is-chosen` state was measured, and its label and its element were swapped in my own first reading.** The sweep named the *app* button "chosen" while `A URL` was the one carrying the class — the numbers were right and the mapping was not. Corrected: **chosen 6.66 dark / 6.54 light**, **unchosen 7.70 / 7.10**, both AA, `fg`/`bg` hex recorded below. The class itself resolves to a real hashed selector (`RenderCaptureControl-module__is-chosen--fRLDU`), checked for the `undefined`-class trap. **Fourth of this shape in three sessions: measure the element you are claiming about, and check which state it was actually in** | 🟢 measured |
| 11 | ⚠️ **A fourth button in the composer control row costs nothing at the shipped width.** BLD-013's register warns that adding a sibling to this box has already broken it once, so it was measured rather than assumed — the same box, at the same widths, with the new control `display:none` and then restored. **0px at 340 and 400px** (the row had already wrapped), **+37px only in the 500–599 band**, 0px at 600+ where all four fit on one line. **Zero horizontal overflow at every width from 248 to 800**, on the row, the composer and `document.body` — the wrap that BLD-013 introduced is doing exactly its job | 🟢 measured, no defect |
| 5 | 🔴 **F22 was not the only packaging decision this task needed, and the second one was never filed.** The build said *"reuse the existing harness — a new entry point for `Page.navigate`"*. Checked before building: **that route does not reach a shipped editor.** `scripts/` is not in `package.json`'s `build.files`, so it is absent from a packaged app entirely; and `checkPrerequisites` additionally requires **a Chrome/Chromium binary on the user's machine**, the built viewer bundle at a repo path, and `ws` out of the repo's `node_modules`. Reusing it would have shipped a feature that works in this checkout and is dead for every user. ✅ **Richard decided 2026-08-10: host the CDP session in Electron.** `webContents.debugger` on a hidden `BrowserWindow` speaks the same protocol, so the identical commands go over the wire — with no Chrome to find, no `ws`, no `child_process`, no packaging change, and no browser launch to wait for | ✅ **resolved** |
| 6 | ⚠️ **The task doc's estimate of "~50 lines plus live QA" assumed the harness was reachable.** It was not, so the transport is written rather than called — but the *measurement* half genuinely was ~0 lines, exactly as F22 promised: `renderCaptureModel.ts` calls the same `summarise` the webview producer calls, and `renderCapture.ts` builds the expression from the same `placeholderStringsFromCatalog(defaultCatalog())`. **The F22 bet paid; the estimate was priced against the wrong half** | 🟢 recorded |
| 7 | ⚠️ **`summarise` is given every viewport at once, and a per-viewport loop would silently lose findings.** Some of its findings are comparisons *across* viewports — `minimum-layout-width` reads the narrow measurement against the wide one — so summarising each alone drops exactly the findings a multi-viewport render was asked for. Not a defect that would ever throw: it returns a shorter, plausible list | 🟢 built correctly, documented at the call site |
| 8 | ⚠️ **The capture window is a security boundary, and the task doc did not say so.** It loads pages the editor does not trust, so it takes `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` and a **non-persistent** partition — a `persist:` one would accumulate third-party cookies across captures. `checkUrl` also refuses everything but `http(s)`: a capture target arrives from a *model* as often as from a user, and `file://` would turn "look at this page" into an arbitrary local file read returned as a picture | 🟢 built |
| 4 | ✅ **Build item 4 now holds for this producer too, and resolving F22 is what made it possible.** The webview grab evaluates the same `measureExpression` the CLI and MCP tool run, and `summarise` judges it — so the twin carries findings in one vocabulary rather than a second. Verified live: `0 errors, 1 warning (empty-decorated-box). preview 800×150px, 2 texts, 2 on screen, 0 images.` ⚠️ It measures **the preview pane's size**, not a device viewport, and the twin says so — answering "what does it look like at 390×844" is still the CDP producer's job | ✅ closed |
