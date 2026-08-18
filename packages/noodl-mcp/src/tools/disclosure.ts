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
import {
  BOOTSTRAP_ADVERTISED,
  BOOTSTRAP_TOOLS,
  TOOL_GROUPS,
  deferredGroups,
  type DeferredGroupId,
  type ToolGroupId
} from '../toolGroups';
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
   * Read by both {@link applyPolicy} and {@link registerFindTools}: those two
   * have to agree about the mode, and a boolean passed to each separately is a
   * boolean that eventually disagrees with itself. Defaults to bound, so every
   * existing call site and every spec that constructs one keeps today's
   * behaviour.
   *
   * ⚠️ **BST-002 made it mutable**, and it is the only mutable thing about the
   * mode: `bindProject` flips it and re-derives everything that was decided
   * from it, rather than letting a second source of truth appear.
   */
  private bound: boolean;

  /**
   * What `--all-tools` asked for, which is **not** the same as what bootstrap
   * mode did with it.
   *
   * F72 — the flag is refused in bootstrap mode, because advertising 89 project
   * tools on a server with no project is that mode's whole failure in one flag.
   * But it must not be *forgotten*: at bind there is finally something to
   * change into, and a user who passed the flag for a client that ignores
   * `list_changed` still means it. So the request is remembered here and
   * honoured by {@link bindProject}.
   */
  private requestedDeferTools = true;

  /** Set by {@link registerFindTools} so a later bind can revise its description. */
  private describeForBoundMode: (() => string) | null = null;

  constructor(bound = true) {
    this.bound = bound;
  }

  /** No project: the surface is {@link BOOTSTRAP_TOOLS} and nothing can be revealed. */
  get isBootstrap(): boolean {
    return !this.bound;
  }

  /** Called by {@link recordTools} for every `registerTool`. */
  record(name: string, handle: RegisteredTool): void {
    this.handles.set(name, handle);
  }

  /**
   * BST-002 — how to describe `find_tools` once a project exists.
   *
   * Handed over by {@link registerFindTools} rather than duplicated here: the
   * paragraph is that module's, and the registry only needs to be able to ask
   * for it again at bind time.
   */
  useBoundDescription(describe: () => string): void {
    this.describeForBoundMode = describe;
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
    this.requestedDeferTools = options.deferTools;
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
        // 🔴 F87 — one list rather than a list plus a special case. The
        // `&& name !== 'find_tools'` this replaces was the whole reason the
        // served count and the advertised count could disagree.
        if (!BOOTSTRAP_ADVERTISED.includes(name)) handle.disable();
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

  /**
   * BST-002 — leave bootstrap mode, and advertise what a bound server advertises.
   *
   * ⚠️ **The `find_tools` description is revised here, and this is the half that
   * gets missed.** That description is chosen from the mode *at registration*
   * ({@link registerFindTools}), so a server that binds mid-session would keep
   * advertising the bootstrap copy — which states, in the one place a model
   * looks to find out what else exists, that *"this tool cannot reveal them
   * here"*. Every other part of the bind would work and the door out of the
   * deferred set would be advertised as bolted shut. `RegisteredTool.update()`
   * is the mechanism, and it emits `list_changed` like everything else.
   *
   * ✅ That notification is acted on: measured 2026-08-11, Claude Code re-issues
   * `tools/list` 3ms after it. See `MEASUREMENTS-CLIENT-CONTRACT.md` §1.
   *
   * @returns the tool names that became advertised, so the caller can say what
   *   arrived rather than claiming a reveal it did not make.
   */
  bindProject(): string[] {
    if (this.bound) return [];
    this.bound = true;

    // Re-derive from the one flag, rather than adding a second policy path:
    // this is exactly what `applyPolicy` would have decided had the server
    // started bound, which is the property that keeps the two modes converging
    // instead of drifting.
    this.deferring = this.requestedDeferTools;
    const revealed: string[] = [];
    for (const group of TOOL_GROUPS) {
      if (!this.deferring || group.resident) {
        this.revealed.add(group.id);
        revealed.push(...this.enableAll(group.tools));
      }
    }

    // ⚠️ Last, and after the reveals: the description names the groups that are
    // still held back, so it must be built from the surface as it now is.
    const findTools = this.handles.get('find_tools');
    if (findTools && this.describeForBoundMode) {
      findTools.update({ description: this.describeForBoundMode() });
    }

    return revealed;
  }

  /** Enable named handles that are currently disabled, reporting only what changed. */
  private enableAll(names: readonly string[]): string[] {
    const newly: string[] = [];
    for (const name of names) {
      const handle = this.handles.get(name);
      if (!handle || handle.enabled) continue;
      handle.enable();
      newly.push(name);
    }
    return newly;
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
    return this.enableAll(names);
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

/**
 * The bound-mode description.
 *
 * ⚠️ A function rather than a constant because BST-002 needs it **twice**: once
 * at registration on a server that started bound, and once at
 * {@link ToolDisclosure.bindProject} on a server that did not. Two spellings of
 * this paragraph would mean a mid-session bind advertising a subtly different
 * contract from a server started the ordinary way, and nothing would report it.
 */
export function boundFindToolsDescription(): string {
  // The description is the whole disclosure contract for a model that reads
  // nothing else, so it names each deferred group, its size and its subject.
  // Built from the manifest rather than written out, because a hand-written list
  // is exactly the thing that goes stale the first time a group changes.
  const catalogue = deferredGroups()
    .map((g) => `"${g.id}" (${g.tools.length} tools) — ${g.purpose}`)
    .join(' ');

  return (
    'Reveal tools this server has but is not currently advertising. The authoring set is advertised up ' +
    'front; the rest is held back so it is not re-sent on every turn, and is one call away. Held back: ' +
    catalogue +
    ' Pass `group` to reveal a whole group, or `query` to search names and descriptions across everything ' +
    'and reveal what matches. Call with neither for the inventory.'
  );
}

export function registerFindTools(server: McpServer, disclosure: ToolDisclosure): void {
  const bootstrap = disclosure.isBootstrap;
  // 🔴 BST-002 — the description is chosen from the mode HERE, at registration,
  // which is why a server that binds mid-session has to revise it. Handing the
  // builder to the registry is what makes that possible without the registry
  // owning a second copy of the text.
  disclosure.useBoundDescription(boundFindToolsDescription);

  server.registerTool(
    'find_tools',
    {
      title: 'Find tools',
      description: bootstrap ? BOOTSTRAP_FIND_TOOLS_DESCRIPTION : boundFindToolsDescription(),
      inputSchema: {
        // 🔴 Derived from the manifest, not written out. Hand-listed, this enum
        // is a second statement of which groups exist — and it was already one
        // group stale the moment UNI-010 added `lesson`: `find_tools` advertised
        // the group in its own description and then rejected the argument that
        // reveals it, which is AWP-006's own failure mode ("a tool the model
        // cannot see is a capability the product does not have") reached from the
        // inside. The manifest is the one place the set is decided.
        group: z
          .enum(deferredGroups().map((g) => g.id) as [DeferredGroupId, ...DeferredGroupId[]])
          .optional()
          .describe('Reveal every tool in this group'),
        query: z.string().optional().describe('Free-text over tool names and titles, e.g. "roles" or "workflow"')
      }
    },
    guarded((args: { group?: DeferredGroupId; query?: string }) => {
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
