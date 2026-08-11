/**
 * AIX-012 — `create_project`: the same on-ramp from Claude Code.
 *
 * The editor's version of this is a conversation the user has with a scoping
 * agent. Here the caller *is* the agent, so it hands over the scope it already
 * agreed with its user and this writes the three things that conversation is
 * for: a project, the documents, and a plan it does not run.
 *
 * That split is the same one AIX-011 made between `PlanRun` and `stage_plan_
 * operation` — editor and MCP share the *model*, not the executor. The scope
 * shape, the four rendered documents and `planFromScope` all come from the
 * editor's `scoping/scope` module by relative import (the `editor-deps`
 * pattern), so a project scoped in Claude Code and one scoped at the launcher
 * get byte-identical documents from identical input. Two front doors, one
 * format.
 *
 * ## Why this cannot go through `ProjectStore`
 *
 * `ProjectStore`'s constructor requires an existing v2 project directory, and
 * the server builds one before any tool is registered. Creation is therefore
 * genuinely new plumbing rather than a new tool over old plumbing: this module
 * writes the v2 skeleton itself, at a directory the caller names, which is
 * necessarily *not* the directory this server is pointed at.
 *
 * ## The blank-app trap
 *
 * `project-v2.schema.json` says it outright: without `rootNodeId` "the export
 * produces nothing and the app renders blank, so a tool authoring a project
 * from scratch must set it". This is the same failure new projects shipped with
 * once already, and the reason the editor's `EmbeddedTemplateProvider` resolves
 * a concrete root node id instead of trusting a name. So the skeleton written
 * here names its Router node as `rootNodeId`, and a spec asserts it.
 *
 * @module tools/createProject
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { AuthoringPlan } from '../../../noodl-editor/src/editor/src/models/AiAssistant/authoring/plan';
import { validatePlan } from '../../../noodl-editor/src/editor/src/models/AiAssistant/authoring/plan';
import type {
  ProjectScope,
  ScopeBackendInput,
  ScopeTranscriptEntry
} from '../../../noodl-editor/src/editor/src/models/AiAssistant/scoping/scope';
import {
  DOC_INITIAL_SCOPE,
  emptyScope,
  mergeScope,
  planFromScope,
  scopeDocuments
} from '../../../noodl-editor/src/editor/src/models/AiAssistant/scoping/scope';
import type {
  ComponentV2File,
  ConnectionsV2File,
  NodesV2File,
  ProjectV2File,
  RegistryV2File
} from '../editor-deps';
import type { AgentConfigReport } from '../editor-deps';
import { SCHEMA_IDS, SchemaValidator, formatValidationErrors } from '../editor-deps';
import { ToolError } from '../errors';
import { writeAgentConfig } from '../project/agentConfig';
import { guarded, jsonResult } from './util';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PKG_VERSION: string = require('../../package.json').version;

/** Legacy names the skeleton ships with. `planFromScope` needs these to know create from update. */
export const SKELETON_COMPONENTS: ReadonlySet<string> = new Set(['/App', '/Pages/Home']);

/**
 * LAS-012 §4 / F41 — the sentence that marks a page nobody has built yet.
 *
 * `create_project` mints `/Pages/Home`; `create_plan` then rejected a plan
 * containing an operation creating `Pages/Home` — *"that component already
 * exists — use an update"*. Haiku and qwen each burned a turn on it in session
 * 6 (sonnet did not). The `create_project` result **does** say a Home skeleton
 * was made, so this is knowledge given and dropped rather than withheld; but
 * "structure over gate" says the door absorbs it, and a create aimed at an
 * untouched skeleton is an update by any reading that matters.
 *
 * The marker lives next to the writer that emits it so a reworded placeholder
 * changes both in one edit, which is the only thing keeping
 * {@link isUntouchedSkeletonPage} from going quietly stale.
 */
export const SKELETON_PLACEHOLDER_MARKER =
  ' — nothing built yet. Review the plan in docs/ and start when you are ready.';

/** As much of a stored node as {@link isUntouchedSkeletonPage} reads. */
interface SkeletonNodeLike {
  type: string;
  parameters?: Record<string, unknown> | null;
}

/**
 * Whether a component is the `Page` + placeholder `Text` this file writes, with
 * nothing added.
 *
 * Deliberately exact rather than heuristic: two nodes, one `Page`, one `Text`
 * carrying the marker sentence. A page an author has touched — even to delete
 * the placeholder — is a page whose content a coerced update would silently
 * replace, and "the plan overwrote my work because it said create" is a much
 * worse turn than the one this saves.
 */
