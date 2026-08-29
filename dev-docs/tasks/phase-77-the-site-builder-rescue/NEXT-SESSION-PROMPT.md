# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **SBR-017 is built and driven.** The owner can get back into their own site

**s14 (2026-08-29)** closed the biggest hole in the story. The template had one authentication node
in twenty-one components — `SignUp` — and no `Log In` anywhere. It now has a sign-in page, a
sign-out affordance, and a sentence for the visitor who is neither.

Read in this order:

1. **[SBR-017 §6](SBR-017-THERE-IS-NO-WAY-BACK-IN.md)** — the drive, the control pair, and the
   harness trap in §6.6 that will cost you twenty minutes if you skip it.
2. **[SBR-016](SBR-016-THE-LIST-THAT-NEVER-ASKS.md)** — now the **first job**, and it is holding
   another task's AC hostage. Its new section has the strongest control it has had.
3. **[THE-SWEEP-2026-08-29.md](THE-SWEEP-2026-08-29.md)** — s11's 54 rows, still the register.

---

## 🔴 FIRST JOB — SBR-016, and it is no longer just its own defect

Arriving at `/admin/pages` renders the shell, the heading and `New page` and **nothing else**.

**s14 took the reading that settles which of the three states it is.** From inside the running app,
on the session the panel itself holds, at the moment the panel was showing nothing:

```
GET http://localhost:8599/classes/Page   (X-Parse-Session-Token: the panel's own)
→ 200, 1 row, 2 ms
```

Same principal, same instant. Not refused. Not empty. **It never asks** — `pages-2` fetches only on
`create.done` or a row's `Changed`.

⚠️ **Both arms are on one fixture now**, which is the cheapest reproduction this has ever had:
`SBR-017 Sign In Drive` showed its row immediately after `New page` and showed nothing after a
sign-in. **Create-then-look works; arrive-and-look does not.** Any drive that creates a page first
cannot see this, which is how s9, s12 and s13 all missed it.

🔴 **It blocks SBR-017 AC1's second half** — *"reach `/admin/pages` with the rows visible"*. The
owner reaches it; the rows are not there; and nothing in SBR-017 can fix that.

## Where the ACs now stand

| | verdict | evidence |
|---|---|---|
| **SBR-017 AC1** | 🟡 | §6.2 — sign out **53 ms**, sign back in **82 ms**, `/admin/pages` reached. Rows missing, and that is SBR-016 (§6.4) |
| **SBR-017 AC2** | ✅ | §6.2 step 5 — wrong password, **114 ms** refusal, `--destructive`, path unchanged. Structural half gated |
| **SBR-017 AC3** | ✅ | §6.2 step 4 — the **words**, asserted by name in the gate and observed |
| **SBR-017 AC4** | ✅ | `sb007Template.test.ts` §8, five specs, router-walk + mutant |
| **SBR-015 AC1/2/3** | ✅ | s13, §2.3d |
| **SBR-015 AC4** | 🟡 | `execution_steps` 0 rows — the task says why, and it is right |
| **SBR-006 AC1/AC2** | 🟡 | blocked on SBR-008 (rows still carry no title or slug) |
| **SBR-006 AC3/AC4/AC5** | ✅ | s9, s12, s13 |

## What s14 built, in one paragraph

`/Pages/SignIn` at `admin/signin` — email, password, `net.noodl.user.LogIn`, a constant refusal on
a `States` node that **resets**, and `RouterNavigate` into the panel on `done`. **`failure`, never
`completed`** — `completed` fires on every outcome and would raise the refusal on the successful
sign-in too, which would make AC2's two paths one screen while the drive still passed its first
arm. `/Admin/Shell` gains a `Sign out` rail item and the signed-out sentence, both driven from one
`net.noodl.user.User`'s `authenticated` — one through an `Inverter`, so the two are opposite by
construction. `/Pages/Setup` gains one link forward.

