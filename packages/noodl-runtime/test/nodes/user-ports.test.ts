/**
 * BCN-006 step 6 — the `User` and `Set User Properties` nodes' ports, per backend.
 *
 * Two claims are being made and they pull in opposite directions, which is why
 * both halves are here:
 *
 * 1. **A Parse-wire project's ports do not change.** The old generator read
 *    `_User` out of `systemCollections` and applied a four-name ignore list. Any
 *    difference in what comes out is a wire dropped in somebody's project — so
 *    the Parse cases below assert the *exact* port set, not a subset.
 * 2. **A REST project gets ports at all**, which it never had. Point a project at
 *    Directus today and the `User` node has three outputs and no properties, with
 *    nothing anywhere saying why.
 *
 * The schemas below are the shapes the editor's own parsers produce
 * (`schemaParsers.ts`), not invented ones: Directus keeps its `directus_*` system
 * collections, PocketBase drops `system: true` ones and marks `id` as the primary
 * key, and the Parse fallback reads `systemCollections` through
 * `collectionsFromParseClasses`.
 */

import {
  USER_INPUT_IGNORE_PARSE_BROWSER,
  USER_INPUT_IGNORE_REST,
  USER_OUTPUT_IGNORE_PARSE,
  USER_OUTPUT_IGNORE_REST,
  userBackendPickerPorts,
  userCollectionName,
  userPropertyPorts,
  userSchemaContext
} from '../../src/nodes/std-library/user/user-ports';
import { REST_USER_READONLY_FIELDS } from '../../src/api/backends/RestAuthAdapter';

import type { GraphModelLike } from '@noodl/types';

/**
 * The smallest graph model `userSchemaContext` accepts.
 *
 * ⚠️ `unknown` rather than the `type Any = any` this test family's neighbours
 * use — PLAT-004's ratchet counts every one of those, and a new file adding to a
 * gate that is already red is a cost with no reason behind it.
 */
function graphModelFor(metadata: Record<string, unknown>) {
  return {
    getMetaData: (key: string) => metadata[key],
    getNodesWithType: () => [],
    on: () => undefined,
    off: () => undefined
  } as unknown as GraphModelLike;
}

/** What the editor caches for a Parse-wire backend: `_User`, in Parse's own words. */
const PARSE_SYSTEM_COLLECTIONS = [
  {
    name: '_User',
    schema: {
      properties: {
        objectId: { type: 'String' },
        createdAt: { type: 'Date' },
        updatedAt: { type: 'Date' },
        ACL: { type: 'Object' },
        username: { type: 'String' },
        password: { type: 'String' },
        email: { type: 'String' },
        emailVerified: { type: 'Boolean' },
        authData: { type: 'Object' },
        nickname: { type: 'String' },
        age: { type: 'Number' },
        joinedAt: { type: 'Date' },
        avatar: { type: 'File' },
        team: { type: 'Relation', targetClass: 'Team' }
      }
    }
  }
];

const PARSE_PROJECT = {
  cloudservices: { endpoint: 'http://localhost:8577', appId: 'my-app', type: 'nodegx' },
  systemCollections: PARSE_SYSTEM_COLLECTIONS
};

const DIRECTUS_BACKEND = {
  id: 'd1',
  name: 'Local Directus',
  type: 'directus',
  url: 'http://localhost:8055',
  schema: {
    collections: [
      {
        name: 'articles',
        displayName: 'articles',
        primaryKey: 'id',
        fields: [{ name: 'id', type: 'integer', primaryKey: true }]
      },
      {
        name: 'directus_users',
        displayName: 'directus_users',
        primaryKey: 'id',
        fields: [
          { name: 'id', type: 'uuid', primaryKey: true },
          { name: 'email', type: 'string' },
          { name: 'password', type: 'hash' },
          { name: 'first_name', type: 'string' },
          { name: 'last_name', type: 'string' },
          { name: 'title', type: 'string' },
          { name: 'tfa_secret', type: 'hash' },
          { name: 'status', type: 'string', enumValues: ['active', 'suspended'] },
          { name: 'auth_data', type: 'json', hidden: true },
          { name: 'role', type: 'uuid', relationTarget: 'directus_roles', relationType: 'many-to-one' }
        ]
      }
    ]
  }
};

