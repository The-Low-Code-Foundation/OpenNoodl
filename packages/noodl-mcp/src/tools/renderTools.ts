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

import * as path from 'path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { ProjectBinding } from '../project/ProjectBinding';
import type { ProjectStore } from '../project/ProjectStore';
import { runRenderReport, type RenderReportPayload } from '../render';
import type { RenderLedger } from '../renderVerdict';
import { guarded, type ToolResult } from './util';

/**
 * A screenshot scale above this stops being a picture an agent can hold and
 * starts being a transport problem — a full page at 1280px wide and 4000px tall
 * is ~500KB of PNG at 0.5.
 */
const MAX_SCALE = 1;
const MIN_SCALE = 0.1;

export function registerRenderTools(server: McpServer, binding: ProjectBinding, ledger: RenderLedger): void {
  server.registerTool(
    'render_report',
    {
      title: 'Render report',
      description:
        'Render this project headless, measure the result and return the numbers AND the screenshots. ' +
        'Use it after applying a plan and before saying the work is done — a graph is a claim, a render is ' +
        // AWP-006 §1's third lever: the per-viewport enumeration and the
        // prerequisite prose were ~450 characters resent every turn to say what
        // the response and the error message already say at the moment they
        // matter. The two sentences that change behaviour — call it, and look at
        // the pictures — are kept in full.
        // FLD-011 — two edits, both forced by measurement rather than taste.
        //
        // "Takes ~8s" was calibrated against the fixed settle timers and this task removed them:
        // a one-page project now measures at ~2.1s and an eleven-page one at ~10.3s. A cost
        // sentence that is wrong by 4x is worse than none, because it is what an agent budgets by.
        //
        // And the enumeration is shortened to its categories, which is AWP-006's own principle
        // applied to the clause it left standing: the response names every rule it ran, in full, at
        // the moment that matters. 🔴 It is shortened rather than dropped because `out_dir` below
        // had to be paid for — the resident surface had **7 tokens of headroom** at HEAD against
        // toolDisclosure's 8280 budget, and a new parameter costs more than that. See the register.
        'evidence. Measures layout, text, images and empty boxes per viewport; ~2s a page. ' +
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
          .describe('Port of this project’s running backend, so data-driven sections render their rows'),
        page: z
          .string()
          .optional()
          .describe('Measure only this page, by urlPath ("quiz"). Default: every page the router registers'),
        out_dir: z
          .string()
          .optional()
          // Deliberately terse, and the doctrine is NOT repeated here: this string is resent on
          // every turn, while the response's manifest says "READ the ones you need" only to the
          // caller who actually asked for files. Paying for the instruction in the schema would
          // charge every conversation for a feature most of them never use.
          .describe('Write screenshots here and return their paths instead of the images.')
      }
    },
    guarded(
      async (args: {
        viewports?: string;
        screenshot?: 'full' | 'viewport' | 'none';
        scale?: number;
        backend_port?: number;
        page?: string;
        out_dir?: string;
      }): Promise<ToolResult> => {
        const scale = args.scale === undefined ? undefined : Math.min(MAX_SCALE, Math.max(MIN_SCALE, args.scale));
        const projectDir = binding.require().projectDir;
        // Resolved here, once, against this server's cwd — and the SAME resolved string is both
        // what the CLI is handed and what the caller is told, so the path in the response is the
        // path on disk rather than a relative fragment the caller would have to guess the base of.
        const outDir = args.out_dir === undefined ? undefined : path.resolve(args.out_dir);
        const { report, screenshots } = await runRenderReport(projectDir, {
          viewports: args.viewports,
          screenshot: args.screenshot,
          scale,
          backendPort: args.backend_port,
          page: args.page,
          outDir
        });

        // VIB-007 M1 — the look is recorded, so that afterwards something in
        // this server can answer "is it done?". ⚠️ **Only a whole-project render
        // certifies**: a `page`-scoped run is a reading about one page, and
        // `render-report.js` already says so in its own summary rather than
        // letting it out-claim its coverage. Recording it as the project's
        // verdict would launder that reading into the app.
        const verdict = args.page === undefined ? ledger.record(projectDir, report) : undefined;

        return {
          content: [
            // 🔴 Before the JSON, not inside it. The verdict is the sentence the
            // caller must not be able to skim past — a report whose top-level
            // shape reads as success is how "Rendered clean" survived over a
            // page nobody could reach.
            ...(verdict ? [{ type: 'text' as const, text: verdictHeadline(verdict) }] : []),
            { type: 'text', text: JSON.stringify(report, null, 2) },
            // FLD-011 AC1 — with `out_dir` the harness wrote files and returned no base64, so
            // `screenshots` is empty and the loop below produces nothing. The manifest replaces it,
            // because a caller told only "written to a folder" has to list a directory to find out
            // which file is which page, and the report's own rows already know.
            ...(outDir ? [{ type: 'text' as const, text: screenshotManifest(report, outDir) }] : []),
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

/**
 * The images that were written, as the one text block that replaces them.
 *
 * Read off the report's OWN rows (`pages[].viewports[].screenshot`, written by `measure-from-disk
 * --out-dir`) rather than by listing the directory: a directory listing would also report files a
 * previous run left there, and a manifest that names a stale image as this run's picture of page
 * four is worse than no manifest. A page whose row carries no path is listed as such, because a
 * missing image and an image nobody mentioned look identical to a caller counting pictures.
 */
function screenshotManifest(report: RenderReportPayload, outDir: string): string {
  const lines: string[] = [];
  let written = 0;
  for (const page of report.pages ?? []) {
    for (const [viewport, row] of Object.entries(page.viewports ?? {})) {
      if (row.screenshot) {
        written += 1;
        lines.push(`  ${page.component ?? '(unnamed page)'} — ${viewport}: ${row.screenshot}`);
      } else {
        lines.push(`  ${page.component ?? '(unnamed page)'} — ${viewport}: (no image)`);
      }
    }
  }
  if (!lines.length) return `No screenshots were written to ${outDir} — this run photographed nothing.`;
  return (
    `${written} screenshot${written === 1 ? '' : 's'} written to ${outDir}, one per measured page per viewport. ` +
    'They are NOT in this response — READ the ones you need. A path you never open is not a picture you ' +
    'looked at, and no number in the report above can tell you the page shows the wrong thing.\n' +
    lines.join('\n')
  );
}

/** The verdict as the one line a caller reads first. */
function verdictHeadline(verdict: { done: boolean; reason: string }): string {
  return verdict.done ? `DONE — ${verdict.reason}` : verdict.reason;
}
