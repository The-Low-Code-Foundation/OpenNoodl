/**
 * BST-006 — everything this server says before any tool is called.
 *
 * There are two briefings and they are for two different readers, so they live
 * side by side here rather than inline at the one place that happens to send
 * them. The standing rule from phase 60 (SIG-001/002/004, `portCopy.ts`): copy a
 * measurement depends on goes in one module, where it can be diffed, quoted and
 * asserted against.
 *
 * ## ⚠️ One string, sent once, and it cannot be revised
 *
 * `instructions` is a constructor argument on `McpServer` and part of the
 * `initialize` result. **MCP has no "instructions changed" notification.**
 * Whatever an unbound server says is what that session has for its whole life —
 * including after a later bind. That single fact is why {@link
 * BOOTSTRAP_INSTRUCTIONS} does not attempt {@link projectInstructions}' subject
 * matter: those paragraphs are long, specific and about authoring components
 * into a project, and sent to an agent holding four tools they are noise. They
 * travel in a tool result when a project actually exists.
 *
 * ## Three consumers, one source
 *
 * | Consumer | Takes |
 * |---|---|
 * | `createServer`, unbound | {@link BOOTSTRAP_INSTRUCTIONS} |
 * | `createServer`, bound | {@link projectInstructions} |
 * | a later bind result (BST-002) | {@link projectInstructions} |
 *
 * That third row is why this module exists at all before BST-002 does: "the bind
 * result must not duplicate the briefing" is only assertable when there is one
 * exported string to compare against.
 *
 * @module noodl-mcp/instructions
 */

export interface ProjectInstructionOptions {
  /** Absolute path of the served project. Interpolated into the first clause. */
  projectDir: string;
  allowWrites: boolean;
  /** AWP-006 — whether the backend group is held behind `find_tools`. */
  deferTools: boolean;
}

/**
 * The bound briefing, for a server pointed at a project.
 *
 * ⚠️ **Every paragraph below answers a measured failure and the comment above it
 * is the only record of which one.** They were moved here verbatim from
 * `server.ts` by BST-006; `tests/instructions.test.ts` pins the result character
 * for character against a fixture captured before the move, because measured
 * behaviour depends on this text and a "harmless" rewording is how that gets
 * lost. A paragraph whose reason is lost is a paragraph somebody trims.
 */
export function projectInstructions(options: ProjectInstructionOptions): string {
  const { projectDir, allowWrites, deferTools } = options;
  return (
    `NodeGX (OpenNoodl) project server for ${projectDir} — mode: ` +
    (allowWrites ? 'read-write' : 'read-only (writes require restarting with --allow-writes)') +
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
  );
}

/**
 * The unbound briefing: the whole of what an agent knows before its first call.
 *
 * ## Four jobs, and the order is the point
 *
 * This is read top-down by something deciding its next call, so it goes: what
 * NodeGX is → what state this server is in → the two exits and which to take →
 * what happens after.
 *
 * ⚠️ **`list_projects` is named before `create_project`, deliberately.** An agent
 * that reaches for creation by default makes a second project beside the one its
 * user meant, and "it built my app somewhere else" is a *destructive-feeling*
 * outcome even though nothing was deleted. The ordering is the mitigation and it
 * is testable: `tests/instructions.test.ts` asserts the position, and BST-006's
 * acceptance asks for a live model to be checked against it too.
 *
 * ⚠️ **No authoring guidance.** No Router paragraph, no `Static Data`, no
 * plan-first order. Those belong to a project and they arrive with one — see the
 * module header on why they cannot simply be sent here as well.
 *
 * ⚠️ **The last sentence describes what happens today**, which is that a created
 * project needs a server pointed at it. BST-002 is the task that makes the live
 * server bind itself, and **it must rewrite that sentence when it lands** —
 * promising a bind this build does not perform is worse than the extra step,
 * because the agent stops and waits for tools that are never coming.
 */
export const BOOTSTRAP_INSTRUCTIONS =
  'NodeGX (OpenNoodl) is a visual app builder: an app is a graph of nodes stored as plain files on disk, ' +
  'and this server reads and writes those files. ' +
  'RIGHT NOW NO PROJECT IS BOUND, so only four tools are advertised — the rest of the server (reading ' +
  'components, authoring, validation, rendering, the backend) arrives once there is a project to point it at. ' +
  'TWO WAYS ON: if the user has built with NodeGX before, call list_projects — it reports the projects on ' +
  'this machine, and editing the one they mean is almost always what they want. Only when there is nothing ' +
  'there, or they have asked for something new, call create_project: scope the app with them first (what it ' +
  'is, who uses it, what it stores, the pages, what it deliberately will not do), because that conversation ' +
  'is written into the project as its brief and its build plan. ' +
  'You can also call list_examples and get_example without a project — that is what a NodeGX graph actually ' +
  'looks like, and it is worth reading one before scoping anything. ' +
  'AFTER CREATING: the project is written to disk, and this server stays unbound. Point a server at the new ' +
  'directory to build in it — the same command with the project directory as its argument, and ' +
  '--allow-writes — and its instructions will then describe how to author components.';
