# HLS-006 — what was built

**Session 7, 2026-09-09.** `nodegx serve`, on loopback, with a token — and the editor's two
preview sockets stop listening on every interface.

Closes [#31](https://github.com/The-Low-Code-Foundation/NodeGX/issues/31) and the `serve` row of
[#36](https://github.com/The-Low-Code-Foundation/NodeGX/issues/36). Register rows **C31 CLOSED**;
**C53–C58, C61** filed this session, seven of them closed here; **C59 and C60 are OPEN and owned by
`NONE`.**

---

## 1. What was actually wrong, which was more than the report said

#31 reports two sockets on `*` with no auth, confirmed from a second machine on a LAN. Re-measured
this session, at the mechanism and at the artefact:

- `web-server.js` called `.listen(port)`.
- `design-tool-import-server.js` called `new WebSocketServer({ port })`.

**Neither passed an address at all.** Node binds `::` in that case — measured, not assumed, with a
bare `http.createServer().listen(0)` in this repo's own runner, which reports
`{"address":"::","family":"IPv6"}`. 🔴 **Nobody decided to publish those ports. The default
decided**, and that is the sentence the whole task is written against.

Three things the report did not contain:

1. 🔴 **The open HTTP port was a credential disclosure, not only an exposure (C54).** OBS-004 mints
   a per-launch relay token and gates the WebSocket relay on it — because browsers do not apply
   the same-origin policy to WebSockets, so any page the user visits could otherwise read the
   project export. That token is **injected into the index page `web-server.js` serves**, and the
   HTTP half had no gate of any kind. OBS-004's note correctly says the page is not readable
   *cross-origin* — but a peer on the LAN is not a browser applying an origin policy, it is
   `curl`, and `GET http://<host>:8574/` handed back the credential in the body. For anyone on the
   same network, OBS-004's gate was one unauthenticated request away from being decorative.
2. **The second socket is worse than the first and needs no sharing case at all.** 8575 accepts a
   message that writes a file into the open project, at a path taken from the wire (C59). It
   exists for a design-tool plugin on the same machine. It is now `LOOPBACK` unconditionally, with
   no way to share it.
3. **A third listener had the same defect one flag along (C58).** `noodl-preview --host` was an
   unauthenticated LAN listener. #31 could not name it because its *default* was already loopback
   — which is precisely the argument for §3 below.

---

## 2. The shape: one policy, three consumers, and a registry for the fourth

The trap the task names is two servers with two policies. The answer is in three parts, and only
the third one survives somebody adding a server next month.

**`packages/nodegx-export/src/serve/access.ts`** — the whole policy, as functions of their
arguments, with no `http` in it. `resolveAccess`, `authoriseRequest`, `tokenMatches`,
`isLoopbackAddress`, `tokenFromRequest`, `shareUrl`, `lanAddress`, `describeAccess`.

It lives in `@nodegx/export` because that package ships the `nodegx` binary *and* because the
editor already resolves `@nodegx/export` to `src/` in all three of its resolvers — `tsconfig.json`
paths, `jest.config.js` moduleNameMapper, `webpackconfigs/shared/webpack.shared.js` — which the
main-process bundle merges, and which has a `ts-loader`. **No new wiring was needed for the editor
to import it.** `@noodl/preview` reaches it by relative path, as it already does for eleven
editor modules.

🔴 **The one rule with teeth:** `host` is honoured **only** when `share` is set. A caller passing
`{ host: '0.0.0.0' }` and no `share` gets loopback. That asymmetry is the point — the failure it
prevents is a config file, an environment variable or a forwarded option quietly re-opening the
port, which is how `.listen(port)` came to bind `::` in the first place.

**The consumers:**

| listener | before | after |
|---|---|---|
| `web-server.js` (8574 HTTP + relay) | `::`, ungated | `resolveAccess()`; loopback until shared, token required of every non-loopback caller |
| `design-tool-import-server.js` (8575 WS) | `::`, ungated | `LOOPBACK`, unconditionally, not shareable |
| `nodegx-export/src/cli/serve.ts` | did not exist | `resolveAccess()`; `--share`/`--host` are the only two spellings that reach another interface |
| `noodl-preview/src/server.ts` | loopback default, **no token when `--host`** | same `resolveAccess`/`authoriseRequest` pair, plus `--token` |

**`tests/hls006-every-listener.test.ts`** — the part that outlives the change. Every socket opened
under any `packages/*/{src,scripts,bin}` must appear in an `ENROLLED` table with a written
decision, and the table is swept in both directions (an unenrolled listener fails; a row whose
file no longer opens a socket also fails). Ten rows today. 🔴 **A source scan proves nothing about
behaviour and the file says so** — its job is to notice a listener nobody has thought about, which
no behavioural test can do, because it does not know the new server is there.

---

## 3. The gate's own boundary, stated

- 🔴 **A loopback caller is never challenged.** When the socket is loopback-bound that is the only
  kind of caller there is; when it is shared, a local process can read the token file anyway.
  `relay-token.js` draws the same line for the same reason. Gating loopback would break every
  local tool for a protection that was never real.
- **The share credential is the launch relay token, deliberately.** The page being shared is the
  viewer; the viewer connects back to the relay to receive the project at all; the token is
  therefore already in the HTML it is served. A second token would let the URL imply a smaller
  capability than it actually hands over.
- **The token arrives in the URL and is handed back as a cookie** (`HttpOnly`, `SameSite=Strict`).
  Without that, the HTML is the only thing that renders and every asset it asks for is a 401 —
  a share that looks like a broken export.
- **`no-token` and `wrong-token` are two reasons and one 401.** Two reasons so a log can tell a
  misconfigured colleague from a probe; one response so a scanner does not learn the parameter
  name is right.

---

## 4. The acceptance criteria

| # | criterion | state |
|---|---|---|
| 1 | **(person)** open a project; `http://<host>:8574/` does not answer from a second machine; click share and it does, only with the token shown | 🟡 **half.** The socket half is measured (below). The **second machine** is not, and stays a person's job |
| 2 | a spec asserts the bound address is loopback by default, read from the **listening socket** | 🟢 |
| 3 | a wrong token and a missing token both refused, **beside** a known-good request in the same run | 🟢 |
| 4 | `nodegx serve --host --token <t>` reachable from a second machine with `<t>` and not without | 🟡 **half**, same boundary as AC1 |

### AC2 — read off the socket, three ways

- `hls006-preview-binding.test.js` starts the editor's **real `startServer`** (Electron stubbed —
  the module loads, which is why OBS-004 split the relay out) and reads `server.address()`.
- `hls006-serve.test.ts` starts the **real `startServe`** and reads `server.address()`.
- 🔴 **The reverted arm**, in the same describe block: a bare `listen(0)` beside it, asserted to
  report `::`. Without it, "the address is 127.0.0.1" is also the reading for a machine with only
  a loopback interface, or for an assertion that never had a way to fail.
- And the artefact, by hand: `lsof -nP -iTCP -sTCP:LISTEN` against a running `nodegx serve` →
  `TCP 127.0.0.1:8791 (LISTEN)`, and `TCP *:8792 (LISTEN)` with `--share`. (⚠️ `-sTCP:LISTEN`
  because `lsof -ti :PORT` matches the clients too.)

### AC3 — the three verdicts in one run

Both suites assert `missing`, `wrong` and `right` against **one server in one run**, because a 401
read on its own is indistinguishable from a server that is down. Also asserted: the two refusals
have byte-identical bodies, neither contains the token, and the right one returns 200 with the
page.

### The drive — two editors, side by side, in one reading

🔴 **The best measurement in this task was an accident of the machine, and it is a control pair
nobody could have arranged deliberately.** `/Applications/NodeGX.app` — the **installed** build,
running since 15:59 and belonging to Richard — was already holding 8574/8575, which is why the
first dev launch died on the single-instance lock. Relaunched with `NOODL_USER_DATA_DIR` and
`NOODLPORT=8674` so that his editor was never touched, both were then live at once:

```
NodeGX    7762   TCP *:8574 (LISTEN)          ← installed build, the code before this task
NodeGX    7762   TCP *:8575 (LISTEN)
Electron 38197   TCP 127.0.0.1:8674 (LISTEN)  ← this session's build
Electron 38197   TCP 127.0.0.1:8675 (LISTEN)
```

And in the log: `[preview] Listening on 127.0.0.1:8674 — this machine only. Nothing else on the
network can reach it.`

Then driven from this machine's own LAN address (`192.168.1.243`), in one run:

| target | loopback | from the LAN address |
|---|---|---|
| this session's build, 8674 | `200` | **`exit 7` — connection refused** |
| the installed build, 8574 | — | **`200`** |

🔴 **And the installed build's response body contained `__nodegxRelayToken="487f9937…`** — the live
per-launch credential of a running editor, handed to an unauthenticated caller over the network,
on demand, today. That is C54 demonstrated against the shipping artefact rather than argued from
the source. (The captured page was deleted immediately; only the first eight characters were ever
read, and they are recorded here solely because the *shape* is the finding.)

⚠️ **The share action itself was not driven.** It is a native menu item and CDP reaches the
renderer, not the application menu. `setSharing` is graded through the real server in
`hls006-preview-binding.test.js`; the menu wiring around it is not.

### AC1 / AC4 — what is measured and what is not

The remote-caller cases connect over **this machine's own LAN address** (`192.168.1.243` in this
session), which is a real non-loopback path to the socket: unshared, it is `ECONNREFUSED` — not a
401, which is a strictly stronger statement, because an open port that refuses is still an open
port. ⚠️ **It says nothing about routing, firewalls or NAT.** The second machine is the person
half of both criteria and it is not closed.

