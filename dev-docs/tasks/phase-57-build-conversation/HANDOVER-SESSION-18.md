# Phase 57 — handover after session 18 (2026-08-10)

**What ran:** **BLD-009 (expanded mode) built and driven end to end, with no billed call.** D10 is
closed.

**Phase 57 is 15 of 17 fully built.** Counted off the tables in `TASKS.md`, not incremented:
**Track A 10 of 11** (only BLD-010, the acceptance sweep, is left), **Track B 5 of 6** (BLD-015,
deferred). **Every *feature* in this phase is now built.**

## 🔴 The decision that was the whole task

> **The obvious build satisfies "one component, two hosts" and makes the acceptance criterion
> impossible.**

Mount `AiAuthoringPanel` a second time inside the document and you have one *component* and two
*instances* — two `AuthoringSession` refs, two subscriptions, two composers. That is exactly the
doubled activity feed the task file's trap names, and it makes *"expand mid-run: the run continues,
nothing restarts"* **unsatisfiable rather than merely unbuilt**: a run started in the rail would
carry on invisibly behind an empty document.

✅ **So the panel is mounted once, ever.** `SidePanel` already keeps every visited panel alive behind
`display: none` (its `PanelItems` map), so the Build panel's instance — session, run, composer text —
is alive whichever document is showing. `ExpandedBuildDocument` is a **shell**: a top bar and an
empty box, published through `expandedBuildHost`, into which the panel paints itself with
`createPortal`. **Expanding changes where the component renders, not whether it exists**, and the
criterion becomes true by construction rather than by care.

⚠️ **Expanded-ness is never stored.** It is `CurrentDocumentId === ExpandedBuildDocumentProvider.ID`,
derived on both sides through `threadHost()`, riding the `documentChanged` subscription
`decisionOwner` already had. A stored boolean would be silently falsified by every other route out of
the document — and there are several.

> **The only thing "nothing restarts" does not get for free is scroll position.** A portal whose
> container changes is a delete and a recreate: the component survives, every DOM node under it does
> not. `BuildThread` therefore takes a `scrollMemory` ref **owned by the caller**, because a ref
> declared inside the thing that remounts remounts with it.

## 🔴 Two defects a spec could not have reached

- 🔴 **The wide workspace was measurably narrower than the panel it replaced.** A document sits
  *beside* the sidebar — BLD-003 states this, and it is why `decisionOwner` exists — so expanding
  left the rail holding 452px and gave the candidate pane **396px** on a 1368px window. That is less
  than the 400px panel the entire task exists to escape. **A feature can be built exactly as
  specified and not deliver its own premise.** Fixed with a new `layout.hideIfShown()` — the
  caller's verb, mirroring the `openFull`/`toggleFull` distinction F41 already drew, and wired to
  the `hide` callback the divider's own collapse floor has always used, so there is one
  implementation.
- 🔴 **The reveal was hung off the Collapse button, and most exits never touch it.** Accept switches
  the canvas to the component it just wrote; Review changes opens the diff. Either would have left
  the sidebar hidden **and** the expanded document gone — the Build thread mounted, alive, holding
  the run, and on screen **nowhere at all**. The reveal is now keyed on the *derived host* leaving
  `document`, so every exit is one exit. Driven: expanded, clicked another rail icon, rail restored
  to 332px with the thread mounted behind it.

## 🔴 And one that is not this task's — AIB-003's saved plan never comes back

Found while trying to render a plan for the expand offer, and **confirmed three ways**:

1. **Statically** — `ProjectAuthoringView` has exactly one mount site, gated on
   `turn.id.startsWith('plan-')`. A plan turn exists only when `planSession.plan` is non-null. The
   effect that reads `.nodegx/plan/session.json` is **inside that view**. *The only thing that can
   restore a plan is a component that mounts only once a plan has been restored.*
2. **Empirically** — a valid six-operation snapshot on disk, full stack restart: no plan, no plan
   turn, the word "checkout" nowhere in the document.
3. **Not a bad fixture** — run through the shipped `parsePlanSessionSnapshot` in a plain-Node
   harness, it parses and reports its 6 operations.

