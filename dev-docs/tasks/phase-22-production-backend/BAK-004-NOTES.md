# BAK-004 — OAuth & Passwordless Sign-In: as-built notes

**Status:** Complete 2026-07-27. Every in-scope item shipped. The one success
criterion that cannot be met headlessly — a sign-in against *real* Google and
GitHub apps on a *deployed* instance — is the task's single residual and is
listed at the bottom with everything else.

Spec: [BAK-004-OAUTH-PASSWORDLESS.md](./BAK-004-OAUTH-PASSWORDLESS.md).
User docs: [`docs/runtime/BACKEND-AUTH.md`](../../../docs/runtime/BACKEND-AUTH.md).

---

## The two decisions the spec asked to be recorded

### Decision 1 — the token handoff: a one-time code in the query

The callback must move a session token from this server into a page on the
app's origin, and it has only a redirect to do it with. Three candidates:

| Option | Rejected because |
|---|---|
| Session token in the query | It is a long-lived credential and URLs reach history, referrers, proxy logs and screenshots. Never seriously considered. |
| Session token (or code) in the **fragment** | Fragments never reach a server, which is genuinely better on leakage — but **Noodl apps can use hash routing**, where `#…` belongs to the Router. A token pickup that fights the router is a bug that appears only in some projects and is miserable to diagnose. A fragment is also readable by every script on the page for the page's whole lifetime. |
| **One-time code in the query, exchanged over POST** ✅ | The code is single-use, server-side, and lives two minutes. The runtime strips it with `history.replaceState` before anything else runs, so it does not survive into history or a refresh. Its extra exposure over a fragment buys an attacker a value that is already spent. |

Chosen: `?nodegx_auth=<code>` → `POST /oauth/exchange` → `{…user, sessionToken}`.
The exchange response is deliberately **the same shape `/login` returns**, so the
client stores it through the one code path it already had.

Leakage was the first criterion, as the spec's risk table asks. The fragment
wins on that axis alone; it loses on the axis specific to this product, and the
one-time code closes most of the gap.

### Decision 2 — account linking, and why rule 5 is destructive

Full statement in [`src/auth/identities.ts`](../../../packages/nodegx-backend/src/auth/identities.ts)'s
module doc and in the user docs. The short form, in order:

1. Known `(provider, subject)` → sign in. The subject is the identity, never the
   email — emails get reassigned and corporate addresses get recycled.
2. Provider says the email is **not verified** → never match an existing
   account. Create, or refuse if the address is taken.
3. Verified email nobody holds → create, verified.
4. Verified email on an account that has verified its own address → link,
   password preserved.
5. Verified email on an account that has **never** verified its own address →
   link, **and revoke that account's password and every session**.

Rule 5 closes **account pre-hijacking**: an attacker registers the victim's
address with a password they choose, before the victim arrives. A naive
implementation later attaches the victim's verified Google identity to the
attacker's account, which the attacker can still log into. Proving control of
the address at link time is the moment to hand the account to whoever can
actually receive its mail.

The cost is disclosed rather than hidden: an honest user who signed up with a
password on a backend that never verifies addresses loses that password once.
It is reported in the exchange response (`authNotice`), surfaced by the node's
`Notice` output, and written to the audit trail as
`auth.link.credentials-revoked`.

**Why not create a second account instead of refusing on a collision:** BAK-002's
`/requestPasswordReset` resolves an address with `findUserBy('email', …)` and
takes the first row. Two accounts sharing an address make password reset target
an arbitrary one — a quiet, permanent, extremely confusing failure.

`linking.autoLinkVerifiedEmail: false` turns rules 4 and 5 into refusals. There
is deliberately **no** setting that means "link anyway, keep the password": a
configurable takeover vector is still a takeover vector.

---

## Two more decisions worth the same treatment

### The flow-binding cookie (login CSRF)

`state` proves a callback belongs to a flow *this server started*. It does not
prove it belongs to *this browser's* flow. An attacker can start their own flow
and hand the victim the resulting callback URL, logging the victim into the
attacker's account — where their subsequent activity lands in an account the
attacker controls.

`/start` therefore sets `nodegx_oauth_flow`: `HttpOnly`, `SameSite=Lax`,
`Path=/oauth`, `Secure` only when `baseUrl` is https (hard-coding `Secure` would
silently break every local http setup, and the browser dropping a cookie is not
a failure mode that explains itself). Both legs are top-level GET navigations on
the backend's origin, which is exactly what `SameSite=Lax` permits — so this
works with the app on a different origin. Two concurrent sign-ins in two tabs
overwrite each other's cookie and the older one fails; accepted and documented.

### The ID token signature is verified, with no fallback

