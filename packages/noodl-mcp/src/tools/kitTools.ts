/**
 * CN-006 — `create_node_kit`, the MCP half of the scaffold.
 *
 * ✅ **D1** treats "Claude Code can make a kit" as a first-class use rather than
 * an afterthought, so this is a peer of the editor's "New node kit" command and
 * not a thin wrapper on it. Both call the one generator in
 * `@nodegx/kit-scaffold`, so the two entry points cannot drift into teaching
 * different things — which for a scaffold is the whole risk, since what it
 * teaches is its entire product.
 *
 * ## Where it sits in the tool surface, measured
 *
 * ⚠️ AWP-006's budget is 8,280 tokens against a measured 8,223, and CN-009 is
 * competing for the same 57. Three placements were measured rather than
 * argued (2026-08-16, same fixture and normalisation as `toolDisclosure.test.ts`):
 *
 * | placement | surface | cost |
 * |---|---|---|
 * | baseline, no tool | 8,223 | — |
 * | in the existing deferred `project` group | 8,223 | **0** |
 * | in a new deferred `kit` group | 8,249 | 26 |
 * | resident | 8,464 | 241 — **184 over the 8,280 bar on its own** |
 *
 * **It goes in `project`, and costs nothing.** The only resident trace of a
 * deferred group is `find_tools`' `"<id>" (N tools) — <purpose>`, and "3 tools"
 * and "4 tools" are the same length — the property UNI-010's `derive_starter`
 * measured and wrote down. A new `kit` group would have been tidier and cost 26
 * of the 57 tokens CN-009 needs; tidiness is not worth 46% of the remaining
 * headroom, and there is a written *"there should not be a third"* renegotiation
 * standing.
 *
 * 🔴 **The thing that placement costs, and it is not nothing.** `project`'s
 * `purpose` line does not mention kits, and that line is the only description a
 * model reads before deciding which group to open. Nothing here is hidden —
 * `find_tools`' `query` matches **tool names**, so `query: "kit"` and
 * `query: "node_kit"` both reveal this tool from any group — but a model
 * browsing purposes will not find it. That is a real cost, recorded here rather
 * than argued away, and it is the reason `tests/kitTools.test.ts` asserts the
 * query door rather than assuming it.
 *
 * @module noodl-mcp/tools/kitTools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { ToolError } from '../errors';
import { refreshProjectOverlay } from '../kitOverlay';
import type { ProjectBinding } from '../project/ProjectBinding';
import { guarded, jsonResult } from './util';

// Required rather than imported: the scaffold is a no-build CommonJS package,
// the same shape as `@nodegx/kit-catalog` and for the same reason.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { writeKitScaffold } = require('@nodegx/kit-scaffold');
import type { ScaffoldWritten, ScaffoldFailure } from '@nodegx/kit-scaffold';

export interface CreateNodeKitResponse {
  kit: string;
  displayName: string;
  /** Project-relative POSIX paths, in write order. */
  written: string[];
  /** The node type the example node registers. */
  nodeType: string;
  nodeDisplayName: string;
  typesVersion: string;
  next: string;
}

export function registerKitTools(server: McpServer, binding: ProjectBinding): void {
  server.registerTool(
    'create_node_kit',
    {
      title: 'Create a node kit',
      description:
        'Scaffold a custom node kit into this project: manifest.json, an annotated index.js with one working ' +
        'example node, a README, and a local copy of the definition types for autocomplete. Plain JavaScript — ' +
        'no build step, no bundler, no npm install. The example node is written to the rule kits are meant to ' +
        'follow: every visual decision (colour, spacing, radius, size) is a PORT defaulting to a var(--token), ' +
        'and thresholds live in the graph rather than in the JavaScript. Edit index.js to add your own nodes; ' +
        'they appear in the picker after the preview reloads. Refuses rather than overwrites if the kit exists.',
      inputSchema: {
        name: z
          .string()
          .describe('The kit name, e.g. "Weather Kit". Becomes one lowercase-dashed folder under noodl_modules/.')
      }
    },
    guarded(async (args: { name: string }) => {
      const store = binding.require();

      const result: ScaffoldWritten | ScaffoldFailure = await writeKitScaffold(store.projectDir, { name: args.name });

      if (!result.ok) {
        // Every refusal from the generator is the caller's to fix — a bad name,
        // a name that is really a path, or a kit that already exists — so they
        // arrive as `invalid-argument` with the generator's own message, which
        // is written to be acted on rather than merely reported.
        throw new ToolError('invalid-argument', result.message);
      }

      // 🔴 The kit set of the bound project just changed, and the catalog this
      // server serves was computed at bind time. Without this the agent's next
      // `get_node_type` answers "Unknown node type" for the node it was just
      // told about — see `refreshProjectOverlay`. Also the first real exercise
      // of the extractor against the scaffold, so a kit that throws at load is
      // reported here rather than discovered by a user.
      const overlay = refreshProjectOverlay(store.projectDir);
      const failed = (overlay.failures || []).find((f) => f.dirPath.endsWith(result.kit.dirName));
      if (failed) {
        throw new ToolError(
          'io-error',
          `The kit was written to noodl_modules/${result.kit.dirName} but failed to load: ${failed.message}`
        );
      }

      const payload: CreateNodeKitResponse = {
        kit: result.kit.dirName,
        displayName: result.kit.displayName,
        written: result.written,
        nodeType: result.kit.nodeType,
        nodeDisplayName: result.kit.nodeDisplayName,
        typesVersion: result.kit.typesVersion,
        // The one thing the caller cannot work out and will otherwise get
        // wrong: files on disk are not yet a node in the picker.
        next:
          `Reload the preview and "${result.kit.nodeDisplayName}" (${result.kit.nodeType}) is placeable like any ` +
          `built-in node. Read noodl_modules/${result.kit.dirName}/README.md before adding a second node — it ` +
          'argues the one rule that makes a kit worth having.'
      };
      return jsonResult(payload);
    })
  );
}
