/**
 * TPL-003 — the landing pages ship as a prepared project, and the project is
 * the three pages.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * `tpl003Components.ts` is the graphs; this reads what a person actually gets,
 * `templates/landing-pages/`. The two populations differ where a template
 * breaks: the door checks a reference against what is on disk when the write
 * happens, and a shipped artefact is what is on disk afterwards.
 *
 * What the door does NOT check, and this file does:
 * - a wire or a parameter into a component-instance port (measured on TPL-001:
 *   a renamed instance port produced a run identical to the clean one);
 * - that the contact form's chain is the chain — `Send` reaches the composer,
 *   the composer reaches the link, and typing cannot open the mail app;
 * - that "no backend" is a property of the artefact and not of a sentence.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  APP_COMPONENT,
  CONTACT_CLASS,
  CONTACT_COMPONENT,
  EDIT,
  FIELD_COMPONENT,
  FOOTER_COMPONENT,
  HEADER_CLASS,
  HEADER_COMPONENT,
  MISSING_TEXT,
  PAGE_BUSINESS,
  PAGE_FREELANCER,
  PAGE_LAUNCH,
  PLACEHOLDER_ADDRESS,
  ROUTER,
  SCROLL_TO_COMPONENT,
  SENT_TEXT,
  SWITCHER_COMPONENT,
  TPL003_COMPONENTS
} from './tpl003Components';
import {
  buildLandingTemplateProject,
  EMBEDDED_CONTENT_FILE,
  EMBEDDED_DIR,
  EMBEDDED_DOCS_FILE,
  prepareLandingArtefact,
  START_HERE_FILE,
  TEMPLATE_ID,
  writeEmbeddedTemplate
} from './tpl003Template';
import { requestedCompositions, tpl003TokenEntries, USED_COMPOSITIONS } from './tpl003Theme';
import { collectEditMarkers } from './templatePins';

jest.setTimeout(600000);

/**
 * What the template declares, plus `App`. Derived so that adding a component is
 * one edit and not two, and so this number cannot be "fixed" by typing over it.
 */
const EXPECTED_COMPONENTS = TPL003_COMPONENTS.length + 1;

const REPO = path.join(__dirname, '..', '..', '..');
const ARTEFACT = path.join(REPO, 'templates', TEMPLATE_ID);
const STARTER_IMAGERY = path.join(REPO, 'packages', 'noodl-editor', 'src', 'assets', 'starter-project', 'noodl_modules', 'starter-imagery');
const REGENERATE = 'npm run template:landing';

// ── Reading the artefact off disk ────────────────────────────────────────────

interface StoredNode {
  id: string;
  type: string;
  label?: string;
  parent?: string;
  parameters?: Record<string, unknown>;
  children?: string[];
  ports?: Array<{ name: string; plug: string; type?: string }>;
}
interface StoredConnection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}
interface StoredComponent {
  key: string;
  legacyName: string;
  nodes: StoredNode[];
  connections: StoredConnection[];
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(dir, full));
    }
  };
  walk(dir);
  return out.sort();
}

function readShipped(): StoredComponent[] {
  const registry = JSON.parse(fs.readFileSync(path.join(ARTEFACT, 'components', '_registry.json'), 'utf-8')) as {
    components: Record<string, { path: string }>;
  };
  return Object.entries(registry.components).map(([key, row]) => {
    const dir = path.join(ARTEFACT, 'components', row.path);
    const nodes = (JSON.parse(fs.readFileSync(path.join(dir, 'nodes.json'), 'utf-8')) as { nodes: StoredNode[] }).nodes;
    const connections = (JSON.parse(fs.readFileSync(path.join(dir, 'connections.json'), 'utf-8')) as { connections: StoredConnection[] })
      .connections;
    return { key, legacyName: `/${row.path}`, nodes, connections };
  });
}

