/**
 * Server assembly: wires the tool groups onto an McpServer over a ProjectStore.
 * Write tools are registered only when writes were explicitly opted into —
 * read-only is the default posture (SUB-008 requirement).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { ProjectStore } from './project/ProjectStore';
import { registerAuthorTools } from './tools/author';
import { registerCatalogTools } from './tools/catalogTools';
import { registerReadTools } from './tools/read';
import { registerValidateTools } from './tools/validateTools';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PKG_VERSION: string = require('../package.json').version;

export interface ServerOptions {
  projectDir: string;
  allowWrites: boolean;
}

export interface CreatedServer {
  server: McpServer;
  store: ProjectStore;
}

export function createServer(options: ServerOptions): CreatedServer {
  const store = new ProjectStore(options.projectDir); // throws early on non-v2 targets
  const server = new McpServer(
    { name: 'noodl-mcp', version: PKG_VERSION },
    {
      instructions:
        `NodeGX (OpenNoodl) project server for ${store.projectDir} — mode: ` +
        (options.allowWrites ? 'read-write' : 'read-only (writes require restarting with --allow-writes)') +
        '. Start with get_project_info. Component identifiers accept path form ("Pages/Home") or legacy name ' +
        '("/Pages/Home"); a node instantiating a project component uses the legacyName as its node type. ' +
        'When authoring: read the parent/pattern component, fetch the node types you need with get_node_type, ' +
        'then create_component / update_component — every write is validated and rejections return diagnostics ' +
        'with suggested fixes.'
    }
  );

  registerReadTools(server, store, { allowWrites: options.allowWrites });
  registerCatalogTools(server);
  registerValidateTools(server, store);
  if (options.allowWrites) {
    registerAuthorTools(server, store);
  }
  return { server, store };
}
