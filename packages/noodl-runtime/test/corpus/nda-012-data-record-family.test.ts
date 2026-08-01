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
  /** D6/D7 — OB-ii. */
  setModelID(id: string): void;
  scheduleStore(): void;
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
    // D6/D7 drive the CRUD verbs, which run their work inside `scheduleOnce` and gate it on
    // the editor-warning check. Both are additive: nothing D1–D5 exercises calls them.
    scheduleOnce(_key: string, cb: () => void) {
      cb();
    },
    checkWarningsBeforeCloudOp: () => true,
    clearWarnings() {},
    hasInput: () => false,
    hasOutput: () => false,
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
    },
    save: (options: Record<string, unknown>) => {
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

describe('D5 — `shortDesc` is gone, and stays gone', () => {
  /**
   * ⚠️ **This row used to pin a corrected string; the field it corrected has since been
   * deleted, so it now pins the deletion.**
   *
   * The original finding was that `shortDesc` carried Create Record's sentence — "Stores any
   * amount of properties…" — on the node that deletes one, and the row was careful to say the
   * string reached nobody: not exported to the node catalog (regenerating after the change
   * produced a byte-identical file), and its only consumer the AI authoring loop's
   * `ContextBuilder.ts:228`, as `enriched?.summary ?? node.shortDesc`, where every node's
   * enrichment summary wins.
   *
   * ✅ **Richard decided on 2026-08-01 to delete the field rather than wire it up**, against the
   * `description`-is-canonical rule settled the same day: wiring it would create a second source
   * for a sentence enrichment already supplies. So the honest guarantee is no longer "the
   * sentence is right" but "there is no second source to get wrong", and that is what these two
   * rows measure.
   *
   * ⚠️ One correction to the record: the claim was that `shortDesc` is in the catalog for *no*
   * core node. It was in fact there for exactly one — `Component Children` — from a hardcoded
   * literal in `nodelibraryexport.ts`, not from any node definition. The conclusion still held,
   * because that node has an enrichment summary too, so the fallback could not fire for it
   * either. The literal is deleted with the rest.
   */
  it('Delete Record no longer declares one', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const DeleteRecord = require('../../src/nodes/std-library/data/deletedbmodelpropertiesnode');
    expect(DeleteRecord.node.shortDesc).toBeUndefined();
  });

  // The ratchet. A field with no readers comes back one node at a time, and the point of
  // deleting it is that there is nowhere for a sentence to hide from the enrichment pipeline.
  it('no source file in this package declares one', () => {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const fs = require('fs');
    const path = require('path');
    /* eslint-enable @typescript-eslint/no-var-requires */

    const root = path.join(__dirname, '..', '..', 'src');
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && fs.readFileSync(full, 'utf8').includes('shortDesc')) {
          offenders.push(path.relative(root, full));
        }
      }
    };
    walk(root);

    expect(offenders).toEqual([]);
  });
});

/**
 * **D6/D7 — OB-ii's last two sites.**
 *
 * Worker C fixed this shape in the Object family (`modelcrudbase.ts`, `modelnode2.ts`) and
 * found it byte-for-byte in these two files, which were another worker's territory. Filed and
 * unowned until now; these rows are the fix and its measurement.
 *
 * `Model.get` is create-on-read and `Model.get('')` / `Model.get(null)` are the **named** tier
 * — one process-wide record per spelling. Measured before the fix:
 *
 * ```
 * Set Record  Id=null  bound "null"  → signals ["stored"]  Model._models['null'].data {name:'Ada'}
 * Set Record  Id=""    bound ""      → signals ["stored"]  Model._models[''].data    {name:'Ada'}
 * Record      Id=null  (input setter) bound k5OLL681g0 — a *fresh anonymous* record per null
 * ```
 *
 * So a blank Id bound every Record node in the app to one shared record, wrote into it, and
 * answered **Success**. In this family that is also DA-ii's mechanism arriving by a second
 * road: a minted record has `_class === undefined`, the value proved to burn a Parse class
 * schema when it reaches a relation write.
 */
describe('D6 — a Record CRUD verb with an empty Id', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SetRecord = require('../../src/nodes/std-library/data/setdbmodelpropertiesnode');

  it.each([
    ['null', null],
    ['blank', '']
  ])('binds nothing and fails rather than writing into a shared record (%s)', (_label, empty) => {
    const p = makeInstance(SetRecord, {
      collectionId: 'Owner',
      inputValues: { name: 'Ada' },
      storeType: 'local'
    });

    p.setModelID(empty as unknown as string);
    expect(p._internal.model).toBeUndefined();

    p.scheduleStore();

    // The failure path was already here — every verb answers a missing model with
    // `setError('Missing Record Id')`, which fires `Failure`, fills `Error` and raises on the
    // bus. The fix routes the empty spellings into it instead of past it.
    expect(p.signals).toEqual(['failure']);
    expect(p.errors).toEqual(['Missing Record Id']);

    // And nothing was written into the process-wide record named by that spelling.
    // `_models` is the named tier's backing table — the thing the defect polluted — and it is
    // reached through a declared shape rather than `any` so this row costs the ratchet nothing.
    const named = Model as unknown as { _models: Record<string, { data?: unknown } | undefined> };
    expect(named._models[String(empty)]?.data).toBeUndefined();
  });

  it('control: a real Id still mints on read, binds, and stores', () => {
    const p = makeInstance(SetRecord, {
      collectionId: 'Owner',
      inputValues: { name: 'Ada' },
      storeType: 'local'
    });

    // ⚠️ This is the family's feature and the fix had to leave it alone: a named record that
    // nothing has loaded is *supposed* to spring into existence, because that is what lets a
    // graph name a record before the query that fills it has run.
    p.setModelID('owner-d6');
    expect((p._internal.model as { getId(): string }).getId()).toBe('owner-d6');

    p.scheduleStore();

    expect(p.errors).toEqual([]);
    expect(p.signals).toEqual(['stored']);
    expect(Model.get('owner-d6').get('name')).toBe('Ada');
  });
});

describe('D7 — the Record node with an empty Id', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const RecordNode = require('../../src/nodes/std-library/data/dbmodelnode2');

  it.each([
    ['null', null],
    ['blank', '']
  ])('binds nothing through the input setter a wire actually reaches (%s)', (_label, empty) => {
    const p = makeInstance(RecordNode, { collectionId: 'Owner' });

    // ⚠️ Driving `modelId.set` rather than `setModelID` is the point of this row. `null`
    // never reached `setModelID` — `typeof null === 'object'` diverted it into
    // `Model.create(null)` one step earlier, so a guard in `setModelID` alone would have
    // measured as fixed while the reachable path stayed broken.
    RecordNode.node.inputs.modelId.set.call(p, empty);

    expect(p._internal.model).toBeUndefined();
    expect(p.signals).toEqual([]);
  });

  it('control: a plain JS object wired to Id is still dereferenced', () => {
    const p = makeInstance(RecordNode, { collectionId: 'Owner' });
    RecordNode.node.inputs.modelId.set.call(p, { id: 'owner-d7', name: 'Bob' });

    expect((p._internal.model as { getId(): string }).getId()).toBe('owner-d7');
    expect(Model.get('owner-d7').get('name')).toBe('Bob');
  });

  it('control: a never-seen id still binds and mints', () => {
    const p = makeInstance(RecordNode, { collectionId: 'Owner' });
    RecordNode.node.inputs.modelId.set.call(p, 'owner-d7-unseen');
    expect((p._internal.model as { getId(): string }).getId()).toBe('owner-d7-unseen');
  });
});
