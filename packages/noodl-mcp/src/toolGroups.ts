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
export type ToolGroupId = 'core' | 'backend' | 'docs' | 'explore' | 'lesson' | 'project' | 'theme';

/**
 * The ids a caller can actually hand to `find_tools`. `core` is advertised from
 * the first `tools/list`, so "reveal core" is not a request that means anything —
 * and the handler has always been typed to say so. `deferredGroups()` is the one
 * producer of these ids, and it is what enforces the exclusion.
 */
export type DeferredGroupId = Exclude<ToolGroupId, 'core'>;

export interface ToolGroup {
  id: ToolGroupId;
  title: string;
  /**
   * One line, written for a model rather than for us: it is the only thing a
   * deferred tool's existence is conveyed by, so it names the nouns somebody
   * would search for ("collections, roles, auth") rather than the subsystem.
   */
  purpose: string;
  /**
   * DEF-006 (b) — words a model would search for that the `purpose` cannot
   * afford to carry.
   *
   * 🔴 **Read by `find_tools`' `query` and rendered into nothing.** Every
   * `purpose` above is re-sent inside `find_tools`' description on every turn of
   * every session, which is why two of them already record a discoverability
   * cost they took deliberately rather than spend resident tokens on: the
   * `project` group does not mention kits, and `explore` does not mention
   * prefabs. Both notes end the same way — *"widening the purpose costs resident
   * tokens and belongs in the next budget renegotiation"*.
   *
   * This is that widening at zero resident cost. Measured with the same fixture
   * and normalisation as `tests/toolDisclosure.test.ts`: **8,255 tokens before
   * and 8,255 after**, because nothing here reaches a description.
   *
   * ⚠️ Not a dumping ground. A keyword is a word somebody types when they mean
   * this group and would otherwise be told there is nothing here; a query that
   * matches everything reveals everything, which is the deferral undone.
   */
  keywords?: readonly string[];
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
  // HLS-013 — the deploy. In this group and not the read set because it is the
  // other half of `provision_backend`: an agent that has just made a backend is
  // exactly the agent that needs to put functions on it, and finding out it
  // exists a round trip later is the cost this grouping avoids.
  'deploy_cloud_functions',
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
    // ✅ LBR-008 — the shelf. Appended here rather than given a `library` group,
    // and the placement was measured the way CN-006 measured `create_node_kit`'s
    // (2026-08-22, same fixture and normalisation as `toolDisclosure.test.ts`):
    // the surface stood at **8,255 against the 8,280 bar — 25 free** before this
    // task, a new group costs ~26, and appending costs **0** because the only
    // resident trace of a deferred group is `find_tools`' `(N tools)`, and
    // "3 tools" and "6 tools" are the same length.
    //
    // 🔴 The `purpose` line above says "example library", not "prefab library" —
    // the same trade `create_node_kit` records. Nothing is unreachable:
    // `find_tools`' `query` matches tool names, so "library" and "prefab" reveal
    // these from anywhere, and `tests/libraryTools.test.ts` asserts that door.
    // Widening the purpose costs resident tokens and belongs in the next budget
    // renegotiation, not here.
    // DEF-006 (b) — the LBR-008 note above records that "prefab" is reachable only
    // because it happens to be inside a tool name. Said outright here, along with
    // the words for the half of this group that searches an existing graph.
    keywords: ['prefab', 'shelf', 'recipe', 'find', 'search', 'where is', 'understand'],
    tools: ['search_project', 'explain_component', 'list_examples', 'list_library', 'get_library_entry', 'install_prefab'],
    resident: false
  },
  {
    // UNI-010. Deferred without hesitation: authoring a lesson is a thing a user
    // asks for in so many words, so `find_tools` is a sufficient door — and the
    // brief alone is several thousand characters, which is exactly the kind of
    // weight AWP-006 exists to keep off every turn of every other session.
    id: 'lesson',
    title: 'Authoring a lesson',
    // ⚠️ Two lines, because this string is billed on every turn of every session
    // — including the ones that will never write a lesson. The first draft spent
    // 58 tokens explaining steps, starters and solutions, and pushed the resident
    // surface past AWP-006's 8,200-token gate on its own. The brief is where that
    // belongs, and the brief is deferred.
    purpose: 'write, verify and grade a tutorial lesson for the editor to teach.',
    // ✅ A fourth tool cost this group NOTHING resident, and it was measured
    // rather than reasoned about (2026-08-16): the surface is 8,223 tokens with
    // `derive_starter` and 8,223 without, because the only resident mention of a
    // deferred group is `find_tools`' `(N tools)` — and "3 tools" and "4 tools"
    // are the same length. 🔴 The handover said this slice "really does cost
    // surface, it is a tool not a condition verb". It does not. What costs
    // surface is a *resident* tool (this one measures 276 tokens if it lands
    // there) or a whole new group (25, which is what UNI-010 spent). The 57
    // tokens of headroom are untouched and phase 69's CN-006/CN-009 are not
    // competing with this.
    tools: ['get_lesson_brief', 'create_lesson', 'check_lesson', 'derive_starter'],
    resident: false
  },
  {
    id: 'project',
    title: 'Project lifecycle',
    purpose:
      'list the NodeGX projects on this machine; create a new project elsewhere on disk; read an imported ' +
      'project\'s conversion report.',
    // ✅ CN-006 — `create_node_kit` is here, and the placement was measured
    // rather than chosen (2026-08-16, same fixture and normalisation as
    // `tests/toolDisclosure.test.ts`):
    //
    // | placement | surface | cost |
    // |---|---|---|
    // | baseline | 8,223 | — |
    // | appended to this group | 8,223 | **0** |
    // | a new deferred `kit` group | 8,249 | 26 |
    // | resident | 8,464 | 241 — **184 over the 8,280 bar on its own** |
    //
    // Zero, for the reason the `lesson` group's note records: the only resident
    // trace of a deferred group is `find_tools`' `(N tools)`, and "3 tools" and
    // "4 tools" are the same length. A `kit` group would read better and would
    // have spent 26 of the 57 tokens CN-009 is competing for, against a written
    // *"there should not be a third"* renegotiation.
    //
    // 🔴 **What that costs, stated rather than argued away:** the `purpose` line
    // above does not mention kits, and it is the only description a model reads
    // before choosing a group. Nothing is unreachable — `find_tools`' `query`
    // matches tool *names*, so "kit" reveals it from anywhere — but a model
    // browsing purposes will not meet it. `tests/kitTools.test.ts` asserts that
    // door works rather than assuming it. Widening the purpose is the fix, and
    // it costs resident tokens, so it belongs in the same conversation as
    // CN-009's spend rather than being taken quietly here.
    // 🔴 FIX-008 D — `open_project` is here and **not named in `purpose` above**,
    // which is the same trade `create_node_kit` records and lands the opposite
    // way round for a reason worth stating. Naming a tool in `purpose` costs
    // resident tokens against the 57 free, and buys discoverability *on a bound
    // server* — which is the one server where this tool can do nothing but
    // report where it is already bound. Where it matters it is not behind
    // `find_tools` at all: it is in {@link BOOTSTRAP_TOOLS}, advertised
    // outright, in the mode it exists for. So the group membership is
    // bookkeeping (the manifest guard requires every tool to have a home) and
    // the reveal path is not the one anybody uses.
    // DEF-006 (b) — the widening the CN-006 note above asks for, off the resident
    // budget. `kit` already reached `create_node_kit` by tool name; `custom node`
    // and `import` did not reach anything.
    keywords: ['kit', 'custom node', 'import', 'new project', 'open'],
    tools: ['list_projects', 'open_project', 'create_project', 'get_import_report', 'create_node_kit'],
    resident: false
  },
  {
    id: 'theme',
    title: 'Design tokens',
    purpose: 'change the design system — set token values, or apply a style preset.',
    // DEF-006 (b). The words an agent told to "style on-system" actually types.
    // `colour`/`color` and `palette` appear in neither the title nor the purpose,
    // and this is the group holding the only two tools that change how an app
    // looks — so the one instruction the design doctrine gives most often led to
    // an empty answer.
    keywords: ['theme', 'colour', 'color', 'palette', 'styling', 'style guide', 'branding', 'appearance', 'dark mode'],
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
  // LBR-008. The shelf's reads (`list_library`, `get_library_entry`) ship in
  // both modes; installing writes components, styles, assets and modules into
  // the bound project, so it ships inside the write gate.
  'install_prefab',
  // UNI-010. `create_lesson` writes a directory, so the whole group ships inside
  // the write gate — including the two that change nothing. Same reasoning, and
  // the same honesty, as `list_backend_processes` below: recorded as observed.
  // Splitting the brief out to keep it readable on a read-only server would put a
  // door in front of a room nobody can enter.
  'get_lesson_brief',
  'create_lesson',
  'check_lesson',
  'derive_starter',
  'provision_backend',
  'stop_backend',
  // HLS-013. Writes a bundle to a running backend, so it is write-gated for the
  // same reason `provision_backend` is.
  'deploy_cloud_functions',
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
  // FIX-008 D. Binding is not a write, and this is still honest rather than
  // aspirational: it ships inside `server.ts`'s write gate beside
  // `create_project`, so it is write-only in fact. It costs nothing, because an
  // unbound server is always `--allow-writes` — and a *bound* read-only server
  // would refuse the call anyway.
  'open_project',
  // CN-006 — writes a folder into the project.
  'create_node_kit',
  'set_project_tokens',
  'set_style_preset'
]);

