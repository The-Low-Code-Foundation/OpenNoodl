---
title: "Request Magic Link"
---
Asks the backend to email a one-click sign-in link. Succeeds identically whether or not the address has an account.

Request Magic Link posts `email` (string value) to the backend's `/auth/magic-link` when `send` (Do, signal) is triggered. The backend mails a single-use, short-lived link; clicking it signs the user in on the page named by `redirect` (defaulting to the page the request was made from), where the runtime picks up the one-time code and establishes an ordinary session. `done` (signal) means THE REQUEST WAS ACCEPTED — never that an account exists. The endpoint answers identically for known and unknown addresses on purpose, because a public endpoint that answers differently is an account-existence oracle. `failure` (signal) with `error` (string value) means the request itself failed: no backend configured, a network error, or the rate limit.

## When to use it

For passwordless sign-in, and as a password-free recovery path on backends that use provider sign-in. Requires the backend to have SMTP configured (BAK-002) and magic links enabled in the Auth section — with either missing, the request is still accepted and no mail is sent, which is deliberate anti-enumeration and shows up in the backend's log rather than in the app.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `net.noodl.user.RequestMagicLink` |
| Available in | browser |
| SSR compatibility | partial — Sends a request from the browser; a server render never triggers it. |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `email` | String | — | Address to send the sign-in link to |
| `redirect` | String | — | Page the link should return to; leave blank to come back to the page the request was made from |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `send` | Signal | — | Asks the backend to email a one-click sign-in link to Email |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the request has been accepted, which never means an account exists for that address |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last request failed; empty until one does |
| `failure` | Signal | — | Fires when the request itself failed — no backend, no network, or rate limited — never because the address is unknown |

## Patterns

- Text Input `text` → `email`, Button `onClick` → `send`, `done` → a neutral confirmation message.
- Put a Sign In With node on the landing page named by `redirect` so the app can react to the click's outcome.

## Watch out for

- Showing 'check your inbox' only when the account exists — this node cannot tell you that, and a UI that appears to know re-creates the oracle the backend removed.
- Treating `done` as 'signed in'. The sign-in happens when the user clicks the link, on a later page load.

## Examples

**Sign in with a emailed link, or with Google**

Two ways past the password field, and both have a behaviour that decides how the screen around them must be built. Request Magic Link posts the address and the backend mails a single-use, short-lived link; `done` means THE REQUEST WAS ACCEPTED and never that an account exists — the endpoint answers identically either way, deliberately, because a different answer would turn the sign-in form into a way to test whether somebody has an account here. So the message on `done` has to be 'if that address has an account, a link is on its way', and a screen that says 'check your inbox' for one address and 'no such user' for another has reintroduced exactly the leak the endpoint is avoiding. Sign In With is more drastic: triggering it NAVIGATES THE BROWSER AWAY to the provider, so nothing downstream of that signal runs and the graph on this page is torn down mid-flight. Treat it as the end of the flow, not a step in it — there is no 'after' to wire, and a spinner set by the same click is a spinner nobody ever sees stop. `signingIn` is the output for the brief moment before the redirect. Both take a `redirect` that must be same-origin with the backend or on its redirect allow-list; an off-list target means no mail is sent and no provider round trip starts, which is a configuration failure that looks exactly like nothing happening. Provider ids ('google', 'github', or whatever the operator named their OIDC provider) come from the backend, not from this graph. One wiring detail that catches people: `done` is a SIGNAL, and a signal wired straight into a value input like `visible` is played as true and then false in the same pass, so the confirmation would flash and vanish. A Switch latches the pulse into remembered state, which is what 'we have sent it' actually is.

## Related nodes

[Sign In With](./net-noodl-user-sign-in-with.md), [User](./net-noodl-user-user.md), [Log In](./net-noodl-user-log-in.md), [Request Password Reset](./net-noodl-user-request-password-reset.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
