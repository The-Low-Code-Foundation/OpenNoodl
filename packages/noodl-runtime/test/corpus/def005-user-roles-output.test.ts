/**
 * DEF-005 (a) — the `User` node's read-only `Roles` output.
 *
 * 🧭 **Richard's ruling, 2026-08-30**: build it. Before this, `_Role` was a
 * system class with a fixed `nobody` posture whatever the config said, so no
 * browser query reached it and every membership app had to ship a bespoke
 * `myStanding` cloud function *just to decide whether to render a page*.
 *
 * The wire half of this — that the value is resolved by the server, from the
 * same JOIN enforcement uses, and grants nothing when a client rewrites it —
 * is graded over real HTTP in `nodegx-backend/tests/def005-membership.test.ts`.
 * **This file grades the port**: that it exists, that it carries the value
 * across a real connection, that it is read-only, and that it keeps three
 * answers apart rather than two.
 *
 * ## Why the rows connect a receiver rather than reading `getOutput(name).value`
 *
 * The same reason `fh-004-object-output.test.ts` gives, and it is load-bearing
 * here: an output's cached value is correct by the time an assertion runs
 * whether or not the graph ever delivered it. The defect being closed is a
 * graph that **could not branch**, so what has to be proved is that the value
 * crosses a wire into something that could branch on it.
 *
 * ## 🔴 The three-answer row is the one that would not be written from the fix
 *
 * `undefined` (nobody signed in, or a backend that does not track roles) and
 * `[]` (signed in, in no roles) are different facts. Collapsing them would make
 * *"we could not ask"* render as *"you are not a member"* — the confident-wrong
 * version of the exact screen this port exists to draw, and a regression that
 * every other row here would stay green through.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import NoodlRuntime = require('../../noodl-runtime');
import UserModule = require('../../src/nodes/std-library/user/user');

/**
 * A stand-in for the signed-in user record.
 *
 * The real one is whatever `/users/me` answered, stored by the auth adapter —
 * so `roles` is a key of that response and NOT a `_User` column, which is why
 * this fixture sets it beside `username` rather than through any schema.
 */
function userModel(data: Record<string, unknown>) {
  return {
    data,
    getId: () => 'user-1',
    get: (key: string) => data[key],
    on: () => {
      /* the node subscribes to `change`; nothing here emits it */
    },
    off: () => {
      /* ditto */
    }
  };
}

/**
 * `Services.UserService` is assigned by `noodl-viewer-react`, not by this
 * package — under this package's jest it is `undefined`, the node throws in
 * `initialize`, and every row reports "no node with id user", which reads as a
 * broken test rather than a missing collaborator. Same mock, same reason, as
 * `nda-004-user-auth-error-channel.test.ts`.
 */
const realUserService = (NoodlRuntime as { Services: { UserService?: unknown } }).Services.UserService;

/** What the mocked service will hand back as the signed-in user. Set per row. */
let currentUser: ReturnType<typeof userModel> | undefined;

beforeAll(() => {
  (NoodlRuntime as { Services: { UserService?: unknown } }).Services.UserService = {
    forScope: () => ({
      get current() {
        return currentUser;
      },
      currentFor: () => currentUser,
      on: () => {
        /* loggedIn / sessionGained / loggedOut / sessionLost; nothing here emits them */
      }
    })
  };
});

afterAll(() => {
  (NoodlRuntime as { Services: { UserService?: unknown } }).Services.UserService = realUserService;
});

/** Records whatever arrives on its `roles` input, and whether anything arrived at all. */
function recorderModule(seen: Array<{ roles: unknown }>): NodeModule {
  return {
    node: {
      name: 'test.RolesRecorder',
      category: 'Test',
      initialize: function (this: NodeInstance) {
        this._internal.values = {};
      },
      inputs: {
        roles: {
          type: '*',
          set: function (this: NodeInstance, v: unknown) {
            seen.push({ roles: v });
          }
        }
      },
      outputs: {}
    } as never
  };
}

async function graphWithUser(seen: Array<{ roles: unknown }>): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [UserModule as unknown as NodeModule, recorderModule(seen)],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'user', type: 'net.noodl.user.User', parameters: {} },
            { id: 'sink', type: 'test.RolesRecorder', parameters: {} }
          ],
          connections: [{ sourceId: 'user', sourcePort: 'roles', targetId: 'sink', targetPort: 'roles' }]
        }
      ]
    } as never
  });
  await graph.settle(3);
  return graph;
}

