/**
 * TPL-003 — the landing pages as a project a person can start from.
 *
 * `tpl003Components.ts` is the arguments the door is given; this file is the
 * composition. It authors them into an empty project through the real MCP
 * server, reads the result back with the editor's own importer, and prepares
 * the directory the shelf serves.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## Prepared, not embedded — for the reasons TPL-001 gives
 *
 * `shareAsTemplate` files a submission and publishes nothing; the platform's
 * `readBundleDirectory` takes a directory an operator prepared. So the artefact
 * is `templates/landing-pages/`, Richard is the operator, and a published row
 * reaches everyone already on 0.2.x with no app update. It touches no editor
 * source.
 *
 * ## What this template does NOT have, and why that is the product
 *
 * No `__cloud__/` components, no `nodegx.security.json`, no `metadata.
 * cloudservices`. Richard asked for *"no backend just front end"*, and the
 * artefact says so by containing nothing that would need one: the contact form
 * composes a `mailto:` link, the copy is in the graph, and the photographs are
 * the starter imagery every project already has. A template with no policy is
 * not a template that forgot its policy — the gate asserts the absence.
 *
 * @module noodl-mcp/tests/tpl003Template
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { LegacyProject } from '../../noodl-editor/src/editor/src/io/ProjectExporter';
import { pinRunOnValueChangeDefaults } from '../../noodl-editor/src/editor/src/models/ProjectPatches/runOnValueChangeMigration';
import { createServer } from '../src/server';

import { pinRunOnValueChangeDefaultsInDirectory, readAsLegacyProject } from './templateArtefact';
import { collectEditMarkers, copyTree, pinComponentFiles, pinRegistry, pinRootNode } from './templatePins';
import { APP_COMPONENT, APP_NODES, APP_WIRES, EDIT, PLACEHOLDER_ADDRESS, TPL003_COMPONENTS, createPass } from './tpl003Components';
import { TPL003_PRESET, TPL003_TOKENS } from './tpl003Theme';

export { APP_COMPONENT };

/** The template's id and the directory name it is prepared into. */
export const TEMPLATE_ID = 'landing-pages';

/** The name the project carries before the wizard renames it. */
export const TEMPLATE_PROJECT_NAME = 'Landing pages';

/** Every per-run timestamp is pinned to this. */
export const TEMPLATE_EPOCH = '2026-09-05T00:00:00.000Z';

/** Where the note lands. `docs/` is the editor's own folder for prose a person reads, and it is never served. */
export const START_HERE_FILE = 'docs/START-HERE.md';

/**
 * The EMBEDDED half — Richard, 2026-09-05: *"I want to make it one of the
 * packages templates like the members area and site builder."*
 *
 * The same build feeds two artefacts: the v2 directory (`templates/landing-pages/`,
 * what a curated shelf row or a gate reads) and a legacy `content.json` compiled
 * into the editor beside `site-builder.content.json`, reached as
 * `embedded://landing-pages`. One build, two shapes, one drift gate over both.
 */
export const EMBEDDED_DIR = path.join(__dirname, '..', '..', 'noodl-editor', 'src', 'editor', 'src', 'models', 'template', 'templates');
export const EMBEDDED_CONTENT_FILE = 'landing-pages.content.json';
export const EMBEDDED_DOCS_FILE = 'landing-pages.docs.json';

interface ToolResult {
  isError?: boolean;
  content?: Array<{ type: string; text: string }>;
}

/** What one authoring run reports back, so a caller can assert on it. */
export interface AuthoredTemplate {
  project: LegacyProject;
  order: string[];
  /** The router registration the door reported per page write. A page absent from this map was never routed. */
  registrations: Record<string, { router: string; added: string[]; startPage?: string }>;
  projectDir: string;
  /** Every non-error diagnostic the door raised, by component — the silence is only evidence if it was read. */
  diagnostics: Array<{ component: string; code: string; severity: string; message: string }>;
  /** Node ids the door had to move to keep them unique project-wide. */
  remaps: Array<{ component: string; from: string; to: string }>;
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
        // `bodyScroll: true` — REL-002a: without it the viewer pins the app to the
        // viewport and nothing below the fold can be reached, on a template that
        // is nothing but a fold and what is below it.
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
}

