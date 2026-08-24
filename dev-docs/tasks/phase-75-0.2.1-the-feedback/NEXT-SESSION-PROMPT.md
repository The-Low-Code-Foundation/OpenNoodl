# Phase 75 — next session

**State as of 2026-08-24 (session 22).** Session 22 **built, specced and drove the core of
FB-017** — the two-tier property panel, the collapse mechanism that was dead code with a live
reader, the badge that stops a folded group hiding, and a **pre-existing scroll defect that had
been reading the wrong element since the panel moved inside a `ScrollArea`**. `879f2f4c`.
FB-017 is **🟡 partly done**: AC1/2/3/5 and the scroll half of AC6. Read *"What session 22
found"*, then session 21's notes, which still stand.

⚠️ **This checkout is busy.** Three live sessions at teardown (`ls -l /tmp/cc-socks/`):
`3878`, `39469` (owns FB-021), and mine. Session 21 counted five and two of those are gone.
**`ListAgents` still shows only some of them** — it showed 2 of 3. FB-021's file carries another
session's uncommitted edits; leave them.

## What session 22 found

### 🔴 THE PANEL'S SCROLL RESTORE HAS BEEN READING AN ELEMENT THAT CANNOT SCROLL

`Ports.renderGroups` has always carried *"remember the scrolling so a re-render doesn't reset the
scroll position"*, via `this.el.parentElement.parentElement`. That lands on
`.sidebar-property-editor` — `overflow-y: auto`, but its content never overflows it, so
`scrollHeight === clientHeight` and `scrollTop` is permanently `0`. **The real scroller is
`ScrollArea`'s root, six levels up.** It has been reading 0, storing 0 and restoring nothing.

Jordan §4 filed this as a missing feature. It was a broken one. ⚠️ **A fixed hop count is what
made it silent** — two `parentElement`s cannot fail, they arrive somewhere else after someone
wraps the panel. It walks for the property now (`scrollContainer()`).

⚠️ **My first repair failed the same silent way and the drive caught it too.** The listener bound
only inside `if (scrollTop)`, never true on a first render — and `instance.render()` runs *before*
`setInstance` mounts the `ScrollArea`, so `this.el` has no parent at that moment. **A panel that
opens at the top looks identical whether the offset was restored as 0 or never stored.**
`settleScroll` retries for 5 frames.

### 🔴 TIER IS KEYED BY GROUP NAME, AND THE DEFAULT IS BASIC — BOTH AGAINST AC3 AS WRITTEN

Two deviations, both argued in the module and the task file, both reversible in one line:

1. **Group name, not a per-port `tier` field.** A per-port tier lets a group straddle both tiers,
   so `Margin and padding` would render as a heading twice. Also: a new port field crosses the
   **five hand-written lists** that dropped FB-015's `placeholder` four times in session 21.
   `group` already survives that pipeline — it is what the panel groups by today.
2. **Unknown group → BASIC, not advanced.** Of 58 groups on 29 visual nodes, 22 are shared CSS;
   the rest are the node's **subject** (`Image` holds Source, `Text` holds Text).
   Advanced-by-default buries a node's reason for existing, and does it to exactly the nodes the
   file has never seen — every kit and third-party node. AC3's real worry is silent rot, and that
   is answered by a **sweep** instead: the spec fails if a group carried by 3+ visual nodes is
   unclassified, **and** fails the other way if a rule matches nothing.

### ⚠️ THE CATALOG IS NOT THE PANEL'S POPULATION

`node-catalog.json` gives a `Group` node 18 groups; the live panel draws 15. `Focus`,
`Scroll To Element` and `Scroll To Index` are signal/action groups that never get property rows.
The AC3 sweep is a good proxy for *classification completeness*, not a census of what renders —
and dynamic ports are already a documented blind spot in `PORT-GROUP-VOCABULARY.md`.

⚠️ FB-017's own ground-truth note says a `Group` has **19** groups. Measured: **18**.

### ⚠️ TWO HARNESS CORRECTIONS TO SESSION 21'S NOTES

1. **`npm run dev:debug` must NOT be launched with `&` inside `run_in_background`.** Doing both
   makes the outer shell exit and orphan the stack — it reparents to PID 1, survives, and
   **cannot be attributed to any session**. A peer walked the chain and told me. Use the
   harness's backgrounding alone.
2. **`cdp click` takes a SELECTOR, not coordinates**, and it scrolls the target into view first
   (it reported `210,717` for an element whose rect said `y=1774`). Also: **a launcher showing
   `0` project cards is usually still loading** — it read 0 then 57 from the same selector.
   `recently_opened_project.json` rows need `id` and `latestAccessed`, not just a path.

## First moves, in order

1. **FB-017's remainder** — three separable pieces, in cost order:
   - **AC7, the property filter.** Untouched. The tier machinery is in place for it: a hit inside
     a collapsed group needs `propertyPanelViewState.setExpanded(name, true)` and nothing else.
   - 🔴 **AC6's other half, the panel width.** Now **measured, not reported**: Group `0030` →
     **312px**, Image `0032` → **346px**. Cause is `min-width: auto` on the flex chain above
     `.sidebar-panel`, so the panel is content-driven and overflows its own `ScrollArea`
     (Container 312, Root 324, panel 346). **Left deliberately** — it is shared sidebar layout
     behind *every* registered panel, and `min-width: 0` there needs every panel driven before it
     can be believed. That is a session, not a tail-end one-liner.
   - **AC4, the corner-radius-on-Image hint.** Untouched; still wants a measured list of
     offenders, not an open-ended system.
