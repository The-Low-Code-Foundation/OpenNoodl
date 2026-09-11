# SIG-002 — The value is already live

**Status:** ✅ **closed 2026-08-11** · **Track SIG**

> Built with SIG-004, as its §"What is on disk" required: they share the `if (d)` guard and the
> vocabulary. ⚠️ Its central premise — *answer the empty search* — turned out to be wrong about when
> the search is empty. See Register #1.

> *"He was worried and confused when he wanted to set the button label and he didn't see a 'Set' signal
> input."*

## The moment, and why it is the harder half

SIG-001's user did something and it failed. **This user did nothing and nothing failed** — they went
looking for a `Set Label` trigger, did not find one, and stopped, unsure whether the feature was
missing or they were.

There is no error to improve here. There is no wrong wire to intercept. The builder is standing in
front of a correct, complete UI **waiting for a confirmation that never comes**.

## The thing that is missing is a sentence, not a feature

A value connection *is* the binding. It is live: when the source changes, the target changes, with no
trigger and nothing to schedule. That is the single most load-bearing fact about NodeGX's data model
and **it is currently taught only by things working**.

⚠️ **Do not resolve this by adding `Set` signals to value ports.** The reactive binding is the design;
a `Set` on every value input would double the port count of the whole library to restate what the wire
already promises. Builders who genuinely need to control *when* a value lands already have the answer —
Variable's `Set`, and the Run On Value Change group — and this task's job is partly to point at it.

## What is on disk

- **A `Set` exists where it is meaningful**, on Variable nodes, and its description already explains the
  relationship precisely:
  [`variablebase.ts:178-181`](../../../packages/noodl-runtime/src/nodes/std-library/variables/variablebase.ts#L178-L181) —
  *"Stores the latest value now. This is additional to Value storing on change; untick Value under Run
  On Value Change to stop that."* That is the sentence this task needs to surface **at the moment a
  builder is looking for it**, rather than on a node they have not opened.
- **Run On Value Change is the real control**, and its group is not even in Text Input's
  `groupPriority` — noted in an existing source comment at
  [`text-input.ts:45`](../../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts#L45), so it sorts after
  everything named. The mechanism that answers *"but I want to control when"* sorts last.
- **The popup has a place to put this.** `DocsPopup` already renders per-port help beside the hovered
  row ([`DocsPopup.tsx`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/DocsPopup.tsx)).
- ⚠️ **But it renders only when the catalog has an entry.**
  [`PortItem.tsx:54`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/PortItem.tsx#L54) is
  `if (d) { … setShowDocs(true) }` — a port with no documented body shows **no popup at all**, so an
  affirmation written as a doc body would appear on documented ports only. This is the same guard
  SIG-004 has to change; **do them together or do SIG-004 first.**

## Build

1. **Every value input states its own liveness, on hover, whether or not it is documented.** One line,
   from the type, above whatever the catalog says:
   > **Value — live.** Updates whenever the source changes. No trigger needed.

   This is SIG-004's mechanism with the other polarity, which is why the two tasks share a seam.
2. **Answer the question at the point it is asked: the empty search.** When a builder types into the
   connection popup's search and matches nothing — *"set"*, *"trigger"*, *"update"* — that is the
   literal keystroke of this complaint.
   [`ConnectionBar.tsx:172-174`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/ConnectionBar.tsx#L172-L174)
   already filters on `displayName`, and `.noPortsMessage` already exists in the stylesheet
   ([`ConnectionPopup.module.scss:77-80`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/ConnectionPopup.module.scss#L77)).
   Give it real copy for the searches that mean this:
   > No **Set** on this node — value inputs update on their own. To control *when* a value lands, use
   > a **Variable** and its `Set`, or untick the port under **Run On Value Change**.
   ⚠️ Match on intent words, not on every empty result. An empty search for `xyzzy` should say nothing
   clever.
3. **Make Run On Value Change reachable from that sentence**, since it is the actual answer and it
   currently sorts last on the node that most needs it (see above). At minimum, name it. Whether it is
   also promoted in the ordering is **SIG-003's** call, not this task's.
4. **Say it once on the wire, too.** A newly created value connection is the other moment the fact is
   relevant and nothing is said. ⚠️ Scope guard: this is a *candidate*, not a requirement — a toast on
   every connection would be intolerable by the tenth wire. If it is done at all it is once per project,
   or first-run only, and it belongs to whoever owns onboarding, not here.

## What "good" looks like

A builder who has never read the docs hovers `Label`, reads *"updates whenever the source changes, no
trigger needed"*, and stops looking for the `Set`. The whole task is that they stop looking.

## Acceptance

- [x] Hovering any value input states that it is live, including on an undocumented port — the `if (d)`
      guard is inverted (SIG-004 §2). Driven on `Variant` and `Label`; both showed
      *"**Value — live.** Updates whenever the source changes. No trigger needed."* above the catalog
      prose.
- [x] Searching `set` on a Button returns the answer. ⚠️ **Not because the list was empty** — see
      Register #1.
- [x] Searching `xyzzy` returns the ordinary empty state (*"Can't find any inputs"*), no advice,
      `isAnswer: false`.
- [x] The copy names **Variable**'s `Set` and **Run On Value Change**. ⚠️ Re-check after SIG-003, which
      may rename the group — the string lives in `portCopy.ts`, one place.
- [x] The library gains no new `Set` ports: `git status` on `packages/noodl-runtime/src/nodes` and
      `packages/noodl-viewer-react/src/nodes` is clean.

## Register

| # | Finding | State |
|---|---|---|
| 1 | 🔴 **"Answer the empty search" is the wrong trigger, and a Button proves it.** §2 specifies the copy for when the search *matches nothing*. Driven, searching `set` on a Button returned **three** ports — `Box Shadow Offset X`, `Offset Y` and a sibling: **`set` is a substring of `offset`**. So the builder from the complaint types the exact word, gets three shadow-offset ports, and is *further* from the answer than an empty list would have left them, because the list now looks like it worked. The condition is not "nothing matched", it is **"there is no `Set` here"** — no *signal* input whose name contains the word. The answer now renders beside whatever the search returned. | ✅ fixed, 4 specs |
| 2 | ⚠️ **A value port literally named `Set` must not silence the answer.** The check is on signal inputs only: a value input called `Set` is not the trigger they are looking for, and pointing at it would teach the wrong thing. | ✅ guarded |
| 3 | ⚠️ **The intent list fires on prefixes from three characters**, so `trig` and `updat` answer mid-type. Two characters do not — `se` is a prefix of half the library — and a longer word that merely *starts* with an intent term (`settings`, `runtime`) does not. | ✅ built |
| 4 | 📋 **§4 (say it once on the wire too) not done.** It is marked a candidate, not a requirement, and it belongs to whoever owns onboarding: a toast on every connection is intolerable by the tenth wire, and "once per project" needs a first-run store this task does not own. | 📋 deferred, as scoped |
| 5 | ⚠️ **Run On Value Change is named but not promoted.** §3 says "at minimum, name it", which is done. Whether it also moves in the ordering is SIG-003's call, and Text Input still does not list it in `groupPriority` — so it still sorts last on the node that most needs it. | 📋 SIG-003 |
