# Sign-in for the local backend

The standalone NodeGX backend (`nodegx-backend`) can sign your app's users in
three ways: username + password (which it always could), an **identity
provider** — Google, GitHub, or any OpenID Connect issuer — and a **magic
link** emailed to an address. All three issue the same session, governed by the
same permissions. The full design record is
[`dev-docs/tasks/phase-22-production-backend/BAK-004-OAUTH-PASSWORDLESS.md`](../../dev-docs/tasks/phase-22-production-backend/BAK-004-OAUTH-PASSWORDLESS.md).

> This is about the **end users of an app you build**. It is unrelated to the
> editor's own `noodl://` sign-in to NodeGX cloud.

## The two things you must know

**1. There is one generic OpenID Connect implementation, not a provider
matrix.** Google is a preset. Keycloak, Authentik, Microsoft Entra ID, Auth0,
Okta and GitLab are *configuration* — you supply an issuer URL and the backend
reads everything else from that issuer's discovery document. GitHub is the one
exception with bespoke code, because GitHub is OAuth2 but not OIDC. If a
provider speaks OIDC, it already works; if it does not, it is out of scope.

**2. Linking a provider to an existing account can revoke that account's
password.** This is deliberate and it closes a real attack. See
[Account linking](#account-linking) — read that section before you enable
providers on a backend that already has password users.

## Setting up a provider

In the editor: **Backend Services → (your backend) → Sign-in**. On a deployed
backend with no editor: the served dashboard's **Sign-in** view. For an agent:
`configure_backend_auth_provider` over MCP. All three edit the same
`/admin/auth` surface.

Before anything else, set the backend's **Base URL** (in the Email section — it
is the backend's one canonical public origin, shared by email links and OAuth
callbacks). The callback URL is derived from it, and a callback URL built on
the local fallback `http://127.0.0.1:<port>` will not work from anywhere but
your own machine. The panel says so loudly if you have not set it.

Then, for every provider, the same three steps:

1. Add the provider here, with its client id and secret.
2. **Copy the callback URL the panel shows you** and paste it into the
   provider's console. Do not type it from memory — a redirect-URI mismatch is
   the most common and most time-consuming way this fails, and the provider's
   error message blames you rather than explaining.
3. Enable it.

### Google

Console: <https://console.cloud.google.com/apis/credentials>

1. **Create credentials → OAuth client ID → Web application.**
2. Under **Authorized redirect URIs**, add the callback URL from the panel —
   `https://api.yourapp.com/oauth/google/callback`.
3. Copy the client ID and client secret into the panel, preset **Google**.

Google asserts `email_verified` honestly, so accounts link by email (see
below). Nothing else is needed; scopes default to `openid email profile`.

### GitHub

Console: <https://github.com/settings/developers>

1. **New OAuth App** — an *OAuth App*, not a GitHub App. They are different
   things with different flows, and only the former works here.
2. **Authorization callback URL**: the callback URL from the panel —
   `https://api.yourapp.com/oauth/github/callback`.
3. Copy the Client ID, generate a client secret, paste both in with preset
   **GitHub**.

Three GitHub facts worth knowing, because each one produces a confusing failure
if it is wrong:

- The `user:email` scope is **required**. GitHub's public profile email is
  usually null; the real address comes from a second API call that needs this
  scope. Without it, sign-in fails with a clear message rather than silently
  creating an account with no address.
- GitHub OAuth Apps do not support PKCE. The flow is protected by `state`, the
  flow-binding cookie and the client secret instead. This is normal.
- Only an address GitHub marks **verified** is treated as verified. An account
  whose only address is unverified can still sign in — it just will not link to
  an existing account.

### Any other OpenID Connect issuer (Keycloak shown)

Preset **Other OpenID Connect issuer**. You need two things: the issuer URL and
a client.

For Keycloak, with realm `myrealm` on `https://sso.example.com`:

1. In the Keycloak admin console: **Clients → Create client**, client type
   **OpenID Connect**, a client ID of your choosing.
2. **Client authentication: On** (this is a confidential, server-side client).
3. **Valid redirect URIs**: the callback URL from the panel.
4. **Credentials** tab → copy the client secret.
5. In the NodeGX panel: issuer `https://sso.example.com/realms/myrealm`, plus
   that client ID and secret.

The issuer must be **exactly** what the provider publishes as its `issuer`
value, including any path. The backend fetches
`<issuer>/.well-known/openid-configuration` and refuses to start a sign-in if
the document declares a different issuer than the one you configured — that
mismatch is either a typo or a mix-up attack, and either way it is better as an
error at setup time.

