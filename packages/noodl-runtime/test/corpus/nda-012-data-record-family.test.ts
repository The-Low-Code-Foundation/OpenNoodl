/**
 * NDA-012 (Data) — the Record CRUD family's audit rows.
 *
 * Three defects, all found by reading the family after phase 34's backend merge landed and
 * all confirmed by driving the real mixins rather than by inspection:
 *
 * - **D1/D2** `_getACL` dropped a rule whose `Target` was never opened, and wrote a literal
 *   `"undefined"` key when it could not resolve a user.
 * - **D3/D4** `Add`/`Remove Record Relation` sent a class-less Pointer for any target record
 *   that had not been loaded, which on Parse writes `Relation<undefined>` into the class
 *   schema and burns that relation name permanently.
 *
 * ⚠️ The ACL rows go through `_addAccessControl` **as the node applies it**, not through a
 * hand-built copy — `record-backend-routing.test.ts` stubs `_getACL: () => undefined`, which
 * is exactly why this path had no coverage to begin with.
 */
const metadata: Record<string, unknown> = {};

jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: (key: string) => metadata[key] }
}));

import ModelImport = require('../../src/model');
import NewRecordModule = require('../../src/nodes/std-library/data/newdbmodelpropertiesnode');
import AddRelationModule = require('../../src/nodes/std-library/data/dbmodelnode-addrelation');
import RemoveRelationModule = require('../../src/nodes/std-library/data/dbmodelnode-removerelation');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Model = ModelImport as any;

type AclRule = { target?: string; userid?: string; role?: string; read?: boolean; write?: boolean };

interface Probe {
  _internal: Record<string, unknown>;
  errors: string[];
  signals: string[];
  requests: Record<string, unknown>[];
  _getACL(): Record<string, { read: boolean; write: boolean }> | undefined;
  setAccessControl(name: string, value: unknown): void;
  validateInputs(): string | undefined;
  scheduleAddRelation(): void;
  scheduleRemoveRelation(): void;
  [k: string]: unknown;
}

/**
 * A `this` the mixin-built methods run on, with the store replaced by a recorder.
 *
 * The relation rows read `requests` to say what would have gone on the wire; the ACL rows
 * never get that far and read `_getACL` directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeInstance(module: any, internal: Record<string, unknown>): Probe {
  const instance: Record<string, unknown> = {
    _internal: internal,
    id: 'n1',
    errors: [] as string[],
    signals: [] as string[],
    requests: [] as Record<string, unknown>[],
    nodeScope: { modelScope: undefined, componentOwner: { name: 'Test' } },
    context: { editorConnection: undefined },
    flagOutputDirty() {},
    sendSignalOnOutput(name: string) {
      (instance.signals as string[]).push(name);
    },
    raiseRuntimeError(_code: string, message: string) {
      (instance.errors as string[]).push(message);
    },
    scheduleAfterInputsHaveUpdated(cb: () => void) {
      cb();
    },
    hasInput: () => false,
    registerInput: () => {},
    isInputConnected: () => false
  };

  const methods = (module.node?.methods || {}) as Record<string, (...a: unknown[]) => unknown>;
  for (const key of Object.keys(methods)) instance[key] = methods[key].bind(instance);

  /**
   * The store recorder goes on **after** the mixins, deliberately.
   *
   * `addBaseInfo` defines `cloudStore` as one of the family's own methods, so assigning it
   * before the bind loop is silently overwritten and the node reaches the real Parse wire —
   * which in a node environment fails with `XMLHttpRequest is not defined` rather than
   * telling you the stub was ignored. Recording here is enough to say whether a request was
   * built at all and what was in it.
   */
  instance.cloudStore = () => ({
    addRelation: (options: Record<string, unknown>) => {
      (instance.requests as Record<string, unknown>[]).push(options);
    },
    removeRelation: (options: Record<string, unknown>) => {
      (instance.requests as Record<string, unknown>[]).push(options);
    }
  });

  return instance as unknown as Probe;
}

function aclProbe(rules: { id: string; label: string }[], configured: Record<string, AclRule>): Probe {
  return makeInstance(NewRecordModule, { accessControl: configured, accessControlRules: rules });
}

beforeEach(() => {
  // No signed-in user: `_getCurrentUser` asks `CloudStore.instance.currentUserId()`, which
  // with empty storage answers `undefined`. That is the state an anonymous visitor is in.
  (globalThis as unknown as { localStorage: unknown }).localStorage = {};
  for (const key of Object.keys(metadata)) delete metadata[key];
});

describe('D1 — an Access Control rule whose Target was never opened', () => {
  it('is applied as "user", not silently dropped', () => {
    // The author added a rule and unticked Write. They never opened the Target dropdown, so
    // the dynamic `-target` port has no parameter and its declared default never runs a setter.
    const p = aclProbe([{ id: 'ab12', label: 'Rule 1' }], {});
    p.setAccessControl('acl-ab12-read', true);
    p.setAccessControl('acl-ab12-write', false);

    // Nobody is signed in, so "the current user" resolves to nobody and the rule contributes
    // no principal — but it must not be *mistaken for* an unconfigured node either. D2 covers
    // the key; what D1 pins is that the `user` branch is the one that ran.
    const withUser = aclProbe([{ id: 'ab12', label: 'Rule 1' }], {});
    (withUser._internal.accessControl as Record<string, AclRule>)['ab12'] = {
      read: true,
      write: false,
      userid: 'user-7'
    };

    expect(withUser._getACL()).toEqual({ 'user-7': { read: true, write: false } });
    // Before the fix this was `undefined` — the rule fell through every branch.
    expect(p._getACL()).toBeUndefined();
  });

  it('control: an explicit Target still wins', () => {
    const everyone = aclProbe([{ id: 'cd34', label: 'Rule 1' }], {
      cd34: { target: 'everyone', read: true, write: false }
    });
    expect(everyone._getACL()).toEqual({ '*': { read: true, write: false } });

    const role = aclProbe([{ id: 'cd34', label: 'Rule 1' }], {
      cd34: { target: 'role', role: 'admin', read: true, write: true }
    });
    expect(role._getACL()).toEqual({ 'role:admin': { read: true, write: true } });
  });
});