const POCKETBASE_BACKEND = {
  id: 'p1',
  name: 'Local PocketBase',
  type: 'pocketbase',
  url: 'http://localhost:8091',
  schema: {
    collections: [
      {
        name: 'users',
        displayName: 'users',
        primaryKey: 'id',
        fields: [
          { name: 'id', type: 'text', nativeType: 'text', primaryKey: true },
          { name: 'password', type: 'password', nativeType: 'password' },
          { name: 'tokenKey', type: 'text', nativeType: 'text' },
          { name: 'email', type: 'email', nativeType: 'email' },
          { name: 'emailVisibility', type: 'bool', nativeType: 'bool' },
          { name: 'verified', type: 'bool', nativeType: 'bool' },
          { name: 'name', type: 'text', nativeType: 'text' },
          { name: 'avatar', type: 'file', nativeType: 'file' }
        ]
      }
    ]
  }
};

function restProject(backend: Record<string, unknown>) {
  // Version 2 is BCN-009's converged selection: one `activeBackendId` that may
  // name a REST backend. Without it the endpoint would still win, which is the
  // no-silent-migration rule and is asserted separately below.
  return { backendServices: { version: 2, activeBackendId: backend.id, backends: [backend] } };
}

function names(ports: { name: string; plug?: string }[], plug?: string) {
  return ports.filter((port) => (plug ? port.plug === plug : true)).map((port) => port.name);
}

// ── Which table holds the accounts ──────────────────────────────────────────

describe('userCollectionName', () => {
  it('answers per backend type, and `undefined` where there is no answer', () => {
    expect(userCollectionName('nodegx')).toBe('_User');
    expect(userCollectionName('parse')).toBe('_User');
    expect(userCollectionName('directus')).toBe('directus_users');
    expect(userCollectionName('pocketbase')).toBe('users');
    // Supabase's `auth.users` is not reachable through PostgREST, and NodeGX
    // refuses Supabase auth wholesale. No ports beats ports onto a table nothing
    // can write.
    expect(userCollectionName('supabase')).toBeUndefined();
    expect(userCollectionName('custom')).toBeUndefined();
  });

  it('treats an unrecorded type as the Parse wire', () => {
    // The floor `resolveBackend.isParseWireType` and `UserService._adapter`
    // already established for every other decision.
    expect(userCollectionName(undefined)).toBe('_User');
  });
});

// ── Claim 1: a Parse-wire project's ports are byte-identical ────────────────

