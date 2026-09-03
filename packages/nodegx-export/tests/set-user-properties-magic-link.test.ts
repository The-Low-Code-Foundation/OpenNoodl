import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog, CatalogIndex } from '../src/catalog';
import { planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §44 — `Set User Properties` and `Request Magic Link`, the two session verbs among the
 * Cloud Services: the user family's `api-call` machinery (USER-FAMILY-TARGET §4/§5) with two
 * more rows in `USER_VERBS`, two more exports in `src/api/session.ts`, and two more request
 * functions on the client, each the runtime's own wire shape —
 * `ParseAuthAdapter.setUserProperties` (`PUT /users/<objectId>`, refused before any request when
 * nobody is signed in, the stored session rewritten after) and `requestMagicLink`
 * (`POST /auth/magic-link {email, redirect}`, a blank redirect filled with the current page).
 *
 * Two things the family did not have before: `prop-<key>` columns on a write (the record
 * verbs' rule, typed by the wire, in a `UserProperties` interface the project shares), and an
 * Error that **clears on Done** (`requestmagiclink.ts` alone does that; every other verb keeps
 * the last refusal).
 *
 * §A the session module and the client, §B the component, §C every refusal by its sentence,
 * §D the fixture `tests/fixtures/account-desk` — Log In, User, both verbs on one page — exported
 * whole, typechecked, parsed, with nothing refused.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'account-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);

const HOME = 'Pages/Home';
const cloneIr = (): ExportIR => structuredClone(baseIr);
const withoutBackend = (): ExportIR => {
  const ir = cloneIr();
  delete ir.project.cloudservices;
  return ir;
};
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR =>
  componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const lit = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
};
const wire = (
  source: ExportIR,
  componentPath: string,
  fromId: string,
  fromProperty: string,
  toId: string,
  toProperty: string,
  kind: 'value' | 'signal' = 'value'
) => {
  componentOf(source, componentPath).connections.push({
    key: `${fromId}:${fromProperty}->${toId}:${toProperty}`,
    fromId,
    fromProperty,
    toId,
    toProperty,
    kind
  });
};
const unwire = (source: ExportIR, componentPath: string, key: string) => {
  const component = componentOf(source, componentPath);
  component.connections = component.connections.filter((c) => c.key !== key);
};
const addNode = (component: ComponentIR, node: Partial<NodeIR> & { id: string; type: string }): NodeIR => {
  const full: NodeIR = {
    catalogRef: node.type,
    parameters: [],
    declaredPorts: [],
    portKnowledge: 'complete',
    ...node
  } as NodeIR;
  component.nodes.push(full);
  return full;
};

const fileOf = (built: ReturnType<typeof emitApp>, name: string): string => built.files[name];
const home = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/pages/Home.tsx');
const sessionApi = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/api/session.ts');
const client = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/api/client.ts');

/** The deferral reason the planner recorded for one node. */
const reasonFor = (source: ExportIR, componentPath: string, nodeId: string): string | undefined => {
  const project = planProject(source, new CatalogIndex(catalog));
  const plan = project.plans.find((p) => p.path === componentPath)!;
  const disposition = plan.dispositions[nodeId] as { kind: string; reason?: string };
  return disposition?.kind === 'deferred' ? disposition.reason : undefined;
};

/** The body of one exported function of a module, from its signature line to its closing brace. */
const fnBody = (source: string, signature: string): string => {
  const start = source.indexOf(signature);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('\n}\n', start);
  return source.slice(start, end);
};

const SAVE_CALL = 'await setUserProperties({ username: newUsername, nickname });';
const SEND_CALL = 'await requestMagicLink(email);';

describe('§A — the session module and the client', () => {
  test('A1 UserProperties: the two static ports, then the columns the graph writes, typed by their wires', () => {
    expect(sessionApi(app)).toContain(
      '/** The fields a Set User Properties writes to the signed-in user (EXP-011 §44). */\n' +
        'export type UserProperties = {\n  username?: string;\n  email?: string;\n  nickname?: string;\n};\n'
    );
  });

  test('A2 the two exports ride the client’s two new request functions, and import them', () => {
    const api = sessionApi(app);
    expect(api).toContain(
      'export async function setUserProperties(data: UserProperties): Promise<void> {\n  await updateUserRequest(data);\n}'
    );
    expect(api).toContain(
      'export async function requestMagicLink(email: string, redirect?: string): Promise<void> {\n' +
        '  await requestMagicLinkRequest(email, redirect);\n}'
    );
    expect(api).toContain(
      "import { logInRequest, readSession, readSessionRaw, requestMagicLinkRequest, subscribeSession, updateUserRequest, type WireSession } from './client';"
    );
    // The provenance line names the node, as every session export's does.
    expect(api).toContain('Source: "Save profile" (net.noodl.user.SetUserProperties `setProps` on /Pages/Home)');
    expect(api).toContain('Source: "Send sign-in link" (net.noodl.user.RequestMagicLink `magic` on /Pages/Home)');
  });

  test('A3 updateUserRequest: refused before any request when nobody is signed in, PUT to the session’s own id, the session rewritten', () => {
    const body = fnBody(client(app), 'export async function updateUserRequest(data: Record<string, unknown>): Promise<WireSession> {');
    const refusal = body.indexOf("if (session === undefined) throw new Error('Nobody is signed in.');");
    const request = body.indexOf('await request<{ updatedAt?: string }>(`/users/${encodeURIComponent(session.objectId)}`, {');
    expect(refusal).toBeGreaterThan(0);
    expect(request).toBeGreaterThan(refusal);
    expect(body).toContain("method: 'PUT',\n    body\n  });");
    // The rewrite is what makes a `User` read re-render — `setSession` in the runtime.
    expect(body.indexOf('const next: WireSession = { ...session, ...body };\n  writeSession(next);\n  return next;')).toBeGreaterThan(request);
  });

  test('A4 updateUserRequest: a blank Email or Username keeps the current one (the node’s contract); a column is sent as given', () => {
    const body = fnBody(client(app), 'export async function updateUserRequest(');
    expect(body).toContain('if (value === undefined) continue;');
    expect(body).toContain("if ((key === 'username' || key === 'email') && value === '') continue;");
    expect(body).toContain('body[key] = value;');
  });

  test('A5 requestMagicLinkRequest: POST /auth/magic-link, a blank redirect filled with the current page minus the sign-in return parameters', () => {
    const source = client(app);
    expect(fnBody(source, 'export async function requestMagicLinkRequest(email: string, redirect?: string): Promise<void> {')).toContain(
      "await request<unknown>('/auth/magic-link', {\n    method: 'POST',\n    body: { email, redirect: redirect || currentUrlWithoutAuthParams() }\n  });"
    );
    expect(fnBody(source, 'function currentUrlWithoutAuthParams(): string {')).toContain(
      "const url = new URL(window.location.href);\n  url.searchParams.delete('nodegx_auth');\n  url.searchParams.delete('nodegx_auth_error');\n  return url.toString();"
    );
  });

  test('A6 both ride request() — the §43 cardinality holds: two fetch sites, two wraps, and neither new function is a third', () => {
    const source = client(app);
    expect(source.match(/await fetch\(/g)).toHaveLength(2);
    expect(source.match(/throw new Error\(`Could not reach the backend at \$\{ENDPOINT\}`\);/g)).toHaveLength(2);
    expect(fnBody(source, 'export async function updateUserRequest(')).toContain('await request<');
    expect(fnBody(source, 'export async function requestMagicLinkRequest(')).toContain('await request<');
  });

  test('A7 unconnected: both exports throw the stub sentence, and the client is not imported', () => {
    const api = sessionApi(emitApp(withoutBackend(), catalog));
    expect(api).toContain(
      'export async function setUserProperties(data: UserProperties): Promise<void> {\n' +
        "  throw new Error('setUserProperties is not connected to a backend yet');\n}"
    );
    expect(api).toContain(
      'export async function requestMagicLink(email: string, redirect?: string): Promise<void> {\n' +
        "  throw new Error('requestMagicLink is not connected to a backend yet');\n}"
    );
    expect(api).not.toContain("from './client'");
    expect(api).toContain('export type UserProperties = {');
  });

  test('A8 a column is typed by its wire — a number literal is `number`; two sites disagreeing is `unknown`', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'setProps'), 'prop-age', lit(30));
    expect(sessionApi(emitApp(ir, catalog))).toContain('  nickname?: string;\n  age?: number;\n};');

    const two = cloneIr();
    setParam(nodeOf(two, HOME, 'setProps'), 'prop-age', lit(30));
    const component = componentOf(two, HOME);
    addNode(component, { id: 'setProps2', type: 'net.noodl.user.SetUserProperties' });
    setParam(nodeOf(two, HOME, 'setProps2'), 'prop-age', lit('thirty'));
    wire(two, HOME, 'loginBtn', 'onClick', 'setProps2', 'store', 'signal');
    const api = sessionApi(emitApp(two, catalog));
    expect(api).toContain('  age?: unknown;\n};');
    expect(api.match(/export type UserProperties/g)).toHaveLength(1);
  });
});

