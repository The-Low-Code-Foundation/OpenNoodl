/**
 * ERG-001 §4 — the outcome contract on the Cloud Services family, viewer half.
 *
 * See `dev-docs/reference/OUTCOME-CONTRACT.md` for the decision and `ERG-001-S0-MEASUREMENT.md`
 * §0.1 for the ground. The four `noodl-runtime` sources in this family are in
 * `packages/noodl-runtime/test/corpus/erg-001-cloud-services-outcomes.test.ts`; these seven live
 * here. All seven are pure renames of `success` → `done` plus the universal `completed`.
 *
 * | Node | Action | Note |
 * |---|---|---|
 * | `net.noodl.user.LogIn` | `Do` | |
 * | `net.noodl.user.LogOut` | `Do` | the input is named `login`, which cannot be corrected without breaking projects |
 * | `net.noodl.user.SignUp` | `Do` | |
 * | `net.noodl.user.RequestMagicLink` | `Do` | |
 * | `net.noodl.user.SignInWith` | `Do` | ⚠️ **two roles**, see below |
 * | `CloudFunction2` | `Call` | |
 * | `Upload File` | `Upload` | `Progress Changed` is not an outcome and is left alone |
 *
 * ## ⚠️ `Sign In With` is the one node in the family the contract's exception applies to
 *
 * Its own docblock says it is two things: a **launcher** (`Do` hands over to the provider and
 * the browser leaves the document) and a **receiver** (a *later page load*, in a fresh graph,
 * discovers the result). So:
 *
 * - **The launcher's successful handover reports nothing**, and this is the contract's *"one real
 *   exception"* applied literally — `window.location.href` replaces the document, so there is no
 *   downstream node left to observe a pulse. Its refusals (no backend, no provider set) are
 *   synchronous and *do* report, because on those paths nothing navigates.
 * - **The receiver mints its own token.** ⚠️ This is the one place in the phase where something
 *   other than a port opens an invocation, and it is not the rule's target: "only the port mints"
 *   exists to stop setter and mount paths *duplicating* a port's outcome, and here there is no
 *   port invocation in this graph to duplicate. The return leg is the only place the answer can
 *   be known.
 *
 * The navigation slice deliberately kept `Done` on its navigating path and the difference is
 * worth stating: a `Navigate` node in a nav bar *outside* the Router demonstrably survives, so a
 * silent `Completed` there would defeat Rule 2. Nothing survives a cross-origin redirect.
 *
 * ## No `Unchanged` anywhere in this family, and each absence is measured
 *
 * `logIn`, `logOut`, `signUp` and `requestMagicLink` all reach the backend unconditionally —
 * `ParseAuthAdapter.logOut` POSTs `/logout` even with no stored session, so even "log out when
 * nobody is signed in" is not a local no-op. A cloud function runs whatever it is given; an
 * upload uploads. "A node that cannot be a no-op gets no `Unchanged` port."
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | the `done` rename on any one node | that node's rows; each carries a `not.toContain('success')` clause so the rename cannot pass vacuously |
 * | `Sign In With`'s launcher reporting `done` on the handover path | the handover-is-silent row only; its two refusal rows are the controls |
 * | the token minted inside `scheduleLogIn`'s guard rather than before it | the two-pulses row on `Log In` only |
 * | `Upload File`'s `progressChanged` routed through `reportOutcome` | the progress-is-not-an-outcome row only |
 */

/* eslint-env jest */

/**
 * `UserService` is lazily constructed and its constructor reaches for
 * `NoodlRuntime.instance.getMetaData` — see `nda-004-user-auth-error-channel.test.ts` for why
 * that has to be mocked wholesale rather than stubbed around. Here it is also the *seam*: every
 * row settles the success or error callback by hand, because what is under test is what the node
 * does with an answer rather than whether the backend gives one.
 */
jest.mock('../../src/nodes/std-library/user/userservice', () => ({
  __esModule: true,
  default: {
    get instance() {
      return mockUserService;
    }
  }
}));

jest.mock('@noodl/runtime', () => ({
  __esModule: true,
  default: {
    instance: { getMetaData: (key: string) => mockMetadata[key] }
  }
}));

import type { NodeInstance, NodeModule } from '@noodl/types';

