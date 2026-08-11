/**
 * AAQ-011/F13 — the provisioning tools: `provision_backend`, `stop_backend`,
 * `list_backend_processes`.
 *
 * The capability F13 decided on: an external agent can now build a full-stack
 * app end to end, because the third of Layer 1's project-level effects finally
 * ports with the other two. The mechanics — ports, secrets, lifecycle, reaping
 * — are in `../backend/provision` and `../backend/reaper`; this file is only
 * the surface and the sentences an agent reads.
 *
 * ## Why this is a tool and not a plan operation
 *
 * `create_plan` accepts `kind: 'provision'` (one vocabulary across both
 * clients) and still refuses it — but the refusal now points here instead of
 * saying the server cannot do it. That is deliberate, not a shortcut:
 * `apply_plan`'s whole contract is "nothing touches disk until one call, and
 * discarding leaves the project byte-identical". A spawned process and a created
 * database are neither. The editor's own provisioner reaches the same
 * conclusion from the other side — `provisionBackend.ts` puts **only the
 * binding** in the undo group, precisely because deleting a database on Cmd+Z
 * destroys durable output nobody asked to destroy. Putting the spawn inside
 * `apply_plan` would put the one un-rollbackable machine effect inside the one
 * call that promises to be all-or-nothing.
 *
 * So the sequence an agent follows is: `provision_backend`, then `create_plan`
 * for the components that use it. Two calls, and the irreversible one is on its
 * own, which is also how a human would want to be asked.
 *
 * @module noodl-mcp/tools/provisionTools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { ensureProjectId } from '../backend/projectIdentity';
import { censusBackends, listBackendConfigs, provisionBackend, stopBackend } from '../backend/provision';
import { reapOrphanedBackends } from '../backend/reaper';
import { listRuntimeRecords, ownerIsLive } from '../backend/runtimeRecord';
import type { ProjectBinding } from '../project/ProjectBinding';
import type { ProjectStore } from '../project/ProjectStore';
import { guarded, jsonResult } from './util';

const collectionSchema = z.object({
  name: z.string().describe('Collection name, e.g. "Puppy"'),
  columns: z
    .array(
      z.object({
        name: z.string(),
        type: z
          .string()
          .describe('A nodegx-backend column type: String, Number, Boolean, Date, Pointer, Object, Array, File')
      })
    )
    .describe(
      'The columns this collection should have. Pre-seeding, not a prerequisite — the backend creates a ' +
        'collection on first write anyway. What declaring them buys is typed prop-* ports on the Record ' +
        'nodes, which is the difference between a Create Record node you can wire and an empty one.'
    )
});

export function registerProvisionTools(server: McpServer, binding: ProjectBinding): void {
  server.registerTool(
    'provision_backend',
    {
      title: 'Provision a backend',
      description:
        'Create, start and bind a local nodegx-backend for this project — the one call that lets an app with ' +
        'Record/User/Cloud Function nodes actually run. Creates the backend under ~/.noodl/backends, starts it ' +
        'as a supervised child process, pre-seeds the collections you name, and writes the endpoint into the ' +
        "project's cloudservices metadata. Reuses this project's existing backend of the same name rather than " +
        'making a second, and ADOPTS it if it is already running. ' +
        '⚠️ This is the one tool with an effect that is not undoable: it starts a process and creates a ' +
        'database. Refuses (changing nothing) if the project already points at a different endpoint. ' +
        'The backend stops when this server does, and is reaped on the next start if this server is killed.',
      inputSchema: {
        name: z
          .string()
          .describe('Display name for the backend, e.g. "App backend". Reuse matches on this name plus ownership.'),
        collections: z.array(collectionSchema).optional().describe('Collections to pre-seed. Advisory — see below.'),
        force: z
          .boolean()
          .optional()
          .describe('Repoint a project that is already bound to a different endpoint. Off by default, on purpose.')
      }
    },
    guarded(async (args: { name: string; collections?: { name: string; columns: { name: string; type: string }[] }[]; force?: boolean }) => {
      const store = binding.require();
      // Refuse BEFORE spawning anything: a provision that creates a process and
      // then fails to bind it has left durable machine state for nothing.
      const current = store.readCloudServices();
      if (!args.force && current.endpoint) {
        return jsonResult({
          provisioned: false,
          reason:
            `This project already points at ${current.endpoint}. Nothing was created or started. Use that ` +
            'backend (list_backends shows it), disconnect it in the editor first, or pass force to repoint.',
          currentEndpoint: current.endpoint
        });
      }

      // ⭐ DSG-007 / F2 — establish the project's identity BEFORE provisioning.
      //
      // `findReusableBackend` matches on name plus ownership, and ownership is
      // this id appearing in the backend's `projectIds`. Read straight off the
      // file, it was `undefined` for every project the editor had ever saved —
      // so the match short-circuited, a second backend was created, and it was
      // stamped `projectIds: []`, unreusable by anyone forever. The backfill is
      // idempotent and adds nothing but `id`, so a project that already has one
      // is not written at all.
      const identity = ensureProjectId(store.projectDir);
      const projectFile = store.readProjectFile();
      const result = await provisionBackend({
        name: args.name,
        collections: args.collections ?? [],
        projectId: identity.id ?? projectFile?.id,
        projectDir: store.projectDir,
        identity: { reason: identity.reason, minted: identity.outcome === 'minted' }
      });

      store.writeCloudServices(
        {
          instanceId: result.backendId,
          endpoint: result.endpoint,
          appId: result.backendId,
          type: 'nodegx'
        },
        true // the refusal above is the gate; by here the decision is made
      );

      return jsonResult({
        provisioned: true,
        backendId: result.backendId,
        name: result.name,
        endpoint: result.endpoint,
        port: result.port,
        pid: result.pid,
        reused: result.reused,
        adopted: result.adopted,
        collections: result.collections,
        warnings: result.warnings,
        // DSG-007 — the identity this backend is owned by, and whether this call
        // had to mint it. A caller that sees `minted` is looking at a project
        // that could never have reused a backend before now.
        projectId: identity.id,
        projectIdentity: identity.outcome,
        reuseVerdict: result.reuseVerdict,
        ...(result.reuseNote ? { reuseNote: result.reuseNote } : {}),
        boundTo: 'nodegx.project.json → metadata.cloudservices',
        note:
          'The project is bound. Record/User nodes will now resolve prop-* ports from this backend, and the ' +
          'backend tools (permissions, roles, keys, workflows) target it without a backendId. It stops when ' +
          'this MCP server stops; if this server is killed, the next one reaps it.'
      });
    })
  );

  server.registerTool(
    'stop_backend',
    {
      title: 'Stop a backend',
      description:
        'Stop a running backend this server started (or one whose runtime record proves it is ours). SIGTERM ' +
        'with a drain, then SIGKILL. Refuses to signal a pid it cannot verify still belongs to that backend — ' +
        'a recorded pid can be reused by the OS, and killing on a bare pid is how you kill the wrong process.',
      inputSchema: { backendId: z.string().describe('The backend id from provision_backend or list_backends') }
    },
    guarded(async ({ backendId }: { backendId: string }) => {
      const result = await stopBackend(backendId);
      return jsonResult({ backendId, ...result });
    })
  );

  server.registerTool(
    'list_backend_processes',
    {
      title: 'List backend processes',
      description:
        'What is actually running, from the durable spawn records: which backend, which pid and port, which ' +
        'spawner owns it (this server or the editor), and whether that owner is still alive. Pass ' +
        '`reap: true` to also stop the ones no live owner claims — the same sweep that runs at startup. ' +
        'Also returns a census of every backend DIRECTORY and which project owns it, flagging the ones no ' +
        'project claims — those can never be reused by any provision. It reports them; it deletes nothing, ' +
        'because a backend directory is a database.',
      inputSchema: {
        reap: z.boolean().optional().describe('Also kill backends whose owner is gone. Off by default.')
      }
    },
    guarded(async ({ reap }: { reap?: boolean }) => {
      const swept = reap ? await reapOrphanedBackends() : [];
      const records = listRuntimeRecords();
      // DSG-007 §4.4. Directories, not processes — an unowned backend is
      // usually not running, which is exactly why nobody notices it.
      const census = censusBackends(listBackendConfigs());
      const unowned = census.filter((c) => c.verdict === 'unowned');
      return jsonResult({
        running: records.map((r) => ({
          backendId: r.backendId,
          name: r.backendName,
          pid: r.pid,
          port: r.port,
          endpoint: r.endpoint,
          owner: r.owner?.kind,
          ownerPid: r.owner?.pid,
          ownerAlive: ownerIsLive(r),
          ownedByThisServer: r.owner?.pid === process.pid,
          startedAt: r.startedAt
        })),
        directories: census,
        ...(unowned.length > 0
          ? {
              unownedNote:
                `${unowned.length} backend director(ies) are claimed by no project (${unowned
                  .map((c) => `${c.name} @ ${c.port}`)
                  .join(', ')}). No provision can ever reuse them. Adopt one by adding a project id to its ` +
                'config.json → projectIds, or delete the directory if its data is not wanted.'
            }
          : {}),
        ...(reap ? { swept } : {})
      });
    })
  );
}
