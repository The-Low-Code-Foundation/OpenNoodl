# The nodegx-backend Access-Control Model (BAK-003 — decision of record)

This is the model document BAK-003 owes the rest of phase 22. It defines the
authorization semantics of the standalone backend service: who a caller can be,
what they may do, in what order that is decided, and why each default is what it
is. BAK-001 (realtime delivery checks), BAK-004 (OAuth atop sessions), BAK-005
(admin tier), and BAK-006 (file ACLs) consume this document; changing anything
here after those tasks land is a breaking change to all of them.

Everything below was designed against **verified client behavior** (what
`cloudstore.js`, `userservice.ts`, `cloudfunctions.js`, `configservice.js`
actually emit and tolerate), not against Parse documentation. Where the two
differ, the clients win.

---

## 1. Principals — who a request can be

Every request resolves to exactly one principal, in this order (first match
wins):

| # | Principal | Credential | Resolution |
|---|-----------|-----------|------------|
| 1 | **system / admin** | Master key (`X-Parse-Master-Key`) or admin bearer token (`Authorization: Bearer <adminToken>`) | Constant-time compare against the backend's admin credential. Full access; bypasses CLPs and ACLs. |
| 2 | **API key** | `X-NodeGX-API-Key: ngxk_<random>` | Hash lookup in the `_ApiKey` table. Named, revocable, scoped (§6). |
| 3 | **user** | `X-Parse-Session-Token: r:<random>` | `_Session` row → `_User` row → role memberships. An *invalid* token is a hard error (400, Parse code 209), not a downgrade to anonymous — code 209 is what makes the clients drop a stale local session. |
| 4 | **anonymous** | none | No identity, no roles. |

**Why the master key is the admin credential.** The cloud-runtime branch of
`cloudstore.js` (and the cloud `userservice.js`, `configservice.js`) already
sends `X-Parse-Master-Key` from the `_noodl_cloudservices` global on every
request — the dialect has a system credential built in; WF-004's service simply
never set one. Reusing it means cloud functions get system access with zero
client changes. The same secret doubles as the admin *bearer* token so the
editor's supervision channel, BAK-005's dashboard, and ops tooling
(`curl -H "Authorization: Bearer …"`) share one credential — defined here,
consumed by BAK-005, never redefined there.

**One credential, not two.** v1 deliberately has a single admin secret per
backend (not separate "master key" and "admin token" secrets). Two secrets with
identical power is surface without safety. BAK-005 may introduce *scoped* admin
users later; it must build them atop API-key scopes, not a second master secret.

### The system principal inside the process

Cloud functions, workflows, and triggers run **as system by default**: the
service sets `_noodl_cloudservices = { endpoint, appId, masterKey }` at startup,
so record/user/config nodes running inside a function loop back over HTTP
carrying the master key. This is the *inverse-foot-gun* decision recorded by the
spec: a function that runs as the calling user by default fails closed in
confusing ways (triggers have no calling user; classroom functions written
against "my own data" break the moment an admin calls them), and Parse itself
runs cloud code with the master key. The function author sees the caller's
identity via the Request node (`Authenticated`, `User Id`) and the existing
`allowNoAuth` gate, and makes their own decisions in graph logic.

**Run-as-caller (per-function opt-in).** A function entry in the security
config may declare `"runAs": "caller"`. Contract: loopback requests issued by
record/user nodes inside that function's runs carry the *caller's* session token
instead of the master key, so CLP + ACL enforcement applies as if the caller
made the data requests directly. Anonymous callers of such a function get
anonymous data access. This mode requires a per-run cloud-services seam in the
cloud runtime (the `_noodl_cloudservices` global is process-wide; overlapping
runs must not race credentials) — the seam is scope-keyed, set by CloudRunner
per run. If v1 ships without the seam, the config key is *rejected as unknown*
rather than silently accepted-and-ignored: accepting a security setting and not
enforcing it is the one unforgivable failure mode.

---

## 2. Credentials — where secrets live

Three stores, three lifetimes, deliberately separated:

| Store | Contents | Diffable/committable? |
|-------|----------|----------------------|
| `<dataDir>/security.json` | **Policy**: CLPs, defaults, dev-open, function/file rules, signup rule | Yes — this is the config that "deploys with the backend"; MCP-editable; no secrets ever |
| `<dataDir>/secrets.json` | **Admin credential** (plaintext, file mode 0600) | No — never commit; regenerating it is cheap |
| Database (`_ApiKey`, `_Session`, `_Role`, `_User`) | **Data-shaped credentials**: hashed API keys, session rows, role membership, hashed passwords | It's the database |

