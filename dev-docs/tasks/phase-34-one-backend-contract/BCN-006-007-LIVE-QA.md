# BCN-006 & BCN-007 — live QA

**Run 2026-07-31 from the primary checkout at `440ba3dd`**, in the **preview window** against a
**running `nodegx-backend`** started from the Backend Services panel (`http://localhost:8579`,
app id `backend_ms94j6xso72rl`).

This closes the two items [BCN-009-LIVE-QA-PARTIAL](./BCN-009-LIVE-QA-PARTIAL.md) §4 listed as
still owed:

- **BCN-006** — *"login → log out → sign up → reset password. The XHR branch every viewer runs is
  reached by no unit test."*
- **BCN-007** — *"a real upload against a running backend. `contentType`/`size` are asserted from
  a literal fixture and **no 201 has ever been observed**."*

Both are now observed. **A 201 exists and carries both fields — and the graph never sees them.**

Method is BCN-002 §6.2's: the real editor, its own backend started from the panel, and the real
`Noodl.*` API driven in the **preview window** over CDP. That is the only way to reach
`ParseAuthAdapter`'s browser branch, because Node has no `XMLHttpRequest`.

---

## 1. BCN-006 — the auth flows, live

| Flow | Result |
|---|---|
| `signUp` | ✅ resolved, 116ms |
| `logOut` | ✅ resolved, 3ms; `Noodl.Users.Current` → `undefined` |
| `logIn` | ✅ resolved, 107ms; `Current` repopulated, same `id` |
| `logIn` with a **wrong password** | ✅ **rejects** with the string `"Invalid username/password."` |
| …and the existing session survives it | ✅ still logged in afterwards |
| `POST /requestPasswordReset` | ✅ **HTTP 200** |

The error arrives as a **string**, not an error object, exactly as `UserServiceCallbacks`
documents — which is what lets the user nodes wire it to a `string` output port. Verified rather
than assumed.

### 1.1 ⚠️ `Current.email` is undefined after `signUp` and populated after `logIn`

Reproduced twice, cleanly, on a fresh user each time:

```
after signUp : email=undefined                     emailVerified=undefined  username="qb15067985"
after logIn  : email="qb15067985@example.com"      emailVerified=undefined  username="qb15067985"
after fetch  : email="qb15067985@example.com"      emailVerified=undefined
```

The email **was supplied to `signUp`**. An app that signs a user up and immediately shows *"we
sent a link to {email}"* — the single most ordinary thing to do after a sign-up — renders
`undefined`. It works after a login, which is why this survives casual testing.

`emailVerified` is **never populated**, not even after an explicit `Current.fetch()`. Any graph
gating on "has this user verified their address" reads `undefined` forever on this backend.

`api/users.ts:152-155` copies both straight off the user model, so the gap is upstream of the
facade — the sign-up response does not put them there and the login response does.

### 1.2 `requestPasswordReset` is not on the public API at all

`Noodl.Users` exposes `logIn`, `signUp`, `become`, `on`, `off`, `Current`. There is no
`requestPasswordReset`, and `api/users.ts:90-92` says so deliberately:

> *Deprecated, use cloud functions instead. `requestPasswordReset`, `resetPassword`,
> `sendEmailVerification` and `verifyEmail` were commented out here long before this conversion;
> the corresponding nodes still exist.*

So the reset flow is reachable **only through its node**, never from a script node. The wire
itself answers `200` on `POST /requestPasswordReset` (confirmed above; `/users/requestPasswordReset`
is a 404 — worth recording because it is the path one guesses first). What was **not** exercised
is `ParseAuthAdapter.requestPasswordReset` itself, since nothing reachable calls it.

⚠️ Note for whoever picks this up: `ParseAuthAdapter`'s own header documents that `verifyEmail`
and `resetPassword` **read their outcome out of an HTML page** using `if (response.indexOf(…))`
where the intended test was `!== -1` — so the second branch is effectively always taken. Ported
verbatim, still there, and this run did not reach it.

---

## 2. BCN-007 — a real upload, and where the two fields go

### 2.1 The 201 exists, and it carries both fields

Raw `POST /files/{name}` against the running backend:

```
HTTP 201
content-type: application/json
{"url":"http://127.0.0.1:8579/files/4a51df5829455e70_bcn007-raw.png",
 "name":"4a51df5829455e70_bcn007-raw.png",
 "size":70,
 "contentType":"image/png"}
```

**BCN-007's assumption was right at the wire.** `size` and `contentType` are both present on a
real 201, and `normalizeFileRef` maps them correctly. The item can be closed.

### 2.2 ⚠️ …and `CloudFile` throws both away

Through the API a project actually calls:

```
Noodl.Files.upload(file) -> resolved
CloudFile keys: name,url
name="e8e105ca6035875c_bcn007-probe.png"
url="http://127.0.0.1:8579/files/e8e105ca6035875c_bcn007-probe.png"
contentType=undefined   size=undefined
onProgress fired 1 time
GET the returned url -> HTTP 200, image/png, 70 bytes   <- the bytes round-trip
```

The chain is intact until the last step:

| Step | `contentType` / `size` |
|---|---|
| backend 201 | ✅ both present |
| `ParseWireAdapter.uploadFile` → `normalizeFileRef(response, PARSE_FILE_FIELDS)` | ✅ both preserved |
| `files.ts:22` → `new CloudFile(response)` | ❌ **both dropped** |

`CloudFile`'s constructor is `constructor({ name, url })` and its doc says it is *"deliberately
just a name and a url"* — written long before BCN-007 added the two fields to `FileRef`.

So **BCN-007 added fields to the file reference that nothing downstream can read.** The
normalisation is correct and unreachable. Either `CloudFile` grows the two optional fields, or
BCN-007's `FileRef.contentType`/`size` should be documented as adapter-internal — but the current
state claims a capability the graph does not have.

The upload path is otherwise healthy: `onProgress` fires (the XHR-only progress path BCN-001 §161
calls out), and the returned URL serves the exact bytes with the right content type.

---

## 3. Could not verify

- **Only `nodegx-backend` was exercised.** Auth and files against Parse, Directus, Supabase and
  PocketBase are untouched by this run. BCN-002 already established that a stock Parse Server
  refuses uploads outright.
- **No node was driven.** This drives the `Noodl.*` API the nodes call, not the nodes themselves,
  so nothing here says the Log In / Sign Up / Upload File nodes fire their signals correctly.
- **`ParseAuthAdapter.requestPasswordReset`, `resetPassword`, `verifyEmail`,
  `sendEmailVerification` and the OAuth paths** were not reached — see §1.2.
- **No email was actually sent or received.** `POST /requestPasswordReset` answering `200` says
  the route accepted the request, nothing more.
- **`emailVerified` was never seen as `true`**, so the "populated but false" case is
  indistinguishable here from "never populated".
- **Upload progress was one event on a 70-byte file** — the progress *sequence* on a file large
  enough to produce several is unverified.
