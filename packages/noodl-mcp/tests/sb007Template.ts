/**
 * SB-007 — the site builder as a project a person can start from.
 *
 * The other three `sb00*Components.ts` files are the arguments the MCP door is
 * given. This one is the *composition*: it authors all eighteen of them into one
 * empty project, adds the one component none of them contains, and hands back
 * the legacy `project.json` an embedded template ships.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## 🔴 The component five sessions never authored
 *
 * SB-004/005/006 each author their own components and every one of those runs
 * started from `tests/fixtures/demo-app`, which already contains an `App`
 * component holding a `Router` named `Main`. Nothing in the three sets writes
 * one, and `ROUTER = 'Main'` in `sb005Components.ts` is a reference to the
 * fixture's node.
 *
 * That matters because of what the door does when the router is missing.
 * `pageRegistration.ts` states it outright — *"A project with no router is not an
 * error"* — so `create_component` writes a page, reports success, and returns a
 * response with **no `registeredPages` field at all**. Measured here on a clean
 * skeleton: six pages written, six green results, `nodegx.project.json`
 * untouched, and an app that opens on nothing. The absence is not a diagnostic;
 * it is a key that is not in the payload.
 *
 * So `APP_NODES` below is part of the template's product, not scaffolding, and
 * it is authored **through the same door** as everything else rather than
 * hand-written into the emitted project — otherwise the one component the site
 * cannot run without would be the only one no gate ever saw.
 *
 * ## Why the pages list is read rather than written
 *
 * `buildSiteTemplateProject` never states the router's `pages`. It authors the
 * App first with a `Router` carrying only its `name`, and every subsequent page
 * write registers itself through `registerPages`. What ends up on disk is
 * therefore the door's own registration — including which page becomes
 * `startPage`, which is SB-006 F17's rule (*the first page written wins*) and
 * the reason the site is authored before the panel here exactly as it is in
 * `sb008-public-site-drive.test.ts`.
 *
 * A template that typed its own `pages` list would be a twin of that mechanism
 * and would agree with it until the first component either side gained a page.
 *
 * ## What this does NOT ship, stated so it is not assumed
 *
 * 🔴 **The backend policy.** SB-004 §4's `security.json` — public read of
 * `Page`/`Section`, `role:admin` write, `ContactMessage` create `nobody` — is a
 * backend-side artefact written when a backend is provisioned. A template is a
 * project directory; it has no backend and cannot carry one. Everything this
 * template's publication boundary depends on therefore arrives from somewhere
 * this file cannot reach, which is filed as **SB-015** rather than rounded off.
 *
 * @module noodl-mcp/tests/sb007Template
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { ProjectImporter } from '../../noodl-editor/src/editor/src/io/ProjectImporter';
import { pinRunOnValueChangeDefaults } from '../../noodl-editor/src/editor/src/models/ProjectPatches/runOnValueChangeMigration';
import type { LegacyProject } from '../../noodl-editor/src/editor/src/io/ProjectExporter';
import { createServer } from '../src/server';

import { SB004_COMPONENTS } from './sb004Components';
import { ROUTER, SB005_COMPONENTS, createPass as createPass005 } from './sb005Components';
import { SB006_COMPONENTS, createPass as createPass006 } from './sb006Components';

/** The template's id, its `embedded://` slug, and the key in the provider map. */
export const TEMPLATE_ID = 'site-builder';

/** The name the project carries before the wizard renames it. */
export const TEMPLATE_PROJECT_NAME = 'Site Builder';

/** The root component: the one the Router lives in and the editor opens on. */
export const APP_COMPONENT = 'App';

/**
 * The app shell, in the flat shape `create_component` takes.
 *
 * 🔴 **The `Group` is load-bearing and its dimensions are written out.** A
 * `Router` sizes itself to its content, so at the root of an app on its own it
 * gives every page the height of whatever that page happens to contain — the
 * project opens as a strip a few pixels tall. `hello-world.template.ts` records
 * the same thing and the same fix.
 *
 * 🔴 **`sizeMode: 'explicit'` and `{ value, unit }`, not bare numbers.** SB-006
 * F15: the door reads a bare number on a dimension port as a **percentage**, and
 * refuses a dimension at all without `sizeMode`. `height: 100` would have been
 * 100% by luck rather than by statement.
 *
 * ⚠️ **`name: 'Main'` is a cross-file contract.** `sb005Components.ts` exports
 * `ROUTER = 'Main'` and eleven `RouterNavigate` nodes across both panels set
 * `router` to it. `RouterNavigate`'s ports are derived from the target router
 * (`dynamic-port-skipped` says so on every one of them), so a mismatch is not
 * checked anywhere at the door — it is a button that does nothing. Asserted
 * against `ROUTER` itself in `sb007Template.test.ts` rather than spelled twice.
 */
