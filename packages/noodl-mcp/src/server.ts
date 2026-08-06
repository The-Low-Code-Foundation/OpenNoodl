/**
 * Server assembly: wires the tool groups onto an McpServer over a ProjectStore.
 * Write tools are registered only when writes were explicitly opted into —
 * read-only is the default posture (SUB-008 requirement).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { ProjectStore } from './project/ProjectStore';
import { registerAuthorTools } from './tools/author';
import { registerPlanTools } from './tools/planTools';
import { registerBackendReadTools, registerBackendWriteTools } from './tools/backendTools';
import { registerCatalogTools } from './tools/catalogTools';
import { registerDocsReadTools, registerDocsWriteTools } from './tools/docsTools';
import { registerImportReportTool } from './tools/importReportTool';
import { registerReadTools } from './tools/read';
import { registerStyleReadTools, registerStyleWriteTools } from './tools/styleTools';
import { registerValidateTools } from './tools/validateTools';
import { registerCreateProjectTools } from './tools/createProject';
import { registerProvisionTools } from './tools/provisionTools';
import { registerReviewTools } from './tools/review';

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
        'call get_style_vocabulary for the on-system tokens/variants (set colour/spacing params as ' +
        '"var(--token)", never raw hex/px), then create_component / update_component — every write is ' +
        'validated and rejections return diagnostics with suggested fixes. ' +
        // AAQ-005. The word "Router" appeared nowhere in any guidance a model
        // saw, which is why pages were built that nothing could reach and
        // navigation was aimed at invented URL paths. Both halves are stated:
        // what makes a page a page, and what this server does about it, so an
        // agent neither omits the registration nor writes a competing one.
        'PAGES: a page component is only reachable if a Router node lists it in its `pages` parameter, and it ' +
        'renders blank without a `Page` node at its root — so build page components around a `Page` node, and ' +
        'aim RouterNavigate.target at a component legacyName ("/Pages/Home"), never at an invented URL path. ' +
        'Writing a page registers it in the project router for you (reported as `registeredPages`); you do not ' +
        'need to edit the router yourself, and re-registering an already-listed page is a no-op. ' +
        'For a multi-component build use create_plan / stage_plan_operation / apply_plan — nothing touches ' +
        'disk until the one apply — and pass its `scroll` argument ("page" or "app"), because the underlying ' +
        'default clips every page at the viewport with no scrollbar. ' +
        // AAQ-011/F13. Stated because it is the step an agent otherwise skips:
        // a graph with Record nodes and no backend validates, builds, and then
        // does nothing at run time, and the agent has no panel to notice in.
        'BACKENDS: an app with Record, User or Cloud Function nodes needs one. Call provision_backend FIRST ' +
        '(it creates, starts and binds a local backend and pre-seeds the collections you name — declare their ' +
        'columns, or the Record nodes get no prop-* ports), then plan the components against it. It is ' +
        'deliberately not a plan operation: it starts a process and creates a database, which a plan cannot ' +
        'roll back.'
    }
  );

  registerReadTools(server, store, { allowWrites: options.allowWrites });
  // LIB-006. Read-only and always registered: knowing what an import could not
  // convert is useful long before anyone is allowed to change anything.
  registerImportReportTool(server, store);
  registerCatalogTools(server);
  registerValidateTools(server, store);
  registerStyleReadTools(server, store);
  registerDocsReadTools(server, store);
  registerBackendReadTools(server);
  // AIX-010 — read-only: assembles the docs-retrofit context. The caller drafts
  // and writes back through write_project_doc.
  registerReviewTools(server, store);
  if (options.allowWrites) {
    registerAuthorTools(server, store);
    registerPlanTools(server, store);
    registerStyleWriteTools(server, store);
    registerDocsWriteTools(server, store);
    registerBackendWriteTools(server);
    // AAQ-011/F13. Write-gated, and it is the strongest write in the server: it
    // starts a process and creates a database. Read-only callers get the
    // diagnosis (checkBackendRequirements says a graph needs a backend) without
    // the ability to act on it, which is the same posture as everything else.
    registerProvisionTools(server, store);
    // AIX-012. Takes no store: it creates a project at a directory the caller
    // names, which is by definition not the one this server is pointed at.
    registerCreateProjectTools(server);
  }
  return { server, store };
}