- The admin credential is generated on first start if absent. `--token <t>`
  (the WF-004 flag, kept for compatibility) writes it into `secrets.json` —
  **the WF-004 bearer token *is* the admin credential now** (§9, migration).
- API keys are stored **hashed** (scrypt, same scheme as passwords). The
  plaintext `ngxk_…` secret is returned exactly once, at creation.
- The editor reads `secrets.json` directly from the backend's data dir (it owns
  `~/.noodl/backends/<id>/`) — no bootstrap chicken-and-egg — and sends the
  admin bearer token on its proxied IPC requests.

---

## 3. Collection-level permissions (CLPs)

Per collection, per operation. Operations: **find, get, create, update,
delete**. `count`, `aggregate`, and `distinct` are governed by **find** (they
reveal exactly what find reveals). Rule values:

- `"public"` — anyone, including anonymous
- `"authenticated"` — any logged-in user
- `"role:<name>"` — members of that role
- `"nobody"` — server-only (system/admin; API keys with a matching scope)
- an **array** of the above = OR (e.g. `["role:staff", "role:auditor"]`)

Stored shape (`security.json`):

```json
{
  "version": 1,
  "devOpen": true,
  "defaults": {
    "permissions": {
      "find": "authenticated", "get": "authenticated",
      "create": "authenticated", "update": "authenticated", "delete": "authenticated"
    },
    "creatorOwns": true
  },
  "collections": {
    "Message": { "permissions": { "find": "public" }, "creatorOwns": false }
  },
  "functions": {
    "sendInvoice": { "call": "role:staff", "runAs": "system" }
  },
  "files": { "upload": "authenticated", "read": "public", "delete": "nobody" },
  "signup": "public"
}
```

A collection entry overrides the defaults *per key it names*; missing keys fall
through to `defaults`. Unknown keys anywhere in the file are a **load error**
(refuse to start), for the same reason `runAs` must not be silently ignored: a
typo'd security rule that silently no-ops is a breach with a delay timer.

**Why config-file, not database.** CLPs are code-like: they deploy with the
backend, they diff in review, an agent edits them over MCP the way it edits any
config. Role *membership* is data (it changes at runtime, per user) and lives in
the database; the role *names* referenced by CLPs are just strings — a CLP may
reference a role that doesn't exist yet (it grants nobody until the role does).

### System collections (`_`-prefixed) — fixed posture, not CLP-editable

| Collection | Posture |
|------------|---------|
| `_User` | find/get/update/delete: **nobody** via `/classes`. Signup = the `signup` rule (default `public`) on `POST /users`. Self-read via `/users/me`; self-update via `PUT /users/:id` (already self-enforced). Apps that need user directories relax nothing here — they query their own profile collection. A world-readable `_User` table is Parse's most-repeated deployment mistake; we don't ship it. |
| `_Session` | nobody, all operations, always. |
| `_Role` | nobody via data routes; managed via `/admin/roles` and MCP. |
| `_ApiKey` | nobody via data routes; managed via `/admin/keys`. Secrets never readable after creation. |

Attempts to set CLP entries for `_`-collections are rejected (400).

---

## 4. Per-record ACLs

Parse-shaped, stored in the `ACL` column every table already has:

```json
{ "<userId>": { "read": true, "write": true },
  "role:editors": { "read": true },
  "*": { "read": true } }
```

- **CLPs gate the operation; ACLs filter the rows.** Both must pass.
- `ACL` **NULL/absent = public row** (Parse semantics). This is what makes
  enforcement retrofittable: pre-BAK-003 records have no ACL and remain
  reachable (subject to CLP) the moment enforcement turns on.
- **Read access** governs find/get/count/aggregate/distinct row visibility.
  **Write access** governs update/delete. Delete requires write (Parse rule).
- **Clients may set ACLs** — verified: the Create/Set Record nodes expose
  "Access Control Rules" and `cloudstore.js` sends `ACL` on create and save;
  the server has been *stripping* it (WF-004). BAK-003 accepts it: on create,
  verbatim; on update, only when the caller has write access to the row.
  Returned records include the ACL field; verified safe — `_fromJSON` skips the
  `ACL` key on every client.
