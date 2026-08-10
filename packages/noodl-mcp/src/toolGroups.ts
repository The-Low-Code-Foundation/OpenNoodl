/**
 * AWP-006 — which tools are advertised up front, and which are held back.
 *
 * ## The number this exists to move
 *
 * Write-mode `noodl-mcp` advertises 89 tools. As OpenAI function schemas that is
 * 100,684 characters plus 2,860 of server instructions, **resent on every turn**
 * — 22,968 prompt tokens before a model has read the brief, and roughly 30% of
 * every agent-authoring bill (F37, measured in session 6 and again in session 8).
 * Measured per group on 2026-08-10:
 *
 * | group | tools | chars | share |
 * |---|---|---|---|
 * | backend admin | 57 | 59,840 | 59.4% |
 * | everything else | 32 | 40,754 | 40.6% |
 *
 * **A storefront brief touches none of the 57.** So this module splits the
 * surface: the authoring set is resident and the rest is revealed on demand,
 * which is the shape the `claude` CLI has always used (its `ToolSearch` step is
 * the reason no Claude row in the phase-55 matrix ever met the full surface).
 *
 * ## The rule that constrains the split
 *
 * ⚠️ **A tool the model cannot see is a capability the product does not have.**
 * That is AWP-006's own warning and it is the failure mode to watch — not cost,
 * but a model that never provisions a backend because it never knew it could.
 * Three things keep it honest, and all three are load-bearing:
 *
 * 1. `find_tools` is resident, and its description **names every deferred group
 *    with its size and purpose**. Nothing is hidden; it is one call away and the
 *    model is told so in the surface it always sees.
 * 2. The server instructions name the call by name in the BACKENDS paragraph,
 *    which is where an agent building a data app reads.
 * 3. **Authoring a node that needs a backend reveals the backend group without
 *    being asked** ({@link ToolDisclosure.revealForNodes}). Discovery is a
 *    fallback, not the mechanism: writing a `Record` node is a stronger signal
 *    of intent than any search query, and it costs the model nothing.
 *
 * And the escape hatch: `--all-tools` restores the pre-AWP-006 surface in one
 * flag, for a client that does not act on `notifications/tools/list_changed`.
 *
 * ## Why a table rather than a flag on each registration
 *
 * The same argument `backendRequirement.ts` makes for `NODES_REQUIRING_BACKEND`:
 * ninety claims spread over sixteen files cannot be reviewed the way one table
 * can, and the interesting property — *is every tool classified* — is only
 * checkable where the whole set is in one place. `tests/toolDisclosure.test.ts`
 * asserts the manifest and the registered surface are the same set in both
 * modes, so a tool added to a `register*Tools` function fails the suite until
 * somebody decides whether it is worth a resident slot.
 *
 * @module noodl-mcp/toolGroups
 */

/** Group ids. `core` is the resident set; everything else is revealed on demand. */
export type ToolGroupId = 'core' | 'backend' | 'docs' | 'explore' | 'project' | 'theme';

export interface ToolGroup {
  id: ToolGroupId;
  title: string;
  /**
   * One line, written for a model rather than for us: it is the only thing a
   * deferred tool's existence is conveyed by, so it names the nouns somebody
   * would search for ("collections, roles, auth") rather than the subsystem.
   */
  purpose: string;
  /** Tool names, exactly as registered. */
  tools: readonly string[];
  /** Advertised from the first `tools/list`. */
  resident: boolean;
  /** Registered only under `--allow-writes`. */
  writeOnly?: boolean;
}

/**
 * The resident set: what authoring a component in *this* project needs.
 *
 * ## Decided from the replays, not from taste
 *
 * The four acceptance replays in
 * `dev-docs/tasks/phase-55-llm-authoring-support/measurements/` are a record of
 * which tools four different models actually called while building the same
 * storefront. Counted across all four (s6 sonnet, s6 haiku, s8 DeepSeek V4 Pro,
 * s8 Kimi K3), it overruled three choices this table was about to make:
 *
 * - **`get_example` stays.** 8 calls by sonnet and 6 by Kimi. It was the first
 *   thing on the deferral list — "LAS-007 pushes recipes into rejections anyway"
 *   — and the transcripts say the pull door is used heavily regardless.
 * - **The docs *reads* stay.** All four runs called `list_project_docs` and
 *   `get_project_doc` inside their first six turns; DeepSeek read three docs
 *   before writing anything. Deferring them would put a discovery round trip in
 *   front of reading the brief. The docs *writes* are a different question and
 *   are deferred.
 * - **`search_project` and `explain_component` go.** **Zero calls, all four
 *   runs.** Both are genuinely useful — for somebody asking "where is this used"
 *   about a project they did not write — and neither is on the path of building
 *   one, which is exactly what deferral is for.
 *
 * `create_project`, `get_import_report` and `review_project` were also called
 * zero times, and `create_project` (4,036 chars) is the third most expensive
 * tool in the server: it creates a project *somewhere else* and cannot be part
 * of authoring the one being served.
 *
 * ⚠️ Four runs of one brief is not a usage study. It is evidence about a
 * storefront build specifically, which is the workload this budget exists for —
 * and every tool it argues for deferring is one call away, so being wrong about
 * one costs a round trip rather than a capability.
 */
