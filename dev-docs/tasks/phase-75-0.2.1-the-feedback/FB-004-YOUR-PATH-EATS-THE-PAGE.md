# FB-004 — "Your path" eats the page

**Filed:** 2026-08-22, from Richard's item 3. **Status: ✅ done 2026-08-22** (AC1–AC3; AC4 filed
on NAT-011). Size: S. Revises **UNI-007 AC1's placement** — named in the commit, a deliberate AC
change, not a regression.

> *"The 'Your path' thing dominates the learning page in the launcher, it should be two tabs no?
> Otherwise you have to scroll down a page every time you want to see your actual installed
> lessons."*

**This is the third report of this exact class.** 2026-08-17: *"you should see your projects
first… not the learning bit which takes up the whole top of the launcher"* → FIX-024, then
FIX-025 §2/§3. The pattern: a learning surface lands above the thing the user came for.

---

## What exists (swept 2026-08-22)

- `packages/noodl-core-ui/src/preview/launcher/Launcher/views/Learning.tsx` renders
  `LearnerPathSection` then `LearningSection` — built as **UNI-007 AC1** (s48, 49 specs,
  *"above the installed-lessons grid"* is the AC's own words).
- UNI-007's suite **asserts the `truth` sentence renders above the steps** — that assertion is
  about the path section's internal order and survives this change; the assertion about
  page-level placement is the one to update.

## Scope

Two tabs inside the Learning view: **Installed lessons** (default) and **Your path**. Or, if
tabs fight the launcher's nav idiom, a collapsed path summary card (one line: the `truth`
sentence + resume button) above the grid, expanding on click. Default must put installed
lessons on the first screen with no scrolling.

## The second half: Your path vs University (Richard's confusion is correct)

> *"I'm also confused about the difference between 'your path' which only exists in the launcher,
> and 'university' which only exists in the community web page. I feel like they're gunning for
> the same thing, can they be reconciled and made universally accessible?"*

They are two views of one curriculum: **Your path** = the personalised projection (intake →
`pathFor`), **University** = the full syllabus (D17: a view, never the install route). The
reconciliation belongs to **NAT-011** (open, unstarted — it brings `/university` into the
editor). **This task adds one AC to NAT-011 before it starts:** the University view and the
learner path must present as one surface (the syllabus with *your* path marked on it), not two
sibling lists — and the path must be visible on the web too, not only in the launcher (the
platform already serves it: `GET /v1/me/path`).

## Acceptance criteria

- AC1: opening the Learning tab shows installed lessons without scrolling, at default window
  size.
- AC2: the path is one click away and its `truth` sentence is the first thing it says
  (existing render assertion updated, not deleted).
- AC3: UNI-007's 49 specs still pass with only the placement assertions edited — anything else
  going red is a real break, not fallout.
- AC4 (filed on NAT-011): University + path present as one surface; `/university` on the web
  shows the signed-in learner their own path on the syllabus.

---

## Done — 2026-08-22

Two tabs, `Installed lessons` and `Your path`, in `views/Learning.tsx` using the shared
`Tabs` component (segmented variant).

- **AC1** ✅ The shelf is the first thing on the tab when there is anything on it.
- **AC2** ✅ The path is one click away; `LearnerPathSection` is unchanged, so the `truth`
  sentence is still the first thing it says.
- **AC3** ✅ **No UNI-007 assertion needed editing at all.** The 49 specs grade the section's
  *internal* order; page-level placement was never asserted anywhere, which is worth knowing —
  the thing UNI-007 AC1 was most specific about was the thing nothing watched. 409 specs across
  `uni-007`, `launcher` and `uni-011` pass unchanged.
- **AC4** ✅ Filed as **NAT-011 AC7**, quoting Richard in full, with the path/University
  reconciliation spelled out and a pointer at the shape this task just built.
  ⚠️ NAT-011 has **uncommitted edits from an earlier session** in the working tree; AC7 was
  added beside them and left uncommitted rather than sweeping somebody else's work into a
  commit of mine.

### Three decisions worth finding later

1. 🔴 **`hidden` draws no tab, not an empty tab.** D15: `LearnerPathSection` returns `null` for
   a refused viewer, so a strip rendered around it unconditionally would put the words "Your
   path" on a screen the section is careful to leave blank — **the refusal would leak through
   the chrome instead of the content.** Specced, with a not-hidden control beside it.
2. 🔴 **The default is a function of the shelf, not a value latched at mount.** The host's
   `learning` starts `[]` and is filled by an effect, so `useState(() => …)` would have read the
   empty array every time and opened on the path for everybody — the fix reintroducing the bug
   it fixes. `chosen` (null until clicked) is what makes a click stick.
3. **UNI-007's argument survives**: an empty shelf still opens on the path, because *"the first
   screen would be an empty grid explaining a folder format"* is still true. Tabs let both be
   true.

### Where it lives

- `views/learningTabs.ts` — the decisions, as a pure function (`Learning` reads context and
  `Tabs` holds state, so neither survives `tests-unit`'s element walker).
- `tests-unit/fb-004/learning-tabs.test.ts` — 15 assertions.
- `LearningSection` / `LearnerPathSection` gained `showTitle` (default `true`, so every other
  host and all of UNI-007's specs are untouched): under a tab labelled "Your path", a heading
  repeating the tab you just clicked is noise.

⚠️ **Not yet driven.** The layout — a segmented strip inside a page that scrolls in
`ContentArea` — is reasoned about, not seen. The `Tabs` root is `height: 100%; overflow: hidden`,
which resolves to `auto` under an auto-height parent; that is an argument, and this repo's
recorded rule is *drive it, do not reason about it*.

---

## Driven — 2026-08-22 (session 3)

Built and specced in session 2 but **never seen**; the open worry was that the segmented `Tabs`
root (`height: 100%; overflow: hidden`) inside a scrolling `ContentArea` would clip a lesson grid
taller than the window. That was an argument, so it got measured instead.

At the default window (1368×781), Learning tab:

- Tab strip renders at `top: 80`, 33px tall; **`Installed lessons` is the active tab on arrival**
  and its shelf starts at `top: 133`. AC1 holds — the shelf is the first thing on the tab, no
  scrolling.
- `Your path` is one click away and opens on the `truth` sentence, above the numbered steps. AC2
  holds.
- **The clipping worry is unfounded, and now measured rather than reasoned about.** Injecting a
  1400px probe into the tab content grew `Tabs-module__Root` from 352 → 1752 and left
  `ContentArea` at `clientHeight 687 / scrollHeight 1800` — it scrolls, nothing is cut off.
  `height: 100%` under an auto-height parent resolves to `auto`, exactly as the argument said,
  but the argument is not why we now believe it.

🔴 **A trap that nearly produced the opposite conclusion.** `ContentArea` has
`scroll-behavior: smooth`, so `el.scrollTop = 9999` **animates** — reading `scrollTop` back in the
same eval returns `0`. That reads as "overflowing content that refuses to scroll", which is
precisely the bug being looked for. Read in a *second* CDP call it was 500. Same family as the
existing "a React write is invisible in the same eval" note: **measure a scroll in a separate
call, or record a false positive.**

⚠️ Minor, not fixed here: the segmented tab buttons carry **no `aria-selected`** (and no
`role="tab"`), so the active tab is conveyed by class alone. Worth folding into whichever task
picks up launcher a11y rather than spot-fixing in a drive.
