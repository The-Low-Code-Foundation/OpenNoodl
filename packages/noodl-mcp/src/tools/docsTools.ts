/**
 * AIX-009 — Project context documents for external agents.
 *
 * `docs/` is the project's own written context: what the app is for
 * (BRIEF.md), why it is shaped the way it is (ARCHITECTURE.md), and the rules
 * an assistant must follow in it (CONVENTIONS.md). The in-editor authoring loop
 * injects the first and third on every turn; an agent driving this server
 * through MCP gets the same material here, so Claude Code and the editor are
 * equally well briefed rather than one being a second-class citizen.
 *
 * Containment is not re-implemented: `assertInsideDocs` is the *same function*
 * the editor uses, imported through `editor-deps`. A doc path that the panel
 * refuses and this tool accepts would be a security bug spelled two ways.
 *
 * Writes are whole-file replacement, matching the whole-candidate contract used
 * everywhere else in this phase, and are gated on `--allow-writes` like every
 * other mutation.
 *
 * @module tools/docsTools
 */

import * as fs from 'fs';
import * as path from 'path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { assertInsideDocs, DocPathError, DOCS_DIR, DOC_TEMPLATES, KNOWN_DOCS } from '../editor-deps';
import { ToolError } from '../errors';
import type { ProjectStore } from '../project/ProjectStore';
import { guarded, jsonResult } from './util';

/** Largest doc this server will read or write in one call (~250KB). */
const MAX_DOC_BYTES = 256_000;

export interface DocRow {
  path: string;
  bytes: number;
  modified: string;
  /** Set for the three files the authoring loop knows about. */
  kind?: string;
  /** How the in-editor loop treats it: injected every turn, or on request. */
  injection?: 'default' | 'pull';
}

export interface ListProjectDocsResponse {
  hasDocs: boolean;
  docs: DocRow[];
  missing: Array<{ path: string; kind: string; purpose: string }>;
  note: string;
}

/** Resolve a doc path against the project, refusing anything outside docs/. */
function resolveDoc(store: ProjectStore, input: string): { rel: string; abs: string } {
  let rel: string;
  try {
    rel = assertInsideDocs(input);
  } catch (error) {
    if (error instanceof DocPathError) throw new ToolError('invalid-argument', error.message);
    throw error;
  }
  const abs = path.resolve(store.projectDir, rel);
  // Belt and braces: the string check above is the contract, but a symlinked
  // docs/ or an exotic separator should not be able to turn it into a write
  // outside the project either.
  const root = path.resolve(store.projectDir) + path.sep;
  if (!abs.startsWith(root)) {
    throw new ToolError('invalid-argument', `"${input}" resolves outside the project directory.`);
  }
  return { rel, abs };
}

/** Every markdown file under docs/, project-relative and forward-slashed. */
function walkDocs(docsDir: string, projectDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.toLowerCase().endsWith('.md')) {
        out.push(path.relative(projectDir, full).split(path.sep).join('/'));
      }
    }
  };
  if (fs.existsSync(docsDir)) walk(docsDir);
  return out.sort();
}

