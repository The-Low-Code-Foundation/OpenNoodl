# The unowned rows that need a measurement, not a re-read

> 🔴 **P80 session of 2026-09-03: your uncommitted s43 write-up in this file was COMMITTED by a
> phase-82 session, in `83a03557`, together with a `DEF-043` claim added to the header.** Nothing is
> lost and nothing is changed — `git status` shows this file clean because your text is now in
> HEAD, not because it went anywhere. It happened because a pathspec commit takes the file's whole
> working-tree state, including the part a sibling was still writing. Apologies for the wrong
> commit message on your paragraphs; carry on editing normally.

> 🟢 **§1 is measured and DISPROVED (2026-08-30), by phase 77 s34.** The instrument is named in
> the row.
>
> 🆕 **§6 added s29 (2026-08-31) and it is already MEASURED** — it was found by being blocked by
> it, not by a sweep. Five left to measure.
>
> ⚠️ **`DEF-039` (§7), `DEF-040` (§8), `DEF-041` (drag door) and `DEF-042` (§2) are taken (s43); `DEF-043` is
> CLAIMED below; **`DEF-044` (§9) is BUILT (s44)**.** Next free id: **`DEF-045`**.
>
> 🆕 **`DEF-043` is CLAIMED by phase 82 (2026-09-03) and the measurement is already done** — it needs
> writing up here, not measuring. **A failed re-fetch on the DEPRECATED `DbCollection` empties the
> collection it had already delivered**:
> [`packages/noodl-viewer-react/src/nodes-deprecated/std-library/data/dbcollectionnode.ts:384-387`](../../../packages/noodl-viewer-react/src/nodes-deprecated/std-library/data/dbcollectionnode.ts#L384)
> carries the identical unguarded `error: … setCollection(_c)` that P82 REL-011b AC2 fixed in
> `dbcollectionnode2.ts` (`f9a3d301`), and **both branches are in the shipped bundle**. Consequence:
> a project using the deprecated node loses every row a `For Each` below it draws on any backend
> blip, until the visitor reloads. Not fixed there because it was outside that row and outside
> 0.2.2's scope. What is owed: the same one-line guard plus a spec, or a ruling that a deprecated
> node does not get fixed. Write-up:
> [REL-011 §AC2](../phase-82-0.2.2-the-first-row-on-the-shelf/REL-011-THE-SITE-BUILDER-SHIPS.md).

**Written s23 (2026-08-30) at Richard's instruction.** The
[unowned register](TASKS.md#findings-this-phase-raised-that-nobody-owns) holds twelve rows. Seven
were re-measured at HEAD in s23's closing sweep and all seven still hold. **These five could not
be** — each needs a live backend, a screen, or a run, and a grep answers a different question.

🔴 **They are written up here rather than re-asserted in the register, because carrying an
unchecked row forward as though it were checked is how a register becomes a backlog** — the
failure this phase exists to answer. None of them is a task row yet. **Measure first; the row is
what the measurement says it is.**

⚠️ **Every one of these was true when written.** The question is not "was this real?" but **"is
this reading still right at HEAD?"** — a staleness-scoped check confirms everything and is the
mistake phase 77's re-measure nearly made.

---

## 1. `publishPage` issues its refusal after making the page public

## 🟢 MEASURED AND DISPROVED AT HEAD — 2026-08-30, by phase 77 s34

**Instrument:** `packages/nodegx-backend/tests/sbr015-execution-steps-drive.test.ts` (SBR-015 §4d)
— a deployed site-builder, a deliberate failure inside `publishPage`, and the page's stored row
read back afterwards, exactly as "what to measure" below asks.

| after the call | `published` | `ACL` |
|---|---|---|
| control, 200 | `true` | `{role:admin…, "*": {read: true, write: false}}` |
| **refusal, 400** | **`false`** | **`{role:admin: {read, write}}` — no `*` rule at all** |

**A refused publish leaves the page a draft and world-unreadable.** The control arm is beside it,
so this is not an inert row being read. Both are pinned as specs, and the row needs no phase-77
fix.

⚠️ **The bound, so this is not over-read.** The failure was forced at `withFlag`, not at the
sections query the recorded reading used. Both sit upstream of the **only** edge that can write —
`tasks.done → page.store` — so what was measured is the *ordering claim*, not one node's timing.
🔴 **If a second edge into `page.store` is ever added, this verdict stops covering the row.**

*The original row, kept:*

**Needs:** a live local backend + the site-builder template installed.

**Recorded reading (DEF-014 s10).** `POST /functions/publishPage` answers **400 "This page could
not be published."** and the page comes back `published: true` with `ACL['*'].read === true`. The
function writes the flag and opens the ACL, *then* runs the sections query that was failing.

**What to measure.** DEF-014 removed **the cause and not the ordering**. So: force *any* later
failure inside that function (a deliberately bad section row will do) and read the page's stored
`published` and ACL afterwards. If the state still opens before the refusal, the row is real and
narrower than it reads — it is about **ordering**, not about that one query.

**Why it matters to a person:** they are told the page could not be published, about a page that
is published and world-readable, and their own admin panel says *draft*. They cannot see it.

⚠️ **It is the template's graph** (phase 77/78's), and DEF-014 §5 says not to fix it from the
backend side. So even if it measures true, **the fix is not phase 80's** — the row's value is
telling phase 77 where it lives.

---

## 2. 🟡 OWNED AND DIAGNOSED — a second project deploying to a shared backend kills the process

## 🟡 MEASURED 2026-09-03 (s43) — [DEF-042](DEF-042-A-THROWING-LISTENER-KILLS-THE-BACKEND.md). 🧭 **THE FIX NEEDS A RULING.**

**Reproduced at HEAD** against the committed `dist/cli.js`: PUT 1 → 200, PUT 2 → **no response**,
status → refused, `EXIT=1`. 🔴 **But this row's central recommendation is WRONG.** It called
*"catch the rejection so the PUT answers 400"* small, clearly right and ruling-free — and that
try/catch **has been in `loadWorkflow` since WFA-001** (verified in the built bundle) and **never
runs**: no `Failed to load workflow` line precedes the crash. `EventSender.emit` is **async** and
`GraphModel.addComponent` calls it **without awaiting**, so the listener's throw rejects a promise
nobody holds — it never joins the chain the catch is watching. ⚠️ `graphmodel.ts` has **15**
un-awaited `this.emit(...)` calls; `componentAdded` is just the one a person has met.

🧭 **The proposed split does not exist.** Making the throw reachable means `addComponent` awaits
`emit` → it becomes async → the ripple is in **`noodl-runtime`, shared with the viewer**. A
backend-local `unhandledRejection` guard is wrong alone: it returns `{success:true}` for a
half-written registry, trading a loud failure for a quiet one on the one path whose design is
*"only a complete success swaps it in"*. ⚠️ Next free id is `DEF-043`.

*The original row, kept:*


**Needs:** two projects and one backend. **Reproducible outside the editor entirely**, with `curl`
against the committed `nodegx-backend/dist/cli.js` — so no editor code is implicated.

**Recorded reading (DEF-015 s11).** Two `PUT /admin/workflows/<name>` calls carrying bundles that
declare the same component names. First answers `200`. Second answers **nothing** — the process is
gone, on `Error: Duplicate component name /#__cloud__/site/SetSectionAccess`. An **uncaught throw
on an async path**: `loadWorkflow` is `await`ed from the PUT handler, the rejection escapes, Node
exits non-zero. The editor sees only `TypeError: fetch failed` and `ServiceSupervisor` logs
`exited (code=1)` with no reason, because the backend's stderr is not forwarded.

**What to measure.** Re-run the two-PUT sequence at HEAD. Confirm (i) the process still dies, and
(ii) the editor still cannot see why.

**Why it is not exotic:** the product advertises it. The backend card says *"1 attached · 23
others"*, and every site-builder project shares all seven cloud components, so **any two of them
collide on the first deploy of the second**. A *copy* of a project is always a new bundle
(`<projectName>-<hash of directory>`), never a replacement. ⚠️ `Start ephemeral` does **not** avoid
it — it drops data persistence, not the workflows directory.

**Two candidate fixes, and they are not the same size.** Catching the rejection so the PUT answers
400 and the backend survives is **small and clearly right** — that half needs no ruling. Deciding
what *should* happen when two projects deploy the same component names to one backend (namespace
per bundle / refuse the second / last-writer-wins) is a design question with a person attached.
✅ **Split them: ship the survival half, register the semantics half.**

---

## 3. The backend card cannot see a backend-side change — its only refresh is a push

**Needs:** the editor open, a backend serving fewer functions than the project declares.

**Recorded reading (DEF-015 s12).** With the backend genuinely serving three and the project
declaring four, the card kept reading **four ✓ and zero warnings** through a panel close/open
**and** a full renderer reload — backend verified as still serving three afterwards, so it was a
stale reading and not a silent re-push. The panel **hides rather than unmounts** (a stamp set on
the section survived the toggle), so `useEffect` never re-fires; `CloudFunctionsSection` refreshes
on exactly two things, mount and `CLOUD_FUNCTIONS_DEPLOY_STATE_CHANGED` with `isPushing` false —
and a push whose export hash is unchanged **returns early without `notify()`**.

**What to measure.** Reproduce the stale reading at HEAD, then check whether the `missing` row can
render at all: a successful push always leaves the backend holding exactly the project's
endpoints, so `missing` is empty by construction immediately after one. **It can only render when
a push failed.**

⚠️ **Not a defect in DEF-015's fix, and the header is honest** — it says `pushed 54s ago`. The
**rows** overclaim: *"in the project, not on this backend"* reads as a statement about the backend
*now*. Candidate fixes: refresh on panel open, poll while visible, or **reword to say *at last
push*** — the cheapest and possibly the right one.

---

## 4. `Record.Fetched` fires when the `Id` merely binds

**Needs:** a run. **The description half is already fixed** (s28) — it promised *"the record has
been read and the property outputs are up to date"*, false in both halves on that path, and was
regenerated through the catalog, the cloud library and the docs site because **there are four
copies of it**.

**What is left is a behaviour question, not a measurement one:** should a signal named `Fetched`
fire without a fetch at all? `setModel` sends it from the `Id` input setter, where `Model.get(id)`
has minted an empty local model and nothing has been read. **This is deliberate, and `Done` exists
because of it.**

**What to measure.** How many corpus graphs actually depend on the bind-time firing. Two candidate
repairs — fire only when the bound model has data, or split the bind announcement onto its own
port — and **both re-grade browser graphs that rely on today's shape**, so the corpus count *is*
the decision.

🧭 Plausibly Richard's once the number exists.

---

## 5. The one `domelement` port cannot reach the destination its own description names

**Needs:** the typecast table executed, and a wire attempted. Cheap, but not a grep.

**Recorded reading (P77 D27, s29).** `Video.onVideoElementCreated` is typed `domelement` and
described as *"for a **Group to scroll to** or a script to reach"*. `Group`'s
`Scroll To Element - Element` is typed `reference`, and `canCastPortTypes('domelement','reference')`
over the shipped `typecasts` table is **`false`**. The editor refuses the wire the description
prescribes, with a `type-mismatch`.

🔴 **And it would not have worked if it had connected.** `Group.tsx:113` calls
`noodlChild.getDOMElement()` — it wants the **node**; `Video.tsx:217` sends the raw element, which
has no such method, and the guard would report *"no rendered DOM element — it may not be mounted"*
about an element that **is** mounted. **Two defects in eight words of description.**

**Measured over the 175-node catalog:** `domelement` has **1** output, **0** inputs, and reaches
**0** typed inputs (the 14 it reaches are `*` wildcards). Control: `reference` has **27** outputs —
`this`, on every visual node — which is the working wire, one identifier away.

**Shape of the fix, ascending:** repair the description (⚠️ **four generated copies**); or widen
`scrollToElement` to accept either and add the cast; or leave the port as the script hatch it is.

🔴 **Why this row exists at all.** Phase 77's D23 proposed *"a `domelement` output on `Group`,
three lines, `video.ts` is the template"* as a fix. Copying this port would have added a **second**
unconnectable port and read as closed. **The row was stopped because the fix was checked before it
was written.**

---

## How to work these

1. **Measure one, fully, before starting the next.** Five half-measurements is the state this file
   exists to end.
2. **Every measurement needs a known-firing control beside it.** Three of the five are absence
   claims, and *"refused"* and *"never requested"* are identical readings with opposite fixes.
3. **Write the result into the register row itself**, whichever way it goes. 🔴 **Keep the
   disproved ones, marked** — a row that reverses a belief is the most valuable kind, and phase
   78's D4 is the worked example.
4. **A row that measures true gets a `DEF-0xx` id and a person's sentence**, or it is not a row.
   Ids `DEF-033`+ are free as of 2026-08-30.

---

## ✅ CLOSED — the drag door skips STYLE-002's defaults, and it bites nobody

## 🟢 DRIVEN AND DISPROVED AS A LIVE DEFECT 2026-09-03 (s43) — [DEF-041](DEF-041-THE-DRAG-DOOR-AND-THE-DEFAULTS.md)

The call-site count re-derives **exactly** at HEAD. The sentence about a person does not.
**A built-in node type cannot be dragged onto the canvas at all**: the only drag source that
reaches `createNewNode` is the Components panel, which carries a project component, and
`ElementConfigRegistry.has('/Site/Nav')` is `false`. `DragItem.nodeType` is declared, read by
`getDragItemComponent`, and **assigned by nothing**. Driven: the Checkbox card drag created
nothing **beside a control drag that created `/Site/Nav`** — and the first attempt had BOTH arms
at zero, because `dispatchDrag`'s default 12 steps never cross the panel's 5px threshold. 🔴 **A
control that reads zero would have confirmed this row by accident.**

`applyDefaults` was added to the drag door anyway — one line, a **latent** trap closed, proved
live by a presence control (checkbox → all 8 defaults) and a no-regression control (`/Site/Nav` →
`{}`). ⚠️ Next free id is `DEF-042`.

*The original row, kept:*

## The original claim — found s25 (2026-08-30)

**Not measured looking for it.** DEF-025 needed to know which creation seam reaches *both* editor
doors, and the answer turned out to be that one of the two existing mechanisms reaches only one.

`ElementConfigRegistry.applyDefaults` has **exactly one call site** —
`NodePicker.utils.createNodeFunction:25`. The other path that mints a brand-new node,
`NodeOperations.createNewNode` (reached from `nodegrapheditor.drag.ts:121` and `:132`, i.e. a **drag
from the library onto the canvas**), never calls it. `seedNewNode` is called from both, which is how
FUN-002's own header describes the pair — so the asymmetry is in `applyDefaults`, not in the doors.

⚠️ **The `-a` flag is why this was seen at all.** This repo's `grep` is ugrep with `-I`, and it
skipped `author.ts` and others *silently* as binary; the first sweep for `applyDefaults` returned
call sites that looked complete and were not. Any absence measured here without `-a` is worthless.

**What a person gets.** Four types carry an ElementConfig — `net.noodl.controls.button`, `Text`,
`net.noodl.controls.textinput`, `net.noodl.controls.checkbox`. Placed from the node picker they
arrive with token-based sizing, radius, cursor and their initial variant. Dragged from the library
they arrive bare. That includes **DEF-001's accessibility repair**: `borderColor:
var(--border-control)` is the 1.23:1 edge fix, and it is in `CheckboxConfig.defaults` and
`TextInputConfig`'s — so the same control is accessible or not depending on which gesture created it.

🔴 **Measured from source, NOT driven.** The call-site count is exact; what a dragged node actually
renders has not been observed in a running editor, and that drive is what this row owes before
anyone fixes it. ⚠️ An editor drive serves a BUILT bundle — rebuild before believing it.

**Candidate fix, not a design**: move `applyDefaults` beside `seedNewNode` inside
`NodeOperations.createNewNode` and `NodePicker.utils.createNodeFunction`, or fold it into
`seedNewNode` so "what a node arrives with" has one home rather than two with different reach.
⚠️ It is not a pure one-liner: the picker applies defaults **before** the node is added to the graph
and `seedNewNode` runs **after** (deliberately, for undo granularity), so folding them changes when
the write lands relative to the `create` undo entry.

Owner: **NONE**. Gets a `DEF-0xx` id when someone measures it.

---

## 6. `group.ts` cannot be imported from a test, so the most-used visual node is ungraded

## 🔴 MEASURED WHILE BUILDING — 2026-08-31, DEF-029 s29

Not a suspicion. DEF-029's spec tried to import `Group` and could not, and the row exists because
the workaround it forced is a permanent hole in every future spec.

**Instrument:** any test in `packages/noodl-viewer-react/tests/` doing
`import GroupNode from '../src/nodes/visual/group'`.

```
SyntaxError: Unexpected token 'export'
  at src/components/visual/Group/scroll-plugins/nested-scroll-plugin.js:212
Test Suites: 1 failed, 1 total
Tests:       0 total
```

**Why.** `group.ts` → `Group.tsx` → `scroll-plugins/nested-scroll-plugin.js`, a plain `.js` file
using ESM `export default`. This package's `jest.config.js` is bare `preset: 'ts-jest'`, which
transforms `.ts`/`.tsx` only, so the `.js` reaches Node untransformed.

Measured across the five interactive visual nodes: **`Group` is the only one that fails.** `Text`,
`Image`, `Circle` and `Video` all import cleanly.

🔴 **The failure mode is the dangerous part: `Tests: 0 total`.** That reads like a missing file or
a bad path, not like a broken import — and it is the same reading a suite gives when a module
touches the `Noodl` global too late. A spec written for Group and quietly reporting zero tests
would look like it had been deleted, not like it had never run.

**What it costs.** `Group` is the container every layout is built from and the node with the most
ports in the library. Any future row about Group's runtime behaviour has to either grade a proxy
(DEF-029 graded `addFileDropPorts` directly and said so) or not be graded at all.

**What to measure before fixing.** Whether adding a `.js` transform to this package's jest config
changes any existing suite's result — 86 suites currently pass, and several deliberately drive
untransformed fixtures. ⚠️ The config is shared, so this is not a one-line change to make casually
in a lane that is not about it; that is precisely why DEF-029 worked around it rather than
widening its own scope.

**Candidate fix, not a design**: give the package a `transform` mapping `.js` through babel, or
convert `nested-scroll-plugin.js` and its siblings to `.ts`.

Owner: **NONE**. Gets a `DEF-0xx` id when someone measures the blast radius above.

---

## 7. ✅ CLOSED — a `connections.json` with unknown field names was silently emptied and written back

## 🟢 OWNED, MEASURED, BUILT AND GATED 2026-09-03 (s43) — [DEF-039](DEF-039-A-FILE-THE-EDITOR-CANNOT-READ-IS-A-FILE-IT-DESTROYS.md)

All three bullets measured against a control that behaves, and **the third one flipped**: an
unresolvable id does *not* take the same crash — `getConnectionHealth`'s two callers hand it
**opposite shapes**, so the export path is safe from arm C and the **canvas** is not, and the
canvas throws even earlier, in `createFromModel`, taking every later wire in the component with
it. That half is reachable by ordinary means, so **the row's rank went up, not down.**
Validator: **one call site in the whole editor**, and not on the load path. The write-back: a
save of a model that was already empty at load. ⚠️ Next free id is now `DEF-041`.

*The original row, kept:*


**Found by** DEF-029's drive (session 36), by accident: the drive's own hand-authored file used
`sourceId`/`sourcePort`/`targetId`/`targetPort` where v2 wants
`fromId`/`fromProperty`/`toId`/`toProperty`.

**What happened, in order.**

1. The component loaded with **no error, no warning, and no validation failure.** The editor opened
   the project and drew it.
2. `exportComponent` → `NodeGraphModel.getConnectionHealth` threw
   `TypeError: Cannot read properties of undefined (reading 'id')`
   (`const sourceId = c.sourceId ? c.sourceId : c.sourceNode.id`), the preview never mounted, and
   the message named **neither the file nor the component nor the connection**.
3. 🔴 **The editor then wrote the file back to disk as eight empty objects** — `{}` × 8. The
   author's connection data was gone from disk, not merely ignored in memory.

```json
"connections": [ {}, {}, {}, {}, {}, {}, {}, {} ]
```

**Why it is worth a row even though a hand-written file caused it.** The product's own doors (the
editor, the MCP author tools) would not produce these field names — but the *response* to an
unrecognised connection is the defect, and it has three separate faults, any one of which would
have been enough on its own:

- the loader accepts fields it does not understand rather than refusing;
- the failure surfaces as a `TypeError` deep in export, with nothing naming the input that caused
  it — the preview simply never appears;
- **the malformed input is normalised and persisted**, so the round-trip destroys the file. A
  hand-edited or externally-generated project is silently damaged by being opened.

There is a schema validator in the tree (`packages/noodl-editor/src/editor/src/schemas/validator.ts`)
and `connections-v2.json` is a named schema, so the question is not "should this be checked" but
**why the check did not run on this path.**

**What to measure before fixing.**

- Does `validator.ts` run on project *load*, or only on authoring writes? (Start here — if it runs,
  this is a coverage hole in what it validates; if it does not, this is a missing call site.)
- Is the empty-object write a normalisation step or a save of the in-memory model? Those are
  different fixes.
- ⚠️ **Whether an unresolvable id — a real field name pointing at a node that is not in the
  component — takes the same crash.** That case *can* be produced by ordinary means (deleting a
  node, a bad merge), which would make this reachable without hand-editing anything.
  **Not measured. Measure this before ranking the row.**

Owner: **NONE**. Gets a `DEF-0xx` id when the bullet above is measured. ⚠️ Next free id is
`DEF-039`.

---

## 8. ✅ CLOSED — undoing a home-page deletion restored the node and NOT the home

## 🟢 OWNED, MEASURED, BUILT AND GATED 2026-09-03 (s43) — [DEF-040](DEF-040-UNDO-BRINGS-THE-NODE-BACK-BUT-NOT-THE-HOME.md)

All three bullets answered. **Bullet 1: yes** — `removeComponent` has the identical hole, and
`import-engine/apply.ts` reaches it unrefused. **Bullet 2: the listener is NOT reachable for a
nested node, and that is the defect** — `removeNode` drops every descendant from `nodeMap` and
notifies only for the top, so a home inside a deleted Group left a **dangling root rather than a
null one**, which the row guessed *"may be worse"* and is. **Bullet 3: neither** — a globally
undoable `setRootNode` would put a second writer on a pointer four other paths set deliberately;
each remover restores the home in the undo action it already pushes. ⚠️ Next free id is `DEF-041`.
🔴 `test:ci` OWED — the integration spec can only run inside Electron.

*The original row, kept:*

## 🔴 MEASURED WHILE BUILDING — 2026-08-31, DEF-007 s38

**Driven, not derived.** In a real editor on `def007-drive`: delete the home node, press *"Delete
it anyway"*, then `UndoQueue.undo()`. The `Group` came back into the graph and
`ProjectModel.getRootNode()` was **still `null`**.

**The mechanism is visible and small.** `NodeGraphModel.removeNode` pushes an undo action that
re-adds the node. The home pointer is cleared somewhere else entirely — a module-scope listener at
[`projectmodel.ts:1457`](../../../packages/noodl-editor/src/editor/src/models/projectmodel.ts#L1457):

```ts
EventDispatcher.instance.on('Model.nodeRemoved', function (e) {
  if (ProjectModel.instance && ProjectModel.instance.getRootNode() === e.args.model) {
    ProjectModel.instance.setRootNode(undefined);
  }
});
```

`setRootNode(undefined)` is run as a **side effect of an event**, not as part of the undoable act,
so nothing in the undo group knows to reverse it.

🔴 **Why it matters beyond tidiness.** DEF-007 §7.2 built a confirm rather than a refusal, on the
argument that a person may legitimately restructure their project and undo exists. **Undo does not
in fact repair this**, which makes the confirm the only protection there is, and makes Richard's
*"you might not remember what you deleted"* sharper here than in the lesson case FIX-025 addressed.

**What to measure before fixing.**

- Does the same hole exist for the **component** path (`removeComponent` → `setRootNode(null)` at
  `projectmodel.ts:414`)? That path is refused from the Components panel today, but the import
  engine (`utils/import-engine/apply.ts`) calls `removeComponent` directly and is not refused.
- ⚠️ **Is the listener reachable for a node that is NOT the top of the removal set?** It reads
  `e.args.model`, and `removeNode` notifies only for the node it was handed — children are dropped
  from `nodeMap` with **no notification each**. So a home node inside a deleted Group is removed
  from the graph while `rootNode` goes on pointing at it — **a dangling root rather than a null
  one, which is the opposite failure and may be worse.** DEF-007's guard walks the subtree and so
  asks first, but the underlying listener is still blind to this. **Not measured.**
- Whether the fix belongs in the undo group or in making the root-pointer change an undoable act
  in its own right. Those are different fixes with different blast radii.

Owner: **NONE**. Gets a `DEF-0xx` id when the bullets above are measured. ⚠️ Next free id is
`DEF-039`.

---

## 9. ✅ CLOSED — a curated template with NO home reached the shelf, and installed silently

## 🟢 OWNED, RE-MEASURED, BUILT AND GATED 2026-09-03 (s44) — [DEF-044](DEF-044-A-TEMPLATE-WITH-NO-HOME-REACHES-THE-SHELF.md)

⚠️ **`DEF-044`, not `DEF-043`** — phase 82 claimed 043 in this file's header while s44 was building in the
`nodegx-community` repo. The header's *"next free id"* line was right when it was written and stale by the
time it was read, which is the ordinary cost of two sessions and one register.

**Re-derived at HEAD before anything was built** (`nodegx-community` at `2bce720`): `rootNodeId` is **0 hits**
in the curator's `publish-project-template.ts`, **0** in the queue's promote path, and **0** in this repo's
`createFromTemplate.ts`. The row held whole.

🔴 **This row's own open question is ANSWERED, and the answer is the unsafe one.** *"Does the submissions
path inherit the editor's gate?"* — **no.** `POST /api/v1/community/templates/submissions` is an ordinary
authenticated write route taking `files` as JSON; the editor is one client of three and was the only one
refusing.

🔴 **And the ruling to choose between the two fixes already existed.** This row recorded the choice as
🧭 *a decision*, noting *"only the person's door has been ruled on"* — but
[Richard's 2026-08-31 words](RICHARD-RULINGS-2026-08-31.md) are unqualified: *"A project with no home page
must not publish as a template."* **A ruling written while looking at one door was read as being about that
door only, and the row waited three days for a decision it already had.** ⚠️ Worth carrying: when a row says
*needs a ruling*, check whether the ruling exists and is broader than the row that prompted it.

**Fixed at `publishProjectTemplate`** — the one seam both curated doors pass through. Gates: 96/96 + 92/92,
tsc 0, and a **reverted arm that exits 1 with exactly the four refusal specs red**. ✅ **REL-001 is not
blocked**: `templates/members-area` carries `rootNodeId: app_root`, checked before the gate was written.
⚠️ The registry-only hole is left open **deliberately** and has a green spec asserting it is open.

*The original row, kept:*

## 9. (as recorded 2026-08-31) A curated template with NO home reaches the shelf, and installs silently

**Measured, not read — 2026-08-31, s41.** Found while building the control for DEF-007 AC2
(§8.1 of that row). A curated template whose manifest has no `rootNodeId` was **published,
listed, installed through the picker and opened**, with nothing anywhere saying so.

**The two doors are both called "publish" and only one is gated.**

| door | who uses it | home gate? |
| --- | --- | --- |
| `shareAsTemplate.ts` `:342-390` — a person sharing their project | a builder, from the editor | ✅ **refuses**, built s38 on Richard's ruling |
| `nodegx-community/scripts/publish-project-template.ts` — a curator with a DB credential | whoever publishes the curated shelf | 🔴 **no gate at all** |

**And there is no install-side rescue.** `createFromTemplate.ts` never mentions the field; the
install logged `Project created successfully` and drew no toast. The person lands on
`/#__page__/Acme Legal Client Portal` — a **page-scoped internal component**, not a page anybody
authored to be opened.

✅ **The rescue already exists one package away.** `noodl-preview/src/loader.ts:131-156`
`resolveRootNode` guesses a root using `allowAsExportRoot` **and tells the user it guessed**. Its
own docstring names the population: *"projects authored from outside … frequently do not"* carry a
home.

**What to measure before fixing.**

- ⚠️ **Does the submissions path inherit the editor's gate?** `promote-template-submission.ts`
  promotes rows filed by `shareAsTemplate`, which already refuses — so the queue may be safe while
  the direct-publish script is not. **Not measured**; check whether a submission can be filed by
  anything other than the editor's door.
- 🔴 **Which fix, and there are two with different blast radii**: the same predicate on the
  curator's script (refuses at publish, matches the ruled shape) *or* a warn-and-resolve at install
  (matches what `loadPreview` already does to the person). They are not alternatives to be guessed
  between — §2.1 recorded this as 🧭 *a decision*, and only the **person's** door has been ruled on.
- ⚠️ **A home check must not refuse a module.** §2.1's warning stands: 63 of 340 manifests carry no
  home and most are modules and prefabs, which have none *by design*. `shareAsTemplate` solved this
  for its own door; the curator's script would need the same care.

⚠️ **This does NOT block DEF-007 AC2**, which is about a template that has a home and which passes.

Owner: **NONE**. ⚠️ Next free id is `DEF-039`. 🔴 Part of the fix lives in the **`nodegx-community`
repo**, not this one — the first row here that does.

---

## 10. ✅ CLOSED — the OTHER template generator DID disagree: **57 stored parameters**

## 🟢 OWNED, BUILT AND GATED 2026-09-03 (s42) — [DEF-038](DEF-038-THE-OTHER-GENERATOR-DISAGREES.md)

**Re-measured at HEAD first: still 57 writes** (`familyNodes` had moved 105 → 107, the `writes` had
not), control still 0 on 97. Fixed in `prepareArtefact` via a new
`pinRunOnValueChangeDefaultsInDirectory`, artefact regenerated (**57 insertions, 0 deletions**), and
gated across **both** generators by a sweep that **derives** its population rather than listing it —
`def038SettledTemplates.test.ts`, 5/5, two mutants each killed by its own arm.

⚠️ **The known hole is stated in the row, not papered over**: a third template written as a `.ts`
module (like `hello-world.template.ts`) would escape the sweep. Read
[DEF-038](DEF-038-THE-OTHER-GENERATOR-DISAGREES.md) §*Bounds*, not this summary.

*The original row, kept:*

**Owner `NONE`. Source: DEF-007 §3.2's ⚠️, raised by a peer 2026-08-31 as an orphan of closing
DEF-007 — and MEASURED here rather than registered as a question.**

🔴 **§3.2 left this as *"nobody has measured whether TPL-001 has a disagreement at all"*, and the
peer who raised it thought it might be zero. It is not zero. It is 57.**

`templates/members-area`, the committed TPL-001 artefact, read through **the editor's own reader**
(`readAsLegacyProject` → `ProjectImporter`) and put through **the same function** that measures
site-builder:

| artefact | `writes` | `familyNodes` | reading |
| --- | --- | --- | --- |
| **`templates/members-area` (TPL-001)** | **57** | **105** | 🔴 **disagrees** |
| `site-builder.content.json` (control) | **0** | **82** | ✅ pinned by DEF-007 §3.2, s31 |

✅ **Both arms have a non-zero `familyNodes`, which is what makes the 0 an absence and the 57 a
presence** rather than two readings of a broken instrument. Same function, two inputs, one script.

The first three writes name themselves:

```
/#__cloud__/claimAssociation  DbCollection2        runOnChange-records
/#__cloud__/claimAssociation  DbCollection2        runOnChange-search
/#__cloud__/claimAssociation  JavaScriptFunction   runOnChange-in-moderatorName
```

**So the shipped members-area artefact means one thing on disk and another once the editor has
opened it — which is the whole of DEF-007's person-sentence, in the generator nobody fixed.**

### ⚠️ This does not make DEF-007 AC3's green wrong — it makes its SCOPE explicit

AC3 was asserted as a pair and is genuinely 0, but its gate (`DEF-007 AC3` in
`sb007Template.test.ts`) covers **site-builder only**. TPL-001 is a second artefact the gate never
looks at. 🔴 **That is the same decaying-hand-list shape the row's own AC4 exists to prevent** —
a fix applied to the generator somebody was looking at, and a gate scoped to it.

### What to do — the port, now that the measurement is in

- 🔴 **The measurement is done; what is left is the fix and its gate.** `prepareArtefact` should
  pin the same way `toTemplateContent` does.
- ⚠️ **Not a one-line port.** TPL-001 writes a **v2 directory** (`components/*/nodes.json` +
  `nodegx.project.json`); `pinRunOnValueChangeDefaults` takes the legacy
  `{components:[{graph:{roots,connections}}]}` shape. ✅ **`readAsLegacyProject`
  (`sb007Template.ts:361`) already does that conversion and is pure plain-node** — no
  `ProjectModel`, no `NodeLibrary`, no Electron. It is what this measurement used.
- 🔴 **Gate it across BOTH generators**, not beside the one being fixed, or this row recurs with a
  third template.

### Reproducing

```bash
npx esbuild <entry>.ts --bundle --platform=node --format=cjs --outfile=/tmp/m.cjs && node /tmp/m.cjs
# readAsLegacyProject('templates/members-area') -> planRunOnValueChangeMigration(...)
```
🔴 **Always print `familyNodes` beside `writes`.** A zero with no family nodes found is a broken
instrument, not an absence — and that is precisely how the site-builder figure would have been
misread.

⚠️ Next free id is `DEF-039`.

## §10 — an MCP-authored `Script` node has NO ports on disk until the editor opens the project (registered by P18 s80, 2026-09-03; owner `NONE`)

- **Claim.** `packages/noodl-mcp/src/scriptPorts.ts` derives script-declared ports for
  `SCRIPT_PORT_NODE_TYPE = 'JavaScriptFunction'` only. A `Javascript2` (`Script`) node the MCP writes
  carries neither `ports` nor `dynamicports`; the deployed runtime builds a node's ports from `ports`
  (`noodl-runtime/src/models/nodemodel.ts createFromExportData`) and the Script node registers
  its output accessors only from `model.outputPorts` (`noodl-viewer-react/src/nodes/std-library/javascript.ts
  _onCodeParsed`). So until the editor opens the project and persists `dynamicports`, the running
  app's Script node has no ports: every `Script.Outputs.X = …` lands nowhere, every wire from it is
  dead. `erg004-qa`'s own `Driver` script says as much in a comment ("on the FIRST open of a project
  whose Script node carries no `dynamicports` on disk … `flagOutputDirty('obj')` warns").
- **Instrument so far.** Source read only (the three files above); **not driven** — nobody has yet
  created a Script node through the MCP and rendered the project headlessly. The measurement owed:
  `create_component` with one `Javascript2` node whose code declares an output, `render_report` or a
  deploy, read whether the output port exists. Expected if the claim holds: 0 ports.
- **What the export does meanwhile** (EXP-011 §52): a Script node with no ports on disk whose code
  names `Inputs`/`Outputs`/`Signals`/`define(`/`script(` is refused by name — *"its ports have not been
  discovered yet — the editor writes them into the project when it opens it, and the running app
  registers only the ports on disk"* — rather than hosted portless; the badge, pre-flight and report
  carry that sentence.
- **Who.** The MCP door (`withAuthoredScriptPorts`) is the natural site — but `Javascript2`'s ports
  cannot be mined by regex alone (`Node.Signals.k = fn` and `define({inputs})` are only known by
  running the code, which `javascriptnodeparser.js` does with `new Function`). Owner `NONE`; the row
  bites anyone who builds with the MCP and deploys without opening the editor.
