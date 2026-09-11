# Auth Pages — configuring it

Four page components behind a `Page Router` named **Auth**:

| Page | URL path | Built on |
|---|---|---|
| `Sign In` (start page) | `sign-in` | `Log In` |
| `Sign Up` | `sign-up` | `Sign Up` |
| `Forgot Password` | `forgot-password` | `Request Password Reset` |
| `Reset Password` | `reset-password` | `Reset Password` |

Every page has labelled inputs, inline error text wired from the auth node's
`Error` output (shown on `Failure`, cleared on the next submit), a submit button
that disables itself and changes its label while the request is in flight, and
links to the other pages. Focus order follows the visual order: inputs, then the
submit button, then the links.

## What you must wire after install

1. **A backend with users.** All four auth nodes talk to the project's cloud
   services backend. Without one, every submit fires `Failure` and the inline
   error shows the connection error.

2. **Where to go after sign-in.** Sign In and Sign Up both fire a **Send Event**
   on channel **`Auth Success`** when the user is signed in (Sign Up signs the
   new user in automatically). Add an **Event Receiver** on channel
   `Auth Success` wherever it suits your app — typically next to your main
   router — and wire `Received` to a `Navigate` node pointing at your
   post-login page. Nothing navigates on success until you do this.

3. **The reset email.** `Request Password Reset` makes the backend send an
   email containing a reset token. Point the link in that email template at
   your app's Reset Password page and carry the token and username as query
   parameters:

   ```
   https://your-app.example/reset-password?token={TOKEN}&username={USERNAME}
   ```

   The Reset Password page reads `token` and `username` with a `Page Inputs`
   node and feeds them to the `Reset Password` node. After a successful reset
   it navigates back to Sign In.

## Conventions this prefab uses

- **Email is the username.** Sign Up wires the email input to both `Username`
  and `Email`, and Sign In sends the email as `Username`. If your user base has
  separate usernames, add a username input on both pages and rewire.
- The router's start page is Sign In. Change `startPage` on the **Auth
  Router** node inside the `Auth Pages` component if you want a different
  landing page.
- All colours are design-token references (`var(--primary)`,
  `var(--destructive)`, …), so the pages pick up your project's theme; no fonts
  are bundled — text renders in the project's default (Inter in a new project).
