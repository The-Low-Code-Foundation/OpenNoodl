# FB-006 — one list is not a place

**Filed:** 2026-08-22, from Richard's items 5 and 7 — which together are **ruling D6's input**.
**Status: ✅ DONE 2026-08-22 (launcher half) — built, specced and driven.** Size: L
(launcher restructure). ⚠️ **NAT-012 still owns the editor half** of the same tranche: the
navigation model, the `openExternal` audit and the rail narrowing.

## What landed

The launcher's community page is now the web's tabs — **Bench · Tutorials · Replays · People** —
one section on screen at a time, with the chrome (who you are, refresh, the health readout, the
browser door) framing all of them and a lead sentence inside each one saying what *that* tab is
for. `views/communityTabs.ts` holds the catalogue and the plan; `views/Community.tsx` draws it.

- ✅ **The first tab is "Bench", not "Discussions" — RULED 2026-08-22**, after Richard read the
  departure and asked whether the two were being confused: he had commissioned **chat** (FB-013)
  *as well as* the bench, so a rename looked like it might be merging two surfaces. It is not, and
  the check is on disk: the old `title="Discussions"` sat over `view.threads` (`Community.tsx:312`
  at `5d31a567^`, and the rail panel's still does at `CommunityPanel.tsx:222`); those threads are
  `bench_threads` from `/api/v1/bench/threads`, opened at `community.nodegx.io/bench/<id>`
  (`communityapi.ts:1112`, `useCommunityThread.ts:315`); UNI-011 coined the word for exactly that
  list (*"thread list, filters, search, the unanswered queue"*); and the web has **no
  `/discussions` route**. One data source, one place, two names.
  🔴 **Chat is the argument for "Bench", not against it.** FB-013 arrives as its own tab in the
  same table, and a chat feed is more literally a *discussion* than an answered-state Q&A bench —
  so "Discussions" is the name that goes ambiguous the moment chat ships. The full reasoning is in
  `communityTabs.ts`'s module note; the label is still one table row.
- 🔴 **`Tabs` grew a `TabStrip`** — the button row, controlled and hook-free — because `Tabs`
  holds the active tab in `useState` and `tests-unit`'s element walker throws on any hook in the
  tree it evaluates. A community tab rendering `Tabs` would have taken NAT-005's whole render
  spec down with it. `Tabs` renders `TabStrip` in place of the markup it used to hold inline, so
  **the DOM seven editor panels draw is unchanged**; `Tabs.module.scss`'s variant rules now hang
  off the variant class alone (`.is-variant-segmented .Button`) so a strip can be styled without
  inheriting `.Root`'s `height: 100%; overflow: hidden`.
- **`CommunitySection` gained `showTitle`** — the tab label already names the section, and the
  item count survives a hidden heading because that is the half the label does not repeat.
- 🔴 **This revises NAT-005's page (not its vocabulary) and NAT-008's D15 pairing.** Both specs
  now name the tab they stand in; NAT-008's refused arm got *stronger* (a refused viewer loses
  the tab **button** as well as the rows). Named in the diff so a later session does not read a
  one-section page as a regression.
- ⚠️ **D21 is narrowed by D6, not by this task** — the rail panel is untouched here. NAT-012
  carries the narrowing, and the diff naming D21 belongs with it.

**Measured.** `tests-unit`: **286 suites / 4679 specs, 0 failures** — and the restructure was
*caught* by the suite twice on the way: 7 reds in `nat-005` and 1 in `nat-008`, each of them an
assertion about three sections on one page. core-ui package suite **521 / 0**. `typecheck:core-ui` and
`typecheck:editor-tests`: no new errors (44 pre-existing `TS2307` module-resolution errors,
unchanged). 🔴 **Revert-and-count:** rendering every section regardless of the active tab turns
**5 specs red** across `fb-006` and `nat-005` — the exclusions are not passing on an empty read.

**Driven** 2026-08-22 in the running launcher, both themes: four tabs, one selected, content and
`aria-selected` moving together, the chrome on all four, real data on the Bench. ⚠️ The shared
`TabStrip` was checked live in **three** other consumers (Learning's segmented strip, the node
picker, the settings panel). The `sidebar`, `text` and `default` variants were **not** looked at
— same mechanism, unchanged DOM, and the CSS change is a pure specificity loosening inside one
module, but nobody has watched them.

Screens: `fb006-dark.png`, `fb006-light.png` in the session scratchpad.

## Still open here

