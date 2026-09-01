# Phase 82 — next session

_Opened 2026-08-31 (s1). Last updated **2026-09-01, session 11**. 🔴 **Row 6 is REOPENED** on
Richard's instruction — the FINE close is reversed and the template's look is the next job again.
Session 11 also bumped the version for row 8 (`5c805978`). The decisions are
[`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md); the change list is
[`REL-002c-WHAT-I-WOULD-CHANGE.md`](REL-002c-WHAT-I-WOULD-CHANGE.md)._

## 🔴 Read this first: this is the only board you open

Richard, 2026-08-31: *"can we work through the next session prompt in phase 82, rather than me
ending up driving unnecessary tasks in other phases by accident — just so we focus on the tasks we
need to launch, over several sessions all in phase 82."*

**So: every launch session opens THIS file, takes the next unstruck row from the run sheet below,
and finishes inside phase 82.** The verdict scale and close protocol are restated in
[`TASKS.md`](TASKS.md) — you do not need to open phase 81.

🔴 **If a row is not on this board, it does not gate 0.2.2.** Anything else you find is a **register
row with an owner**, not this session's job — see
[`../../guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md).

## 🔴🔴 THE RULING THAT REOPENS ROW 6 — 2026-09-01, session 11

**Richard:** *"Anthropic just reset my weekly usage limit, so we're going back round and fixing that
fucking template. Update the next session prompt please, I want all pages looking as good as the
homepage."*

**This reverses the s10 close.** Row 6 was closed **FINE, not WORTHY**, explicitly on cost — *"we
can't waste more time on this"* — with the AC **overridden, not met**. The cost constraint that
justified the override is **gone**, so the override goes with it. `TASKS.md` §"The ruling that
closed this row" is now **superseded**; keep it, do not delete it, and read it for what it recorded
about the distance still to travel.

🔴 **Items 5 and 6 are UN-DECLINED.** They were declined on cost, not on merit. Item 6 — a
photograph on `/setup` — was listed as *"taste, and I would ask first"*. **He has now asked for it**,
and for its two siblings besides.

### The bar, and why this phrasing is sharper than the old one

The written AC is *"every page reads WORTHY in both states at all three widths"*. WORTHY is a
scale, and a scale invites a session to argue itself over the line. **"As good as the homepage" is a
comparison against an artefact that exists and can be photographed beside the page being graded.**

✅ **Grade it that way.** For each page, put its render next to `/` at the same width and answer one
question in writing: *would a stranger think these two pages came from the same designer?* That is
harder to fudge than a three-word verdict, and it is what Richard actually asked for.

⚠️ **The chrome exemption still holds** and is not a loophole. `TASKS.md` §"the verdict scale":
these are mostly app-chrome pages and **a settings page needs no hero, no gradient, no 72px display
type**. "As good as the homepage" means *shows the same amount of decision*, not *looks like a
landing page*. A directory that is beautifully dense and clearly ruled is as good as the homepage. A
directory with no header row is not.

## 🔴 What the homepage actually has that the others do not — measured s11, from the artefact

Read out of `templates/members-area/components/Pages/*/nodes.json` this session, not from the task
files. **This is the spine of the work** — it converts "as good as the homepage" into a list.

| page | Chrome | Footer | hero image | tiles band |
|---|---|---|---|---|
| **Landing** (the homepage) | — | ✅ | ✅ `people-coffee-shop.webp` | ✅ `InsideTile` |
| Join | — | 🔴 **none** | ✅ | — |
| **Setup** | — | ✅ | 🔴 **none** | — |
| **SignIn** | — | ✅ | 🔴 **none** | — |
| **Unsubscribe** | — | ✅ | 🔴 **none** | — |
| Account · Announcement · Directory · Meeting · Meetings · Members · Post · Requests | ✅ | ✅ | — | — |

Four findings fall straight out of it:

1. 🔴 **Three door pages have no identity at all, not one.** Item 6 named only `/setup`. **`/sign-in`
   and `/unsubscribe` are in exactly the same state** — a bare form on ground, no photograph, no
   band. `/setup` is the owner's first ever screen and `/sign-in` is the returning member's, so two
   of the three are high-traffic. The `/join` band pattern is built and is the obvious donor.
2. 🔴 **`/join` is the only page in the template with no footer.** It was excluded from item 4's
   footer pass because it "floats on `BAND_PAGE_GROUND`" — but the homepage floats too and got one.
   Check this against a render before acting: it may be right, but nothing recorded a decision.
3. ✅ **The hero is a `backgroundImage` on a Group, not an `Image` node** — there are **zero** `Image`
   nodes in the entire template. Do not go looking for one. **44 `.webp` files** are available under
   `noodl_modules/starter-imagery/`, so the three identity-less pages have plenty to draw on.
