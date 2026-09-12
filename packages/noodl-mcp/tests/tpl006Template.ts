/**
 * TPL-006 — the story engine as a project a person can start from.
 *
 * `tpl006Components.ts` is the arguments the door is given; this file is the
 * composition. It authors them into an empty project through the real MCP server,
 * reads the result back with the editor's own importer, and prepares the directory
 * Richard zips.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## 🔴 The story is read off disk, and that is the whole argument of the template
 *
 * `dev-docs/tasks/phase-78-the-templates/tpl-006-the-last-light.json` is the one
 * copy of *The Last Light*. It is not pasted into a TypeScript module, because a
 * story inlined in source is a story you have to be a developer to change — which
 * is the claim this template exists to make true in the other direction. It goes
 * into exactly one `Static Data` parameter and nowhere else, and
 * `tpl006Template.test.ts` §6 proves "nowhere else" against every authored
 * parameter in the built artefact.
 *
 * ⚠️ **It is a build-time dependency on `dev-docs/`, which is unusual and
 * deliberate.** The alternative was a second copy under `packages/noodl-mcp/tests/`,
 * and a second copy of a reviewable artefact is the shape
 * `a-second-copy-of-a-palette-drifts-silently` was filed for. The task file links
 * to the same path, so the prose Richard rules on and the prose that ships are one
 * file.
 *
 * ## Zero modules, and the measurement that says it is allowed
 *
 * TPL-005 had to install `keyboard-shortcuts` **before** authoring, because the MCP
 * door validates node types against the catalog and refuses a module's node with
 * `unknown-node-type`. This template uses nothing outside the standard library, so
 * there is no install step at all and {@link prepareStoryArtefact} asserts the
 * absence rather than trusting it.
 *
 * ## Prepared, not embedded
 *
 * TPL-001 ships as a curated directory; TPL-003 was ruled embedded. Richard has
 * ruled neither here, and `interactive-fiction` is none of the six ruled category
 * slugs (P78 `T3`, still open), so a shelf row would have to call this a `starter`.
 * This builds the project directory and stops.
 *
 * @module noodl-mcp/tests/tpl006Template
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { LegacyProject } from '../../noodl-editor/src/editor/src/io/ProjectExporter';
import { createServer } from '../src/server';

import { pinRunOnValueChangeDefaultsInDirectory, readAsLegacyProject } from './templateArtefact';
import { copyTree, pinComponentFiles, pinRegistry, pinRootNode } from './templatePins';
import {
  APP_COMPONENT,
  APP_NODES,
  APP_WIRES,
  EDIT,
  PAGE_READ,
  PAGE_REMIX,
  READ_REMIX_DOOR,
  REQUIRED_MODULES,
  SOURCE_COMPONENT,
  STORY_FILE,
  tpl006Components
} from './tpl006Components';
import { TPL006_PRESET, TPL006_TOKENS } from './tpl006Theme';

export { APP_COMPONENT };

/** The template's id and the directory name it is prepared into. */
export const TEMPLATE_ID = 'story-engine';

/**
 * The name the project carries before the wizard renames it.
 *
 * 🔴 **The product's name, never the story's.** Calling the project *The Last
 * Light* would put the demo story's identity in `nodegx.project.json`, the HTML
 * title and the browser tab — three more places a person replacing the story would
 * have to find. The story names itself in its own first passage.
 */
export const TEMPLATE_PROJECT_NAME = 'Story engine';

/** Every per-run timestamp is pinned to this, so two builds agree byte for byte. */
export const TEMPLATE_EPOCH = '2026-09-12T00:00:00.000Z';

/** Where the note lands. `docs/` is the editor's own folder for prose, and it is never served. */
export const START_HERE_FILE = 'docs/START-HERE.md';

/** The repository root, from this file. */
const REPO_ROOT = path.join(__dirname, '..', '..', '..');

/**
 * The demo story, as the text that goes into the one `Static Data` parameter.
 *
 * 🔴 Re-serialised rather than copied byte for byte: the artefact has to be
 * reproducible from the generator, and a hand-formatted file would make the drift
 * gate fail on whitespace nobody changed. Parsing it also means a malformed story
 * reddens the build instead of shipping as a node whose JSON will not parse.
 */