This is **BLD-001's B6 one instance later** — *"moving WHEN a component mounts changes the meaning of
code that was correct about WHAT it renders."* B6 hoisted the AIX-012 *launcher* handover into
`adoptScopePlan`; the **sidecar restore and the `docs/decisions/000-initial-scope.md` recovery offer
were left behind in the same effect.**

⚠️ **Deliberately not fixed.** Hoisting the restore is mechanical, but the other half of that effect
renders an *offer*, and deciding where a second offer lives — beside BLD-009's own, in the one
`notice` slot — belongs to AIB-003. **Fixing half would make the other half permanently dead rather
than conditionally dead**, because the panel's `consultSavedBuild` would answer first every time.
Filed to BLD-010 and to BLD-009's R6.

## What was measured (driven against `ai-test`, no billed call)

| | result |
|---|---|
| `<BuildThread` call sites in the repo | **1** |
| `.Thread` instances in the DOM, each host | **1 and 1** |
| scroll round trip, panel → expanded → panel | **`scrollTop` 640 → 640 → 640**, 14 turns throughout |
| the turn at the top of the viewport, each host | **the same turn (index 2)**, despite `scrollHeight` 4380 vs 3313 |
| composer text across the move | a half-typed string survived intact |
| the split, expanded | thread **520px**, candidate pane 396px → **916px** once the rail stands down |
| rail width, expanded / collapsed | **0px / 452px** |
| horizontal overflow, 248 → 800px, offer present | **0** for thread, body, header, control row and `document.body` at every width |
| offer height at the shipped 400px | **113px → 91px** after grouping the icon with the sentence |
| offer, dark / light | **7.70** (`#a6b0bb`/`#181d24`) / **7.10** (`#4a5663`/`#f7f9fb`) |
| offer "Not now", dark / light | **7.70** (`#a6b0bb`/`#222933`) / **6.54** (`#4a5663`/`#ecf0f4`) |
| rail notice sentence, dark / light | **7.70 / 7.10** |
| expanded topbar + empty pane (`Shy`), dark / light | **5.57** (`#8b95a1`/`#181d24`) / **5.06** (`#616c79`/`#f7f9fb`) |
| header expand glyph, dark / light | **7.70 / 7.10** |
| the one-time flag | set by Open it *and* by Not now; **survived a full stack restart** |

## Driving this — what session 18 adds

- 🔴 **A width sweep that does not move the element is a green result about nothing.** The first
  sweep reported 0 overflow at every width — and `actualThread` was **364px at all seven of them**,
  because `style.width` went on an element that does not size the panel. The panel is sized by a
  **CSS custom property on the `FrameDivider` root** (`--frame-divider-<id>-container-1-width`);
  drive that, and it genuinely goes 212 → 764px. ⚠️ **Print the achieved size beside every swept
  value** — this is session 15's "confirm the element actually resized" with a second mechanism.
- ⚠️ **And `removeProperty` on that variable does not restore it** — the FrameDivider *is* its only
  writer, so removing the override leaves `width: var(…)` undefined and the panel collapses to
  24px. Set it back to a number instead. The next measurement after that cleanup read the offer as
  24×389px and looked exactly like a catastrophic layout defect.
- ⚠️ **A contrast probe must start at the element itself, not its parent.** A control paints its own
  ground; starting the background walk one level up reads the box *behind* the button. Cost: the
  dismiss control read 7.10 light when it is **6.54**. This is the fifth of this family in four
  sessions.
- ⚠️ **`flex-wrap` wraps a line before it shrinks the items on it.** A `flex: 1 1 auto` paragraph
  with long content claims the whole line and pushes a 14px sibling icon onto one of its own —
  `min-width: 0` does not help, because shrinking only happens *within* a line that has already been
  formed. Group the icon and the text into one flex item.
- **A plan fixture works the same way a thread fixture does** — `<project>/.nodegx/plan/session.json`
  matching `snapshotSession`'s output, validated against the shipped `parsePlanSessionSnapshot` in a
  plain-Node harness before trusting it. ⚠️ **It does not currently load** — that is R6 above, and
  proving the fixture good is what turned "my fixture is wrong" into "the restore is unreachable".