describe('the Parse wire', () => {
  it('produces exactly the outputs the old generator produced', () => {
    const ctx = userSchemaContext(graphModelFor(PARSE_PROJECT), {});
    const ports = userPropertyPorts(ctx, {
      plug: 'output',
      includeChangedSignals: true,
      ignore: USER_OUTPUT_IGNORE_PARSE
    });

    // ⚠️ Exact, not a subset. `ACL` is here on purpose: `shouldShowField` hides
    // it and applying that filter uniformly would silently remove an output the
    // `User` node has always had — and a removed output drops its wire.
    expect(names(ports, 'output').filter((name) => name.startsWith('prop-'))).toEqual([
      'prop-objectId',
      'prop-createdAt',
      'prop-updatedAt',
      'prop-ACL',
      'prop-emailVerified',
      'prop-nickname',
      'prop-age',
      'prop-joinedAt',
      'prop-avatar'
    ]);

    // One `changed-` signal per property, as before.
    expect(names(ports).filter((name) => name.startsWith('changed-'))).toHaveLength(9);

    // The `Relation` column is not a value and never had a port.
    expect(names(ports)).not.toContain('prop-team');
  });

  it('keeps the historic port types, which are shipped API', () => {
    const ctx = userSchemaContext(graphModelFor(PARSE_PROJECT), {});
    const ports = userPropertyPorts(ctx, { plug: 'output', ignore: USER_OUTPUT_IGNORE_PARSE });
    const typeOf = (name: string) => ports.find((port) => port.name === name)?.type;

    expect(typeOf('prop-nickname')).toEqual({ name: 'string' });
    expect(typeOf('prop-age')).toEqual({ name: 'number' });
    expect(typeOf('prop-joinedAt')).toEqual({ name: 'date' });
    expect(typeOf('prop-emailVerified')).toEqual({ name: 'boolean' });
    // Everything with no entry in the Parse table has always been `*`.
    expect(typeOf('prop-avatar')).toEqual({ name: '*' });
    expect(typeOf('prop-ACL')).toEqual({ name: '*' });
  });

  it('produces exactly the browser-side inputs the old generator produced', () => {
    const ctx = userSchemaContext(graphModelFor(PARSE_PROJECT), {});
    const ports = userPropertyPorts(ctx, { plug: 'input', ignore: USER_INPUT_IGNORE_PARSE_BROWSER });

    expect(names(ports, 'input')).toEqual([
      'prop-objectId',
      'prop-ACL',
      'prop-nickname',
      'prop-age',
      'prop-joinedAt',
      'prop-avatar'
    ]);
  });
});

// ── Claim 2: a REST project gets ports it never had ─────────────────────────

describe('Directus', () => {
  const ctx = () => userSchemaContext(graphModelFor(restProject(DIRECTUS_BACKEND)), {});

  it('finds the accounts table without a Class dropdown', () => {
    expect(ctx().collectionName).toBe('directus_users');
    expect(ctx().selectedCollection?.name).toBe('directus_users');
  });

  it('offers the profile columns and hides the credentials', () => {
    const ports = names(userPropertyPorts(ctx(), { plug: 'output', ignore: USER_OUTPUT_IGNORE_REST }));
    expect(ports).toContain('prop-first_name');
    expect(ports).toContain('prop-title');
    expect(ports).toContain('prop-status');

    // `password` and `tfa_secret` are what `normalizeUser` already refuses to put
    // into browser storage; a port would be a port onto nothing.
    expect(ports).not.toContain('prop-password');
    expect(ports).not.toContain('prop-tfa_secret');
    // The primary key is the node's own `Id` output.
    expect(ports).not.toContain('prop-id');
    // Dedicated ports already exist for these two.
    expect(ports).not.toContain('prop-email');

    // ⚠️ Unlike the Parse wire, `hidden` IS applied here — on a REST backend it
    // means a field a builder deliberately hid in the backend's own admin.
    expect(ports).not.toContain('prop-auth_data');

    // ⚠️ A many-to-one **is** offered, and that is the Record family's rule
    // rather than an oversight: an FK's own value is a scalar (the target's id),
    // and a Parse `Pointer` on `_User` has always produced a `*` port here. What
    // is skipped is a `Relation` — a record *set*, which is not a value at all.
    expect(ports).toContain('prop-role');
  });

  it('turns an enum column into a dropdown rather than a text field', () => {
    const status = userPropertyPorts(ctx(), { plug: 'input', ignore: USER_INPUT_IGNORE_REST }).find(
      (port) => port.name === 'prop-status'
    );
    expect(status?.type).toMatchObject({ name: 'enum' });
  });
});