Authentik, Auth0, Okta, Entra ID and GitLab all follow the same five steps with
their own console wording.

## Magic links

Passwordless sign-in by email. It needs **both** its own switch (Sign-in →
Magic links) and working SMTP ([Email](./BACKEND-EMAIL.md)) — the panel reports
which one is missing.

Behaviour worth stating explicitly, because it looks like a bug otherwise:

- `POST /auth/magic-link` **always answers 200**, for a known and an unknown
  address alike. It is a public anonymous endpoint, and one that answered
  differently would be an account-existence oracle. Whether mail was actually
  sent is in the server log, never in the response.
- Your UI should therefore say *"if that address has an account, a link is on
  its way"*, not *"check your inbox"*. A UI that appears to know hands back the
  oracle the endpoint just removed.
- A link is single-use and short-lived (15 minutes by default, capped at 24
  hours). Anyone who opens it is signed in, so the shipped email template says
  not to forward it.

## Wiring it into your app

Two nodes, in the **Cloud Services** group:

- **Sign In With** — a `Provider` input and a `Do` signal. Triggering it
  navigates the browser away, so nothing downstream of `Do` runs.
- **Request Magic Link** — an `Email` input and a `Do` signal.

The return leg is handled for you. When the provider sends the browser back,
the runtime picks up a one-time code from the URL, exchanges it for a session,
strips the code from the address bar, and updates every **User** node — with no
page code of your own. A Sign In With node *on the page the user returns to*
fires `Success` or `Failure` so you can react; put one on both the page they
leave from and the page they land on (usually the same page, which is what the
`Redirect` input defaults to).

To render a set of sign-in buttons dynamically, `GET /auth/providers` lists
what a backend offers — id, label and start URL, no secrets, and a provider
that is enabled but incompletely configured is absent rather than broken.

### The redirect allow-list

If your app is served from the **same origin** as the backend (the single-origin
deploy WF-003 produces), you need nothing here.

If it is served from a different origin, add that origin to **Sign-in →
Redirect allow-list** or every sign-in is refused before it starts. The backend
will only redirect a completed sign-in to its own origin or to a listed one.
That check is not bureaucracy: an unvalidated redirect on an auth callback is
the delivery mechanism for a phishing chain whose last hop is a genuine login on
a genuine domain.

## Account linking

When someone signs in with a provider for the first time, the backend has to
decide which local account — if any — that entitles them to. The rule, in order:

1. **A subject we have seen before** signs into its own account. The provider's
   immutable subject id is the identity, never the email, so a user who changes
   their address keeps their account.
2. **An unverified provider email** is treated as decoration. It never matches
   an existing account. It creates a new one, or — if some account already holds
   that address — is refused with an explanation.
3. **A verified email nobody holds** creates a new, verified, passwordless
   account.
4. **A verified email on an account that has verified its own address** links.
   Both sides have proven control; the password keeps working. This is the
   ordinary "I signed up last year, I'm using Google today" case.
5. **A verified email on an account that has NEVER verified its own address**
   links, *and that account's password and sessions are revoked*.

Rule 5 is the one to read twice. The attack it closes is **account
pre-hijacking**: an attacker registers `you@example.com` with a password of
their choosing before you ever arrive. Later you sign in with Google, the
provider verifies the address, and a naive implementation cheerfully attaches
your identity to the attacker's account — which they can still log into, and
which now contains your data. Revoking the credentials of an unverified account
at the moment someone *proves* control of its address hands the account to the
person who can actually receive its mail.

