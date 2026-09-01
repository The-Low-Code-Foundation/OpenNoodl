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
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { LegacyProject } from '../../noodl-editor/src/editor/src/io/ProjectExporter';
import { createServer } from '../src/server';

import { readAsLegacyProject } from './sb007Template';
import { TPL001_CLOUD_COMPONENTS } from './tpl001Cloud';
import { TPL002_CLOUD_COMPONENTS } from './tpl002Cloud';
import { APP_NODES, APP_WIRES, TPL001_COMPONENTS, createPass } from './tpl001Components';
import { TPL001_PRESET, TPL001_TOKENS } from './tpl001Theme';

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
  /**
   * Every non-error diagnostic the door raised, by component.
   *
   * 🔴 **Without this, "the authoring run was clean" is a claim about the
   * `isError` flag and nothing else.** A `warning` that does not reach `isError`
   * is a check that fired, decided something was wrong, and was thrown away by
   * the caller — and this template's graphs are full of ports the door
   * *cannot* verify (`dynamic-port-skipped`: "unverified by that check rather
   * than verified as correct"). Reporting what it did say is the only way the
   * silence is evidence rather than an absence nobody looked at.
   */
  diagnostics: Array<{ component: string; code: string; severity: string; message: string }>;
  /**
   * Node ids the door had to move, by component.
   *
   * 🔴 **The door DOES report this and the first caller here threw it away.** Ids
   * are de-duplicated project-wide, so a second component reusing `emptyState`
   * is written as `emptyState-2` — and `create_component` says so, in
   * `remappedNodeIds`/`remapNote`, precisely because *"a caller that intends a
   * follow-up `update_component` keyed on the id it just sent needs to know the
   * id changed"*. Two assertions were written against authored ids and failed on
   * the artefact before this was collected. The absence was in the caller, not
   * in the door.
   */
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
        // REL-002a — `bodyScroll: true`, and it is not cosmetic. Without it the viewer pins the
        // app to the viewport under `overflow: clip` and nothing below the fold can be reached:
        // measured on this very template at 988x313, `/setup` had 0 of its 7 controls clickable
        // and `/join` 0 of 6, submit buttons included.
        settings: { htmlTitle: TEMPLATE_PROJECT_NAME, navigationPathType: 'path', bodyScroll: true },
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
 * 2. **The cloud half.** No ordering constraint of its own — a `CloudFunction2`
 *    names its endpoint by string, so nothing in the browser half resolves
 *    against these components — but a reader meets the endpoints before the
 *    screens that call them, and an authoring failure surfaces on the graphs
 *    that carry the security model rather than eight pages later.
 * 3. **The parts, then the pages, in `TPL001_COMPONENTS` order.** The rows come
 *    before the pages that place them because `For Each.template` IS checked at
 *    the door; the first *page* written wins `startPage`, and for this template
 *    that must be the landing page.
 * 4. **The deferred pass.** Pages that link to each other are a genuine cycle;
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
  // DEF-009 — seed the hand-authored policy BEFORE authoring, not only into the
  // artefact afterwards: the door now reads `nodegx.security.json` to judge a
  // public write door's rate limit, and validating the template's components in
  // a project that lacks the policy reports `public-write-door-unlimited` on
  // three functions the policy really does limit. An installed project has the
  // file beside the components, so the build should too — the diagnostics this
  // build records are otherwise about a project that never ships.
  const policySource = path.join(__dirname, '..', '..', '..', 'templates', `${TEMPLATE_ID}.security.json`);
  if (fs.existsSync(policySource)) fs.copyFileSync(policySource, path.join(dir, POLICY_FILE));

  const { server } = createServer({ projectDir: dir, allowWrites: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'tpl001-template', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const order: string[] = [];
  const registrations: AuthoredTemplate['registrations'] = {};
  const diagnostics: AuthoredTemplate['diagnostics'] = [];
  const remaps: AuthoredTemplate['remaps'] = [];

  const call = async (name: string, args: Record<string, unknown>, label: string): Promise<unknown> => {
    const res = (await client.callTool({ name, arguments: args })) as ToolResult;
    // A rejection here is evidence, not a mystery — print what the door said.
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

  // ── The look, first, and through the same door as everything else ──────────
  //
  // 🔴 This is the whole of phase 78's appearance fix at the project level, and
  // it is two calls that already existed. `set_style_preset` and
  // `set_project_tokens` are shipped write tools; the wizard offers the same
  // presets to a person creating a project (`ProjectsPage.tsx:109,1614`). A
  // human got a look and a generated template did not, purely because the
  // generator never called them.
  //
  // ⚠️ Order matters and it is the reason these are two calls rather than one:
  // the preset writes the base overrides, and `upsertTokens` MERGES by name, so
  // the template's own tokens have to land second or Enterprise's navy would win.
  //
  // ⚠️ Preset first also means Modern could never be used here: its override map
  // is empty by construction (`ModernPreset.ts`: "Modern IS the defaults"), so
  // `set_style_preset('modern')` CLEARS the block rather than writing one — see
  // `styleTools.ts`'s `entries.length === 0` branch. A preset that writes
  // nothing looks identical to a preset that was never applied.
  // 🔴 **And the style tools are DEFERRED, which is part of why generators miss
  // them.** `applyPolicy({ deferTools })` hides the `theme` group behind
  // `find_tools`, so `set_style_preset` answers *"Tool set_style_preset
  // disabled"* on a server that has registered it. Revealed here by GROUP rather
  // than by free text on purpose: `find_tools`'s `query` matches tool NAMES
  // (`name.toLowerCase().includes(needle)`), so "theme", "design" and "colour"
  // all reveal nothing while naming a group called Design tokens.
  await call('find_tools', { group: 'theme' }, 'theme:reveal');
  await call('set_style_preset', { preset_id: TPL001_PRESET }, 'theme:preset');
  await call('set_project_tokens', { tokens: [...TPL001_TOKENS] }, 'theme:tokens');

  if (!options.omitApp) await create(APP_COMPONENT, APP_NODES, APP_WIRES);

  // 🔴 TPL-002's four are authored in the same pass and not a second one. A
  // `CloudFunction2` names its endpoint by STRING, so there is no ordering
  // constraint between any of the eight — but a page that calls one of them
  // must not be written before the function exists on disk, and the browser
  // components come after both loops.
  for (const c of [...TPL001_CLOUD_COMPONENTS, ...TPL002_CLOUD_COMPONENTS]) {
    await create(c.path, c.nodes, c.connections);
  }

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

  return { project: readAsLegacyProject(dir), order, registrations, projectDir: dir, diagnostics, remaps };
}

// ── Preparing the directory a person is handed ───────────────────────────────

/**
 * 🔴 **Three fields per component would make every run differ, so they are FIXED.**
 *
 * `toTemplateContent` (the site builder's, for an embedded template) DROPS `id`,
 * `created` and `modifiedBy`, and says why: *"dropping them is what makes the
 * artefact comparable to a fresh run at all… the drift gate would have to
 * compare SOME of the artefact, which is the check that passes while the thing
 * it guards rots."*
 *
 * A project directory cannot drop them — the v2 component schema carries them —
 * so this does the other half of the same idea and **pins** them. Everything
 * else is left exactly as the door wrote it: the point of generating through the
 * door is that the artefact IS the door's output, and a normaliser that reached
 * further would start being a second author.
 *
 * ⚠️ **It lives here rather than in `scripts/` because the drift gate has to run
 * it.** A gate that regenerated the components but not the artefact would be
 * comparing something the generator does not produce — and the pinning is
 * exactly where the last defect was (the id is written in THREE files, found by
 * regenerating twice and diffing).
 */
export const TEMPLATE_EPOCH = '2026-08-28T00:00:00.000Z';

/** The file the hand-authored policy lands as, inside the artefact. */
export const POLICY_FILE = 'nodegx.security.json';

/** A stable UUID-shaped id for a component, derived from its path alone. */
export function stableId(componentPath: string): string {
  const h = createHash('sha1').update(`tpl001:${componentPath}`).digest('hex');
  // UUIDv5 layout: version nibble 5, variant nibble 8.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Pin every per-run field in one component's directory.
 *
 * 🔴 **The id is written in THREE files, not one.** `component.json` carries
 * `id`; `nodes.json` and `connections.json` each carry a `componentId` naming
 * the same component. Pinning only the first left the other two fresh per run —
 * found by regenerating twice and diffing, which is the only reason this
 * function is correct rather than merely plausible.
 */
function pinComponentDirectory(dir: string): void {
  const componentFile = path.join(dir, 'component.json');
  const doc = JSON.parse(fs.readFileSync(componentFile, 'utf-8')) as Record<string, unknown>;
  const id = stableId(String(doc.path));

  doc.id = id;
  doc.created = TEMPLATE_EPOCH;
  doc.modified = TEMPLATE_EPOCH;
  fs.writeFileSync(componentFile, `${JSON.stringify(doc, null, 2)}\n`);

  for (const name of ['nodes.json', 'connections.json']) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    const sidecar = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    if ('componentId' in sidecar) sidecar.componentId = id;
    fs.writeFileSync(file, `${JSON.stringify(sidecar, null, 2)}\n`);
  }
}

function pinComponentFiles(dir: string): void {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      stack.push(path.join(current, entry.name));
    }
    if (fs.existsSync(path.join(current, 'component.json'))) pinComponentDirectory(current);
  }
}