const CORE_TOOLS = [
  // Reading the project — read.ts
  'get_project_info',
  'list_components',
  'get_component',
  // The node catalog — catalogTools.ts
  'list_node_types',
  'get_node_type',
  // `get_example` stays and `list_examples` does not, which looks arbitrary
  // until you count: `get_example` was called 14 times across the four replays
  // and `list_examples` zero. `get_node_type` returns each type's example ids
  // *and titles* inline, so the browse call has nothing left to answer.
  'get_example',
  // Validation — validateTools.ts
  'validate_component',
  'validate_project',
  // Seeing the result — renderTools.ts. LAS-005: the instructions push this on
  // every visual write, so it is resident by the same argument as the catalog.
  'render_report',
  // The design system, read half — styleTools.ts. Named in the instructions as a
  // step in every component write, while setting a preset is a once-per-project
  // act; hence the read here and the writes in `theme`.
  'get_style_vocabulary',
  // The brief — docsTools.ts, read half. See above: every replay read these
  // before it wrote anything.
  'list_project_docs',
  'get_project_doc',
  // Disclosure itself — always advertised, or none of the rest is reachable.
  'find_tools'
] as const;

const CORE_WRITE_TOOLS = [
  // Authoring — author.ts
  'create_component',
  'update_component',
  'delete_component',
  // Plans — planTools.ts. The instructions make create_plan step one of anything
  // bigger than a two-node fix, so the plan set cannot be a turn behind.
  'create_plan',
  'stage_plan_operation',
  'apply_plan',
  'discard_plan'
] as const;

const BACKEND_TOOLS = [
  // provisionTools.ts — the entry point and its lifecycle pair. Grouped with the
  // admin set deliberately: an agent that needs one needs the others in the same
  // breath, and splitting them would cost a second discovery round trip at the
  // exact moment the model has decided to build a data app.
  'provision_backend',
  'stop_backend',
  'list_backend_processes',
  // backendTools.ts — read
  'list_backends',
  'get_backend_permissions',
  'list_backend_roles',
  'list_backend_api_keys',
  'list_backend_triggers',
  'get_backend_trigger',
  'list_backend_workflows',
  'get_backend_workflow',
  'list_backend_step_kinds',
  'get_backend_email_config',
  'list_backend_email_templates',
  'preview_backend_email_template',
  'get_backend_admin_dashboard',
  'check_backend_access',
  'list_backend_backups',
  'export_backend_collection',
  'diff_backend_schema',
  'get_backend_search_config',
  'get_backend_file_config',
  'get_backend_ops_config',
  'query_backend_audit',
  'get_backend_auth_config',
  'list_user_identities',
  // backendTools.ts — write
  'set_collection_permissions',
  'reset_collection_permissions',
  'create_backend_role',
  'delete_backend_role',
  'assign_role_user',
  'set_backend_email_config',
  'send_backend_test_email',
  'set_backend_email_template',
  'reset_backend_email_template',
  'create_backend_api_key',
  'revoke_backend_api_key',
  'create_backend_trigger',
  'update_backend_trigger',
  'set_backend_trigger_enabled',
  'rotate_backend_trigger_secret',
  'delete_backend_trigger',
  'create_backend_workflow',
  'run_backend_backup',
  'set_backend_backup_policy',
  'update_backend_workflow',
  'delete_backend_workflow',
  'run_backend_workflow',
  'import_backend_collection',
  'cancel_backend_workflow_run',
  'apply_backend_schema',
  'restore_backend',
  'set_collection_search',
  'configure_backend_files',
  'disable_collection_search',
  'rebuild_search_index',
  'run_backend_file_sweep',
  'configure_backend_auth_provider',
  'remove_backend_auth_provider',
  'configure_backend_auth_policy'
] as const;

