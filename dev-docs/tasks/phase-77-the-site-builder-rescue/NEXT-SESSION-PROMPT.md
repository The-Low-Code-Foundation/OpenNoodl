# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **the drive is done.** SBR-015's question is answered, and it found four more things

**s12 (2026-08-29)** minted a project from the regenerated template, gave it a
wizard-attached backend, provisioned `SITE_SETUP_TOKEN` through the Secrets panel, claimed the
site, created two pages through the dialog and published one. The drive owed by s10 and s11 is
**paid**.

Read in this order:

1. **[SBR-015 §2.3a/b/c](SBR-015-A-FAILURE-WITH-NOWHERE-TO-GO.md)** — the answer, the control
   pair, and what AC1 still owes.
2. **[SBR-016](SBR-016-THE-LIST-THAT-NEVER-ASKS.md)** and
   **[SBR-017](SBR-017-THERE-IS-NO-WAY-BACK-IN.md)** — new, both found by that drive.
3. **[phase 80's DEF-014 and DEF-015](../phase-80-the-defects-the-templates-found/TASKS.md)** —
   the two product-side rows the drive turned up.
4. **[THE-SWEEP-2026-08-29.md](THE-SWEEP-2026-08-29.md)** — s11's 54 rows, still the register.

---

## 🟢 SBR-015 AC3 — ANSWERED. The node is `sections-3`, and the cause is one missing column

**The thirty-second hang is gone.** The zero-section publish now answers **`HTTP 400 This page
could not be published.` in 12–19 ms** (was `error`, 30,004 ms, `timedOut: true`). That body is
`deny`'s own `errorMessage`, so SBR-015's wiring is what made the backend able to speak.

**Which node — measured, not inferred.** The same query `sections-3` runs, issued directly with
the admin's session token:

```
GET /classes/Section?where={"pageId":"…"}  →  500  no such column: "pageId"
```

The auto-created `Section` class holds only `objectId/createdAt/updatedAt/ACL` and zero rows. A
filter on a column nothing has ever written is a **500, not an empty result set**.

**The control pair, one variable** — `Section.pageId` present or absent. The column was created
by writing a Section row against a *different* page, so the page under test carried zero
sections in both arms:

| `Section.pageId` | publish, same page, same body |
|---|---|
| absent | **400** — 12 ms |
| present | **200** `{published:true}` — 24 ms |

So three of s11's readings are **confirmed, not merely unrefuted**: the guards pass, `Run Tasks`
on an empty list fires `done` (not `unchanged`), and **a zero-section page is legitimately
publishable**.

🔴 **The consequence nobody had stated: a brand-new site can never publish its first page.** That
is **[DEF-014](../phase-80-the-defects-the-templates-found/DEF-014-A-QUERY-AGAINST-A-COLUMN-LESS-CLASS.md)**,
and it is a backend defect — **do not fix it in the template**. That would make the site builder
work and leave every other app broken, and would remove the only place it is currently visible.

---

## 🔴 FIRST JOB — SBR-015 AC1. The fix landed on the cloud half only

Same button, two arms, both driven through the UI:

| backend answered | what the admin sees |
|---|---|
| **400 in 19 ms** | **nothing, for 47 s observed.** Menu stays open, pill stays `Draft`, no message. A `MutationObserver` over `document.body` recorded **zero** text changes |
| **200 in 24 ms** | menu closes at **211 ms**; at **228 ms** the pill reads `Published` and the count sentence updates |

`/Admin/PageRow`'s `publish`, `unpublish` and `duplicate` `CloudFunction2` nodes wire **`done`
only** — no `failure` on any of the three. The success arm is the control that proves it is the
wiring, not the drive.

This is a small change in **`packages/noodl-mcp/tests/sb005Components.ts`** (PageRow lives there, not in `sb004Components.ts` — that file holds the cloud endpoints) plus somewhere to put the message, and it closes
SBR-015 AC1 and unblocks SBR-006 AC3's first half. **Do it first.**

**Three things already established, so do not re-derive them** (SBR-015 §2.3b has them in full):

1. The hole is **exactly three nodes** — PageRow's `publishPage(true)`, `publishPage(false)` and
   `duplicatePage`. Every other `CloudFunction2` in every other browser component already wires
   `failure` or `error`. Contained, not systemic.
2. The precedent is `claimSite` again, same file: `/Pages/Setup` does
   `claim.failure → claimGate.eval → claimRefusal.visible`. PageRow wants that plus
   `failure → menuState.to-Closed` for the "stops being busy" half. ⚠️ **`visible` holds its
   space, `mounted` does not** — P78 D16 was exactly that bug.
3. 🔴 **AC2's gate as designed could not have caught this.** Its population is *components
   holding a `noodl.cloud.request`* — cloud endpoints only — so a browser component that
   **calls** one is invisible to it. Widen it to grade `CloudFunction2` callers, or this comes
   back. **A checker's population is part of the checker**, third time this phase.

⚠️ **Ownership**: SBR-015's author (session `98671`) has offered to take AC1 and is holding off
`sb005Components.ts` pending a word. **Say who has it before either of you edits** — a collision
there costs a template regeneration and three count pins.

---

## 🔴 SECOND JOB — SBR-017, because it is the biggest hole in the story

**The template has one auth node in twenty-one components: `SignUp`, on `/Pages/Setup`. There is
no `LogIn` anywhere.** An owner who claims their site and later loses their session cannot get
back into their own admin panel.

Measured on the drive backend, against an already-claimed site:

| step | result |
|---|---|
| `POST /users` — a second account | **201**, real `_User` row **and a session token** |
| `POST /functions/claimSite`, correct token | **400** `This site cannot be claimed.` |

A right refusal and a locked door. `net.noodl.user.LogIn` exists in the runtime; the template
never places it. ⚠️ Signup logs the new user in, which is exactly why the s9 and s12 drives both
missed it — claiming and being signed in were one act.

---

## 🔴 THIRD JOB — SBR-016, and it adds a *third* state to §5.8

Arriving at `/admin/pages` renders the shell, the heading and `New page` and **nothing else**,
while `GET /classes/Page` on the same session returns both rows.

🔴 **It is not a refused query. There is no query.** Measured in the viewer after load, with the
control beside it: **0 requests to `:8597`**, **5 to `:8574`**. `pages-2` fetches only on
`create.done` or a row's `Changed`, so **any drive that creates a page first cannot see this** —
which is what happened in s9.

SBR-006 §5.8 said a refused query and an empty collection are the same screen. A collection that
never asked is a third, pixel-identical to both, and its fix is a third fix.

---

## Where each AC now stands

| | verdict | evidence |
|---|---|---|
| **SBR-015 AC1** | ❌ | nothing on screen for 47 s; success arm 211 ms — §2.3b |
| **SBR-015 AC2** | ⬜ | the artefact gate, unwritten |
| **SBR-015 AC3** | ✅ | §2.3a, control pair |
| **SBR-015 AC4** | 🟡 | s11's correction stands — `executions.sqlite` will not name a node, and did not |
| **SBR-006 AC1** | 🟡 | driven with **two** rows this time, but they still carry no title or slug (SBR-008) |
| **SBR-006 AC2** | 🟡 | blocked on SBR-008 |
| **SBR-006 AC3** | 🟡 | success half driven (211/228 ms); refusal half is SBR-015 AC1 |
| **SBR-006 AC4** | ✅ | **driven** — `View site` lands on `location.pathname === "/"`, not `/%7Bslug%7D` |
| **SBR-006 AC5** | ✅ | s9's control pair |

---

## Two more things the drive saw, recorded so they are not rediscovered

- **[DEF-015](../phase-80-the-defects-the-templates-found/DEF-015-THE-CARD-WARNS-ABOUT-WORKERS.md)**
  — after a successful `Deploy functions` (the card's own timestamp reads *"pushed just now"*),
  the backend card still warns that `site/ContactRecipient`, `site/CopySectionToPage` and
  `site/SetSectionAccess` are *"in the project, not on this backend"*. They are Run Tasks
  workers with no `noodl.cloud.request` node and can never be endpoints. The proof they work is
  beside the warning: `publishPage` returns 200 having done `SetSectionAccess`'s job.
- **SBR-008, again, now with a consequence on the public site.** The created `Page` rows have
  **no `title`/`slug` columns at all**. After a *successful* publish the public site says *"This
  site's pages are not available right now."* — and the row is genuinely readable anonymously
  (verified: anonymous `GET /classes/Page?where={"published":true}` → 200, one row). It has no
  slug for the router to match. Nothing new; a sharper repro.

---

## Traps this drive paid for

- 🔴 **Empty-because-refused, empty-because-empty and empty-because-never-asked are the same
  pixels.** The instrument that separates them is `performance.getEntriesByType('resource')` in
  the viewer — and a zero reading proves nothing without a known-firing control beside it (the 5
  requests to `:8574`).
- 🔴 **`executions.sqlite` records duration and status but never a node.** It said `HTTP 400` in
  19 ms, which was enough to kill the hang hypothesis and not enough to name anything. What
  named `sections-3` was **issuing the query by hand and reading the body**.
- 🔴 **A drive that edits before it looks cannot see a missing initial fetch.** Arrive, then
  look, then edit.
- ⚠️ **The preview canvas is 456×313 css px with a panel open**, and `elementFromPoint` returns
  `null` outside the viewport — which reads as *"something is covering the button"* rather than
  *"the button is off-screen"*. Close the panel (756 wide) or check `innerWidth` first.
- ⚠️ **Toggling an editor panel reloads the viewer** and drops any `window.*` recorder.
  Re-install after any editor-side interaction.
- ⚠️ The Secrets panel is **not** on the backend card's button row — it is in the card's `…`
  overflow menu, and every item in that menu renders twice (the `BaseDialog` ghost). Stamp the
  copy `elementFromPoint` actually returns.

## Standing context

- Drive artefacts: **`SBR-015 Zero Section Drive`** (project in
  `~/vscode_projects/NodeGX test projects/`, backend `backend_mte3mrsp5qtbd`, port 8597, token
  `drive-token-sbr015`, owner `owner@sbr015.test` / `drive-pass-015`). It holds both arms of the
  control pair and the `Section` class in its post-query state — **do not overwrite it** until
  DEF-014 is fixed and re-driven. 🔴 **`SBR-006 Admin Drive`** (`backend_mtdg3sdziq5nw`) is
  DEF-004's before-arm; likewise do not overwrite.
- A peer offers two disposable fixtures: backend `backend_mtbxrca3axpbc` (port 8588) and project
  `~/Documents/sb015-editor-drive`. ⚠️ That backend is **already claimed** and has misled one
  session; a fresh wizard-made backend is cleaner and takes two minutes.
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify as written; if the
  platform cannot express what an AC asks for, **say so and record the gap**.
- ⚠️ **`test:ci` was not run in s12** — no editor, runtime or MCP source was touched;
  documentation only. s10's floor stands (**2889 specs, 4 failures, all `AIX-006 style
  vocabulary` by name**; readout `packages/noodl-editor/tests/test-results.json`).
- Shared checkout: **pathspec commits only** (untracked ⇒ `add`+`commit` in one chain); announce
  editor launches **and** teardowns; `test:ci` alone, never beside a live stack.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
