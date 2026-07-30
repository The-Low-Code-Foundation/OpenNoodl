/**
 * NDA-004 §2 / FINDINGS B-iv — the eleven user-and-auth nodes whose diagnosis never left the editor.
 *
 * These nodes pass the register's `Fail?` column: `failure` and `error` are real ports and they
 * fire wherever the node runs. What they did *not* have was a diagnosis anywhere but the canvas.
 * Every one of them carried its own copy of the same `setError` helper, and every copy ended in
 * `editorConnection.sendWarning` — so a login that failed in a shipped app told the user's graph
 * "something went wrong" and told nobody at all *what*. Invisible to `On App Error`, to a deployed
 * console, to a cloud function's logs.
 *
 * That is the class's second half, and the register cannot see it: **a node can be
 * graph-observable and diagnostically mute.** `dbmodelcrudbase` was the first of the twenty-two
 * to move; these eleven are the largest remaining group and they are near-identical, which is why
 * they go as one batch.
 *
 * **Nine of the eleven are here.** `User` and `Set User Properties` live in `noodl-runtime` and
 * their rows are in that package's corpus half — not for tidiness but because they will not
 * compile here: `setuserproperties.ts` references `_noodl_cloud_runtime_version`, a build-time
 * global declared in `noodl-runtime`'s own typings, and this package's ts-jest does not see them.
 * Another instance of the standing rule that a cross-package source compiled under the viewer's
 * jest is compiled with the *viewer's* options.
 *
 * ## What these rows are actually testing
 *
 * The *channel*, not the trigger. Whether `UserService.logIn` rejects on a bad password is not in
 * question and would need a cloud backend to ask; what was broken is where the answer goes. So
 * each row calls the node's own `setError` — the single funnel every failure path in these files
 * routes through — and watches the two ends of the bus.
 *
 * ## The row that would not have been written from the fix alone
 *
 * `clearWarnings` is the second half of each change, and skipping it would have made things
 * *worse* than before. The bus's editor subscriber keys its warning by the raised **`code`**
 * (`runtimeerror.ts:177-186`), not by a key the call site picks. A `clearWarning` still naming the
 * old hand-written key therefore clears nothing, and the node accumulates a warning it can never
 * shed — a stale red mark on a node that has since succeeded. The round-trip rows below are the
 * ones that catch that, and reverting only the `clearWarnings` half reddens exactly them.
 */

/* eslint-env jest */

/**
 * `UserService` is lazily constructed on first read of `.instance`, and its constructor calls
 * `NoodlRuntime.instance.getMetaData('cloudservices')` — there is no `NoodlRuntime.instance` in
 * the corpus, so it throws. Eight of these nodes never notice, because they only reach for the
 * service inside their `schedule…` methods; **Sign In With touches it in `initialize`** (BAK-004's
 * return leg has to be picked up before any signal can fire), so the node threw before it existed
 * and all six of its rows reported "no node with id node" — which reads as a broken test rather
 * than a missing collaborator.
 *
 * Mocked wholesale rather than stubbed around, because these rows deliberately do not exercise any
 * sign-in operation: the claim under test is where a failure's diagnosis *goes*, and the service is
 * the thing that would produce one.
 */
jest.mock('../../src/nodes/std-library/user/userservice', () => ({
  __esModule: true,
  default: {
    instance: {
      on: () => {
        /* `oauthReturn`; nothing here emits it */
      },
      oauthReturn: { inProgress: false }
    }
  }
}));

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import LogInModule from '../../src/nodes/std-library/user/login';
import LogOutModule from '../../src/nodes/std-library/user/logout';
import RequestMagicLinkModule from '../../src/nodes/std-library/user/requestmagiclink';
import RequestPasswordResetModule from '../../src/nodes/std-library/user/requestpasswordreset';
import ResetPasswordModule from '../../src/nodes/std-library/user/resetpassword';
import SendEmailVerificationModule from '../../src/nodes/std-library/user/sendemailverification';
import SignInWithModule from '../../src/nodes/std-library/user/signinwith';
import SignUpModule from '../../src/nodes/std-library/user/signup';
import VerifyEmailModule from '../../src/nodes/std-library/user/verifyemail';

interface FailableInstance extends NodeInstance {
  _internal: { error?: string };
  setError(err: string): void;
  clearWarnings(): void;
}

/**
 * The whole batch, in the order FINDINGS B-iv lists them. `legacyKey` is the hand-written
 * `sendWarning` key each file used before this change; it is still cleared, deliberately, because
 * an editor session that was open when this landed can be holding a warning filed under it and
 * nothing else will ever come along to remove it.
 */
