/**
 * `render_report` — the feedback loop as a tool (LAS-005, audit F5).
 *
 * Read-only and registered unconditionally, like the other read tools: looking
 * at a project changes nothing about it, and a read-only server is exactly where
 * "is this page actually right?" gets asked.
 *
 * It returns two things, and the second is the point. The JSON report is what a
 * text-only agent can act on — 29 elements rendering the word "Text", five of
 * five images failed, a four-item grid stacked in one column at 1280px. The
 * screenshots are what a multimodal one can *look* at, which is the only fix a
 * wrong-subject image will ever have: the audit's strong model curl-verified
 * sixteen image URLs and still shipped a photograph of a motorcycle for a bud
 * vase, because HTTP 200 is not looking.
 *
 * @module noodl-mcp/tools/renderTools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { ProjectStore } from '../project/ProjectStore';
import { runRenderReport } from '../render';
import { guarded, type ToolResult } from './util';

/**
 * A screenshot scale above this stops being a picture an agent can hold and
 * starts being a transport problem — a full page at 1280px wide and 4000px tall
 * is ~500KB of PNG at 0.5.
 */
const MAX_SCALE = 1;
const MIN_SCALE = 0.1;

export function registerRenderTools(server: McpServer, store: ProjectStore): void {
  server.registerTool(
    'render_report',
    {
      title: 'Render report',
      description:
        'Render this project headless, measure the result and return the numbers AND the screenshots. ' +
        'Use it after applying a plan and before saying the work is done — a graph is a claim, a render is ' +
        'evidence. Reports per viewport: the width the page refuses to collapse below, horizontal overflow, ' +
        'the font-weight and font-size sets, broken images, empty decorated boxes, repeated groups that came ' +
        'out one column wide, and texts still rendering a node-type default like "Text" (the signature of a ' +
        'component instantiated with parameters it has no Component Inputs for). ' +
        'Takes about 8 seconds. Needs the built viewer bundle and a Chrome/Chromium binary; if either is ' +
        'missing the error says which and how to get it. ' +
        'LOOK AT THE SCREENSHOTS: a picture that loads is not a picture of the right thing, and no number can ' +
        'tell you it is the wrong one.',
      inputSchema: {
        viewports: z
          .string()
          .optional()
          .describe('Comma-separated: "desktop,phone" (the default) or explicit sizes like "1440x900,390x844"'),
        screenshot: z
          .enum(['full', 'viewport', 'none'])
          .optional()
          .describe('full (default) captures the whole page — the fold is where defects hide; none skips images'),
        scale: z
          .number()
          .optional()
          .describe('Screenshot scale, 0.1–1 (default 0.4). Raise it to read small text in the image.'),
        backend_port: z
          .number()
          .optional()
          .describe('Port of this project’s running backend, so data-driven sections render their rows')
      }
    },
    guarded(
      async (args: {
        viewports?: string;
        screenshot?: 'full' | 'viewport' | 'none';
        scale?: number;
        backend_port?: number;
      }): Promise<ToolResult> => {
        const scale = args.scale === undefined ? undefined : Math.min(MAX_SCALE, Math.max(MIN_SCALE, args.scale));
        const { report, screenshots } = await runRenderReport(store.projectDir, {
          viewports: args.viewports,
          screenshot: args.screenshot,
          scale,
          backendPort: args.backend_port
        });

        return {
          content: [
            { type: 'text', text: JSON.stringify(report, null, 2) },
            // Each image is announced before it arrives, because an agent
            // reading a bare image has no way to know which viewport it is.
            ...screenshots.flatMap((shot) => [
              { type: 'text' as const, text: `Screenshot — ${shot.name} (${report.viewports[shot.name]?.requested.width}px wide, full page)` },
              { type: 'image' as const, data: shot.base64, mimeType: shot.mimeType }
            ])
          ]
        };
      }
    )
  );
}
