/**
 * Catalog tools: list_node_types, get_node_type, list_examples, get_example.
 * These serve slices of the enriched node catalog (SUB-004/005) — never the
 * whole 1.45 MB artifact.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getExample, getNodeTypeDetail, listCategories, listExamples, listNodeTypes } from '../catalog';
import { ToolError } from '../errors';
import type { GetNodeTypeResponse, ListExamplesResponse, ListNodeTypesResponse } from './responses';
import { guarded, jsonResult } from './util';

const MAX_TYPES_PER_CALL = 8;

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
      const payload: ListNodeTypesResponse = { nodeTypes: rows, categories: listCategories() };
      return jsonResult(payload);
    })
  );

  server.registerTool(
    'get_node_type',
    {
      title: 'Get node type detail',
      description:
        'Full enriched entries for up to ' +
        MAX_TYPES_PER_CALL +
        ' named node types: every input/output port with type, signal flag and authored semantics, when to use ' +
        'the node, runtime behavior, related nodes, and ids of validated examples (fetch via get_example). ' +
        'Unknown names return a nearest-match suggestion.',
      inputSchema: {
        type_names: z
          .array(z.string())
          .min(1)
          .max(MAX_TYPES_PER_CALL)
          .describe('Exact catalog typeNames, e.g. ["Group", "net.noodl.controls.button"]')
      }
    },
    guarded((args: { type_names: string[] }) => {
      const payload: GetNodeTypeResponse = { types: args.type_names.map(getNodeTypeDetail) };
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