export function readStoryJson(): string {
  const file = path.join(REPO_ROOT, STORY_FILE);
  if (!fs.existsSync(file)) {
    throw new Error(`the demo story is not at ${file} — this template has nothing to ship`);
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${STORY_FILE} is not a non-empty array of passages`);
  }
  return JSON.stringify(parsed, null, 2);
}

interface ToolResult {
  isError?: boolean;
  content?: Array<{ type: string; text: string }>;
}

/** What one authoring run reports back, so a caller can assert on it. */
export interface AuthoredTemplate {
  project: LegacyProject;
  order: string[];
  registrations: Record<string, { router: string; added: string[]; startPage?: string }>;
  projectDir: string;
  /** Every non-error diagnostic the door raised — silence is only evidence if it was read. */
  diagnostics: Array<{ component: string; code: string; severity: string; message: string }>;
  /** Node ids the door had to move to keep them unique project-wide. */
  remaps: Array<{ component: string; from: string; to: string }>;
  /** The story that was authored in, as the text that went into the node. */
  storyJson: string;
}

/** An empty v2 project: the state a person is in before they pick a template. */
function writeSkeleton(dir: string): void {
  fs.mkdirSync(path.join(dir, 'components'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'nodegx.project.json'),
    JSON.stringify(
      {
        $schema: 'https://opennoodl.dev/schemas/project-v2.json',
        name: TEMPLATE_PROJECT_NAME,
        version: '4',
        nodegxVersion: '1.1.0',
        // `bodyScroll: true` — a passage can be four paragraphs long and the
        // choices are under it. Without this the viewer pins the app to the
        // viewport and the reader cannot reach the thing they are meant to click.
        settings: { htmlTitle: TEMPLATE_PROJECT_NAME, navigationPathType: 'path', bodyScroll: true },
        structure: { componentsDir: 'components', assetsDir: 'assets' }
      },
      null,
      2
    )
  );
  // ⚠️ `components` is an OBJECT keyed by registry path, never `[]`.
  fs.writeFileSync(
    path.join(dir, 'components', '_registry.json'),
    JSON.stringify(
      {
        $schema: 'https://opennoodl.dev/schemas/registry-v2.json',
        version: 1,
        lastUpdated: TEMPLATE_EPOCH,
        components: {},
        stats: { totalComponents: 0, totalNodes: 0, totalConnections: 0 }
      },
      null,
      2
    )
  );
}

export interface BuildOptions {
  /** Author everything except the `App` shell — one arm, never anything that ships. */
  omitApp?: boolean;
  /** Author a different story, so a spec can measure the engine against a fixture. */
  storyJson?: string;
}

/**
 * Author the whole template into a fresh directory and read it back.
 *
 * The order: the look, then `App` (so the pages register into its router), then the
 * parts bottom-up — `Story/Carried` before `Story/Sidebar`, because the sidebar's
 * repeater names it on a parameter — then the two pages, `Pages/Read` first because
 * the first page written is the one the router makes the start page.
 */
export async function buildStoryTemplateProject(options: BuildOptions = {}): Promise<AuthoredTemplate> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl006-template-'));
  writeSkeleton(dir);
  const storyJson = options.storyJson ?? readStoryJson();

  const { server } = createServer({ projectDir: dir, allowWrites: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'tpl006-template', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const order: string[] = [];
  const registrations: AuthoredTemplate['registrations'] = {};
  const diagnostics: AuthoredTemplate['diagnostics'] = [];
  const remaps: AuthoredTemplate['remaps'] = [];

  const call = async (name: string, args: Record<string, unknown>, label: string): Promise<unknown> => {
    const res = (await client.callTool({ name, arguments: args })) as ToolResult;
    if (res.isError) throw new Error(`${name} ${label} refused:\n${res.content?.[0]?.text}`);
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(res.content?.[0]?.text ?? '{}') as Record<string, unknown>;
    } catch {
      return {};
    }
    for (const r of (payload.remappedNodeIds as Array<{ from: string; to: string }> | undefined) ?? []) {
      remaps.push({ component: label, from: r.from, to: r.to });
    }
    const raised = (payload.validation as { diagnostics?: Array<Record<string, unknown>> } | undefined)?.diagnostics;
    for (const d of raised ?? []) {
      diagnostics.push({
        component: label,
        code: String(d.code ?? ''),
        severity: String(d.severity ?? ''),
        message: String(d.message ?? '')
      });
    }
    return payload;
  };

  const create = async (key: string, nodes: unknown[], connections: unknown[]): Promise<void> => {
    const payload = (await call('create_component', { path: key, nodes, connections }, key)) as {
      registeredPages?: { router: string; added: string[]; startPage?: string };
    };
    order.push(key);
    if (payload.registeredPages) registrations[key] = payload.registeredPages;
  };

  // The look first, through the same door as everything else.
  await call('find_tools', { group: 'theme' }, 'theme:reveal');
  await call('set_style_preset', { preset_id: TPL006_PRESET }, 'theme:preset');
  await call('set_project_tokens', { tokens: [...TPL006_TOKENS] }, 'theme:tokens');

  if (!options.omitApp) await create(APP_COMPONENT, APP_NODES, APP_WIRES);

  for (const c of tpl006Components(storyJson)) {
    await create(c.path, c.nodes, c.connections);
  }

  // 🔴 The last thing, and it has to be last — see `READ_REMIX_DOOR`. The reading
  // page's door to the remix page names a component that did not exist while the
  // reading page was being written, and the door refuses a target it cannot
  // resolve. Two pages that link to each other cannot be authored in one pass.
  if (!options.omitApp) {
    await call(
      'update_component',
      { path: READ_REMIX_DOOR.component, operations: [...READ_REMIX_DOOR.operations] },
      READ_REMIX_DOOR.component
    );
  }

  await client.close();
  await server.close();

  return { project: readAsLegacyProject(dir), order, registrations, projectDir: dir, diagnostics, remaps, storyJson };
}

// ── Preparing the directory a person is handed ───────────────────────────────

/**
 * Turn an authored project directory into the artefact a person is handed.
 *
 * @param built the result of {@link buildStoryTemplateProject}
 * @param output where the artefact goes — cleared first, so it is the door's output
 *   and nothing that survived from a previous shape
 */
export function prepareStoryArtefact(built: AuthoredTemplate, output: string): void {
  if (Object.keys(built.registrations).length === 0) {
    throw new Error('refusing to write: no page registered into a router — the app would open on nothing');
  }

  // DEF-038 — settle the governed checkboxes BEFORE the id pinning reads the
  // files, so the artefact means the same thing on disk as once the editor has
  // loaded it. 🔴 This template *sets* three of those checkboxes itself
  // (`signalOnly`), and all three are load-bearing: pinning writes defaults for the
  // ones nobody set and must leave an explicit `false` alone. The gate checks.
  pinRunOnValueChangeDefaultsInDirectory(built.projectDir);
  pinComponentFiles(built.projectDir, 'tpl006', TEMPLATE_EPOCH);
  pinRegistry(built.projectDir, TEMPLATE_EPOCH);

  if (path.basename(output) !== TEMPLATE_ID) throw new Error(`refusing to clear ${output}`);
  fs.rmSync(output, { recursive: true, force: true });
  copyTree(built.projectDir, output);

  // 🔴 No backend is a claim the artefact has to keep.
  if (fs.existsSync(path.join(output, 'components', '__cloud__'))) {
    throw new Error('refusing to write: this template ships no backend, and a __cloud__ component was authored');
  }
  // 🔴 And zero modules is a claim too (AC4) — asserted on the directory, because
  // "we did not install one" and "there is not one here" are different sentences.
  const modulesDir = path.join(output, 'noodl_modules');
  if (fs.existsSync(modulesDir) && fs.readdirSync(modulesDir).length > 0) {
    throw new Error(
      `refusing to write: this template claims zero noodl_modules and ${modulesDir} holds ` +
        `${fs.readdirSync(modulesDir).join(', ')}`
    );
  }

  writeStartHere(output);
  pinRootNode(output, APP_COMPONENT);
}

/** The note a person reads first. Generated, so it cannot drift from the graph it describes. */
function writeStartHere(output: string): void {
  const lines = [
    `# ${TEMPLATE_PROJECT_NAME}`,
    '',
    'A branching story. Press **Run** and read it — every choice takes you somewhere, some choices',
    'hand you something, and some only appear once you are carrying it.',
    '',
    'There is no backend and **no library modules**. Nothing here needs an account, a key, a server',
    'or an install.',
    '',
    '## The only thing you have to change',
    '',
    `Open the **${SOURCE_COMPONENT.slice(1)}** component and find the node labelled`,
    `**"${EDIT}your story — every passage, in this one list"**. It is a \`Static Data\` node holding`,
    'a JSON array, and **that array is the entire story**:',
    '',
    '```json',
    '[',
    '  {',
    '    "id": "hall",',
    '    "title": "The hallway",',
    '    "text": "Two doors. One of them is warm to the touch.",',
    '    "choices": [',
    '      { "label": "Open the warm door", "goto": "kitchen", "gives": "a brass key" },',
    '      { "label": "Unlock the far door", "goto": "out", "requires": "a brass key" }',
    '    ]',
    '  },',
    '  { "id": "out", "title": "Outside", "text": "You are out." }',
    ']',
    '```',
    '',
    'Delete what is there, paste your own, press Run. **No new component, no rewiring, no code.**',
    '',
    '## Four words, and there is no fifth',
    '',
    '| word | what it does |',
    '|---|---|',
    '| `goto` | where a choice takes the reader — the `id` of another passage |',
    '| `gives` | hands the reader something; it appears under **What you carry** |',
    '| `requires` | the choice is **invisible** until they carry that thing — not greyed out, absent |',
    '| *no `choices` at all* | that passage is an ending |',
    '',
    'Every passage needs an `id` and they have to be unique. Everything else is optional.',
    '',
    '## You do not have to open the editor at all',
    '',
    `Run the app and go to **/remix**. The box there already holds the story that is playing, so you`,
    'can change a line or select it all and paste your own over it, press **Read this story**, and',
    'it plays immediately. If what you paste is wrong it tells you what is wrong with it — which',
    'passage, and what it was missing — rather than showing you a blank page.',
    '',
    '## How it works, in the graph',
    '',
    'Worth ten minutes if you came here to learn NodeGX rather than to read a story.',
    '',
    `- **\`${SOURCE_COMPONENT.slice(1)}\`** is the one place the story lives, and it decides whether`,
    '  you are reading the shipped one or one somebody pasted. Both pages place it.',
    '- **Every decision is a `Condition` node** you can open and follow: is there a passage with',
    '  that id, is this an ending, did that choice give you something new, is there any way on from',
    '  here, is what was pasted a story.',
    `- **\`${'Story/Choice'}\`** publishes what was clicked to the repeater that drew it, which is how`,
    '  a row tells a page something. Look at `Pages/Read` for `itemOutputSignal-picked` beside',
    '  `itemOutput-goto` — the signal and the value come off the same node.',
    '- **`Story/Passage`** is a `States` node with three states — reading, an ending, a passage that',
    '  is not there — driven by one port.',
    '- **The `Function` nodes decide nothing.** They answer questions (which passage is this, which',
    '  choices can you see, is this paste a story) and transform lists (add what you were given).',
    '',
    '## The things that are deliberate',
    '',
    '- **A locked choice is absent, not greyed out.** A reader who never picked up the thing never',
    '  learns the choice existed. That is what makes finding it mean something — and it is why',
    '  there is no padlock icon to add.',
    '- **The reader carries things, not flags.** `gives: "a brass key"` is readable in the data and',
    '  readable on screen, and it is the same string in both places.',
    '- **A bad `goto` is reported in prose, naming the id.** It is the mistake everyone makes first.',
    '- **The prose is set in a serif at a 680px measure.** Two nodes set a font in this whole',
    '  project; everything else inherits the project body.'
  ];
  const file = path.join(output, START_HERE_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

/** The two pages, for a gate that would otherwise name them twice. */
export const PAGES = [PAGE_READ, PAGE_REMIX] as const;

/** Zero, and named so a gate reads the claim rather than a literal. */
export const MODULE_COUNT = REQUIRED_MODULES.length;
