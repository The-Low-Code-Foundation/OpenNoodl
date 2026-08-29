# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **SBR-015 is done.** AC1, AC2 and AC3 are met; AC4 is 🟡 by design

**s13 (2026-08-29)** paid the drive that `379f4dec` owed. The thirty-second silence that started
this task now ends as a sentence on screen in **29 ms**.

🔴 **The previous handover was stale in two places and cost this session twenty minutes** — it
named "wire PageRow's failure" as the first job when `379f4dec` had already wired it, and called
AC2's gate unwritten when it existed with a mutant. **Re-read the task file before believing a
handover's job list**; a handover is written before the next commit lands.

Read in this order:

1. **[SBR-015 §2.3d](SBR-015-A-FAILURE-WITH-NOWHERE-TO-GO.md)** — the drive, both arms, and the
   measurement error it corrected.
2. **[SBR-017](SBR-017-THERE-IS-NO-WAY-BACK-IN.md)** and
   **[SBR-016](SBR-016-THE-LIST-THAT-NEVER-ASKS.md)** — the two biggest open holes, below.
3. **[THE-SWEEP-2026-08-29.md](THE-SWEEP-2026-08-29.md)** — s11's 54 rows, still the register.

---

## 🟢 SBR-015 AC1 — MET. Both arms, same button, one variable

**Why a fresh project was necessary, and this is the reusable half.** A project is a **copy** of
the template taken at mint time. `SBR-015 Zero Section Drive` was minted *before* `379f4dec`, so
its PageRow still carries `done` and no `failure` — re-driving the old fixture would have
re-measured the old defect and read as a regression. Verified before driving: the new project's
`components/Admin/PageRow/connections.json` holds all **9** new edges.

The variable is whether `Section` has a `pageId` column. It was created by writing a Section row
against a *different* page, so the page under test had **zero** sections in both arms.

| `Section.pageId` | backend | what the admin sees, from the click |
|---|---|---|
| **absent** | `error`, **11 ms** | **29 ms** — `This page could not be published.` under the title, menu closed |
| **present** | `success`, **12 ms** | **31 ms** menu closed *and refusal cleared*; **48 ms** pill `Published` |
| absent again | `error`, **11 ms** | **29 ms** — refusal returns |

`done → to-Quiet` genuinely resets a prior refusal — observed, not just asserted. The text renders
`rgb(220,38,38)` = `--destructive`, 210×33 px, `mounted` so it takes no space when absent.

🔴 **The measurement error, because it will happen again.** The first refusal reading was
**5,827 ms** and was nearly reported. The clock started when the button was *stamped* — in one
`npm run cdp` process — and the click arrived from a *second* process, so the interval measured
**CLI startup plus app latency**. Anchoring `t0` inside the page, in a capture-phase `click`
listener, gave **29 ms**. ✅ **If the clock and the cause are in different processes, the number
is about the harness.** The question that caught it: *what would this read if the app were
instant?* — still ~5,800 ms.

⚠️ **`CloudFunction2` does not go through `window.fetch`** — a fetch hook records nothing and that
reads exactly like SBR-016's "never asked". What carried this was the DOM plus the backend's
`workflow_executions`.

---

## 🔴 FIRST JOB — SBR-017, the biggest hole left in the story

**The template has one auth node in twenty-one components: `SignUp`, on `/Pages/Setup`. There is
no `LogIn` anywhere.** An owner who claims their site and later loses their session cannot get
back into their own admin panel.

Measured on the drive backend, against an already-claimed site:

| step | result |
|---|---|
| `POST /users` — a second account | **201**, real `_User` row **and a session token** |
| `POST /functions/claimSite`, correct token | **400** `This site cannot be claimed.` |

A right refusal and a locked door. `net.noodl.user.LogIn` exists in the runtime; the template
never places it. ⚠️ Signup logs the new user in, which is why the s9, s12 and s13 drives all
missed it — claiming and being signed in were one act.

## 🔴 SECOND JOB — SBR-016, and it adds a *third* state to §5.8

Arriving at `/admin/pages` renders the shell, the heading and `New page` and **nothing else**,
while `GET /classes/Page` on the same session returns the rows.

🔴 **It is not a refused query. There is no query.** `pages-2` fetches only on `create.done` or a
row's `Changed`, so **any drive that creates a page first cannot see this** — s9, s12 and s13 all
created a page first. A refused query, an empty collection and a collection that never asked are
three states, pixel-identical, with three different fixes.

---

## Where each AC now stands

| | verdict | evidence |
|---|---|---|
| **SBR-015 AC1** | ✅ | §2.3d — 29 ms refusal, 31/48 ms success control |
| **SBR-015 AC2** | ✅ | `sb007Template.test.ts:576-830`, 9 specs, derived population + graded exemptions + naming mutant |
| **SBR-015 AC3** | ✅ | §2.3a, control pair |
| **SBR-015 AC4** | 🟡 | `execution_steps` 0 rows across all four executions — the task says why, and it is right |
| **SBR-006 AC1** | 🟡 | driven; rows still carry no title or slug (SBR-008) |
| **SBR-006 AC2** | 🟡 | blocked on SBR-008 |
| **SBR-006 AC3** | ✅ | both halves now driven — success s12, refusal s13 |
| **SBR-006 AC4** | ✅ | `View site` lands on `/` |
| **SBR-006 AC5** | ✅ | s9's control pair |

## Reproduced independently on a brand-new backend, so all three are stronger

- **DEF-014** — `GET /classes/Section?where={"pageId":…}` → **500 `no such column: "pageId"`**, on
  a backend where the table did not exist at all. A brand-new site cannot publish its first page.
- **DEF-015** — the card warned three workers were *"in the project, not on this backend"* while
  reading **"pushed just now"**, on a project minted minutes earlier.
- **SBR-008** — the `Page` row has `objectId/createdAt/updatedAt/ACL/published/showInNav/navOrder`
  and **no `title`, no `slug`**.

## Standing context

- 🔴 **Drive fixtures — do not overwrite.** **`SBR-015 AC1 Drive`** (backend `backend_mte62ofkj8whc`,
  port 8598, token `drive-token-ac1`, owner `owner@ac1.test` / `drive-pass-ac1`) is the *post-fix*
  fixture and the only one whose PageRow carries the failure wiring. ⚠️ It is left in the
  **refusal arm**: `Section.pageId` is renamed to `pageId_hidden` — rename it back for the success
  arm. **`SBR-015 Zero Section Drive`** (`backend_mte3mrsp5qtbd`) is *pre-fix* and cannot test AC1.
  **`SBR-006 Admin Drive`** (`backend_mtdg3sdziq5nw`) is DEF-004's before-arm.
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify as written; if the
  platform cannot express what an AC asks for, **say so and record the gap**.
- ⚠️ **`test:ci` was not run in s13** — no editor, runtime or MCP source was touched. The
  noodl-mcp jest suite was run for `-t "SBR-015"` (9 passed). s10's floor stands (**2889 specs,
  4 failures, all `AIX-006 style vocabulary` by name**).
- Shared checkout: **pathspec commits only, never `git add`** (s13 staged by mistake and unstaged
  immediately); announce editor launches **and** teardowns; `test:ci` alone, never beside a live
  stack.
- Drive mechanics that cost time: the backend card's **Secrets panel is in the `…` overflow**, and
  every item in that menu **renders twice** — pick the copy `elementFromPoint` returns. The
  preview canvas is **456×313** with a panel open and **756** wide with it collapsed.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
