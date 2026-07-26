# BAK-005 — The Served Admin Dashboard: implementation notes

**Status:** shipped 2026-07-26
**Spec:** [BAK-005-SERVED-ADMIN-DASHBOARD.md](./BAK-005-SERVED-ADMIN-DASHBOARD.md)

---

## 1. The seam decision

**Route (b): a lean admin SPA that reuses the HTTP contract, not the editor's
components.**

The spec called this the task's real design work and asked for a decision on
evidence. Here is the evidence, then the decision, then why the losing option
lost.

### What was measured

The editor's Backend Services feature is five view directories plus a model
directory under `packages/noodl-editor/src/editor/src/`:

| Part | LOC | Editor coupling |
|---|---|---|
| `databrowser/` + `schemamanager/` + `permissions/` + `email/` + `triggers/` | ~3,231 TSX | **Zero** `@noodl-models` / `@noodl-contexts` imports. One `window.require('electron')` line per file. |
| `BackendServicesPanel/` shell (panel, cards, dialog) | ~1,040 TSX | Genuinely editor-bound: `ProjectModel`, `projectmodel.editor`, `useEventListener`, `ToastLayer` |
| `models/BackendServices/` | ~1,359 TS | Editor-side model |
| `.module.scss` across the seven dirs | 1,242 | — |

Of 68 import statements across 18 files: 44 are pure `@noodl-core-ui`
presentational components (14 distinct), 7 are editor-model coupling
(concentrated in the four shell files), and Electron enters only through
`window.require('electron')` at module scope in 7 files. None of the 14 core-ui
components used reaches `ProjectModel`, `EventDispatcher`, the node graph, or
the CodeMirror subtree.

The panel does **not** speak HTTP from the renderer. Every call is
`ipcRenderer.invoke('backend:*')` → `BackendManager.js` (main) →
`ServiceSupervisor.request()` → `fetch` with `Authorization: Bearer <adminToken>`
read from `secrets.json`. ~45 inline invoke sites, no client abstraction.

So the *components* look portable. That is the seductive part, and it is not the
part that decides.

### Why route (a) lost

The blocker is not decoupling. It is that **the prior art does not transfer**
and the build infrastructure does not exist:

1. **`packages/noodl-preview`'s recipe is not prior art for this.** It is the
   thing the spec named as making route (a) plausible, so it was checked first.
   It is an esbuild **Node CJS** bundle that loads `.css`, `.svg`, `.png`,
   `.woff` with the **`empty` loader** and never renders React. It proves editor
   *models* can leave Electron. It says nothing about building editor *views*
   into a browser bundle, because it deliberately throws all the view assets
   away.
2. **`@noodl-core-ui` is not a consumable library.** No `main`, no `module`, no
   `exports`, no `types`, no build step. It is consumed as TypeScript source
   through a path alias. Worse, its own `tsconfig.json` declares *reverse*
   aliases back into the editor (`@noodl-models/*`, `@noodl-hooks/*`,
   `@noodl-contexts/*`, …). Making it consumable from a second package is its
   own task.
3. **There is no browser `@noodl/platform`.** Only `-electron` and `-node`
   implementations exist, and several core-ui components import `platform`.
4. **A second frontend build appears in a package that has none.** Today
   `nodegx-backend` runs `esbuild` once and emits a single CommonJS file that
   WF-003's deploy story copies to a VPS. Route (a) adds a browser bundler, a
   sass + CSS-modules pipeline for 1,242 lines of `.module.scss`, React 19 +
   react-dom, and an asset-serving route family. The "copy this file and run it"
   property is the deploy story; spending it on component reuse is a bad trade.
5. **The components are shaped for a 300px sidebar**, not an operator console.
   Reusing them would import that shape along with the code.

### Why route (b) is not a reuse loss

The spec's own risk row asks: if (b), how do the two UIs avoid drifting? The
answer is structural and stronger than a shared test suite.

**There is only one backend.** The editor panel is *already* an HTTP client of
these exact routes (through two IPC hops); the dashboard is a second HTTP client
of the same routes on the same server. There is no second implementation to
drift *from*. The existing route-walk and admin-route tests in
`packages/nodegx-backend/tests/` are the shared contract suite, and both UIs
fail together if it breaks.

Consequently the dashboard needed **two new routes** and no new data surface:

```
GET /_admin          the document
GET /_admin/whoami   credential tier + which sections this build can serve
```

Everything else rides WF-004 / BAK-001 / BAK-002 / BAK-003 / BAK-007 / WF-001 /
WF-005 routes unchanged. That is also what keeps the merge with the concurrent
WF-002 agent trivial: one added spread in the route-table literal.

### What (b) costs, honestly

Vanilla JS, hand-rolled DOM helpers, ~1,050 lines of client script and ~350 of
CSS. Nobody's favourite. It buys: zero dependencies, zero external origins,
a genuinely enforceable CSP, one build artefact, and a page that loads on a
VPS-hosted admin console in one request.

