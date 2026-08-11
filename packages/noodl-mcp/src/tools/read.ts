/**
 * Read tools: get_project_info, list_components, get_component,
 * search_project, explain_component. Always registered.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { describeComponent } from '../describe';
import { AUTHORING_TRAPS, DECOMPOSITION_DOCTRINE_MD, DESIGN_DOCTRINE_MD, isComponentRef, refToPath } from '../editor-deps';
import { ToolError } from '../errors';
import type { ProjectStore } from '../project/ProjectStore';
import type {
  ExplainComponentResponse,
  GetComponentResponse,
  ListComponentsResponse,
  ProjectInfoResponse,
  SearchMatch,
  SearchProjectResponse
} from './responses';
import { guarded, jsonResult } from './util';
import { projectVisualPredicate } from './author';
import { readVisualRoots } from '../visualRoots';

const SEARCH_RESULT_CAP = 200;

/**
 * LEG-006 — ceiling on the `description` carried on each `list_components` row,
 * in characters.
 *
 * The column is the point of the field: an agent choosing between fourteen
 * components should not have to read fourteen graphs. But it is also a
 * per-row cost on every listing, against a budget AWP-005 spent a session
 * cutting from 25,886 tokens/turn to 7,828, and a description is free-text —
 * nothing stops a model writing a paragraph.
 *
 * 160 characters is the ceiling because it is a round number in the unit
 * actually printed (characters, not tokens — a token count is model-specific
 * and cannot be asserted), and because it clears the field's own instruction:
 * `AUTHORED_PAYLOAD_FIELDS` asks for "one or two sentences". Measured over the
 * 72 real descriptions in the 35 projects under "NodeGX test projects/"
 * (2026-08-11): mean 99, median 84, max 274 characters. A 160 ceiling touches
 * 11 of the 72 — it bounds the pathological row and leaves the typical one
 * whole.
 *
 * Truncation is here, at the tool seam, and NOT in `ProjectStore.listComponents`
 * — `validate.ts`, `review.ts`, `pageRegistration.ts` and `nodeIds.ts` all call
 * that method, and none of them is a wire-cost site. `get_component` returns the
 * description in full: one component is not a budget question.
 */
export const LIST_COMPONENTS_DESCRIPTION_CHARS = 160;

/**
 * Cuts a description to {@link LIST_COMPONENTS_DESCRIPTION_CHARS}, marking the
 * cut so a reader can tell a truncated sentence from a terse one. The ellipsis
 * is inside the ceiling, so no row ever exceeds it.
 */
export function truncateRowDescription(description: string): string {
  if (description.length <= LIST_COMPONENTS_DESCRIPTION_CHARS) return description;
  return description.slice(0, LIST_COMPONENTS_DESCRIPTION_CHARS - 1).trimEnd() + '…';
}