export function isUntouchedSkeletonPage(nodes: readonly SkeletonNodeLike[]): boolean {
  if (nodes.length !== 2) return false;
  const page = nodes.find((n) => n.type === 'Page');
  const text = nodes.find((n) => n.type === 'Text');
  if (!page || !text) return false;
  const value = text.parameters?.['text'];
  return typeof value === 'string' && value.endsWith(SKELETON_PLACEHOLDER_MARKER);
}

function newId(): string {
  return crypto.randomUUID();
}

function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function writeTextAtomic(file: string, content: string): void {
  const tmp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

export interface SkeletonResult {
  files: string[];
  rootNodeId: string;
}

/**
 * The smallest project that opens and renders: an `/App` root whose single
 * top-level node is a Router, and one `/Pages/Home` page it routes to.
 *
 * Deliberately not more than that. The scoping conversation's whole premise is
 * that the pages come from an agreed plan the user reviews, so scaffolding the
 * agreed pages here — before anyone has looked at the plan — would quietly
 * execute the thing this feature exists not to execute.
 */
export function writeProjectSkeleton(projectDir: string, name: string): SkeletonResult {
  const now = new Date().toISOString();
  const routerId = newId();
  const pageId = newId();
  const textId = newId();
  const appComponentId = newId();
  const homeComponentId = newId();
  const files: string[] = [];

  const put = (rel: string, data: unknown) => {
    const abs = path.join(projectDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    writeJsonAtomic(abs, data);
    files.push(rel);
  };

  const project: ProjectV2File & { rootNodeId?: string } = {
    $schema: SCHEMA_IDS.PROJECT,
    name,
    id: newId(),
    version: '4',
    nodegxVersion: PKG_VERSION,
    runtimeVersion: 'react19',
    created: now,
    modified: now,
    settings: { htmlTitle: name, navigationPathType: 'path' },
    structure: { componentsDir: 'components', assetsDir: 'assets' },
    // The Router node, not a component id. See the module header.
    rootNodeId: routerId
  };
  assertValid(SCHEMA_IDS.PROJECT, project, 'nodegx.project.json');

  const appComponent: ComponentV2File = {
    $schema: SCHEMA_IDS.COMPONENT,
    id: appComponentId,
    name: 'App',
    path: '/App',
    type: 'root',
    modified: now
  };
  const appNodes: NodesV2File = {
    $schema: SCHEMA_IDS.NODES,
    componentId: appComponentId,
    version: 1,
    nodes: [
      {
        id: routerId,
        type: 'Router',
        label: 'Main Router',
        // `name` is required — getRouterIndex() drops routers without one, and
        // `pages` must be the { startPage, routes } shape the runtime and the
        // exporter expect, listing page components by their legacy names.
        parameters: {
          name: 'Main',
          pages: { startPage: '/Pages/Home', routes: ['/Pages/Home'] }
        }
      }
    ],
    visualRoots: [routerId]
  };
  const appConnections: ConnectionsV2File = {
    $schema: SCHEMA_IDS.CONNECTIONS,
    componentId: appComponentId,
    version: 1,
    connections: []
  };

  const homeComponent: ComponentV2File = {
    $schema: SCHEMA_IDS.COMPONENT,
    id: homeComponentId,
    name: 'Home',
    path: '/Pages/Home',
    type: 'page',
    modified: now
  };
  const homeNodes: NodesV2File = {
    $schema: SCHEMA_IDS.NODES,
    componentId: homeComponentId,
    version: 1,
    nodes: [
      {
        id: pageId,
        type: 'Page',
        label: 'Home',
        parameters: { title: 'Home', urlPath: 'home' },
        children: [textId]
      },
      {
        id: textId,
        type: 'Text',
        label: 'Placeholder',
        parent: pageId,
        parameters: { text: `${name}${SKELETON_PLACEHOLDER_MARKER}` }
      }
    ],
    visualRoots: [pageId]
  };
  const homeConnections: ConnectionsV2File = {
    $schema: SCHEMA_IDS.CONNECTIONS,
    componentId: homeComponentId,
    version: 1,
    connections: []
  };

  assertValid(SCHEMA_IDS.COMPONENT, appComponent, 'components/App/component.json');
  assertValid(SCHEMA_IDS.NODES, appNodes, 'components/App/nodes.json');
  assertValid(SCHEMA_IDS.CONNECTIONS, appConnections, 'components/App/connections.json');
  assertValid(SCHEMA_IDS.COMPONENT, homeComponent, 'components/Pages/Home/component.json');
  assertValid(SCHEMA_IDS.NODES, homeNodes, 'components/Pages/Home/nodes.json');
  assertValid(SCHEMA_IDS.CONNECTIONS, homeConnections, 'components/Pages/Home/connections.json');

  const registry: RegistryV2File = {
    $schema: SCHEMA_IDS.REGISTRY,
    version: 1,
    lastUpdated: now,
    components: {
      App: { path: 'App', type: 'root', nodeCount: 1, connectionCount: 0, created: now, modified: now },
      'Pages/Home': {
        path: 'Pages/Home',
        type: 'page',
        nodeCount: 2,
        connectionCount: 0,
        created: now,
        modified: now
      }
    },
    stats: { totalComponents: 2, totalNodes: 3, totalConnections: 0 }
  };
  assertValid(SCHEMA_IDS.REGISTRY, registry, 'components/_registry.json');

  // Everything validated before anything is written, so a rejected skeleton
  // leaves no half-project behind — the same order every write path here uses.
  put('nodegx.project.json', project);
  put('components/App/component.json', appComponent);
  put('components/App/nodes.json', appNodes);
  put('components/App/connections.json', appConnections);
  put('components/Pages/Home/component.json', homeComponent);
  put('components/Pages/Home/nodes.json', homeNodes);
  put('components/Pages/Home/connections.json', homeConnections);
  put('components/_registry.json', registry);

  return { files, rootNodeId: routerId };
}

function assertValid(schemaId: (typeof SCHEMA_IDS)[keyof typeof SCHEMA_IDS], data: unknown, what: string): void {
  const result = SchemaValidator.instance.validate(schemaId, data);
  if (!result.valid) {
    throw new ToolError('io-error', `Generated ${what} does not match its schema: ${formatValidationErrors(result.errors)}`);
  }
}

/** The scope as `create_project` accepts it over the wire. */
const scopeSchema = {
  directory: z
    .string()
    .describe('Absolute path of the folder to create the project in. Must not already exist, or must be empty.'),
  name: z.string().describe('Project name, e.g. "Reading List"'),
  request: z
    .string()
    .describe("What the user asked for, in their own words. Quoted verbatim into the scoping record — do not paraphrase."),
  summary: z.string().optional().describe('One or two sentences: what this app is.'),
  audience: z.string().optional().describe('Who actually opens it and what they are trying to get done.'),
  objects: z
    .array(
      z.object({
        name: z.string(),
        purpose: z.string().optional(),
        fields: z.array(z.string()).optional(),
        relationships: z.array(z.string()).optional()
      })
    )
    .optional()
    .describe('The things this app stores. Singular names.'),
  pages: z
    .array(z.object({ name: z.string(), purpose: z.string() }))
    .optional()
    .describe('The pages agreed. Each becomes ONE plan operation — and nothing more, until the plan is run.'),
  outOfScope: z.array(z.string()).optional().describe('What this app deliberately will NOT do.'),
  // AIB-007: structured, with the bare string still accepted. `mergeScope`
  // normalises either — a string becomes `kind: 'unspecified'` unless it plainly
  // says there is none, and never `'nodegx'`, so prose can never provision.
  backend: z
    .union([
      z.string(),
      z.object({
        kind: z.enum(['none', 'nodegx', 'external']).optional(),
        description: z.string().optional(),
        collections: z
          .array(
            z.object({
              name: z.string(),
              fields: z.array(z.object({ name: z.string(), type: z.string().optional() })).optional()
            })
          )
          .optional(),
        needsAuth: z.boolean().optional()
      })
    ])
    .optional()
    .describe(
      'What it stores data in. Either prose, or {kind, description, collections, needsAuth} — "nodegx" means ' +
        'the returned plan will include an operation offering to create a built-in backend.'
    ),
  conventions: z
    .array(z.string())
    .optional()
    .describe('Checkable rules this project agreed to follow. Only rules that were actually agreed.'),
  rejected: z
    .array(z.object({ option: z.string(), reason: z.string() }))
    .optional()
    .describe('Considered and deliberately not done, with the reason. This outlives everything else here.'),
  openQuestions: z
    .array(z.string())
    .optional()
    .describe('Raised and unresolved. Rendered as "> TODO:" lines rather than guessed at.'),
  agreed: z.boolean().optional().describe('Whether the user signed off on the whole scope.'),
  transcript: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string() }))
    .optional()
    .describe('The scoping conversation, for the record. Omit it and the record simply says none was captured.')
};

