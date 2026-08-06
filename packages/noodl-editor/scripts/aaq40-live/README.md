# The AAQ live pass — driving the launcher wizard with no provider

Phase 40's Layer 1 (AAQ-001..004) closed four seams with 2165 green specs, and none of it had ever been
seen running. This drives the whole launcher path in the running editor — scoping conversation, project
creation, plan review, authoring fan-out, apply — and then asks the *runtime* the questions the
acceptance criteria ask.

It needs **no AI provider**. `AiClient` is a plain object literal, so `chatStream` and `isConfigured` are
replaceable at runtime (the recipe `aix15-live/scripted-session.js` established). The difference here is
that the responder is **request-aware**: it dispatches on which tools the caller offered, so one patch
serves the scoping turn and both authoring sessions.

## Why a scripted provider is not a weaker test

Everything Layer 1 does — registering pages in the router, writing `bodyScroll`, filling the schema cache,
re-validating at apply — is performed by the **apply transaction**, downstream of the provider boundary.
The model neither registers a page nor writes a project setting. Replacing the provider changes what gets
built, not whether the transaction does its job.

What this does **not** test is authoring quality. That is AAQ-005..007's business, and it needs a real
model.

## Use

```bash
npm run dev:debug -- --quiet          # editor must be running
node packages/noodl-editor/scripts/aaq40-live/wizard-replay.js \
  --drive --fast --name=aaq40-pass --location=/some/scratch/dir
```

- `--install` alone leaves the editor scripted so the wizard can be driven by hand.
- `--fast` streams each submission as **one** partial payload instead of eight. Prefer the default when
  the partial path is what you are testing; prefer `--fast` when it is not. It used to be the difference
  between a 7-minute run and a 20-second one — that was this script's own timer pacing being throttled,
  and it is fixed (see below).
- `--location` should be a scratch directory. The launcher's recents and the project scanner are the
  user's; clean up after yourself.

## What it measured, 2026-08-05

Three defects, all invisible to the suite, all fixed — see
`dev-docs/tasks/phase-40-ai-authoring-quality/README.md`. Plus one number that turned out to be about
this script rather than about the editor: authoring a 55-node component took **6m51s** against a
zero-latency provider, filed as AAQ-011 F6 as "editor main-thread time".

**It was not main-thread time and it was not the editor.** What the panel shows per operation is
`endedAt - startedAt` — `Date.now()` around `await session.run()` (`PlanRun.ts:644,700`,
`ProjectAuthoringView.tsx:1329`) — so it is wall clock, and nothing in the pass measured CPU at all.
The wall clock went on the fourteen `await new Promise(r => setTimeout(r, …))` this script used to put
between fragments: the editor's window is occluded whenever a script drives it from a terminal, and
Chromium clamps a timer in an occluded window to a second, then aligns it to a whole minute once the
window has been hidden for five. Fourteen of those is minutes. The pacing is a `MessagePort` task now.

The editor's own cost is flat, and is now measured by a committed driver
(`packages/noodl-editor/scripts/aaq011-perf`): **400 nodes streamed as 4000 partial payloads costs
5.7ms in the whole `onToolCallPartial` path**, publishes included, because the publish is gated on an
element closing rather than on a fragment arriving.

## Traps this run paid for

- **A button below a panel's fold has a non-zero bounding box.** The "zero-sized box" guard does not
  fire, `dispatchClick` reports success, and the click lands on whatever is at those coordinates. Use
  `clickVisible`, which scrolls into view and refuses a box outside the viewport.
- **The apply button has two spellings** — "Apply to project (3)" when everything staged, "Apply 1 of 3
  to project" when some failed. Matching only the second reads a clean run as a hang.
- **HMR does not reach a mounted panel's callbacks.** A fix to `ProjectAuthoringView.applyPlan` was in
  the module and not in the running closure; the apply failed identically until a full restart. Verify
  the running code (`__wr('…').fn.toString()`) before concluding a fix does not work.
- **A cold editor's first scoping turn can take over a minute**, nearly all of it module loading and the
  wizard's first render. The scripted reply itself is ~100ms.
- The fixtures are careful about two things a reader will get wrong: `RouterNavigate.target` is the
  **full legacy component name** (`/Pages/Puppies`), and the Create Record node's collection parameter is
  **`collectionName`**, not `collection` — `resolveSchemaPortContext`'s own default is the latter, which
  is exactly how this fixture got it wrong the first time.