/**
 * BST-001 — the whole advertised surface of a server with no project bound.
 *
 * ## Why four, and why these four
 *
 * ⚠️ **A model calls what it is shown.** An advertised `update_component` on a
 * server with nothing to update produces a call, a refusal and a turn spent, and
 * repeats until the model gives up or invents an explanation. So the unbound
 * surface is not "everything, erroring" — it is a different, smaller set, and
 * everything else is genuinely absent from `tools/list`.
 *
 * | Tool | Why it is here |
 * |---|---|
 * | `list_projects` | So an agent can find the project the user already has instead of making a second one. First for the same reason it is named first in {@link BOOTSTRAP_INSTRUCTIONS} |
 * | `open_project` | 🔴 FIX-008 D — so what `list_projects` finds can be *opened*. Second, immediately after it, because the pair is one action |
 * | `create_project` | The point of the mode |
 * | `list_examples` | Scoping a build with no project to read from |
 * | `get_example` | The same, and it is the one thing that shows what a NodeGX graph actually looks like |
 *
 * ## 🔴 FIX-008 D — this list was four, and the fifth is a renegotiation
 *
 * BST-001's acceptance says "exactly the four bootstrap tools", and that number
 * is now five (six advertised, with `find_tools`). The reason the original four
 * were four is stated above and still holds: **a model calls what it is shown**,
 * so this surface is the set of things that genuinely work here, not everything
 * erroring. `open_project` passes that bar in the only way that matters — it is
 * the one tool in the mode whose success *ends* the mode.
 *
 * The cost of it being absent was not an unhelpful surface, it was the wrong
 * project: `list_projects` could find the user's real app and nothing could open
 * it, so the only advertised way forward was `create_project`, which builds a
 * second one beside it. Every count and every list in the product is derived
 * from this constant — the stderr banner, the briefing's spelled-out number,
 * `find_tools`' unbound description, and three specs — so the arithmetic follows
 * on its own; the paragraph is here because the *policy* did not.
 *
 * ## ⚠️ `find_tools` is a fifth advertised tool, and this list does not name it
 *
 * BST-001's acceptance says "exactly the four bootstrap tools", and its §3 spends
 * a paragraph designing what `find_tools` does *while unbound* — "it should
 * report the bootstrap set and say plainly that the rest arrive with a project".
 * Both cannot be true, so this build takes the second: `find_tools` is advertised
 * in every mode, and unbound it reveals nothing and says why.
 *
 * The reason is the same one that decides every other string in this mode. An
 * absent `find_tools` answers a model that has met this server before with
 * "unknown tool", which is a dead end — no fix named, nothing to do next. A
 * present one answers with the two exits. It is one short description, rewritten
 * for the mode rather than listing groups it cannot open, and it is the only
 * tool in the surface that can be called wrongly and still help.
 *
 * So: this list is the *capability* surface, `tools/list` is these four plus
 * `find_tools`, and `tests/bootstrap.test.ts` asserts exactly that set — nothing
 * project-shaped, and nothing merely present-and-erroring.
 *
 * ⚠️ Every name here must exist in {@link TOOL_GROUPS}; `tests/bootstrap.test.ts`
 * asserts it, because a typo would silently produce a three-tool server.
 */
