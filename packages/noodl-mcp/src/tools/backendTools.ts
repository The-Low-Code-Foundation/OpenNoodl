/**
 * Backend permission tools (BAK-003) — the agent-authors-security surface.
 *
 * These are the MCP twin of the editor's Backend Services permissions panel:
 * they enumerate and edit collection permissions, roles, and API keys against
 * a RUNNING nodegx-backend over HTTP (see ../backend/client). This is the one
 * tool group that touches a live service; every other noodl-mcp tool is
 * file-only. Read tools always register; the mutating tools gate on
 * --allow-writes like the rest of the server.
 *
 * The wedge the model doc calls out — "an agent can, via MCP alone: lock a
 * collection to a role, create the role, assign a user, verify the effect" —
 * is exactly these tools plus `check_backend_access` (the server-side dry run).
 *
 * @module noodl-mcp/tools/backendTools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { BackendClient, listBackends, requireBackend } from '../backend/client';
import { guarded, jsonResult } from './util';

const ruleValue = z
  .union([z.string(), z.array(z.string())])
  .describe('A permission rule: "public" | "authenticated" | "nobody" | "role:<name>", or an array of those (OR).');

const clpShape = z
  .object({
    find: ruleValue.optional(),
    get: ruleValue.optional(),
    create: ruleValue.optional(),
    update: ruleValue.optional(),
    delete: ruleValue.optional()
  })
  .describe('Per-operation permission rules. Omitted operations inherit the backend defaults.');

const scopeList = z
  .array(z.string())
  .describe('API-key scopes: classes:read | classes:write | classes:* | functions:<name> | functions:*');

export function registerBackendReadTools(server: McpServer): void {
  server.registerTool(
    'list_backends',
    {
      title: 'List backends',
      description:
        'List the local nodegx-backend services configured under ~/.noodl/backends (id, name, port, and whether ' +
        "each is currently reachable). Use a backend's id as `backendId` in the other backend tools.",
      inputSchema: {}
    },
    guarded(async () => {
      const backends = listBackends();
      const rows: {
        id: string;
        name: string;
        port: number;
        reachable: boolean;
        hasAdminCredential: boolean;
      }[] = [];
      for (const b of backends) {
        // Reachability without throwing — a stopped backend still lists.
        const reachable = await new BackendClient(b).isReachable();
        rows.push({ id: b.id, name: b.name, port: b.port, reachable, hasAdminCredential: Boolean(b.adminToken) });
      }
      return jsonResult({ backends: rows });
    })
  );

  server.registerTool(
    'get_backend_permissions',
    {
      title: 'Get backend permissions',
      description:
        'The full access-control config of a running backend (BAK-003): collection-level permissions, ' +
        'per-collection creator-owns, function/file rules, signup rule, and whether enforcement is active ' +
        '(dev-open off).',
      inputSchema: {
        backendId: z.string().optional().describe('Which backend (omit if exactly one is running)')
      }
    },
    guarded(async ({ backendId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', '/admin/permissions');
      return jsonResult(json);
    })
  );

  server.registerTool(
    'list_backend_roles',
    {
      title: 'List backend roles',
      description: 'List roles on a running backend, each with its member user ids.',
      inputSchema: { backendId: z.string().optional().describe('Which backend (omit if exactly one is running)') }
    },
    guarded(async ({ backendId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', '/admin/roles');
      return jsonResult(json);
    })
  );

  server.registerTool(
    'list_backend_api_keys',
    {
      title: 'List backend API keys',
      description:
        'List API keys on a running backend (name, scopes, revoked, timestamps). Secrets are never returned — ' +
        'they are shown once at creation and are unrecoverable by design.',
      inputSchema: { backendId: z.string().optional().describe('Which backend (omit if exactly one is running)') }
    },
    guarded(async ({ backendId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', '/admin/keys');
      return jsonResult(json);
    })
  );

  server.registerTool(
    'list_backend_triggers',
    {
      title: 'List backend triggers',
      description:
        'List the automation triggers (WF-005) configured on a running backend: schedule (cron), webhook, and ' +
        'db-change, each with its target function, enabled state, and last-fired / next-fire / last-result status. ' +
        'This is how an agent sees what automation already exists before adding more.',
      inputSchema: { backendId: z.string().optional().describe('Which backend (omit if exactly one is running)') }
    },
    guarded(async ({ backendId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', '/admin/triggers');
      return jsonResult(json);
    })
  );

  server.registerTool(
    'get_backend_trigger',
    {
      title: 'Get a backend trigger',
      description: 'The full definition + status of one trigger by id on a running backend.',
      inputSchema: {
        backendId: z.string().optional(),
        id: z.string().describe('The trigger id (from list_backend_triggers)')
      }
    },
    guarded(async ({ backendId, id }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', `/admin/triggers/${encodeURIComponent(id)}`);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'list_backend_workflows',
    {
      title: 'List backend workflows',
      description:
        'List the WF-001 workflow definitions on a running backend: multi-step, error-routed, cancellable ' +
        'server executions. Each shows its steps, entry, concurrency cap, and timeouts. This is how an agent ' +
        'sees what multi-step automation already exists before authoring more. (A "workflow" here is the WF-001 ' +
        'engine artifact — distinct from a single cloud function.)',
      inputSchema: { backendId: z.string().optional().describe('Which backend (omit if exactly one is running)') }
    },
    guarded(async ({ backendId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', '/admin/workflow-defs');
      return jsonResult(json);
    })
  );

  server.registerTool(
    'get_backend_workflow',
    {
      title: 'Get a backend workflow',
      description: 'The full definition of one WF-001 workflow by id on a running backend (steps, edges, timeouts).',
      inputSchema: {
        backendId: z.string().optional(),
        id: z.string().describe('The workflow id (from list_backend_workflows)')
      }
    },
    guarded(async ({ backendId, id }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', `/admin/workflow-defs/${encodeURIComponent(id)}`);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'list_backend_step_kinds',
    {
      title: 'List backend workflow step kinds',
      description:
        'The step vocabulary a backend can run (WF-002): every step `kind` with its params, routes, output shape ' +
        'and when to use it — call-function, branch, switch, for-each, merge, retry, stop, wait, wait-until — ' +
        'PLUS `valueLanguage` (WFA-003): how a param references data ($path / $literal), what a $path may ' +
        'address (body, trigger, previous, upstream.<stepId>), and the one payload shape every entry point ' +
        'delivers. CALL THIS BEFORE AUTHORING A WORKFLOW. A workflow step is not a canvas node, so these are ' +
        'NOT in the node catalog (list_node_types); this is where their contract lives, and it is served by the ' +
        'running backend so it can never drift from what that backend actually executes.',
      inputSchema: { backendId: z.string().optional().describe('Which backend (omit if exactly one is running)') }
    },
    guarded(async ({ backendId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', '/admin/workflow-step-kinds');
      return jsonResult(json);
    })
  );

  server.registerTool(
    'get_backend_email_config',
    {
      title: 'Get backend email config',
      description:
        'The email subsystem config (BAK-002) of a running backend: SMTP host/port/security/username, ' +
        'from-address/name, the base-URL setting (also used by BAK-004), the verification policy ' +
        '(sendOnSignup/requireForLogin), and whether email is currently configured/enabled. Never returns the ' +
        'SMTP password — only whether one is set (`hasSmtpPassword`).',
      inputSchema: { backendId: z.string().optional().describe('Which backend (omit if exactly one is running)') }
    },
    guarded(async ({ backendId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', '/admin/email/config');
      return jsonResult(json);
    })
  );

  server.registerTool(
    'list_backend_email_templates',
    {
      title: 'List backend email templates',
      description:
        'Enumerate this backend\'s email templates (currently: passwordReset, verifyEmail). For each: the ' +
        'shipped default, any per-backend override, the effective (merged) template actually sent, and whether ' +
        'it is overridden.',
      inputSchema: { backendId: z.string().optional().describe('Which backend (omit if exactly one is running)') }
    },
    guarded(async ({ backendId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', '/admin/email/templates');
      return jsonResult(json);
    })
  );

  server.registerTool(
    'preview_backend_email_template',
    {
      title: 'Preview a backend email template',
      description: 'Render a template (default merged with any override) against sample variables, without sending anything.',
      inputSchema: {
        backendId: z.string().optional(),
        templateId: z.enum(['passwordReset', 'verifyEmail']).describe('Which template to preview')
      }
    },
    guarded(async ({ backendId, templateId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', `/admin/email/templates/${encodeURIComponent(templateId)}/preview`);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'get_backend_admin_dashboard',
    {
      title: 'Get the backend admin dashboard status',
      description:
        'Whether a running backend serves its own web admin dashboard (BAK-005), where it is, and what it exposes. ' +
        'Answers: the URL to send a human to, whether the credential in use is the FULL admin tier or the ' +
        'read-only one, whether a read-only tier is provisioned at all, whether enforcement is active or the ' +
        'backend is in dev-open (in which case the dashboard is reachable with no credential), and which sections ' +
        'this build can actually serve. A backend started with --no-admin reports `enabled: false` rather than ' +
        'erroring — that is an answer, not a failure.',
      inputSchema: { backendId: z.string().optional().describe('Which backend (omit if exactly one is running)') }
    },
    guarded(async ({ backendId }) => {
      const client = await requireBackend(backendId);
      const { status, json } = await client.request('GET', '/_admin/whoami', undefined, [404]);
      if (status === 404) {
        return jsonResult({
          enabled: false,
          reason:
            'This backend was started with --no-admin, so the /_admin routes are not registered at all. ' +
            'Restart it without that flag to serve the dashboard.'
        });
      }
      const data = (json || {}) as Record<string, any>;
      const backend = (data.backend || {}) as Record<string, unknown>;
      return jsonResult({
        enabled: true,
        url: `http://127.0.0.1:${client.descriptor.port}/_admin`,
        credentialTier: data.readonly ? 'read-only' : 'full-admin',
        backend,
        security: data.security,
        firstRun: data.firstRun,
        sections: data.features,
        note: data.readonly
          ? 'The credential this server holds is the READ-ONLY tier: it can read everything and change nothing.'
          : undefined
      });
    })
  );

  server.registerTool(
    'check_backend_access',
    {
      title: 'Check backend access (dry run)',
      description:
        'Ask a running backend what the enforcement WOULD decide for a hypothetical principal — without a ' +
        'session. Answers allowed/denied and which rule decided. Provide `collection`+`op` for a data check, ' +
        'or `functionName` for a function check; optionally a `record` (with an ACL) for a row-level answer. ' +
        'This is how you verify a permission change took effect.',
      inputSchema: {
        backendId: z.string().optional(),
        principal: z
          .object({
            kind: z.enum(['anonymous', 'user', 'apiKey', 'admin']).describe('Principal kind'),
            userId: z.string().optional().describe('Required for kind "user"'),
            roles: z.array(z.string()).optional().describe('Override resolved roles (hypothetical)'),
            scopes: z.array(z.string()).optional().describe('For kind "apiKey"'),
            name: z.string().optional()
          })
          .describe('The principal to test'),
        collection: z.string().optional().describe('Collection for a data check'),
        op: z.enum(['find', 'get', 'create', 'update', 'delete']).optional(),
        functionName: z.string().optional().describe('Function for a function-call check'),
        record: z.record(z.unknown()).optional().describe('A record (with ACL) for a row-level answer')
      }
    },
    guarded(async ({ backendId, ...body }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', '/admin/permissions/check', body);
      return jsonResult(json);
    })
  );

  // ==========================================================================
  // Backups / export / promotion (BAK-007) — read surface
  // ==========================================================================

  server.registerTool(
    'list_backend_backups',
    {
      title: 'List backend backups',
      description:
        'List a running backend\'s backup archives (newest first) plus the backup policy and status (BAK-007): ' +
        'schedule, retention, destination, last success/failure, and next scheduled run. This is how an agent ' +
        'sees whether backups are configured and healthy before relying on them.',
      inputSchema: { backendId: z.string().optional().describe('Which backend (omit if exactly one is running)') }
    },
    guarded(async ({ backendId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', '/admin/backups');
      return jsonResult(json);
    })
  );

  server.registerTool(
    'export_backend_collection',
    {
      title: 'Export a backend collection',
      description:
        'Export one collection from a running backend as lossless JSON (types, ACLs, pointers, and the schema) or ' +
        'flat CSV (spreadsheet-shaped; pointers as ids, objects as JSON strings). Returns the serialized content.',
      inputSchema: {
        backendId: z.string().optional(),
        collection: z.string().describe('The collection (class) to export'),
        format: z.enum(['json', 'csv']).optional().describe('Export format (default json)')
      }
    },
    guarded(async ({ backendId, collection, format }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request(
        'GET',
        `/admin/export/${encodeURIComponent(collection)}?format=${format || 'json'}`
      );
      return jsonResult(json);
    })
  );

  server.registerTool(
    'diff_backend_schema',
    {
      title: 'Diff a schema against a backend (promotion dry-run)',
      description:
        'Compute the dev->prod promotion diff between a SOURCE schema snapshot and a running (target) backend ' +
        '(BAK-007): which tables/columns and which permission/trigger/template config would be added or changed, ' +
        'and whether any change is destructive. Read-only — nothing is applied. The `source` is a snapshot ' +
        '{ tables:[{name,columns}], permissions?, triggers?, templates? } (e.g. from a dev backend or archive).',
      inputSchema: {
        backendId: z.string().optional().describe('The TARGET backend to diff against'),
        source: z.record(z.unknown()).describe('The source schema snapshot { tables: [...], permissions?, triggers?, templates? }')
      }
    },
    guarded(async ({ backendId, source }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', '/admin/schema/diff', { source });
      return jsonResult(json);
    })
  );

  server.registerTool(
    'get_backend_search_config',
    {
      title: 'Get backend full-text search config',
      description:
        'The full-text search config of a running backend (BAK-008): which collections have search enabled, on ' +
        'which fields, with which tokenizer, plus whether the engine actually has the SQLite FTS5 extension ' +
        '(`fts5Available`) — search cannot be enabled without it, and there is no degraded fallback.',
      inputSchema: {
        backendId: z.string().optional().describe('Which backend (omit if exactly one is running)')
      }
    },
    guarded(async ({ backendId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', '/admin/search');
      return jsonResult(json);
    })
  );

  server.registerTool(
    'get_backend_file_config',
    {
      title: 'Get backend file storage config',
      description:
        'The file-storage config of a running backend (BAK-006): max upload size, content-type allow/deny lists, ' +
        'which storage driver is active (local disk or S3-compatible) and its non-secret shape, thumbnail presets, ' +
        'the signed-URL TTL, the orphan-sweep schedule and its last report, and whether image transforms are ' +
        'actually available right now (sharp is an optional native dependency — `transformsAvailable: false` with ' +
        'a `transformUnavailableReason` is an expected, non-broken state, not an error).',
      inputSchema: { backendId: z.string().optional().describe('Which backend (omit if exactly one is running)') }
    },
    guarded(async ({ backendId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', '/admin/files/config');
      return jsonResult(json);
    })
  );

  // --------------------------------------------------------------------------
  // BAK-009 — operational config and the audit trail.
  //
  // Both are READ tools on purpose. An agent debugging its own backend needs to
  // see why it is being refused (rate limits) and what it has already changed
  // (the trail); neither question needs write access, and an agent that could
  // raise its own rate limit would make the limit meaningless.
  // --------------------------------------------------------------------------

  server.registerTool(
    'get_backend_ops_config',
    {
      title: 'Get backend operational config',
      description:
        "A running backend's operational config (BAK-009): rate-limit policies per route class and which proxies " +
        'are trusted for X-Forwarded-For, log level and format, CORS origins, audit retention, and whether the ' +
        'metrics endpoint is served. Read this when requests are coming back 429 — the response says which ' +
        'CLASS a route belongs to and what its budget is, which is usually the whole answer.',
      inputSchema: { backendId: z.string().optional().describe('Which backend (omit if exactly one is running)') }
    },
    guarded(async ({ backendId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', '/admin/ops');
      return jsonResult(json);
    })
  );

  server.registerTool(
    'query_backend_audit',
    {
      title: 'Query the backend audit trail',
      description:
        'The privileged-action trail of a running backend (BAK-009): permission and role edits, key issue/revoke, ' +
        'schema changes, backups and restores, config edits, and admin logins including failures — each with the ' +
        'actor, the origin address, the outcome, and the request id that ties it to the access log. Newest first. ' +
        'Use it to answer "what did I already change on this backend?" without re-reading every config surface. ' +
        'Note the honest limit: the trail is a plain table in the backend\'s own database, so anyone who can reach ' +
        'that file can edit it.',
      inputSchema: {
        backendId: z.string().optional().describe('Which backend (omit if exactly one is running)'),
        action: z
          .string()
          .optional()
          .describe('Filter to one action name, e.g. "permissions.collection.update". The response lists them all.'),
        outcome: z.enum(['success', 'failure']).optional().describe('Filter to successes or failures'),
        actorKind: z
          .enum(['admin', 'admin:readonly', 'user', 'apiKey', 'anonymous'])
          .optional()
          .describe('Filter by who acted'),
        sinceMinutes: z.number().optional().describe('Only entries from the last N minutes'),
        limit: z.number().optional().describe('Max entries (default 100, max 1000)')
      }
    },
    guarded(async ({ backendId, action, outcome, actorKind, sinceMinutes, limit }) => {
      const client = await requireBackend(backendId);
      const params = new URLSearchParams();
      if (action) params.set('action', action);
      if (outcome) params.set('outcome', outcome);
      if (actorKind) params.set('actorKind', actorKind);
      if (sinceMinutes) params.set('since', String(Date.now() - sinceMinutes * 60_000));
      if (limit) params.set('limit', String(limit));
      const query = params.toString();
      const { json } = await client.request('GET', `/admin/audit${query ? `?${query}` : ''}`);
      return jsonResult(json);
    })
  );

  // --------------------------------------------------------------------------
  // BAK-004 — sign-in providers.
  //
  // This is the read half of "an agent can configure a provider via MCP and
  // wire the node". The response carries the COMPUTED CALLBACK URL for each
  // provider, which is the one string a human must paste into the provider's
  // console — an agent that cannot produce it cannot finish the job, and a
  // wrong one is the single most common way OAuth setup fails.
  // --------------------------------------------------------------------------

  server.registerTool(
    'get_backend_auth_config',
    {
      title: 'Get backend sign-in providers',
      description:
        'How end users can sign in to a running backend (BAK-004): the configured OAuth/OIDC providers with their ' +
        'kind, issuer, scopes and READY state, the exact callback URL to register in each provider console, ' +
        'whether magic-link sign-in is usable (it needs both its own switch and working SMTP), the redirect ' +
        'allow-list, and the account-linking policy. Client secrets are never returned — each provider reports ' +
        '`hasClientSecret` instead. A provider with `ready: false` carries `notReadyReason` naming the missing ' +
        'field, which is usually the whole answer when sign-in is failing.',
      inputSchema: { backendId: z.string().optional().describe('Which backend (omit if exactly one is running)') }
    },
    guarded(async ({ backendId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('GET', '/admin/auth');
      return jsonResult(json);
    })
  );

  server.registerTool(
    'list_user_identities',
    {
      title: "List a user's linked sign-in methods",
      description:
        'Which providers a given user can sign in with on a running backend, and whether they also have a ' +
        'password. Reads the `_UserIdentity` rows directly through the admin data surface. Useful when a user ' +
        'reports "I cannot sign in" — an account with no password and no identity has no way in at all.',
      inputSchema: {
        backendId: z.string().optional(),
        userId: z.string().describe('The _User objectId')
      }
    },
    guarded(async ({ backendId, userId }) => {
      const client = await requireBackend(backendId);
      const where = encodeURIComponent(JSON.stringify({ userId }));
      const { json } = await client.request('GET', `/api/_UserIdentity?where=${where}`);
      return jsonResult(json);
    })
  );
}

export function registerBackendWriteTools(server: McpServer): void {
  server.registerTool(
    'set_collection_permissions',
    {
      title: 'Set collection permissions',
      description:
        "Lock or open a collection's permissions on a running backend (BAK-003). Sets per-operation rules and/or " +
        'creator-owns for one collection; the config is persisted to the backend and deploys with it. Rejected ' +
        '(with the reason) if a rule is malformed or names a system collection.',
      inputSchema: {
        backendId: z.string().optional(),
        collection: z.string().describe('The collection (class) to configure — not a system (_-prefixed) collection'),
        permissions: clpShape.optional(),
        creatorOwns: z.boolean().optional().describe('Stamp owner + a private template ACL on create')
      }
    },
    guarded(async ({ backendId, collection, permissions, creatorOwns }) => {
      const client = await requireBackend(backendId);
      const body: Record<string, unknown> = {};
      if (permissions !== undefined) body.permissions = permissions;
      if (creatorOwns !== undefined) body.creatorOwns = creatorOwns;
      const { json } = await client.request(
        'PUT',
        `/admin/permissions/collections/${encodeURIComponent(collection)}`,
        body
      );
      return jsonResult(json);
    })
  );

  server.registerTool(
    'reset_collection_permissions',
    {
      title: 'Reset collection permissions',
      description: "Remove a collection's permission overrides so it reverts to the backend defaults.",
      inputSchema: {
        backendId: z.string().optional(),
        collection: z.string().describe('The collection to revert to defaults')
      }
    },
    guarded(async ({ backendId, collection }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request(
        'DELETE',
        `/admin/permissions/collections/${encodeURIComponent(collection)}`
      );
      return jsonResult(json);
    })
  );

  server.registerTool(
    'create_backend_role',
    {
      title: 'Create backend role',
      description: 'Create a role on a running backend. Roles are referenced from permissions as "role:<name>".',
      inputSchema: {
        backendId: z.string().optional(),
        name: z.string().describe('Role name (letters, digits, _ and - only)')
      }
    },
    guarded(async ({ backendId, name }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', '/admin/roles', { name });
      return jsonResult(json);
    })
  );

  server.registerTool(
    'delete_backend_role',
    {
      title: 'Delete backend role',
      description: 'Delete a role (and its memberships) from a running backend.',
      inputSchema: { backendId: z.string().optional(), name: z.string().describe('Role to delete') }
    },
    guarded(async ({ backendId, name }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('DELETE', `/admin/roles/${encodeURIComponent(name)}`);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'assign_role_user',
    {
      title: 'Assign / remove a role member',
      description:
        'Add or remove a user from a role on a running backend. Set `remove: true` to revoke membership.',
      inputSchema: {
        backendId: z.string().optional(),
        role: z.string().describe('Role name'),
        userId: z.string().describe('The _User objectId to assign'),
        remove: z.boolean().optional().describe('Remove instead of add')
      }
    },
    guarded(async ({ backendId, role, userId, remove }) => {
      const client = await requireBackend(backendId);
      const json = remove
        ? (await client.request('DELETE', `/admin/roles/${encodeURIComponent(role)}/users/${encodeURIComponent(userId)}`))
            .json
        : (await client.request('POST', `/admin/roles/${encodeURIComponent(role)}/users`, { userId })).json;
      return jsonResult(json);
    })
  );

  server.registerTool(
    'set_backend_email_config',
    {
      title: 'Set backend email config',
      description:
        'Configure the email subsystem (BAK-002) on a running backend: SMTP host/port/security/username, ' +
        'from-address/name, the base-URL (shared with BAK-004 — set it once here), and the verification policy. ' +
        'Pass `smtpPassword` to (re)set the SMTP credential — it is stored in the backend\'s secrets.json, never ' +
        'echoed back by any read tool. Omitted fields keep their current value.',
      inputSchema: {
        backendId: z.string().optional(),
        enabled: z.boolean().optional().describe('Master on/off switch for sending mail'),
        smtp: z
          .object({
            host: z.string().optional(),
            port: z.number().optional(),
            secure: z.boolean().optional().describe('true = implicit TLS (~465); false = STARTTLS/plaintext (~587/25)'),
            username: z.string().optional()
          })
          .optional(),
        smtpPassword: z.string().optional().describe('The SMTP credential — write-only, stored in secrets.json'),
        fromAddress: z.string().optional(),
        fromName: z.string().optional(),
        baseUrl: z.string().optional().describe('The backend\'s deployed origin, e.g. "https://api.example.com" — used to build links in emails'),
        verification: z
          .object({
            sendOnSignup: z.boolean().optional().describe('Send a verification email automatically on signup'),
            requireForLogin: z.boolean().optional().describe('Block login until emailVerified is true')
          })
          .optional()
      }
    },
    guarded(async ({ backendId, smtpPassword, ...config }) => {
      const client = await requireBackend(backendId);
      const body: Record<string, unknown> = { config };
      if (smtpPassword !== undefined) body.smtpPassword = smtpPassword;
      const { json } = await client.request('PUT', '/admin/email/config', body);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'send_backend_test_email',
    {
      title: 'Send a backend test email',
      description:
        'Send a real test email through a running backend\'s configured SMTP right now. Throws loudly with the ' +
        'actionable reason if email is not configured — this is the admin-authenticated surface where loud ' +
        'failure applies (unlike the public reset/verify endpoints, which stay uniform for anti-enumeration).',
      inputSchema: { backendId: z.string().optional(), to: z.string().describe('Address to send the test email to') }
    },
    guarded(async ({ backendId, to }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', '/admin/email/test', { to });
      return jsonResult(json);
    })
  );

  server.registerTool(
    'set_backend_email_template',
    {
      title: 'Set a backend email template override',
      description:
        'Override one email template\'s subject/text/html for this backend. Omitted fields fall back to the ' +
        'shipped default (a partial override, not a full replacement). Use {{variable}} for interpolation — ' +
        'passwordReset gets appName/username/resetUrl/expiresIn; verifyEmail gets appName/username/verifyUrl.',
      inputSchema: {
        backendId: z.string().optional(),
        templateId: z.enum(['passwordReset', 'verifyEmail']),
        subject: z.string().optional(),
        text: z.string().optional(),
        html: z.string().optional()
      }
    },
    guarded(async ({ backendId, templateId, subject, text, html }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('PUT', `/admin/email/templates/${encodeURIComponent(templateId)}`, {
        subject,
        text,
        html
      });
      return jsonResult(json);
    })
  );

  server.registerTool(
    'reset_backend_email_template',
    {
      title: 'Reset a backend email template to its default',
      description: 'Remove a template override so it reverts to the shipped default.',
      inputSchema: { backendId: z.string().optional(), templateId: z.enum(['passwordReset', 'verifyEmail']) }
    },
    guarded(async ({ backendId, templateId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('DELETE', `/admin/email/templates/${encodeURIComponent(templateId)}`);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'create_backend_api_key',
    {
      title: 'Create backend API key',
      description:
        'Issue a scoped, revocable API key for server-to-server callers on a running backend. The plaintext ' +
        'secret is returned EXACTLY ONCE — store it now; it is unrecoverable afterwards.',
      inputSchema: {
        backendId: z.string().optional(),
        name: z.string().describe('A human label for the key'),
        scopes: scopeList
      }
    },
    guarded(async ({ backendId, name, scopes }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', '/admin/keys', { name, scopes });
      return jsonResult({ ...(json as object), note: 'Store `secret` now — it is not recoverable.' });
    })
  );

  server.registerTool(
    'revoke_backend_api_key',
    {
      title: 'Revoke backend API key',
      description: 'Revoke an API key by its objectId (from list_backend_api_keys). The key stops working immediately.',
      inputSchema: { backendId: z.string().optional(), objectId: z.string().describe('The key objectId to revoke') }
    },
    guarded(async ({ backendId, objectId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('DELETE', `/admin/keys/${encodeURIComponent(objectId)}`);
      return jsonResult(json);
    })
  );

  // ==========================================================================
  // Triggers (WF-005) — the agent-authors-automation surface
  // ==========================================================================

  const triggerFields = {
    type: z.enum(['schedule', 'webhook', 'db-change']).describe('Trigger type'),
    name: z.string().optional().describe('Human label'),
    enabled: z.boolean().optional().describe('Enabled (default true)'),
    target: z
      .object({
        kind: z.enum(['function', 'workflow']),
        name: z.string().describe('The function name, or the workflow id when kind is "workflow"')
      })
      .describe('What this trigger invokes: a cloud function, or a WF-001 workflow (kind "workflow", name = workflow id)'),
    schedule: z
      .object({
        cron: z.string().describe('5-field cron or @preset (@hourly/@daily/…). Local timezone.'),
        missedFirePolicy: z.enum(['skip', 'run-once-on-start']).describe('What to do about fires missed while down')
      })
      .optional()
      .describe('Required for type "schedule"'),
    webhook: z
      .object({
        slug: z.string().describe('URL slug: POST /hooks/<backendId>/<slug>'),
        scheme: z.enum(['hmac-sha256', 'token']).optional().describe('Secret scheme (default hmac-sha256)'),
        maxBodyBytes: z.number().optional().describe('Body size limit (default 1MB)')
      })
      .optional()
      .describe('Required for type "webhook"'),
    dbChange: z
      .object({
        collection: z.string(),
        actions: z.array(z.enum(['create', 'update', 'delete'])).describe('Which post-commit actions fire it')
      })
      .optional()
      .describe('Required for type "db-change"'),
    secret: z.string().optional().describe('Webhook only: set an explicit secret (else one is minted and returned once)')
  };

  server.registerTool(
    'create_backend_trigger',
    {
      title: 'Create a backend trigger',
      description:
        'Add an automation trigger to a running backend (WF-005): a cron schedule, an incoming webhook, or a ' +
        'db-change event, each invoking a designated cloud function. For a webhook, the per-hook secret is ' +
        'returned EXACTLY ONCE (store it now) — point the sender at POST /hooks/<backendId>/<slug> with an ' +
        'X-Hub-Signature-256 HMAC (or the token scheme). The definition is persisted and deploys with the backend.',
      inputSchema: { backendId: z.string().optional(), ...triggerFields }
    },
    guarded(async ({ backendId, ...body }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', '/admin/triggers', body);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'update_backend_trigger',
    {
      title: 'Update a backend trigger',
      description:
        'Replace a trigger definition by id on a running backend. Same fields as create. A webhook keeps its ' +
        'existing secret, so changing a cron or a target does NOT break senders — but changing webhook.slug ' +
        'changes the URL, and sending `secret` REPLACES it (use rotate_backend_trigger_secret for that, ' +
        'deliberately). The `type` cannot be changed: a different type is a different trigger. Unknown id → 404.',
      inputSchema: { backendId: z.string().optional(), id: z.string().describe('The trigger id'), ...triggerFields }
    },
    guarded(async ({ backendId, id, ...body }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('PUT', `/admin/triggers/${encodeURIComponent(id)}`, body);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'set_backend_trigger_enabled',
    {
      title: 'Enable / disable a backend trigger',
      description: 'Turn a trigger on or off without deleting it.',
      inputSchema: {
        backendId: z.string().optional(),
        id: z.string().describe('The trigger id'),
        enabled: z.boolean()
      }
    },
    guarded(async ({ backendId, id, enabled }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', `/admin/triggers/${encodeURIComponent(id)}/enabled`, { enabled });
      return jsonResult(json);
    })
  );

  server.registerTool(
    'rotate_backend_trigger_secret',
    {
      title: 'Rotate a webhook trigger secret',
      description:
        'Mint a NEW secret for a webhook trigger and return it once (WFA-008). Every sender still using the ' +
        'previous secret is rejected from this moment until it is given the new one, so do this only when asked ' +
        'to. Editing a webhook does not need it — an update keeps the existing secret.',
      inputSchema: { backendId: z.string().optional(), id: z.string().describe('The webhook trigger id') }
    },
    guarded(async ({ backendId, id }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', `/admin/triggers/${encodeURIComponent(id)}/secret`);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'delete_backend_trigger',
    {
      title: 'Delete a backend trigger',
      description: 'Remove a trigger (and its webhook secret) from a running backend by id.',
      inputSchema: { backendId: z.string().optional(), id: z.string().describe('The trigger id to delete') }
    },
    guarded(async ({ backendId, id }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('DELETE', `/admin/triggers/${encodeURIComponent(id)}`);
      return jsonResult(json);
    })
  );

  // ==========================================================================
  // Workflows (WF-001) — the agent-authors-multi-step-automation surface
  // ==========================================================================

  const workflowStep = z.object({
    id: z.string().describe('Unique within the workflow; also the execution-history nodeId'),
    name: z.string().optional(),
    kind: z
      .enum(['call-function', 'branch', 'switch', 'for-each', 'merge', 'retry', 'stop', 'wait', 'wait-until'])
      .describe(
        'What the step runs. call-function invokes a cloud function (WF-001); the rest are WF-002 Series-1 ' +
          'kinds. Call list_backend_step_kinds for each kind\'s params, routes and output shape.'
      ),
    ref: z
      .string()
      .optional()
      .describe('The cloud function to invoke. Required for call-function, for-each and retry; invalid on the others.'),
    params: z
      .record(z.unknown())
      .optional()
      .describe(
        "Params merged into the step input, and the kind's own configuration (condition, cases, …). A param may " +
          'be a literal OR a reference: {"$path":"body.total"} reads the caller\'s data, ' +
          '{"$path":"previous.result.x"} the last step\'s output, {"$path":"upstream.<stepId>.x"} a named earlier ' +
          'step (use this when a branch sits in between), {"$literal":…} escapes. No arithmetic — compute in a ' +
          'cloud function. A reference to a step that does not exist, or is not upstream, is REJECTED at write ' +
          'time. Full spec in list_backend_step_kinds → valueLanguage.'
      ),
    timeoutMs: z.number().optional().describe('Per-step timeout (0/omitted = the workflow default)'),
    next: z
      .array(z.string())
      .optional()
      .describe('UNCONDITIONAL success edges: reachable when this step succeeds, whatever it decided'),
    routes: z
      .record(z.array(z.string()))
      .optional()
      .describe(
        'CONDITIONAL named success edges, e.g. {"ontrue":["s2"],"onfalse":["s3"]} for a branch. Only the routes ' +
          'the step selects are taken. Route names are fixed per kind (see list_backend_step_kinds); switch uses ' +
          'its case labels plus "default".'
      ),
    onError: z
      .array(z.string())
      .optional()
      .describe(
        'Error edges: steps reachable when this step fails. Empty/absent = a failure HALTS the run. A handler ' +
          'reached this way receives the failure as `previous.error`. These edges ARE try/catch — there is no ' +
          'try/catch step kind.'
      )
  });

  const workflowFields = {
    name: z.string().optional(),
    entry: z.string().describe('The step id the run starts from'),
    concurrency: z.number().optional().describe('Max concurrent runs of this workflow (default 1; extra runs queue)'),
    timeoutMs: z.number().optional().describe('Whole-workflow timeout in ms (0/omitted = none)'),
    stepTimeoutMs: z.number().optional().describe('Default per-step timeout in ms'),
    steps: z.array(workflowStep).describe('The step DAG (must be acyclic; every edge target must exist)')
  };

  server.registerTool(
    'create_backend_workflow',
    {
      title: 'Create a backend workflow',
      description:
        'Author a WF-001 workflow on a running backend: a multi-step, ordered, error-routed, cancellable server ' +
        'execution over a DAG of steps (each step invokes a cloud function in v1). The definition is validated ' +
        '(acyclic, edges resolve, every step reference is to a step that exists upstream) and REJECTED with the ' +
        'reason if invalid — never silently accepted. It is ' +
        'persisted and deploys with the backend. Point a trigger at it with target {kind:"workflow", name:<id>}.',
      inputSchema: { backendId: z.string().optional(), id: z.string().optional().describe('Omit to mint one'), ...workflowFields }
    },
    guarded(async ({ backendId, ...body }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', '/admin/workflow-defs', body);
      return jsonResult(json);
    })
  );

  // ==========================================================================
  // Backups / import / promotion (BAK-007) — write surface
  // ==========================================================================

  server.registerTool(
    'run_backend_backup',
    {
      title: 'Run a backend backup now',
      description:
        'Trigger a consistent whole-backend backup on a running backend immediately (BAK-007): DB snapshot + files ' +
        '+ workflows + config + a hashed manifest, written atomically to the configured destination, then old ' +
        'archives are rotated per retention. Returns the archive path, size, and snapshot mechanism. Fails loudly ' +
        'if the snapshot or write fails (the failure is also recorded in execution history and backup status).',
      inputSchema: { backendId: z.string().optional().describe('Which backend (omit if exactly one is running)') }
    },
    guarded(async ({ backendId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', '/admin/backups');
      return jsonResult(json);
    })
  );

  server.registerTool(
    'set_backend_backup_policy',
    {
      title: 'Set backend backup policy',
      description:
        'Configure a running backend\'s backup policy (BAK-007): the schedule (cron; rides WF-005\'s scheduler), ' +
        'retention (keepLast / keepDaily / keepWeekly), the local destination directory, and whether machine-local ' +
        'secrets.json is included (OFF by default). Omitted fields keep their current value. An invalid cron is ' +
        'rejected with the reason.',
      inputSchema: {
        backendId: z.string().optional(),
        schedule: z
          .object({
            enabled: z.boolean(),
            cron: z.string().describe('5-field cron or @preset (@daily/@hourly/…)'),
            missedFirePolicy: z.enum(['skip', 'run-once-on-start']).describe('What to do about runs missed while down')
          })
          .nullable()
          .optional()
          .describe('Set to null to disable scheduled backups'),
        retention: z
          .object({
            keepLast: z.number().optional(),
            keepDaily: z.number().optional(),
            keepWeekly: z.number().optional()
          })
          .optional(),
        destination: z.object({ path: z.string() }).optional().describe('Local directory for archives'),
        includeSecrets: z.boolean().optional()
      }
    },
    guarded(async ({ backendId, ...body }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('PUT', '/admin/backups/config', body);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'update_backend_workflow',
    {
      title: 'Update a backend workflow',
      description: 'Replace a WF-001 workflow definition by id. Same fields as create; re-validated strictly.',
      inputSchema: { backendId: z.string().optional(), id: z.string().describe('The workflow id'), ...workflowFields }
    },
    guarded(async ({ backendId, id, ...body }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('PUT', `/admin/workflow-defs/${encodeURIComponent(id)}`, body);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'delete_backend_workflow',
    {
      title: 'Delete a backend workflow',
      description: 'Remove a WF-001 workflow definition by id from a running backend.',
      inputSchema: { backendId: z.string().optional(), id: z.string().describe('The workflow id to delete') }
    },
    guarded(async ({ backendId, id }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('DELETE', `/admin/workflow-defs/${encodeURIComponent(id)}`);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'run_backend_workflow',
    {
      title: 'Run a backend workflow',
      description:
        'Run a WF-001 workflow now with an optional payload, and get the run result (status, steps run/skipped, ' +
        'the execution id). The run is recorded in the execution history with per-step events, viewable in the ' +
        'History Panel. Use this to test a workflow you just authored.',
      inputSchema: {
        backendId: z.string().optional(),
        id: z.string().describe('The workflow id to run'),
        payload: z.record(z.unknown()).optional().describe('The run payload (becomes each step\'s base input)')
      }
    },
    guarded(async ({ backendId, id, payload }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', `/admin/workflow-defs/${encodeURIComponent(id)}/run`, { payload: payload || {} });
      return jsonResult(json);
    })
  );

  server.registerTool(
    'import_backend_collection',
    {
      title: 'Import records into a backend collection',
      description:
        'Import records into a collection on a running backend (BAK-007), upserting by objectId (existing rows are ' +
        'updated, new ones inserted — re-importing the same content is idempotent). Transactional per collection ' +
        '(all valid rows apply or none) with a rejects report. Set `dryRun: true` to preview created/updated/rejected ' +
        'counts WITHOUT writing anything.',
      inputSchema: {
        backendId: z.string().optional(),
        collection: z.string(),
        format: z.enum(['json', 'csv']).describe('Format of `content`'),
        content: z.string().describe('The JSON (export shape or array) or CSV text to import'),
        dryRun: z.boolean().optional().describe('Preview only; do not write')
      }
    },
    guarded(async ({ backendId, collection, format, content, dryRun }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', `/admin/import/${encodeURIComponent(collection)}`, {
        format,
        content,
        dryRun
      });
      return jsonResult(json);
    })
  );

  server.registerTool(
    'cancel_backend_workflow_run',
    {
      title: 'Cancel a backend workflow run',
      description:
        'Cancel an in-flight WF-001 run by its execution id (from run_backend_workflow or the execution history). ' +
        'The engine stops scheduling further steps promptly and records the run as cancelled.',
      inputSchema: {
        backendId: z.string().optional(),
        executionId: z.string().describe('The execution id of the in-flight run')
      }
    },
    guarded(async ({ backendId, executionId }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', `/admin/workflow-runs/${encodeURIComponent(executionId)}/cancel`);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'apply_backend_schema',
    {
      title: 'Apply a schema promotion to a backend',
      description:
        'Promote a SOURCE schema snapshot onto a running (target) backend (BAK-007): additive tables/columns and ' +
        'permission/trigger/template config apply automatically; DATA is never touched. Destructive changes (dropped ' +
        'tables/columns, type changes) are REFUSED unless allowDestructive is true — and then a fresh pre-apply ' +
        'backup is taken first (enforced). Run diff_backend_schema first to preview.',
      inputSchema: {
        backendId: z.string().optional().describe('The TARGET backend'),
        source: z.record(z.unknown()).describe('The source schema snapshot { tables, permissions?, triggers?, templates? }'),
        allowDestructive: z.boolean().optional().describe('Permit destructive changes (forces a pre-apply backup)')
      }
    },
    guarded(async ({ backendId, source, allowDestructive }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', '/admin/schema/apply', { source, allowDestructive });
      return jsonResult(json);
    })
  );

  server.registerTool(
    'restore_backend',
    {
      title: 'Restore a backend from an archive',
      description:
        'Restore a running backend from a backup archive path on the server (BAK-007). Verifies the manifest hashes ' +
        'and engine compatibility, takes a pre-restore safety snapshot, then swaps db + files + workflows + config. ' +
        'DANGEROUS: intended for a quiesced backend — the blessed path for a full recovery is the `nodegx-backend ' +
        'restore` CLI with the service stopped.',
      inputSchema: {
        backendId: z.string().optional(),
        archive: z.string().describe('Absolute path to the .ngxbackup.tar.gz archive on the backend host'),
        safetySnapshot: z.boolean().optional().describe('Take a pre-restore safety snapshot first (default true)')
      }
    },
    guarded(async ({ backendId, archive, safetySnapshot }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', '/admin/backups/restore', { archive, safetySnapshot });
      return jsonResult(json);
    })
  );

  server.registerTool(
    'set_collection_search',
    {
      title: 'Enable/configure full-text search on a collection',
      description:
        'Enable full-text search (FTS5) on a collection of a running backend (BAK-008): pick the text field(s) to ' +
        'index and (optionally) a tokenizer (default unicode61 — no language-specific stemming/CJK segmentation). ' +
        'Rebuilds the search index immediately (safe to call again after changing fields — idempotent). Fields must ' +
        'already exist as columns on the collection. Fails with a clear error (no silent fallback) if the backend\'s ' +
        'SQLite engine lacks FTS5 — check `fts5Available` via get_backend_search_config first if unsure.',
      inputSchema: {
        backendId: z.string().optional(),
        collection: z.string().describe('The collection (class) to index — not a system (_-prefixed) collection'),
        fields: z.array(z.string()).min(1).describe('Text field names on the collection to index'),
        tokenizer: z.string().optional().describe('FTS5 tokenizer (default "unicode61")')
      }
    },
    guarded(async ({ backendId, collection, fields, tokenizer }) => {
      const client = await requireBackend(backendId);
      const body: Record<string, unknown> = { enabled: true, fields };
      if (tokenizer !== undefined) body.tokenizer = tokenizer;
      const { json } = await client.request(
        'PUT',
        `/admin/search/collections/${encodeURIComponent(collection)}`,
        body
      );
      return jsonResult(json);
    })
  );

  const thumbPreset = z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fit: z.enum(['cover', 'contain'])
  });

  server.registerTool(
    'configure_backend_files',
    {
      title: 'Configure backend file storage',
      description:
        'Update a running backend\'s file-storage policy (BAK-006): max upload bytes, content-type allow/deny ' +
        'lists, the storage driver (local, or s3 with endpoint/region/bucket — non-secret shape only; use ' +
        's3AccessKeyId/s3SecretAccessKey to set credentials, which are stored in secrets.json and never echoed ' +
        'back), thumbnail presets, the signed-URL TTL, and the orphan-sweep schedule (report-only by default — ' +
        'it never auto-deletes unless a sweep is explicitly run with deleteOrphans).',
      inputSchema: {
        backendId: z.string().optional(),
        maxUploadBytes: z.number().int().positive().optional(),
        contentTypes: z.object({ allowList: z.array(z.string()).nullable().optional(), denyList: z.array(z.string()).optional() }).optional(),
        driver: z
          .union([
            z.object({ type: z.literal('local') }),
            z.object({
              type: z.literal('s3'),
              endpoint: z.string(),
              region: z.string().optional(),
              bucket: z.string(),
              forcePathStyle: z.boolean().optional()
            })
          ])
          .optional()
          .describe('Switch storage driver. Set s3AccessKeyId/s3SecretAccessKey separately for credentials.'),
        s3AccessKeyId: z.string().optional(),
        s3SecretAccessKey: z.string().optional(),
        thumbnailPresets: z.record(thumbPreset).optional().describe('Replaces the FULL preset set (e.g. { sm: {width:64,height:64,fit:"cover"} })'),
        signedUrlTtlSeconds: z.number().int().positive().optional(),
        orphanSweep: z
          .object({ enabled: z.boolean(), cron: z.string() })
          .nullable()
          .optional()
          .describe('5-field cron (or @preset); null/omitted-enabled disables the schedule. Sweeps are report-only.')
      }
    },
    guarded(async ({ backendId, maxUploadBytes, contentTypes, driver, s3AccessKeyId, s3SecretAccessKey, thumbnailPresets, signedUrlTtlSeconds, orphanSweep }) => {
      const client = await requireBackend(backendId);
      const body: Record<string, unknown> = {};
      if (maxUploadBytes !== undefined) body.maxUploadBytes = maxUploadBytes;
      if (contentTypes !== undefined) body.contentTypes = contentTypes;
      if (driver !== undefined) body.driver = driver;
      if (s3AccessKeyId !== undefined || s3SecretAccessKey !== undefined) {
        body.s3Credentials = { accessKeyId: s3AccessKeyId, secretAccessKey: s3SecretAccessKey };
      }
      if (thumbnailPresets !== undefined) body.thumbnails = { presets: thumbnailPresets };
      if (signedUrlTtlSeconds !== undefined) body.signedUrlTtlSeconds = signedUrlTtlSeconds;
      if (orphanSweep !== undefined) body.orphanSweep = orphanSweep;
      const { json } = await client.request('PUT', '/admin/files/config', body);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'disable_collection_search',
    {
      title: 'Disable full-text search on a collection',
      description:
        "Turn off a collection's search config and drop its FTS5 shadow table/triggers. The collection's data is " +
        'untouched — only the search index goes away.',
      inputSchema: {
        backendId: z.string().optional(),
        collection: z.string().describe('The collection to stop indexing')
      }
    },
    guarded(async ({ backendId, collection }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('DELETE', `/admin/search/collections/${encodeURIComponent(collection)}`);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'rebuild_search_index',
    {
      title: 'Rebuild a collection\'s search index',
      description:
        'Explicitly reindex a collection whose search is already enabled (BAK-008). Idempotent and safe to call ' +
        'any time (e.g. after a bulk import) — reports rows indexed and elapsed time. Search stays consistent on ' +
        'its own via SQL triggers on every write path, so this is a recovery/verification tool, not a requirement ' +
        'after ordinary creates/updates/deletes.',
      inputSchema: {
        backendId: z.string().optional(),
        collection: z.string().describe('The collection to reindex (must already have search enabled)')
      }
    },
    guarded(async ({ backendId, collection }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request(
        'POST',
        `/admin/search/collections/${encodeURIComponent(collection)}/rebuild`
      );
      return jsonResult(json);
    })
  );

  server.registerTool(
    'run_backend_file_sweep',
    {
      title: 'Run the file orphan sweep now',
      description:
        'Run a backend\'s file-storage orphan sweep immediately (BAK-006), outside its schedule: finds storage ' +
        'blobs with no metadata row (orphan blobs) and metadata rows whose blob is missing (orphan rows). ' +
        'REPORT-ONLY by default — pass deleteOrphans:true to actually delete orphan BLOBS (orphan ROWS are never ' +
        'auto-deleted; a metadata row with a missing blob is a data-integrity signal for a human to look at).',
      inputSchema: {
        backendId: z.string().optional(),
        deleteOrphans: z.boolean().optional().describe('Actually delete orphan blobs found by this run (default false: report only)')
      }
    },
    guarded(async ({ backendId, deleteOrphans }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('POST', '/admin/files/sweep', { deleteOrphans: !!deleteOrphans });
      return jsonResult(json);
    })
  );

  // --------------------------------------------------------------------------
  // BAK-004 — configuring sign-in.
  //
  // The phase's AI-visibility rule applied to auth: an agent must be able to
  // stand up "sign in with Google" end to end, which means adding the provider,
  // setting its secret, allowing the app's origin to be redirected to, and
  // reporting the callback URL back to the human who has to paste it into a
  // provider console. All four are here.
  // --------------------------------------------------------------------------

  server.registerTool(
    'configure_backend_auth_provider',
    {
      title: 'Add or update a sign-in provider',
      description:
        'Add or update one OAuth/OIDC sign-in provider on a running backend (BAK-004). Start from a `preset` — ' +
        '"google" and "github" fill in the issuer, scopes and display name so only a client id and secret are ' +
        'needed; "oidc" is the generic path for Keycloak, Authentik, Entra ID, Auth0, Okta and the rest, where ' +
        'you supply the issuer URL and everything else comes from its discovery document. The response includes ' +
        'the exact `callbackUrl` to register in the provider console, and `ready`/`notReadyReason` saying whether ' +
        'sign-in would actually work right now. The client secret is written to the backend\'s secrets.json and ' +
        'is never readable again through any API.',
      inputSchema: {
        backendId: z.string().optional(),
        id: z
          .string()
          .describe(
            'Provider id — a lowercase slug that appears in the callback URL, so changing it later invalidates ' +
              'what is registered with the provider. Use "google"/"github" for the presets.'
          ),
        preset: z.enum(['google', 'github', 'oidc']).optional().describe('Fill in kind/issuer/scopes/display name'),
        displayName: z.string().optional().describe('What a sign-in button should say'),
        enabled: z.boolean().optional().describe('Offer this provider to users (default false on create)'),
        clientId: z.string().optional(),
        clientSecret: z.string().optional().describe('Stored in secrets.json; never returned by any read'),
        issuer: z
          .string()
          .optional()
          .describe('OIDC issuer URL, e.g. https://keycloak.example.com/realms/myrealm. Must be empty for github.'),
        scopes: z.array(z.string()).optional().describe('Defaults come from the preset'),
        allowSignup: z
          .boolean()
          .optional()
          .describe('May a first-time user CREATE an account with this provider? false = existing users only.')
      }
    },
    guarded(async ({ backendId, id, ...provider }) => {
      const client = await requireBackend(backendId);
      const body = Object.fromEntries(Object.entries(provider).filter(([, v]) => v !== undefined));
      const { json } = await client.request('PUT', `/admin/auth/providers/${encodeURIComponent(id)}`, body);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'remove_backend_auth_provider',
    {
      title: 'Remove a sign-in provider',
      description:
        'Delete a sign-in provider from a running backend and forget its client secret. Linked user identities ' +
        'are KEPT, so re-adding the same provider id restores sign-in for those accounts — but while it is absent, ' +
        'users with no password and no other provider cannot sign in.',
      inputSchema: { backendId: z.string().optional(), id: z.string().describe('The provider id to remove') }
    },
    guarded(async ({ backendId, id }) => {
      const client = await requireBackend(backendId);
      const { json } = await client.request('DELETE', `/admin/auth/providers/${encodeURIComponent(id)}`);
      return jsonResult(json);
    })
  );

  server.registerTool(
    'configure_backend_auth_policy',
    {
      title: 'Configure magic links, redirect allow-list and account linking',
      description:
        "The non-provider half of a backend's sign-in config (BAK-004). `redirectAllowList` is the one an app " +
        'usually needs: the backend refuses to redirect a completed sign-in anywhere that is not same-origin or ' +
        'on this list, which is what stops an auth callback being used as an open redirect — so an app on a ' +
        'different origin from the backend must have its origin added here or every sign-in is refused before it ' +
        'starts. `magicLink` enables passwordless email sign-in (also needs SMTP configured — see ' +
        'get_backend_email_config). `linking.autoLinkVerifiedEmail` controls whether a provider-verified address ' +
        'may join an existing local account; turning it OFF means such a sign-in is refused rather than linked.',
      inputSchema: {
        backendId: z.string().optional(),
        redirectAllowList: z
          .array(z.string())
          .optional()
          .describe('Absolute app origins, e.g. ["https://app.example.com"]. Empty means same-origin paths only.'),
        magicLink: z
          .object({
            enabled: z.boolean().optional(),
            ttlMinutes: z.number().optional().describe('Link lifetime, max 1440'),
            allowSignup: z.boolean().optional().describe('May an unknown address create an account by clicking?')
          })
          .optional(),
        linking: z.object({ autoLinkVerifiedEmail: z.boolean().optional() }).optional()
      }
    },
    guarded(async ({ backendId, ...policy }) => {
      const client = await requireBackend(backendId);
      const body = Object.fromEntries(Object.entries(policy).filter(([, v]) => v !== undefined));
      const { json } = await client.request('PUT', '/admin/auth', body);
      return jsonResult(json);
    })
  );
}