export const APP_NODES = [
  {
    id: 'app_root',
    type: 'Group',
    label: 'App',
    parameters: {
      sizeMode: 'explicit',
      width: { value: 100, unit: '%' },
      height: { value: 100, unit: '%' }
    },
    children: ['app_router']
  },
  {
    id: 'app_router',
    type: 'Router',
    label: 'Main router',
    parent: 'app_root',
    // 🔴 No `pages` here. The door registers every page it writes into this
    // node; stating a list would be a twin of that mechanism. See the header.
    parameters: { name: ROUTER }
  }
];

/** The shell has no wires — a Router needs none to route. */
export const APP_WIRES: unknown[] = [];

/** What one authoring run reports back, so a caller can assert on it. */
export interface AuthoredTemplate {
  /** The legacy project, exactly as `project.json` carries it. */
  project: LegacyProject;
  /** Registry keys in the order they were written. */
  order: string[];
  /**
   * The router registration the door reported for each page write, keyed by the
   * page's registry key. **A page whose write reported nothing is absent from
   * this map**, which is the only way to tell "registered" from "silently not".
   */
  registrations: Record<string, { router: string; added: string[]; startPage?: string }>;
  /** The project directory, for a caller that wants to read the v2 files too. */
  projectDir: string;
}

interface ToolResult {
  isError?: boolean;
  content?: Array<{ type: string; text: string }>;
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
        // 🔴 D40: `bodyScroll` is what decides whether `#root` is `overflow: clip;
        // position: fixed` (index.html) or a page that scrolls. Absent, the admin
        // panel and the public site are both frozen at one viewport: measured at
        // 1440x900 on the DEPLOYED artefact, `Save theme` sits at y=932 with
        // `scrollTop` pinned at 0, so a person on a laptop cannot save a theme or
        // reach 3 of 5 section `Save` buttons. `createProject.ts` writes it for
        // every new project for exactly this reason — "not a preference, it is
        // whether the app can be used" — and this template did not.
        settings: { htmlTitle: TEMPLATE_PROJECT_NAME, navigationPathType: 'path', bodyScroll: true },
        structure: { componentsDir: 'components', assetsDir: 'assets' }
      },
      null,
      2
    )
  );
  // ⚠️ `components` is an OBJECT keyed by registry path. Written as `[]` the
  // store reads it as empty and never says otherwise: the first component that
  // names a sibling is refused `repeater-template-unresolved` against a project
  // the door believes has nothing in it, and the refusal blames the reference.
  fs.writeFileSync(
    path.join(dir, 'components', '_registry.json'),
    JSON.stringify(
      {
        $schema: 'https://opennoodl.dev/schemas/registry-v2.json',
        version: 1,
        lastUpdated: '2026-08-26T00:00:00.000Z',
        components: {},
        stats: { totalComponents: 0, totalNodes: 0, totalConnections: 0 }
      },
      null,
      2
    )
  );
}

/**
 * Author the whole template into a fresh directory and read it back as a legacy
 * project.
 *
 * `createServer` from `src` and not the built dist, for SB-004 §6 F4's reason:
 * the dist on this machine is days old and the bound servers run it, so
 * authoring through it would exercise code that is not the code under test.
 *
 * ## The order, and why each step of it is where it is
 *
 *  1. **`App` first.** Every page write after it registers into its router. A
 *     page written before the router exists is written and unregistered, and
 *     nothing says so.
 *  2. **The site (SB-006) second.** F17 — the first page written becomes the
 *     start page, and a public site is what this app should open on. F14 — the
 *     site's catch-all `{slug}` ties with any one-segment sibling and the Router
 *     breaks the tie by the order its `pages` list names, so the site is named
 *     first there too.
 *  3. **The panel (SB-005) third**, under `admin/`.
 *  4. **The cloud half (SB-004) last.** It is reached over HTTP, registers
 *     nothing, and refers to no browser component.
 *
 * Within 2 and 3, the deferred second pass is SB-012's: a set of pages that link
 * to each other has genuine reference cycles and no topological order exists, so
 * the create pass omits the edge and an `update_component` restores it.
 */
export interface BuildOptions {
  /**
   * Author everything **except** the `App` shell.
   *
   * 🔴 This exists to hold one arm and nothing else: it is the only way to show
   * that the missing router is *why* nothing registers, rather than one of the
   * dozen other reasons a `registeredPages` key can be absent from a payload.
   * The arm and the shipped build differ in one component and in nothing else —
   * same skeleton, same order, same door. `sb007Template.test.ts` runs it beside
   * the real build, which is the control that makes it a measurement.
   *
   * ⚠️ Never true for anything that ships. `generate-site-template.ts` refuses to
   * write an artefact whose registration map is empty.
   */
  omitApp?: boolean;
}