- The system/admin principal bypasses ACLs (that is what system means). API
  keys with a `classes` scope act as system for the operations their scope
  covers (§6) — server-to-server integrations are data-plane tools, not users.

### ACL filtering happens in SQL — the load-bearing engineering decision

Row filtering is compiled into the WHERE clause of every read query, **never**
post-filtered in JS. Post-filtering breaks `count` (counts rows the caller
can't see), breaks `limit`/`skip` (page 2 starts at the wrong row), and turns
O(visible) queries into O(table). The predicate, given the caller's principal
keys `K = ['*', '<userId>', 'role:a', …]` (anonymous ⇒ `K = ['*']`):

```sql
("ACL" IS NULL OR EXISTS (
   SELECT 1 FROM json_each("<table>"."ACL") je
   WHERE je.key IN (?, ?, …)             -- K, parametrized
     AND json_extract(je.value, '$.read') = 1))   -- or '$.write'
```

Verified against `node:sqlite` (SQLite 3.50.4, JSON1 built in; JSON `true`
extracts as `1`). Fully parametrized — principal keys are data, never
interpolated. The same predicate is AND-ed into select, count, distinct, and
aggregate builds; update/delete compile it into the statement's WHERE
(`… WHERE objectId = ? AND <write-predicate>`) and report "not found" when zero
rows change — atomic, no read-then-write race.

**Existence hiding:** a row the caller cannot read behaves as if it does not
exist — get/update/delete on it answer **404, Parse code 101** ("Object not
found."), identical to a truly missing id. CLP denials, by contrast, are **403,
Parse code 119** ("Permission denied…") — the operation is forbidden as a
class, which is not row-existence information. Verified client impact: none
special-cases 403/119, the error string surfaces to the app; `userservice`
handles 209 (session drop) and nothing else, so both codes are safe.

**Pointer expansion respects ACLs.** `include=` expansion of a Pointer column
fetches the target row *through the caller's read predicate*; an unreadable
target degrades to the unexpanded `{__type:'Pointer'}` envelope (same shape as
a dangling pointer — verified tolerated). Without this, `include` is a one-hop
ACL bypass.

---

## 5. Creator-owns — the 90% case as one toggle

`creatorOwns: true` on a collection (default **on**) means, at create time,
when the creator is a *user*:

1. an `owner` column (Pointer → `_User`) is stamped server-side, and
2. if the client supplied no ACL, the row gets the template ACL
   `{ "<creatorId>": { "read": true, "write": true } }`.

A client-supplied ACL wins over the template (the node UI's explicit rules are
the author's intent; the template is the fallback), but `owner` is stamped
regardless — it is the audit trail and the hook BAK-001/BAK-006 can filter on.
Anonymous and system creates stamp no owner and get no template (system
imports/seeds should not be invisibly private to nobody).

`creatorOwns` is a *create-time* behavior. Toggling it later does not rewrite
existing rows (that would be a mass data migration hiding behind a checkbox);
re-ACL-ing existing data is BAK-007 territory (export/migrate tooling).

---

## 6. Roles and API keys

**Roles** are flat — no hierarchy, no role-in-role (recorded restriction; Parse
allows nesting and it is a reliable source of privilege-escalation surprises
and cyclic-resolution bugs). Storage: `_Role` rows (`name`, unique) plus the
existing junction mechanism (`_Join_users__Role`) for membership. Referenced
from CLPs and ACLs as `role:<name>`. Membership resolves at request time (one
indexed query per request, cached on the request context).

**API keys** name *server-to-server callers* — the cron job that calls a
function, the external service pushing webhooks. Shape: `ngxk_<32 bytes
base64url>`; stored hashed; row carries `name`, `scopes`, `revoked`,
`createdAt`, `lastUsedAt`. Scopes (v1, deliberately coarse):

- `functions:<name>` / `functions:*` — may call those functions
- `classes:read` / `classes:write` / `classes:*` — data-plane access (acts as
  system for the covered operations, all collections)
- No scope covers `/admin`, key management, schema mutation, or sessions —
  keys can never mint keys, read secrets, or escalate. Only the admin
  credential administers.

Out-of-scope operations answer 403/119. Finer grain (per-collection key scopes)
is a recorded follow-on — the scope *strings* are namespaced so
`classes:read:Invoice` can arrive without breaking `classes:read`.

---

## 7. Non-class surfaces

| Surface | Rule |
|---------|------|
| `/functions/:name` | Per-function `call` rule in config (same vocabulary as CLPs); **default: `public` when the function's Request node has `allowNoAuth: true`, else `authenticated`** — the graph author already declared their intent in the one place they edit; the config overrides it when set. API keys need a `functions:` scope. |
| `/files` | Three config rules: `upload` (default `authenticated`), `read` (default `public` — served names contain 8 random bytes and are de-facto capability URLs; BAK-006 owns real per-file ACLs), `delete` (default `nobody` — the wire offers delete-by-name with no ownership link until BAK-006; a default where any user can delete any file by name is not shippable). |
| `/config` | Public. It is client-boot config; cloud functions await it on every run. Nothing secret belongs in `config-params.json` — say so in its docs. |
| `/health` | Public, unchanged (WF-004 handshake + ops probes). Reports posture (`devOpen`, enforcement on/off) — status, not secrets. |
| `/admin/*`, `/executions*`, `/api/_schema` (GET+POST), `/api/_batch` | **Admin credential only** on non-loopback binds; on loopback: open in dev-open, admin-only when `devOpen: false`. Schema mutation is admin surface wherever it is mounted. Execution history contains scrubbed-but-real payload data — operator surface, not app surface. |
| BYOB `/api/:table` CRUD | Same CLP + ACL enforcement as `/classes` (same collections, same rules; op mapping GET→find/get, POST→create, PUT→update, DELETE→delete, `_batch`→per-op). BYOB nodes send no auth headers, so against a *deployed* locked backend they are anonymous — recorded honestly: BYOB against nodegx-backend is a dev/local convenience or requires `public` CLPs; its first-class deployment story is external backends with their own auth. The Data Browser rides the editor's admin credential. |
| Sessions (`/login`, `/logout`, `/users`, `/users/me`, `PUT /users/:id`) | Self-governing (they *are* the auth system): login/logout public; signup = `signup` rule; me/update require a valid session. **Password change revokes all of the user's other sessions** (keeps the current one) — the adversarial suite's session-reuse case. |

---

## 8. Evaluation order (normative)

For every request:

```
0. Parse/route match. OPTIONS + /health short-circuit (public).
1. Resolve principal (§1). Invalid session token → 400/209, stop.
2. devOpen fast-path: if devOpen AND bound to loopback → ALLOW
   (create-time stamping of §5 still runs; posture survives the flip).
3. Route gate:
     admin family      → principal must be system/admin, else 401 (no
                         admin-existence oracle: same answer for wrong and
                         missing credentials).
     functions         → function rule (§7); keys need functions: scope.
     files             → files rule (§7).
     sessions          → per-endpoint (§7).
     data (classes/api/aggregate) → CLP for the resolved operation:
         allow if principal is system/admin,
         or key scope covers it,
         or rule grants public / authenticated / one of caller's roles.
       Deny → 403/119.
4. Row scope (data ops that touch rows):
     find/count/aggregate/distinct → AND read-ACL predicate into SQL.
     get                → read predicate; miss → 404/101.
     update/delete      → write predicate compiled into the statement;
                          0 rows changed → 404/101.
     create             → stamp owner + template ACL (§5); accept client ACL.
     include expansion  → per-target read predicate (§4).
5. Handler runs with the resolved AccessContext (principal, keys K,
   bypass flag) — handlers never re-derive identity.
```

Enforcement is **structural**: every route is declared in a route table with a
mandatory access class; the dispatcher applies the gate before any handler
runs. A route added without an access declaration does not compile (TS) and
fails the route-walk test (runtime) — this is the mitigation for the classic
"new route forgot the middleware" BaaS CVE, made a property of the code's shape
rather than of reviewer vigilance.

---

## 9. Defaults, dev-open, and the deploy interlock

- **Default posture** (fresh `security.json`, and the migration default for
  pre-existing backends): all collections `authenticated` CRUD +
  `creatorOwns: true`; system collections per §3; files/functions per §7;
  `devOpen: true`.
- **`devOpen: true`** relaxes CLP/ACL/admin gates (§8 step 2) — local
  development stays exactly as frictionless as WF-004. It is legible: `/health`
  and the panel badge report it.
- **The interlock — dev-open is physically incapable of reaching a deploy:**
  - `serve` with a non-loopback `--host` and `devOpen: true` → **refuse to
    start** (exit non-zero, message names the file, the key, and the fix).
    Not a warning. Same loud-failure doctrine as RUN-004's persistence error.
  - A non-loopback bind additionally *requires* the admin credential to exist
    (it is auto-minted on first start, so this only trips hand-rolled setups).
  - Setting `devOpen: true` over `/admin/permissions` or MCP while the service
    is bound non-loopback → 400, refused.
  - The WF-004 rule "non-loopback ⇒ bearer token on everything" is **replaced**
    by this model: data routes on a deployed backend are governed by
    CLP/ACL/sessions (an app's end users don't hold bearer tokens); admin
    routes require the admin credential. The old `--token` flag still works and
    now provisions the admin credential — a WF-004 deploy script keeps working,
    and its token holder keeps full access, now by role rather than by wall.
- **Migration (pre-existing backends):** first start under BAK-003 with no
  `security.json` writes the default file and logs a prominent one-time notice
  (also surfaced through `/health` → panel): security defaults applied,
  dev-open ON, existing records have no ACLs (reachable per CLP), flip
  `devOpen` off to test enforcement locally. No data is rewritten.

**Why default-authenticated under a default-on dev-open switch** (rather than
default-public with a "lock it later" story): the posture that ships in config
is the posture that reaches production. Making the *deployed* default safe and
the *local* relaxation explicit-but-frictionless is the only arrangement where
forgetting something fails closed.

---

## 10. Error codes (wire contract)

| Situation | HTTP | Parse code | Note |
|-----------|------|-----------|------|
| Invalid session token | 400 | 209 | Client drops stored session (verified, load-bearing) |
| CLP / scope / function-rule denial | 403 | 119 | "Permission denied for this operation." |
| Row invisible or unwritable; truly missing row | 404 | 101 | Indistinguishable by design |
| Admin gate (missing *or* wrong credential) | 401 | — | One answer; no oracle |
| Refuse-to-start (interlock) | — | — | Process exit, message names file+key+fix |

---

## 11. Contracts owed to downstream tasks

- **BAK-001 (realtime):** the security module exports
  `resolvePrincipal(headers)` and `canReadRecord(context, collection, record)`
  (the JS twin of the SQL read predicate — one evaluator, property-tested
  against the SQL form so they cannot drift). Subscription delivery must call
  `canReadRecord` per event per subscriber; CLP `find` gates subscription
  creation. The spec's "flip BAK-001's hook" item is inverted by execution
  order (BAK-003 landed first): BAK-001 consumes this contract from day one.
- **BAK-004 (OAuth):** OAuth flows mint the same `_Session` rows; nothing here
  changes. `signup` rule applies to OAuth-driven user creation.
- **BAK-005 (dashboard):** authenticates with the admin credential (§1); renders
  the same permissions editor against the same `/admin/permissions` routes.
  Must not invent a second credential class outside §6 scopes.
- **BAK-006 (files):** replaces the three coarse file rules with per-file
  ownership/ACLs; §7's defaults are its starting posture; `owner` stamping (§5)
  is its ownership link.
- **MCP:** a backend tool group (HTTP against a running service, discovery via
  `~/.noodl/backends/`, admin credential from `secrets.json`) exposes:
  enumerate/set CLPs, roles CRUD + membership, key issue/revoke, and
  `check_access` (server-side dry-run: principal descriptor + collection + op →
  allowed/denied + which rule decided). Config writes go through the service
  when it is running (single writer); the file is the source of truth either way.

## 12. Explicitly out of scope (recorded escape hatches)

- **Field-level permissions and rule-expression DSL** (Pocketbase-style
  filters): CLP+ACL+creator-owns covers the wedge; a rule DSL is a possible
  BAK follow-on *iff* real usage demands it. The CLP value vocabulary is
  strings-and-arrays precisely so a `{"expr": …}` object variant can be added
  non-breakingly.
- **Role hierarchies** (§6). **MFA/SSO** (phase-level park). **Per-collection
  key scopes** (§6, namespaced-string forward-compatible). **Re-ACL migration
  tooling** (BAK-007).