/**
 * The registry keeps its OWN `created`/`modified` per component, beside the
 * top-level `lastUpdated`. Same run-twice finding.
 */
function pinRegistry(dir: string): void {
  const file = path.join(dir, 'components', '_registry.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    lastUpdated?: string;
    components?: Record<string, Record<string, unknown>>;
  };
  doc.lastUpdated = TEMPLATE_EPOCH;
  for (const row of Object.values(doc.components ?? {})) {
    if ('created' in row) row.created = TEMPLATE_EPOCH;
    if ('modified' in row) row.modified = TEMPLATE_EPOCH;
  }
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
}

function copyTree(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

/**
 * Turn an authored project directory into the artefact a person is handed.
 *
 * @param built the result of {@link buildMembersTemplateProject}
 * @param output where the artefact goes — cleared first, so it is the door's
 *   output and nothing that survived from a previous shape
 * @param policySource the hand-authored `nodegx.security.json`, copied in last
 */
export function prepareArtefact(built: AuthoredTemplate, output: string, policySource: string): void {
  // 🔴 The guard `generate-site-template.ts` carries, for the same reason: a
  // page written before its router exists is written, reported green, and never
  // routed — `pageRegistration.ts` states that a project with no router is not
  // an error. An artefact with an empty registration map is an app that opens on
  // nothing, and it must not be possible to ship one by accident.
  if (Object.keys(built.registrations).length === 0) {
    throw new Error('refusing to write: no page registered into a router — the app would open on nothing');
  }

  pinComponentFiles(built.projectDir);
  pinRegistry(built.projectDir);

  // ⚠️ Replaced wholesale rather than merged: the door's output IS the artefact,
  // so a file surviving here that the door no longer writes would be a component
  // nothing generates and nothing gates. Guarded on the path so a mistyped
  // output directory cannot delete something else.
  if (path.basename(output) !== TEMPLATE_ID) throw new Error(`refusing to clear ${output}`);
  fs.rmSync(output, { recursive: true, force: true });
  copyTree(built.projectDir, output);

  // 🔴 The policy IS the product here, so an artefact without one must not be
  // writable by accident. This refuses rather than warns: a members' area
  // provisioned onto `defaultSecurityConfig()` has `authenticated` collection
  // defaults, which is every pending member reading everything.
  if (!fs.existsSync(policySource)) {
    throw new Error(`refusing to write: the hand-authored policy ${policySource} is missing`);
  }
  fs.copyFileSync(policySource, path.join(output, POLICY_FILE));

  writeStartHere(output);
  pinRootNode(output);
}

/** Where the note lands. `docs/` is the editor's own folder for prose a person reads. */
export const START_HERE_FILE = 'docs/START-HERE.md';

/**
 * §E-iii — **the one page that says what to change and where, and it is DERIVED
 * rather than written.**
 *
 * Richard's §E ruling asked for three things and this is the third: *"make it
 * obvious how to edit the texts and which ones need to be edited, so the user
 * doesn't accidentally publish with some generic web dev copy on some page they
 * forgot"*. §E-i answers most of it by making the copy DATA — there is nothing to
 * forget on a page you never have to visit. §E-ii marks what genuinely cannot be
 * data with an `EDIT — ` node label. This is the note that points at both.
 *
 * 🔴 **The list of marked strings is read out of the artefact that was just
 * written, never typed here.** A hand-written list is the failure mode
 * `USED_COMPOSITIONS` already had in this repository: it claimed to be enforced,
 * nothing read it, and two of its thirteen entries named things that did not
 * exist. A note listing four `EDIT —` nodes when the template ships five is
 * worse than no note, because it is where the next person stops looking.
 *
 * ⚠️ **`docs/`, not a page component, and the difference is who can see it.** A
 * `/start-here` route would be a public URL on a deployed members' area — a page
 * telling strangers which parts of the site are unfinished. `docs/` is the
 * editor's folder for prose (`docsText.ts`: *"Never inside `.noodl*` — humans
 * read these"*), it travels with the bundle because `readBundleDirectory` walks
 * the whole tree, and it is never served.
 *
 * ⚠️ **Front matter is `inject: pull`, which is the default anyway, and it is
 * written out rather than left off.** An absent block means "take the default
 * for this path" — a decision nobody made. `always` would append this note to
 * every turn of every AI session in a project that has long since been set up.
 */
function writeStartHere(output: string): void {
  const componentsDir = path.join(output, 'components');
  const marked: Array<{ component: string; label: string; text: string }> = [];

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name !== 'nodes.json') continue;
      const component = path.relative(componentsDir, path.dirname(full)).split(path.sep).join('/');
      const parsed = JSON.parse(fs.readFileSync(full, 'utf-8')) as {
        nodes?: Array<{ label?: string; parameters?: Record<string, unknown> }>;
      };
      for (const node of parsed.nodes ?? []) {
        // The marker is the LABEL, because that is what the editor's node tree
        // draws — §E-ii's whole mechanism is that a person scrolling the tree
        // sees them without knowing to look.
        if (typeof node.label === 'string' && node.label.startsWith('EDIT \u2014 ')) {
          marked.push({ component, label: node.label, text: String(node.parameters?.text ?? '') });
        }
      }
    }
  };
  walk(componentsDir);

  // 🔴 Beside a known-firing signal, and it REFUSES rather than warns. An empty
  // list here has two causes that look identical in the output — the convention
  // was dropped, or the walk stopped finding it (a renamed file, an em dash that
  // became a hyphen) — and both ship a note whose central section is blank.
  if (marked.length === 0) {
    throw new Error('refusing to write: no `EDIT \u2014 ` node found in the artefact, so \u00a7E-ii\u2019s convention is either gone or unreadable');
  }
  marked.sort((a, b) => (a.component + a.label).localeCompare(b.component + b.label));

  const rows = marked.map((m) => `| \`${m.component}\` | **${m.label}** | ${m.text} |`).join('\n');
  const body = `---
title: Start here
inject: pull
when: copy, text, editing, setup, association name, placeholder
---

# Start here

This members' area is ready to run. There are exactly **two** places its words
come from, and this note is the whole list.

## 1. Almost all of the copy is DATA, so there is nothing to edit

Open the site and go to **/setup**. That form asks for the association's name, a
one-line tagline and a paragraph about the association, and the pages read all
three from the record: the landing hero shows the name and the tagline, the
"About us" band below it shows the paragraph, and the band across the top of
every signed-in page shows the name.

**You do not need to open the editor to change any of them.** Sign in as the
moderator and run \`/setup\` again on a fresh install, or edit the \`Association\`
row in your backend.

You will also need the setup token, which is a **backend secret** called
\`ASSOCIATION_SETUP_TOKEN\` — it lives in your backend's configuration, never in
this project, so that every association that installs this template does not
share one.

## 2. The strings that could not be data are marked \`EDIT —\`

These are the ones with nowhere to live but the graph. Every one of them is
written to look unfinished on purpose, and every one is **named with an
\`EDIT —\` prefix so the editor's node tree lists them**. Search the tree for
\`EDIT\` and this table is what you will find.

| component | node | what it says today |
|---|---|---|
${rows}

Change the text, or delete the node if it does not apply to you.

---

*This file is generated from the template itself — the table above is read out of
the shipped graph rather than typed, so it cannot describe a node that is not
there.*
`;

  const docsDir = path.join(output, path.dirname(START_HERE_FILE));
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(output, START_HERE_FILE), body);
}

