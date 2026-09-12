/**
 * TPL-005 — the pixel game as a project a person can start from.
 *
 * `tpl005Components.ts` is the arguments the door is given; this file is the
 * composition. It authors them into an empty project through the real MCP
 * server, reads the result back with the editor's own importer, and prepares the
 * directory Richard zips.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## 🔴 The modules are installed BEFORE authoring, not packaged afterwards
 *
 * Measured while scoping this task. The MCP door validates every node type
 * against the node catalog, and a module's nodes are not in it — so
 * `create_component` with a `keyboard-shortcuts.KeyboardShortcut` in it is
 * **refused** with `unknown-node-type` and *nothing is written*:
 *
 * > `ERROR [unknown-node-type] node pKey (keyboard-shortcuts.KeyboardShortcut):
 * > Unknown node type … If this is a module-provided node, ensure the module is
 * > installed`
 *
 * Copy the module into the project's `noodl_modules/` first and the identical
 * write reports **0 errors, 0 warnings, 0 infos** — the catalog does extend from
 * the project being authored. So {@link installModules} runs before the first
 * `create_component`, and the same files are what make the zip work on a machine
 * that has never installed either module (AC6).
 *
 * ⚠️ **One misleading message, recorded rather than fixed.** With the module
 * absent the door also emits an `info` saying *"the catalog is built from
 * built-in node types only"* — which is not true of a project that has the
 * module installed, as the second measurement shows. Filed as a note, not
 * touched here: this is a template, and the string belongs to the validator.
 *
 * ## Prepared, not embedded — and for this one, not even that
 *
 * TPL-001 ships as a curated directory; TPL-003 was later ruled **embedded**.
 * Richard has asked for neither here — *"I'll share the zip directly and we can
 * publish another demo page"* — so this builds the project directory and stops.
 * No `content.json` is compiled into the editor and no shelf row is claimed.
 * 🔴 Do not add either without a ruling: `pixel-game` is none of the six ruled
 * categories (P78 T3), so a shelf row would have to call this a `starter`.
 *
 * ## What this template does NOT have, and why that is the product
 *
 * No `__cloud__/` components, no `nodegx.security.json`, no
 * `metadata.cloudservices`. A game that needs a server to be played is a
 * different and worse template, and the artefact says so by containing nothing
 * that would need one. The gate asserts the absence.
 *
 * @module noodl-mcp/tests/tpl005Template
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
  GRID_H,
  GRID_W,
  LEVELS,
  REQUIRED_MODULES,
  START_HP,
  TPL005_COMPONENTS
} from './tpl005Components';
import { TPL005_PRESET, TPL005_TOKENS } from './tpl005Theme';

export { APP_COMPONENT };

/** The template's id and the directory name it is prepared into. */
export const TEMPLATE_ID = 'pixel-game';

/** The name the project carries before the wizard renames it. */
export const TEMPLATE_PROJECT_NAME = 'Pixel dungeon';

/** Every per-run timestamp is pinned to this, so two builds agree byte for byte. */
export const TEMPLATE_EPOCH = '2026-09-11T00:00:00.000Z';

/** Where the note lands. `docs/` is the editor's own folder for prose, and it is never served. */
export const START_HERE_FILE = 'docs/START-HERE.md';

/** Where the shipped library modules are read from. */
const MODULE_LIBRARY = path.join(__dirname, '..', '..', '..', 'library', 'modules');

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
  /** The modules installed before authoring, by name. */
  modules: string[];
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
        // `bodyScroll: true` — REL-002a. The board plus its HUD, legend and
        // banner is taller than a laptop viewport, and without this the viewer
        // pins the app to the viewport and the legend cannot be reached.
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

/**
 * Install the library modules this template's nodes come from.
 *
 * 🔴 **Before authoring, for the reason in the header** — the door refuses a node
 * type it cannot find, and these two are not built in. Both are single-file kits
 * with `"dependencies": []` and no build step, which is what makes copying them
 * a legitimate install rather than a shortcut.
 *
 * @returns the module names installed, in order
 */
