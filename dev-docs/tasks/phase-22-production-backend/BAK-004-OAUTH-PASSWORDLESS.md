# BAK-004: OAuth & Passwordless Sign-In

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BAK-004 |
| **Phase** | Phase 22 — Production Backend (Revival Track H) |
| **Tier** | 2 — parity |
| **Priority** | 🟡 Medium (commodity feature — wins no one, but its absence loses people) |
| **Difficulty** | 🟠 Medium–High |
| **Estimated Time** | 2–3 weeks |
| **Prerequisites** | BAK-002 (email/base-URL), BAK-003 (sessions, model, secrets convention) |
| **Branch** | `task/bak-004-oauth-passwordless` (not used — work landed directly on `cline-dev`) |
| **Status** | ✅ **Complete 2026-07-27** — as-built notes: [BAK-004-NOTES.md](./BAK-004-NOTES.md) |
| **Recommended executor** | 🟠 **Opus 4.8** — OAuth's failure modes (state, PKCE, account linking, provider quirks) are opaque and security-sensitive; the design space is narrowed below. |

## Objective

Let app end-users sign in with an identity provider (generic OIDC, with Google and GitHub as first-class configurations) or a passwordless email magic link — both issuing the same sessions BAK-003 governs, configured per backend, and authorable by agents.

## Background

Every modern BaaS ships social login; classrooms in particular live on "sign in with Google" because it eliminates the password-reset support burden entirely. The scope trap is the provider matrix — Appwrite maintains 30+ adapters. We refuse it: **one generic OIDC implementation** (authorization-code + PKCE, server-side) covers Google, Microsoft, GitLab, Keycloak, Authentik and most of the long tail by configuration rather than code; GitHub (not fully OIDC) gets the one bespoke adapter, doubling as the template if a genuinely-demanded non-OIDC provider ever earns its keep. Magic links reuse BAK-002's token-and-email plumbing almost entirely.

Note the existing `noodl://` scheme is the *editor's* OAuth (NodeGX cloud sign-in) — unrelated. This task is about *deployed apps'* end users; the flow is plain web redirects on the app's own origin.

## Current State

- Sessions, users, login/signup: WF-004's Parse-wire subset; password only.
- No OAuth code anywhere in the backend path; no `_AuthProvider`-style linkage on user records.
- BAK-002 (prerequisite) provides: base-URL setting, email templates, single-use token infra, secrets convention.
- Client-side: login/signup nodes exist; nothing initiates a redirect flow.

## Desired State

- **Provider config** per backend (config-stored, MCP-editable): for OIDC — issuer URL, client id/secret, scopes, display name; toggles for allow-signup vs. existing-users-only. Google/GitHub presented as presets over the same shape.
- **Flow**: `GET /oauth/<provider>/start?redirect=<app-path>` → provider → `GET /oauth/<provider>/callback` → verify (state + PKCE + nonce) → find-or-create user → issue session token → redirect back to the app with the token delivered the way the runtime's userservice can consume (decide the handoff — fragment vs. one-time code exchange — against what the client can implement cleanly; record it).
- **Account model**: an identities structure on the user (provider, subject, email) supporting multiple providers per user. **Linking rule (pre-decided):** auto-link on verified-email match, else create; unverified provider emails never auto-link (account-takeover vector). Record it.
- **Magic link**: request via email → BAK-002-style single-use token → callback issues session. Same anti-enumeration + rate limits as password reset.
- **Client surface**: a **Sign In With** node (provider port, initiates redirect; resolves session on return) and a magic-link request node — catalog entries, MCP-visible. The runtime handles the return leg (token pickup on load) without hand-written page code.
- **Editor UX**: provider list + config in the Backend Services panel's auth section (one-panel constraint), including the computed callback URL displayed for copy-paste into provider consoles.
- Sessions issued are ordinary BAK-003 sessions — same expiry, same invalidation, same ACL behavior; `signUpAllowed` and BAK-002's verification policy are respected (OIDC-verified emails count as verified).

## Scope

