/**
 * EXP-009 — the exported app talks to its deployed backend.
 *
 * The fixture is `puppy-test-3`, whose nodegx.project.json declares the backend the running app
 * already uses (`metadata.cloudservices`). The goldens in tests/goldens/exp009/ are the
 * hand-written target output (EXP-009-CLIENT-TARGET-OUTPUT.md): they were typed first, graded
 * by `tsc -b` in the harness with a sabotage control, and the emitter was then made to produce
 * those bytes. Byte-equality here is the whole claim — every protocol fact (the POST-tunnelled
 * GET, the session key, the header pair, the signUp identity merge) is pinned by it.
 *
 * The stub form (no backend, AC7) keeps its own pins in record-verbs / user-family / visual;
 * this file owns the connected form and the boundary between the two.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ExportIR } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'puppy-test-3');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const GOLDENS = path.join(__dirname, 'goldens', 'exp009');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);

// The .ts goldens carry a .golden suffix so the package's own tsc never grades them — they are
// Vite-app code (import.meta.env, DOM globals) and compile in the emitted app's program, which
// is where the harness typechecked them.
const golden = (name: string): string =>
  fs.readFileSync(path.join(GOLDENS, name.endsWith('.ts') ? `${name}.golden` : name), 'utf8');
const cloneIr = (): ExportIR => structuredClone(baseIr);
const withoutBackend = (): ExportIR => {
  const ir = cloneIr();
  delete ir.project.cloudservices;
  return ir;
};

describe('the parsed backend', () => {
  test('cloudservices carries exactly the four public fields', () => {
    expect(baseIr.project.cloudservices).toEqual({
      instanceId: 'backend_msjck0y2ukxwv',
      endpoint: 'http://localhost:8581',
      appId: 'backend_msjck0y2ukxwv',
      type: 'nodegx'
    });
  });

  test('a privileged credential in project metadata never reaches the IR', () => {
    // The parser copies four named fields and drops the rest on the floor — by construction,
    // not by grep. A master key pasted into metadata must die here (EXP-009 ruling 2).
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp009-'));
    try {
      fs.mkdirSync(path.join(dir, 'components'));
      fs.writeFileSync(
        path.join(dir, 'nodegx.project.json'),
        JSON.stringify({
          name: 'Leaky',
          metadata: {
            cloudservices: {
              endpoint: 'http://localhost:8581',
              appId: 'app',
              masterKey: 'sk-never-ship-this',
              adminToken: 'also-never'
            }
          }
        })
      );
      const parsed = parseProject(dir, catalog);
      expect(parsed.project.cloudservices).toEqual({ endpoint: 'http://localhost:8581', appId: 'app' });
      expect(JSON.stringify(parsed)).not.toContain('sk-never-ship-this');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a half-declared backend is no backend', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp009-'));
    try {
      fs.mkdirSync(path.join(dir, 'components'));
      fs.writeFileSync(
        path.join(dir, 'nodegx.project.json'),
        JSON.stringify({ name: 'Half', metadata: { cloudservices: { endpoint: 'http://localhost:8581' } } })
      );
      expect(parseProject(dir, catalog).project.cloudservices).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the connected export, byte-for-byte against the hand-written target', () => {
  test('src/api/client.ts is the target output', () => {
    expect(app.files['src/api/client.ts']).toBe(golden('client.ts'));
  });

  test('a backend that cannot be reached is one sentence at both fetch sites — never the browser\u2019s own', () => {
    // EXP-011 §43 D8: callFunction() wrapped the network failure since §41; request() — every
    // query, record, session and user verb — let Chrome's "Failed to fetch" through, and a
    // Record's Error read it in the drive. Two fetch calls, two wraps, one sentence.
    const client = app.files['src/api/client.ts'];
    expect(client.match(/await fetch\(/g)).toHaveLength(2);
    expect(client.match(/throw new Error\(`Could not reach the backend at \$\{ENDPOINT\}`\);/g)).toHaveLength(2);
    // (the browser's sentence appears once, in the comment that names it — the assertion is on the throws)
    for (const site of client.split('await fetch(').slice(1)) {
      expect(site.indexOf('} catch {')).toBeLessThan(site.indexOf('await response.text()'));
    }
  });

  test('src/api/puppies.ts is the target output', () => {
    expect(app.files['src/api/puppies.ts']).toBe(golden('puppies.ts'));
  });

  test('src/api/session.ts is the target output', () => {
    expect(app.files['src/api/session.ts']).toBe(golden('session.ts'));
  });

  test('.env.example arrives with the client', () => {
    expect(app.files['.env.example']).toBe(golden('env.example'));
  });

  /*
   * ⚠️ **`README.md` used to be compared against a golden here, and is not any more.** EXP-009
   * wrote that golden as the hand-written target for a README this branch emitted: a backend-only
   * file about two environment variables. EXP-004 makes the README the exported repository's front
   * door — emitted for every project, generated from the report data, and mostly about what needs
   * doing rather than about a backend at all. The document the golden described no longer exists,
   * so the row could not be kept either way.
   *
   * What replaced it is `tests/exported-readme.test.ts`, and the backend half of this fixture's
   * README is pinned there against the same endpoint and application id `.env.example` uses.
   */
  test('the README points at the same deployment .env.example does', () => {
    const readme = app.files['README.md'];
    expect(readme).toContain('default: `http://localhost:8581`');
    expect(readme).toContain('default: `backend_msjck0y2ukxwv`');
  });

  test('the report says where the calls go', () => {
    expect(
      app.notes.some((n) =>
        n.includes("api modules connect to the project's NodeGX backend at http://localhost:8581")
      )
    ).toBe(true);
  });
});

