/**
 * AWP-006 — progressive tool disclosure: the registry, and `find_tools`.
 *
 * The manifest in `../toolGroups` decides *what* is deferred and says why. This
 * file is the mechanism: it holds the SDK's handle for every registered tool,
 * disables the deferred ones at startup, and re-enables them when somebody asks
 * or when the graph says they are needed.
 *
 * ## How a tool comes back
 *
 * `RegisteredTool.enable()` flips the flag and the SDK emits
 * `notifications/tools/list_changed` — the protocol's own mechanism for exactly
 * this, and the reason nothing here has to invent a side channel. A client that
 * acts on the notification re-lists and sees the revealed tools on its next
 * turn.
 *
 * ⚠️ **A client that ignores the notification never sees them.** That is the one
 * way this trades a cost problem for a capability problem, so it is answered
 * twice: `find_tools`' response says it in the payload, and `--all-tools`
 * restores the whole surface up front in one flag. Neither is a substitute for
 * the other — the payload is for the model, the flag is for whoever configured
 * the client.
 *
 * ## Why the recording proxy
 *
 * The sixteen `register*Tools` functions call `server.registerTool` 89 times and
 * discard every return value. Threading a registry through all of them would
 * touch every file and every call site for no behavioural gain, so
 * {@link recordTools} wraps the server in an object that forwards
 * `registerTool` and keeps the handle. It forwards exactly one method because
 * exactly one is used — asserted by `tests/toolDisclosure.test.ts`, so a
 * registration that starts calling `server.resource()` fails rather than
 * silently escaping the registry.
 *
 * @module noodl-mcp/tools/disclosure
 */

import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { backendRequirementFor } from '../editor-deps';
import { BOOTSTRAP_TOOLS, TOOL_GROUPS, deferredGroups, groupOfTool, type ToolGroupId } from '../toolGroups';
import type { FindToolsResponse } from './responses';
import { guarded, jsonResult } from './util';

/** A node as it arrives at a write door: only its `type` matters here. */
export interface TypedNodeLike {
  type?: string;
}

/**
 * The registry, one per server.
 *
 * Deliberately per-server rather than module-level: the jest suite stands up
 * dozens of servers in one process, and a shared registry would let one spec's
 * `find_tools` call decide another spec's advertised surface.
 */
export class ToolDisclosure {
  private readonly handles = new Map<string, RegisteredTool>();
  private readonly revealed = new Set<ToolGroupId>(['core']);
  /** When false nothing is ever hidden — the `--all-tools` posture. */
  private deferring = true;

  /**
   * BST-001 — whether a project is bound.
   *
   * Set once, at construction, and read by both {@link applyPolicy} and
   * {@link registerFindTools}: those two have to agree about the mode, and a
   * boolean passed to each separately is a boolean that eventually disagrees
   * with itself. Defaults to bound, so every existing call site and every spec
   * that constructs one keeps today's behaviour.
   */
  constructor(private readonly bound: boolean = true) {}

  /** No project: the surface is {@link BOOTSTRAP_TOOLS} and nothing can be revealed. */
  get isBootstrap(): boolean {
    return !this.bound;
  }

  /** Called by {@link recordTools} for every `registerTool`. */
  record(name: string, handle: RegisteredTool): void {
    this.handles.set(name, handle);
  }

  /** Every tool name this server registered, revealed or not. */
  registeredNames(): string[] {
    return [...this.handles.keys()];
  }

  /**
   * Hide the deferred groups. Called once, after every registration — the
   * handles do not all exist before then.
   */
  applyPolicy(options: { deferTools: boolean }): void {
    // BST-001 — the bootstrap surface is a policy applied here, at the one place
    // that already decides what is advertised, rather than sixteen conditional
    // registrations. `--all-tools` does NOT override it: that flag exists for a
    // client that ignores `list_changed`, and there is nothing to change into.
    // Advertising 89 project tools on a server with no project would be the
    // exact failure this mode exists to prevent, in one flag.
    if (this.isBootstrap) {
      this.deferring = true;
      this.revealed.clear();
      for (const [name, handle] of this.handles) {
        if (!BOOTSTRAP_TOOLS.includes(name) && name !== 'find_tools') handle.disable();
      }
      return;
    }
    this.deferring = options.deferTools;
    if (!options.deferTools) {
      for (const group of TOOL_GROUPS) this.revealed.add(group.id);
      return;
    }
    for (const group of deferredGroups()) {
      for (const name of group.tools) this.handles.get(name)?.disable();
    }
  }

