# FB-006 — one list is not a place

**Filed:** 2026-08-22, from Richard's items 5 and 7 — which together are **ruling D6's input**.
**Status: 🔒 blocked on D6, and this file is the ruling request.** Size: L (launcher restructure)
once ruled. Owns the structural half; **NAT-012 stays the navigation-model task** and should be
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
- AC4: driven in the running launcher, both themes; the pure view-model half specced separately
  (this-jest-can-grade-a-react-component — a spec that builds a view model can't grade its
  builder).

## Traps

- NAT-005 AC4 (Storybook) is still open — don't inherit it as a blocker; jest + the drive grade
  this.
- The rail panel registration lives in shared editor bootstrap (`router.setup.ts:262–275`);
  NAT-012 AC7's warning applies — every panel registers there, tread carefully.