describe('AC5 — no privileged credential in the output', () => {
  test('no emitted file mentions a master key in any spelling', () => {
    for (const [name, content] of Object.entries(app.files)) {
      expect(`${name}: ${content}`).not.toMatch(/master-?key/i);
    }
  });

  test('an unknown field smuggled onto the IR backend record is never emitted', () => {
    // Defence in depth past the parser: the emitter interpolates two named fields and spreads
    // nothing, so even an IR built by hand cannot leak an extra field into the bundle.
    const ir = cloneIr();
    (ir.project.cloudservices as unknown as Record<string, unknown>).masterKey = 'sk-smuggled';
    for (const content of Object.values(emitApp(ir, catalog).files)) {
      expect(content).not.toContain('sk-smuggled');
    }
  });
});

describe('AC7 — a project with no backend still exports and builds, and says so', () => {
  const stubApp = emitApp(withoutBackend(), catalog);

  test('no client and no .env.example — but a README, without an env-var section', () => {
    expect(stubApp.files['src/api/client.ts']).toBeUndefined();
    expect(stubApp.files['.env.example']).toBeUndefined();
    /*
     * 🔴 **This row asserted `toBeUndefined()` on the README until EXP-004, and it was pinning the
     * defect.** The README was emitted inside `apiModules` under `backend !== undefined && hasApi`,
     * so the file a developer opens first arrived only for a project that both declared a NodeGX
     * backend and queried it — six of the seven corpus fixtures got none. The absence was never
     * what AC7 was about; AC7 is that a backendless project *still exports and says so*, and a
     * missing README is the opposite of saying so.
     *
     * The env-var section is what is genuinely conditional, and that is what is asserted now.
     */
    expect(stubApp.files['README.md']).toBeDefined();
    expect(stubApp.files['README.md']).not.toContain('VITE_NODEGX_ENDPOINT');
    expect(stubApp.files['README.md']).not.toContain('.env.example');
    expect(stubApp.files['README.md']).toContain('Point `src/api/` at a data source.');
  });

  test('the api modules are the pre-EXP-009 stubs', () => {
    expect(stubApp.files['src/api/puppies.ts']).toContain(
      'export async function fetchPuppies(): Promise<Puppy[]> {\n  return [];\n}'
    );
    expect(stubApp.files['src/api/puppies.ts']).toContain('is not connected to a backend yet');
    expect(stubApp.files['src/api/session.ts']).toContain('return { authenticated: false, user: null };');
    expect(stubApp.files['src/api/puppies.ts']).not.toContain("from './client'");
    expect(stubApp.files['src/api/session.ts']).not.toContain("from './client'");
  });

  test('the reason is a report note, not a silence', () => {
    expect(
      stubApp.notes.some((n) =>
        n.includes('api modules emitted as stubs — the project declares no backend')
      )
    ).toBe(true);
    // The connected export does not carry the stub note, and vice versa.
    expect(app.notes.some((n) => n.includes('emitted as stubs'))).toBe(false);
  });
});

describe('the seams that take user text', () => {
  test("an endpoint containing a quote lands escaped in the client's string literal", () => {
    const ir = cloneIr();
    ir.project.cloudservices!.endpoint = "http://x'y";
    const client = emitApp(ir, catalog).files['src/api/client.ts'];
    expect(client).toContain("import.meta.env.VITE_NODEGX_ENDPOINT ?? 'http://x\\'y';");
  });

  test("a collection named Client cannot collide with the client module — every module base is a plural", () => {
    // pluralize() always appends s/es/ies, so no moduleBase can be the non-plural "client"
    // (or "session" — that file never had a guard for the same reason). This pins the fact
    // the no-guard decision rests on, so a future naming change fails here first.
    const ir = cloneIr();
    for (const component of ir.components) {
      for (const node of component.nodes) {
        const param = node.parameters.find((p) => p.name === 'collectionName');
        if (param && param.value.kind === 'literal' && param.value.value === 'Puppy') {
          param.value = { kind: 'literal', value: 'Client' };
        }
      }
    }
    const built = emitApp(ir, catalog);
    expect(built.files['src/api/clients.ts']).toContain("from './client'");
    expect(built.files['src/api/client.ts']).toBe(golden('client.ts'));
  });
});
