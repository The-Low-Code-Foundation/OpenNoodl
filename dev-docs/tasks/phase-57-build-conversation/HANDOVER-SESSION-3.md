# Phase 57 — handover after session 3 (2026-08-09)

**What ran:** **BLD-001 committed, then driven.** Register **B1 is closed** — the Build panel has now
been exercised in a real editor for the first time. Six of its claims held. Two defects did not, and
one of them is **D1's own promise**, so ⭐ **BLD-001 is built but D1 is not closed.**

Phase 57 is **3 of 16 built** (BLD-001, BLD-007, BLD-012). ⚠️ **BLD-007 and BLD-012 are still
undriven**, and BLD-012's is the one with a bill attached to getting it wrong.

**The one thing worth carrying:**

> **The frame's own promise is exactly what the frame's specs cannot check.**

BLD-001 splits on the OBS-002 boundary: a pure turn model with 37 jest specs in plain Node, and a
React half that hosts it. `tsc` was clean, all 37 specs green and the jasmine suite green **while B8
was dead and B9 was live**. Both defects live in the *seam* between the pure model and the panel
hosting it — which is precisely the half the split makes untestable offline. The split is still
right; the trade is that its evidence stops at the boundary. **Weigh that whenever a task's evidence
reads "N pure specs."**

## What is on the branch

