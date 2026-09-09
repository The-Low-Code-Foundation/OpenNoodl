/**
 * The user family (EXP-002-USER-FAMILY-TARGET-OUTPUT): Log In / Log Out / Sign Up / User.
 *
 * The fixture is `puppy-test-3` again, and again it already carries the corpus's own idiom
 * verbatim (§7): `Pages/Admin Login` is the whole Log In shape — two text inputs into the
 * credentials, a button into `Do`, `done → RouterNavigate`, `error → Text.text` — and
 * `Pages/Admin` carries Log Out with **no Error wire at all**, which is the case the record
 * verbs never exercised and no hand-authored fixture would have thought to include.
 *
 * ⚠️ The fixture's `User` node feeds a Condition, and that used to be the end of it: the
 * Condition deferred on its own gate, so the session *read* was graded by asserting it resolved
 * and left nothing behind. LOGIC-TARGET §10 translated the reactive Condition, so the auth gate
 * now lands — the read is graded by the effect it earns, and the nothing-behind case is built by
 * cutting the Condition's arm rather than read off the untouched fixture.
 *
 * Every §5 gate is exercised by mutating the parsed IR, the controlled-state suite's method.
 */
import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'puppy-test-3');

const catalog: Catalog = loadCatalog();
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);

// EXP-009: the fixture declares its backend, so `app` above is the *connected* form. The stub
// semantics this file pins are the no-backend form (AC7) — strip metadata.cloudservices and the
// api files are byte-for-byte what this emitted before EXP-009.
const withoutBackend = (): ExportIR => {
  const ir = structuredClone(baseIr);
  delete ir.project.cloudservices;
  return ir;
};
const stubApp = emitApp(withoutBackend(), catalog);

const LOGIN_PAGE = 'Pages/Admin Login';
const ADMIN = 'Pages/Admin';

const cloneIr = (): ExportIR => structuredClone(baseIr);
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

const fileOf = (built: ReturnType<typeof emitApp>, name: string): string => built.files[name];
const loginSource = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/pages/AdminLogin.tsx');
const adminSource = (built: ReturnType<typeof emitApp>): string => fileOf(built, 'src/pages/Admin.tsx');
const sessionApi = (built: ReturnType<typeof emitApp>): string | undefined => fileOf(built, 'src/api/session.ts');

/** The deferral reason the planner recorded for one node. */
const reasonFor = (source: ExportIR, componentPath: string, nodeId: string): string | undefined => {
  const project = planProject(source, new CatalogIndex(catalog));
  const plan = project.plans.find((p) => p.path === componentPath)!;
  const disposition = plan.dispositions[nodeId] as { kind: string; reason?: string };
  return disposition?.kind === 'deferred' ? disposition.reason : undefined;
};

describe('§4a — Log In: the whole idiom, awaited', () => {
  test('the submit handler is async, awaits the call, and runs the done chain inside the try', () => {
    expect(loginSource(app)).toContain(
      [
        '          onClick={async () => {',
        '            try {',
        '              await logIn(usernameInput, passwordInput);',
        "              navigate('/admin');",
        '            } catch (error) {',
        '              const logInActionErrorMessage = error instanceof Error ? error.message : String(error);',
        '              setLogInActionError(logInActionErrorMessage);',
        // EXP-011 §54. login.ts raises user/log-in-failed before the failure pulse; the export raises after the row, before nothing.
        "              raiseAppError({ code: 'user/log-in-failed', message: logInActionErrorMessage, nodeId: 'login', nodeType: 'net.noodl.user.LogIn', componentName: '/Pages/Admin Login' });",
        '            }',
        '          }}'
      ].join('\n')
    );
  });

  test('the credentials earn control state from the button handler — §3 third clause', () => {
    // `onTextChanged` resolves to `input-text`, legal only inside that input's own handler; the
    // submit reads both fields from the *button's*. Without §3's clause both wires die.
    const source = loginSource(app);
    expect(source).toContain("const [usernameInput, setUsernameInput] = useState<string>('');");
    expect(source).toContain("const [passwordInput, setPasswordInput] = useState<string>('');");
    expect(source).toContain('onChange={(event) => setUsernameInput(event.target.value)}');
  });

  test('the Error output is a state row nothing clears, and the status line reads it', () => {
    const source = loginSource(app);
    expect(source).toContain('const [logInActionError, setLogInActionError] = useState<string | undefined>();');
    expect(source).toContain("<p className={styles.errorText}>{logInActionError ?? ''}</p>");
    // The runtime keeps the message after a later attempt succeeds, so no success path clears it.
    expect(source).not.toContain('setLogInActionError(undefined)');
  });
});

