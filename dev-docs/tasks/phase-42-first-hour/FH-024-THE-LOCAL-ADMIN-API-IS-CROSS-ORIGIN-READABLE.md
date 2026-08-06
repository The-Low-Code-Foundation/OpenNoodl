# FH-024 — any web page can read a developer's local backend admin API

**Found** 2026-08-06, while verifying a side-observation in CWF-009's admin-route work (the agent
noticed its own 401 spec returning 200 and correctly reworked the spec to drive under enforcement).
The row it was found under is closed; **this is not that row**, and it is bigger than it.

**Status:** ☐ **filed, not fixed — needs a decision from Richard.** Deliberately not patched in the
batch that found it: changing an auth gate is not something to slip into a batch aimed at three
unrelated rows, and every plausible fix trades away some of the dev ergonomics `devOpen` exists to
provide. **Candidate alpha-blocker** — see §5.

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

## 4. What is NOT yet established

Written down honestly, because this file will be read as a vulnerability report and the difference
matters:

- **Confirmed by construction** (source read at file:line, above): the gate is skipped, the wildcard
  is set, and the header is applied to admin routes before routing.
- **NOT yet driven.** No cross-origin `fetch` has actually been fired from a real page at a real
  running backend and observed to return a body. **Do that first** — this repo's own rule is that a
  ratio computed from a stylesheet proves what the stylesheet says, not what the browser painted,
  and the same applies to a threat model computed from source. A preflighted **write** (`PUT`/
  `DELETE` with a JSON content type) is a separate question again and is unmeasured.
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
- ⚠️ **CWF-009's specs now drive under enforcement deliberately.** If a fix changes what "enforced"
  means, `tests/admin-secrets-http.test.ts` is the file that will tell you, and its 401 case is the
  one that already caught this once.
- ⚠️ The ops config is live-editable over `PUT /admin/ops` — which is itself an admin route. A fix
  that relies on the operator setting `cors.origins` is a fix reachable through the hole it closes.
