# Phase 57 — handover after session 17 (2026-08-10)

**What ran:** **BLD-014's CDP half built and driven, end to end, with no billed call.** BLD-014 is
now closed on both producers.

**Phase 57 is 14 of 17 fully built.** Counted off the tables in `TASKS.md`, not incremented:
**Track A 9 of 11** (BLD-009, BLD-010), **Track B 5 of 6** (BLD-015 only, and deferred).

## 🔴 The finding worth more than the task

> **"Reuse the existing harness" was unreachable, and no register had said so.**

The build item said to reuse `scripts/devtools/render-report.js` and add a `Page.navigate` entry
point — LAS-005 had estimated the remainder at *"~50 lines plus live QA"*. Checked before building,
that route does not reach a shipped editor:

- **`scripts/` is not in `package.json`'s `build.files`** (`*.js`, `src`, `node_modules`), so it is
  absent from a packaged app entirely.
- `checkPrerequisites` additionally requires **a Chrome or Chromium binary on the user's machine**,
  the built viewer bundle at a repo path, and **`ws`** out of the repo's `node_modules`.

All three are dev-checkout assumptions. Reusing it would have shipped a feature that works in this
checkout and is dead for every user — and nothing in the task file, the F22 register or the handover
chain said so, because **F22 was a decision about the *measurement* half only.**

✅ **Richard decided: host the CDP session in Electron.** Electron 43 *is* Chromium, and
`webContents.debugger` speaks the same protocol — so the identical commands go over the wire
(`Page.navigate`, `Emulation.setDeviceMetricsOverride`, `Runtime.evaluate`, `Page.captureScreenshot`)
with **no Chrome to find, no `ws`, no `child_process`, no packaging change**, and no browser launch,
which makes it *faster* than the harness it replaces.

> **A resolved blocker on one half of a task is not a resolved blocker on the other.** F22's bet did
> pay — the measurement half genuinely cost ~0 lines, exactly as promised. The estimate was priced
> against the wrong half.

## 🔴 Two defects only a drive could reach

The transport is **deliberately not mocked** — a test double for a debugger session grades this
code's opinion of CDP, not CDP. Both of these were invisible to 43 green specs.

- 🔴 **A `BrowserWindow` with no `loadURL` has no renderer process, and the first CDP command hangs
  forever.** `attach('1.3')` succeeds (local, synchronous) and then **`Page.enable` never resolves**.
  Measured in a standalone probe: attach at 238ms, silence to a 45s timeout. `await
  win.loadURL('about:blank')` before attaching brings it to **4ms**.
  ⚠️ **The failure mode is the worst shape available** — not a throw, not an error result, a promise
  that never settles. The control sat on *"Rendering…"* indefinitely, which reads as a slow network
  rather than a dead call.
- 🔴 **And the hang had no deadline, which is why it was silent.** Every CDP step can hang the same
  way, so the fix is not a guard on the one command now known to misbehave: the whole operation gets
  one (20s + 20s per viewport, against a ~7s real render). ⚠️ **The cleanup must sit outside the
  race** — `Promise.race` does not cancel the loser, so destroying the window in `finally` is what
  actually ends an abandoned command.

## ⚠️ And a third that every spec passed with wrong

> **A right mechanism with a wrong presentation.**

`summarise` **must** see every viewport at once or it loses the findings that compare them (a layout
that refuses to collapse is only visible by reading narrow against wide). But `report.summary` then
describes the *whole render*, and it was being pasted onto each per-viewport capture. Driven, the
**desktop** chip's twin read:

> *"0 errors, **2 warnings** … **desktop** 1280×900px, 2 texts …; **phone** 390×844px, 2 texts …"*

Two warnings on a picture that has one, and measurements from an image the model cannot see. The
*findings* were split correctly the whole time; only the sentence above them was not. `summaryLine`
now re-derives it from the one viewport and its own findings. Pinned as a spec, inverted.

## What was measured (driven against `ai-test`, no billed call)