describe('§B — the component', () => {
  test('B1 Save: the data object carries the static port and the column, the done chain follows the await, the catch writes the Error', () => {
    const source = home(app);
    const call = source.indexOf(SAVE_CALL);
    expect(call).toBeGreaterThan(0);
    expect(source.indexOf('savedName.set(newUsername);')).toBeGreaterThan(call);
    expect(source).toContain('const saveProfileErrorMessage = error instanceof Error ? error.message : String(error);');
    expect(source).toContain('setSaveProfileError(saveProfileErrorMessage);');
    // EXP-011 §54. setuserproperties.ts raises user/set-properties-failed before the failure pulse; the export raises after the row.
    expect(source).toContain("raiseAppError({ code: 'user/set-properties-failed', message: saveProfileErrorMessage, nodeId: 'setProps', nodeType: 'net.noodl.user.SetUserProperties', componentName: '/Pages/Home' });");
    expect(source).toContain("<p className={styles.errorText}>{saveProfileError ?? ''}</p>");
  });

  test('B2 Save never clears its Error; Send clears it the moment the call answers, before the done chain', () => {
    const source = home(app);
    expect(source).not.toContain('setSaveProfileError(undefined)');
    const send = source.indexOf(SEND_CALL);
    const clear = source.indexOf('setSendSignInLinkError(undefined);');
    const chain = source.indexOf('sentTo.set(email);');
    expect(send).toBeGreaterThan(0);
    expect(clear).toBeGreaterThan(send);
    expect(chain).toBeGreaterThan(clear);
    // One clear, in the Send handler: the family's other verbs keep the last refusal.
    expect(source.match(/Error\(undefined\)/g)).toHaveLength(1);
  });

  test('B3 the Nickname input earns local state through the column wire, as a credential does', () => {
    const source = home(app);
    expect(source).toContain("const [nickname, setNickname] = useState<string>('');");
    expect(source).toContain('placeholder="Nickname"\n        value={nickname}\n        onChange={(event) => setNickname(event.target.value)}');
  });

  test('B4 Send omits the redirect when nothing feeds it; a wired one is the second argument; an authored one a literal', () => {
    expect(home(app)).toContain(SEND_CALL);

    const wired = cloneIr();
    wire(wired, HOME, 'newNameInput', 'onTextChanged', 'magic', 'redirect');
    expect(home(emitApp(wired, catalog))).toContain('await requestMagicLink(email, newUsername);');

    const authored = cloneIr();
    setParam(nodeOf(authored, HOME, 'magic'), 'redirect', lit('/welcome'));
    expect(home(emitApp(authored, catalog))).toContain("await requestMagicLink(email, '/welcome');");
  });

  test('B5 an authored Email on Set User Properties lands between the username and the columns', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'setProps'), 'email', lit('a@b.c'));
    expect(home(emitApp(ir, catalog))).toContain("await setUserProperties({ username: newUsername, email: 'a@b.c', nickname });");
  });

  test('B6 the User read beside the write is the plain session read — the rewrite is what it re-renders on', () => {
    const source = home(app);
    expect(source).toContain('const session = useSession();');
    expect(source).toContain("<p className={styles.text}>{session.user?.username ?? ''}</p>");
  });
});