describe('PocketBase', () => {
  const ctx = () => userSchemaContext(graphModelFor(restProject(POCKETBASE_BACKEND)), {});

  it('finds the shipped users collection', () => {
    expect(ctx().collectionName).toBe('users');
    expect(ctx().selectedCollection?.name).toBe('users');
  });

  it('never offers an input for a field the write path throws away', () => {
    const ports = names(userPropertyPorts(ctx(), { plug: 'input', ignore: USER_INPUT_IGNORE_REST }));

    // ⚠️ The defect this rule exists for: `verified` looked like every other
    // port, accepted a value, and `setUserProperties` deleted it before sending.
    expect(ports).not.toContain('prop-verified');
    expect(ports).not.toContain('prop-tokenKey');
    expect(ports).not.toContain('prop-password');
    expect(ports).not.toContain('prop-id');

    expect(ports).toContain('prop-name');
    expect(ports).toContain('prop-emailVisibility');
  });

  it('derives its ignore list from the adapter’s, so the two cannot drift', () => {
    for (const field of REST_USER_READONLY_FIELDS) {
      expect(USER_INPUT_IGNORE_REST).toContain(field);
    }
  });
});

describe('Supabase', () => {
  it('offers no property ports at all, rather than ports onto a guess', () => {
    const supabase = { id: 's1', name: 'Supabase', type: 'supabase', url: 'http://localhost:8056', schema: { collections: [] } };
    const ctx = userSchemaContext(graphModelFor(restProject(supabase)), {});
    expect(ctx.collectionName).toBeUndefined();
    expect(userPropertyPorts(ctx, { plug: 'output', ignore: USER_OUTPUT_IGNORE_REST })).toEqual([]);
  });
});

// ── The picker itself ───────────────────────────────────────────────────────

describe('the Backend picker', () => {
  it('is hidden when the project has one backend', () => {
    expect(userBackendPickerPorts(userSchemaContext(graphModelFor(PARSE_PROJECT), {}))).toEqual([]);
  });

  it('appears — and counts BOTH metadata keys — when there is a choice', () => {
    // ⚠️ The near-miss BCN-004 recorded: the built-in backend lives in
    // `cloudservices` and the Directus one in `backendServices`, so a count over
    // `backendServices.backends` alone reports ONE and hides the picker in
    // exactly the project where it matters.
    const both = {
      cloudservices: { endpoint: 'http://localhost:8577', appId: 'my-app', type: 'nodegx' },
      systemCollections: PARSE_SYSTEM_COLLECTIONS,
      backendServices: { version: 1, backends: [DIRECTUS_BACKEND] }
    };
    const ports = userBackendPickerPorts(userSchemaContext(graphModelFor(both), {}));
    expect(ports).toHaveLength(1);
    expect(ports[0].name).toBe('backendId');
    const enums = (ports[0].type as { enums: { value: string }[] }).enums;
    expect(enums.map((entry) => entry.value)).toEqual(['_active_', '_endpoint_', 'd1']);
  });

  it('does not move an existing project: unset still means the endpoint', () => {
    const both = {
      cloudservices: { endpoint: 'http://localhost:8577', appId: 'my-app', type: 'nodegx' },
      systemCollections: PARSE_SYSTEM_COLLECTIONS,
      // Version 1 — legacy metadata, where `activeBackendId` binds the BYOB nodes
      // only. Reading it here would silently move every User node onto Directus.
      backendServices: { version: 1, activeBackendId: 'd1', backends: [DIRECTUS_BACKEND] }
    };
    const ctx = userSchemaContext(graphModelFor(both), {});
    expect(ctx.backendType).toBe('nodegx');
    expect(ctx.collectionName).toBe('_User');
  });

  it('points the ports at the named backend when one is chosen', () => {
    const both = {
      cloudservices: { endpoint: 'http://localhost:8577', appId: 'my-app', type: 'nodegx' },
      systemCollections: PARSE_SYSTEM_COLLECTIONS,
      backendServices: { version: 1, backends: [DIRECTUS_BACKEND] }
    };
    const ctx = userSchemaContext(graphModelFor(both), { backendId: 'd1' });
    expect(ctx.backendType).toBe('directus');
    expect(ctx.collectionName).toBe('directus_users');
    expect(names(userPropertyPorts(ctx, { plug: 'output', ignore: USER_OUTPUT_IGNORE_REST }))).toContain('prop-first_name');
  });
});