const shipped = readShipped();
const byName = (legacyName: string): StoredComponent => {
  const found = shipped.find((c) => c.legacyName === legacyName);
  if (!found) throw new Error(`${legacyName} is not in the artefact`);
  return found;
};
const pages = shipped.filter((c) => c.nodes.some((n) => n.type === 'Page'));
const PAGE_NAMES = [PAGE_FREELANCER, PAGE_BUSINESS, PAGE_LAUNCH];

/** A node's declared inputs, from its `Component Inputs`; its outputs, from `Component Outputs`. */
function declaredPorts(component: StoredComponent, plug: 'inputs' | 'outputs'): Set<string> {
  const type = plug === 'inputs' ? 'Component Inputs' : 'Component Outputs';
  return new Set(component.nodes.filter((n) => n.type === type).flatMap((n) => (n.ports ?? []).map((p) => p.name)));
}

/** Every visual node under a root, walked through `children` — containment, not a same-parent check. */
function descendants(component: StoredComponent, rootId: string): StoredNode[] {
  const byId = new Map(component.nodes.map((n) => [n.id, n]));
  const out: StoredNode[] = [];
  const stack = [...(byId.get(rootId)?.children ?? [])];
  while (stack.length) {
    const id = stack.pop() as string;
    const node = byId.get(id);
    if (!node) continue;
    out.push(node);
    stack.push(...(node.children ?? []));
  }
  return out;
}

// ── 1. The committed artefact is what the door writes today ──────────────────