// ---------------------------------------------------------------------------
// 1. The port exists and is declared the way the catalog will publish it.
// ---------------------------------------------------------------------------

describe('DEF-005 (a) — the port', () => {
  it('declares an array-typed `roles` output named Roles', async () => {
    currentUser = userModel({ username: 'ada', roles: [] });
    const seen: Array<{ roles: unknown }> = [];
    const graph = await graphWithUser(seen);

    expect(graph.node('user').getOutput('roles')).toBeDefined();

    const meta = graph.context.nodeRegister.getNodeMetadata('net.noodl.user.User') as unknown as {
      outputs: Record<string, { type: unknown; displayName?: string }>;
      inputs: Record<string, unknown>;
    };
    expect(meta.outputs.roles).toBeDefined();
    expect(meta.outputs.roles.displayName).toBe('Roles');
    expect(meta.outputs.roles.type).toBe('array');
  });

  it('🔴 is READ-ONLY — there is no `roles` input for a graph to write back', () => {
    // The asymmetry the whole ruling turns on: the browser may READ its own
    // roles and may never write them. A settable port here would be the door
    // this defect was allowed to open on the condition that it stayed shut —
    // and it would be a silent one, because the server would ignore it and the
    // page would render as though it had worked.
    const declared = (UserModule as unknown as { node: { inputs: Record<string, unknown> } }).node.inputs;
    expect(Object.keys(declared)).not.toContain('roles');
  });
});

// ---------------------------------------------------------------------------
// 2. The value crosses a wire — which is the defect, closed.
// ---------------------------------------------------------------------------

describe('DEF-005 (a) — the branch a membership app needs', () => {
  it('delivers the signed-in user’s roles to a node that could branch on them', async () => {
    currentUser = userModel({ username: 'ada', roles: ['member', 'staff'] });
    const seen: Array<{ roles: unknown }> = [];
    await graphWithUser(seen);

    // Not `getOutput('roles').value`: the claim is that a graph can BRANCH on
    // this, so the value has to arrive somewhere that could.
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1].roles).toEqual(['member', 'staff']);
  });

  it('a signed-in user in no roles delivers an empty list, not nothing', async () => {
    currentUser = userModel({ username: 'ada', roles: [] });
    const seen: Array<{ roles: unknown }> = [];
    await graphWithUser(seen);

    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1].roles).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. 🔴 Three answers, not two.
// ---------------------------------------------------------------------------

describe('DEF-005 (a) — “we could not ask” is not “you are not a member”', () => {
  it('reads undefined while nobody is signed in', async () => {
    currentUser = undefined;
    const seen: Array<{ roles: unknown }> = [];
    const graph = await graphWithUser(seen);

    // Read at the port rather than the wire: `sendValue` returns early on
    // `undefined` (node.ts), so nothing crosses — which is itself the correct
    // behaviour and is why this one row cannot use the receiver.
    expect(graph.node('user').getOutput('roles').value).toBeUndefined();
    expect(seen.map((s) => s.roles)).not.toContain(null);
  });

  it('reads undefined — NOT [] — when the backend did not report roles at all', async () => {
    // A Parse deployment that predates this field, or a non-NodeGX backend.
    // `[]` here would tell every user of that backend that they are a member of
    // nothing, which is a claim nobody measured.
    currentUser = userModel({ username: 'ada' });
    const seen: Array<{ roles: unknown }> = [];
    const graph = await graphWithUser(seen);

    const value = graph.node('user').getOutput('roles').value;
    expect(value).toBeUndefined();
    expect(value).not.toEqual([]);
  });

  it('refuses a non-list the backend had no business sending', async () => {
    // Passing a string through would put it inside somebody's For Each.
    currentUser = userModel({ username: 'ada', roles: 'member' });
    const seen: Array<{ roles: unknown }> = [];
    const graph = await graphWithUser(seen);

    expect(graph.node('user').getOutput('roles').value).toBeUndefined();
    expect(seen.map((s) => s.roles)).not.toContain('member');
  });
});