### In Scope
- [x] Generic OIDC (auth-code + PKCE, server-side; discovery-document driven) + Google preset + GitHub adapter
- [x] State/nonce/PKCE hygiene; token handoff decision recorded and implemented in the runtime — plus a flow-binding cookie the spec did not ask for, which is what actually closes login CSRF
- [x] Identity linkage model + linking rule + tests for the takeover vectors
- [x] Magic-link flow atop BAK-002 — routed through the SAME linking rule, so there is no second path to find a gap in
- [x] Sign In With + magic-link nodes, catalog entries, MCP surface for provider config
- [x] Panel UX incl. computed callback URLs — in the editor panel, the served dashboard, and every MCP write response
- [x] Unlink/list identities on the user (`/users/me` extension) — unlinking the last way in is refused
- [x] Docs: per-preset setup walkthroughs (Google, GitHub, generic OIDC w/ Keycloak as the example) — `docs/runtime/BACKEND-AUTH.md`

### Out of Scope
- A provider adapter library beyond GitHub — generic OIDC is the product decision
- SAML, enterprise SSO, MFA/TOTP (phase-level parked)
- Editor-login OAuth (`noodl://` — untouched)
- Token refresh against providers / calling provider APIs on behalf of users (identity only; API access is integration territory, permanently parked per Phase 19)

## Implementation Steps

1. **Record the two decisions** (token handoff; linking rule) with rationale.
2. **Generic OIDC** against a local Keycloak in tests — discovery, start, callback, hygiene.
3. **Identity model + linking**, takeover-vector tests.
4. **Google preset, GitHub adapter.**
5. **Magic links.**
6. **Runtime nodes + return-leg handling; panel; MCP; catalog.**
7. **Docs + live verification** against real Google/GitHub apps on a deployed instance.

## Success Criteria

- 🟡 On a deployed backend: sign in with Google end-to-end from the stock node — **proven headlessly against a real OIDC provider over real HTTP** (`auth-oidc-http.test.ts`: new user created, ordinary session, `/users/me` works). A run against Google's own servers on a public origin is the task's one residual.
- [x] Same user later signs in with GitHub using the same verified email → one account, two identities; an *unverified* provider email does not link (`auth-linking.test.ts`, `auth-github.test.ts`)
- 🟡 Keycloak (generic OIDC, no preset) works by configuration alone — the suite drives the generic path with **no preset applied** against a real discovery document, real PKCE and real JWKS signatures. Keycloak itself was not run; see the deviation in the notes.
- [x] Magic link signs in a user with no password ever set; rate-limited; anti-enumeration holds
- [x] Forged/replayed state or code is rejected and recorded — nine distinct ID-token forgeries, state replay, handoff replay, and login CSRF, each refused; sign-ins and credential revocations land in the audit trail
- 🟡 An agent can configure a provider via MCP and wire the node — proven against a real spawned backend (`backendTools.test.ts`). The docs have not been followed cold by someone with a provider console.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Account takeover via linking | The pre-decided rule + explicit vector tests; unverified emails never link |
| Token handoff leaks (history/referrer/logs) | Decide handoff with leakage as the first criterion; one-time code exchange preferred if the client can do it |
| Provider quirks (GitHub non-OIDC, Google verified-email claims) | GitHub is bespoke by design; Google preset encodes its quirks; generic path stays pure OIDC |
| Redirect URI misconfig burns hours | Panel displays the exact callback URL; docs show provider-console screenshots |
| Scope creep toward provider-API integrations | Identity only — hard line, stated in scope |

## References

- [BAK-002](./BAK-002-EMAIL-SUBSYSTEM.md) — base URL, tokens, templates, secrets convention
- [BAK-003](./BAK-003-ACCESS-CONTROL.md) — sessions and the model these flows feed
- [WF-004](../phase-19-cloud-workflows/WF-004-BACKEND-SERVICE.md) — wire subset the session issuance extends
- OIDC core + PKCE RFCs; Pocketbase auth methods — prior art for config shape

## Checklist

- [x] Handoff + linking decisions recorded ([BAK-004-NOTES.md](./BAK-004-NOTES.md))
- [x] OIDC generic + Google + GitHub; magic links
- [x] Identity model + takeover tests
- [x] Nodes + catalog + MCP + panel (+ the served dashboard)
- 🟡 Live-provider verification on a deployed instance (**residual**); docs ✅; CHANGELOG ✅