describe('TPL-003 — the committed template is what the door writes today', () => {
  it('regenerating from the component sets reproduces every committed byte', async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl003-gate-'));
    const output = path.join(scratch, TEMPLATE_ID);
    try {
      const built = await buildLandingTemplateProject();
      prepareLandingArtefact(built, output);

      // 🔴 The EMBEDDED pair, from the same build — `embedded://landing-pages` is
      // what the wizard installs, so it is the artefact that must not drift.
      const embedded = path.join(scratch, 'embedded');
      writeEmbeddedTemplate(built, output, embedded);
      for (const name of [EMBEDDED_CONTENT_FILE, EMBEDDED_DOCS_FILE]) {
        const a = fs.readFileSync(path.join(EMBEDDED_DIR, name), 'utf-8');
        const b = fs.readFileSync(path.join(embedded, name), 'utf-8');
        if (a !== b) {
          const first = a.split('\n').findIndex((line, i) => line !== b.split('\n')[i]);
          throw new Error(`${name} is not what the build writes today (first difference at line ${first + 1}). Run \`${REGENERATE}\` and commit the result.`);
        }
      }

      const committed = filesUnder(ARTEFACT);
      const regenerated = filesUnder(output);
      expect(regenerated).toEqual(committed);

      const differing: string[] = [];
      for (const rel of committed) {
        if (!fs.readFileSync(path.join(ARTEFACT, rel)).equals(fs.readFileSync(path.join(output, rel)))) differing.push(rel);
      }
      if (differing.length > 0) {
        const rel = differing[0];
        const a = fs.readFileSync(path.join(ARTEFACT, rel), 'utf-8').split('\n');
        const b = fs.readFileSync(path.join(output, rel), 'utf-8').split('\n');
        const first = a.findIndex((line, i) => line !== b[i]);
        throw new Error(
          `templates/${TEMPLATE_ID} is not what the door writes today.\n` +
            `  ${differing.length} file(s) differ; first is ${rel} at line ${first + 1}:\n` +
            `    committed:    ${a[first]}\n    regenerated:  ${b[first]}\n` +
            `  If a component set changed on purpose, run \`${REGENERATE}\` and commit the result.`
        );
      }

      // 🔴 The door's own readings, kept where a person reads them. Every
      // WARNING it raised on the first build was fixed; a new one is a defect
      // in the template, not a number to bump.
      expect(built.diagnostics.filter((d) => d.severity !== 'info')).toEqual([]);
      // …and the filter above is not vacuous: the door does say things.
      expect(built.diagnostics.length).toBeGreaterThan(0);
      // No id was moved. A remap here would be two nodes in this fixture that
      // share an id by accident, and every assertion below keyed on the second
      // would read the first.
      expect(built.remaps).toEqual([]);
      expect(built.order).toHaveLength(TPL003_COMPONENTS.length + 1);
      expect(built.order[0]).toBe(APP_COMPONENT);
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });

  it('the embedded content is the same twenty-one components, settled, with the look in its metadata', () => {
    const content = JSON.parse(fs.readFileSync(path.join(EMBEDDED_DIR, EMBEDDED_CONTENT_FILE), 'utf-8')) as {
      rootComponent?: string;
      components?: Array<{ name: string }>;
      settings?: Record<string, unknown>;
      metadata?: { designTokens?: { customTokens?: unknown[] } };
    };
    expect(content.rootComponent).toBe(`/${APP_COMPONENT}`);
    // 🔴 Counted from what the template declares, not from a number typed here.
    // A literal that has to be bumped every time a component is added is a gate
    // that grades whoever remembered to bump it; `TPL003_COMPONENTS` is the thing
    // the number stands for, and it cannot be bumped without adding a component.
    expect(content.components).toHaveLength(EXPECTED_COMPONENTS);
    expect(content.components?.map((c) => c.name).sort()).toEqual(shipped.map((c) => c.legacyName).sort());
    expect(content.settings).toMatchObject({ bodyScroll: true, navigationPathType: 'path' });
    expect((content.metadata?.designTokens?.customTokens ?? []).length).toBeGreaterThan(20);
    const docs = JSON.parse(fs.readFileSync(path.join(EMBEDDED_DIR, EMBEDDED_DOCS_FILE), 'utf-8')) as Array<{ path: string; content: string }>;
    expect(docs.map((d) => d.path)).toEqual([START_HERE_FILE]);
    expect(docs[0].content).toBe(fs.readFileSync(path.join(ARTEFACT, START_HERE_FILE), 'utf-8'));
  });

  it('control: the comparison is over a real artefact — twenty-one components, a note, no policy', () => {
    const committed = filesUnder(ARTEFACT);
    // Each component is three files, plus the registry, the project file and the
    // note. 16 → 21 when the launch page was rebuilt (Check, MockRow, Mock,
    // BigStat, Plan); 21 → 23 at TPL-004 (ScrollTo, IsValidEmail).
    expect(committed.length).toBe(EXPECTED_COMPONENTS * 3 + 3);
    expect(shipped).toHaveLength(EXPECTED_COMPONENTS);
    expect(committed).toContain('nodegx.project.json');
    expect(committed).toContain(path.join('components', '_registry.json'));
    expect(committed).toContain(path.join('docs', 'START-HERE.md'));
    // 🔴 The one string that MUST change is named in the note.
    const note = fs.readFileSync(path.join(ARTEFACT, START_HERE_FILE), 'utf-8');
    expect(note).toContain(PLACEHOLDER_ADDRESS);
    expect(note).toContain('the address the form sends to');
  });
});

// ── 2. No backend, as a property of the artefact ─────────────────────────────