describe('§C — the refusals, each by its sentence', () => {
  test('C1 a consumed failure or completed — only the done chain and the Error value are translated', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'setProps', 'failure', 'sentSet', 'do', 'signal');
    expect(reasonFor(ir, HOME, 'setProps')).toBe(
      'its failure output is consumed — only the done chain and the Error value are translated in this slice'
    );
    const two = cloneIr();
    wire(two, HOME, 'magic', 'completed', 'savedSet', 'do', 'signal');
    expect(reasonFor(two, HOME, 'magic')).toBe(
      'its completed output is consumed — only the done chain and the Error value are translated in this slice'
    );
  });

  test('C2 two wires into a static input, or into one column — last-writer-wins is not statically ordered', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'usernameInput', 'onTextChanged', 'setProps', 'username');
    expect(reasonFor(ir, HOME, 'setProps')).toBe('two wires feed username — last-writer-wins is not statically ordered');

    const col = cloneIr();
    wire(col, HOME, 'usernameInput', 'onTextChanged', 'setProps', 'prop-nickname');
    expect(reasonFor(col, HOME, 'setProps')).toBe('two wires feed prop-nickname — last-writer-wins is not statically ordered');

    const send = cloneIr();
    wire(send, HOME, 'usernameInput', 'onTextChanged', 'magic', 'email');
    expect(reasonFor(send, HOME, 'magic')).toBe('two wires feed email — last-writer-wins is not statically ordered');
  });

  test('C3 a named Backend refuses every verb in the family; _active_ and blank are the default', () => {
    for (const id of ['setProps', 'magic', 'login']) {
      const ir = cloneIr();
      setParam(nodeOf(ir, HOME, id), 'backendId', lit('other'));
      expect(reasonFor(ir, HOME, id)).toBe('it names a specific Backend — one session module is all this slice emits');
    }
    const active = cloneIr();
    setParam(nodeOf(active, HOME, 'setProps'), 'backendId', lit('_active_'));
    setParam(nodeOf(active, HOME, 'magic'), 'backendId', lit(''));
    expect(reasonFor(active, HOME, 'setProps')).toBeUndefined();
    expect(reasonFor(active, HOME, 'magic')).toBeUndefined();
    expect(home(emitApp(active, catalog))).toContain(SAVE_CALL);
  });

  test('C4 Sign Up keeps §5.5 — a column on it still refuses, the clause lifted only Set User Properties', () => {
    const ir = cloneIr();
    addNode(componentOf(ir, HOME), { id: 'signup', type: 'net.noodl.user.SignUp' });
    setParam(nodeOf(ir, HOME, 'signup'), 'prop-nickname', lit('x'));
    wire(ir, HOME, 'sendBtn', 'onClick', 'signup', 'signup', 'signal');
    expect(reasonFor(ir, HOME, 'signup')).toBe(
      "it sets extra _User columns at sign-up — the export's session stub carries no user schema to type them against"
    );
  });

  test('C5 an unfired Do — and the session export is earned by attachment, so it leaves', () => {
    const ir = cloneIr();
    unwire(ir, HOME, 'saveBtn:onClick->setProps:store');
    expect(reasonFor(ir, HOME, 'setProps')).toBe('its Do is never fired by a translatable trigger');
    const built = emitApp(ir, catalog);
    expect(sessionApi(built)).not.toContain('setUserProperties');
    expect(sessionApi(built)).not.toContain('UserProperties');
    expect(home(built)).not.toContain('setUserProperties');
  });

  test('C6 a column authored as something other than a literal', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'setProps'), 'prop-age', { kind: 'expression', code: '1 + 1' } as unknown as ParamValue);
    expect(reasonFor(ir, HOME, 'setProps')).toBe('property "age" is authored as something other than a literal');
  });
});