/** Always-registered read tools. */
export function registerDocsReadTools(server: McpServer, store: ProjectStore): void {
  server.registerTool(
    'list_project_docs',
    {
      title: 'List project docs',
      description:
        "The project's own written context, under docs/. Three files are known to the system: CONVENTIONS.md " +
        '(the rules an assistant must follow here — read it before authoring anything), BRIEF.md (what the app ' +
        'is for) and ARCHITECTURE.md (page map, data model, backend contracts, and the reasons behind them). ' +
        'Any other markdown under docs/ is listed too. Missing known files are reported as missing.',
      inputSchema: {}
    },
    guarded(() => {
      const docsDir = path.join(store.projectDir, DOCS_DIR);
      const known = new Map(KNOWN_DOCS.map((d) => [d.path, d]));
      const found = walkDocs(docsDir, store.projectDir);

      const docs: DocRow[] = found.map((rel) => {
        const stat = fs.statSync(path.join(store.projectDir, rel));
        const meta = known.get(rel);
        return {
          path: rel,
          bytes: stat.size,
          modified: stat.mtime.toISOString(),
          ...(meta ? { kind: meta.kind, injection: meta.injection } : {})
        };
      });

      const missing = KNOWN_DOCS.filter((d) => !found.includes(d.path)).map((d) => ({
        path: d.path,
        kind: d.kind,
        purpose: d.purpose
      }));

      const payload: ListProjectDocsResponse = {
        // The same single predicate the editor uses for "this project has docs".
        hasDocs: found.includes('docs/CONVENTIONS.md'),
        docs,
        missing,
        note:
          'Docs hold intent, decisions, rejected alternatives, external contracts and the rules for next time. ' +
          'They deliberately do NOT describe the graph — the graph is the spec, and describing it here creates a ' +
          'second source of truth that goes stale on the next edit.'
      };
      return jsonResult(payload);
    })
  );

  server.registerTool(
    'get_project_doc',
    {
      title: 'Get a project doc',
      description:
        'Read one document under docs/ (e.g. "docs/CONVENTIONS.md" or "CONVENTIONS.md"). Paths outside docs/ ' +
        'are rejected. Read CONVENTIONS.md before authoring: its rules outrank your defaults, and a rule you ' +
        'cannot satisfy must be reported rather than silently skipped.',
      inputSchema: {
        path: z.string().describe('Doc path, relative to the project or to docs/ — e.g. "docs/BRIEF.md"')
      }
    },
    guarded((args: { path: string }) => {
      const { rel, abs } = resolveDoc(store, args.path);
      if (!fs.existsSync(abs)) {
        throw new ToolError('not-found', `No ${rel} in this project.`, {
          available: walkDocs(path.join(store.projectDir, DOCS_DIR), store.projectDir)
        });
      }
      const stat = fs.statSync(abs);
      if (stat.size > MAX_DOC_BYTES) {
        throw new ToolError(
          'invalid-argument',
          `${rel} is ${stat.size} bytes, larger than this tool will return (${MAX_DOC_BYTES}). Split it up.`
        );
      }
      return jsonResult({
        path: rel,
        bytes: stat.size,
        modified: stat.mtime.toISOString(),
        content: fs.readFileSync(abs, 'utf8')
      });
    })
  );
}

/** Write tools — only when --allow-writes. */
export function registerDocsWriteTools(server: McpServer, store: ProjectStore): void {
  server.registerTool(
    'write_project_doc',
    {
      title: 'Write a project doc',
      description:
        'Replace one document under docs/ with the content given — WHOLE FILE, not a patch, matching the ' +
        'whole-candidate contract used everywhere else here. Creates the file and any parent folder under ' +
        'docs/. Paths outside docs/ are rejected. Do not use this to describe the graph: docs hold intent, ' +
        'decisions, rejected alternatives and external contracts. Call seed_project_docs to create the three ' +
        'starter files from templates.',
      inputSchema: {
        path: z.string().describe('Doc path under docs/, e.g. "docs/CONVENTIONS.md"'),
        content: z.string().describe('The complete new file content')
      }
    },
    guarded((args: { path: string; content: string }) => {
      const { rel, abs } = resolveDoc(store, args.path);
      if (Buffer.byteLength(args.content, 'utf8') > MAX_DOC_BYTES) {
        throw new ToolError('invalid-argument', `Content exceeds ${MAX_DOC_BYTES} bytes.`);
      }
      const existed = fs.existsSync(abs);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      writeTextAtomic(abs, args.content);
      return jsonResult({
        ok: true,
        path: rel,
        created: !existed,
        bytes: Buffer.byteLength(args.content, 'utf8')
      });
    })
  );

  server.registerTool(
    'seed_project_docs',
    {
      title: 'Seed the project docs folder',
      description:
        'Create docs/ with BRIEF.md, ARCHITECTURE.md and CONVENTIONS.md from templates. Never overwrites an ' +
        'existing file — safe to call twice. Returns which files were created.',
      inputSchema: {}
    },
    guarded(() => {
      const created: string[] = [];
      for (const doc of KNOWN_DOCS) {
        const abs = path.join(store.projectDir, ...doc.path.split('/'));
        if (fs.existsSync(abs)) continue;
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        writeTextAtomic(abs, DOC_TEMPLATES[doc.kind]);
        created.push(doc.path);
      }
      return jsonResult({ ok: true, created });
    })
  );
}

/** Temp file + rename, the same discipline as ProjectStore's JSON writes. */
function writeTextAtomic(file: string, content: string): void {
  const tmp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}
