---
title: "Sign In With"
---
Signs a user in via an identity provider (Google, GitHub, any OpenID Connect issuer) configured on the backend. Redirects away.

Sign In With drives BAK-004's redirect flow. Triggering `signIn` (Do, signal) sends the whole browser to the backend's `/oauth/<provider>/start`, which redirects on to the identity provider — so nothing downstream of `Do` runs, and the graph on that page is torn down. The provider sends the user back to the URL given in `redirect` (defaulting to the page they left) carrying a one-time code, which the runtime's user service exchanges for an ordinary session before any node sees it. On that LATER page load this node fires `done` (signal) or `failure` (signal) with `error` (string value); `signingIn` (boolean value) is true while the exchange is in flight. `notice` (string value) is set in the one case where a sign-in succeeds but the user should be told something: the backend linked this identity to an existing account whose email address had never been verified, and removed that account's old password.

## When to use it

For 'Sign in with Google/GitHub/SSO' buttons on an app served by a NodeGX backend. Configure the provider first in the Backend Services panel's Auth section (or via MCP) — a provider that is not configured refuses the redirect with an explanation rather than sending the user to a broken provider page. Use Log In for username/password, Request Magic Link for passwordless email, and the User node to read who is signed in.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `net.noodl.user.SignInWith` |
| Available in | browser |
| SSR compatibility | partial — Sign-in is a browser redirect; a server render can lay the button out but never completes a flow. |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `provider` | String | — | Id of the sign-in provider to use, as the backend lists it |
| `redirect` | String | — | Page the provider should return to; leave blank to come back to the page sign-in started from |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `signIn` | Signal | — | Hands over to the provider, which navigates the browser away — nothing downstream of this runs |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `notice` | String | — | Something the user should be told about a sign-in that nevertheless succeeded, such as an old password having been revoked |
| `signingIn` | Boolean | — | True while a sign-in started on an earlier page load is still being exchanged |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires on the page the provider returned to, once the session has been established |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last sign-in failed; empty until one does |
| `failure` | Signal | — | Fires when the sign-in did not complete, after the reason has been reported on the error channel |

## Patterns

- Put the node on both the page the user leaves from and the page they come back to — `Do` on the first, `done`/`failure` on the second. Pointing `redirect` at the same page makes one node do both.
- `done` → navigation, `error` → a Text node's `text`: the whole flow in three connections.
- `signingIn` → a Group's `visible`: the return leg is a network round trip, so there is a real moment to cover.

## Watch out for

- Wiring anything downstream of `Do` and expecting it to run — the page is gone.
- Reading logged-in state from `done` alone; the User node's `authenticated` boolean is the state, and it also covers sessions restored on reload.
- Hard-coding an app URL in `redirect` that is not on the backend's redirectAllowList — the refusal happens at the start of the flow, not the end.

## Related nodes

[User](./net-noodl-user-user.md), [Log In](./net-noodl-user-log-in.md), [Request Magic Link](./net-noodl-user-request-magic-link.md), [Log Out](./net-noodl-user-log-out.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
