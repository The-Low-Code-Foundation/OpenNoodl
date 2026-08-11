/**
 * Server assembly: wires the tool groups onto an McpServer over a ProjectStore.
 * Write tools are registered only when writes were explicitly opted into —
 * read-only is the default posture (SUB-008 requirement).
 *
 * ## BST-001 — the project is optional
 *
 * `options.projectDir` may be absent, and then the server starts anyway with the
 * bootstrap surface: four tools that need no project, and a briefing written for
 * an agent that has not got one. The store is held behind a {@link
 * ProjectBinding} rather than constructed here, and **every registration below
 * runs in both modes** — see that module for why sixteen conditionals would have
 * been the wrong shape.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { BOOTSTRAP_INSTRUCTIONS, projectInstructions } from './instructions';
import { ToolError } from './errors';
import { ProjectBinding } from './project/ProjectBinding';
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
import { registerListProjectsTools } from './tools/listProjects';
import { ToolDisclosure, recordTools, registerFindTools } from './tools/disclosure';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PKG_VERSION: string = require('../package.json').version;

export interface ServerOptions {
  /**
   * BST-001 — absent means **unbound**: the server starts with the bootstrap
   * surface and no store, which is the only way `create_project` was ever
   * reachable from a machine that has no projects yet.
   */
  projectDir?: string;
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
  /**
   * BST-001 — the store, or the reason there isn't one. Replaces the `store`
   * this used to return: a `ProjectStore | null` would have pushed the same
   * check into every caller, which is the shape this class exists to avoid.
   */
  binding: ProjectBinding;
  /** AWP-006 — exposed so a caller (and the suite) can see the served surface. */
  disclosure: ToolDisclosure;
}

export function createServer(options: ServerOptions): CreatedServer {
  // ⚠️ BST-001 §4 — `create_project` is registered inside the write gate below,
  // so an unbound read-only server has nothing in it at all: it would start,
  // appear connected in the client's MCP panel, advertise three listing tools
  // and be unable to do the one thing this mode exists for. Refused at startup
  // instead, naming the flag, because a refusal in the client's status line is
  // somewhere a person can see it.
  if (options.projectDir === undefined && !options.allowWrites) {
    throw new ToolError(
      'invalid-argument',
      'Starting with no project directory needs --allow-writes: with no project there is nothing to read, and ' +
        'creating one is a write. Add --allow-writes, or pass a project directory.'
    );
  }

  const binding = new ProjectBinding(options.projectDir); // throws early on non-v2 targets
  const deferTools = options.deferTools !== false;
  const store = binding.peek();
  const server = new McpServer(
    { name: 'noodl-mcp', version: PKG_VERSION },
    {
      // BST-006 — both briefings live in `./instructions`, because this string
      // is sent exactly once per session and can never be revised afterwards:
      // MCP has no "instructions changed" notification. See that module.
      instructions:
        store === null
          ? BOOTSTRAP_INSTRUCTIONS
          : projectInstructions({ projectDir: store.projectDir, allowWrites: options.allowWrites, deferTools })
    }
  );

  // AWP-006 — every registration below goes through the recorder, which keeps
  // the SDK's handle so a group can be hidden at startup and revealed later.
  // The recorder forwards `registerTool` and nothing else, because that is the
  // only method these functions use; `tests/toolDisclosure.test.ts` asserts the
  // manifest and the recorded set are the same, so a tool that escapes it fails
  // the suite rather than becoming permanently unhideable.
  //
  // BST-001 — the recorder is also what makes the bootstrap surface possible:
  // registration is unconditional in both modes and the *policy* decides what is
  // advertised, so binding a project later (BST-002) never has to re-register
  // anything.
  const disclosure = new ToolDisclosure(binding.isBound);
  const rec = recordTools(server, disclosure);

  // ⚠️ BST-001 — every call below passes the **binding**, not a store. The
  // handlers dereference it per request; a registration function that resolved
  // it here would capture the unbound state for the life of the process.
  registerReadTools(rec, binding, { allowWrites: options.allowWrites });
  // LIB-006. Read-only and always registered: knowing what an import could not
  // convert is useful long before anyone is allowed to change anything.
  registerImportReportTool(rec, binding);
  registerCatalogTools(rec);
  registerValidateTools(rec, binding);
  registerStyleReadTools(rec, binding);
  registerDocsReadTools(rec, binding);
  registerBackendReadTools(rec);
  // AIX-010 — read-only: assembles the docs-retrofit context. The caller drafts
  // and writes back through write_project_doc.
  registerReviewTools(rec, binding);
  // LAS-005 — read-only and unconditional, the same posture as the rest of the
  // read surface: rendering a project changes nothing about it, and a read-only
  // server is exactly where "is this page actually right?" gets asked.
  registerRenderTools(rec, binding);
  // BST-006. Takes no store, like `create_project`: it reads the launcher's own
  // recent-projects file, which is machine state rather than project state. That
  // is what makes it answerable on a server with nothing bound — and it is the
  // call that stops an agent building a second copy of an app that exists.
  registerListProjectsTools(rec);
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
    registerAuthorTools(rec, binding, planRegistry, exampleBudget, disclosure);
    registerPlanTools(rec, binding, planRegistry, exampleBudget, disclosure);
    registerStyleWriteTools(rec, binding);
    registerDocsWriteTools(rec, binding);
    registerBackendWriteTools(rec);
    // AAQ-011/F13. Write-gated, and it is the strongest write in the server: it
    // starts a process and creates a database. Read-only callers get the
    // diagnosis (checkBackendRequirements says a graph needs a backend) without
    // the ability to act on it, which is the same posture as everything else.
    registerProvisionTools(rec, binding);
    // AIX-012. Takes no store: it creates a project at a directory the caller
    // names, which is by definition not the one this server is pointed at.
    //
    // BST-001 — that property is what this whole mode stands on, and it was
    // already true and already commented here before anyone could reach it: the
    // capability was store-independent, and unreachable, because the store was
    // built two lines before the first registration and threw.
    registerCreateProjectTools(rec);
  }
  // AWP-006 — last, and it has to be: the handles do not all exist until every
  // registration has run, and disabling a group before its tools are registered
  // would silently hide nothing.
  disclosure.applyPolicy({ deferTools });
  return { server, binding, disclosure };
}