/**
 * The manifest.
 *
 * Order matters only for display: `find_tools` lists deferred groups in this
 * order, largest first, because the size is the thing a model needs to weigh
 * before asking for one.
 */
export const TOOL_GROUPS: readonly ToolGroup[] = Object.freeze([
  {
    id: 'core',
    title: 'Authoring',
    purpose: 'Read, plan, author and validate components in this project, and render it to see the result.',
    tools: [...CORE_TOOLS, ...CORE_WRITE_TOOLS],
    resident: true
  },
  // ⚠️ Every `purpose` below is re-sent on every turn inside `find_tools`'
  // description — the one part of the deferred half that is never deferred. They
  // are written to the shortest form that still names the nouns somebody would
  // search for; a paragraph here is a paragraph billed 60 times in a run.
  {
    id: 'backend',
    title: 'Backend',
    purpose:
      'provision and administer the backend — collections, schema, roles, permissions, auth, users, ' +
      'workflows, triggers, files, search, email, API keys, backups. Any app with Record, User or Cloud ' +
      'Function nodes needs these.',
    tools: BACKEND_TOOLS,
    resident: false
  },
  {
    id: 'docs',
    title: 'Writing project documentation',
    purpose: 'write or seed the project\'s design docs, and assemble a project review to draft one from.',
    tools: ['write_project_doc', 'seed_project_docs', 'review_project'],
    resident: false
  },
  {
    id: 'explore',
    title: 'Exploring an existing project',
    purpose: 'search every graph for a type, label or value; explain one component; browse the example library.',
    tools: ['search_project', 'explain_component', 'list_examples'],
    resident: false
  },
  {
    id: 'project',
    title: 'Project lifecycle',
    purpose: 'create a new project elsewhere on disk; read an imported project\'s conversion report.',
    tools: ['create_project', 'get_import_report'],
    resident: false
  },
  {
    id: 'theme',
    title: 'Design tokens',
    purpose: 'change the design system — set token values, or apply a style preset.',
    tools: ['set_project_tokens', 'set_style_preset'],
    resident: false
  }
]);

/**
 * Tools registered only under `--allow-writes`, so the completeness guard can
 * tell "missing because read-only" from "missing because somebody deleted it".
 *
 * Kept as a set rather than a per-group flag because the split cuts *across*
 * groups — `backend` holds 25 read tools and 35 writes — and a group-level flag
 * would have to lie about one of them.
 */
export const WRITE_ONLY_TOOLS: ReadonlySet<string> = new Set<string>([
  ...CORE_WRITE_TOOLS,
  'provision_backend',
  'stop_backend',
  // Reads the process registry and changes nothing — but it ships in
  // `registerProvisionTools`, which is inside the write gate, so it is
  // write-only in fact whatever it is in spirit. Recorded as observed rather
  // than as intended: the suite compares this list against the two modes in
  // both directions, and this entry is the first thing it caught.
  'list_backend_processes',
  'set_collection_permissions',
  'reset_collection_permissions',
  'create_backend_role',
  'delete_backend_role',
  'assign_role_user',
  'set_backend_email_config',
  'send_backend_test_email',
  'set_backend_email_template',
  'reset_backend_email_template',
  'create_backend_api_key',
  'revoke_backend_api_key',
  'create_backend_trigger',
  'update_backend_trigger',
  'set_backend_trigger_enabled',
  'rotate_backend_trigger_secret',
  'delete_backend_trigger',
  'create_backend_workflow',
  'run_backend_backup',
  'set_backend_backup_policy',
  'update_backend_workflow',
  'delete_backend_workflow',
  'run_backend_workflow',
  'import_backend_collection',
  'cancel_backend_workflow_run',
  'apply_backend_schema',
  'restore_backend',
  'set_collection_search',
  'configure_backend_files',
  'disable_collection_search',
  'rebuild_search_index',
  'run_backend_file_sweep',
  'configure_backend_auth_provider',
  'remove_backend_auth_provider',
  'configure_backend_auth_policy',
  'write_project_doc',
  'seed_project_docs',
  'create_project',
  'set_project_tokens',
  'set_style_preset'
]);

/** The group a tool belongs to, or `undefined` if the manifest has never heard of it. */
export function groupOfTool(name: string): ToolGroupId | undefined {
  for (const group of TOOL_GROUPS) if (group.tools.includes(name)) return group.id;
  return undefined;
}

/** Deferred groups, in manifest order. */
export function deferredGroups(): readonly ToolGroup[] {
  return TOOL_GROUPS.filter((g) => !g.resident);
}