🔴 **The scope call SBR-017 §3 asked for: Setup cannot refuse before signing anyone up.** Refusing
early means asking *"is this site claimed yet?"* — the oracle SB-004 F7 removed on purpose, and
there is no endpoint that answers it. The link is the half that actually helps: the owner who lands
on `/admin/setup` because it is the only screen mentioning their account now has somewhere else to
go, so the commonest way a roleless second `_User` gets created stops happening. The account
factory itself is a **backend** setting (signup is open by default) and stays recorded as one.

## 🔴 Read this before any drive of the preview

**The editor's preview pane gives the viewer webview a `96 × 0` viewport.** Every CDP click into it
reports success, arrives `isTrusted: true` with the coordinates you asked for, and hit-tests to
`<html>` — `document.elementFromPoint` returns `null` outside the visual viewport, and every
control in the page is outside it. `getBoundingClientRect()` answers normally the whole time, so
the element's box and the element's reachability disagree and only one of them is being read.

✅ **`Emulation.setDeviceMetricsOverride` on the viewer target, on the same connection as the
clicks.** `npm run cdp` opens a connection per invocation and the override dies with it, so a drive
needs its own small script that connects once and does the whole arm.
`Emulation.setFocusEmulationEnabled` belongs there too and is **not sufficient alone** — with it
only, `document.activeElement` stayed at `BODY`.

⚠️ Also: `npm run cdp -- screenshot --target=viewer` **hangs** on the webview target, and
`location.href = '/admin/setup'` does not reach a page — the Router resets the path to `/` on load.
`window.Noodl.Navigation.navigateToPath(...)` is what works.

## Standing context

- 🔴 **Drive fixtures — do not overwrite.**
  **`SBR-017 Sign In Drive`** (backend `backend_mte82r1qhnr87`, port 8599, secret
  `SITE_SETUP_TOKEN=drive-token-017`, owner `owner@sbr017.test` / `drive-pass-017`) is the only
  fixture minted from a template that **has a sign-in page**, and it holds one `Page` row and a
  claimed site. It is the right fixture for SBR-016.
  **`SBR-015 AC1 Drive`** (`backend_mte62ofkj8whc`, 8598, `drive-token-ac1`,
  `owner@ac1.test` / `drive-pass-ac1`) is SBR-015's, left in the **refusal** arm —
  `Section.pageId` renamed to `pageId_hidden`; rename it back for the success arm.
  **`SBR-015 Zero Section Drive`** (`backend_mte3mrsp5qtbd`) and **`SBR-006 Admin Drive`**
  (`backend_mtdg3sdziq5nw`) are both **pre-fix** and cannot test anything current.
- 🔴 **A project is a copy of the template at mint time.** Any template change needs a **freshly
  minted** project to drive; re-driving an old fixture re-measures the old defect and reads as a
  regression. Verify the copy on disk before driving — `components/<Path>/connections.json`.
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify as written; if the
  platform cannot express what an AC asks for, **say so and record the gap**.
- ⚠️ **`test:ci` was not run in s14** — no editor, runtime or MCP *source* was touched, only the
  MCP test-data modules and the generated artefact. The noodl-mcp jest suites `sb005AdminPanel`,
  `sb006PublicSite` and `sb007Template` were run: **130 passed, 0 failed**, and
  `npm run typecheck:mcp` is clean. s10's floor stands (**2889 specs, 4 failures, all
  `AIX-006 style vocabulary` by name**).
- Census pins that moved in s14, deliberately: **21 → 22** components, **5 → 6** registered pages,
  **9 → 13** component references, **4 → 5** `Page` nodes.
- Shared checkout: **pathspec commits only, never `git add`**; announce editor launches **and**
  teardowns; `test:ci` alone, never beside a live stack.
- ⚠️ **The launcher's `Connect GitHub` sits at the top-right of the header, close to where a
  mis-resolved selector lands.** s14 opened its device-code flow by accident and cancelled it;
  nothing was authorised. Cancel needs the **hittable** copy — `BaseDialog` renders a measuring
  ghost, and `elementFromPoint` is what tells them apart.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
