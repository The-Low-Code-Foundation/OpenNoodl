# SBR-017 — There is no way back in

> 🟢 **BUILT AND DRIVEN, 2026-08-29 (s14). ALL FOUR ACs MET as of s15.** AC2, AC3 and AC4 were met
> in s14 — §6 has that drive. **AC1's second half was blocked by SBR-016, not by this task**: the
> owner signed back in, reached `/admin/pages`, and the list was empty while the *same session* read
> the row over HTTP in 2 ms (§6.4). SBR-016 was fixed in s15 and the whole sequence re-driven; AC1
> is now met in full.

**Found by SBR-015's drive (s12, 2026-08-29).** The site-builder template contains exactly
one authentication node in twenty-one components: `SignUp`, on `/Pages/Setup`. There is no
`Log In` anywhere. An owner who claims their site and later loses their session cannot get
back into their own admin panel.

## 1. The person sentence

**An owner who comes back tomorrow signs in and carries on.** Today, if the session is gone,
there is no screen that will take their password — and the one screen that mentions their
account, `/admin/setup`, cannot help them, because the site is already claimed.

## 2. The evidence

Every node in `site-builder.content.json` whose type mentions user, auth, login or sign-in:

| component | node | type |
|---|---|---|
| `/Pages/Setup` | `signup` | `net.noodl.user.SignUp` |
| `/#__cloud__/claimSite` | `grant` | `noodl.cloud.addusertorole` |

That is the whole list. `net.noodl.user.LogIn` exists in the runtime and ships in the node
library; the template never places it.

### 2.1 Why `/admin/setup` is not the escape hatch

The Setup page signs a **new** account up and then calls `claimSite`. **Measured on the drive
backend, 2026-08-29**, against a site already claimed by `owner@sbr015.test`:

| step | result |
|---|---|
| `POST /users` — a second account | **201**, a real `_User` row **and a session token** |
| `POST /functions/claimSite` with the **correct** token | **400** `This site cannot be claimed.` |

So the visitor is refused — correctly — having just created a second `_User` row that is in no
role and can read nothing. 🔴 **The refusal is right and the outcome is still a locked door.**
⚠️ Note in passing, not this task's row: signup is open on this backend by default, so the
Setup page is a working account factory for anyone who finds `/admin/setup`.

### 2.2 What it looks like from the admin's side

Every admin screen's data is `role:admin`-gated, so a signed-out visitor to `/admin/pages`
gets the shell and no rows — which, per **SBR-016 §2.2**, is the same screen as an empty
list and the same screen as a list that never asked. So the person is not even told that
signing in is the problem.


## 6. 🟢 The drive — 2026-08-29 (s14)

**A person who loses their session gets back in, in 82 ms.** Sign-out lands them on a screen that
takes a password; the wrong one is refused on that screen; the right one reaches the panel.

### 6.1 The fixture, and why a fresh one was necessary

🔴 **A project is a copy of the template taken at mint time**, so no existing fixture could test
this: every one of them was minted before `/Pages/SignIn` existed and would have re-measured the
old defect. `SBR-017 Sign In Drive` was minted from the regenerated artefact through the launcher's
own template flow, and the copy was verified on disk *before* driving —
`components/Pages/SignIn/nodes.json` holds the `net.noodl.user.LogIn` and
`connections.json` holds all **8** edges.

- Project: **`SBR-017 Sign In Drive`** (`~/vscode_projects/NodeGX test projects/`)
- Backend: **`backend_mte82r1qhnr87`**, port **8599**, wizard-created with the project
- Secret: `SITE_SETUP_TOKEN` = `drive-token-017`, provisioned through the Secrets panel
- Owner: `owner@sbr017.test` / `drive-pass-017`, claimed through `/admin/setup` in this session
- One page created through the New page dialog, so the list had a row to show

### 6.2 The sequence, in the order AC1 asks for

