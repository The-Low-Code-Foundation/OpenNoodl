# BCN-006: Auth Across Five Backends & the Token Lifecycle

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BCN-006 |
| **Phase** | Phase 34 — One Backend Contract (Track S) |
| **Tier** | 2 — the adapters |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🔴 Hard — the only part of the phase that is new machinery rather than a port |
| **Estimated Time** | 2–2.5 weeks |
| **Prerequisites** | BCN-001, BCN-004 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — the token lifecycle is a design with no precedent in this codebase and expensive-to-reverse consequences for every deployed app. The per-backend endpoint work under it is Opus-tier |

## Objective

The eleven user nodes work against all five backends through `IAuthAdapter`, with a session and token
lifecycle that survives short-lived access tokens and refresh rotation — which Parse's model has nothing
to teach us about.

## Background

Richard's framing was right: *"I don't see why the auth node can't be a surface that accesses one of
multiple ways of doing Auth."* Auth ports better across these backends than almost anything else in the
matrix — every one of the five does password login, signup, password reset and email verification, and
four of five do OAuth.

`UserService` is already the surface: ten methods,
[userservice.ts](../../../packages/noodl-viewer-react/src/nodes/std-library/user/userservice.ts), 626
lines, consumed by eleven nodes (`Log In`, `Log Out`, `Sign Up`, `User`, `Set User Properties`, `Request
Magic Link`, `Request Password Reset`, `Reset Password`, `Send Email Verification`, `Verify Email`, `Sign
In With`).

**But this is the one task where the Parse family is not a good template**, and the reason is not in the
node layer at all:

> Parse's session model is a token in `localStorage['Parse/<appId>/currentUser']` that never expires.
> Directus, Supabase and PocketBase all issue short-lived access tokens with refresh rotation.

So the adapter must own refresh scheduling, request queueing while a refresh is in flight, refresh
failure → logout, and the cross-tab case. **None of that exists to be ported.** It is the single largest
hidden line item in the phase, and it is why this task is Fable-tier and two-and-a-half weeks rather
than one.

## Current State

| Piece | State |
|---|---|
| `UserService` | 10 methods, Parse-wire, singleton |
| Session storage | `localStorage['Parse/<appId>/currentUser']`, read directly by `cloudstore.js:80` |
| Token expiry | none — Parse session tokens do not expire |
| Refresh | does not exist |
| `nodegx-backend` auth | `src/auth/` — OIDC, GitHub, identities, flow store, redirect handling (BAK-004) |
| BYOB auth | **none.** No auth nodes work against Directus, Supabase or PocketBase today |
| Magic link | ours and Supabase; PocketBase has OTP; Directus and Parse have neither |
| OAuth | ours (BAK-004), Parse `authData`, Directus SSO, Supabase, PocketBase — four different redirect shapes |

The `BYOB auth: none` row is the user-facing headline. A project on Directus today has data nodes and no
login.

## Desired State

### 1. `IAuthAdapter` with five implementations

The ten methods, mapped per backend:

| Contract | Parse / NodeGX | Directus | Supabase | PocketBase |
|---|---|---|---|---|
| `logIn` | `/login` | `/auth/login` | `/auth/v1/token?grant_type=password` | `/api/collections/users/auth-with-password` |
| `signUp` | `/users` | `/users` (permissioned) | `/auth/v1/signup` | `/api/collections/users/records` |
| `logOut` | clear session | `/auth/logout` | `/auth/v1/logout` | clear store |
| `fetchCurrentUser` | `/users/me` | `/users/me` | `/auth/v1/user` | `/api/collections/users/auth-refresh` |
| `requestPasswordReset` | ✅ | `/auth/password/request` | `/auth/v1/recover` | `/request-password-reset` |
| `resetPassword` | ✅ | `/auth/password/reset` | via recovery token | `/confirm-password-reset` |
| `sendEmailVerification` / `verifyEmail` | ✅ | ⚠️ instance-dependent | ✅ | `/request-verification` / `/confirm-verification` |
| `requestMagicLink` | ✅ | ❌ | ✅ | OTP |
| `signInWithProvider` | authData | SSO | ✅ | `auth-with-oauth2` |

Every cell that is not a plain ✅ is a descriptor entry with a builder-facing reason.

### 2. The token lifecycle, designed once

Owned by the adapter layer, not by nodes and not by each backend implementation:

- **Refresh scheduling** ahead of expiry, not on 401 — a 401-triggered refresh turns every expiry into a
  visible failure for whatever request lost the race.
- **Single-flight refresh with request queueing.** Concurrent requests during a refresh must queue, not
  each trigger their own rotation. With rotating refresh tokens, parallel refreshes invalidate each
  other and log the user out.
- **Refresh failure is a logout**, surfaced through the `User` node's existing outputs so app graphs can
  react. It must not be silent and it must not be a thrown error nobody catches.
