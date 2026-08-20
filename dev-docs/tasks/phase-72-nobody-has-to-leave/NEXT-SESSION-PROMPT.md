# Next session — phase 72

**Written 2026-08-20, ninth session.** **D5 is settled and NAT-008 is built.** The people surface
opens in place on both surfaces, a post's author line opens the person behind it, and the whole
reading path was driven over real HTTP. **Every Tier-3 write in this phase is now unblocked, and
the flagship's remaining half is the highest-value thing left.**

## Read first, in this order

1. [README §4](README.md) — **✅ D5 is settled: the editor gets the same session scope as the
   browser.** No re-consent step, no narrower grant. ⚠️ It created one piece of work: the device
   flow's approval copy was written for *identity* and now authorises *writes*.
2. [NAT-008](NAT-008-THE-PEOPLE-ARE-THE-PRODUCT.md) §Status — 🔴 **read it before NAT-009/010/011.**
   Three findings all three inherit, and one of them will bite silently.
3. [NAT-007](NAT-007-A-THREAD-YOU-CAN-ACTUALLY-ANSWER.md) §Status — AC4/AC6 are now a build, not a
   wait, and the platform already accepts the token.
4. `models/community/peopleview.ts` and `hooks/useCommunityPeople.ts` — the shapes NAT-009/010/011
   copy, one layer richer than `threadview.ts` (a list *and* a detail, with narrowing between them).

## What happened this session

**`736af592` · `b19f2ec2` · `bb26f362`.** NAT-008's six criteria close. Gates on the committed
tree: `typecheck:editor` and `typecheck:editor-tests` clean · `test:main` **280 suites / 4544
tests / 0 failures** · core-ui jest clean · NAT-001's PAIRS table **245 assertions** with 14 new
pairings graded in both themes. **71 new tests, verified red 14 of 14.**

### 🔴 The list endpoints have no search, and they page — both halves matter

Measured against the route on a real database, with a control: `?q=ada` over three people returns
**all three**, `?q=zzzzzzzz` returns **all three**, and `?offersCoaching=true` returns **one** — so
the route ran and its own filters work. **The keyword is simply not read.** That is the fifth
endpoint in this codebase found doing it.

🔴 **NAT-009's RFP board, NAT-010's coaching list and NAT-011's syllabus are the same shape.** They
must filter locally (which is what the *web* does — one function for the rows and the counts) —
**and say what they searched over**, because `listBody` pages at 50 and caps at 100. A local search
over page 1 of 5 is the same silent lie in a nicer coat. `readDirectory` + `boundLine` are the
pattern; copy them.

### 🔴 A vocabulary copied from the platform must be READ off the platform

`rateBandLabel` was written as `day_400_600` / `day_600_plus`, in the house style of every other
enum over there. The real keys are `under-400`, `400-700`, `700-plus`, `not-for-hire`.

⚠️ **The guard worked and that is exactly why it was dangerous.** An unknown key draws no chip, and
a blank band is *also* the correct rendering for somebody who did not answer — so every rate would
have vanished and nothing would have looked broken. Found by **curling**, not by a test. **A safe
failure mode is not a substitute for reading the source.**

### 🔴 There is no contact route on this platform, and AC6 closes by saying so

`PersonProfile` carries no email address, deliberately — UNI-004's relay exists so responding to a
brief does not hand out addresses, and **D10 is open**. So the profile draws **no** contact button
rather than one that opens Chrome. `contactFor` is the seam; the real verb is *"ask them on the
Bench"* and it belongs to NAT-009/NAT-010, which are writes, which D5 has now unblocked.

### ⚠️ A spec that builds a view model cannot grade the function that builds it

One hole in fourteen: mutating `postView`'s `authorHandle` to `author.replace('@','')` left **every
render spec green**, because they all construct the view by hand. It would have shipped a profile
link on an anonymous post opening `/people/someone`. Both halves need an assertion each — and the
other three surfaces are about to copy these shapes.

## Where to start

🔴 **NAT-007's writes.** D5 is settled, the platform already accepts the editor's bearer token on
`POST /api/v1/bench/threads/:id/posts`, and `answer()` is already on the client. Closing it takes
**AC4, AC6, AC7's second direction**, plus NAT-006 AC5 — the flagship, finished. ⚠️ **Carry the
consent copy with it**: somebody who approved *"sign in"* should not discover later that they also
approved *"post as me"*. That is UI in NAT-007, not a polish item.

Otherwise **NAT-009** (the work board) or **NAT-011** (the University) — both read-only halves are
now a copy of two files, and both have writes that D5 unblocked. **NAT-004** (light by default on
the web, S, `nodegx-community`) is still the only unstarted Tier-1 task.

🔴 **Still do not close NAT-009 AC5, NAT-010 AC5 or NAT-013 AC4 on the strength of NAT-006.** They
close when mail reaches a human — NAT-014 AC2/AC7.

🔴 **And when you do drive: the layout defect above is the shape to expect again.** Both other
Tier-3 surfaces will insert their own controls between a section's head and its body. **Measure
the boxes — do not read the screenshot.**

## Loose ends

- 🟡 **NAT-008's RAIL PANEL was not driven in situ.** The launcher tab was — and the drive found a
  real defect no spec could see: the directory's controls sat **14px outside the card's gutter**,
  because `SectionHead` pads itself and `Body` pads itself, so a component inserted *between* them
  inherits neither. **The screenshot did not look broken.** Fixed in `e86cd31e`. What is left is
  the rail: it needs a project open, the launcher's recents did not list the drive copy, and
  there is no editor global — a native file dialog is not reachable from CDP. ✅ The same component
  narrowed to 320px overflows nowhere, so the *wrap* is fine; `BasePanel`'s chrome and `ScrollArea`
  in situ are what has not been looked at.
- ⚠️ **To drive any of this you must run the platform locally.** NAT-006's ten endpoints still
  **404 in production** — `community.nodegx.io` serves a build from before this phase.
  `DATABASE_URL=postgres://nodegx:nodegx@localhost:55432/nodegx_community_s45 npx next dev -p 3100`
  in `nodegx-community` works, seeded with five people. 🔴 `COMMUNITY_URL` is a **hard-coded
  constant** with no env override (`models/community/communityorigin.ts`) — pointing the editor at
  a local platform means editing it, and **reverting it**.
- ⚠️ **D15's refusal was not driven over HTTP** — that needs an `org_minor` session token. Graded at
  the composer and the component, each with a permitted control.
- ⚠️ **Seven phase-72 files remain modified and uncommitted from earlier sessions** (NAT-006/009/
  010/011/012/013). Untouched. Everything of mine is committed by pathspec.
- ⚠️ A peer is landing TUT-002 (phase 73) in the same checkout — `lesson*`, `noodl-mcp`,
  `BackendServicesPanel`. Untouched, and the `test:main` figures above include their suites.
- ⚠️ **Storybook still does not start** (NAT-005 AC4) and the ~99 fill-role files are unchanged from
  the last six handovers. The new people components have no stories for that reason.