export async function buildSiteTemplateProject(options: BuildOptions = {}): Promise<AuthoredTemplate> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb007-template-'));
  writeSkeleton(dir);

  const { server } = createServer({ projectDir: dir, allowWrites: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'sb007-template', version: '0.0.0' });
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

  for (const c of SB006_COMPONENTS) {
    const payload = createPass006(c);
    await create(c.path, payload.nodes, payload.connections);
  }
  for (const c of SB006_COMPONENTS) {
    if (!c.deferred?.length) continue;
    await call('update_component', { path: c.path, set: { nodes: c.nodes, connections: c.connections } }, c.path);
  }

  for (const c of SB005_COMPONENTS) {
    const payload = createPass005(c);
    await create(c.path, payload.nodes, payload.connections);
  }
  for (const c of SB005_COMPONENTS) {
    if (!c.deferred?.length) continue;
    await call('update_component', { path: c.path, set: { nodes: c.nodes, connections: c.connections } }, c.path);
  }

  for (const c of SB004_COMPONENTS) {
    await create(c.path, c.nodes, c.connections);
  }

  await client.close();
  await server.close();

  return { project: readAsLegacyProject(dir), order, registrations, projectDir: dir };
}

/**
 * The legacy project as a template's `content` — the shipped artefact.
 *
 * 🔴 **Three fields are dropped, and dropping them is what makes the artefact
 * comparable to a fresh run at all.** `created` is the wall-clock instant a temp
 * directory was written, `modifiedBy` is `"noodl-mcp"`, and a component `id` is
 * a UUID minted per write. All three differ on every regeneration, so a
 * committed file carrying them could never be diffed against what the door
 * writes today — the drift gate would have to compare *some* of the artefact,
 * which is the check that passes while the thing it guards rots.
 *
 * ⚠️ An id-less component is not a compromise: `reconstructLegacyComponent`'s
 * own comment says *"Many real/imported components are id-less — do not
 * fabricate an id key"*, and the model mints one on load.
 *
 * `rootComponent` is `/App` — the **legacy** name, which is what the components
 * array carries and therefore what `EmbeddedTemplateProvider.instantiateContent`
 * matches on when it resolves a concrete `rootNodeId`. Written as `App` it finds
 * nothing, silently, and the project opens with no home component.
 */
export function toTemplateContent(project: LegacyProject): Record<string, unknown> {
  const components = (project.components ?? []).map((component) => {
    const { id, created, modifiedBy, ...rest } = component as unknown as Record<string, unknown>;
    void id;
    void created;
    void modifiedBy;
    return rest;
  });

  const content = {
    name: TEMPLATE_PROJECT_NAME,
    version: project.version,
    rootComponent: `/${APP_COMPONENT}`,
    components,
    ...(project.settings ? { settings: project.settings } : {})
  };

  // DEF-007 §3.2 — write the explicit `runOnChange-*` values, so the artefact means the same
  // thing on disk as it does once the editor has loaded it.
  //
  // 🔴 Without this the two readings differ in 65 stored parameters across 13 components, and
  // `sb007Template.test.ts`'s byte gate cannot see it: that gate compares the committed artefact
  // to a fresh run of *this* generator, so a field neither side writes is a field both sides
  // agree about. The disagreement is with a *third* reader — `applyPatches`, which every editor
  // open runs and no generator does. DEF-007 §5 records the same gate passing over D9 this way.
  //
  // The value is `true` because that is what the file already means unloaded, and this template
  // was authored entirely after NDA-017 §2 — see `pinRunOnValueChangeDefaults`, which is where
  // the argument for `true` over the migration's `false` is written down.
  //
  // ⚠️ Mutates the graphs it was handed: the component spread above is shallow, so `graph` is
  // shared with `project`. Every caller passes a `readAsLegacyProject` result, which is a fresh
  // parse of a temp directory, so nothing observes it — but it is not a pure function.
  pinRunOnValueChangeDefaults(content);

  return content;
}

/**
 * The v2 directory as one legacy project, through **the editor's own reader**.
 *
 * `ProjectImporter` is pure — types and `ProjectExporter`'s types, nothing else,
 * no `ProjectModel`, no `NodeLibrary`, no Electron — which is what lets a plain
 * node process call the same class the editor calls when it opens a v2 project.
 *
 * ⚠️ It emits no component-level `ports` array, and that is correct rather than
 * a gap: v2 projects do not carry one either, and the editor derives a
 * component's interface from its `Component Inputs`/`Outputs` nodes when the
 * NodeLibrary loads. `authored-bundle.ts` derives ports by hand because the
 * *runtime* export shape does need them; a `project.json` does not.
 */
export function readAsLegacyProject(projectDir: string): LegacyProject {
  const read = <T>(...parts: string[]): T => JSON.parse(fs.readFileSync(path.join(projectDir, ...parts), 'utf-8')) as T;

  const registry = read<{ components: Record<string, { path: string }> }>('components', '_registry.json');
  const components: Record<string, { component: unknown; nodes: unknown; connections: unknown }> = {};

  for (const [key, row] of Object.entries(registry.components)) {
    components[key] = {
      component: read('components', row.path, 'component.json'),
      nodes: read('components', row.path, 'nodes.json'),
      connections: read('components', row.path, 'connections.json')
    };
  }

  const result = new ProjectImporter().import({
    project: read('nodegx.project.json'),
    registry: registry as never,
    components: components as never
  });

  if (result.warnings.length > 0) {
    throw new Error(`the importer could not reconstruct the project:\n  ${result.warnings.join('\n  ')}`);
  }

  return result.project;
}