type CreateProjectArgs = {
  directory: string;
  name: string;
  request: string;
  transcript?: ScopeTranscriptEntry[];
  /** AIB-007: prose or structure — `mergeScope` normalises either. */
  backend?: ScopeBackendInput;
} & Partial<Omit<ProjectScope, 'request' | 'backend'>>;

export interface CreateProjectResponse {
  ok: true;
  projectDir: string;
  files: string[];
  docs: string[];
  rootNodeId: string;
  plan: AuthoringPlan;
  note: string;
  /**
   * BST-005 — what was written so the *next* session in this folder is not as
   * cold as this one. Reported rather than assumed: "already there" and "we
   * wrote it" look identical from outside, and a `skipped` row is the only
   * place a failed write is visible at all.
   */
  agentConfig: AgentConfigReport;
}

/**
 * Refuse anything that is not an empty or absent directory. Creating a project
 * *over* an existing one is how someone loses work to a tool call, and there is
 * no undo out here.
 */
function prepareDirectory(directory: string): string {
  if (!directory.trim()) throw new ToolError('invalid-argument', 'A target directory is required.');
  const target = path.resolve(directory);
  if (fs.existsSync(target)) {
    const stat = fs.statSync(target);
    if (!stat.isDirectory()) {
      throw new ToolError('invalid-argument', `${target} exists and is not a directory.`);
    }
    if (fs.readdirSync(target).length > 0) {
      throw new ToolError(
        'already-exists',
        `${target} is not empty. Pick a new folder — this tool will not create a project over existing files.`
      );
    }
  } else {
    fs.mkdirSync(target, { recursive: true });
  }
  return target;
}

