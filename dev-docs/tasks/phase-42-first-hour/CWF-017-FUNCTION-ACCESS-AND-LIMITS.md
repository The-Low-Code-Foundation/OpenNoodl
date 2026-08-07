# CWF-017 — Who may call this function, and how often

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) Pile C + §6 row 11.
Richard, 2026-08-05, on the access rule: *"i love it"*.
**Status:** SHIPPED 2026-08-06 (slices 1, 3, 4; slice 2 deferred in writing below). Both halves now
have an editor door in the Permissions panel, plus an admin API and a 15-case backend suite
(`packages/nodegx-backend/tests/security-functions.test.ts`). Not yet driven in a live editor.

Three of this doc's stated mechanisms were wrong and are corrected in place below: the workflow-step
trap, the `classifyRoute` mechanism for slice 3, and slice 4's premise that "which wins" was
undecided. Each correction is marked **CORRECTED**.

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

⚠️ **CORRECTED.** The second declaration — the **Request node's `Allow Unauthenticated`** port — is
not a competing answer to the same question, and "which wins" was already decided in code before
this task started: `HttpServer.functionAuthDefault` used the node port as the FALLBACK when no
config entry exists (ticked → `public`, unticked → `authenticated`). The recommendation below was
therefore already the behaviour; nothing about it changed.

What the doc missed is that they are **two gates at two layers**, not one gate declared twice:

- the config rule decides whether the request **reaches** the graph (dispatcher, before any node runs);
- the node's own `allowNoAuth` check then runs **inside** the graph and throws
  `Unauthenticated requests not accepted.` if there is no resolvable session token
  ([noodl-viewer-cloud/src/nodes/cloud/request.ts](../../../packages/noodl-viewer-cloud/src/nodes/cloud/request.ts)).

So `call: "public"` over a node with the port unticked is not a public function — it is a **500**
with a confusing message. That pair is what the panel now flags (`graphRefusesAnonymous`), and it is
the only real contradiction the two mechanisms can produce.

## Half two: rate limiting is one bucket for every function