const NODES: Array<{ label: string; module: unknown; type: string; code: string; legacyKey: string }> = [
  { label: 'Log In', module: LogInModule, type: 'net.noodl.user.LogIn', code: 'user/log-in-failed', legacyKey: 'user-login-warning' },
  { label: 'Log Out', module: LogOutModule, type: 'net.noodl.user.LogOut', code: 'user/log-out-failed', legacyKey: 'user-login-warning' },
  { label: 'Sign Up', module: SignUpModule, type: 'net.noodl.user.SignUp', code: 'user/sign-up-failed', legacyKey: 'user-login-warning' },
  { label: 'Sign In With', module: SignInWithModule, type: 'net.noodl.user.SignInWith', code: 'user/sign-in-with-failed', legacyKey: 'user-signinwith-warning' },
  { label: 'Reset Password', module: ResetPasswordModule, type: 'net.noodl.user.ResetPassword', code: 'user/reset-password-failed', legacyKey: 'user-reset-password-warning' },
  { label: 'Request Password Reset', module: RequestPasswordResetModule, type: 'net.noodl.user.RequestPasswordReset', code: 'user/request-password-reset-failed', legacyKey: 'user-request-password-reset-warning' },
  { label: 'Request Magic Link', module: RequestMagicLinkModule, type: 'net.noodl.user.RequestMagicLink', code: 'user/request-magic-link-failed', legacyKey: 'user-magiclink-warning' },
  { label: 'Verify Email', module: VerifyEmailModule, type: 'net.noodl.user.VerifyEmail', code: 'user/verify-email-failed', legacyKey: 'user-verify-email-warning' },
  { label: 'Send Email Verification', module: SendEmailVerificationModule, type: 'net.noodl.user.SendEmailVerification', code: 'user/send-email-verification-failed', legacyKey: 'user-send-email-verification-warning' }
];

async function graphWith(module: unknown, type: string): Promise<CorpusGraph> {
  return createCorpusGraph({
    modules: [module as NodeModule],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'node', type, parameters: {} }], connections: [] }]
    } as never
  });
}

describe.each(NODES)('NDA-004 §2 / B-iv: $label', ({ module, type, code, legacyKey }) => {
  test('the diagnosis reaches the runtime channel, not just the editor', async () => {
    const graph = await graphWith(module, type);
    await graph.settle(2);

    graph.node<FailableInstance>('node').setError('Invalid credentials');
    await graph.settle(2);

    // `graph.errors` is the channel that exists in *every* runtime — a deployed app, a cloud
    // function, an export. Before this it was empty for all eleven of these nodes.
    const raised = graph.errors.filter((e) => e.code === code);
    expect(raised).toHaveLength(1);
    expect(raised[0].message).toBe('Invalid credentials');
    expect(raised[0].nodeId).toBe('node');
  });

  test('the graph surface still fires, and the Error output still carries the message', async () => {
    const graph = await graphWith(module, type);
    await graph.settle(2);

    graph.node<FailableInstance>('node').setError('Invalid credentials');
    await graph.settle(2);

    // This half was never broken and is pinned so that moving the channel cannot quietly cost it.
    expect(graph.signalsFor('node')).toContain('failure');
    expect(graph.node('node').hasOutput('failure')).toBe(true);
    expect(graph.node('node').hasOutput('error')).toBe(true);
    expect(graph.node('node').getOutput('error').value).toBe('Invalid credentials');
  });

  test('the editor keeps exactly what it had — a global warning carrying the message', async () => {
    const graph = await graphWith(module, type);
    await graph.settle(2);

    graph.node<FailableInstance>('node').setError('Invalid credentials');
    await graph.settle(2);

    // `createEditorWarningSubscriber` forwards to `sendWarning` with the identical
    // `{ showGlobally: true, message }` payload these files used to build by hand. Nothing about
    // the canvas experience changes; the point of the batch is what *else* now hears.
    const warnings = graph.editorConnection.warnings.filter((w) => w.nodeId === 'node');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].key).toBe(code);
    expect(warnings[0].message).toBe('Invalid credentials');
  });

  /**
   * The trap, and the reason each of these is two changes rather than one.
   */
  test('clearWarnings clears the warning the raise actually filed', async () => {
    const graph = await graphWith(module, type);
    await graph.settle(2);

    graph.node<FailableInstance>('node').setError('Invalid credentials');
    await graph.settle(2);
    expect(graph.editorConnection.hasWarningFor('node')).toBe(true);

    graph.node<FailableInstance>('node').clearWarnings();
    await graph.settle(2);

    // With `clearWarnings` still naming the old hand-written key this stays `true`, and the node
    // wears a warning it can never shed — worse than the defect being fixed.
    expect(graph.editorConnection.hasWarningFor('node')).toBe(false);
  });

  test('the legacy key is cleared too, for an editor session that predates this change', async () => {
    const graph = await graphWith(module, type);
    await graph.settle(2);

    // What a running editor would already be holding: a warning filed under the hand-written key,
    // which nothing else will ever remove now that the raise files under the code.
    graph.editorConnection.sendWarning('/root', 'node', legacyKey, { message: 'stale' });

    graph.node<FailableInstance>('node').clearWarnings();
    await graph.settle(2);

    expect(graph.editorConnection.hasWarningFor('node')).toBe(false);
  });

  // ✅ Pinned control. Constructing the node and letting the graph boot must raise nothing —
  // these are all `Do`-driven, and a diagnosis on the boot path is the Object node's defect.
  test('(pinned control) booting raises nothing on its own', async () => {
    const graph = await graphWith(module, type);
    await graph.settle(4);

    expect(graph.errors).toEqual([]);
    expect(graph.signalsFor('node')).toEqual([]);
    expect(graph.editorConnection.hasWarningFor('node')).toBe(false);
  });
});
