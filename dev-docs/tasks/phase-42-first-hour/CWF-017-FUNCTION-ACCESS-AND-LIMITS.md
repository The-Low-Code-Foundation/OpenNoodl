# CWF-017 — Who may call this function, and how often

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) Pile C + §6 row 11.
Richard, 2026-08-05, on the access rule: *"i love it"*.
**Status:** open, unowned. **The cheapest high-value item on the track** — both halves are built in
the backend and have no editor door.

## Half one: the access rule exists and nothing shows it

Every `POST /functions/:name` resolves a rule from `security.config.functions[name].call`
([HttpServer.ts:1500-1512](../../../packages/nodegx-backend/src/server/HttpServer.ts#L1500-L1512)).
The rule language is small, complete and already validated
([security/model.ts:58-103](../../../packages/nodegx-backend/src/security/model.ts#L58-L103)):

- `public` — anyone
- `authenticated` — any signed-in user
- `role:<name>` — a named role
- `nobody` — nothing outside the backend
- …or an **array of those**, with OR semantics
- plus a **`runAs`** alongside it

There is an admin API (`AdminSecurityRoutes`) and **no editor UI whatsoever**. So the only way to
mark a function as authenticated-only today is to hand-edit `security.json` on the server, which
means in practice nobody does, which means functions default into whatever the default posture says
rather than into a decision.

⚠️ Note the second declaration of the same thing: the **Request node's `Allow Unauthenticated`**
port. Two mechanisms, one question. This task must say which wins and show it — a dropdown in a
panel that silently disagrees with a checkbox on the canvas is worse than either alone. Recommended:
the backend rule is authoritative (it is the one that runs before the graph), the node port is the
project's *declared default*, and the panel shows both with the effective answer.

## Half two: rate limiting is one bucket for every function

`classifyRoute` already maps `accessKind: 'function'` → the `functions` class
([ops/rate-limit.ts:169-180](../../../packages/nodegx-backend/src/ops/rate-limit.ts#L169-L180)), so
all functions share one budget. A per-function limit is: one more field in the same config, and a
classifier that consults it. **Same file, same panel, same trip as half one — do them together or
neither.**

## Slices

### Slice 1 — the panel

A per-function row in the Cloud Functions panel: **Who can call this** (dropdown: Anyone /
Signed-in / Role… / Nobody) and, behind it, the array form for the OR case. Read the rule through
the admin API; write it back the same way.

⚠️ Show the **effective** value, not the stored one. TALK-007's whole finding was capability that
existed and was invisible; a panel that shows a blank when the backend is applying a default repeats
exactly that.

### Slice 2 — `runAs`

The rule has a `runAs` beside it, and it is the difference between "a signed-in user may call this"
and "this runs with the caller's authority". Surface it, or explicitly defer it **in writing** —
silently ignoring a security field is how a permission model rots.

### Slice 3 — per-function rate limit

One optional field (requests per window, burst) next to the access rule; `classifyRoute` consults it
before falling back to the shared `functions` class. Default: unchanged behaviour.

### Slice 4 — the disagreement

Make the Request node's `Allow Unauthenticated` and the backend rule legible together, per the note
above. This is the slice most likely to be skipped and the one that decides whether the feature is
trustworthy.

## Done when

- A function set to **Signed-in** in the panel returns 401/403 to an anonymous call and 200 to an
  authenticated one — driven end to end, not asserted against the config file.
- A function set to `role:admin` refuses a signed-in non-admin.
- A per-function limit returns 429 at its own threshold while other functions are unaffected.
- The panel and `security.json` agree after a round trip through the UI, including the array form.
- The Request node's port and the panel never show contradictory states without saying which wins.

## Traps

- ⚠️ **The default posture matters more than the UI.** `SECURITY DEFAULTS APPLIED` is a real log line
  the backend emits on first start, and dev-open is ON for local development. Establish what an
  undeclared function does *today* before adding a control that implies it was declared.
- ⚠️ **A workflow calls functions with no session token** ([BACKEND-AUTHORING-MODEL](../../reference/BACKEND-AUTHORING-MODEL.md)),
  so a function marked `authenticated` becomes uncallable by a workflow step. That interaction is
  the first thing a user will hit after using this panel. Decide it here: system callers bypass, or
  `runAs` covers it, or the panel warns.
- ⚠️ [CWF-015](CWF-015-SERVER-SIDE-USERS.md)'s Create User nodes are the reason this cannot wait
  much longer than they do.