`classifyRoute` already maps `accessKind: 'function'` → the `functions` class
([ops/rate-limit.ts:169-180](../../../packages/nodegx-backend/src/ops/rate-limit.ts#L169-L180)), so
all functions share one budget. A per-function limit is one more field in the same config.

⚠️ **CORRECTED:** it is *not* "a classifier that consults it". `classifyRoute` returns a
`RouteClass` from a closed union of eight, so it cannot express a per-function bucket at all. The
limit is applied in the dispatcher through `RateLimiter.checkPolicy`, which already exists for
exactly this shape (BAK-002's mail budgets ride on it).

**As built:** the per-function bucket is checked *in addition to* the class bucket, not instead of
it, so declaring one can only ever TIGHTEN. "Consult it before falling back" would have let a
per-function number quietly hand a function a larger allowance than the class an operator tuned. To
make one function more generous than the rest, raise the class.

## Slices

### Slice 1 — the panel ✅

A per-function row: **who can call this** (Anyone / Signed-in / Nobody / From the graph) with an
exact-rule box beside it for `role:<name>` and the array (OR) form.

⚠️ Show the **effective** value, not the stored one. TALK-007's whole finding was capability that
existed and was invisible; a panel that shows a blank when the backend is applying a default repeats
exactly that.

**As built.** It landed in the **Permissions panel**, not the Cloud Functions section of the backend
card — that section is a deploy-status list, while the Permissions panel is the one surface that
already edits rules, roles and keys against a running backend. The effective rule is resolved by the
BACKEND (`effectiveFunctionRule`, the same function the gate calls) and sent down whole; the editor
never computes its own fallback, so the panel and the gate cannot disagree. The list also shows two
things `config.functions` alone cannot: functions that are deployed but unconfigured, and config
entries for functions **nothing serves** — a rule guarding a name that does not exist.

New surface: `GET /admin/permissions/functions`, `PUT|DELETE /admin/permissions/functions/:name`,
proxied by `backend:getFunctionRules` / `setFunctionRules` / `resetFunctionRules`. Both writes are
audited (`permissions.function.update` / `.delete`).

### Slice 2 — `runAs` — DEFERRED, in writing

**Nothing is being silently ignored, because nothing can be:** `runAs: 'caller'` is REJECTED at
config load with "not yet supported by this build — refusing to accept a security setting that would
not be enforced", and `'system'` is the only accepted value. A dropdown with one option is not a
control, so the panel states the fact in prose ("Functions run with the backend's own authority —
running as the caller is not built, so there is nothing to choose") rather than offering a choice
that does not exist. `runAs` is still readable and writable through the admin API, and a test pins
both the accept and the refusal.

Building `runAs: 'caller'` needs a per-run credential seam inside the cloud runtime — a function
invoked with the caller's authority has to carry that authority into every record read the graph
makes. That is a task, not a field.

### Slice 3 — per-function rate limit ✅

`functions.<name>.rateLimit = { ratePerMinute, burst }` in `security.json`, strictly validated
(unknown keys refused), checked in the dispatcher on top of the class bucket. Absent = unchanged
behaviour. The panel takes it as `rate` or `rate/burst` and shows the shared class budget beside it
so the number can be read against something.

### Slice 4 — the disagreement ✅

The panel flags the one pair that actually contradicts: an effective rule that admits anonymous
callers over a Request node that does not have `Allow Unauthenticated` ticked. It says which gate
refuses, where, and the two ways to fix it. The corrected note above explains why this is the only
contradiction the two mechanisms can produce.

## Done when

All five are covered by `tests/security-functions.test.ts`, driven over real HTTP against a real
service with enforcement on — never asserted against the config file.

- ✅ A function set to **Signed-in** returns 403/119 to an anonymous call and 200 to an authenticated
  one.
- ✅ A function set to `role:ops` refuses a signed-in non-member and admits a member once the role is
  granted. `nobody` refuses everyone outside the backend; the admin credential still bypasses.
- ✅ A per-function limit returns 429 at its own threshold, naming the function, while other
  functions and other callers are unaffected — and clearing it restores the function at once.
- ✅ The panel's read, the admin write and `security.json` agree after a round trip, including the
  array form (asserted against the file on disk).
- ✅ The Request node's port and the panel cannot show contradictory states silently: the effective
  rule always names its source, and the one genuine contradiction is flagged in the row.

## Traps

- ⚠️ **The default posture matters more than the UI.** `SECURITY DEFAULTS APPLIED` is a real log line
  the backend emits on first start, and dev-open is ON for local development. Establish what an
  undeclared function does *today* before adding a control that implies it was declared.
  **As built: the default posture is untouched.** An undeclared function still resolves through the
  graph's `Allow Unauthenticated` port exactly as before; `DELETE` puts a function back to it; the
  new `rateLimit` field absent means the class bucket alone. The first test in the suite exists to
  pin this, and it runs before anything is declared.
- ⚠️ **CORRECTED — this trap is wrong.** A `call-function` step invokes the function **in process**
  (`WorkflowRunner.invokeFunction`, reached from `StepExecutor.invokeCloudFunction`), so it never
  reaches the dispatcher and **no `call` rule applies to it at all**. Marking a function
  `authenticated` — or `nobody` — does not make it uncallable by a workflow step; system callers
  bypass by construction, not by a rule. What *does* fail a step is the Request node's own
  `allowNoAuth` check, which runs inside the graph with no session token to offer it, and which no
  config rule can rescue. Both halves are pinned by a test. The remedy a user needs is therefore
  "tick the port on the canvas", never "open the rule in the panel" — the opposite of what this
  trap said.
- ⚠️ [CWF-015](CWF-015-SERVER-SIDE-USERS.md)'s Create User nodes are the reason this cannot wait
  much longer than they do.
