# Phase 60 — next session

**Written 2026-08-11**, at the end of the session that closed **SIG-001, SIG-002 and SIG-004**.
**The next session's job is SIG-003**, the phase's second flagship, and it is the one task here that
is real work rather than unhiding.

Commits: `9ff122bb` (code) and `8d8e371f` (docs). Remaining: **003, 005, 006, 007**.

## What this session did, so you do not redo it

The connection popup computed a full refusal sentence for every refused port, wrote it to
`p.message`, and deleted the row that would show it seven lines later. Three halves of one feature —
the message, `PortItem`'s `'disabled'` state, the stylesheet — had never met. They do now.

| Task | Outcome |
|---|---|
| **SIG-001** ⭐ | **CLOSED.** Refused ports render behind one summary line per group; the offer names the wire the builder meant and connects it |
| **SIG-002** | **CLOSED.** Type sentence on every value input (the `if (d)` guard is inverted); the timing-intent answer at the search |
| **SIG-004** | **CLOSED.** One sentence per port *type* at the render seam. **No node definition touched; `node-catalog-enriched.json` byte-identical** |

**Four new modules, all import-free, all in `tsconfig.tests-main.json`'s allowlist**, graded by 58
specs in `packages/noodl-editor/tests-unit/connection-popup/`:

- **`portCopy.ts` — every sentence the popup says. All new copy goes here, including yours.**
- `refusalPlan.ts` — `rankAlternatives`, `isConfidentRedirect`, `asRefusalReason`, `dominantReason`
- `searchIntent.ts` — `answersTimingIntent`
- `components/RefusedPorts.tsx` — the folded refused block

Plus a `reason` code on `NodeGraphModel.getConnectionStatus` and a widened
`NodeLibrary.nameForPortType` signature.

### The six things worth carrying

1. 🔴 **Two of the six defects were in the specs, not in the build.** SIG-001 §2's worked copy —
   *"4 signal inputs · signals carry no value"* — is the exact sentence the same file forbids four
   sections earlier. And SIG-002 §2's trigger cannot fire on the node its own acceptance names,
   because **`set` is a substring of `offset`**: searching `set` on a Button returns three
   shadow-offset ports, so "answer the empty search" never runs. **Grep a spec's own examples against
   its own constraints before building them.**
2. 🔴 **`connectionPanel.groupPriority` is a display order, not a ranking.** Ranking by "exact type,
   then group priority" answered **Variant** for a String dragged at a Button — `string` in `General`
   (priority 0) beating `Label`, `string` in `Label` (priority 6). Correct by the rule and wrong to
   every human. **`usePortAsLabel` is what says which port a node is about** (~41 declarations:
   `label`, `text`, `collectionName`, `url`, `expression`, `functionName`…). **SIG-003 should treat
   it as a declaration to preserve, not incidental metadata.**
3. 🔴 **The offer promised a wire it did not draw.** Built as specced — connect on one candidate,
   scroll otherwise — with the copy of the first branch on both. Clicking "connect it to **Label**
   instead" drew nothing. Fixed by making one predicate decide the verb *and* the action. **Verify
   the consequence (was a connection created?), never the mechanism (did the handler run?).**
4. 🔴 **The grey wall came back as summary rows.** One refused line per group is right for a mixed
   group and catastrophic when every group is refused: a signal source at a Text Input produced
   **19 identical** lines above the 4 ports that work. Whenever you collapse-per-container, ask what
   it looks like when *every* container collapses, and **count it on a real node**.
5. ⚠️ **Button cannot host this phase's canonical scenario.** "Drop a String on a Button" appears in
   the README, in TASKS and in SIG-001 — and a Button has **no signal inputs at all**. Use a **Text
   Input** (`Set`, `Clear`, `Focus`, `Blur`; 103 ports). A session that drives the documented example
   will measure a working feature and conclude it is broken.
6. ⚠️ **The first contrast pass measured the editor's title bar.** The harness had scrolled the offer
   out of the popup's viewport, and a rect at `y ≈ 2` is whatever the window is showing there — it
   returned the amber ⚠2 badge. Every rect is now clipped to the popup's scroll box and **dropped**
   if it does not survive. Corrected table is in SIG-001's Register.

### Driving the connection popup (it is fiddly, and this cost a session)

`window.__nodeGraphEditor` → `ed.switchToComponent(c)` → set
`ed.interaction.draggingConnection = { fromNode, toNode }` (**view** nodes, from `findNodeWithId`) →
`ed.connectionPopups.open()`. Then click a row in the *from* bar.

- ⚠️ **`connectionPopups.close()` removes nothing** — it only sends `viewer-show`. Popouts are
  dismissed by a pointer press **outside** them; the window is **1368×781 CSS**, and the components
  panel (≈250,700) is outside. A click on the canvas at 850,604 is *inside* the target popout.
- 🔴 **Never `replaceChildren()` the `.popup-layer`** to clean up — it orphans PopupLayer's state and
  no popup opens again until the editor is restarted.
- ⚠️ **Two bars in the DOM does not mean their rows exist.** Poll for the row, then assert the
  selection took.