describe('§4b — Log Out, and the Error row nothing reads', () => {
  test('Log Out awaits a no-argument call and navigates inside the try', () => {
    expect(adminSource(app)).toContain(
      [
        '            try {',
        '              await logOut();',
        "              navigate('/admin-login');",
        '            } catch (error) {'
      ].join('\n')
    );
  });

  test('its Error row is allocated and written although no wire reads it — the writer is a reference', () => {
    // Every corpus Log Out leaves `error` unwired; the record verbs never exercised this,
    // because all three of theirs feed a status Text.
    const source = adminSource(app);
    expect(source).toContain('const [logOutActionError, setLogOutActionError] = useState<string | undefined>();');
    expect(source).toContain('const logOutActionErrorMessage = error instanceof Error ? error.message : String(error);');
    expect(source).toContain('setLogOutActionError(logOutActionErrorMessage);');
    expect(source).toContain("raiseAppError({ code: 'user/log-out-failed', message: logOutActionErrorMessage, nodeId: 'logout', nodeType: 'net.noodl.user.LogOut', componentName: '/Pages/Admin' });");
    // …and nothing renders it, which is exactly the runtime's `_internal.error` with no reader.
    expect(source).not.toContain('{logOutActionError');
  });
});

describe('§4d — the session api stub: one module, writes throw, the read answers signed-out', () => {
  test('both verbs land in one src/api/session.ts with the shared SessionUser type', () => {
    const api = sessionApi(app)!;
    expect(api).toContain('export interface SessionUser {\n  id: string;\n  username?: string;\n  email?: string;\n}');
    expect(api).toContain('export async function logIn(username: string, password: string): Promise<SessionUser> {');
    expect(api).toContain('export async function logOut(): Promise<void> {');
  });

  test('a write stub throws — a fabricated successful sign-in is a plausible state of nothing', () => {
    const api = sessionApi(stubApp)!;
    expect(api).toContain("throw new Error('logIn is not connected to a backend yet');");
    expect(api).toContain("throw new Error('logOut is not connected to a backend yet');");
  });

  test('each export carries its call site, node type and component', () => {
    expect(sessionApi(stubApp)!).toContain(
      'TODO(export): "Log In Action" (net.noodl.user.LogIn `login` on /Pages/Admin Login)'
    );
  });

  test('the page imports exactly the functions it calls', () => {
    expect(loginSource(app)).toContain("import { logIn } from '../api/session';");
    expect(adminSource(app)).toContain("import { logOut, useSession } from '../api/session';");
  });
});