4. ✅ **`InsideTile` is mounted on the homepage alone.** Item 1 already proved that band carries the
   door state; nothing else reuses it.

## The run sheet

Take the topmost row that is not ✅.

| # | row | why here | needs |
|---|---|---|---|
| ~~1–5~~ | ~~REL-007/006, REL-005, REL-003, REL-002a, REL-002b~~ | ✅ **CLOSED s1–s5** | — |
| **6** | **REL-002c — every page as good as the homepage** | 🔴 **REOPENED s11 by Richard.** The FINE close is reversed | **THE NEXT JOB** |
| 7 | **REL-001** publish + drive the install | shelf's first row; also closes P75's FB-005 | ⏸️ **HOLD** — see below |
| 8 | **REL-004** cut, tag and publish `v0.2.2` | last | 🟡 **AC1 done s11** (`5c805978`). 🔴 Blocked: `cline-dev` `0 573` unpushed |

### ⏸️ Why row 7 now waits, and the one thing to check with Richard

Row 7 publishes `templates/members-area` to the shelf. **Row 6 changes that artefact.** Publishing
now ships the FINE version and every fix becomes a re-publish.

✅ **Re-publishing is supported and safe** — `publish-project-template.ts` re-run against an existing
row leaves visibility where it was, so this is not a one-shot. **So it is genuinely Richard's
call**, and the recommendation is: **fix first, publish once.** He has not been asked; ask when the
look work is close, not now.

## 🔴 The order of work for row 6 — grade before you build

**Session 10 shipped a row whose AC said "every page" while four pages had never been photographed.**
Do not repeat that. The order is forced:

### First: make the instrument able to see all thirteen pages

🔴 **`Announcement`, `Meeting`, `Post` and `Unsubscribe` have never been rendered — not once.**
`vib001-members.look.ts` asks for **nine of thirteen** (five door + six living, `landing` and
`members` appearing in both). Their absence is a fact about the **request**, not about how they
look.

✅ **Add them to the shot lists before grading anything.** Until that is done, "every page" cannot be
said honestly, and any verdict is a verdict about nine pages wearing a claim about thirteen.

⚠️ `Announcement`, `Meeting` and `Post` take `PageInputs` — they are **detail pages that need an
id**. Photographing them means seeding a row and routing to it, which is why they were skipped.
Budget for that; it is the reason this was not free.

### Then: the two instruments, and which to reach for

| harness | what it costs | what it sees |
|---|---|---|
| `rel002c-look.look.ts` | **~92 seconds** — 4 pages × 4 viewports, **no backend** | **Door state only.** Two of s10's three corrections came off this |
| `vib001-members.look.ts` | **~9 minutes** — needs a provisioned, seeded, signed-in backend | Both states. The only thing that can close the row |

✅ **Iterate on the fast one, close on the slow one.** The full grading job is **13 × 2 × 3 = 78
renders**; that is what scales linearly, not the build.

### Then: build, cheapest first

The change list in [`REL-002c-WHAT-I-WOULD-CHANGE.md`](REL-002c-WHAT-I-WOULD-CHANGE.md) is still
the right starting position, now with **items 5 and 6 live** and item 6 widened to three pages:

- **Item 5 — `/directory` has no header row**, and at 1200 a name sits ~250px from its email.
  Costed in that file. 🔴 **Read the census gate first** (`TASKS.md` §2): it counts *"a Group
  wrapping exactly one Text"* as a notice box, and three header cells are exactly that shape. s8
  already had to correct this census once.
- **Item 6, widened — `/setup`, `/sign-in`, `/unsubscribe` get an identity.** The `/join` band is
  the donor pattern.
- ⚠️ **Most of the look lives in the seven shared `Members/` components** (`Chrome`,
  `AnnouncementRow`, `InsideTile`, `MeetingRow`, `MemberRow`, `RequestRow`, `Standing`). Fixing the
  chrome and the row family lifts most of the thirteen at once. **Look there before editing a page.**

### What is explicitly NOT reopened

- ⚠️ **The `EDIT ME —` footer lines stay.** They are an instruction to the installer; that is correct
  for a template.
- ⚠️ **`FORM_GROUND` stays at 720 centred** — ruled by Richard, 2026-09-01.
- ⚠️ **The announcement row's white space stays** — every rearrangement s8 tried was a 390px
  regression.

## 🔴 Hazards that bit this row before, carried forward