| | result |
|---|---|
| `https://example.com` at `390x844` | **8,810-byte PNG**, twin 348 chars, `Rendered clean: 3 texts, 3 on screen, 0 images` |
| chip label, external | **`example.com · 390x844`** — the host, not the whole URL |
| the app at `desktop,phone` | **two chips**, 6,504 and 3,153 bytes — genuinely different pictures |
| findings off the running project | `empty-decorated-box`, **1 per viewport** after the R12 fix |
| egress notice | fires on an external URL **before** the render; **absent** for the user's own app |
| viewport refusal | `tablet` → names what *is* known, plus `WIDTHxHEIGHT such as 390x844` |
| `Page.enable`, before / after | **238ms→timeout / 4ms**; whole capture ~7s for one viewport |
| control row, popup open vs shut | **67px both**, at 340px — the popup is out of flow |
| horizontal overflow, 248 → 800px | **0** for the row, the composer and `document.body` |
| the 4th button's cost | **0px at 340 and 400**, +37px at 500–599, 0px at 600+ |
| egress sentence, dark / light | **6.66** (`#a6b0bb`/`#222933`) / **6.54** (`#4a5663`/`#ecf0f4`) |
| chosen / unchosen target | **6.66 / 6.54** and **7.70 / 7.10** |
| `Viewports` label, dark / light | **5.57** (`#8b95a1`/`#181d24`) / **5.06** (`#616c79`/`#f7f9fb`) |

## 🔴 The review round, and the question that found the real gap

Richard reviewed the built feature mid-session and asked two things. **One was already
right and one exposed the thing that mattered most.**

> *"Does the renderer render the whole page, or just a standard window height?"*

**Measured rather than asserted:** a page **9.6× its viewport** (8093px at 390×844) produced a PNG
covering **8094px**. It is a full-page capture — `captureBeyondViewport` plus a clip to the measured
`pageHeight`, downscaled 0.5, which is `render-report.js`'s own factor. Nothing to fix.

> *"The user can preview the rendered page, otherwise how would they know if the browser rendered
> the right part? … we can't leave users in the dark about what the AI has seen."*

**This was a real gap and it was the important one.** Every other reference kind is inspectable by
construction — a component is on the canvas, a doc is in the docs panel, a mention names a thing the
user picked. A **capture** is made by a browser window that by definition nobody can see, and the
chip could only say how many kilobytes it was. A cookie banner, a loading state, a wrong viewport
and a good render are **identical on the chip**.

⚠️ **It proved itself on the first drive.** The `ai-test` tablet capture is a **blank white page**,
behind a chip reading a perfectly healthy `Your app · tablet · 8 KB`. Without the viewer that goes to
the model as evidence and nobody ever knows.

`ReferencePreview` shows the reference's **own base64 block** — byte-identical to what the provider
receives, never a re-render — plus the twin verbatim, because *"what was it shown"* and *"what was it
told"* are two different questions. Offered for **any** reference carrying an image, not just a
capture: the pasted-screenshot path (BLD-013) had the same gap and nobody had noticed, because that
is the one route where the user has just seen the file.

> *"If the user is creating a mobile app, they should be able to select a mobile, tablet or desktop
> render."*

Desktop / Tablet / Mobile buttons, and ⚠️ **`tablet` went into a new `NAMED_VIEWPORTS`, deliberately
not into `DEFAULT_VIEWPORTS`** — the name must be spelled the same way in the CLI, the MCP tool and
the editor, but adding it to the *default* set would silently make `render_report` measure a third
viewport on every call it has ever been asked to make. **A vocabulary and a default are different
things.** `noodl-mcp`'s 307 specs confirm nothing downstream moved.

🔴 **The buttons are derived from the spec text, not stored beside it** — BLD-016's rule, a second
time. Driven both ways: clicking Tablet wrote `desktop,phone,tablet`; typing `tablet` lit Tablet and
unlit the other two.

⚠️ **And one inversion did not go red, which was itself the finding.** The `firstImage` guard test
asserted a *doc* was not viewable — but a doc has no `images` array, so deleting the
`status === 'ready'` check passed anyway. Rewritten against a **failed reference that still carries
bytes**, the only state the guard exists for. **An inversion that stays green is a spec that cannot
fail.**

## What was NOT driven — stated, not implied

- 🔴 **"Build a page with a known responsive defect and confirm the agent names it"** needs a billed
  authoring call. **Filed to BLD-010.** Everything else in BLD-014 was reached without one.
- ⚠️ **The `capture` kind's staleness transition still has not been watched on screen** — inherited
  from BLD-011's R4 and BLD-014's R2, and unchanged here: `noteApply()` fires only on the accept
  path, so watching a chip grey costs a billed session.

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **109 suites, 1527 tests**, zero failures |
| `noodl-mcp` | **28 suites, 307 tests** — the shared package's other consumer, green after `NAMED_VIEWPORTS` |
| `@nodegx/render-measure` purity | 5 tests, green — still **no `require`** in it |
| `test:ci` | see below |

⚠️ **Baseline measured, not inherited** (one command, per the standing rule): everything except the
new directory returns **108 suites / 1492 tests** — *one more test than session 16 recorded at the
same suite count*, which is the drift that rule exists for. This session added **+1 suite / +35
tests**.