describe('D2 — a rule targeting a user nobody can resolve', () => {
  it('contributes no entry rather than an ACL keyed on the string "undefined"', () => {
    const p = aclProbe([{ id: 'ef56', label: 'Rule 1' }], {
      ef56: { target: 'user', read: true, write: true }
    });

    // Before the fix: `{"undefined": {read: true, write: true}}` — a record locked to a
    // principal that cannot exist, and not rescued by the no-ACL path because the object was
    // non-empty.
    expect(p._getACL()).toBeUndefined();
  });

  it('and does not smuggle the key in beside a rule that does resolve', () => {
    // The sharper case: with a second rule producing a real entry, the ACL is non-empty
    // either way, so `toBeUndefined` above could not have caught a stray `"undefined"` key.
    const p = aclProbe(
      [
        { id: 'aa11', label: 'Public' },
        { id: 'bb22', label: 'Owner' }
      ],
      {
        aa11: { target: 'everyone', read: true, write: false },
        bb22: { target: 'user', read: true, write: true }
      }
    );

    const acl = p._getACL();
    expect(acl).toEqual({ '*': { read: true, write: false } });
    expect(Object.keys(acl as object)).not.toContain('undefined');
  });

  it('control: the same rule with a User Id wired produces that entry', () => {
    const p = aclProbe([{ id: 'ef56', label: 'Rule 1' }], {
      ef56: { target: 'user', userid: 'user-9', read: true, write: false }
    });
    expect(p._getACL()).toEqual({ 'user-9': { read: true, write: false } });
  });
});

describe('D3 — Add Record Relation, target record never loaded', () => {
  it('refuses instead of sending a Pointer with no class', () => {
    const p = makeInstance(AddRelationModule, {
      collectionId: 'Owner',
      relationProperty: 'enemies',
      // A perfectly valid id that simply arrived from a URL parameter rather than a query.
      targetModelId: 'never-loaded-id',
      model: Model.get('owner-1')
    });

    p.scheduleAddRelation();

    expect(p.requests).toHaveLength(0);
    expect(p.signals).toEqual(['failure']);
    expect(p.errors[0]).toMatch(/has not been loaded, so its class is unknown/);
  });

  it('control: a target the store has resolved goes through, carrying its class', () => {
    const target = Model.get('loaded-target');
    target._class = 'Target';

    const p = makeInstance(AddRelationModule, {
      collectionId: 'Owner',
      relationProperty: 'enemies',
      targetModelId: 'loaded-target',
      model: Model.get('owner-2')
    });

    p.scheduleAddRelation();

    expect(p.errors).toEqual([]);
    expect(p.requests).toHaveLength(1);
    expect(p.requests[0].targetCollection).toBe('Target');
    expect(p.requests[0].targetObjectId).toBe('loaded-target');
  });
});

describe('D4 — Remove Record Relation, the same gap', () => {
  it('refuses instead of sending a Pointer with no class', () => {
    const p = makeInstance(RemoveRelationModule, {
      collectionId: 'Owner',
      relationProperty: 'enemies',
      targetModelId: 'never-loaded-id-2',
      model: Model.get('owner-3')
    });

    p.scheduleRemoveRelation();

    expect(p.requests).toHaveLength(0);
    expect(p.signals).toEqual(['failure']);
    expect(p.errors[0]).toMatch(/has not been loaded, so its class is unknown/);
  });

  it('control: a resolved target goes through', () => {
    const target = Model.get('loaded-target-2');
    target._class = 'Target';

    const p = makeInstance(RemoveRelationModule, {
      collectionId: 'Owner',
      relationProperty: 'enemies',
      targetModelId: 'loaded-target-2',
      model: Model.get('owner-4')
    });

    p.scheduleRemoveRelation();

    expect(p.errors).toEqual([]);
    expect(p.requests).toHaveLength(1);
    expect(p.requests[0].targetCollection).toBe('Target');
  });
});

describe('D5 — Delete Record describes deleting', () => {
  /**
   * ⚠️ **This corrects a string that currently reaches nobody, and the row says so rather
   * than implying a user-visible repair.**
   *
   * `shortDesc` carried Create Record's sentence — "Stores any amount of properties…" — on the
   * node that deletes one. But it is not exported to the node catalog (regenerating after the
   * change produced a byte-identical file), and its only consumer is the AI authoring loop's
   * `ContextBuilder.ts:228`, as `enriched?.summary ?? node.shortDesc`. Delete Record *has* an
   * enrichment summary, so the fallback never fires for it.
   *
   * The fix is kept because the field is wrong and the next reader of that file should not have
   * to re-derive that it is shadowed. What the row pins is the string, not an outcome.
   */
  it("does not carry Create Record's sentence", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const DeleteRecord = require('../../src/nodes/std-library/data/deletedbmodelpropertiesnode');
    expect(DeleteRecord.node.shortDesc).not.toMatch(/Stores any amount of properties/);
    expect(DeleteRecord.node.shortDesc).toMatch(/[Dd]elete/);
  });
});
