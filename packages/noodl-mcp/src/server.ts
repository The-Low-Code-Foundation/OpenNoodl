/**
 * Server assembly: wires the tool groups onto an McpServer over a ProjectStore.
 * Write tools are registered only when writes were explicitly opted into —
 * read-only is the default posture (SUB-008 requirement).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { ProjectStore } from './project/ProjectStore';
import { createExampleBudget } from './tools/attachments';
import { registerAuthorTools } from './tools/author';
import { createPlanRegistry, registerPlanTools } from './tools/planTools';
import { registerBackendReadTools, registerBackendWriteTools } from './tools/backendTools';
import { registerCatalogTools } from './tools/catalogTools';
import { registerDocsReadTools, registerDocsWriteTools } from './tools/docsTools';
import { registerImportReportTool } from './tools/importReportTool';
import { registerReadTools } from './tools/read';
import { registerRenderTools } from './tools/renderTools';
import { registerStyleReadTools, registerStyleWriteTools } from './tools/styleTools';
import { registerValidateTools } from './tools/validateTools';
import { registerCreateProjectTools } from './tools/createProject';
import { registerProvisionTools } from './tools/provisionTools';
import { registerReviewTools } from './tools/review';
import { ToolDisclosure, recordTools, registerFindTools } from './tools/disclosure';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PKG_VERSION: string = require('../package.json').version;

export interface ServerOptions {
  projectDir: string;
  allowWrites: boolean;
  /**
   * AWP-006 — advertise the authoring set and hold the rest behind `find_tools`.
   * Defaults to true; `--all-tools` turns it off, which is the pre-AWP-006
   * surface exactly.
   */
  deferTools?: boolean;
}

export interface CreatedServer {
  server: McpServer;
  store: ProjectStore;
  /** AWP-006 — exposed so a caller (and the suite) can see the served surface. */
  disclosure: ToolDisclosure;
}