/**
 * Author the whole template into a fresh directory and read it back.
 *
 * The order: the look, then `App` (so every page registers into its router),
 * then the parts (so `For Each`-free instances still resolve their component
 * at the door), then the pages — the first page written becomes the start page
 * — then the deferred pass that gives the switcher its three destinations.
 */
export async function buildLandingTemplateProject(options: BuildOptions = {}): Promise<AuthoredTemplate> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl003-template-'));
  writeSkeleton(dir);

  const { server } = createServer({ projectDir: dir, allowWrites: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'tpl003-template', version: '0.0.0' });
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

  // The look first, through the same door as everything else. The `theme`
  // group is deferred behind `find_tools`; the preset writes the base and the
  // template's own tokens merge on top, in that order.
  await call('find_tools', { group: 'theme' }, 'theme:reveal');
  await call('set_style_preset', { preset_id: TPL003_PRESET }, 'theme:preset');
  await call('set_project_tokens', { tokens: [...TPL003_TOKENS] }, 'theme:tokens');

  if (!options.omitApp) await create(APP_COMPONENT, APP_NODES, APP_WIRES);

  for (const c of TPL003_COMPONENTS) {
    const payload = createPass(c);
    await create(c.path, payload.nodes, payload.connections);
  }
  for (const c of TPL003_COMPONENTS) {
    if (!c.deferred?.length) continue;
    await call('update_component', { path: c.path, set: { nodes: c.nodes, connections: c.connections } }, c.path);
  }

  await client.close();
  await server.close();

  return { project: readAsLegacyProject(dir), order, registrations, projectDir: dir, diagnostics, remaps };
}

// ── Preparing the directory a person is handed ───────────────────────────────

/**
 * Turn an authored project directory into the artefact a person is handed.
 *
 * @param built the result of {@link buildLandingTemplateProject}
 * @param output where the artefact goes — cleared first, so it is the door's
 *   output and nothing that survived from a previous shape
 */
export function prepareLandingArtefact(built: AuthoredTemplate, output: string): void {
  if (Object.keys(built.registrations).length === 0) {
    throw new Error('refusing to write: no page registered into a router — the app would open on nothing');
  }

  // DEF-038 — settle the governed checkboxes BEFORE the id pinning reads the
  // files, so the artefact means the same thing on disk as once the editor has
  // loaded it.
  pinRunOnValueChangeDefaultsInDirectory(built.projectDir);
  pinComponentFiles(built.projectDir, 'tpl003', TEMPLATE_EPOCH);
  pinRegistry(built.projectDir, TEMPLATE_EPOCH);

  if (path.basename(output) !== TEMPLATE_ID) throw new Error(`refusing to clear ${output}`);
  fs.rmSync(output, { recursive: true, force: true });
  copyTree(built.projectDir, output);

  // 🔴 No backend is a claim the artefact has to keep. A cloud component or a
  // policy file here would be a template that needs a server and does not say so.
  if (fs.existsSync(path.join(output, 'components', '__cloud__'))) {
    throw new Error('refusing to write: this template ships no backend, and a __cloud__ component was authored');
  }

  writeStartHere(output);
  pinRootNode(output, APP_COMPONENT);
}

/**
 * The legacy `content.json` the editor compiles in — `toTemplateContent`'s shape
 * (`sb007Template.ts`), for its reasons: `id`, `created` and `modifiedBy` are
 * dropped so two runs agree byte for byte, `rootComponent` names the App so the
 * provider can resolve a home at install, and the governed checkboxes are
 * settled so an editor load rewrites nothing (DEF-038).
 *
 * ⚠️ `metadata.designTokens` is carried across on purpose and asserted present:
 * it is the look, written by the door's `set_project_tokens`, and
 * `landing-pages.template.ts` reads its `designTokens` from here so the
 * template object and the content cannot disagree.
 */