export function installModules(projectDir: string): string[] {
  const installed: string[] = [];
  for (const name of REQUIRED_MODULES) {
    const from = path.join(MODULE_LIBRARY, name, 'project', 'noodl_modules');
    if (!fs.existsSync(from)) {
      throw new Error(`library module "${name}" is not at ${from} — it cannot be installed, and the door will refuse its nodes`);
    }
    // A module ships as `<name>/project/noodl_modules/<its own dir>/` — and the
    // directory inside is NOT always the module's library name (`confetti`
    // ships `nodegx-confetti`), so copy what is there rather than what it is called.
    for (const inner of fs.readdirSync(from)) {
      const target = path.join(projectDir, 'noodl_modules', inner);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(path.join(from, inner), target, { recursive: true });
      installed.push(inner);
    }
  }
  return installed;
}

export interface BuildOptions {
  /** Author everything except the `App` shell — one arm, never anything that ships. */
  omitApp?: boolean;
  /**
   * Skip the module install, so a spec can measure the refusal the header
   * records rather than trusting the prose. Never used by anything that ships.
   */
  omitModules?: boolean;
}

/**
 * Author the whole template into a fresh directory and read it back.
 *
 * The order: the modules (or the door refuses the keyboard), then the look, then
 * `App` (so the page registers into its router), then the parts — `Cell` before
 * `Row`, because `Row`'s repeater names `Cell` on a port — then the page.
 */
export async function buildPixelTemplateProject(options: BuildOptions = {}): Promise<AuthoredTemplate> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl005-template-'));
  writeSkeleton(dir);
  const modules = options.omitModules ? [] : installModules(dir);

  const { server } = createServer({ projectDir: dir, allowWrites: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'tpl005-template', version: '0.0.0' });
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
  await call('set_style_preset', { preset_id: TPL005_PRESET }, 'theme:preset');
  await call('set_project_tokens', { tokens: [...TPL005_TOKENS] }, 'theme:tokens');

  if (!options.omitApp) await create(APP_COMPONENT, APP_NODES, APP_WIRES);

  for (const c of TPL005_COMPONENTS) {
    await create(c.path, c.nodes, c.connections);
  }

  await client.close();
  await server.close();

  return { project: readAsLegacyProject(dir), order, registrations, projectDir: dir, diagnostics, remaps, modules };
}

// ── Preparing the directory a person is handed ───────────────────────────────

/**
 * Turn an authored project directory into the artefact a person is handed.
 *
 * @param built the result of {@link buildPixelTemplateProject}
 * @param output where the artefact goes — cleared first, so it is the door's
 *   output and nothing that survived from a previous shape
 */
export function preparePixelArtefact(built: AuthoredTemplate, output: string): void {
  if (Object.keys(built.registrations).length === 0) {
    throw new Error('refusing to write: no page registered into a router — the app would open on nothing');
  }

  // DEF-038 — settle the governed checkboxes BEFORE the id pinning reads the
  // files, so the artefact means the same thing on disk as once the editor has
  // loaded it. 🔴 This template *sets* fourteen of those checkboxes itself
  // (`signalOnly`), and they are load-bearing: pinning writes defaults for the
  // ones nobody set and must leave an explicit `false` alone. The gate checks.
  pinRunOnValueChangeDefaultsInDirectory(built.projectDir);
  pinComponentFiles(built.projectDir, 'tpl005', TEMPLATE_EPOCH);
  pinRegistry(built.projectDir, TEMPLATE_EPOCH);

  if (path.basename(output) !== TEMPLATE_ID) throw new Error(`refusing to clear ${output}`);
  fs.rmSync(output, { recursive: true, force: true });
  copyTree(built.projectDir, output);

  // 🔴 No backend is a claim the artefact has to keep.
  if (fs.existsSync(path.join(output, 'components', '__cloud__'))) {
    throw new Error('refusing to write: this template ships no backend, and a __cloud__ component was authored');
  }
  // 🔴 And the keyboard is a claim too: without the module in the artefact the
  // zip opens on a board that does not answer a key press.
  for (const name of ['keyboard-shortcuts']) {
    if (!fs.existsSync(path.join(output, 'noodl_modules', name))) {
      throw new Error(`refusing to write: noodl_modules/${name} is missing — the game would not respond to the keyboard`);
    }
  }

  writeStartHere(output);
  pinRootNode(output, APP_COMPONENT);
}

