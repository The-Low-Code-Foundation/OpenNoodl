# HLS-006 — `nodegx serve`, on loopback, with a token

Two issues, one task. #36 asks for `nodegx serve <project> --host --token`. #31 reports that the
preview server already does the `--host` half, always, with no token, and never says so.

## 1. The person sentence

**Opening a project does not put the app you are building on the office network — and when someone
does want it there, they choose it, and get a URL and a token to hand over.**

## 2. What was measured

[#31](https://github.com/The-Low-Code-Foundation/NodeGX/issues/31), confirmed cross-host on a LAN:

```
LISTEN 0 511 *:8574 *:*  users:(("noodl-editor",pid=…))
LISTEN 0 511 *:8575 *:*  users:(("noodl-editor",pid=…))
```

`*`, not `127.0.0.1`. No credentials. The editor never mentions the port is open.

⚠️ **The reporter does not want it removed** — it is how they tested on a phone, and it is genuinely
good. The defect is that it is a **default**, not that it exists.

## 3. Scope

- Bind loopback by default, everywhere the preview listens (both ports — check whether they are two
  servers or one).
- An explicit share action that binds the LAN interface, mints a token, and **shows the URL and the
  token on screen**. The editor gains an honest statement of what is listening and to whom.
- `nodegx serve <project> [--host] [--token]` over the same mechanism — the CLI is a second client
  of it, not a second server.
- ⚠️ #31's tail also raises the shipped Linux `.desktop` passing `--no-sandbox`. **Out of scope
  here**; file it in the register with an owner.

## 4. Acceptance criteria

1. **(person)** Open a project. From a second machine on the same network, `http://<host>:8574/`
   does not answer. Click share; it does, and only with the token shown on screen.
2. A spec asserts the bound address is loopback by default — read from the **listening socket**, not
   from the option that was passed in. 🔴 A config value is a fact about the client, not the server.
3. A wrong token and a missing token are both refused, and asserted **beside** a known-good request
   in the same run, so the refusal is about the credential and not about the server being down.
4. `nodegx serve --host --token <t>` from a shell is reachable from a second machine with `<t>` and
   not without.

## 5. Traps

- 🔴 **`lsof -ti :PORT` matches clients too** — use `-sTCP:LISTEN` when measuring what is bound, or
  the measurement includes the browser you tested with.
- 🔴 A 308 or any redirect proves nothing about who is answering. Read the body.
- ⚠️ The editor and the CLI must not become two servers with two policies — that is the
  second-copy-drifts shape, and a security default is the worst place for it.
- ⚠️ Check whether anything already depends on the LAN binding (device preview, a QR code flow). If
  so, that flow is the first consumer of the share action, not a reason to keep the default.