/**
 * 🔴 **Record which node is the app's HOME, or the editor previews an error.**
 *
 * Found by opening the artefact as a project and pressing preview: the viewer
 * rendered *"ERROR — No HOME component selected"* instead of the landing page.
 * `ProjectModel.fromJSON` resolves the home from `rootNodeId`, and the skeleton
 * this generator writes has no such field, so `rootNode` stayed undefined and
 * every screen behind it was unreachable — on the first thing a person does
 * after picking the template.
 *
 * ⚠️ **The control that made it a defect rather than a guess**: the only other
 * template in the repository, `site-builder.content.json`, carries
 * `rootComponent: '/App'`. Same mechanism, one arm sets it and one did not, and
 * the arm that did not is the one that errors.
 *
 * 🔴 **`rootNodeId`, NOT `rootComponent`.** `rootComponent` is the LEGACY
 * spelling — `import-engine/legacy/assess.ts` reports it as a field it rewrites
 * on load — and `project-v2.schema.json` sets `additionalProperties: false`, so
 * a v2 project file carrying it is not a project file that validates.
 * `fromJSON` accepts it only as a fallback for templates it is upgrading.
 *
 * ⚠️ **Derived from the artefact, never typed.** The door de-duplicates node ids
 * project-wide, so `app_root` is `app_root` only because `App` is written first
 * and nothing claims it earlier. Reading the root back out of the file that was
 * actually written is what keeps this true if that ever changes.
 */
function pinRootNode(output: string): void {
  const appNodes = path.join(output, 'components', APP_COMPONENT, 'nodes.json');
  const nodes = (JSON.parse(fs.readFileSync(appNodes, 'utf-8')) as { nodes?: Array<{ id: string; parent?: string }> })
    .nodes;
  const root = (nodes ?? []).find((n) => !n.parent);
  if (!root) throw new Error(`refusing to write: ${APP_COMPONENT} has no root node to be the app's home`);

  const projectFile = path.join(output, 'nodegx.project.json');
  const project = JSON.parse(fs.readFileSync(projectFile, 'utf-8')) as Record<string, unknown>;
  project.rootNodeId = root.id;
  fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
}