---

## 2. What shipped

### Server (`packages/nodegx-backend`)

| File | Role |
|---|---|
| `src/admin/AdminDashboardRoutes.ts` | The two routes; document assembly with a per-response CSP nonce; the feature probe |
| `src/admin/readonly.ts` | The read-only policy: safe methods + a reviewed safe-POST exception set |
| `src/admin/auth.ts` | `AuthAttemptLimiter` — the credential failure budget |
| `src/admin/ui/index.html` | The whole client: markup + script |
| `src/admin/ui/styles.css` | The stylesheet (a *copy* of the UIX-001 tokens, not an import) |

Wiring: `src/server/HttpServer.ts` (route registration, read-only refusal,
auth rate limiting), `src/security/state.ts` + `model.ts` (the read-only
credential and `Principal.readonly`), `src/config.ts` + `src/cli.ts`
(`--no-admin`, `--readonly-token`, the serve-time announcement),
`src/service.ts` (first-run/read-only status on `StartedService`),
`scripts/build.js` + `jest.config.js` (the `text` loader and its jest twin).

### The v1 feature set

Collections (browse/filter/page/create/edit/delete, **live via BAK-001 SSE**),
Schema (tables, columns, **delete table**), Users, Roles, Permissions, API keys,
Triggers (enable/disable/fire), Workflows (run), Executions (list + detail),
Email (config, templates, test send), Backups (status, archives, run now).

Sections are gated on `whoami.features`, which is **derived from the wired
subsystems** (`deps.workflows !== null`, `executions.getStatus().enabled`, …) —
not a constant. A service whose execution-history database refused to open hides
that tab rather than serving one that 503s.

### Auth, and the two deliberate honesty calls

**Read-only is a real credential tier, not a UI toggle.** `--readonly-token`
provisions `adminReadonlyToken` beside `adminToken` in the one `secrets.json`
convention. It resolves to `{ kind: 'admin', readonly: true }`, and the
**dispatcher** refuses every state-changing method before any handler runs. The
rule is coarse on purpose: a route added by a future task is refused by default
if it mutates, so the tier's promise never depends on someone remembering to
annotate a route — the same reasoning that gave BAK-003's route table its
mandatory `access` declaration. Three POSTs are on a reviewed safe list
(realtime subscribe, permission dry-run, schema *diff*); `schema/apply` and
`backups/restore` are pointedly not. Provisioning it equal to the full
credential **refuses to start**.

**First run deviates from the spec, deliberately.** The spec asked for a
Pocketbase-style one-time setup page for "a freshly deployed instance with no
admin credential set", and told me to align with BAK-003's model document. Under
BAK-003 that condition is never true: a credential is minted before anything can
be served. An unauthenticated setup route on an already-provisioned backend is a
takeover vector, and gating it on the current credential would make it a
password-change form, not a setup page. So:

- the CLI prints the dashboard URL and, when the credential was auto-minted this
  start, exactly where to read it;
- `whoami.firstRun` reports "nobody has ever chosen this credential" and the
  dashboard shows a banner saying so and how to replace it with `--token`.

No setup page exists. This is recorded as a spec deviation, not an omission.

**Dev-open is not papered over.** When `devOpen` is on the backend bypasses
every gate including the dashboard's. Rather than staging a password prompt in
front of a backend that would ignore it, the page opens directly and banners
that enforcement is off on every view.

### AI visibility

`get_backend_admin_dashboard` (noodl-mcp): enabled/disabled + reason, URL,
which credential tier the agent holds, whether a read-only tier exists, the
enforcement posture, and the section map. `--no-admin` reports
`enabled: false` rather than erroring, which required `BackendClient.request`
to gain a `tolerate` list for status codes that are answers (401 is never
tolerable).

### Docs

`docs/runtime/BACKEND-ADMIN-DASHBOARD.md` — features, sign-in, first run,
dev-open, read-only, `--no-admin`, and an **exposure** section (SSH tunnel by
default; VPN / reverse-proxy auth / IP allow-list if it must be reachable; TLS
always) with two named caveats. Linked from the package README.

---

## 3. The bug the live check caught

Worth recording, because it is exactly the failure mode this repo has paid for
before: **a green build proves nothing.**

The document is assembled by substituting the stylesheet into a marker in
`index.html`. `String.replace(marker, value)` replaces the *first* occurrence —
and the first occurrence was a mention of the marker in the file's own doc
comment. The served page returned `200`, 73,355 bytes, with the CSS text present
in the body. Every assertion I would naturally have written passed. The entire
stylesheet was inside an HTML comment and the `<style>` block was empty.

Only loading the page and looking at where the bytes landed found it. The fix is
`injectOnce()`, which counts occurrences and throws on zero or many, plus a test
that asserts each marker appears exactly the number of times it should (written
with the marker split across a concatenation so the assertion does not become
its own second occurrence).