import CloudStore from '@noodl/runtime/src/api/cloudstore';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import CloudFunction2Module from '../../src/nodes/std-library/data/cloudfunction2';
import LogInModule from '../../src/nodes/std-library/user/login';
import LogOutModule from '../../src/nodes/std-library/user/logout';
import RequestMagicLinkModule from '../../src/nodes/std-library/user/requestmagiclink';
import SignInWithModule from '../../src/nodes/std-library/user/signinwith';
import SignUpModule from '../../src/nodes/std-library/user/signup';
import UploadFileModule from '../../src/nodes/std-library/uploadfile';

// =================================================================================================
// Doubles
// =================================================================================================

interface ServiceCall {
  method: string;
  options: { success?(response?: unknown): void; error?(error?: string): void } & Record<string, unknown>;
}

interface OAuthState {
  inProgress?: boolean;
  succeeded?: boolean;
  error?: string;
  notice?: string;
}

const mockMetadata: Record<string, unknown> = {};

const mockUserService: Record<string, unknown> & {
  calls: ServiceCall[];
  oauthReturn: OAuthState;
  listeners: Array<(state: OAuthState) => void>;
} = {
  calls: [],
  oauthReturn: { inProgress: false },
  listeners: [],
  on(_event: string, listener: (state: OAuthState) => void) {
    mockUserService.listeners.push(listener);
  },
  logIn: (options: ServiceCall['options']) => mockUserService.calls.push({ method: 'logIn', options }),
  logOut: (options: ServiceCall['options']) => mockUserService.calls.push({ method: 'logOut', options }),
  signUp: (options: ServiceCall['options']) => mockUserService.calls.push({ method: 'signUp', options }),
  requestMagicLink: (options: ServiceCall['options']) =>
    mockUserService.calls.push({ method: 'requestMagicLink', options }),
  signInWithProvider: (options: ServiceCall['options']) =>
    mockUserService.calls.push({ method: 'signInWithProvider', options })
};

function lastCall(method: string): ServiceCall {
  const found = mockUserService.calls.filter((c) => c.method === method);
  if (found.length === 0) throw new Error('no ' + method + ' call was made');
  return found[found.length - 1];
}

/** A minimal XHR, because the viewer's jest environment is `node` and cloud functions use one. */
class FakeXhr {
  static last: FakeXhr | undefined;
  static status = 200;
  static response = JSON.stringify({ result: { total: 7 } });

  readyState = 0;
  status = 0;
  response = '';
  onreadystatechange: (() => void) | null = null;
  sent: unknown;

  constructor() {
    FakeXhr.last = this;
  }
  open(): void {
    /* the row asserts on the node's reaction, not on the URL */
  }
  setRequestHeader(): void {}
  send(body: unknown): void {
    this.sent = body;
    this.readyState = 4;
    this.status = FakeXhr.status;
    this.response = FakeXhr.response;
    this.onreadystatechange && this.onreadystatechange();
  }
}

beforeEach(() => {
  mockUserService.calls = [];
  mockUserService.listeners = [];
  mockUserService.oauthReturn = { inProgress: false };
  for (const key of Object.keys(mockMetadata)) delete mockMetadata[key];
  FakeXhr.status = 200;
  FakeXhr.response = JSON.stringify({ result: { total: 7 } });
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = FakeXhr;
});

afterEach(() => {
  jest.restoreAllMocks();
  delete (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
});

async function graphWith(module: unknown, type: string, parameters: Record<string, unknown> = {}): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [module as NodeModule],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'node', type, parameters }], connections: [] }]
    } as never
  });
  await graph.settle(2);
  return graph;
}