⚠️ On a machine with no external IPv4 those cases do not run. **They do not skip silently** — each
suite carries a test that fires in that case and prints why.

---

## 5. The editor's share action

Application menu → **Preview → Share preview on this network…**, in the menu rather than on the
canvas because it is a decision about the machine and because it has to be reachable to turn
**off** after the project that prompted it is closed.

Two things about the wording are deliberate and are the fix for the half of #31 that was never
about a socket:

- It says what a **reader of the link** can do — "anyone on this network who opens the link can see
  and interact with the app you are building" — not what the feature is called.
- It says **the link is the credential**, in the second paragraph, not in a tooltip. A token in a
  URL is only as private as the URL, and somebody who does not know that pastes it into a channel
  with three hundred people in it.

Sharing **rebinds the socket** rather than binding `0.0.0.0` and refusing non-loopback callers in
the handler. The latter looks identical from the editor and is strictly worse: a port that answers
401 is still found by every scanner, and it would make AC2 unverifiable, because there would be no
honest way to read "loopback" off the listening socket. The cost is real and is in the dialog —
the preview reloads once.

---

## 6. What writing the gate found, that reading the change did not

🔴 **Five defects, and two of them were in the code this task had just written.**

- **C53** — `getAccessStatus()` returned `access.host` and the *requested* port. The option, not
  the socket: the exact shape AC2 exists to reject, written by this task, surviving until a spec
  ran with `NOODLPORT=0` and the status said port `0`.