OIDC Core §3.1.3.7 lets a confidential client that received the ID token over a
direct TLS channel to the token endpoint skip signature verification. We do not
take it. Not for purity: the exemption's safety rests entirely on the TLS
validation of a `fetch()` several modules away, which is an invisible,
silently-breakable dependency standing in for a check that can be explicit and
tested. So the signature is checked against the issuer's JWKS every time, and
there is **no fallback path** — a fallback is how verification quietly stops
happening.

Only asymmetric algorithms are accepted (RS/PS/ES 256/384/512). `HS256` with the
client secret is legal OIDC and is refused anyway: it turns a signature check
into a shared-secret check, and every serious provider offers RS256.

PKCE is sent on every OIDC flow despite this being a confidential client — it
also closes authorization-code injection (RFC 9700 §2.1.1) and costs one hash.

---

## What shipped

### Backend (`packages/nodegx-backend`)

| Module | What it is |
|---|---|
| `src/auth/model.ts` | Provider/policy shapes, validation, the three presets (`google`, `github`, `oidc`) as **data**, so the panel, the dashboard and MCP all offer the same thing. |
| `src/auth/AuthConfigState.ts` | `auth.json` + the `auth` namespace of the shared `secrets.json`. Nothing ever reads a client secret back; reads report `hasClientSecret`. |
| `src/auth/oidc.ts` | Discovery (cached 1h), PKCE, the authorization URL, the token exchange, and JWKS ID-token verification with the full claim set (`iss`, `aud`/`azp`, `exp`, `iat`, `nonce`). |
| `src/auth/github.ts` | The one bespoke adapter, plus a documented `GITHUB_ENDPOINTS` test seam. |
| `src/auth/identities.ts` | `_UserIdentity` and the linking rule. |
| `src/auth/FlowStore.ts` | Pending flows and handoff codes — in memory, TTL'd, and **capped**, because `/start` is anonymous and each call allocates. |
| `src/auth/redirect.ts` | The redirect allow-list, including the `//evil.example` case. |
| `src/auth/http.ts` | Time- and size-bounded outbound calls to providers, with no retries (a token exchange is single-use; a retry produces a confusing second failure). |
| `src/server/oauth-routes.ts` | The seven public routes plus the two identity routes. |
| `src/server/admin-auth.ts` | `/admin/auth` — the one model behind three fronts. |
| `src/server/mini-page.ts` | The handful of HTML pages this API serves, extracted so escaping is written once (BAK-002's copy folded in). |

Also: `magicLink` joined BAK-002's template set; `_EmailToken` gained `email`
and `redirectUrl` so a signup magic link can exist before its user does;
`_UserIdentity` joined the system tables; the `auth` route class gained seven
patterns; three audit actions were declared and two more are raised by the
handler; `nodegx_auth_pending_flows` joined `/metrics`; and startup now warns
about an enabled-but-incomplete provider and an `http://` issuer on a public
bind.

### Runtime (`packages/noodl-viewer-react`)

`UserService` picks the return leg up **in its constructor, before the
stale-session check** — a page load carrying a fresh sign-in is not a page load
with a dead session, and running the check first fired `sessionLost` at the
exact moment the user succeeded. It strips the code from the URL *before*
attempting the exchange, so a refresh cannot retry a spent code.

Two nodes, both in Cloud Services: **Sign In With** (a launcher *and* a
receiver — triggering it navigates away, so the outcome arrives on a later page
load) and **Request Magic Link**. Both have catalog enrichment; the enrichment
spends most of its words on the two things a graph author will otherwise get
wrong: nothing downstream of `Do` runs, and magic-link success does not mean the
account exists.

### Surfaces

- **Editor**: Backend Services → Sign-in (`views/panels/auth`), plus four
  `backend:*Auth*` IPC handlers. One-panel constraint respected.
- **Served dashboard**: an Access → Sign-in view.
- **MCP**: `get_backend_auth_config`, `list_user_identities` (read);
  `configure_backend_auth_provider`, `remove_backend_auth_provider`,
  `configure_backend_auth_policy` (write).

All three exist to do one thing a JSON editor cannot: **show the callback URL**.
The redirect-URI mismatch is the most expensive mistake in OAuth setup and it is
entirely avoidable by never asking a human to assemble that string.

---

## Tests

| Suite | Covers |
|---|---|
| `auth-oidc-http` (28) | The whole flow over real HTTP against a **real OIDC provider** (`tests/helpers/fake-oidc-provider.ts` — an actual server with an actual RSA keypair, real discovery, real PKCE verification, real signatures). Then nine forgeries, each disabling exactly one check: foreign key, `alg:none`, `HS256`, unknown `kid`, wrong `aud`, wrong `azp`, wrong `iss`, expired, replayed `nonce`. Plus login-CSRF (missing and mismatched cookie), state replay, handoff single-use, redirect refusals. |
| `auth-linking` (19) | All five linking rules end to end, the pre-hijacking vector (attacker's password AND live session both dead afterwards), the three gates (linking off / provider signup off / backend `signup: nobody`), and the magic-link flow including anti-enumeration and rule 5 through the same path. |
| `auth-github` (10) | Email selection, plus the whole GitHub flow against a stand-in that **enforces** the three quirks — it 403s a request with no User-Agent, returns failures as HTTP 200, and 403s `/user/emails` without the scope. |
| `auth-config` (27) | Redirect authorisation (incl. `//`, look-alike hosts, `javascript:`), config validation, secrets never leaving `secrets.json`, and one live check that the rate limits actually bite. |

Totals, all green: **nodegx-backend 61 suites / 619 passed / 10 skipped**;
**noodl-runtime 30 / 696**; **noodl-mcp 5 / 68** (against a real spawned
`dist/cli.js`); **noodl-editor 1429 specs / 0 failures**. Typecheck clean in all
four. `catalog:check` green; the bundle builds; the viewer bundle carries both
new nodes.

A **live curl pass against the built `dist/cli.js`** covered 15 properties:
provider listing with and without config, the preset round trip, the secret
being unreadable, the 302 with PKCE and the flow cookie, both redirect
refusals, the unknown-provider 404, the no-flow callback (and its cookie
clear), the unknown-code refusal, magic-link 200-while-disabled, the operator
landing page, the dashboard feature flag, the on-disk split between `auth.json`
and mode-0600 `secrets.json`, and the metrics gauge.

---

## Defects found and fixed along the way

1. **`--port 0` made every generated link say `http://127.0.0.1:0`.** The
   local-URL fallback used the *requested* port, not the bound one. Every test
   and the editor's own spawned backends use port 0, so this affected OAuth
   callback URLs, magic links **and BAK-002's password-reset links** — which had
   been wrong since BAK-002 shipped. Nothing crashed; the links were simply
   unusable, and no test had ever read a generated URL back on a port-0 backend.
   Found by the live pass, fixed at the `HttpServer` level for all three
   consumers, with a regression test.
2. **`emailVerified === true` was always false.** SQLite has no boolean type and
   the adapter returns `1`. Harmless-looking almost everywhere, and here it
   would have sent *every already-verified account* down rule 5 and destroyed its
   password. Caught by the linking tests before it shipped; `isFlagSet()` now
   exists with a comment long enough to find. The same mistake in BAK-002's
   verification re-request (an already-verified user got another email every
   time they asked) is fixed with it.
3. **The dashboard's inline script had no syntax check.** It is one large script
   that esbuild inlines as *text* and no compiler ever reads; a stray bracket
   would ship a 200 that renders a blank page and passes every other assertion.
   A `new Function(source)` parse guard now exists.
4. **Rate-limit refusals in the auth handlers had no `Retry-After`.** The message
   carried the number, the header did not. Caught by its own test.

## Deliberate deviations from the spec

- **No "link a provider while signed in".** The spec asks for list and unlink on
  `/users/me`, which shipped. Explicit linking would need a session token in a
  top-level navigation's query string, which is the one place this task has been
  careful to keep credentials out of. Rule 4 already covers the ordinary case
  (verified addresses join automatically), so the gap is narrow. Scoped
  follow-up, not a silent omission.
- **Keycloak is stood in for by a real local OIDC provider.** A Keycloak
  container is not a dependency a unit suite can take, and mocking would test
  the mock — the interesting parts (discovery, PKCE, signature) vanish when
  stubbed. The stand-in speaks real OIDC over a real socket with a real keypair,
  and the code path it exercises is the generic one with no preset applied, which
  is the path Keycloak takes. Verified-against-Keycloak-itself remains residual.

---

## Residuals

1. **No sign-in has been performed against a real Google or GitHub app on a
   deployed instance.** This needs provider-console access and a public origin.
   It is the spec's headline success criterion and the top residual. Everything
   the backend can verify about itself is verified; what is unverified is
   whether a real provider's real quirks match the ones this code expects.
2. **Nobody has opened the editor's Sign-in panel or the dashboard's Sign-in
   view in a browser.** Every server-side property behind them is tested; the
   rendered UI is not. Shared with BAK-005's standing residual.
3. **The nodes have not been run in a live app.** They compile, register, and
   are in the built viewer bundle; a graph has not been authored with them.
4. **Multi-tab sign-in** overwrites the flow cookie, failing the older tab.
   Known, documented, not fixed.
5. **Single-process only.** In-flight flows and handoff codes are in memory, so
   a restart mid-sign-in costs a retry and two replicas without sticky sessions
   would not work at all. Consistent with the phase's documented single-node
   stance, not an oversight.
6. **Explicit provider linking from account settings** — see the deviation
   above.