  isRevealed(group: ToolGroupId): boolean {
    return this.revealed.has(group);
  }

  /**
   * Reveal a whole group. Returns the names that were actually hidden, so a
   * caller can say "nothing changed" rather than claiming a reveal it did not
   * make — and so a repeat call is visibly a no-op instead of a second
   * `list_changed` storm.
   */
  revealGroup(id: ToolGroupId): string[] {
    const group = TOOL_GROUPS.find((g) => g.id === id);
    if (!group || this.isBootstrap || this.revealed.has(id)) return [];
    this.revealed.add(id);
    return this.revealNames(group.tools);
  }

  /** Reveal named tools without their whole group — what a `query` match gets. */
  revealNames(names: readonly string[]): string[] {
    // BST-001 — the bootstrap surface has no door out of it, and this is the
    // second half of saying so. Guarded here as well as in `revealGroup`
    // because this is the primitive: a future caller that reveals by name would
    // otherwise re-enable a project tool on a server with no project.
    if (this.isBootstrap) return [];
    const newly: string[] = [];
    for (const name of names) {
      const handle = this.handles.get(name);
      if (!handle || handle.enabled) continue;
      handle.enable();
      newly.push(name);
    }
    return newly;
  }

  /**
   * AWP-006's answer to its own warning: the backend tools arrive because the
   * graph needs them, not because the model went looking.
   *
   * A `Record`, `User` or `Cloud Function` node in an authored graph is a
   * stronger statement of intent than any search query — and it is the exact
   * moment the phase-40 finding bites, where a graph with `Record` nodes and no
   * backend validates, builds, and then does nothing at run time. Keyed off
   * `backendRequirementFor`, the editor's reviewed table, so one classification
   * decides both the diagnostic and the disclosure.
   *
   * Returns the revealed names (empty when already revealed, or when the graph
   * needs nothing), which the write door reports back in its success payload.
   */
  revealForNodes(nodes: readonly TypedNodeLike[]): string[] {
    if (this.isRevealed('backend')) return [];
    const needs = nodes.some((n) => typeof n.type === 'string' && backendRequirementFor(n.type) !== undefined);
    return needs ? this.revealGroup('backend') : [];
  }

  /** For the payload: what is advertised, what is not, and how big each is. */
  groupStates(): FindToolsResponse['groups'] {
    return TOOL_GROUPS.map((group) => {
      const present = group.tools.filter((name) => this.handles.has(name));
      return {
        group: group.id,
        title: group.title,
        purpose: group.purpose,
        tools: present.length,
        advertised: !this.deferring || this.revealed.has(group.id)
      };
    }).filter((row) => row.tools > 0);
  }
}

/**
 * The recording wrapper. Structurally an `McpServer` as far as the registration
 * functions are concerned; the cast is narrow and the test pins the assumption.
 */
export function recordTools(server: McpServer, disclosure: ToolDisclosure): McpServer {
  const proxy = Object.create(server) as McpServer;
  proxy.registerTool = ((name: string, ...rest: unknown[]) => {
    const handle = (server.registerTool as (...a: unknown[]) => RegisteredTool)(name, ...rest);
    disclosure.record(name, handle);
    return handle;
  }) as McpServer['registerTool'];
  return proxy;
}

/**
 * The one line a revealed tool's caller needs and cannot work out for itself.
 *
 * Named rather than inlined because it is the same sentence in three payloads
 * and it is the sentence that saves a session: a model whose client did not
 * refresh will otherwise conclude the tool does not exist.
 */
const REFRESH_NOTE =
  'Revealed tools are advertised from your next tool list. If your client does not refresh tool lists on ' +
  'notifications/tools/list_changed, restart the server with --all-tools to advertise everything up front.';