function outcomesOf(graph: CorpusGraph, id = 'node'): string[] {
  return graph.signalsFor(id).filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function pulse(graph: CorpusGraph, port: string, id = 'node'): void {
  const node = graph.node(id);
  node.setInputValue(port, false);
  node.setInputValue(port, true);
}

// =================================================================================================
// The four service-backed user nodes, which are the same shape four times
// =================================================================================================

const SERVICE_NODES: Array<{
  label: string;
  module: unknown;
  type: string;
  port: string;
  method: string;
  code: string;
}> = [
  { label: 'Log In', module: LogInModule, type: 'net.noodl.user.LogIn', port: 'login', method: 'logIn', code: 'user/log-in-failed' },
  // ⚠️ The input really is called `login` on Log Out: the port name is persisted in every
  // project that uses the node, so it could not be corrected. Named here rather than silently
  // copied, because a reader hunting a typo would otherwise "fix" it.
  { label: 'Log Out', module: LogOutModule, type: 'net.noodl.user.LogOut', port: 'login', method: 'logOut', code: 'user/log-out-failed' },
  { label: 'Sign Up', module: SignUpModule, type: 'net.noodl.user.SignUp', port: 'signup', method: 'signUp', code: 'user/sign-up-failed' },
  {
    label: 'Request Magic Link',
    module: RequestMagicLinkModule,
    type: 'net.noodl.user.RequestMagicLink',
    port: 'send',
    method: 'requestMagicLink',
    code: 'user/request-magic-link-failed'
  }
];

describe.each(SERVICE_NODES)('ERG-001 §4: $label', ({ module, type, port, method, code }) => {
  test('a successful call reports Done then Completed, and no longer says "success"', async () => {
    const graph = await graphWith(module, type);
    pulse(graph, port);
    await graph.settle(2);

    lastCall(method).options.success!({});
    await graph.settle(2);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals).toContain('completed');
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
    // The rename cannot pass vacuously: the old wire name must be gone, not merely unasserted.
    expect(signals).not.toContain('success');
  });

  test('a refused call reports Failure with its code, then Completed', async () => {
    const graph = await graphWith(module, type);
    pulse(graph, port);
    await graph.settle(2);

    lastCall(method).options.error!('Invalid credentials');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.errors.map((e) => e.code)).toEqual([code]);
    expect(graph.errors[0].message).toBe('Invalid credentials');
    expect(graph.node('node').getOutput('error').value).toBe('Invalid credentials');
  });

  /**
   * The coalescing guard drops the second pulse's *work* on purpose — that is how "set the
   * fields, then Do" batches. It must not drop the second pulse's *outcome*.
   */
  test('two Do pulses in one frame coalesce into one call and still report two outcomes', async () => {
    const graph = await graphWith(module, type);
    pulse(graph, port);
    pulse(graph, port);
    await graph.settle(2);

    expect(mockUserService.calls.filter((c) => c.method === method)).toHaveLength(1);
    lastCall(method).options.success!({});
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['done', 'done']);
    expect(graph.signalsFor('node').filter((s) => s === 'completed')).toHaveLength(2);
  });

  // ✅ Pinned control. Nobody has pressed Do.
  test('(pinned control) booting reports no outcome and raises nothing', async () => {
    const graph = await graphWith(module, type);
    await graph.settle(4);

    expect(graph.signalsFor('node')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });

  // ✅ Pinned control. Every one of these reaches the backend unconditionally — even
  // `logOut` POSTs `/logout` with no stored session — so none can be a no-op.
  test('(pinned control) has no Unchanged port, and does have Completed', async () => {
    const graph = await graphWith(module, type);
    expect(graph.node('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node('node').hasOutput('completed')).toBe(true);
  });
});

// =================================================================================================
// Sign In With — the launcher and the receiver
// =================================================================================================

describe('ERG-001 §4: Sign In With', () => {
  /**
   * ⚠️ The contract's one real exception, applied literally.
   *
   * `signInWithProvider` refuses synchronously or sets `window.location.href`; there is no
   * success callback because there is no success to report on this side of the redirect. So an
   * accepted handover reports nothing, and this row is what says so out loud rather than leaving
   * it as an absence somebody later "fixes" into a misleading `Done`.
   */
  test('an accepted handover reports nothing at all — the browser leaves the document', async () => {
    const graph = await graphWith(SignInWithModule, 'net.noodl.user.SignInWith', { provider: 'github' });
    pulse(graph, 'signIn');
    await graph.settle(2);

    expect(mockUserService.calls.filter((c) => c.method === 'signInWithProvider')).toHaveLength(1);
    expect(outcomesOf(graph)).toEqual([]);
    expect(graph.signalsFor('node')).not.toContain('completed');
  });

  test('a refused handover reports Failure and Completed, because nothing navigated', async () => {
    const graph = await graphWith(SignInWithModule, 'net.noodl.user.SignInWith');
    pulse(graph, 'signIn');
    await graph.settle(2);

    lastCall('signInWithProvider').options.error!('Sign In With: no provider was set.');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.errors.map((e) => e.code)).toEqual(['user/sign-in-with-failed']);
  });

  test('a return leg that succeeded reports Done and Completed, and no longer says "success"', async () => {
    const graph = await graphWith(SignInWithModule, 'net.noodl.user.SignInWith');
    // What a *later page load* looks like: `UserService` resolves the parked flow and emits.
    mockUserService.listeners.forEach((l) => l({ succeeded: true, notice: 'Your old password was revoked' }));
    await graph.settle(2);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals).toContain('completed');
    expect(signals).not.toContain('success');
    expect(graph.node('node').getOutput('notice').value).toBe('Your old password was revoked');
  });

  test('a return leg that failed reports Failure and Completed', async () => {
    const graph = await graphWith(SignInWithModule, 'net.noodl.user.SignInWith');
    mockUserService.listeners.forEach((l) => l({ succeeded: false, error: 'The provider refused' }));
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.errors.map((e) => e.code)).toEqual(['user/sign-in-with-failed']);
  });

  /**
   * ⚠️ `inProgress` is a *state*, not a terminal outcome — it sets `Signing In` and waits. A
   * token minted for it would still be open when the real answer arrived, and the second report
   * would raise `outcome/duplicate`. This row reads the absence of one.
   */
  test('an in-progress return reports no outcome, then exactly one when it settles', async () => {
    const graph = await graphWith(SignInWithModule, 'net.noodl.user.SignInWith');

    mockUserService.listeners.forEach((l) => l({ inProgress: true }));
    await graph.settle(2);
    expect(outcomesOf(graph)).toEqual([]);
    expect(graph.node('node').getOutput('signingIn').value).toBe(true);

    mockUserService.listeners.forEach((l) => l({ succeeded: true }));
    await graph.settle(2);
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(graph.errors.map((e) => e.code)).not.toContain('outcome/duplicate');
  });

  test('(pinned control) has no Unchanged port, and does have Completed', async () => {
    const graph = await graphWith(SignInWithModule, 'net.noodl.user.SignInWith');
    expect(graph.node('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node('node').hasOutput('completed')).toBe(true);
  });
});

