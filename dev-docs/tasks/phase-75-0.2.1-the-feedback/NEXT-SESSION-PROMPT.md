# Phase 75 — next session

**State as of 2026-08-25 (session 31).** FB-021 scopes 1/3/4 are **built, driven, gated and
committed** (`2edc6946`, `7e0f4564`). Richard's brief for the next sessions is **speed: keep
knocking out phase 75**. So this file leads with the queue. Read *"The queue"*, take the top
unblocked item, and only dip into the rest when it bites.

⚠️ **Peers.** `3878` is **opennoodl-78**, this checkout. Other names are other projects.
🔴 **`SendMessage` to a cross-session peer needs the `[ref]`** — the bare name is rejected with the
ref in the error, so just re-send.

## The queue — unblocked, cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **FB-002 editor mirror** | **S** | web half done; task file says it is **cheaper than filed** — `accepted` is already on the wire |
| 2 | **FIX-025 §5/§7/§12** (phase-74 dir) | **S/M** | **already built** — it needs only the editor drive |
| 3 | **FB-021 scope 2 + the canvas** | **M** | ✅ RULED + fully scoped s31, blocker understood — see below |
| 4 | **FIX-027 17, 19, 20** (phase-74 dir) | **S/M** | ⬜ unblocked, no ruling needed |
| 5 | **FB-014** search that survives renames | **M** | design + prototype only, pgvector |
| 6 | **FB-005** templates | **S then L+** | **scope doc first** — that doc is the unblocked part |
| 7 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** Pulls in FB-014's 2nd corpus |

**Blocked on Richard, do not start:** FB-012 and FB-009 (both need *content* from him), FB-017
scope 2's `Source Set`, FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
`ANTHROPIC_API_KEY` (⚠️ **intro pricing ends 2026-08-31 — six days**), the 15 lessons' prose,
Discord's row in the `?` menu, `/rfps` search.

✅ **Nothing is waiting to deploy.** `nodegx-community` `acd4a9a..main` is **empty** and both
commits TASKS.md called unshipped are ancestors of it (measured s31; that line is now corrected).
⚠️ The *stamp on the box* is relayed from s19's SSH read — re-read it before any deploy claim.

## Queue item 3 in full — FB-021 scope 2 + the canvas (ruled s31)

**Richard's ruling.** Scope 2: *"the more there's visual feedback the less grief I'll get from
confused non-tech builders"* → **mark, do not hide**; a `basic`-gated port stays offered in the
connection popup, drawn inert with its reason. The canvas: *"make it dotted for a port that can't
work — that's what happens when a port is deleted"*. Level ruled **amber `warning`**, not `error`:
the wire is valid and its value ignored, so red keeps meaning *"cannot work at all"*.

✅ **His instinct maps onto machinery that already exists** — and finding it exposed **the same
defect on a second surface**. `evaluateConnectionHealth` already dashes a wire whose port is gone,
via `con-no-target-port` → `getConnectionHealth` → `setLineDash([5])`. Its check reads

```js
!targetPort || !NodeLibrary.instance.isConditionalPortValid(targetNode, c.toProperty, ['extended'])
```

and `portConnectivity.ts` spells out the scope: `extended` = *"not on the node at all"*; an unnamed
group defaults to `basic` and *"only suppresses the property row"*. **So the `basic` case — all of
FB-021 — is explicitly excluded from the canvas check.** `modelProxy` hid the row;
`evaluateConnectionHealth` leaves the wire solid.

🔴 **It is NOT a one-liner: nothing re-evaluates health on a parameter change.** Triggers are
`Model.instancePortsChanged` (gated on `hasUnresolvedPortWarning`), `typeRenamed`, module
registration, variant changes. `grep parameterChanged` finds **no** path to health. A gated port's
state is a function of a **sibling parameter**, the one input health never watches — so the warning
is stale in both directions until a trigger is added. ⚠️ **It would have looked correct on any
fixture that BUILDS a graph**, because construction fires the other triggers; only flipping the
control *after* the wire exists exposes it. Same shape as FB-017's *"the panel never re-renders on a
parameter change"*.

**Shape, in order** (full version in the task file):
1. `con-target-port-gated` — port **is** on the node (`['extended']` valid) but **switched off**
   (`['basic']` invalid). Symmetric with the existing statement.
2. Message from `portGateReason.ts`; `level: 'warning'`, `showGlobally: true`.
3. The parameter-change trigger **with a guard** — only when the changed parameter gates something
   on that node's type. 🔴 `setParameter` is hot (**13 writes in one 60px drag**, FB-022) and
   FIX-007's comment is deliberate about keeping common paths off that timer.
4. **NOT** in `UNRESOLVED_PORT_WARNING_KEYS` — that list is what *ports arriving* can clear; this is
   cleared by a parameter, and adding it arms FIX-007's urgent lane wrongly.
5. The popup half: mark the offered port inert with the same sentence.
6. ⚠️ **No new dash pattern.** `restoreWireDash`'s header warns three meanings already live on
   `setLineDash` (`[5]` unhealthy, `[6,4]` `Deleted`, `[7,4]` error) and are barely distinguishable.
   The health route gets the dash free, in every paint path.
7. ⚠️ **The drive must flip the control on a graph that ALREADY has the wire.**

## The traps that cost the most rework — read before building, not after

