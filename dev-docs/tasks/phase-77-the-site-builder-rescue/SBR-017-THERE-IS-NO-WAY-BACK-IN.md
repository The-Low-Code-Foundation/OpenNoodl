# SBR-017 — There is no way back in

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
2. **A negative control**: a wrong password shows a refusal sentence and does not navigate.
   The refused and the accepted paths must not be the same screen.
3. A signed-out visitor to `/admin/pages` is told they are signed out — the words are
   asserted, not the absence of rows. ⚠️ This AC cannot be graded while SBR-016 is open;
   sequence them.
4. A gate over the artefact: the template contains a `net.noodl.user.LogIn`, reachable from a
   page component registered in the router.

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