describe('TPL-003 — no backend, and the artefact says so', () => {
  const CLOUD_TYPES = new Set([
    'CloudFunction2',
    'DbCollection2',
    'DbModel2',
    'NewDbModelProperties',
    'SetDbModelProperties',
    'DeleteDbModelProperties',
    'SendEmail',
    'net.noodl.user.LogIn',
    'net.noodl.user.SignUp',
    'net.noodl.user.LogOut',
    'net.noodl.user.SetUserProperties'
  ]);

  it('ships no cloud component, no policy and no cloud-service binding', () => {
    expect(fs.existsSync(path.join(ARTEFACT, 'components', '__cloud__'))).toBe(false);
    expect(fs.existsSync(path.join(ARTEFACT, 'nodegx.security.json'))).toBe(false);
    const project = JSON.parse(fs.readFileSync(path.join(ARTEFACT, 'nodegx.project.json'), 'utf-8')) as { metadata?: Record<string, unknown> };
    expect(project.metadata && 'cloudservices' in project.metadata).toBeFalsy();
    expect(shipped.every((c) => !c.key.startsWith('__cloud__'))).toBe(true);
  });

  it('🔴 no node anywhere talks to a server', () => {
    const offenders = shipped.flatMap((c) => c.nodes.filter((n) => CLOUD_TYPES.has(n.type)).map((n) => `${c.legacyName} › ${n.id} (${n.type})`));
    expect(offenders).toEqual([]);
  });

  it('control: the deny list would catch one', () => {
    expect(CLOUD_TYPES.has('CloudFunction2')).toBe(true);
    // The types are real names the members' area ships, not invented spellings.
    const members = path.join(REPO, 'templates', 'members-area', 'components', '__cloud__');
    if (fs.existsSync(members)) {
      const any = fs
        .readdirSync(members)
        .map((d) => path.join(members, d, 'nodes.json'))
        .filter((f) => fs.existsSync(f))
        .flatMap((f) => (JSON.parse(fs.readFileSync(f, 'utf-8')) as { nodes: StoredNode[] }).nodes.map((n) => n.type));
      expect(any.some((t) => CLOUD_TYPES.has(t))).toBe(true);
    }
  });
});

// ── 3. The router, and the page a stranger meets ─────────────────────────────

describe('TPL-003 — the app has an entry point, and it is the freelancer page', () => {
  const app = byName(`/${APP_COMPONENT}`);
  const router = app.nodes.find((n) => n.type === 'Router') as StoredNode;
  const registered = router.parameters?.pages as { startPage: string; routes: string[] };

  it('ships an App holding exactly one Router, named what every navigate asks for', () => {
    expect(app.nodes.filter((n) => n.type === 'Router')).toHaveLength(1);
    expect(router.parameters?.name).toBe(ROUTER);
    const project = JSON.parse(fs.readFileSync(path.join(ARTEFACT, 'nodegx.project.json'), 'utf-8')) as { rootNodeId?: string };
    expect(project.rootNodeId).toBe(app.nodes.find((n) => !n.parent)?.id);
  });

  it('🔴 opens on the freelancer page at `/`, and routes exactly the three looks', () => {
    expect(registered.startPage).toBe(PAGE_FREELANCER);
    expect([...registered.routes].sort()).toEqual([...PAGE_NAMES].sort());
    expect(pages.map((p) => p.legacyName).sort()).toEqual([...PAGE_NAMES].sort());
  });

  it('every page carries one Page node, and the three paths are distinct', () => {
    const paths = pages.map((p) => {
      const pageNodes = p.nodes.filter((n) => n.type === 'Page');
      expect(pageNodes).toHaveLength(1);
      return String(pageNodes[0].parameters?.urlPath ?? '');
    });
    expect(new Set(paths).size).toBe(3);
    expect(paths).toContain('');
  });

  it('🔴 every RouterNavigate in the artefact targets a REGISTERED page', () => {
    const targets = shipped.flatMap((c) => c.nodes.filter((n) => n.type === 'RouterNavigate').map((n) => String(n.parameters?.target)));
    expect(targets.length).toBe(3);
    for (const t of targets) expect(registered.routes).toContain(t);
    // …and the switcher is where they live, with a way to each of the three.
    expect([...new Set(targets)].sort()).toEqual([...PAGE_NAMES].sort());
  });
});

// ── 4. Component-instance ports resolve, on disk ─────────────────────────────

