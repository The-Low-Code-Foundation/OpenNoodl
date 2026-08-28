/**
 * TPL-001 — the members' area as a project a person can start from.
 *
 * `tpl001Components.ts` is the arguments the door is given; this file is the
 * composition. It authors them into an empty project and hands back the legacy
 * project a template ships.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## Why this template is PREPARED rather than EMBEDDED
 *
 * `site-builder` is compiled into the editor and reached as `embedded://`. This
 * one is not, and the difference is phase 78's delivery decision rather than a
 * detail: `shareAsTemplate` files a **submission** and publishes nothing, and
 * the platform's `readBundleDirectory` *"skips nothing silently… an operator
 * points it at a directory they prepared."* So the artefact here is **a project
 * directory**, and Richard is the operator.
 *
 * Two things follow, both of which are why the decision was worth making:
 *
 * - The curated shelf is **served**, so a published template reaches everyone
 *   already on 0.2.0 with no app update.
 * - It touches **no editor source** — not `EmbeddedTemplateProvider.ts`, not
 *   `ProjectTemplate.ts` — so phase 78 cannot collide with P77, which is editing
 *   both.
 *
 * ## What is imported and what is copied, and why that split
 *
 * `readAsLegacyProject` is **imported** from `sb007Template.ts`: it is the
 * mechanism (the editor's own `ProjectImporter`, driven the way a template
 * generator must drive it), and a second copy would agree with the original
 * until the first edit that reached one of them.
 *
 * `writeSkeleton` is **copied**, because it is not exported — and exporting it
 * would mean editing `sb007Template.ts`, which is P77's file while SBR-004 is
 * live. A fixture of the project file format is the safer thing to duplicate
 * than a reader; if this template outlives the phase overlap, the two should
 * become one function.
 *
 * @module noodl-mcp/tests/tpl001Template
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { LegacyProject } from '../../noodl-editor/src/editor/src/io/ProjectExporter';
import { createServer } from '../src/server';

import { readAsLegacyProject } from './sb007Template';
import { APP_NODES, APP_WIRES, TPL001_COMPONENTS, createPass } from './tpl001Components';

/** The template's id and the directory name it is prepared into. */
export const TEMPLATE_ID = 'members-area';

/** The name the project carries before the wizard renames it. */
export const TEMPLATE_PROJECT_NAME = "Members' Area";

/** The root component: the one the Router lives in and the editor opens on. */
export const APP_COMPONENT = 'App';

interface ToolResult {
  isError?: boolean;
  content?: Array<{ type: string; text: string }>;
}

/** What one authoring run reports back, so a caller can assert on it. */
export interface AuthoredTemplate {
  project: LegacyProject;
  order: string[];
  /**
   * The router registration the door reported per page write. 🔴 **A page whose
   * write reported nothing is ABSENT from this map** — `pageRegistration.ts`
   * states that a project with no router is not an error, so a page written
   * before the router exists is written, reported green, and never routed. The
   * absence is not a diagnostic; it is a key that is not in the payload.
   */
  registrations: Record<string, { router: string; added: string[]; startPage?: string }>;
  projectDir: string;
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
        settings: { htmlTitle: TEMPLATE_PROJECT_NAME, navigationPathType: 'path' },
        structure: { componentsDir: 'components', assetsDir: 'assets' }
      },
      null,
      2
    )
  );
  // ⚠️ `components` is an OBJECT keyed by registry path. Written as `[]` the
  // store reads it as empty and never says otherwise, and the first component
  // naming a sibling is refused against a project the door believes is empty.
  fs.writeFileSync(
    path.join(dir, 'components', '_registry.json'),
    JSON.stringify(
      {
        $schema: 'https://opennoodl.dev/schemas/registry-v2.json',
        version: 1,
        lastUpdated: '2026-08-28T00:00:00.000Z',
        components: {},
        stats: { totalComponents: 0, totalNodes: 0, totalConnections: 0 }
      },
      null,
      2
    )
  );
}

/**
 * Author the whole template into a fresh directory and read it back.
 *
 * `createServer` from `src` and not the built dist — SB-004 §6 F4: the dist on
 * this machine is days old and the bound servers run it, so authoring through it
 * would exercise code that is not the code under test.
 *
 * ## The order
 *
 * 1. **`App` first.** Every page written after it registers into its router.
 * 2. **Pages, in `TPL001_COMPONENTS` order** — the first one written wins
 *    `startPage`, and for this template that must be the landing page.
 * 3. **The deferred pass.** Pages that link to each other are a genuine cycle;
 *    the create pass omits those wires and an `update_component` restores them.
 */
export interface BuildOptions {
  /**
   * Author everything **except** the `App` shell.
   *
   * 🔴 Holds one arm and nothing else: the only way to show that a missing
   * router is *why* nothing registers, rather than one of the other reasons a
   * `registeredPages` key can be absent. Never true for anything that ships —
   * the generator refuses to write an artefact whose registration map is empty.
   */
  omitApp?: boolean;
}

export async function buildMembersTemplateProject(options: BuildOptions = {}): Promise<AuthoredTemplate> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl001-template-'));
  writeSkeleton(dir);

  const { server } = createServer({ projectDir: dir, allowWrites: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'tpl001-template', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const order: string[] = [];
  const registrations: AuthoredTemplate['registrations'] = {};

  const call = async (name: string, args: Record<string, unknown>, label: string): Promise<unknown> => {
    const res = (await client.callTool({ name, arguments: args })) as ToolResult;
    // A rejection here is evidence, not a mystery — print what the door said.
    if (res.isError) throw new Error(`${name} ${label} refused:\n${res.content?.[0]?.text}`);
    try {
      return JSON.parse(res.content?.[0]?.text ?? '{}');
    } catch {
      return {};
    }
  };

  const create = async (key: string, nodes: unknown[], connections: unknown[]): Promise<void> => {
    const payload = (await call('create_component', { path: key, nodes, connections }, key)) as {
      registeredPages?: { router: string; added: string[]; startPage?: string };
    };
    order.push(key);
    if (payload.registeredPages) registrations[key] = payload.registeredPages;
  };

  if (!options.omitApp) await create(APP_COMPONENT, APP_NODES, APP_WIRES);

  for (const c of TPL001_COMPONENTS) {
    const payload = createPass(c);
    await create(c.path, payload.nodes, payload.connections);
  }
  for (const c of TPL001_COMPONENTS) {
    if (!c.deferred?.length) continue;
    await call('update_component', { path: c.path, set: { nodes: c.nodes, connections: c.connections } }, c.path);
  }

  await client.close();
  await server.close();

  return { project: readAsLegacyProject(dir), order, registrations, projectDir: dir };
}