describe('§D — the fixture, whole', () => {
  test('D1 nothing refused: every node on the page has a rule', () => {
    // The report's own positive sentence — a `not.toContain('refusal')` matched its boilerplate,
    // and `'was dropped'` matches the paragraph that explains markers. Presence, not absence.
    const report = fileOf(app, 'EXPORT-REPORT.md');
    expect(report).toContain('Every node and every wire in this project had a translation, and the export refused none of them.');
    expect(report).not.toContain('(deferred to');
    expect(home(app)).not.toContain('TODO(export)');
  });

  test('D2 the emitted app typechecks', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  test('D3 every emitted file parses', () => {
    for (const [name, source] of Object.entries(app.files)) {
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.ES2022, true, name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const diagnostics = (parsed as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics;
      expect(diagnostics.map((d) => `${name}: ${d.messageText}`)).toEqual([]);
    }
  });

  test('D4 the two sites, counted: two api-call handlers in the page, both verbs in the module, both request functions on the client', () => {
    expect(home(app).match(/await setUserProperties\(/g)).toHaveLength(1);
    expect(home(app).match(/await requestMagicLink\(/g)).toHaveLength(1);
    expect(sessionApi(app).match(/^export async function /gm)).toHaveLength(3);
    expect(client(app).match(/^export async function (updateUserRequest|requestMagicLinkRequest)\(/gm)).toHaveLength(2);
  });
});