The cost is real: an honest user who signed up with a password on a backend that
never verifies addresses, and later signs in with a provider, loses their
password and must reset it. That is the safe direction to be wrong in, it
happens exactly once per account, the user is told (`authNotice` on the
exchange, surfaced by the Sign In With node's `Notice` output), and every
occurrence is in the audit trail as `auth.link.credentials-revoked`.

You can turn linking off entirely (**Sign-in → Account linking**), in which case
case 4 and 5 both become refusals. You cannot turn rule 5 into "link anyway,
keep the password" — a configurable takeover vector is still a takeover vector.

### Unlinking

`GET /users/me/identities` lists what an account can sign in with;
`DELETE /users/me/identities/:id` removes one. Removing the **last** way into an
account is refused: an account with no password and no identity is unreachable,
and "unlink" quietly meaning "destroy my access" is not an acceptable reading of
that button.

Removing a *provider* (as an operator) keeps existing identity rows, so
re-adding the same provider id restores sign-in for those accounts. While it is
absent, users with no password and no other provider cannot get in.

## How it works, briefly

```
app ──▶ GET /oauth/<provider>/start?redirect=…
             │  sets a flow-binding cookie, remembers PKCE verifier + nonce
             ▼
        provider's consent screen
             │
             ▼
        GET /oauth/<provider>/callback?code=&state=
             │  checks state, checks the cookie, exchanges the code,
             │  VERIFIES the ID token's signature against the issuer's JWKS,
             │  applies the linking rule, issues a session
             ▼
app ◀── 302 …?nodegx_auth=<one-time code>
             │
             ▼
        POST /oauth/exchange { code }  →  user + sessionToken
```

Design points that are load-bearing rather than incidental:

- **The session token never appears in a URL.** The callback hands over a
  one-time code (single use, two-minute lifetime) which the app exchanges over
  a POST. The runtime strips it from the address bar before anything else runs.
- **PKCE on every OIDC flow**, confidential client or not.
- **The ID token's signature is always verified** against the issuer's published
  JWKS, along with `iss`, `aud`/`azp`, `exp` and `nonce`. The spec permits a
  confidential client to skip the signature check on a direct TLS channel; this
  backend does not take that exemption, and there is no fallback path that skips
  it. Only asymmetric algorithms are accepted — an `HS256` ID token is refused.
- **A flow-binding cookie** (`HttpOnly`, `SameSite=Lax`, scoped to `/oauth`)
  ties the callback to the browser that started it. Without it, `state` alone
  lets an attacker complete their own flow in your browser and log you into
  *their* account.

## Operating it

- **Rate limits.** Starting a sign-in, exchanging a code, and requesting a magic
  link each have their own budget, stricter than the general `auth` class. A 429
  carries `Retry-After`. See [Operations](./BACKEND-OPERATIONS.md).
- **Audit.** `auth.signin` records every provider/magic-link sign-in;
  `auth.link.credentials-revoked` records every rule-5 event;
  `auth.provider.update` / `auth.provider.delete` / `auth.config.update` record
  operator changes.
- **Metrics.** `nodegx_auth_pending_flows` counts sign-ins started but never
  completed. A number that only grows is almost always a redirect-URI mismatch.
- **Secrets.** Client secrets live in `<dataDir>/secrets.json` (mode 0600) under
  the `auth` namespace, never in the diffable `auth.json`, and are never
  returned by any read surface. Reads report `hasClientSecret` instead.

### Honest limits

- **Single process.** In-flight sign-ins and handoff codes live in memory, like
  every other short-lived state in this service. A restart mid-sign-in costs the
  user a retry. Behind two replicas without sticky sessions, OAuth would not
  work at all.
- **No provider API access.** This is identity only. Provider access tokens are
  used to establish who someone is and are then discarded — there is no "call
  the Google Calendar API on the user's behalf". That is integration territory,
  which is [permanently parked](../../dev-docs/tasks/phase-19-cloud-workflows/README.md).
- **No refresh against the provider.** Sessions are ordinary NodeGX sessions
  with their own lifetime; the provider is consulted once, at sign-in.
- **No MFA/TOTP, SAML or enterprise SSO** beyond what OIDC covers.
- **Reachability.** `/oauth/*` and `/auth/*` must be reachable at the public
  origin your callback URL names. The shipped nginx and Caddy configs forward
  both; a hand-rolled proxy must too, or the provider redirects the user to a
  404 and blames the redirect URI.

## Reference

| Route | What it is |
|-------|-----------|
| `GET /auth/providers` | Public. What this backend offers. |
| `GET /oauth/:provider/start?redirect=` | Begins a sign-in. Navigates. |
| `GET /oauth/:provider/callback` | Where the provider returns the browser. |
| `POST /oauth/exchange` | Trade the one-time code for a session. |
| `POST /auth/magic-link` | Request a link. Always 200. |
| `GET /auth/magic-link/callback?token=` | The click. |
| `GET /users/me/identities` | What this account can sign in with. |
| `DELETE /users/me/identities/:id` | Unlink one. |
| `GET`/`PUT /admin/auth` | Policy: magic links, allow-list, linking. |
| `PUT`/`DELETE /admin/auth/providers/:id` | One provider. |

Config lives in `<dataDir>/auth.json` (diffable, deploys with the backend) and
`<dataDir>/secrets.json` (machine-local, never committed).
