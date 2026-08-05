# CWF-010 — Hash, random, UUID and JWT, as nodes

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) §6 rows 1–2, approved 2026-08-05.
**Status:** open, unowned. **Depends on [CWF-009](CWF-009-THE-SECRET-NODE.md)** for the signing key —
build the hash half without it, the JWT half after it.

## The engine is already there — this is about making it visual

Measured (TALK-007 §3.1), inside a real cloud function: `crypto` is present with **`crypto.subtle`**
and `crypto.randomUUID`, `Buffer` works (`Buffer.from('hi').toString('base64')` → `"aGk="`),
`TextEncoder` and `btoa` are present, and a real `crypto.subtle.digest('SHA-256', …)` completed.
Node 22. **No dependency is needed for anything in this task** — and if one is proposed, that is the
signal something was mis-scoped.

So the cost here is node design, port shape and error behaviour. Not algorithms.

## Slices

### Slice 1 — Hash

- Inputs: value, algorithm (enum: SHA-256, SHA-384, SHA-512), encoding (hex | base64 | base64url).
- Output: the digest.
- ⚠️ **A declared `default` never runs its setter** (the repo's single most-repeated trap — see
  [NODE-PATTERNS](../../reference/NODE-PATTERNS.md)). Algorithm and encoding both need their default
  applied in `initialize`, not only declared.
- ⚠️ MD5/SHA-1 are **not** in WebCrypto's digest set and must not be added by hand. If someone needs
  MD5 for a legacy checksum, that is a Function node's problem, not a node we ship.

### Slice 2 — HMAC

Separate from Hash because it takes a key, and a key comes from CWF-009. Inputs: value, key,
algorithm, encoding. This is also what HS256 signing is underneath, so build it before slice 4 and
have JWT use it.

### Slice 3 — Random Bytes and UUID

- **UUID**: `crypto.randomUUID()`. ⚠️ There is already a **`Unique Id`** node in the cloud list (§1).
  Find out what it emits before shipping a second one — if it is already a UUID v4, this slice is
  *documentation*, not a node. If it is a short id, say so on both nodes' pages so the choice is
  legible.
- **Random Bytes**: length + encoding, `crypto.getRandomValues`. The one thing to get right is that
  it must never fall back to `Math.random()` — a silent downgrade here is a security defect, and
  `Math.random()` is *the* thing people reach for.

### Slice 4 — JWT Sign / JWT Verify

Two nodes.

- **Sign**: claims (object), key, algorithm (HS256 first; RS256 second), expiry. HS256 is slice 2's
  HMAC plus base64url framing.
- **Verify**: token, key, algorithm → verified boolean, claims, failure signal. Verify must check
  **`exp`, `nbf` and `alg`** — an implementation that decodes and trusts is worse than none, and
  `alg: none` acceptance is the classic defect. Write the test that feeds it `alg: none` and a
  token signed with the wrong key.
- RS256 needs `crypto.subtle.importKey` with a PEM — still no dependency, more surface. Second
  slice, not first.

⚠️ **Verify is the node that matters for Richard's original ask** — *"grabbing a JWT to authenticate
the user in the backend"*. Note that the Request node **already** resolves the caller from the
session token and outputs `Authenticated` and `User Id` (TALK-007 Pile C). JWT Verify is for
*someone else's* tokens — a partner's webhook, an OIDC id_token — not for our own sessions. Say that
on the node's page or it will be used for the wrong thing.

## Done when

- Each node driven in a real cloud function, output checked against a known-good vector (not against
  our own other node — that proves consistency, not correctness).
- JWT Verify rejects: expired, not-yet-valid, wrong key, `alg: none`, and a tampered payload.
- Nothing new in `package.json`.

## Traps

- ⚠️ **`crypto.subtle` is async.** These nodes must resolve before their Success signal fires — the
  Function node's `AsyncFunction`/await shape is the precedent (`simplejavascript.ts` runScript).
  A node that fires Success before the digest lands will pass a single-node test and fail in a graph.
- ⚠️ **Browser or cloud?** Hash, UUID and Random Bytes work in both and belong in the shared
  runtime. **JWT Sign belongs in the cloud only** — signing in a browser means the key is in the
  browser. Register accordingly and state the reason on the node page.
- ⚠️ `Buffer` is Node-only. Anything shared must use `TextEncoder`/`btoa`, not `Buffer`.