describe('§4c — the User node: a session read, earned by a surviving expression', () => {
  test('a read that lands nowhere emits no useSession', () => {
    // ⚠️ This was read off the untouched fixture until LOGIC-TARGET §10 translated the reactive Condition:
    // `authenticated → Condition.condition → onfalse → navigate` is now an auth-gate effect, so
    // the fixture's read *does* land. The rule under test is unchanged and still needs a
    // negative control, so the nowhere-landing case is now built rather than found — cut the
    // Condition's only arm and it goes back to driving nothing.
    const ir = cloneIr();
    unwire(ir, ADMIN, 'authGate:onfalse->navigateNotAuth:navigate');
    const built = emitApp(ir, catalog);
    expect(sessionApi(built)).not.toContain('useSession');
    expect(adminSource(built)).not.toContain('const session = useSession()');
  });

  test('and the fixture as authored does land it — the auth gate is the read', () => {
    // The positive half of the pair, on the same fixture the assertion above used to read.
    expect(sessionApi(app)!).toContain('useSession');
    expect(adminSource(app)).toContain('const session = useSession();');
    expect(adminSource(app)).toContain("if (!session.authenticated) navigate('/admin-login');");
  });

  test('given a rendered sink, the read becomes one useSession local read at each site', () => {
    const ir = cloneIr();
    unwire(ir, ADMIN, 'userCheck:authenticated->authGate:condition');
    wire(ir, ADMIN, 'userCheck', 'username', 'titleText', 'text');
    wire(ir, ADMIN, 'userCheck', 'authenticated', 'listCard', 'visible');
    const built = emitApp(ir, catalog);
    const source = adminSource(built);
    expect(source).toContain('const session = useSession();');
    expect(source.match(/useSession\(\)/g)).toHaveLength(1);
    // `username` is absent while nobody is signed in and folds like any maybe-undefined read.
    expect(source).toContain("{session.user?.username ?? ''}");
    // `authenticated` is `model !== undefined` in the runtime — a real boolean, no fold.
    expect(source).toContain('!session.authenticated && styles.hiddenKeepSpace');
    expect(sessionApi(built)!).toContain(
      'export function useSession(): { authenticated: boolean; user: SessionUser | null } {'
    );
    expect(sessionApi(built)!).toContain('return { authenticated: false, user: null };');
  });

  test('the read stub is the module\'s only non-throwing export', () => {
    const ir = withoutBackend();
    unwire(ir, ADMIN, 'userCheck:authenticated->authGate:condition');
    wire(ir, ADMIN, 'userCheck', 'username', 'titleText', 'text');
    const api = sessionApi(emitApp(ir, catalog))!;
    // Consistent with the writes: nobody can sign in while `logIn` throws, so signed-out is not
    // merely plausible — it is the only state reachable through this module (§4c.2).
    expect(api).not.toContain("throw new Error('useSession");
    expect(api).toContain("throw new Error('logOut is not connected to a backend yet');");
  });
});