| # | act | result |
|---|---|---|
| 1 | claim through `/admin/setup` | lands on `/admin/pages`; **`Sign out` appears in the rail** |
| 2 | create a page | row renders — `Draft`, `Edit`, `More`, and the count sentence |
| 3 | **click `Sign out`** | **53 ms** → `/admin/signin`, the form and *"Not set up yet? Claim this site."* |
| 4 | visit `/admin/pages` signed out | **`You are not signed in. Sign in to manage this site.`** — AC3 |
| 5 | sign in, **wrong** password | **114 ms** → *"That email and password did not match."*, **path stays `/admin/signin`** — AC2 |
| 6 | sign in, right password | **82 ms** → `/admin/pages`, rail shows `Sign out`, notice gone |
| 7 | the list | 🔴 **empty** — see §6.4 |

### 6.3 The control pair the two `mounted` wires earn

One reading of *"is anybody signed in"*, two opposite consequences, and **each is present in
exactly one arm** — which is what says the wires are doing the work rather than the defaults:

| | `Sign out` in the rail | the signed-out sentence |
|---|---|---|
| signed in (steps 1, 6) | **present** | absent |
| signed out (step 4) | **absent** | **present** |

The sentence renders `rgb(220, 38, 38)` — `--destructive` — at 16 px, 796 × 19 css px, inside the
viewport. The refusal on the sign-in page renders the same colour at 14 px, 1036 × 17, and is
`mounted` so it takes no space before the first attempt (measured absent at step 5's start).

### 6.4 🔴 AC1's second half is blocked by SBR-016, and here is the control that says so

The panel showed **no rows** after signing back in. The reading that separates *"refused"*,
*"empty"* and *"never asked"* — SBR-016's three pixel-identical states — was taken **from inside
the running app, on the session the panel itself holds**:

```
GET http://localhost:8599/classes/Page
X-Parse-Session-Token: <the panel's own token>
→ 200, 1 row, 2 ms
```

So the row exists, the owner may read it, and the panel does not ask. **SBR-016, reproduced on a
second backend with a stronger control than the original** — the earlier reading was "0 requests
after load", which is consistent with a query that was refused; this one is the same principal
succeeding at the same moment.

⚠️ **The same fixture carries both arms of SBR-016 at once**, which is worth keeping: at step 2 the
list *did* render its row, because `pages-2` fetches on `create.done`. Create-then-look works;
arrive-and-look does not. Any drive that creates a page first cannot see this — which is how s9,
s12 and s13 all missed it.

### 6.5 Two defects re-observed, independently

- **SBR-008** — the created `Page` row has `objectId/createdAt/updatedAt/ACL/published/showInNav/navOrder`
  and **no `title`, no `slug`** (read off the 200 above).
- **DEF-015** — the backend card read **"pushed just now"** while still warning that
  `site/ContactRecipient`, `site/CopySectionToPage` and `site/SetSectionAccess` were *"in the
  project, not on this backend"*. Third sighting, on a backend minutes old.

### 6.6 🔴 A harness trap that cost this session twenty minutes, and will cost the next one too

**The editor's preview pane gives the viewer webview a `96 × 0` viewport.** Every CDP click into it
reported success, arrived `isTrusted: true` with the coordinates asked for, and hit-tested to
`<html>` — because `document.elementFromPoint` returns `null` outside the visual viewport, and
every control in the page was outside it. `getBoundingClientRect()` answered normally throughout,
so the element's box and the element's reachability disagreed and only one of them was being read.

✅ **`Emulation.setDeviceMetricsOverride` on the viewer target**, on the same connection as the
clicks, is the fix — it gives the *running* app a viewport to be clicked in and changes the
geometry, not the graph. It must be sent on the **same connection** as the clicks — `npm run cdp`
opens one per invocation and the override dies with it, so a drive needs its own small script that
connects once and does the whole arm. `Emulation.setFocusEmulationEnabled` belongs there too, and
is necessary but **not sufficient**: with focus emulation alone `document.activeElement` stayed at
`BODY`.

⚠️ Two more, cheaper: `npm run cdp -- screenshot --target=viewer` **hangs** on the webview target
(no compositor), and `location.href = '/admin/setup'` does **not** reach a page — the Router resets
the path to `/` on load. `window.Noodl.Navigation.navigateToPath(...)` is what works.


## 3. Scope

- In **`packages/noodl-mcp/tests/sb005Components.ts`** (where `/Pages/Setup` and `/Admin/Shell` already live): a sign-in page (`/Pages/SignIn`, `urlPath: admin/signin`) — email, password,
  `net.noodl.user.LogIn`, a refusal sentence, and `RouterNavigate` to `/Pages/Admin` on
  success. It is the Setup page minus the token and minus `claimSite`.
- `/Admin/Shell` — a "Sign out" affordance (`net.noodl.user.LogOut`) so the state is
  reachable deliberately rather than only by accident. ⚠️ Do not add sign-out without adding
  sign-in first; that is the trap this task exists to close.
- **A decision, not a default:** what an admin screen does for a signed-out visitor. Redirect
  to `/admin/signin`, or render "You are not signed in" with a link. Either is fine; the
  current answer — a shell with nothing in it — is not.
- Whether `RequestPasswordReset` belongs in 0.2.1 or later. It is a *second* lockout, and
  the template ships no email configuration, so this is a scope call rather than a build.
- Regenerate the artefact (`npm run template:site-builder`).

## 4. Acceptance criteria

1. **(person)** On a claimed site, sign out and sign back in with the owner's email and
   password, and reach `/admin/pages` with the rows visible. **Driven**, in one session, in
   that order.
   🟡 **Half met, and the half that is not belongs to SBR-016.** Driven in that order, in one
   session — sign out **53 ms**, sign back in **82 ms**, `/admin/pages` reached. **The rows are
   not visible**, and the control in §6.4 shows the row is readable by that very session in 2 ms:
   the panel never asks. Nothing in this task can make it.
   ✅ **UNBLOCKED AND FULLY MET, 2026-08-29 (s15).** SBR-016 is fixed, and the same sequence was
   driven again on a fresh fixture (`SBR-016 Arrive Drive`): sign out **31 ms** → `/admin/signin`;
   wrong password **113 ms**, path unchanged; right password **85 ms** → `/admin/pages` **with the
   row on screen**, and a request spy showing `POST /login` then `POST /classes/Page` since the
   click. The cause was never in this task: the NDA-017 migration was silencing the page list's
   load-time fetch. See [SBR-016 §7](SBR-016-THE-LIST-THAT-NEVER-ASKS.md).
2. **A negative control**: a wrong password shows a refusal sentence and does not navigate.
   The refused and the accepted paths must not be the same screen.
   ✅ **Met** — §6.2 step 5. `That email and password did not match.` at **114 ms**, `--destructive`,
   and `location.pathname` stays `/admin/signin`. The structural half is gated
   (`sb007Template.test.ts` — success navigates, refusal reveals, and `completed` is wired
   nowhere, because `completed` would raise the refusal on the successful sign-in too).
3. A signed-out visitor to `/admin/pages` is told they are signed out — the words are
   asserted, not the absence of rows. ⚠️ This AC cannot be graded while SBR-016 is open;
   sequence them.
   ✅ **Met, and the sequencing warning turned out to be unnecessary — because the AC asks for
   words.** `You are not signed in. Sign in to manage this site.` is asserted by name in the gate
   and observed in §6.2 step 4, and it is legible whatever the list is doing. It was AC1, not AC3,
   that SBR-016 blocked.
4. A gate over the artefact: the template contains a `net.noodl.user.LogIn`, reachable from a
   page component registered in the router.
   ✅ **Met** — `sb007Template.test.ts` §8, five specs. The walk starts at the Router's own
   `routes`, closes over what those pages **place**, and asks whether the LogIn is inside that set;
   the mutant removes the one route and it reds. Navigation targets are deliberately not followed —
   a page reachable only by a `RouterNavigate` is the defect one step along.

## 5. Traps

- 🔴 **`claimSite` is a control for SBR-015 and must stay one.** This task adds a page; it
  must not touch the claim path.
- 🔴 **A second signup on a claimed site succeeds** — measured, §2.1 — and leaves a roleless
  `_User` row. If the sign-in page is added without changing Setup, `/admin/setup` remains a
  working account factory that grants nothing. Decide whether Setup should refuse *before*
  signing anyone up.
- ⚠️ Signup logs the new user in, which is why the s9 and s12 drives never noticed the gap:
  claiming and being signed in were one act.
- ⚠️ A drive that keeps one browser session alive cannot see this. The reproduction is a
  reload after the session is cleared.