export function createServer(options: ServerOptions): CreatedServer {
  const store = new ProjectStore(options.projectDir); // throws early on non-v2 targets
  const deferTools = options.deferTools !== false;
  const server = new McpServer(
    { name: 'noodl-mcp', version: PKG_VERSION },
    {
      instructions:
        `NodeGX (OpenNoodl) project server for ${store.projectDir} — mode: ` +
        (options.allowWrites ? 'read-write' : 'read-only (writes require restarting with --allow-writes)') +
        '. Start with get_project_info. Component identifiers accept path form ("Pages/Home") or legacy name ' +
        '("/Pages/Home"); a node instantiating a project component uses the legacyName as its node type. ' +
        // LAS-006 §4. The order was the finding: both measured models planned
        // correctly and then built something the plan never described, because
        // nothing in the tool shape asked for the tree first. This paragraph now
        // states the order as the workflow, and names the two primitives nobody
        // finds — haiku found neither `Static Data` nor `Component Inputs` in 42
        // turns; sonnet needed 75 exploration calls to find both.
        'THE ORDER, FOR ANYTHING BIGGER THAN A TWO-NODE FIX: decide the component tree FIRST with create_plan — ' +
        'one operation per component, and on every component another one will place, fill its `inputs` with the ' +
        'port names the instances will set (and `repeats` where it draws a row per item). Then author leaves, ' +
        'then the sections that place them, then the page. A component\'s interface is a `Component Inputs` node ' +
        'whose ports are plugged "output" — that is the ONLY thing that makes an instance parameter arrive, and ' +
        'a component without one renders identically however many times you place it. Inline row data is a ' +
        '`Static Data` node (a JSON array), fed to a `For Each`. Both are easy to miss and there is no ' +
        'substitute for either. ' +
        'When authoring one component: read the parent/pattern component, fetch the node types you need with ' +
        'get_node_type, call get_style_vocabulary for the on-system tokens/variants (set colour/spacing params as ' +
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
        'BACKENDS: an app with Record, User or Cloud Function nodes needs one. ' +
        // AWP-006. The backend tools are 60 of the 89 and 59% of the schema
        // bytes, and a storefront brief touches none of them — so they are held
        // back by default. This sentence is where an agent building a data app
        // learns that, and it is stated before provision_backend is named so the
        // instruction never points at a tool the reader cannot currently see.
        (deferTools
          ? 'Its 60 tools are not advertised yet — call find_tools({group:"backend"}) and they arrive in your ' +
            'next tool list (authoring a Record node reveals them too). Then provision_backend FIRST '
          : 'Call provision_backend FIRST ') +
        '(it creates, starts and binds a local backend and pre-seeds the collections you name — declare their ' +
        'columns, or the Record nodes get no prop-* ports), then plan the components against it. It is ' +
        'deliberately not a plan operation: it starts a process and creates a database, which a plan cannot ' +
        'roll back. ' +
        // LAS-005. Push, not pull: the audit measured a mid-tier model that
        // never once retrieved a recipe it was told existed, and a strong one
        // that improvised a verification loop through Bash and still shipped the
        // wrong photograph. Retrieval advice does nothing; naming the tool here,
        // where every session reads it, is the only thing that has worked.
        'VERIFY BY LOOKING: when you have written anything visual, call render_report. It renders the project ' +
        'headless (~8s) and returns the numbers AND screenshots — a graph is a claim, a render is evidence, ' +
        'and an image URL that returns 200 can still be a picture of the wrong thing.'
    }
  );

  // AWP-006 — every registration below goes through the recorder, which keeps
  // the SDK's handle so a group can be hidden at startup and revealed later.
  // The recorder forwards `registerTool` and nothing else, because that is the
  // only method these functions use; `tests/toolDisclosure.test.ts` asserts the
  // manifest and the recorded set are the same, so a tool that escapes it fails
  // the suite rather than becoming permanently unhideable.
  const disclosure = new ToolDisclosure();
  const rec = recordTools(server, disclosure);

  registerReadTools(rec, store, { allowWrites: options.allowWrites });
  // LIB-006. Read-only and always registered: knowing what an import could not
  // convert is useful long before anyone is allowed to change anything.
  registerImportReportTool(rec, store);
  registerCatalogTools(rec);
  registerValidateTools(rec, store);
  registerStyleReadTools(rec, store);
  registerDocsReadTools(rec, store);
  registerBackendReadTools(rec);
  // AIX-010 — read-only: assembles the docs-retrofit context. The caller drafts
  // and writes back through write_project_doc.
  registerReviewTools(rec, store);
  // LAS-005 — read-only and unconditional, the same posture as the rest of the
  // read surface: rendering a project changes nothing about it, and a read-only
  // server is exactly where "is this page actually right?" gets asked.
  registerRenderTools(rec, store);
  // AWP-006 — resident in both modes. A read-only server defers the docs and
  // backend *read* tools too, so the door out of the deferred set cannot be
  // behind the write flag.
  registerFindTools(rec, disclosure);
  if (options.allowWrites) {
    // LAS-006 §4 — one plan registry, shared by the two write groups that both
    // have an opinion about it: the plan tools own the plans, and
    // `create_component` needs only to know whether any exist.
    const planRegistry = createPlanRegistry();
    // LAS-007 §1 — one example budget per server process, so the first
    // rejection of a code carries the recipe and the fifth carries its id. A
    // repair loop must not be re-sent the same fragment every turn.
    const exampleBudget = createExampleBudget();
    registerAuthorTools(rec, store, planRegistry, exampleBudget, disclosure);
    registerPlanTools(rec, store, planRegistry, exampleBudget, disclosure);
    registerStyleWriteTools(rec, store);
    registerDocsWriteTools(rec, store);
    registerBackendWriteTools(rec);
    // AAQ-011/F13. Write-gated, and it is the strongest write in the server: it
    // starts a process and creates a database. Read-only callers get the
    // diagnosis (checkBackendRequirements says a graph needs a backend) without
    // the ability to act on it, which is the same posture as everything else.
    registerProvisionTools(rec, store);
    // AIX-012. Takes no store: it creates a project at a directory the caller
    // names, which is by definition not the one this server is pointed at.
    registerCreateProjectTools(rec);
  }
  // AWP-006 — last, and it has to be: the handles do not all exist until every
  // registration has run, and disabling a group before its tools are registered
  // would silently hide nothing.
  disclosure.applyPolicy({ deferTools });
  return { server, store, disclosure };
}
