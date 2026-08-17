/**
 * Server assembly: wires the tool groups onto an McpServer over a ProjectStore.
 * Write tools are registered only when writes were explicitly opted into —
 * read-only is the default posture (SUB-008 requirement).
 *
 * ## BST-001 — the project is optional
 *
 * `options.projectDir` may be absent, and then the server starts anyway with the
 * bootstrap surface: the handful of tools that need no project, and a briefing written for
 * an agent that has not got one. The store is held behind a {@link
 * ProjectBinding} rather than constructed here, and **every registration below
 * runs in both modes** — see that module for why sixteen conditionals would have
 * been the wrong shape.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { BOOTSTRAP_INSTRUCTIONS, projectInstructions } from './instructions';
import { ToolError } from './errors';
import { installProjectOverlay } from './kitOverlay';
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
import { registerOpenProjectTools } from './tools/openProject';
import { registerProvisionTools } from './tools/provisionTools';
import { registerReviewTools } from './tools/review';
import { registerListProjectsTools } from './tools/listProjects';
import { registerKitTools } from './tools/kitTools';
import { registerLessonTools } from './tools/lessonTools';
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

  // ✅ CN-003 — the project catalog overlay, installed once, here, before any
  // tool can be called.
  //
  // It is done eagerly rather than on first catalog access for two reasons. A
  // lazy build would run inside whichever tool happened to ask first and charge
  // that call ~135 ms for a reason its caller cannot see; and a kit that fails
  // to load would surface as an oddity inside an unrelated tool result instead
  // of at the one moment a person is looking at the server starting.
  //
  // 🔴 It never throws. `extractProjectOverlay` converts every failure into an
  // `unavailable` reason on an empty overlay, and `get_project_info` reports it
  // — because a server that answers "this project has no custom node types"
  // when it simply could not read them is the CN-002 defect one layer down.
  if (store !== null) installProjectOverlay(store.projectDir);

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
  //
  // FIX-008 D — it takes the binding now, and only to decide what to say next.
  // Its note used to end "start a server with its directory as the argument",
  // which is true on a bound server and obsolete on an unbound one, where
  // `open_project` does it in a call. Passing the binding is what stops the
  // sentence being right for one of the two servers it ships in.
  registerListProjectsTools(rec, binding);
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
    //
    // BST-002 — and it is the one registration that also takes the binding and
    // the disclosure registry, which is the shape `registerAuthorTools` and
    // `registerPlanTools` above already use. `create_project` is the only tool
    // that can turn an unbound server into a bound one, so it is the only one
    // that needs to be able to write to either.
    registerCreateProjectTools(rec, { binding, disclosure, deferTools });
    // FIX-008 D — the other door into a bound server, and the one BST-002 left
    // unbuilt: `create_project` binds a project it wrote, this binds one that
    // was already there. Same `CreateProjectBinding`, deliberately — they share
    // `completeBind`, so a bind through either door has the same side effects.
    registerOpenProjectTools(rec, { binding, disclosure, deferTools });
    // UNI-010. Takes no store, for the same reason `create_project` does not: a
    // lesson bundle is assembled out of two project directories the caller names,
    // and neither of them is the one this server is pointed at. It writes a
    // folder on disk and never the editor's launcher state (D5).
    registerLessonTools(rec);
    // CN-006. Takes the binding: unlike `create_lesson`, a kit is written INTO
    // the project this server is pointed at, which is also why it is refused
    // outright on an unbound server rather than asking for a directory.
    registerKitTools(rec, binding);
  }
  // AWP-006 — last, and it has to be: the handles do not all exist until every
  // registration has run, and disabling a group before its tools are registered
  // would silently hide nothing.
  disclosure.applyPolicy({ deferTools });
  return { server, binding, disclosure };
}
