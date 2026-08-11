# SIG-003 — Groups that mean something

**Status:** ✅ **closed 2026-08-11** · **Track SIG** · ⭐ **flagship**

**§2 answered by Richard on 2026-08-11: the teaching end, `Values` / `Actions` / `Events`.** §1, §2
and §3 all shipped in `2f513016`. The normative write-up is
[`dev-docs/reference/PORT-GROUP-VOCABULARY.md`](../../reference/PORT-GROUP-VOCABULARY.md); the gate is
`npm run catalog:groups:check`, wired into the `node-catalog` CI job.

| Measure | Before | After |
|---|---:|---:|
| Static ports with no `group` | **167** (58 node types) | **0** |
| Ports in a kind heading that is not their kind | **35** | **0** |
| Ports in a retired group (`Value`, `Signals`, `Changed Events`) | **63** | **0** |
| `groupPriority` entries naming a retired group | **4** (found by grep; the first gate could not see them) | **0** |
| Connectable *dynamic* ports with no group | **2 seams** | **0** |

⚠️ **One acceptance criterion was not implemented, deliberately — see Register row 2.**

> *"On the text node the 'Text' output isn't under 'Values' but 'Other', and the Changed signal is
> under Other rather than Signals."*

Richard's report is right, and the mechanism is worse than it sounds: on the family of nodes where it
happens, **the only port with a heading is the one no beginner should touch.**

## What is on disk

### An ungrouped port falls to `Other`