- 🔴 **A green suite is not a working feature, and a passing spec is not a spec that tested
  anything.** Three sessions closed on *"only the drive found it"*; s31 adds *"the review found what
  the drive did not"*. ✅ **Drive it, then read the diff back.** s30's mutation pass found **2 of 18
  mutants killing ZERO rows** — both specs passing by a path unrelated to the guard they named.
  **A mutant that kills nothing is the finding.**
- 🔴 **Resolve a token before believing a sentence about colour.** `--theme-color-notice` **aliases**
  `--theme-color-warning` (`colors.css:483`, which says so) in **both** themes. A comment asserting a
  visual difference is a claim about *rendering*; reading the source back only proves the token is
  spelled as the comment spells it.
- 🔴 **A difference in argument lists is not a difference in behaviour until the callee is read.**
  `ModelProxy.isPortConnected(name)` **takes one parameter and forwards none**, so ~25 `DataTypes/`
  sites passing `'target'` pass it into a discard. ⚠️ Latent, unowned: the panel's intent that only
  *inbound* wires count is honoured **nowhere**; fixing it moves FB-018's chip on 25 row types.
- 🔴 **Completion is the summary line, never an exit code.** A notification claimed *"suite
  completion, exit code 0"* while the pid was alive and its output file was **empty** — fourth
  session running. ✅ Poll with `until grep -qE "Jasmine: [0-9]+ specs"` **that also breaks on the
  pid dying**, so a crash cannot read as "still running".
- 🔴 **Compare failures BY NAME, never by count**, and never quote a floor without re-measuring.

## Driving — the corrections that cost real time

- 🔴 **A probe that selects several nodes in ONE `eval` reads one stale DOM** — five arms came back
  identical and looked like a catastrophic bug. ✅ Select and read in **separate calls**.
- 🔴 **`window.__pv`-style handles do not survive `cdp reload`** — every field reads `null`, which
  looks exactly like a feature that stopped working. Re-acquire, then re-read.
- ⚠️ **The pencil `ModeSegmentedButton` selector is stateful** — `[aria-pressed=false]` selects *the
  other* mode, so re-running a snippet toggles back out. Read the pair, assert which one you want.
- ✅ **`projectFromDirectory` (`models/projectmodel.editor`) opens a project WITHOUT touching the
  recents list** — better than the launcher path, and nothing to clean up after.
- ✅ **Prove a gate sees your files by planting errors** — 4 planted → exactly 4 reported. One minute.
- ✅ **`postcss` is resolvable from the repo root**; one `node -e` parse validates a stylesheet edit
  properly. 🔴 grep for `--theme-color-*` hits the **built bundles** — scope to `*.css`/`*.scss`;
  the truth is `packages/noodl-core-ui/src/styles/custom-properties/colors.css`.
- ✅ **`dev:stop` reported 25 processes and spared all 8 MCP helpers** — verified by `ps` after.

## Gates, this tree (OpenNoodl, `cline-dev`) — 🔴 re-measure, never quote

- `npm run test:ci`: ✅ **2849 specs / 4 failures — THE FLOOR**, all four `AIX-006 style vocabulary`,
  matched by name. Completed 2026-08-25 15:13:30, run alone.
- `npm run test:main`: **333 files / 5380 specs / 0 failures**. ⚠️ One first-run failure in
  `tests-unit/bld-004/reasoningChannel.test.ts` (stall-timer race) was **green 3/3 in isolation and
  on the full re-run — a flake**.
- `npm run typecheck:editor`: **0 errors**, proved to see the changed files by planting.
- `npm run catalog:check`: **clean**, 175 node types. Cheapest freshness proof in the repo (4 s) —
  run it before quoting any catalog-derived number.
- 🔴 **`npm run typecheck:core-ui` is a PRE-EXISTING DIRTY GATE: 44 errors, none ours.** Do not
  quote it as passing.
- Not run, nothing touched them: `typecheck:viewer`, `noodl-runtime`, all of `nodegx-community`
  (**58 files / 1398 specs / 0 failures** as of s18, not re-run).

## Still open, owned by nobody

- ⚠️ **`.property-port-gate-target`'s outline is unmeasured in either theme** — verified as a class
  and a focus, never as pixels.
- ⚠️ **Only `Group` was driven** for FB-021; the other 174 types are covered by the catalog sweep,
  which grades *sentences* and not *rendering*.
- ⚠️ FB-022's crosshair settled by mechanism, not pixels; `user-select: none` confirmed *set*, never
  confirmed to prevent a painted selection; **one commit in three dropped focus, uncharacterised**;
  FB-016's auto-margin branch never exercised in a running app.
- ⚠️ **`AskAboutNodeDialog.module.scss` uncommitted — twelfth session.** Belongs to no session;
  Richard's call. Same for the phase-70/71/72 working files and the phase-50/68 notes.
- The highlighter's disposal bug: a **selected** node whose element has gone is never removed from
  `selectedNodes`, so it is revisited and `remove()`d every frame.
- Unchased: `SidebarModel.switch('PortEditor')` crashes the panel; Settings clips two rows; a
  `Number` node draws a group literally called `ADVANCED` beside the synthetic `Advanced CSS`;
  `getConnectionSourceLabel` returns nothing for the checkbox row; `check:css` in `nodegx-community`
  has one pre-existing non-ours violation.
- ⚠️ **Pre-existing, not ours**: the projects page logs `Encountered two children with the same key`
  for one project id, and `feed.json` 404s.