- ⚠️ **`scrollIntoView` then `getBoundingClientRect()` in the same tick gives stale coordinates** —
  the click lands on a neighbour, nothing is selected, and every downstream number reads as "nothing
  was refused", which looks exactly like a broken feature.
- ⚠️ **HMR does not reach `ed.connectionPopups`** — the live editor holds the old instance. Restart
  the stack after editing the popup.

### Gates, measured on the settled tree

`typecheck:editor` and `typecheck:editor-tests` **clean** · `test:main` **114 suites / 1600 tests
green** (58 new) · `test:ci` **`Jasmine: 2632 specs, 6 failures` at seed 37092** — the recorded
baseline, matched **by name**, no regression.

⚠️ `dev:stop` **before** `test:ci`, and **measure `test:main`, never inherit its number.**

---

Paste the block below into a fresh session.

---

Work on **phase 60, task SIG-003** for OpenNoodl/NodeGX. Work on `cline-dev`, commit straight to it,
no branches and no PRs. **Check for a second live session first** (`git log --since="3 hours ago"`,
and read untracked files rather than assuming they are yours) — there was one throughout the previous
session, on phases 50/54/55/57/58. If there is, pathspec-scope every `git add` **and** every
`git commit`, and never stash.

Read these first, in this order:

1. `dev-docs/tasks/phase-60-values-and-signals/README.md` — the phase, and its **four premise
   corrections**, every one of which was read in source. Do not re-derive them.
2. `dev-docs/tasks/phase-60-values-and-signals/TASKS.md` — the ordering, and the section
   **"What 001/002/004 left for the rest of the phase"**.
3. `dev-docs/tasks/phase-60-values-and-signals/SIG-003-GROUPS-THAT-MEAN-SOMETHING.md` — the task.
4. `dev-docs/tasks/phase-60-values-and-signals/SIG-001-THE-REFUSED-PORT-SAYS-WHY.md` — **its Register
   only** (nine rows). It is where the previous session's defects live, and two of them are about
   this phase's specs rather than its code.
5. `dev-docs/reference/PORT-DESCRIPTION-STYLE.md` — normative. `description` is the catalog's channel,
   read by the semantic validator and the AI authoring loop; `tooltip` is the property panel's. SIG-003
   edits node definitions, so this is the file that says which field.

**SIG-003 is an audit of every port heading in the library**, plus a decision. Three things about it
that the previous session established and you should not spend time rediscovering:

- ⚠️ **Its §2 rename half is a decision for Richard, not for you.** Surface it early with the census
  in hand — `Value` (30) beside `Values` (6), `Change` (6) beside `Changed Events` (5), `Signals`
  used 16× — and **get on with the ungrouped-port audit while you wait.** Do not block.
- ⚠️ **`usePortAsLabel` is now load-bearing.** It is what makes the connection popup offer "connect it
  to **Label**" instead of "connect it to **Variant**". If the audit touches a node that declares it,
  preserve it, and prefer adding a `group:` over moving a port.
- ⚠️ **SIG-003 changes strings SIG-002 shipped.** The timing-intent answer names **Variable**'s `Set`
  and the **Run On Value Change** group by heading. Both are in
  `packages/noodl-editor/src/editor/src/views/ConnectionPopup/portCopy.ts` — one edit, and
  `tests-unit/connection-popup/portCopy.test.ts` asserts them, so a rename that forgets the copy goes
  red rather than silently lying. **All new copy goes in that file too.**

The single fact the task turns on, already read in source: **an ungrouped port silently becomes
`Other`** (`ConnectionBar.tsx`), so `Other` is not a category anyone chose — it is the absence of a
`group:` line rendered as if it were a decision. On **every Variable node** the four ports that are
the whole point of the node (`Value` in, `Set`, `Value` out, `Changed`) declare no group, while the
only port that *has* one is `treatEmptyAs` → `'Advanced'`. A beginner opening a String variable sees
a heading called *Advanced* and a bucket called *Other* containing everything they came for.

**Standing constraints for this phase** (from the README, repeated because they are the ones that get
forgotten): `opacity` cannot dim and stay legible — light mode is binding; **red is danger only**, and
a refused connection is not the builder's error; wire colour already carries four meanings, so new
information goes in shape, weight or motion; and **`portIcons.ts` is a complete glyph table imported
by nothing** — use it or delete it, but do not start a third vocabulary beside it.

**Verify in the running editor, not only in tests.** Use the `run-editor` skill. `dev:stop` before
`test:ci`; measure `test:main` rather than inheriting it; and only the `Jasmine:` line counts —
`test:ci`'s floor is **6 failures** (it reaches 12 when the order-dependent BEN-001 cluster fails, so
re-run at another seed before investigating). Record the seed.

**If SIG-003's audit turns out to be larger than one session, close the ungrouped-port half and stop
there** — it is the half that fixes the reported complaint, and the rename half cannot ship without
Richard's answer anyway. Then update `TASKS.md` and the task's Register with what was measured, and
say plainly what you left.
