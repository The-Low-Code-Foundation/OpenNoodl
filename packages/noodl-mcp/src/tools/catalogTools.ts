/**
 * Catalog tools: list_node_types, get_node_type, list_examples, get_example.
 * These serve slices of the enriched node catalog (SUB-004/005) — never the
 * whole 1.45 MB artifact.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getExample, getNodeTypeDetail, getNodeTypePorts, getNodeTypeSummary, listCategories, listExamples, listNodeTypes } from '../catalog';
import { alphaNotice, exportCoverage } from '@nodegx/export';
import { ToolError } from '../errors';
import type { GetNodeTypeResponse, ListExamplesResponse, ListNodeTypesResponse } from './responses';
import { guarded, jsonResult } from './util';

const MAX_TYPES_PER_CALL = 8;

/**
 * DEBT-009 — the size at which `detail: "full"` starts degrading its tail to
 * summaries, because seven enriched types once produced a ~126 KB response that
 * blew the MCP host's tool-result cap.
 *
 * 🔴 Exported because it is also the only honest ceiling for the SUMMARY path,
 * which has no degradation step of its own. `tools.test.ts` asserts a worst-case
 * summary call stays under it — meaning "summary mode is safe *without* the
 * mechanism full mode needs", which is the property that actually matters.
 * It used to assert a round `30_000`, and by CMP-006 AC3 the worst case had
 * reached 29,710 B: a ceiling with 290 bytes of headroom that the next
 * enrichment would have tripped whoever happened to touch the catalog next.
 */
export const FULL_DETAIL_BYTE_BUDGET = 60_000;

