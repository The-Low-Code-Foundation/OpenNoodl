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
      description: 'Replace a trigger definition by id on a running backend. Same fields as create.',
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
    kind: z.literal('call-function').describe("v1 step kind; invokes a cloud function (WF-002 adds more)"),
    ref: z.string().describe('The cloud function to invoke for a call-function step'),
    params: z.record(z.unknown()).optional().describe('Static params merged into the step input'),
    timeoutMs: z.number().optional().describe('Per-step timeout (0/omitted = the workflow default)'),
    next: z.array(z.string()).optional().describe('Success edges: steps reachable when this step succeeds'),
    onError: z
      .array(z.string())
      .optional()
      .describe('Error edges: steps reachable when this step fails. Empty/absent = a failure HALTS the run.')
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
        '(acyclic, edges resolve) and REJECTED with the reason if invalid — never silently accepted. It is ' +
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
}
