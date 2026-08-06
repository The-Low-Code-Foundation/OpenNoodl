# FH-024 — any web page can read a developer's local backend admin API

**Found** 2026-08-06, while verifying a side-observation in CWF-009's admin-route work (the agent
noticed its own 401 spec returning 200 and correctly reworked the spec to drive under enforcement).
The row it was found under is closed; **this is not that row**, and it is bigger than it.

**Status:** ☑ **DRIVEN, FIXED, then DRIVEN THROUGH THE EDITOR**, 2026-08-06. Richard's decision: options **(a) + (b)**, drive
first. §9 is the drive record — before and after, from a real page in a real browser. §10 is what
this file got wrong and §11 is what was given up.

The finding was **worse than filed**: reads came back exactly as predicted, *and* the unmeasured
write case (§4) works too. A preflighted `PUT /admin/ops` with `application/json` **passed its
preflight and changed the running ops config**, and a simple `POST /admin/roles` with `text/plain`
**created a role**. §8's third trap — "a fix that relies on the operator setting `cors.origins` is
reachable through the hole it closes" — was not hypothetical; it is the exact request that landed.

## 1. The mechanism, confirmed at file:line

Three defaults compose into one hole. Each is individually defensible; nobody appears to have read
them together.

| # | Fact | Where |
|---|---|---|
| 1 | `devOpen` **defaults to `true`** | [`security/model.ts:202`](../../../packages/nodegx-backend/src/security/model.ts#L202) |
| 2 | `devOpenActive` = `devOpen && loopback`, and it makes **every** admin gate return early — no token checked | [`security/state.ts:200`](../../../packages/nodegx-backend/src/security/state.ts#L200), [`HttpServer.ts:1554-1556`](../../../packages/nodegx-backend/src/server/HttpServer.ts#L1554) |
| 3 | CORS **defaults to `origins: ['*']`**, and `applyCors` runs on the connection handler **before routing**, so it covers admin routes too | [`ops/model.ts:176`](../../../packages/nodegx-backend/src/ops/model.ts#L176), [`ops/headers.ts:39-47`](../../../packages/nodegx-backend/src/ops/headers.ts#L39), [`HttpServer.ts:1149`](../../../packages/nodegx-backend/src/server/HttpServer.ts#L1149) |

`HttpServer.ts:1554` says it plainly, and the comment is accurate:

```
// Step 2: dev-open relaxes every gate — only ever active on loopback
// (the startup interlock guarantees a non-loopback bind cannot get here).
if (this.security.devOpenActive) return;
```

So on a default local backend: `GET http://127.0.0.1:<port>/admin/<anything>` is **unauthenticated**
and the response carries **`Access-Control-Allow-Origin: *`**.

That is a *simple* cross-origin request. No preflight, and the wildcard means the calling page may
**read the response body**. Any web page open in any browser on the developer's machine can do it.

## 2. Why loopback is not the boundary it is being used as

The interlock at [`state.ts:182`](../../../packages/nodegx-backend/src/security/state.ts#L182) — a
non-loopback bind with `devOpen` refuses to start — is **real, correct, and does its job.** A
*deployed* backend is not affected by this finding at all. Nothing below argues otherwise.

The mistake is one layer up: `loopback` is being treated as "only the developer can reach this."
It is not. A browser is a confused deputy that runs untrusted code from anywhere and can reach
`127.0.0.1` on the developer's behalf. **This repo has already shipped this exact bug once** —
OBS-004, *"the relay was readable by any web page"*. Same shape, same reasoning, different port.

Ports are not a secret either: the editor allocates from **8578** upward
(AAQ-011 F13's port design), which is a few seconds of scanning.

## 3. What is exposed

Everything behind `access: { kind: 'admin' }` — and that set grew twice today. From
`HttpServer.ts`'s route table: collection permissions, **function permissions and rate limits**
(CWF-017), **function timeouts** (CWF-018), roles, users, ops config, execution history, the data
browser's schema and rows, and **the secrets listing** (CWF-009).

⚠️ **CWF-009's secrets route is the one thing here that is genuinely safe**, and only because it was
built to a stricter bar than it needed: it returns *names only* — no value, no length, no
fingerprint. That was a deliberate design choice made for a different reason and it happens to hold
the line here. **Do not treat it as evidence the others are fine.** They return data.

⚠️ **F10 made this much more reachable, today.** Before F10 a local backend ran only while you had
Backend Services open and had pressed Start. Since `2994e48f` the project's backend **starts
automatically on project open** — so for anyone using NodeGX normally, the surface is live for the
whole session.

## 4. What was NOT yet established — now driven, see §9

Written down honestly, because this file will be read as a vulnerability report and the difference
matters:

- **Confirmed by construction** (source read at file:line, above): the gate is skipped, the wildcard
  is set, and the header is applied to admin routes before routing.
- ~~**NOT yet driven.**~~ **Driven 2026-08-06 — §9.** Both halves reproduced: the read returns a
  body, and the preflighted `PUT` this bullet called "a separate question again and unmeasured"
  passes its preflight and mutates the running config. The rule this bullet invokes earned its
  keep in the other direction too: the drive is what showed a path-prefix fix would have been
  bypassable and incomplete.
- The `Vary: Origin` line at `headers.ts:65` is skipped when origin is `'*'`, which is correct, but
  means nothing here either way.

**Slice 0 of any work on this is the drive.** If the drive fails to reproduce, record the drive —
never close this on "couldn't reproduce" without it.

## 5. Why this may be alpha-blocking

Not because a deployed app is at risk — it is not. Because the person exposed is **the developer**,
the exposure lasts the whole editor session, it needs no user error beyond having a browser open,
and the data includes their app's schema, users and operational config. That is a poor thing to
discover after a public alpha rather than before one.

Against that: it requires an attacker to know the target is running NodeGX and to scan a port range,
and the population during alpha is small and technical.

**That trade is Richard's call, not the builder's.** Hence filed.

## 6. The options, with the trade each makes

Not a recommendation to implement — input to the decision.

| # | Option | Trade |
|---|---|---|
| (a) | **Never send CORS headers on `admin/*`** | Smallest change; kills cross-origin *reads* outright. The admin API is called by the editor's main process over IPC/Node, not by a browser page, so it plausibly needs no CORS at all. **Check that assumption before believing it** — the served `/_admin` surface (BAK-005) may be a browser client. |
| (b) | **Do not let `devOpen` relax `admin/*`** — keep it for data/function routes only | Preserves the dev ergonomics that matter (hitting your own collections without a token) while the genuinely administrative surface always wants a token the editor already holds. |
| (c) | **Require an `Origin`-absent or same-origin request on `admin/*`** | A page always sends `Origin`; the editor's own Node client does not. Cheap and precise, but "no `Origin` header" is a weak check to lean on alone. |
| (d) | **Bind to a random high port + a per-launch token in the URL** | Strongest, largest change, and F10/F13's spawn records already carry a port and would need to carry the token too. |
| (e) | Accept for alpha, document it | Legitimate if the alpha population is small and told. Costs nothing now, costs more later. |

(a) and (b) are not exclusive and are the cheap pair.

## 7. Done when

- A real cross-origin `fetch` from a page at a running local backend is **driven**, before and after,
  and the before-case is recorded as the proof this was real.
- An admin route cannot be read cross-origin by a page, on a default-configured local backend.
- A deployed backend's behaviour is **unchanged** — the interlock case has its own spec, so a fix
  here cannot silently alter the posture the interlock guarantees.
- `devOpen`'s dev ergonomics for non-admin routes survive, or the doc says which were given up.

## 8. Traps

- ⚠️ **`checkAccess` has two `devOpenActive` early-returns**, `HttpServer.ts:1556` and `:1639`.
  Fixing one and not the other reinstates the hole through the second door. `parse-wire.ts:138`
  documents a third path that deliberately has *no* dev-open escape hatch — read it before assuming
  the pattern is uniform.
  **↳ Half wrong, see §10.** `:1639` is not in `checkAccess`; it is `assertDataAccess`, the *data*
  gate, reached only from the `data` case and from `ctx.checkData` on `POST /api/_batch`. It is not
  a second door onto the admin plane and was left open ON PURPOSE — it is the ergonomic (b) keeps.
- ⚠️ **CWF-009's specs now drive under enforcement deliberately.** If a fix changes what "enforced"
  means, `tests/admin-secrets-http.test.ts` is the file that will tell you, and its 401 case is the
  one that already caught this once.
  **↳ Held.** That file never needed touching: it already drove with `devOpen: false` and a bearer
  token, which is what the whole surface now requires. It passed unchanged through the fix.
- ⚠️ The ops config is live-editable over `PUT /admin/ops` — which is itself an admin route. A fix
  that relies on the operator setting `cors.origins` is a fix reachable through the hole it closes.
  **↳ Confirmed by driving it.** The write landed. Neither (a) nor (b) rests on `cors.origins`.

## 9. The drive — Slice 0, before and after

A real page (Electron/Chromium, `webSecurity` on) served from `http://127.0.0.1:<ephemeral>`,
firing at a real `nodegx-backend` started with nothing but `--data-dir` and `--port` — no
`security.json`, no `ops.json`, the default posture the finding is about.

**Before** — every probe returned `200`/`201` with a readable body:

| Probe | Result |
|---|---|
| `GET /admin/ops` | 200, full ops config incl. every rate-limit policy |
| `GET /admin/permissions` | 200, `devOpen:true`, defaults, collections, `signup` |
| `GET /admin/schema` · `/admin/keys` · `/admin/secrets` · `/_admin/whoami` | 200, bodies read |
| `PUT /admin/ops` (`application/json` — **preflighted**) | **204 preflight passed**, then 200; `logging.level` went `info` → `debug` on the running service |
| `POST /admin/roles` (`text/plain` — simple, no preflight) | **201**; role `fh024_pwned` created and still there afterwards |

On the wire the response carried `Access-Control-Allow-Origin: *`, and the `OPTIONS` preflight
answered `204` with `Allow-Methods: GET, POST, PUT, DELETE, OPTIONS` and `Allow-Headers:
Content-Type, Authorization, …`. (`res.headers.get('access-control-allow-origin')` reads `null` from
script — ACAO is not a CORS-safelisted *response* header — which is why the proof is the body
coming back, not the header being visible.)

**After** — same page, same backend shape:

| Probe | Result |
|---|---|
| All six admin reads | `TypeError: Failed to fetch` — *"blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present"* |
| `PUT /admin/ops` (preflighted) | *"Response to preflight request doesn't pass access control check"* — the `PUT` is **never sent** |
| `POST /admin/roles` (simple) | Sent blind, as a simple request always is; answered **401**, and `GET /admin/roles` with the credential shows `{"roles":[]}` — **it did not land** |
| `GET /api/_User`, `GET /health` | 200, readable, `ACAO: *` — unchanged |

That last row is why (a) alone would not have been enough and why Richard's (a)+(b) is the right
pair: (a) stops the browser *reading*, (b) stops the simple write the browser still *sends*.

Also driven at the wire, on the fixed build:

- `GET /%61dmin/ops` → 401, **no ACAO**. The router splits then decodes, so this reaches
  `admin/ops`; a `pathname.startsWith('/admin/')` suppression would have shipped the wildcard here.
- `GET /api/_schema` and `GET /executions` → 401, **no ACAO**. Both are `access: {kind:'admin'}` on
  paths that do not start with `admin/`. The suppression is therefore answered from the **route
  table**, not from the path.
- `GET /api/_User` and a 404 → still `ACAO: *`. A deployed app's error handling is unchanged.
- `GET /admin/ops` with the bearer token → 200. The editor's path still works.

And the BAK-005 dashboard, driven same-origin at `/_admin` on a dev-open backend: the sign-in form
appears, pasting the `adminToken` signs in, the app renders, and `fetch('/admin/schema')` from
inside it answers 200. Without a credential the same call answers 401.

## 10. What this file got wrong

- **§6(a)'s assumption, checked as instructed.** `/_admin` **is** a browser client
  (`src/admin/ui/index.html`, one `fetch` at :151 behind an `api()` wrapper). But it is a
  **same-origin** one — every call is a relative path against the backend that served the page — so
  CORS never applied to it and removing CORS costs it nothing. Driven, above.
- **§8's first trap is half wrong.** `HttpServer.ts:1639` is `assertDataAccess`, not a second
  `checkAccess` return, and it gates no admin route. See the annotation above.
- **§6(a) understates the scope.** "Never send CORS headers on `admin/*`" would have missed
  `GET /api/_schema` and `GET /executions`, and would have been bypassable with `/%61dmin/ops`.
- **§1's line numbers drifted by one** (`security/model.ts:202` is `:201`); the facts at them hold.
- **§3 is right about what is exposed and §5's argument stands** — the exposure is worse than filed
  because it is not read-only.

## 11. What was given up

- **The BAK-005 dashboard no longer enters password-free on a dev-open backend.** Its boot probe
  (`GET /_admin/whoami` with no credential) used to succeed there, on the reasoning that a password
  box in front of a backend enforcing nothing is theatre. It was not theatre. The probe is kept —
  it costs one request, and a backend that answers it now is a backend that has regressed this row
  — and the sign-in form's own error text already names `secrets.json` as where the token lives.
- **Nothing else.** Dev-open's actual ergonomic — your own collections and functions without a
  token — is untouched, and has its own spec case.
- **A residual, named rather than fixed:** `/api/*` keeps `ACAO: *` and dev-open keeps relaxing it,
  so a web page can still read a dev-open backend's **collections**. That is dev-open's cost, not
  this row's, and turning `devOpen` off removes it. It is written down at
  `HttpServer.assertDataAccess`'s doc comment so the next reader meets it there.

## 12. Driven through the editor — 2026-08-06, and it found one thing

§9's drive was against a **hand-spawned** backend. This is the same fix seen from the editor, against
a backend the **Backend Services panel** started (`SQLite backend`, port 8578, `devOpen: true`).

The posture holds where it matters: `GET /admin/schema` with no credential → **401**; with the
`adminToken` from `<dataDir>/secrets.json` → **200**; with `Origin: http://evil.example` → still no
`Access-Control-Allow-Origin` at all; and `GET /api/Articles` keeps `ACAO: *`, the named residual.

**Four editor surfaces pass** — Backend Services (list, start, `ACTIVE ✓ Running`, cloud-function
listing), Data Browser (tables, typed rows, and a cell edit confirmed at the wire: `views` 10 → 1017
with `updatedAt` moved), Permissions (collections, function rules, roles, API keys), and the secrets
listing over IPC. All four go through `ServiceSupervisor.request`, which has attached a bearer since
BAK-003.

**One did not.** The **Execution History** panel rendered *"SQLite backend is running but could not
be read: HTTP 401."* `ExecutionHistoryManager.fetchRemoteList` / `fetchRemoteGet` fetch
`GET /executions` and `GET /executions/:id` **directly**, not through the supervisor — and those are
`access: { kind: 'admin' }` routes, which is precisely the fact §9 recorded when it explained why the
CORS suppression had to be answered from the route table. They answered before (b) only because
dev-open relaxed the gate. Fixed in **`cd644628`** by putting the credential on
`RemoteExecutionSource`; a source with no token is still asked and reported unreachable *with its
401*. Red-then-green in `ExecutionHistoryManager.merge.test.ts`, and driven live afterwards: runs
list, and opening one renders `chargeCard · SUCCESS · Ran on SQLite backend`.

**The generalisable lesson**, and the reason this section exists rather than a one-line amendment:
a fix decided from a **route table** must be checked against every caller that does **not** go
through the one client that knows the table. Four of the editor's five backend surfaces did; the
fifth had its own `fetch` and no one had reason to look at it.

§11's "given up" is also re-confirmed and is **not** a regression: `GET /_admin` still serves 200
HTML, its boot probe still answers **401** without a credential (so the sign-in form appears), and
the `adminToken` from `secrets.json` **signs in** — `GET /_admin/whoami` with that bearer returns the
full whoami payload, and a wrong token returns 401. Exercised at the wire this time rather than by
typing into the form; `signIn()` *is* that request (`admin/ui/index.html:1781-1788`, `api()` at
`:147-149`).

**Where the fix lives:** `HttpServer.applyCorsFor` / `isAdminControlPlane` (a),
`HttpServer.checkAccess` step 2a (b), with `pathSegments`/`segmentsMatch` shared with `matchRoute`
so the CORS verdict and the routing verdict cannot drift. Spec: `tests/admin-cors-devopen.test.ts`
— three describes: the default backend, an enforcing one (unchanged), and the startup interlock in
its own right.