export function registerCatalogTools(server: McpServer): void {
  server.registerTool(
    'list_node_types',
    {
      title: 'List node types',
      description:
        'Compact rows of the node catalog (typeName, displayName, category, one-line summary). ' +
        'Filter by `category`, free-text `query`, or `visual_only`. Use get_node_type for full port-level detail. ' +
        'Node `type` values in graphs must match `typeName` exactly.',
      inputSchema: {
        category: z.string().optional().describe('One of the catalog categories (returned in `categories`)'),
        query: z.string().optional().describe('Free-text filter over names, tags and summaries, e.g. "drag"'),
        visual_only: z.boolean().optional().describe('Only visual (renderable) nodes'),
        include_hidden: z.boolean().optional().describe('Include deprecated and picker-hidden types')
      }
    },
    guarded((args: { category?: string; query?: string; visual_only?: boolean; include_hidden?: boolean }) => {
      const rows = listNodeTypes({
        category: args.category,
        query: args.query,
        visualOnly: args.visual_only,
        includeHidden: args.include_hidden
      });
      // FLD-013 — the coverage line rides the listing rather than costing a second call, and it is
      // the ledger's own numbers (`export-ledger:picker --check` holds them), not a second count.
      const coverage = exportCoverage();
      const payload: ListNodeTypesResponse = {
        nodeTypes: rows,
        categories: listCategories(),
        exportCoverage: {
          ...coverage,
          notice: alphaNotice(),
          note:
            'A row with no `export` field is a type this exporter translates and that refuses on no port. ' +
            'Where `export` is present: `status` classifies the TYPE, and `structurePorts`/`contentPorts` list ports ' +
            'whose value arriving over a WIRE leaves a node of that type out of the export — a translated type can ' +
            'still refuse. Set those ports as literal parameters, or accept the node will not be in the exported code.'
        }
      };
      return jsonResult(payload);
    })
  );

  server.registerTool(
    'get_node_type',
    {
      title: 'Get node type detail',
      description:
        'Up to ' +
        MAX_TYPES_PER_CALL +
        ' named node types. By default: every port as one line with its type and allowed values, the ' +
        'antiPatterns to avoid, and the examples demonstrating it (fetch one with get_example — the title ' +
        'says which is worth the call). That is enough to author from. Pass `ports` for the authored ' +
        'semantics of just the ports you are setting; pass detail: "full" for the whole type — every ' +
        'port\'s prose, whenToUse, runtimeBehavior, relatedNodes, patterns. ' +
        'Full is large (Group is ~11k tokens for 111 ports) and is re-sent on every ' +
        'later turn, so spend it on choosing between types, not on setting a value. ' +
        'Unknown names return a nearest-match suggestion; an oversized full response degrades its tail to ' +
        'summaries in-band (see `summarized`).',
      inputSchema: {
        type_names: z
          .array(z.string())
          .min(1)
          .max(MAX_TYPES_PER_CALL)
          .describe('Exact catalog typeNames, e.g. ["Group", "net.noodl.controls.button"]'),
        detail: z
          .enum(['summary', 'full'])
          .optional()
          .describe('summary (default) = one line per port, as above; full = everything'),
        ports: z
          .array(z.string())
          .optional()
          .describe('Full detail for these ports only, e.g. ["width", "flexDirection"]. Cheaper than detail:"full"')
      }
    },
    guarded((args: { type_names: string[]; detail?: 'summary' | 'full'; ports?: string[] }) => {
      // AWP-005 §2 — per-port detail wins over `detail`, because it is the more
      // specific request and the two together can only mean "these ports".
      if (args.ports && args.ports.length > 0) {
        const payload: GetNodeTypeResponse = {
          types: args.type_names.map((n) => getNodeTypePorts(n, args.ports!))
        };
        return jsonResult(payload);
      }

      // AWP-005 §2 — `summary` is the default. It was measured sufficient for
      // 113 of the 117 (type, port) pairs the four phase-55 replays actually set,
      // and three of the four misses are absent from full detail as well; the
      // fourth is why `runtimeBehavior` now travels with the summary. The
      // argument for the flip is not the saving alone but that doc volume was
      // *anti*-correlated with building in those runs: DeepSeek read 4 types and
      // shipped a 12-component storefront, Kimi read 21 and had authored nothing
      // by turn 34.
      if (args.detail !== 'full') {
        const payload: GetNodeTypeResponse = { types: args.type_names.map(getNodeTypeSummary) };
        return jsonResult(payload);
      }

      // Full detail, with a byte budget (DEBT-009): seven enriched types once
      // produced a ~126 KB response that blew the MCP host's tool-result cap,
      // and the host's "saved to file" overflow hint is useless to a
      // filesystem-less agent. Degrade the tail to summaries in-band instead —
      // the agent re-requests those types individually.
      const BYTE_BUDGET = FULL_DETAIL_BYTE_BUDGET;
      let spent = 0;
      const types: GetNodeTypeResponse['types'] = [];
      const summarized: string[] = [];
      for (const name of args.type_names) {
        const full = getNodeTypeDetail(name);
        const size = JSON.stringify(full).length;
        if (spent + size > BYTE_BUDGET && types.length > 0) {
          summarized.push(name);
          types.push(getNodeTypeSummary(name));
        } else {
          spent += size;
          types.push(full);
        }
      }
      const payload: GetNodeTypeResponse = { types };
      if (summarized.length > 0) {
        payload.summarized = summarized;
        payload.hint = 'Response would exceed the tool-result size cap; the listed types were returned as summaries. Request them individually for full detail.';
      }
      return jsonResult(payload);
    })
  );

  server.registerTool(
    'list_examples',
    {
      title: 'List graph examples',
      description:
        'Browse the library of validated example graph fragments (each proven error-free by the semantic ' +
        'validator). Filter by `node_type` or free-text `query`. Fetch a full fragment with get_example.',
      inputSchema: {
        node_type: z.string().optional().describe('Only examples demonstrating this typeName'),
        query: z.string().optional().describe('Free-text filter over titles and descriptions')
      }
    },
    guarded((args: { node_type?: string; query?: string }) => {
      const payload: ListExamplesResponse = { examples: listExamples({ nodeType: args.node_type, query: args.query }) };
      return jsonResult(payload);
    })
  );

  server.registerTool(
    'get_example',
    {
      title: 'Get graph example',
      description:
        'One validated example as v2-shaped component fragments (nodes + connections) — known-good wiring to ' +
        'imitate when authoring.',
      inputSchema: {
        id: z.string().describe('Example id from list_examples or get_node_type')
      }
    },
    guarded((args: { id: string }) => {
      const example = getExample(args.id);
      if (!example) {
        throw new ToolError('not-found', `No example "${args.id}".`, {
          availableIds: listExamples().map((e) => e.id)
        });
      }
      return jsonResult(example);
    })
  );
}