- **C56** — `server.on('listening')` fires **again on every rebind**, so three shares attached
  **four** relays to one HTTP server. Measured by counting `upgrade` listeners with the guard
  removed; the reverted arm reads `4`. Found by *reading the handler after writing the rebind* —
  no spec could see it, because the spec that existed did not open a WebSocket. There is one now.
- **C57** — the `error` handler that quits the app was still armed during a rebind. A port the OS
  declines for an **optional** share would have closed the author's editor with unsaved work in it.
  A failed rebind now re-listens on the previous address.
- **C55** — `tokenFromRequest` threw `Invalid URL` on `//%%`. On a shared server that is an
  exception in the request handler reachable by anything on the network that can send four bytes.
- **C61** — `grep` silently skipped `HttpServer.ts` (2,411 lines) while this task was enumerating
  listeners; `grep -a` found the `listen` on line 1304. The registry would have been one row short
  and looked complete.

---

## 7. What this leaves, and what it does not

**Leaves you:**

- **`serve/access.ts`, one copy, four consumers**, and `hls006-every-listener.test.ts` as the thing
  that makes "one copy" survive the next person.
- **`nodegx serve <folder>`**, exit code 6 of its own, SPA fallback, and a resolved-path
  containment check (`%2e%2e%2f` is rejected because the check is on the path that gets opened,
  not on the request string).
- **46 new gates** across three suites, including two reverted arms.
- Suites: **`nodegx-export` 94 suites / 3297 passing** (was 91 / 3239); **`noodl-editor`
  `test:main` 441 suites / 7314 passing**; **`@noodl/preview` 14 / 14**.

**Does not leave you:**

- 🔴 **The second machine.** AC1 and AC4 are half-closed and no amount of specs closes the other
  half. It is one person, two devices, five minutes.
- 🔴 **A driven share action.** The menu item was written and never clicked — CDP reaches the
  renderer, and this is a native menu. The server half beneath it is graded; the wiring is not.
- ⚠️ **The installed `/Applications/NodeGX.app` still listens on `*:8574` and `*:8575`.** This
  session changed the source, not the build on Richard's machine. Anyone reading "#31 is closed"
  should know the fix ships with a release, and R1 is still unruled.
- 🔴 **C59 — the arbitrary file write on 8575.** Reduced from LAN-reachable to loopback-only, which
  moves it into the class `relay-token.js` declares out of scope. **Do not read "loopback" as
  "closed."** Two lines to fix; nobody has driven the plugin protocol.
- 🔴 **C60 — the editor still announces itself on the LAN when sharing is off.** `broadcastNew()`
  multicasts hostname, port and **project name** to `225.0.0.100:8575` on every project open. It
  now advertises a port nothing off-machine can reach, and it leaks what the author is working on.
  Read from `main.js`; **not driven**, so whether anything still listens is unmeasured.
- ⚠️ **Nothing measured about `--host` with a *specific* address** beyond that it binds it. The
  suites exercise `0.0.0.0`.
- ⚠️ **The Figma/design-tool plugin was not driven.** Binding 8575 to loopback should be invisible
  to a plugin on the same machine, and that is an argument, not a measurement.