- AC2's future tabs — University, Work, Coaching and Orgs are catalogued and unwired; each is one
  `wired` flag away once its surface exists in the launcher.
- ⚠️ The segmented strip's inactive labels are `fg-muted` on `bg-2` in light — inherited from
  UIX-013's control, shared with the Learning tab, and **not measured against NAT-001's PAIRS
  table by this task**.

✅ **D6, as ruled:** all three points of "The D6 proposal" below, unchanged — launcher home in the
web's tabs, editor reduced to the ask-about-this-node door, deep links from editor to launcher.
🔴 It **narrows D21** and Richard ranked them knowingly; **name D21 in the diff** or a later session
reads the shrinking rail panel as a regression. Recorded in `phase-72-nobody-has-to-leave/README.md`
§4. Owns the structural half; **NAT-012 stays the navigation-model task** and should be
built in the same tranche.

> *Item 5: "The community tab in the launcher is awful looking compared to the NodeGX web page,
> surely we can reconcile the UI UX there?? Like at least put the different content into tabs
> like the web page has, not everything on one page in a big list that will one day be
> unmanageable."*

> *Item 7: "I'm actually not sure there's a point to having the community tab in the editor.
> Most of the content will have no relevance to the project you're editing. It should maybe only
> be in the launcher, apart from the modal where you create a question based on a node to go in
> the bench."*

---

## What exists (swept 2026-08-22)

- **NAT-005 (6/7 ✅)** did the hierarchy pass — cards, real type ramp, shared
  `@noodl-core-ui/components/community` vocabulary both surfaces import. It deliberately did not
  ask the structure question.
- The launcher view is still three stacked sections in one scroll:
  `Launcher/views/Community.tsx` — Discussions (~313), Guides and tutorials (~365), Call
  replays (~384). People/University/Work (NAT-008/-011/-009 surfaces) will pile into the same
  column as they land — Richard's "one day unmanageable" is already scheduled.
- **NAT-012 "the door, not the exit"** (open, blocked on D6) owns the model: *"the launcher tab
  is the community's home… the rail panel is the door from inside a project"*, AC1 = one
  navigation model across both surfaces. Its AC7 (rail icon for a D15-refused viewer) came from
  67b.
- The editor rail panel is live and unconditional (D21, Richard's own 08-19 instruction:
  *"show the community tab immediately with no data, I'll start filling it"*).

## The D6 proposal (Richard's items 5+7 restated as the ruling)

1. **The launcher is the community's home**, structured in tabs mirroring the web's nav:
   Discussions · Tutorials · Replays · People · University · Work (RFPs/Coaching as they land).
   Same names, same order as the web, so the two surfaces read as one product.
2. **The editor keeps only the door**: the ask-about-this-node modal (the one project-relevant
   verb) and thread-follow for questions you asked/answered. The rail panel shrinks to that, or
   goes entirely — ⚠️ this *narrows* D21's "show it immediately" instruction; both instructions
   are Richard's and only he can rank them.
3. Deep links: anything the editor shows that isn't project-relevant opens the launcher tab at
   the right place (NAT-012 AC1's back/forward relationship).

**If Richard confirms:** D6 gets recorded in P72's README rulings, NAT-012 unblocks, and this
task does the launcher tab restructure while NAT-012 does the navigation model + the editor
narrowing.

## Acceptance criteria (launcher half, this task)

- AC1: the launcher community view has the web's tabs; no tab renders another tab's content;
  the first screen of each tab says what it is for (NAT-005's bar carries forward).
- AC2: adding a future content kind means adding a tab, not lengthening a list — asserted by
  the view's structure, not a comment.
- AC3: the shared community vocabulary components are reused; no second copy of row/section
  primitives (a-second-copy-of-a-palette-drifts is the shape to avoid).
(✅ AC1 — `fb-006/launcher-community-tabs-render`; ✅ AC2 — `fb-006/community-tabs`; ✅ AC3 — the
strip is the shared one and there is exactly one `role="tablist"` in core-ui; ✅ AC4 — driven,
both themes, with the plan specced apart from the page that draws it.)

- AC4: driven in the running launcher, both themes; the pure view-model half specced separately
  (this-jest-can-grade-a-react-component — a spec that builds a view model can't grade its
  builder).

## Traps

- NAT-005 AC4 (Storybook) is still open — don't inherit it as a blocker; jest + the drive grade
  this.
- The rail panel registration lives in shared editor bootstrap (`router.setup.ts:262–275`);
  NAT-012 AC7's warning applies — every panel registers there, tread carefully.