/** The note a person reads first. Generated, so it cannot drift from the graph it describes. */
function writeStartHere(output: string): void {
  const lines = [
    `# ${TEMPLATE_PROJECT_NAME}`,
    '',
    'A turn-based dungeon, built entirely out of NodeGX nodes. Press **Run**, then use the',
    '**arrow keys** (or WASD). Collect the coins, find the way out, and watch what follows you.',
    '',
    'There is no backend. Nothing here needs an account, a key or a server.',
    '',
    '## The first thing to change',
    '',
    `Open **Pages/Play** and find the node labelled **"${EDIT}the five rooms — this list IS the game"**.`,
    'It is a `Static Data` node holding a JSON array:',
    '',
    '```json',
    '[',
    '  {',
    '    "name": "First steps",',
    '    "grid": "############\\n#@...c.....#\\n…"',
    '  }',
    ']',
    '```',
    '',
    'Add a sixth room by adding a sixth entry. **That is the whole change** — no new component,',
    'no rewiring, no code. The grid is text:',
    '',
    '| character | what it is |',
    '|---|---|',
    '| `#` | a wall |',
    '| `.` | floor |',
    '| `c` | a coin |',
    '| `E` | something that steps when you step |',
    '| `@` | where you start |',
    '| `>` | the way out |',
    '',
    `Rooms are ${GRID_W} wide and ${GRID_H} tall. Keep the outer ring as \`#\` — off the grid counts as a`,
    'wall either way, but the border is what makes the room read as a room.',
    '',
    '## How the game works, in the graph',
    '',
    'Worth ten minutes if you came here to learn NodeGX rather than to play.',
    '',
    '- **`Game/Move`** is the rule for walking, written **once** and placed **four times** — up,',
    '  down, left, right — with `dx`/`dy` set on each instance. That is the whole reason there is',
    '  one place to change what a step does.',
    '- **Every decision in the game is a `Condition` node** you can open and follow: is there a',
    '  wall, was there a coin, is this the way out, did one of them reach you, are you out of',
    '  hearts, was that the last room.',
    '- **`Game/Cell`** colours a tile with a `States` node — six kinds of tile, three colours each.',
    '  The legend is a node, not a stylesheet.',
    '- **The board is two repeaters**: one over the rows, one over each row’s cells.',
    '- The `Function` nodes do not decide anything. They answer questions (is that a wall, how many',
    '  of them are on your tile) and transform lists (take a coin, step the enemies, draw the room).',
    '',
    '## The things that are deliberate',
    '',
    `- **${START_HP} hearts.** Enough to learn a room, not enough to walk it blind.`,
    '- **The world only moves when you do.** Stand still and nothing happens — there is no clock.',
    '- **Held keys repeat.** Walking a corridor should not need four separate presses.',
    '- **Dying drops your coins and restarts the room.** The room number is kept, so a hard room',
    '  stays where you left it.',
    '',
    '## A library module travels with this project',
    '',
    '`noodl_modules/keyboard-shortcuts` reads the arrow keys. It is already here — nothing to',
    'install. **Do not delete it**: without it the board draws and never answers a key.'
  ];
  const file = path.join(output, START_HERE_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

/** How many rooms ship, for a gate that would otherwise count a literal. */
export const LEVEL_COUNT = LEVELS.length;