- ⚠️ **The offer's trigger and the offer's rendering were driven separately, and here is which.**
  The trigger is the pure specced rule (inverted, 4 of 10 red). The *rendering* was reached by
  temporarily forcing the operation count in the source, because R6 means no plan can be put on the
  thread without a billed call. The dismiss path and its persistence were driven **for real**.
- ⚠️ **`EditorSettings`' file is `{"settings": {…}}` on disk** — reading the top level for a key
  `set()` wrote finds nothing, and I briefly recorded a wrong conclusion from it. The file is
  `~/Library/Application Support/NodeGX/editorSettings.json`.
- **`data-panel-id=<id>` is width 0 whenever another panel is active**, because `SidePanel` hides
  inactive panels rather than unmounting them. Measure `SideNavigation-module__Root` for "is the
  sidebar showing", never the panel item.

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **111 suites, 1542 tests**, zero failures |
| `test:ci` | see below |

⚠️ **Baseline measured, not inherited** (one command, per the standing rule): everything except the
new directory returns **109 suites / 1527 tests** — exactly what session 17 recorded, so no drift
this time. This session added **+2 suites / +15 tests**.

**`test:ci` at seed 82776 returned `2632 specs, 9 failures`** — matched **by name** to the documented
six (AI model registry ×2, AIX-006 style vocabulary ×4) **plus the order-dependent BEN-001 cluster
×3** (the *"harness export"* describe). ✅ **Re-run on the same commit at seed 77146: `2632 specs, 6
failures`, exactly the documented six by name.** The rule did its job — **6 is the floor, and a run
showing 9 is a seed effect rather than a regression.** Two seeds, one commit, no investigation
needed.

⚠️ The dev stack was down for every `test:ci` run and stopped at the end. Nothing is running.

## Concurrency

**No sibling was live at any point this session** — `ps aux | grep "[e]lectron/dist"` returned 0 at
start, before each `test:ci`, and at the end. The inherited uncommitted set (the two `code-editor/`
files, the four `Launcher/` files, `hello-world.template.ts`, `ProjectsPage.tsx`,
`ExtractToComponent.ts`, `EditorClipboard.ts`, `useComponentActions.ts`, three `tests/` files, four
untracked `ExtractToComponentPopup`/spec files) is **untouched and still theirs**. The pre-existing
`stash@{0}` was not touched and still wants identifying.

Every commit was pathspec-scoped and verified with `git diff --cached --stat` before committing. No
`git add -A`, no `git stash`.

⚠️ **`ai-test` was not modified.** Two fixtures were written under `.nodegx/` and **both were
deleted**; `.nodegx/plan` is empty again, as found. `project.json` (mtime 19:51) and `.gitignore`
(11:49) both predate this session's first stack launch, so neither is mine — they are the sibling's
Slider/Expression graph the handover chain has carried since session 15.

⚠️ The `aiAuthoring.expandOffered` setting was set during driving and **cleared again**, so the
one-time offer is live for the user.

## What to do next

1. **BLD-010 is the only Track A item left, and it is the phase's exit test.** Its debt list is now
   **fourteen**: the eleven from session 16, plus session 17's *"the agent names a responsive
   defect"*, plus new here — **BLD-009's live-candidate Accept check** (the mechanism is verified;
   the *state* needs a billed run) and 🔴 **R6, AIB-003's unreachable saved-plan restore**, which is
   the only one of the fourteen that is a **defect in shipped behaviour** rather than an unverified
   criterion. Do R6 first, and read BLD-009's R6 section before touching it — half a fix is worse
   than none.
2. **BLD-015 is deferred, not open.** ⚠️ Richard was asked to choose Tavily or Brave in session 17
   and chose neither; it needs him to sign up and pay. **Do not re-ask it every session** — the
   design is settled.
3. **The design-system row is unchanged at four.** This session added no call-site override; the new
   control uses `IconButtonVariant.Transparent` in `BasePanel.headerSlot`, which is the slot's own
   idiom.