/**
 * BST-001 — what `find_tools` says on a server with no project.
 *
 * ⚠️ **It must not offer what it cannot deliver.** The bound description ends
 * with "one call away", which is true there and a lie here: nothing this tool
 * can do brings the project surface back, because there is no project. So the
 * unbound copy states the surface, states the reason, and hands over the same
 * two exits the bootstrap briefing gives — which is the only useful thing it
 * has, and the reason it stays advertised at all rather than answering "unknown
 * tool".
 */
const BOOTSTRAP_FIND_TOOLS_DESCRIPTION =
  'This server has no project bound, so it advertises everything it currently has: ' +
  BOOTSTRAP_TOOLS.join(', ') +
  '. The rest of the server — reading and authoring components, validation, rendering, the backend — needs a ' +
  'project, and arrives when a server is started with a project directory. This tool cannot reveal them here. ' +
  'Call list_projects to find a project that already exists, or create_project to make one.';

export function registerFindTools(server: McpServer, disclosure: ToolDisclosure): void {
  // The description is the whole disclosure contract for a model that reads
  // nothing else, so it names each deferred group, its size and its subject.
  // Built from the manifest rather than written out, because a hand-written list
  // is exactly the thing that goes stale the first time a group changes.
  const catalogue = deferredGroups()
    .map((g) => `"${g.id}" (${g.tools.length} tools) — ${g.purpose}`)
    .join(' ');
  const bootstrap = disclosure.isBootstrap;

  server.registerTool(
    'find_tools',
    {
      title: 'Find tools',
      description: bootstrap
        ? BOOTSTRAP_FIND_TOOLS_DESCRIPTION
        : 'Reveal tools this server has but is not currently advertising. The authoring set is advertised up ' +
          'front; the rest is held back so it is not re-sent on every turn, and is one call away. Held back: ' +
          catalogue +
          ' Pass `group` to reveal a whole group, or `query` to search names and descriptions across everything ' +
          'and reveal what matches. Call with neither for the inventory.',
      inputSchema: {
        group: z
          .enum(['backend', 'docs', 'explore', 'project', 'theme'])
          .optional()
          .describe('Reveal every tool in this group'),
        query: z.string().optional().describe('Free-text over tool names and titles, e.g. "roles" or "workflow"')
      }
    },
    guarded((args: { group?: Exclude<ToolGroupId, 'core'>; query?: string }) => {
      // Unbound, both arguments are answered the same way, and the answer is not
      // an error: the call was reasonable, there is simply nothing behind it.
      // `groups` is empty rather than a list of groups reported `advertised:
      // false` — that shape reads as "ask again for one of these", which is the
      // turn this whole mode exists to save.
      if (disclosure.isBootstrap) {
        const payload: FindToolsResponse = { revealed: [], groups: [], note: BOOTSTRAP_FIND_TOOLS_DESCRIPTION };
        return jsonResult(payload);
      }
      const revealed: string[] = [];
      if (args.group) revealed.push(...disclosure.revealGroup(args.group));
      if (args.query) {
        const needle = args.query.toLowerCase().trim();
        const matches = TOOL_GROUPS.flatMap((g) => g.tools).filter(
          (name) => needle.length > 0 && name.toLowerCase().includes(needle)
        );
        revealed.push(...disclosure.revealNames(matches));
      }
      const payload: FindToolsResponse = {
        revealed,
        groups: disclosure.groupStates(),
        ...(revealed.length > 0 ? { note: REFRESH_NOTE } : {})
      };
      return jsonResult(payload);
    })
  );
}

/** The note a write door attaches when it revealed the backend group by itself. */
export function backendRevealPayload(revealed: readonly string[]): { backendToolsRevealed?: string } {
  if (revealed.length === 0) return {};
  return {
    backendToolsRevealed:
      `This graph has nodes that need a backend, so the ${revealed.length} backend tools are now advertised — ` +
      'call provision_backend before expecting those nodes to do anything at run time. ' +
      REFRESH_NOTE
  };
}