export const BOOTSTRAP_TOOLS: readonly string[] = Object.freeze([
  'list_projects',
  'open_project',
  'create_project',
  'list_examples',
  'get_example'
]);

/**
 * 🔴 F87 — what `tools/list` actually returns in bootstrap mode: the capability
 * surface **plus `find_tools`**, which stays advertised because it is the one
 * tool that can be called wrongly and still help.
 *
 * The distinction above was already written down and the human-facing strings
 * still said "four": the briefing an agent reads at `initialize`, and the
 * stderr banner the person configuring the client reads. Both are now derived
 * from here, so the number cannot disagree with the server again.
 *
 * ⚠️ **Not cosmetic.** The briefing is the first thing a cold agent reads and
 * the sentence containing that number is the one that tells it what it has;
 * a count that does not match `tools/list` is the server being wrong about
 * itself in the one place nothing else can correct.
 */
export const BOOTSTRAP_ADVERTISED: readonly string[] = Object.freeze([...BOOTSTRAP_TOOLS, 'find_tools']);

/** English for a small count, so a briefing reads like prose rather than a log line. */
export function spellCount(n: number): string {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? String(n);
}

/** The group a tool belongs to, or `undefined` if the manifest has never heard of it. */
export function groupOfTool(name: string): ToolGroupId | undefined {
  for (const group of TOOL_GROUPS) if (group.tools.includes(name)) return group.id;
  return undefined;
}

/** Deferred groups, in manifest order. */
export function deferredGroups(): readonly (ToolGroup & { id: DeferredGroupId })[] {
  // 🔴 The `id` test is redundant against the manifest as it stands: `core` is the
  // single `resident: true` entry, so `!g.resident` already excludes it and both
  // filters return the same six ids (measured). It is written anyway so the
  // narrowed return type is enforced by the code rather than asserted by a
  // comment — were `core` ever marked deferred, `find_tools` would advertise an
  // argument its handler is typed never to receive, which is exactly the
  // schema-vs-handler drift this signature exists to close.
  return TOOL_GROUPS.filter((g): g is ToolGroup & { id: DeferredGroupId } => !g.resident && g.id !== 'core');
}