export function registerCreateProjectTools(server: McpServer): void {
  server.registerTool(
    'create_project',
    {
      title: 'Create a new NodeGX project',
      description:
        'Create a new project from an agreed scope: the project skeleton, its docs/ (BRIEF.md, ARCHITECTURE.md, ' +
        'CONVENTIONS.md and decisions/000-initial-scope.md), and a build plan that is RETURNED BUT NOT RUN. ' +
        'No components are authored beyond the empty App + Home skeleton — the pages come later, from the plan, ' +
        'once a human has reviewed it. Scope the app in conversation with your user FIRST: what it is, who uses ' +
        'it, the records, the pages, what it deliberately will not do, and — the field with the longest shelf ' +
        'life — what you considered and rejected. Anything you did not actually agree belongs in openQuestions, ' +
        'where it becomes a "> TODO:" for a human, not an invented sentence. Point a new server at the created ' +
        'directory to build against it.',
      inputSchema: scopeSchema
    },
    guarded(async (args: CreateProjectArgs) => {
      const target = prepareDirectory(args.directory);
      const name = args.name?.trim();
      if (!name) throw new ToolError('invalid-argument', 'A project name is required.');
      if (!args.request?.trim()) {
        throw new ToolError('invalid-argument', 'A request is required — what did the user actually ask for?');
      }

      const scope: ProjectScope = mergeScope(emptyScope(args.request.trim()), {
        summary: args.summary,
        audience: args.audience,
        backend: args.backend,
        objects: args.objects,
        pages: args.pages,
        outOfScope: args.outOfScope,
        conventions: args.conventions,
        rejected: args.rejected,
        openQuestions: args.openQuestions,
        agreed: args.agreed
      });

      const skeleton = writeProjectSkeleton(target, name);

      const plan = planFromScope(scope, { existingComponents: SKELETON_COMPONENTS });
      // The plan is handed to a human to review, so it is validated here rather
      // than at the point someone tries to run it and finds out it never could.
      const planErrors = validatePlan(plan, { existingComponents: SKELETON_COMPONENTS });
      if (plan.operations.length > 0 && planErrors.length > 0) {
        throw new ToolError('invalid-argument', `The scope does not produce an executable plan: ${planErrors.join(' · ')}`);
      }

      const documents = scopeDocuments({
        scope,
        transcript: args.transcript ?? [],
        plan,
        abandoned: !scope.agreed
      });
      for (const doc of documents) {
        const abs = path.join(target, ...doc.path.split('/'));
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        writeTextAtomic(abs, doc.content);
      }

      // BST-005 — last, after the documents, because `CLAUDE.md` points at them
      // and a pointer written before its target is a pointer that can be wrong.
      // Never throws: a project without a CLAUDE.md is still a project, and the
      // report is where a failure becomes visible instead of vanishing.
      const agentConfig = await writeAgentConfig({
        projectDir: target,
        projectName: name,
        summary: scope.summary,
        hasDocs: documents.length > 0
      });

      const payload: CreateProjectResponse = {
        ok: true,
        projectDir: target,
        files: skeleton.files,
        docs: documents.map((d) => d.path),
        rootNodeId: skeleton.rootNodeId,
        plan,
        note:
          `Project created with an empty App + Home skeleton and ${plan.operations.length} planned operation(s) ` +
          `that have NOT been run. The plan is also recorded in ${DOC_INITIAL_SCOPE}. To build it, start a ` +
          'server against this directory with --allow-writes and use create_plan / stage_plan_operation / ' +
          'apply_plan — reviewing each page against docs/CONVENTIONS.md as you go.',
        agentConfig
      };
      return jsonResult(payload);
    })
  );
}