2. ⚠️ **Scope 2's "demote Source Set to the advanced tier"** (FB-015 deferred it here) is **not
   done and needs Richard.** `Source Set` sits in the `Image` group, which is a subject group and
   therefore basic. Demoting one port inside a basic group is exactly the per-port tiering
   Ruling 1 rejected — so it needs its own group, or a decision to accept a split heading.
3. **FB-016** (M/L) — box-model overlay, transform-origin crosshair, radius-following highlight.
   ⚠️ It now has a neighbour: `Placement` (transform origin, rotation, scale) is **inside
   `Advanced CSS`** as of `879f2f4c`, which is where FB-016's crosshair would be reached from.
4. **FB-022** (M/L) — drag-to-scrub numeric fields; wants FB-017's rows settled first.
5. ⚠️ **FB-021 is session 20's.** I messaged them about the overlap: their fix has to surface a
   gated port *in the rows I restructured*, and `countActivePorts`/`PortActivityProbe` in
   `propertyPanelTiers.ts` is the seam that stops a gated port hiding inside a collapsed group.
   No reply by teardown.
6. ⚠️ **Deliberate remainders, unchanged from s21**: FB-011's AC1 superseded; FB-007's composer
   still not driven in a browser; `apisurfaces.ts`' `personProfile` flat disc — **still nobody's
   decision**.
7. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — one week), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## Found while working, owned by nobody

- ⚠️ **The scroll defect above is pre-existing and was never anyone's task** — it is fixed now,
  but nothing else in the editor that counts `parentElement` hops has been audited. It is worth
  one grep: a fixed hop count through a shell someone else owns is the shape of the bug.
- ⚠️ **`getConnectionSourceLabel` returns nothing for the checkbox row** (s19, unchased).
- ⚠️ **`npm run check:css` in `nodegx-community` still has ONE violation and it is still not
  ours** — `--site-avatar-ink`'s literal from `d205b47` (UNI-013), re-pointed by NAT-003.
- ⚠️ **The editor mirror never renders port DIRECTION** (`attachmentPorts` returns it,
  `CommunityThreadView` uses it only as a React key). Pre-existing.
- ⚠️ **The orphaned `AskAboutNodeDialog.module.scss` fix is STILL uncommitted** — fourth session
  running, belongs to no session, **not touched**. Richard's call. Same for the phase-70/71/72
  working files.

## Gates, this tree (OpenNoodl, `cline-dev`) — 🔴 re-measure, never quote

Measured at `879f2f4c`, after the final `Ports.ts` edit:

- `npm run test:main`: **322 files / 5181 specs / 0 failures** (FB-017: 3 files, 44 specs).
  Exactly s21's 319/5137 plus this task — no drift, no flakes this run.
- `typecheck:editor` / `:editor-tests` / `:viewer` / `:runtime` / `:mcp`: **0 errors**.
- ✅ The typechecker was **proved to see the new files** by planting an error in each
  (3 → 0).
- ✅ The tier module was **proved to be live in the running editor** by counting its symbols in
  the served bundle (`curl http://localhost:8080/src/editor/index.bundle.js`) — worth repeating,
  because it is how I separated "the fix is wrong" from "the fix is not loaded".
- **Not run** — nothing touched them: `test:ci` (Electron suite), `noodl-runtime`,
  `noodl-viewer-react`, `noodl-core-ui`, the whole `nodegx-community` side. ⚠️ `typecheck:core-ui`
  not run either; s21 measured 44 pre-existing `TS2307`.

## Gates, `nodegx-community`

Unchanged since session 18 and **not re-run**: 58 files / 1398 specs / 0 failures, `tsc` clean,
`build` clean, `check:css` 1 pre-existing violation. nexus-1 serves `acd4a9a`. **FB-017 is
editor-side and does not deploy** — it ships with the app.

## Session notes

- ✅ **Drive harness**: `npm run dev:debug -- --quiet` (no `&`), wait for `9222` to LISTEN, then
  `npm run cdp -- health`. `__nodeGraphEditor` was the live graph again.
- ✅ **Selecting a node headlessly**: `ed.selectNode(view)` wants a **view**, not a model —
  passing `ed.model.roots[n]` throws in `getNodePanelName`. Get views from `ed.forEachNode`,
  ⚠️ **which stops on a truthy return**, so the callback must assign and return nothing.
- ✅ **`dev:stop` spared 8 MCP/peer helpers** — verified by `ps` after, not assumed. Announced
  launch and teardown to the one reachable peer.
- ✅ **Restored as found**: `recently_opened_project.json` back to **56 rows**; theme back to dark.
- Fixture kept: `NodeGX test projects/fb017-drive` (a copy of `fb018-drive`) — a Group with four
  visual children; `cssClassName` and `blockTouch` set on node `…0030` to make the badge draw.