[`ConnectionBar.tsx:176`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/ConnectionBar.tsx#L176):

```ts
const name = p.group ? p.group : 'Other';
```

So `Other` is not a category anyone chose. It is the **absence of a `group:` line** in a node
definition, rendered as if it were a decision.

### On every Variable node, that is four ports out of five

Read in [`variablebase.ts`](../../../packages/noodl-runtime/src/nodes/std-library/variables/variablebase.ts) — the base for
String, Number and Boolean variables:

| Port | Line | `group` |
|---|---|---|
| `value` — **Value** (in) | [:130-132](../../../packages/noodl-runtime/src/nodes/std-library/variables/variablebase.ts#L130) | **none** → `Other` |
| `saveValue` — **Set** (in) | [:178-179](../../../packages/noodl-runtime/src/nodes/std-library/variables/variablebase.ts#L178) | **none** → `Other` |
| `savedValue` — **Value** (out) | [:202-204](../../../packages/noodl-runtime/src/nodes/std-library/variables/variablebase.ts#L202) | **none** → `Other` |
| `changed` — **Changed** (out, signal) | [:212-214](../../../packages/noodl-runtime/src/nodes/std-library/variables/variablebase.ts#L212) | **none** → `Other` |
| `treatEmptyAs` — **Treat empty as** | [:160-167](../../../packages/noodl-runtime/src/nodes/std-library/variables/variablebase.ts#L160) | **`'Advanced'`** |

**The four ports that are the entire point of the node are unfiled. The one that is pure NDA-003
back-compat is the only one with a heading.** A beginner opening a String variable sees a category
called *Advanced* and a bucket called *Other* containing everything they came for.

### Value and signal share a heading where a group *is* set

Text Input files its `Text` **output** and its `Text Changed` **signal output** under the same
`General`:
[`text-input.ts:253-254`](../../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts#L253) and
[`:273-275`](../../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts#L273). So even a
correctly-grouped node teaches nothing about the distinction this phase is named for.

### There is no one vocabulary

Census of `group: '…'` across [`noodl-viewer-react/src/nodes`](../../../packages/noodl-viewer-react/src/nodes/) and
[`noodl-runtime/src/nodes`](../../../packages/noodl-runtime/src/nodes/), 2026-08-09:

| Count | Heading | | Count | Heading |
|---:|---|---|---:|---|
| 180 | General | | 15 | Connection |
| 153 | Events | | 14 | Config |
| 95 | Actions | | 13 | Transition |
| 61 | Status | | 13 | States |
| 41 | Data | | 11 | Store |
| **30** | **Value** | | 10 | Request |
| 25 | Realtime | | 10 | Properties |
| 24 | Error | | … | … |
| **16** | **Signals** | | **6** | **Values** |

…with a long tail including **`Change` (6) beside `Changed Events` (5)**, and
**`Inputs` / `Outputs` / `Parameters` / `Properties`** as four separate headings for what is arguably
one idea.

**`Value` (30) and `Values` (6) are both live.** So is `Signals` (16), which means some author already
reached for exactly the heading Richard expected — sixteen times — and it never became the convention.

### Ordering is a per-node list, and an unlisted group sorts arbitrarily

[`ConnectionBar.tsx:183-199`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/ConnectionBar.tsx#L183-L199):
default priority `['General', 'Events', 'Actions', 'States']`, overridable per node via
`type.connectionPanel.groupPriority`, with `Other` forced to the bottom. A group **not named in the
priority list keeps whatever order it happened to be built in** — a fact already recorded in source, at
[`text-input.ts:45`](../../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts#L45), about `Run On Value Change`.

So the ask *"make the topmost categories the most used ones"* is not one change. It is: fix the
per-node lists, fix the default, **and** make an unlisted group's position defined rather than
incidental.

## §1 — The audit (mechanical, and the bulk of the work)

Every port in the library, checked against three questions:

1. **Does it have a `group` at all?** If not, it is in `Other` and needs one.
2. **Is the group the right one** — in particular, is a signal filed with values, or a value with
   signals?
3. **Is the group named in that node's `groupPriority`?** If not, its position is undefined.

⚠️ **This is a gate, not a sweep.** Add a check that fails when a port declares no `group`, in the same
place the catalog gates already run — and remember that **catalog gates read the working tree**, so a
green gate on an uncommitted tree proves nothing about what shipped.

⚠️ **Dynamic ports do not appear in a static read.** Ports registered at runtime — `Ports.renderParams`,
`registerOutputIfNeeded`, `conditionalports`, `expand` — carry a group or do not, and a grep of node
definition files will not see them. Check the dynamic-port seams explicitly or the audit will report
clean while `Other` is still full on the nodes that build their own ports.

## §2 — The rename ⚠️ **decision needed from Richard**

The vocabulary needs to collapse. What it collapses *to* is a product decision, not an engineering one,
and the census above is the input. Two defensible ends:

- **Minimal:** merge only the outright duplicates — `Values` → `Value`, `Change` → `Changed Events` —
  and leave the rest. Cheap, no relearning for existing builders, and it does not deliver the thing
  Richard asked for, which is a heading that teaches.
- **Teaching:** headings that name the *kind* of port, so the popup itself carries the distinction —
  e.g. **Values** (things that are, and stay) and **Actions** / **Events** (things that happen).
  `Signals` (16 uses) is the honest existing name but is jargon; `Actions` (95) and `Events` (153) are
  already the two halves — a signal input is an **Action** you cause, a signal output is an **Event**
  that happened.

**The recommendation is the teaching end, using `Values` / `Actions` / `Events`** — because all three
already exist in the library with large counts, so it is mostly a consolidation rather than an
invention, and because it makes the popup teach the model without a single word of prose. But this is
Richard's call and the task should not start §2 without it.

⚠️ **Whatever is chosen, `group` strings are matched by literal equality against `groupPriority`
arrays.** A rename that misses a `groupPriority` entry silently demotes the group to unordered — the
exact defect in `text-input.ts:45`. Rename both sides or neither.

## §3 — The order

1. A **default** priority list that reflects use, replacing `['General','Events','Actions','States']`.
2. An unlisted group's position becomes **defined** — alphabetical after the priority list, ahead of
   `Other` — so a new node's new group lands somewhere predictable rather than in build order.
3. Per-node `groupPriority` lists reviewed against the renamed vocabulary.

⚠️ `Other` stays at the bottom, but after §1 it should be nearly empty. **If `Other` is still large at
the end of this task, §1 was not finished** — that is the measurement, not a judgement call.

## Acceptance

- [x] No port in the library ships without a `group`. Enforced by a gate that fails, not by a sweep —
      and the gate is run against a **committed** tree. `npm run catalog:groups:check`, in the
      `node-catalog` CI job after `catalog:check`. **Verified by injection, not by reading a green
      line:** one violation of each class was introduced and the gate returned exit 1 each time.
- [x] On a String variable, `Value`, `Set`, `Value` (out) and `Changed` all appear under real headings,
      and `Other` is empty. Inputs read **Values · Actions · Advanced · Run On Value Change**; outputs
      read **Values · Events**. Driven in the running editor, not only computed.
- [ ] ⚠️ **Not implemented, and the criterion is wrong as written** — "no node files a signal port and
      a value port under the same heading". See Register row 2. The narrower rule that *is* enforced:
      the three **kind** headings must be pure; **subject** headings need not be.
- [x] `Value`/`Values` and `Change`/`Changed Events` no longer both exist. `Value` → `Values` (37
      ports), `Changed Events` → `Events` (5). ⚠️ `Change` is kept — see Register row 3.
- [x] Every `group` string used anywhere appears in the default priority list or sorts by the defined
      rule — no group's position is incidental. `orderGroups`, 3 tiers, 12 specs.
- [x] ⚠️ Dynamic ports checked at their own seams, with the node types named in the register. Two
      connectable seams were ungrouped: **Event Receiver** and **Page Stack**. See Register row 6.
- [x] Richard has answered §2 before any rename lands. Answered 2026-08-11, before the first rename.

## Register

| # | Finding | State |
|---|---|---|
| 1 | 🔴 **The gate's fourth rule was a check that could never go red.** It read `node.connectionPanel.groupPriority` off the generated catalog — and the catalog carries `connectionPanel` on **none of its 175 node entries**. It printed a confident `✓ 0` while four cloud nodes (`hmac`, `secret`, `jwtsign`, `jwtverify`) really did still list the retired `'Value'` after their ports had been renamed to `'Values'` — the exact silent-demotion defect recorded at `text-input.ts:45`. Found only because the same question was also asked with `grep`. The rule now reads **source**. **A green line from a gate is worth nothing until you have seen that gate go red.** | ✅ fixed, verified by injection |
| 2 | 🔴 **An acceptance criterion, applied literally, would have made the library worse.** "No node files a signal port and a value port under the same heading" reads as obviously right and is wrong for **subject** headings. `Drag`'s `Snap To Position X` is `Do` + `Duration` + `Value`: a task and its parameters. `Group`'s `Scroll To Element` and `Scroll To Index` are the same shape. Splitting the trigger from its parameters by kind puts three ports an author always uses together under two headings. 77 node/group pairs mix kinds and **most of them are correct**. Implemented as: kind headings (`Values`/`Actions`/`Events`) are pure and gated; subject headings are not policed. | ✅ narrowed, written up as normative |
| 3 | ⚠️ **The task's own census was wrong about `Change`.** §2 pairs "`Change` (6) beside `Changed Events` (5)" as an outright duplicate to merge. Read port by port they are not one idea: every port under `Changed Events` is a **signal output**; every port under `Change` — on Array Changed and Object Changed — is a **value** describing what changed (`index`, `item`, `key`, `previousValue`). `Changed Events` is a fifth name for `Events` and is retired; `Change` is a subject heading and is kept. Merging it into `Values` would have collapsed "what the array is" into "what changed about it" on the two nodes whose entire job is that difference. | ✅ census corrected |
| 4 | 🔴 **Someone had already tried this fix, and it did nothing.** `logic-builder.ts` carried `group: '', // Empty group to avoid "Other" label` on two ports. `ConnectionBar` reads `p.group ? p.group : 'Other'` — the empty string is falsy, so both ports landed under `Other` exactly as if the line were absent. It was also a **duplicate object key**, silently overriding the declaration above it. The comment named the right defect and the code was inert against it. | ✅ fixed |
| 5 | ⚠️ **`error` was the same port under two headings on 74 nodes.** A value output named "Error" sat under `Events` on 33 nodes and under an existing `Error` group on 41. The library had already answered its own question, by a majority, and nobody had noticed. Moved to `Error`, which resolved 33 of the 35 kind-heading violations without touching the Failure Contract's `failure`/`error` pairing. | ✅ fixed |
| 6 | ⚠️ **Two dynamic seams were connectable and ungrouped, and a static read saw neither.** `isPortConnectable` only refuses `allowEditOnly` **object** types, so a dynamic port declared `type: 'string'` or `type: 'component'` reaches the popup like any other. **Event Receiver** publishes one `*` output per payload key — the ports an author came for — with no group; **Page Stack** publishes `pageComp-*` / `pagePath-*` per page. Both were in `Other` on every project that used them. The `intype-*`/`outtype-*` ports on the script hosts *are* `allowEditOnly` and are exempt. Also found: **Logic Builder** filed a block program's signal inputs *and* its signal outputs under one `Signals` heading. | ✅ fixed, seams listed in the gate |
| 7 | ⚠️ **60% of the 167 came from ten port names.** `this` (27), `childIndex` (27), `childrenCount` (12), `blockTouch`/`clickBubbling` (6 each) and the Variable four. Three edits in `react-component-node.ts` cleared 44 of them. The audit looked like 58 node files and was really about six. **Measure the concentration before estimating an audit.** | 📋 recorded |
| 8 | ⚠️ **A quarter of the ungrouped ports were on deprecated nodes** (44 of 167, 14 node types) — `Button`, `Text Input`, `Label`, `Options` and friends, whose live replacements are `net.noodl.controls.*`. Fixed anyway: they still render in existing projects, and a gate that exempts them is a gate that decays. But the *live* number was 123, not 167, and the two are worth reporting separately. | ✅ fixed |
| 9 | ⚠️ **The dependency SIG-002 warned about did not fire.** `TIMING_INTENT_ANSWER` in `portCopy.ts` names **Variable**'s `Set` port and the **Run On Value Change** group. `Set` is a `displayName` (unchanged by a `group` edit) and `Run On Value Change` is a subject heading (not retired), so no copy changed. Recorded because the warning was correct to make — it just landed on the two names this rename happened not to touch. | 📋 recorded |