describe('§5 — the gates, each deferring with its named reason', () => {
  test('5.1 an unwired trigger defers, and takes the api export with it', () => {
    const ir = cloneIr();
    unwire(ir, LOGIN_PAGE, 'loginBtn:onClick->login:login');
    const built = emitApp(ir, catalog);
    expect(reasonFor(ir, LOGIN_PAGE, 'login')).toBe('its Do is never fired by a translatable trigger');
    // Earned by attachment: a compiled verb that never attached leaves no stub export behind.
    expect(sessionApi(built)).not.toContain('logIn');
    expect(loginSource(built)).not.toContain("from '../api/session'");
  });

  test('5.2 two wires into one credential defer — last-writer-wins is not statically ordered', () => {
    const ir = cloneIr();
    wire(ir, LOGIN_PAGE, 'passwordInput', 'onTextChanged', 'login', 'username');
    expect(reasonFor(ir, LOGIN_PAGE, 'login')).toBe(
      'two wires feed username — last-writer-wins is not statically ordered'
    );
  });

  test('5.4 a consumed failure or completed defers — only done and Error are translated', () => {
    for (const port of ['failure', 'completed']) {
      const ir = cloneIr();
      wire(ir, LOGIN_PAGE, 'login', port, 'navigate', 'navigate', 'signal');
      expect(reasonFor(ir, LOGIN_PAGE, 'login')).toBe(
        `its ${port} output is consumed — only the done chain and the Error value are translated in this slice`
      );
    }
  });

  test('5.6 a wired Fetch defers the session read — a re-read is an invocation', () => {
    const ir = cloneIr();
    unwire(ir, ADMIN, 'userCheck:authenticated->authGate:condition');
    wire(ir, ADMIN, 'userCheck', 'username', 'titleText', 'text');
    wire(ir, ADMIN, 'logoutBtn', 'onClick', 'userCheck', 'fetch', 'signal');
    const built = emitApp(ir, catalog);
    expect(sessionApi(built)).not.toContain('useSession');
    expect(adminSource(built)).not.toContain('const session = useSession()');
  });

  test('5.7 Run On Value Change unticked defers — the subscription is switched off', () => {
    const ir = cloneIr();
    unwire(ir, ADMIN, 'userCheck:authenticated->authGate:condition');
    wire(ir, ADMIN, 'userCheck', 'username', 'titleText', 'text');
    setParam(nodeOf(ir, ADMIN, 'userCheck'), 'runOnChange-user', lit(false));
    expect(adminSource(emitApp(ir, catalog))).not.toContain('const session = useSession()');
    // Absent means ticked, so the untouched fixture must NOT take this gate.
    const clean = cloneIr();
    unwire(clean, ADMIN, 'userCheck:authenticated->authGate:condition');
    wire(clean, ADMIN, 'userCheck', 'username', 'titleText', 'text');
    expect(adminSource(emitApp(clean, catalog))).toContain('const session = useSession()');
  });

  test('5.8 a consumed Fetch-path output defers the read with a named reason', () => {
    const ir = cloneIr();
    unwire(ir, ADMIN, 'userCheck:authenticated->authGate:condition');
    wire(ir, ADMIN, 'userCheck', 'username', 'titleText', 'text');
    wire(ir, ADMIN, 'userCheck', 'fetched', 'navigateLogout', 'navigate', 'signal');
    expect(adminSource(emitApp(ir, catalog))).not.toContain('const session = useSession()');
  });

  test('5.9 a named Backend defers the read — one session module is all this slice emits', () => {
    const ir = cloneIr();
    unwire(ir, ADMIN, 'userCheck:authenticated->authGate:condition');
    wire(ir, ADMIN, 'userCheck', 'username', 'titleText', 'text');
    setParam(nodeOf(ir, ADMIN, 'userCheck'), 'backendId', lit('other'));
    expect(adminSource(emitApp(ir, catalog))).not.toContain('const session = useSession()');
  });

  test('5.10 a consumed _User column defers — the session stub carries no user schema', () => {
    const ir = cloneIr();
    unwire(ir, ADMIN, 'userCheck:authenticated->authGate:condition');
    wire(ir, ADMIN, 'userCheck', 'prop-nickname', 'titleText', 'text');
    expect(adminSource(emitApp(ir, catalog))).not.toContain('const session = useSession()');
  });
});

describe('§4e — the shared action generalised, not altered', () => {
  test('a user verb and a record verb emit the same try/catch shape from one action kind', () => {
    // The record verbs' goldens elsewhere in the suite pin their text byte-for-byte; this is the
    // other half of the claim — the same printer produces both. Asserted as fixed substrings
    // rather than one spanning regex: `(\s+.*\n)*` over a whole page backtracks catastrophically
    // and hangs the runner, which is a property of the assertion and not of the emitter.
    const catchLine = '} catch (error) {';
    for (const [source, call, setter] of [
      [loginSource(app), 'await logIn(usernameInput, passwordInput);', 'setLogInActionError('],
      [adminSource(app), 'await logOut();', 'setLogOutActionError('],
      [adminSource(app), 'await createPuppy({', 'setCreatePuppyError(']
    ] as const) {
      expect(source).toContain('try {');
      expect(source).toContain(call);
      expect(source).toContain(catchLine);
      // EXP-011 §54. The message is a local now — the Error row reads it, and so does the raise on the error channel.
      const local = setter.slice('set'.length, -1);
      const messageLocal = `${local.charAt(0).toLowerCase()}${local.slice(1)}Message`;
      expect(source).toContain(`const ${messageLocal} = error instanceof Error ? error.message : String(error);`);
      expect(source).toContain(`${setter}${messageLocal});`);
    }
  });
});