| Commit | What | Whose |
|---|---|---|
| `a93720b3` | BLD-001 — one thread, one composer; the intent comes from the planning turn | this session (swept session 2's tree — see Concurrency) |
| `e474dd7a` | BLD-001 built; the handover that claimed a commit it never made | this session |
| `02c3072c` | the composer's Enter binding — one prop name, two different keystrokes | session 2 |
| `cdfc7e6b` | gates confirmed (`Jasmine: 2582 specs, 6 failures`, the known baseline) | session 2 |
| `b9a26a84` | **BLD-001 driven** — the drive record, B1 closed, B9 filed | this session |

## Two things the next session must not repeat

**1. The session-2 handover said BLD-001 was on the branch. It was not.** Every file was dirty or
untracked. A handover is written *before* the commit it describes, so its past tense is a plan.
**Read `git log`, not the table.**

**2. `git status` was clean for a reason I did not expect.** I edited `BuildThread.tsx`, drove the
editor for twenty minutes, and came back to a clean tree — because the concurrent session had
committed my edit. `git log -S "<a string from your edit>" -- <file>` answers this in one shot.
**Commit early here; uncommitted work in this checkout is ambient state a sibling may act on.**

## What the drive found

Project `ai-test`, `dev:debug`, panel opened with `SidebarModel.instance.switch('ai-authoring')`
(⚠️ module key is `models/sidebar/sidebarmodel.tsx` — **lowercase, `.tsx`**; a `SidebarModel.ts`
regex finds nothing).

**Confirmed:** one scroll container in the turn region (the embedded views render flat, as
`ThreadBody`'s `isEmbedded` fragment intended) · the grid holds at panel width, 60 + 488 + 123 ≈ 670,
content width 364 · send → plan → route works, first time any provider has answered this path · the
composer clears and re-disables · no control appears twice · **panel switch away and back preserves
the run**, which closes BLD-001's last unticked acceptance box.

### 🔴 B9 — the thread resets on every successful send

Three requests, `chatStream` called **three times**, **one turn on screen.**

`turns` is `composeThread(history, pending, <derived from the ONE live session>)`. `history` is
appended in exactly three places: the component accept path, the component discard path, and `send`'s
*declined* / *failed* branches ([AiAuthoringPanel.tsx:358-364](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L358)).
**Never on success** — so `routePlan` replaces the plan session and the previous turn evaporates.
Those declined/failed branches are the tell that accumulation was intended and the success path was
simply missed.

**Filed, not fixed, and that was deliberate.** A fix must clear two traps or it reintroduces exactly
what B7 was about:

1. `freezeTurns` only strips `busy`, so frozen turns keep their `plan-*` ids, and `lastPlanTurnId`
   takes the **last** one — freeze without re-prefixing and the *live* plan view mounts on a
   **historical** turn.
2. `showPlan` is `route === 'plan' || Boolean(planSession.plan)`, so a later request routing to
   `component` while the store still holds the old plan puts the frozen copy **and** the live
   derivation on screen together — the duplicated message this phase is measured on.

### B8 — the composer answered no key at all, and my reason for fixing it was wrong

The binding was added after noticing `BuildThreadProps.canSend` documented *"disables Send and Enter
alike"* while the `TextArea` had no key handler. It works (verified with a real
`Input.dispatchKeyEvent`: provider calls 3→4, composer cleared). **But the justification written with
it was wrong**, and session 2 caught it: the `onEnter={refine}` I found by grepping the old panel
belonged to the refine **`TextInput`** (plain Enter). The composer is a **`TextArea`**
(Shift+Enter), and the old description field had no binding at all. **A gap, never a regression.**

*One grep hit for a prop name is not evidence about the control you are editing, when two controls
share the name and not its meaning.*

## The recipe for driving this panel with no provider

There is no API key on this machine, and **the existing asset does not fit any more**:
`scripts/aix15-live/scripted-session.js` replays a `submit_component`, and BLD-001's panel now routes
**every** send through `PlanningSession` first. Script the *planning* turn instead — patch the
provider boundary and nothing else:

```js
AiClient.isConfigured = () => true;
AiClient.chatStream = async (request, cb = {}) => {
  // throw on a non-planning request rather than return something the session misreads
  if (!(request.tools || []).some((t) => t.name === 'submit_plan')) throw new Error('unexpected turn');
  const args = { operations: [ { kind: 'create', target: 'Pages/Customers', intent: '…' }, … ] };
  const toolCall = { id: 'x', name: 'submit_plan', arguments: args };
  cb.onToolCall && cb.onToolCall(toolCall);
  return { text: '…', toolCalls: [toolCall], usage: {}, model: 'drive', stopReason: 'tool_use' };
};
```

Intent comes from `classifyPlan` (two component operations → `plan`), **not** from the agent's prose.
Drive it with `scripts/devtools/cdp.js`'s exported `appTarget` / `connect` / `evaluate` — re-deriving
target resolution is how a script silently attaches to the preview renderer.

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **86 suites, 1162 tests** — +2 / +37 over the pre-BLD-001 baseline, exactly the new specs |
| `test:ci` | `Jasmine: 2582 specs, 6 failures` — the known baseline, confirmed **by name** at `cdfc7e6b` |

⚠️ **`tsconfig.tests-main.json` is not typechecked by any script** (there is no `typecheck:tests-main`),
so the pre-existing errors in `tests-unit/erg-005/componentContract.pending.ts` are ungated and
unrelated. The allowlist entry BLD-001 added to it is a convention marker, not a gate.

⚠️ **Never `tail` a `test:ci` run you intend to read a verdict from** — the pipe eats the `Jasmine:`
summary and the result looks exactly like a swept suite. Redirect to a file and grep it.

## What to do next

1. ⭐ **B9.** It is the phase's exit test (*"the thread never resets"*) failing on the most basic
   interaction there is. Read the two traps above before touching `freezeTurns`. **The natural owner
   is BLD-006** — it already owns thread persistence and the switcher — but the reset is not a
   persistence bug, so do not wait for BLD-006's other scope to be ready.
2. **BLD-003, then BLD-002.** Unchanged from session 2, and BLD-003 is still the one that makes the
   control count measurable: the panel's Accept/Discard is now on the outcome card, so the preview
   document's copy is the **second** one on screen (**B5**). ⚠️ Both must keep the README correction:
   **contrast is not the legibility problem** — type scale is. No colour tokens.
3. **Drive BLD-007 and BLD-012.** Both are merged and neither has been driven; BLD-012's image block
   has never reached a real endpoint, and it has *no symptom except the bill*.
4. **BLD-005** is still nearly free — `BuildThread` already has a header row outside the scroll area,
   which is the thing `runHeadline` needed.

## Concurrency — read this one carefully

⚠️ **The concurrent session was working on the same task, not a disjoint one.** Session 2 was still
running when this session started; I read its handover as a completed record and committed its
working tree. It then committed over mine. Both of us produced correct, well-scoped commits and
nothing was lost — but **"territory is disjoint" was false for phase 57**, and the earlier handovers
say it is true.

Nothing of phase 46's was swept in either direction. Every commit here used
`git commit -- <explicit paths>`; `git status` was re-checked immediately before each one, and it
still surprised me once. **Re-check `git log` as well as `git status`, and assume a sibling may be
inside your own task.**

## Fixture and worktrees

No fixture touched and no worktree created. The drive opened **`ai-test`**
(`~/vscode_projects/NodeGX test projects/ai-test`) and left three scripted plan turns in its Build
panel; nothing was authored, nothing was accepted, and the project on disk is unchanged. The dev
stack was stopped (`dev:stop`, 25 processes, nothing left running).
