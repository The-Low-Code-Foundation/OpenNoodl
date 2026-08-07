# Access control for the local backend

The standalone NodeGX backend (`nodegx-backend`, the one the editor's **Backend
Services → Local Backends** runs, and the one you deploy) enforces
collection-level permissions and per-record access control. This page is the
operator's guide: how to lock a backend down before it leaves your machine, and
how the pieces fit. The full semantics — evaluation order, every default and
why — live in the design record,
[`dev-docs/tasks/phase-22-production-backend/BAK-003-SECURITY-MODEL.md`](../../dev-docs/tasks/phase-22-production-backend/BAK-003-SECURITY-MODEL.md).

## The one thing you must know

A fresh backend starts in **dev-open** mode: all access is relaxed so local
development is friction-free. Dev-open is **physically incapable of reaching a
deployment** — if the service is asked to bind beyond `127.0.0.1` while dev-open
is on, it **refuses to start** with an error naming the fix. You cannot
accidentally ship an open backend.

Before you deploy, you turn enforcement on (set `devOpen: false`) and decide who
can do what. That's the whole workflow.

## Principals — who a request is

| Principal | How it authenticates | Power |
|-----------|---------------------|-------|
| **Admin** | `Authorization: Bearer <adminToken>` or `X-Parse-Master-Key: <adminToken>` | Full access; bypasses all rules. The editor and ops tooling use this. |
| **API key** | `X-NodeGX-API-Key: ngxk_…` | A named, revocable, scoped server-to-server credential. |
| **User** | `X-Parse-Session-Token: r:…` (from login/signup) | An end user; carries their role memberships. |
| **Anonymous** | nothing | No identity. |

The **admin credential** is generated on first start and stored in
`<dataDir>/secrets.json` (mode 0600 — never commit it). If you passed `--token`
(the old WF-004 flag), that value becomes the admin credential. Cloud functions
run as admin automatically.

## Collection permissions (CLPs)

Every collection has a rule per operation — **find, get, create, update,
delete** (`count`, `aggregate`, and `distinct` follow `find`). A rule is one of:

- `public` — anyone, including anonymous
- `authenticated` — any logged-in user
- `role:<name>` — members of that role
- `nobody` — server-only (admin / scoped API keys)
- a comma-separated list = OR (`role:staff, role:auditor`)

The default for a fresh backend is `authenticated` for every operation. Edit
per collection in the **Permissions** panel, over MCP, or by hand in
`<dataDir>/security.json` (it deploys with the backend and diffs in review).

The system collections (`_User`, `_Session`, `_Role`, `_ApiKey`) are **not**
world-readable and cannot be opened up — a mistake that has burned every BaaS.
Users read themselves via `/users/me`; build a profile collection for anything
public.

## Per-record ACLs and creator-owns

CLPs gate *whether* an operation is allowed; per-record **ACLs** filter *which
rows* a caller sees. An ACL is Parse-shaped and lives in each row's `ACL`
column:

```json
{ "<userId>": { "read": true, "write": true }, "role:editors": { "read": true } }
```

A row with **no ACL is public** (this is what lets you turn enforcement on
without rewriting existing data). ACL filtering runs in SQL, so `count`, `limit`
and `skip` are correct and a hidden row is indistinguishable from a missing one.

Most apps want "users see only their own records." That's the **creator-owns**
toggle (on by default): when a logged-in user creates a record, the backend
stamps an `owner` pointer and a private ACL automatically. One checkbox, no
hand-written ACL JSON. The Create/Set Record nodes' *Access Control Rules* can
still set an explicit ACL when you need something other than private.

## Roles and API keys

- **Roles** are flat (no nesting). Create them and assign users in the panel or
  over MCP; reference them from CLPs and ACLs as `role:<name>`.
- **API keys** are for server-to-server callers (a cron job, a webhook sender).
  Scopes: `functions:<name>` / `functions:*` (call those functions),
  `classes:read` / `classes:write` / `classes:*` (data access, all
  collections). No scope reaches `/admin` — keys can never administer or mint
  keys. The secret is shown **once** at creation and is unrecoverable; store it
  then.

## Deploying: the checklist

1. In the **Permissions** panel, click **Turn enforcement on** (or set
   `"devOpen": false` in `security.json`).
2. Set each collection's permissions. Leave creator-owns on for per-user data.
3. Create roles and assign users as needed.
4. Issue API keys for any external services; store the secrets.
5. Deploy. The admin credential in `secrets.json` travels with the backend (keep
   it secret); end users authenticate with sessions, not the admin token.

If you deploy with dev-open still on, the service refuses to start and tells you
exactly what to change — by design.

## Authoring permissions with an agent (MCP)

The `noodl-mcp` server exposes the same surface as tools, so an AI collaborator
can author security the way it authors components:
`get_backend_permissions`, `set_collection_permissions`,
`create_backend_role` / `assign_role_user`, `create_backend_api_key`, and
`check_backend_access` — a dry-run that answers "would this principal be allowed
to do this?" without a live session, so the agent can verify a change took
effect. See the [noodl-mcp README](../../packages/noodl-mcp/README.md).

## Error codes on the wire

| Situation | HTTP | Parse code |
|-----------|------|-----------|
| Invalid session token | 400 | 209 |
| Operation forbidden (CLP / scope) | 403 | 119 |
| Row invisible/unwritable, or genuinely missing | 404 | 101 |
| Admin credential missing or wrong | 401 | — |