// =================================================================================================
// Cloud Function
// =================================================================================================

describe('ERG-001 §4: Cloud Function', () => {
  test('a function that returned reports Done then Completed, and no longer says "success"', async () => {
    mockMetadata.cloudservices = { appId: 'app', endpoint: 'https://api.test' };

    const graph = await graphWith(CloudFunction2Module, 'CloudFunction2');
    graph.node('node').registerInputIfNeeded('function');
    graph.node('node').setInputValue('function', 'countThings');
    pulse(graph, 'call');
    await graph.settle(2);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals).toContain('completed');
    expect(signals).not.toContain('success');
  });

  test('a project with no cloud services reports Failure with its code, then Completed', async () => {
    const graph = await graphWith(CloudFunction2Module, 'CloudFunction2');
    pulse(graph, 'call');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.errors.map((e) => e.code)).toEqual(['cloud-function/call-failed']);
  });

  test('a function that answered with an error reports Failure, then Completed', async () => {
    mockMetadata.cloudservices = { appId: 'app', endpoint: 'https://api.test' };
    FakeXhr.status = 500;
    FakeXhr.response = JSON.stringify({ error: 'Boom' });

    const graph = await graphWith(CloudFunction2Module, 'CloudFunction2');
    graph.node('node').registerInputIfNeeded('function');
    graph.node('node').setInputValue('function', 'countThings');
    pulse(graph, 'call');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.errors[0].message).toBe('Boom');
  });

  test('(pinned control) has no Unchanged port, and does have Completed', async () => {
    const graph = await graphWith(CloudFunction2Module, 'CloudFunction2');
    expect(graph.node('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node('node').hasOutput('completed')).toBe(true);
  });
});

// =================================================================================================
// Upload File
// =================================================================================================