1. 🔴🔴 **EVERY `Group` WITHOUT A `sizeMode` IS `flex-grow: 100`.** `addDimensions` defaults
   `sizeMode` to `explicit` and `height` to `100%`, and
   [`layout.ts:98`](../../../packages/noodl-viewer-react/src/layout.ts#L98) turns a percentage height
   inside a **column** parent into `flexGrow`. **Any container given real slack shares it out among
   its unpinned children** instead of keeping it at the bottom — s10 got 150px between `/sign-in`'s
   heading and its form this way. ✅ **Pin anything that must stay content-height before giving an
   ancestor a floor.**
2. 🔴 **A FIX'S STATED MECHANISM CAN PAINT NOTHING.** Item 4's `minHeight: 100vh` on `PAGE_GROUND`
   would have changed no pixel — that Group carries **no `backgroundColor`**. ✅ **A page has a
   bottom edge when something is AT the bottom.** Check the artefact for the property the fix needs.
3. 🔴 **FOUR TIMES IN THIS ROW, A LAYOUT COMPLAINT HAD A CONTENT ANSWER.** The door landing's void
   was "fixed" with a footer, then `space-between`, then a diagnosis — and actually fixed by
   **mounting a band that was already built**. ✅ **Ask what is missing before asking what is
   mis-sized.**
4. 🔴 **A DECISION RECORDED IN A COMMENT IS STILL A CLAIM.** s9 wrote *"the three buttons below
   STAY"*; the principle was right and the reading of those three was wrong. ✅ **Re-derive a
   recorded decision against the picture before inheriting it** — and note the gate that had blocked
   item 1 was arguing about a page layout that no longer existed.
5. ⚠️ **DELETING A CONTROL DELETES MORE THAN THE CONTROL** — three buttons took three
   `RouterNavigate` nodes, a `Columns`, and a helper with one caller. ✅ **Grep for the id after
   removing a node**; an orphaned navigator ships as a node nothing can fire.
6. 🔴 **A DELETED AFFORDANCE REDDENS THE SPEC THAT USES IT AS A CONTROL — RE-POINT IT, DON'T DROP
   IT.** `tpl001-members-drive` §5 AC4 uses the moderator's offered buttons as the **positive
   control** for two negative arms. Deleting one reddened the control while both negatives stayed
   green — the shape where *"three arms that all end on `/` are equally consistent with a gate that
   refuses unconditionally"*.
7. ⚠️ **A GATE CAN BE A HARD COUNT IN THREE PLACES.** s10 moved the mounted-gate census (54→53),
   the `Columns`-children census (15→12), the component count (29→30) and the file count (91→94).
   Each has a written argument above it — **update the argument, not just the number**.
8. 🔴 **NEVER OPEN `templates/members-area` IN THE EDITOR.** `readBundleDirectory` has **no skip
   list of any kind** — 72 lines, walks everything. Opening writes `.mcp.json` (carrying absolute
   paths from this machine), `CLAUDE.md` and a `.gitignore` block, and **all three would ship**. It
   also breaks AC7, which requires byte-identity with a fresh generate. ✅ Work through
   `npm run template:members` and the generator, not the editor.
9. 🔴 **GATE ON AN EXIT FILE YOU WRITE YOURSELF.** The wrapper's *"completed (exit code 0)"* has now
   disagreed with reality in three consecutive sessions. ⚠️ **`timeout` does not exist on this Mac** —
   `command not found` piped into `echo "EXIT=$?"` reads as **`EXIT=0`**.

## Row 8 — done and blocked parts

✅ **AC1 met s11 (`5c805978`):** `packages/noodl-editor/package.json` reads `0.2.2`, gated on
`npm run ci:build:editor` **exit 0**. Two findings are written into
[the runbook §2](../release-0.2.2/PUBLISH-0.2.2.md): the nine `library/prefabs/*/library.json` files
that also read `0.2.0` and must **not** move, and why the `package-lock.json` copy is **not** a gate
despite CI running `npm ci` — at tag `v0.2.0` the lock read `0.1.7` against a `0.2.0` manifest and
that tag shipped a real signed release.

🔴 **Still blocked on Richard:** `cline-dev` is **`0 573`** unpushed, `origin/cline-dev` is at
2026-08-21, CI has run on none of it. Derive the count again at cut time. ✅ **Tag at `5c805978` or
later** — anything earlier carries `0.2.0` in `artifactName`.

## Working rules for this tree

🔴 **The working tree carries a large amount of another session's in-flight work** — ~40 modified
tracked files across `noodl-editor`, `noodl-mcp`, `noodl-core-ui`, `noodl-types` and
`package-lock.json`, mtimes clustered at **09-01 11:35–11:50**, with three OpenNoodl peers live at
s11. ✅ **Touch none of it. Commit by pathspec, never `git add`** — except untracked paths, which a
pathspec commit **skips silently** (`git status --porcelain | grep '^??'`, and check whether a `??`
is a **directory**).

⚠️ **Three tracked files from s4/s5 are still unswept for a third session** — mtimes 08-31, content
never read: `packages/noodl-mcp/tests/{renderReportModule,stagingDiagnostics,sb007Template}.test.ts`
(the last is P80's known orphan; Richard confirmed it is not his). **Read them before committing.**