describe('TPL-003 — component-instance ports resolve, on disk', () => {
  const instances = shipped.flatMap((c) => c.nodes.filter((n) => n.type.startsWith('/')).map((n) => ({ owner: c, node: n })));

  it('control: there are instances to grade, and the parts declare ports', () => {
    expect(instances.length).toBeGreaterThan(30);
    expect(declaredPorts(byName(CONTACT_COMPONENT), 'inputs')).toEqual(new Set(['heading', 'line', 'button']));
    // TPL-004: the header scrolls itself, so it publishes nothing and takes a nav.
    expect(declaredPorts(byName(HEADER_COMPONENT), 'outputs')).toEqual(new Set());
    expect(declaredPorts(byName(HEADER_COMPONENT), 'inputs')).toEqual(
      new Set(['nav1', 'nav1Target', 'nav2', 'nav2Target', 'nav3', 'nav3Target'])
    );
    expect(declaredPorts(byName(FIELD_COMPONENT), 'outputs')).toEqual(new Set(['text']));
  });

  it('every component an instance names is in the project', () => {
    for (const { node } of instances) expect(shipped.map((c) => c.legacyName)).toContain(node.type);
  });

  it('🔴 every instance parameter names a port the component declares', () => {
    const offenders: string[] = [];
    for (const { owner, node } of instances) {
      const declared = declaredPorts(byName(node.type), 'inputs');
      for (const name of Object.keys(node.parameters ?? {})) if (!declared.has(name)) offenders.push(`${owner.legacyName} › ${node.id}.${name}`);
    }
    expect(offenders).toEqual([]);
  });

  it('🔴 every wire into or out of an instance names a port the component declares — or `this`', () => {
    const offenders: string[] = [];
    for (const { owner, node } of instances) {
      const ins = declaredPorts(byName(node.type), 'inputs');
      const outs = declaredPorts(byName(node.type), 'outputs');
      for (const w of owner.connections) {
        if (w.toId === node.id && !ins.has(w.toProperty)) offenders.push(`${owner.legacyName} › →${node.id}.${w.toProperty}`);
        if (w.fromId === node.id && w.fromProperty !== 'this' && !outs.has(w.fromProperty)) offenders.push(`${owner.legacyName} › ${node.id}.${w.fromProperty}→`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('control: the matcher discriminates — an invented port would be caught', () => {
    const declared = declaredPorts(byName(CONTACT_COMPONENT), 'inputs');
    expect(declared.has('headingXX')).toBe(false);
  });
});

// ── 5. The contact form — the one thing the template DOES ────────────────────

describe('TPL-003 — the contact form composes a mail and nothing else can open it', () => {
  const contact = byName(CONTACT_COMPONENT);
  const wires = contact.connections;
  const compose = contact.nodes.find((n) => n.type === 'JavaScriptFunction' && String(n.parameters?.functionScript).includes('mailto:')) as StoredNode;
  const link = contact.nodes.find((n) => n.type === 'net.noodl.externallink') as StoredNode;
  const address = contact.nodes.find((n) => n.type === 'String') as StoredNode;

  it('control: the three nodes exist, once each', () => {
    expect(compose).toBeDefined();
    expect(link).toBeDefined();
    expect(address).toBeDefined();
    expect(contact.nodes.filter((n) => n.type === 'String')).toHaveLength(1);
    expect(contact.nodes.filter((n) => n.type === 'net.noodl.externallink')).toHaveLength(1);
  });

  it('🔴 Send is the ONLY trigger: the button runs the composer, and no typed field can', () => {
    const runs = wires.filter((w) => w.toId === compose.id && w.toProperty === 'run');
    expect(runs).toHaveLength(1);
    expect(contact.nodes.find((n) => n.id === runs[0].fromId)?.type).toBe('net.noodl.controls.button');
    for (const name of ['name', 'email', 'message', 'to']) expect(compose.parameters?.[`runOnChange-in-${name}`]).toBe(false);
  });

  it('🔴 three fields feed the composer, and each is a Field instance', () => {
    const fields = contact.nodes.filter((n) => n.type === FIELD_COMPONENT);
    expect(fields).toHaveLength(3);
    expect(fields.map((f) => f.parameters?.type).sort()).toEqual(['email', 'text', 'textArea']);
    for (const f of fields) {
      expect(wires.some((w) => w.fromId === f.id && w.fromProperty === 'text' && w.toId === compose.id && w.toProperty.startsWith('in-'))).toBe(true);
    }
  });

  it('🔴 the composer reaches the link on both ports, and the link opens IN PLACE', () => {
    expect(wires).toContainEqual({ fromId: compose.id, fromProperty: 'out-link', toId: link.id, toProperty: 'link' });
    expect(wires).toContainEqual({ fromId: compose.id, fromProperty: 'out-go', toId: link.id, toProperty: 'do' });
    expect(link.parameters?.openInNewTab).toBe(false);
  });

  it('🔴 the address is ONE node, marked, feeding both the link and the line beside the form', () => {
    expect(address.label?.startsWith(EDIT)).toBe(true);
    expect(address.parameters?.value).toBe(PLACEHOLDER_ADDRESS);
    const outs = wires.filter((w) => w.fromId === address.id && w.fromProperty === 'savedValue');
    expect(outs.map((w) => `${w.toId}.${w.toProperty}`).sort()).toEqual([`${compose.id}.in-to`, 'ctAddress.text'].sort());
  });

  it('both answers have a screen, hidden until asked, and each can be put away again', () => {
    const notices = contact.nodes.filter((n) => n.type === 'Group' && n.parameters?.mounted === false);
    expect(notices.map((n) => n.id).sort()).toEqual(['ctMissing', 'ctSent']);
    const texts = contact.nodes.filter((n) => n.type === 'Text').map((n) => String(n.parameters?.text));
    expect(texts).toContain(SENT_TEXT);
    expect(texts).toContain(MISSING_TEXT);
    for (const id of ['ctMissing', 'ctSent']) {
      const sources = wires.filter((w) => w.toId === id && w.toProperty === 'mounted').map((w) => contact.nodes.find((n) => n.id === w.fromId));
      // One constant-true Condition to show it, one constant-false to hide it.
      expect(sources.map((n) => n?.parameters?.condition).sort()).toEqual([false, true]);
    }
  });
});

// ── 6. Every page is the same frame around a different middle ────────────────

describe('TPL-003 — the three pages share the frame and each has one heading', () => {
  it.each(PAGE_NAMES)('%s places the switcher, the header, the contact band and the footer once each', (name) => {
    const page = byName(name);
    for (const part of [SWITCHER_COMPONENT, HEADER_COMPONENT, CONTACT_COMPONENT, FOOTER_COMPONENT]) {
      expect(page.nodes.filter((n) => n.type === part)).toHaveLength(1);
    }
  });

  it.each(PAGE_NAMES)('%s declares exactly one h1 and one main, with the h1 inside the main', (name) => {
    const page = byName(name);
    const h1 = page.nodes.filter((n) => n.parameters?.as === 'h1');
    const main = page.nodes.filter((n) => n.parameters?.as === 'main');
    expect(h1).toHaveLength(1);
    expect(main).toHaveLength(1);
    expect(descendants(page, main[0].id).map((n) => n.id)).toContain(h1[0].id);
  });

  /**
   * TPL-004 replaced `Scroll To Element` with a class name and a `Site/ScrollTo`.
   *
   * 🔴 **The failure this grades cannot be photographed.** A link aimed at
   * `section-flwork` while the band says `section-flWork` renders perfectly,
   * scrolls nowhere, and reports nothing — `SCROLL_SCRIPT` fires `missing` into
   * an unwired port. So the gate is not "is there a wire", it is **does every
   * target a page names exist as a class somewhere in the project**.
   */
  it('no page scrolls through a Group port any more', () => {
    const offenders = shipped.flatMap((c) =>
      c.connections.filter((w) => String(w.toProperty).startsWith('scrollToElement')).map((w) => `${c.legacyName} › ${w.toId}.${w.toProperty}`)
    );
    expect(offenders).toEqual([]);
  });

  it('🔴 every scroll target names a class that exists', () => {
    // Every class any node in the project carries.
    const classes = new Set(
      shipped.flatMap((c) => c.nodes.map((n) => n.parameters?.cssClassName).filter((v): v is string => typeof v === 'string'))
    );
    // Every target anything aims at: a ScrollTo instance's own `target`, and the
    // three the header is handed per page.
    const targets: string[] = [];
    for (const c of shipped) {
      for (const n of c.nodes) {
        if (n.type === SCROLL_TO_COMPONENT && typeof n.parameters?.target === 'string') targets.push(`${c.legacyName} › ${n.id}: ${n.parameters.target}`);
        if (n.type === HEADER_COMPONENT) {
          for (const key of ['nav1Target', 'nav2Target', 'nav3Target']) {
            const v = n.parameters?.[key];
            if (typeof v === 'string') targets.push(`${c.legacyName} › ${n.id}.${key}: ${v}`);
          }
        }
      }
    }
    // Control: there are targets to grade at all, and the header class the
    // script measures its offset from is really on the header.
    expect(targets.length).toBeGreaterThanOrEqual(3 * 3 + 3 + 3);
    expect(classes.has(HEADER_CLASS)).toBe(true);
    expect(classes.has(CONTACT_CLASS)).toBe(true);

    const dangling = targets.filter((t) => !classes.has(t.slice(t.lastIndexOf(': ') + 2)));
    expect(dangling).toEqual([]);
  });

  it.each(PAGE_NAMES)('%s gives the header a nav, and both hero buttons somewhere to go', (name) => {
    const page = byName(name);
    const prefix = name === PAGE_FREELANCER ? 'fl' : name === PAGE_BUSINESS ? 'bz' : 'ln';
    const header = page.nodes.find((n) => n.id === `${prefix}Header`);
    expect(header?.type).toBe(HEADER_COMPONENT);
    for (const key of ['nav1', 'nav1Target', 'nav2', 'nav2Target', 'nav3', 'nav3Target']) {
      expect(typeof header?.parameters?.[key]).toBe('string');
    }
    // The anchor GROUP still exists and still holds the band — it is what carries
    // the contact class now that it no longer holds a port.
    const anchor = page.nodes.find((n) => n.id === `${prefix}ContactAnchor`);
    expect(anchor?.children).toEqual([`${prefix}Contact`]);
    expect(anchor?.parameters?.cssClassName).toBe(CONTACT_CLASS);

    const w = page.connections;
    expect(w).toContainEqual({ fromId: `${prefix}HeroPrimary`, fromProperty: 'onClick', toId: `${prefix}GoContact`, toProperty: 'go' });
    expect(w).toContainEqual({ fromId: `${prefix}HeroSecondary`, fromProperty: 'onClick', toId: `${prefix}GoSecond`, toProperty: 'go' });
    for (const id of [`${prefix}GoContact`, `${prefix}GoSecond`]) {
      expect(page.nodes.find((n) => n.id === id)?.type).toBe(SCROLL_TO_COMPONENT);
    }
  });

  it('every photograph a page or a part names is a starter asset every project has', () => {
    const refs = shipped.flatMap((c) =>
      c.nodes.flatMap((n) => Object.values(n.parameters ?? {}).filter((v) => typeof v === 'string' && v.startsWith('noodl_modules/starter-imagery/')) as string[])
    );
    expect(refs.length).toBeGreaterThan(10);
    for (const ref of refs) expect(fs.existsSync(path.join(STARTER_IMAGERY, path.basename(ref)))).toBe(true);
  });
});

// ── 7. The design system is opened, and finished ─────────────────────────────

describe('TPL-003 — the look is the product’s, not a copy of it', () => {
  it('the project carries exactly the preset plus the template’s tokens, in order', () => {
    const project = JSON.parse(fs.readFileSync(path.join(ARTEFACT, 'nodegx.project.json'), 'utf-8')) as {
      metadata?: { designTokens?: { customTokens?: Array<{ name: string; value: string }> } };
    };
    const carried = (project.metadata?.designTokens?.customTokens ?? []).map((t) => [t.name, t.value]);
    // `upsertTokens` merges by name: the template's override of a preset token
    // replaces it in place, so compare the resolved map rather than the list.
    const expected = new Map<string, string>();
    for (const t of tpl003TokenEntries()) expected.set(t.name, t.value);
    expect(new Map(carried as Array<[string, string]>)).toEqual(expected);
    expect(carried.length).toBeGreaterThan(20);
  });

  it('USED_COMPOSITIONS is exactly what the template asked the vocabulary for', () => {
    expect([...USED_COMPOSITIONS].sort()).toEqual(requestedCompositions());
  });

  it('§1 every Text sets a type ramp', () => {
    const bare = shipped.flatMap((c) => c.nodes.filter((n) => n.type === 'Text' && n.parameters?.fontSize === undefined).map((n) => `${c.legacyName} › ${n.id}`));
    expect(bare).toEqual([]);
    expect(shipped.flatMap((c) => c.nodes.filter((n) => n.type === 'Text')).length).toBeGreaterThan(60);
  });

  it('no colour parameter is a raw literal', () => {
    const RAW = /^(#|rgb|hsl)/i;
    const offenders = shipped.flatMap((c) =>
      c.nodes.flatMap((n) =>
        Object.entries(n.parameters ?? {})
          .filter(([k, v]) => /color/i.test(k) && typeof v === 'string' && RAW.test(v))
          .map(([k, v]) => `${c.legacyName} › ${n.id}.${k} = ${String(v)}`)
      )
    );
    expect(offenders).toEqual([]);
  });

  it('every page changes ground at least three times — no page is one colour end to end', () => {
    for (const page of pages) {
      const grounds = new Set(
        page.nodes.flatMap((n) => [n.parameters?.backgroundColor, n.parameters?.backgroundGradient, n.parameters?.backgroundImage]).filter((v) => typeof v === 'string')
      );
      expect(grounds.size).toBeGreaterThanOrEqual(3);
    }
  });
});

// ── 8. The strings a person has to change are listed, all of them ────────────

describe('TPL-003 — every placeholder is marked, and the note lists every mark', () => {
  const marked = collectEditMarkers(ARTEFACT, EDIT);
  const note = fs.readFileSync(path.join(ARTEFACT, START_HERE_FILE), 'utf-8');

  it('control: there are marks to list', () => {
    expect(marked.length).toBeGreaterThan(40);
  });

  it('the note names every marked node, and the switcher is one of them', () => {
    for (const m of marked) expect(note).toContain(`**${m.label}**`);
    expect(marked.some((m) => m.component === 'Site/Switcher')).toBe(true);
    expect(marked.some((m) => m.text === PLACEHOLDER_ADDRESS)).toBe(true);
  });

  it('🔴 no unmarked node says "EDIT ME"', () => {
    const offenders = shipped.flatMap((c) =>
      c.nodes
        .filter((n) => Object.values(n.parameters ?? {}).some((v) => typeof v === 'string' && v.includes('EDIT ME')))
        .filter((n) => !(n.label ?? '').startsWith(EDIT))
        .map((n) => `${c.legacyName} › ${n.id}`)
    );
    expect(offenders).toEqual([]);
  });

  it('every marked node is a Text, a String, an Image or an instance — something with words in it', () => {
    const allowed = (t: string) => t === 'Text' || t === 'String' || t === 'Image' || t.startsWith('/');
    const odd = shipped.flatMap((c) => c.nodes.filter((n) => (n.label ?? '').startsWith(EDIT) && !allowed(n.type)).map((n) => `${c.legacyName} › ${n.id} (${n.type})`));
    expect(odd).toEqual([]);
  });
});