- **Cross-tab.** Two tabs, one rotating refresh token, is the classic way to log a user out at random.
  Decide the policy (a storage-event lock is the usual answer) and write it down.
- **SSR.** RUN-002 ships server-side rendering; a token lifecycle that assumes a browser will break it.
  Declare what auth means during a server render before implementing.

### 3. The user record is normalised

`_User` / `directus_users` / `auth.users` / the PocketBase users collection all describe a person
differently. The contract exposes `id` and `email` plus schema-driven dynamic ports for the rest, the
same way BCN-004 generalised record ports. `Set User Properties` then works everywhere without
per-backend node code.

### 4. Nothing is silently missing

`Request Magic Link` on a Directus project is a disabled node with "Directus has no magic-link login",
not a node that emits nothing. This is the phase's central promise and auth is where it is most visible.

## Implementation Steps

1. **Design the token lifecycle first, in prose** — scheduling, single-flight, failure, cross-tab, SSR —
   and circulate. It is the expensive-to-reverse decision.
2. `IAuthAdapter` + the Parse-wire implementation, moving `UserService`'s body with no behaviour change,
   the way BCN-002 moved `CloudStore`. Session storage moves into the adapter and `cloudstore.js`'s
   direct `localStorage` read is repointed at it.
3. Implement the lifecycle for token-based backends, with the queueing and single-flight properties
   under test using injected timers — the `byob-realtime.js` precedent (injectable WebSocket/timers,
   fully unit-testable) is the pattern to copy.
4. Directus, Supabase, PocketBase adapters against the endpoint table.
5. OAuth redirect handling per backend. Four shapes; the existing `signinwith.ts` +
   `_stripAuthParamsFromUrl` handles one of them. BAK-004's redirect/flow-store work is the reference.
6. Normalise the user record; schema-driven dynamic ports on `User` and `Set User Properties`.
7. Descriptor cells + gating hooks for BCN-010.
8. **Live pass per backend**: sign up → verify email → log out → log in → let the access token expire
   with the app open → confirm a silent refresh → reset password → OAuth round-trip where supported.
   **The expiry step is the one that matters** and it needs a backend configured with a short token TTL,
   not a mocked clock.

## Success Criteria

- [ ] All eleven user nodes work against all five backends, or are gated with a stated reason.
- [ ] The token lifecycle is designed in prose and circulated before implementation.
- [ ] Refresh is scheduled ahead of expiry; a 401 is not the trigger.
- [ ] Concurrent requests during refresh queue behind a single-flight rotation — under test with
      injected timers, **and** observed live with a short-TTL backend.
- [ ] Refresh failure produces an observable logout through the `User` node.
- [ ] The cross-tab policy is decided, implemented and documented.
- [ ] What auth means under SSR is declared, and RUN-002's server render still works.
- [ ] `Set User Properties` works with schema-driven ports on every backend.
- [ ] A live pass per backend including a real token expiry with the app open.

## Out of Scope

- **Unifying permissions.** Phase decision. Authenticating a user is in scope; what that user may read
  is the backend's own model.
- **`nodegx-backend` auth features.** BAK-004 shipped OAuth and passwordless; this task consumes them.
- **Provider-by-provider OAuth setup guidance.** OPS-010 owns walking a user through creating a Google
  OAuth client.
- **Account linking policy.** BAK-004 has one (linking revokes unverified accounts' passwords, by
  design); it is ours and is not imposed on other backends.
- **Session sharing between backends.** A project with two backends has two sessions. Do not invent
  single-sign-on across a user's unrelated services.

## Traps

- **This is the task where "port the Parse family" stops being the strategy.** Parse tokens do not
  expire, so every lifecycle question has no precedent in this repo. A plan that budgets this task like
  BCN-004 will be wrong by a week.
- **Rotating refresh tokens punish parallelism.** Two in-flight refreshes invalidate each other and the
  symptom is a user randomly logged out — intermittent, unreproducible, and it will be blamed on the
  backend.
- **A 401-driven refresh looks correct in testing** because a single request retries cleanly. It fails
  under concurrency and on the first slow network.
- **`cloudstore.js` reads the session directly from `localStorage`** (`:80`). Until that is repointed,
  the data adapter and the auth adapter have two views of who is logged in.
- **Supabase's anon key and a logged-in user's JWT are both `Authorization` bearers** and confusing them
  gives a user either no access or everyone else's. The adapter must be explicit about which token a
  given request carries.
- **Email delivery is not ours on four of five backends.** A failing verification email on Supabase is
  their SMTP config; the error must say so rather than pointing at BAK-002's email subsystem, which is
  only ours.
- **Editor CDP driving traps apply to the live pass**: `--target=editor` silently attaches to the
  preview window; use `--target=dashboard`, launch detached, and never `cdp reload`.