---

## 4. Verification

**Automated.** `packages/nodegx-backend`: **283/283 green** (34 suites),
24 new in `tests/admin-dashboard.test.ts` across three levels — pure policy
(read-only rule, failure budget), document invariants (marker counts, no
external origin, no `innerHTML`, red-is-danger-only), and end-to-end over real
HTTP against a **locked** backend (CSP headers, fresh nonce per response, the
public-page/gated-whoami split, the read-only tier reading everything and
writing nothing with the right message and code, the safe-POST exception,
delete-table end-to-end, `--no-admin` returning 404, and the credential
collision interlock). Typecheck clean. Bundle builds.
`packages/noodl-mcp`: **52/52 green** (1 new, driven against a real spawned
backend); package typecheck error count unchanged at 17, all pre-existing
jasmine-matcher conflicts in test files.

**Live, by hand** — the built `dist/cli.js` run as a standalone process, hit
with curl:

| Check | Result |
|---|---|
| `GET /_admin` | 200, 73,576 bytes, CSS inside the `<style>` block, no leftover markers |
| CSP header | `default-src 'none'`, per-response nonce, no `unsafe-inline` |
| whoami, no/wrong credential (locked) | 401 / 401 |
| whoami, read-only credential | 200, `readonly: true` |
| read-only reads `/api/Widget`, `/admin/schema` | 200 |
| read-only `POST /api/Widget`, `POST /admin/schema` (deleteTable) | 403 + code 119 + the named-tier message |
| read-only `POST /admin/permissions/check` | 200 (the reviewed exception) |
| delete-table, full admin | `{"deleted":true}`, table gone from `/admin/schema` |
| 12 wrong credentials from one client | `401 ×10`, then `429` with `Retry-After: 300` — including for the *correct* credential |
| `--no-admin` | `/_admin` and `/_admin/whoami` both 404; `/health` still 200 |
| serve output | prints the dashboard URL, the read-only tier, or `DISABLED (--no-admin)` |

---

## 5. Residuals

**Needs a browser (not available to a worktree agent):**

1. **No human has looked at the rendered page.** Every server-side property is
   verified — assembly, headers, auth, refusals — and the markup is asserted
   structurally, but nobody has clicked through the eleven sections in a real
   browser. Layout bugs, a broken event handler, or a mis-shaped response field
   in a section whose response shape I read but did not exercise (Triggers'
   `status`, Workflows' list key, Backups' archive fields) would not have been
   caught. **This is the top residual.** Suggested pass: open `/_admin` against a
   dev-open local backend, walk every section, then repeat with a locked backend
   and the read-only token and confirm every write control is disabled.
2. **SSE liveness in the browser is unverified.** The `Live` toggle uses
   `EventSource` against BAK-001's `/realtime` with the token as a query param.
   The protocol is well-tested server-side, but this specific client is not —
   the `connected` → subscribe → `change` handshake has never run in a browser.
3. **Packaged verification is not done.** The spec names it explicitly, and this
   repo's packaging history makes it a real step. The dashboard has not been
   loaded from the editor-spawned service inside a packaged app.
4. **Clean-VM run not done.** Verified against the built bundle on the dev
   machine, not a fresh VM.

**Deliberately not built (each an explicit decision, not an oversight):**

5. **No first-run setup page** — see §2. Deviates from the spec's wording,
   aligned to BAK-003's posture.
6. **No "disable user" control.** No auth path honours a `disabled` flag today,
   so shipping the button would have been a security control that does nothing —
   precisely the accept-and-ignore pattern BAK-003 forbids. Making it real means
   a check in `resolvePrincipal` *and* session revocation; that belongs to a task
   that owns the auth path. The dashboard offers delete and role removal.
7. **No restore button.** The CLI with the service stopped is the blessed path;
   the route exists for automation.
8. **Whole-config permission editing** (defaults, signup, file and function
   rules) is not in the dashboard — only per-collection rules, which is where
   daily operation lives. The whole-config route and MCP cover the rest.
9. **No audit trail.** The spec defers this to BAK-009; until it exists,
   mutations are visible only through the service log and execution history.

**Known trade-offs, documented rather than fixed:**

10. **The rate limiter can lock out the operator** when an attacker shares their
    apparent client identity (direct exposure behind NAT). Documented in the
    exposure guide with the reasoning: a five-minute speed bump beats a
    permanent lockout on a service with one credential and no recovery flow.
11. **The credential lives in `sessionStorage`** and is the master key. Mitigated
    by CSP + nonce + no-`innerHTML` + the read-only tier; documented.
12. **The palette is a copy of the UIX-001 tokens, not an import**, because this
    package must not depend on `noodl-core-ui`. A test pins the phase-23 law
    that matters (red is danger only); the rest can drift and that is accepted.