✅ **`test:ci` returned `Jasmine: 2632 specs, 6 failures` at seeds 17348 and 77154**, matched **by
name** to the documented six (AI model registry ×2, AIX-006 style vocabulary ×4). Two more seeds
confirming the floor.

🔴 **And one run in between returned 12, which is worth carrying: the order-dependent BEN-001 cluster
is SIX, not the "trio" every handover has called it.** At seed 13364 the documented six were joined
by all six BEN-001 specs — the three in *"the component interface, as the bench reads it"* **and**
three more in *"the harness export"*. Both describes read the same fixture, and all six fail with the
same signature (`Expected $.length = 0 to equal 2` — the fixture component came back with no ports
at all), so a spec-order effect that empties `ProjectModel` takes the whole file, not a third of it.
Earlier sessions saw three because at those seeds only one describe ran after whatever poisons it.

**The rule stands and did its job:** re-run at a different seed before investigating. 77154 came back
at 6 on the same commit. ⚠️ Do not read "9" as the ceiling — **6 is the floor and 12 is reachable.**

⚠️ The dev stack was down for both `test:ci` runs and stopped again at the end. Nothing is running.

## Concurrency

**No sibling was live at any point this session** — `ps aux | grep "[e]lectron/dist"` returned 0 at
start, before each `test:ci`, and at the end. The inherited uncommitted set (the two `code-editor/`
files, the `Launcher/` files, `hello-world.template.ts`, `ProjectsPage.tsx`, `ExtractToComponent.ts`,
`EditorClipboard.ts`, `useComponentActions.ts`, three `tests/` files, four untracked
`ExtractToComponentPopup`/spec files) is **untouched and still theirs**. The pre-existing `stash@{0}`
was not touched and still wants identifying.

Every commit was pathspec-scoped and verified with `git diff --cached --stat` before committing. No
`git add -A`, no `git stash`.

⚠️ **`ai-test` was not modified.** The capture path never writes to the project — it opens a hidden
window against `http://localhost:8574/`. `project.json` and `docs/uk-vat.md` are as they were.

## Driving this — what session 17 adds

- ⚠️ **A hidden `BrowserWindow` needs `paintWhenInitiallyHidden: true` and
  `backgroundThrottling: false`, or the occlusion trap eats it.** This repo has already measured an
  occluded renderer clamping timers ~1000× and never firing `ResizeObserver`; a capture window is
  occluded *by definition*. Without the first, a window that never paints screenshots as a blank —
  which reads exactly like a blank-render finding about the user's app.
- **A standalone Electron probe is the fastest way to find a main-process hang.** `electron
  /tmp/probe/main.js` with a `[elapsed] step` line per CDP command found the `about:blank` defect in
  one run, after two inconclusive attempts through the editor. ⚠️ Going through the editor is
  actively misleading when the handler serialises: the second probe was queued behind the first
  stuck call and looked like a second hang.
- ⚠️ **Read the state class off the DOM before naming which state you measured.** The contrast sweep
  labelled the *app* button "chosen" while `A URL` was the one carrying `is-chosen` — the numbers
  were right and the mapping was backwards. **Fourth of this shape in three sessions.**
- **React state that never reaches the DOM is readable off the fiber.** The twin text — the whole of
  build item 4 — is in the reference's `resolution`, not on screen. Walk `__reactFiber$…` up from a
  rendered node, then walk `memoizedState.next` looking for the array you want. That is how the
  findings claim was verified rather than asserted.
- ⚠️ **`cdp type` appends to a controlled input.** To *replace* a value use the native setter plus a
  bubbling `input` event (session 16's rule, and it applies to `<input>` exactly as to `TextArea`).

## What to do next

1. **BLD-009 (expanded mode)** is now the last unbuilt *feature* and closes **D10**. `BuildThread`
   already takes a `ThreadWidth` with an `is-expanded` variant, so the host is the work.
2. **BLD-010's list is now twelve.** BLD-004's R4 and R5; BLD-006's R12; BLD-017's F2 and F4;
   BLD-008's drafting turns + restart-resume; BLD-011's R9; BLD-013's drag-and-drop and file-picker
   paths; BLD-014's on-screen staleness; BLD-016's `get_component` consequence and its `collection`
   leg; and new here — **BLD-014's "agent names a responsive defect" criterion**, which needs the
   same billed call as BLD-016's.
3. **BLD-015 is deferred, not open.** ⚠️ Richard was asked to choose Tavily or Brave this session and
   chose neither. It needs him to sign up for and pay for an account. **Do not re-ask it as an open
   question every session** — the design is settled and needs nothing further from him.
4. **The design-system row is unchanged at four.** This session added no call-site override; the new
   control uses `MutedOnLowBg` like its three neighbours.