describe('ERG-001 §4: Upload File', () => {
  function stubStore(impl: Record<string, unknown> | undefined): void {
    jest
      .spyOn(CloudStore as unknown as { forBackend: (...a: unknown[]) => unknown }, 'forBackend')
      .mockReturnValue(impl as never);
  }

  test('a stored file reports Done then Completed, and no longer says "success"', async () => {
    stubStore({
      uploadFile: (options: { success(r: unknown): void }) =>
        options.success({ name: 'a.png', url: 'https://example.test/a.png' })
    });

    const graph = await graphWith(UploadFileModule, 'Upload File');
    graph.node('node').setInputValue('file', { name: 'a.png' });
    pulse(graph, 'upload');
    await graph.settle(2);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals).toContain('completed');
    expect(signals).not.toContain('success');
  });

  test('uploading with no file reports Failure once, with its code, then Completed', async () => {
    const graph = await graphWith(UploadFileModule, 'Upload File');
    pulse(graph, 'upload');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.errors.map((e) => e.code)).toEqual(['upload-file/upload-failed']);
    expect(graph.errors[0].message).toBe('No file specified');
  });

  /** Same shape as `Sign File URL`'s: `cloudStore()` reports and the caller returns. */
  test('an unknown backend reports exactly one Failure — no outcome/duplicate', async () => {
    stubStore(undefined);

    const graph = await graphWith(UploadFileModule, 'Upload File');
    graph.node('node').setInputValue('file', { name: 'a.png' });
    pulse(graph, 'upload');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.errors.map((e) => e.code)).not.toContain('outcome/duplicate');
  });

  /**
   * ⚠️ `Progress Changed` is a value-level announcement, exactly as `Fetched` is on `Record`.
   * It fires many times per invocation, so folding it into the outcome would break "exactly
   * one" on the very first upload big enough to report progress.
   */
  test('Progress Changed is not an outcome — it fires repeatedly and Done still fires once', async () => {
    stubStore({
      uploadFile: (options: {
        onUploadProgress(p: { total: number; loaded: number }): void;
        success(r: unknown): void;
      }) => {
        options.onUploadProgress({ total: 100, loaded: 50 });
        options.onUploadProgress({ total: 100, loaded: 100 });
        options.success({ name: 'a.png', url: 'https://example.test/a.png' });
      }
    });

    const graph = await graphWith(UploadFileModule, 'Upload File');
    graph.node('node').setInputValue('file', { name: 'a.png' });
    pulse(graph, 'upload');
    await graph.settle(2);

    const signals = graph.signalsFor('node');
    expect(signals.filter((s) => s === 'progressChanged')).toHaveLength(2);
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals.filter((s) => s === 'completed')).toHaveLength(1);
  });

  test('(pinned control) has no Unchanged port, and does have Completed', async () => {
    const graph = await graphWith(UploadFileModule, 'Upload File');
    expect(graph.node('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node('node').hasOutput('completed')).toBe(true);
  });
});

// =================================================================================================
// The family-wide shape
// =================================================================================================

describe('ERG-001 §4: the viewer half of the family, as a set', () => {
  const FAMILY: Array<{ label: string; module: unknown; type: string }> = [
    { label: 'Log In', module: LogInModule, type: 'net.noodl.user.LogIn' },
    { label: 'Log Out', module: LogOutModule, type: 'net.noodl.user.LogOut' },
    { label: 'Sign Up', module: SignUpModule, type: 'net.noodl.user.SignUp' },
    { label: 'Request Magic Link', module: RequestMagicLinkModule, type: 'net.noodl.user.RequestMagicLink' },
    { label: 'Sign In With', module: SignInWithModule, type: 'net.noodl.user.SignInWith' },
    { label: 'Cloud Function', module: CloudFunction2Module, type: 'CloudFunction2' },
    { label: 'Upload File', module: UploadFileModule, type: 'Upload File' }
  ];

  test.each(FAMILY)('$label declares done, failure and completed and no longer declares success', async ({
    module,
    type
  }) => {
    const graph = await graphWith(module, type);
    const node = graph.node<NodeInstance>('node');

    expect(node.hasOutput('done')).toBe(true);
    expect(node.hasOutput('failure')).toBe(true);
    // "Completed is universal, and it is the one port with no exemption."
    expect(node.hasOutput('completed')).toBe(true);
    expect(node.hasOutput('success')).toBe(false);
  });
});