export function toLandingTemplateContent(project: LegacyProject): Record<string, unknown> {
  const components = (project.components ?? []).map((component) => {
    const { id, created, modifiedBy, ...rest } = component as unknown as Record<string, unknown>;
    void id;
    void created;
    void modifiedBy;
    return rest;
  });
  const designTokens = (project.metadata as Record<string, unknown> | undefined)?.designTokens;
  if (!designTokens) throw new Error('refusing to write: the authored project carries no metadata.designTokens — the look would not ship');

  const content = {
    name: TEMPLATE_PROJECT_NAME,
    version: project.version,
    rootComponent: `/${APP_COMPONENT}`,
    components,
    ...(project.settings ? { settings: project.settings } : {}),
    metadata: { designTokens }
  };
  pinRunOnValueChangeDefaults(content);
  return content;
}

/**
 * Write the embedded pair beside the site builder's, from the SAME build that
 * produced the directory — the note is read back out of the prepared artefact
 * rather than generated twice.
 */
export function writeEmbeddedTemplate(built: AuthoredTemplate, artefactDir: string, embeddedDir: string): void {
  const content = toLandingTemplateContent(built.project);
  const startHere = fs.readFileSync(path.join(artefactDir, START_HERE_FILE), 'utf-8');
  const docs = [{ path: START_HERE_FILE, content: startHere }];
  fs.mkdirSync(embeddedDir, { recursive: true });
  fs.writeFileSync(path.join(embeddedDir, EMBEDDED_CONTENT_FILE), JSON.stringify(content, null, 2) + '\n');
  fs.writeFileSync(path.join(embeddedDir, EMBEDDED_DOCS_FILE), JSON.stringify(docs, null, 2) + '\n');
}

/**
 * The one page that says what to change and where — DERIVED from the artefact
 * that was just written, never typed, for the reason `tpl001Template.ts` gives:
 * a note listing four marked nodes when the template ships five is where the
 * next person stops looking.
 */