export function registerReadTools(server: McpServer, store: ProjectStore, options: { allowWrites: boolean }): void {
  server.registerTool(
    'get_project_info',
    {
      title: 'Get project info',
      description:
        'Project metadata and orientation: name, settings, root component, routes, global style names, ' +
        'component stats and whether this server allows writes. On a read-write server it also returns ' +
        '`authoringDoctrine` — how work is expected to be factored into components. Cheap — call this first.',
      inputSchema: {}
    },
    guarded(() => {
      const project = store.readProjectFile();
      const registry = store.readRegistry();
      const routes = store.readRoutes();
      const styles = store.readStyles();
      const rootEntry = Object.entries(registry.components).find(([, e]) => e.type === 'root');
      const payload: ProjectInfoResponse = {
        name: project?.name,
        id: project?.id,
        version: project?.version,
        runtimeVersion: project?.runtimeVersion,
        settings: project?.settings,
        rootComponent: rootEntry ? { path: rootEntry[0] } : undefined,
        routes: routes?.routes,
        styles: styles
          ? {
              colors: styles.colors,
              textStyles: styles.textStyles ? Object.keys(styles.textStyles) : undefined,
              variantCount: styles.variants?.length
            }
          : undefined,
        stats: registry.stats ?? { totalComponents: Object.keys(registry.components).length },
        mode: options.allowWrites ? 'read-write' : 'read-only',
        note:
          'Component identifiers: tools accept the path form ("Pages/Home") or the legacy name ("/Pages/Home"). ' +
          'A node that instantiates a project component uses the component\'s legacyName as its node type.',
        // AAQ-008: an external agent gets no system prompt, so this response is
        // the only orientation surface that reaches it before it authors. Sent
        // only when writes are allowed — see ProjectInfoResponse.
        ...(options.allowWrites
          ? {
              // LAS-007 §3 — the traps FIRST. This response is the only
              // orientation an external agent gets before it authors, and the
              // audit measured that what arrives here gets read while what has
              // to be fetched does not. Seven lines, every one a silent failure
              // this project has measured.
              authoringTraps: AUTHORING_TRAPS,
              authoringDoctrine: DECOMPOSITION_DOCTRINE_MD,
              designDoctrine: DESIGN_DOCTRINE_MD
            }
          : {})
      };
      return jsonResult(payload);
    })
  );

  server.registerTool(
    'list_components',
    {
      title: 'List components',
      description:
        'List the project\'s components from the registry: path, legacyName, type (root/page/visual/logic/cloud), ' +
        'node/connection counts, and `description` — what the component is for, in the author\'s own words, for ' +
        'the components that have one (cut at ' +
        LIST_COMPONENTS_DESCRIPTION_CHARS +
        ' characters, ending "…"; `get_component` returns it in full). Read the descriptions before rebuilding ' +
        'something the project already has. Filter with `type` or `path_prefix`.',
      inputSchema: {
        type: z.enum(['root', 'page', 'visual', 'logic', 'cloud']).optional().describe('Only components of this type'),
        path_prefix: z.string().optional().describe('Only components whose path starts with this prefix, e.g. "Pages/"')
      }
    },
    guarded((args: { type?: string; path_prefix?: string }) => {
      const all = store.listComponents();
      let rows = all;
      if (args.type) rows = rows.filter((r) => r.type === args.type);
      if (args.path_prefix) rows = rows.filter((r) => r.path.startsWith(args.path_prefix!));
      // LEG-006 — the ceiling is applied on the way out, not in the store: this
      // is the only caller of `listComponents()` whose output crosses the wire.
      rows = rows.map((row) =>
        row.description ? { ...row, description: truncateRowDescription(row.description) } : row
      );
      const result: ListComponentsResponse = { components: rows };
      if (rows.length === 0 && all.length > 0 && args.type) {
        // Legacy-exported projects often type everything "visual" and mark
        // pages only by naming convention — say so instead of a bare [].
        const counts: Record<string, number> = {};
        for (const r of all) counts[r.type] = (counts[r.type] ?? 0) + 1;
        result.note =
          `No components of type "${args.type}" — this project's ${all.length} components are typed: ` +
          Object.entries(counts)
            .map(([t, n]) => `${t} (${n})`)
            .join(', ') +
          '. Pages may be identifiable by naming convention instead (try path_prefix or search).';
      }
      return jsonResult(result);
    })
  );

  server.registerTool(
    'get_component',
    {
      title: 'Get component',
      description:
        'Read one component\'s full graph: metadata, ports, nodes, connections, visualRoots — plus a `revision` ' +
        'token to pass as `if_revision` when updating. Set `include_usages` to also list the components that ' +
        'instantiate this one.',
      inputSchema: {
        path: z.string().describe('Component path ("Pages/Home") or legacy name ("/Pages/Home")'),
        include_usages: z.boolean().optional().describe('Also return where this component is instantiated')
      }
    },
    guarded((args: { path: string; include_usages?: boolean }) => {
      const stored = store.readComponent(args.path);
      const c = stored.files.component;
      // AWP-001 §3 — an agent inspecting a project written before the derivation
      // landed must see what will actually render, not the absent field. Reading
      // the raw value here is how F43 stayed invisible: the file said nothing and
      // so did we.
      const visualRoots = readVisualRoots(stored.files.nodes, projectVisualPredicate(store));
      const derived = stored.files.nodes.visualRoots === undefined;
      const payload: GetComponentResponse = {
        path: stored.key,
        legacyName: stored.legacyName,
        type: c.type,
        description: c.description,
        displayName: c.displayName,
        ports: c.ports,
        revision: stored.revision,
        nodes: stored.files.nodes.nodes,
        visualRoots,
        ...(derived && visualRoots.length > 0 ? { visualRootsDerived: true } : {}),
        comments: stored.files.nodes.comments,
        connections: stored.files.connections.connections,
        ...(args.include_usages ? { usages: store.findUsages(stored.key) } : {})
      };
      return jsonResult(payload);
    })
  );

  server.registerTool(
    'search_project',
    {
      title: 'Search project',
      description:
        'Find node instances across all components without reading whole graphs. Search by `node_type` ' +
        '(catalog typeName, or a component path to find its instantiations) and/or free `text` ' +
        '(matched against node labels and string parameter values). Returns locations, capped at ' +
        SEARCH_RESULT_CAP +
        ' matches.',
      inputSchema: {
        node_type: z.string().optional().describe('Exact node type, e.g. "net.noodl.controls.button", or component path'),
        text: z.string().optional().describe('Case-insensitive substring over labels and string parameters'),
        path_prefix: z.string().optional().describe('Restrict the search to components under this path prefix')
      }
    },
    guarded((args: { node_type?: string; text?: string; path_prefix?: string }) => {
      if (!args.node_type && !args.text) {
        throw new ToolError('invalid-argument', 'Provide node_type and/or text.');
      }
      const text = args.text?.toLowerCase();
      const wantedType = args.node_type;
      const matches: SearchMatch[] = [];
      let truncated = false;

      for (const row of store.listComponents()) {
        if (args.path_prefix && !row.path.startsWith(args.path_prefix)) continue;
        const stored = store.readComponent(row.path);
        for (const node of stored.files.nodes.nodes) {
          if (matches.length >= SEARCH_RESULT_CAP) {
            truncated = true;
            break;
          }
          let matchedOn: string | undefined;
          if (wantedType) {
            const typeHit =
              node.type === wantedType ||
              (isComponentRef(node.type) && refToPath(node.type) === refToPath(wantedType));
            if (!typeHit) continue;
            matchedOn = 'type';
          }
          if (text) {
            let textHit: string | undefined;
            if (node.label?.toLowerCase().includes(text)) textHit = 'label';
            else if (node.parameters) {
              for (const [k, v] of Object.entries(node.parameters)) {
                if (typeof v === 'string' && v.toLowerCase().includes(text)) {
                  textHit = `parameter:${k}`;
                  break;
                }
              }
            }
            if (!textHit) continue;
            matchedOn = matchedOn ? `${matchedOn}+${textHit}` : textHit;
          }
          matches.push({
            component: row.path,
            nodeId: node.id,
            nodeType: node.type,
            ...(node.label ? { label: node.label } : {}),
            matchedOn
          });
        }
        if (truncated) break;
      }
      const payload: SearchProjectResponse = { matches, ...(truncated ? { truncated: true } : {}) };
      return jsonResult(payload);
    })
  );

  server.registerTool(
    'explain_component',
    {
      title: 'Explain component',
      description:
        'A structured, summarisation-ready description of a component: visual tree with display names and key ' +
        'parameters, logic nodes, data flow in readable endpoint notation, and which project components it uses. ' +
        'Prefer this over get_component when you need to understand rather than edit.',
      inputSchema: {
        path: z.string().describe('Component path or legacy name')
      }
    },
    guarded((args: { path: string }) => {
      const stored = store.readComponent(args.path);
      const payload: ExplainComponentResponse = describeComponent(stored.key, stored.files);
      return jsonResult(payload);
    })
  );
}