function writeStartHere(output: string): void {
  const marked = collectEditMarkers(output, EDIT);
  if (marked.length === 0) {
    throw new Error(`refusing to write: no \`${EDIT.trim()}\` node found in the artefact, so the convention is either gone or unreadable`);
  }
  const address = marked.find((m) => m.text === PLACEHOLDER_ADDRESS);
  if (!address) {
    throw new Error('refusing to write: the address the form sends to is not marked, and it is the one string that MUST be changed');
  }

  const byComponent = new Map<string, typeof marked>();
  for (const m of marked) {
    const list = byComponent.get(m.component) ?? [];
    list.push(m);
    byComponent.set(m.component, list);
  }
  /**
   * 🔴 **A row has to survive being a table cell, and TPL-004 broke that.**
   *
   * Until the work list and the two quote lists arrived, every marked node's
   * words were one short line. A `Static Data` node's words are a formatted JSON
   * document: dropped into a markdown cell verbatim it ends the table at the
   * first newline and prints the rest as loose text, so the note stops being
   * readable exactly where it starts describing the biggest thing a person
   * edits. A list is summarised by what it IS — how many rows, and what a row
   * carries — because the rows themselves are in the node and the note's job is
   * to send somebody to it.
   */
  const cell = (text: string): string => {
    const listMatch = /json:\s*(\[[\s\S]*)$/.exec(text);
    if (listMatch) {
      try {
        const rows = JSON.parse(listMatch[1]) as Array<Record<string, unknown>>;
        const fields = Object.keys(rows[0] ?? {}).join(', ');
        return `a list of **${rows.length} rows** — open the node and edit them there. Each row has: ${fields}`;
      } catch {
        // Fall through: an unparseable list is still better flattened than
        // printed across four lines of a table.
      }
    }
    return text.replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|');
  };

  const sections = [...byComponent.entries()]
    .map(
      ([component, rows]) =>
        `### \`${component}\`\n\n| node | what it says today |\n|---|---|\n` +
        rows.map((m) => `| **${m.label}** | ${cell(m.text)} |`).join('\n')
    )
    .join('\n\n');

  const body = `---
title: Start here
inject: pull
when: copy, text, editing, landing page, contact form, email address, which page, delete, start page
---

# Start here

Three landing pages ship in this project, each a complete site of a different
kind. **Keep one, delete the other two, change the words, publish.** There is no
backend to set up: the contact form opens the visitor's own mail app with the
message written and addressed to you.

## 1. Pick a look

The strip across the top of every page flicks between the three:

| page | route | for |
|---|---|---|
| \`Pages/Freelancer\` | \`/\` | one person selling a skill — services that open, work you can filter, a story behind each piece |
| \`Pages/Business\` | \`/business\` | a place people visit — a photograph, what it sells, where it is, when it opens |
| \`Pages/Launch\` | \`/launch\` | something that does not exist yet — the promise, how it works, the price two ways, the questions |

When you have chosen: delete the two page components you do not want, and if
the one you kept is not \`Pages/Freelancer\`, open the **App** component, select
the **Main** router and make your page the start page with an empty URL path.
Then delete \`Site/Switcher\` — the strip is for choosing, not for visitors.

## 2. The parts of it that move

These pages are not a printed flyer. Before you change anything, click on them:

- **The three links at the top of every page** scroll to a section, and the
  header stays with you. Their words and their destinations are set on the
  **header instance** on each page — \`nav1\`/\`nav1Target\` and so on. A destination
  is a **class name** that the section itself carries, so if you rename one you
  must rename both. (\`Site/ScrollTo\` is the one node that does the scrolling.)
- **The services, the things a business sells, and the questions** open when you
  click them. Each is one \`States\` node named *Closed / open* inside its own
  component — \`Site/ServiceCard\`, \`Site/PhotoCard\`, \`Site/FaqRow\`.
- **The freelancer's work is a list**, not three cards: one \`Static Data\` node
  holds every piece, the pills above it filter on the \`category\` field, and
  clicking a card opens \`Site/CaseStudy\` over the page. 🔴 **A pill's \`value\`
  must be one of the \`category\` strings in that list**, exactly, or it filters
  to nothing.
- **The kind words step one at a time** (\`Site/QuoteCarousel\`), from a list of
  their own on each page. Add a row and the *n of m* keeps up on its own.
- **The launch page's price switches** between monthly and yearly. Both prices
  and the line under them live on the one \`States\` node marked *EDIT — the two
  prices*.
- **The form will not send until it can.** Send stays dim until there is a name,
  an address that could receive a reply and twenty characters of message; the
  line under it says what is still missing.

## 3. The address the form sends to — change this first

\`Site/Contact\` has one node named **${address.label}**. It says
\`${PLACEHOLDER_ADDRESS}\` today. Put your own address in it; the form and the
line beside the form both read from that one node.

## 4. Everything else that is yours to write

No business, client or number on these pages is invented. Every string you have
to replace is written in the shape of the thing it stands for and its node is
named with an **\`EDIT —\`** prefix, so the editor's node tree lists them. Search
the tree for \`EDIT\` and the tables below are what you will find. Change the
text, or delete the node if it does not apply to you.

${sections}

---

*This file is generated from the template itself — the tables above are read out
of the shipped graph rather than typed, so they cannot describe a node that is
not there.*
`;

  const docsDir = path.join(output, path.dirname(START_HERE_FILE));
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(output, START_HERE_FILE), body);
}
