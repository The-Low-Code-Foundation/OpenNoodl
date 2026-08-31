/**
 * DEF-036 AC1/AC2 — the node says which of two things is wrong, and offers no dead ends.
 *
 * ## What is graded here and what is not
 *
 * The judgement: which state produces which sentence, and which states produce none. That is
 * the whole of `schemaFieldNotice.ts`, which touches no DOM and no singleton for exactly this
 * reason.
 *
 * 🔴 **What this cannot see**: whether the property panel renders what it returns. `Ports.ts`
 * reaches `ProjectModel`, `SchemaHandler`, `PopupLayer` and React, and a spec here would pass
 * against a function nobody calls — the failure `pickerEmptyStates.ts` records in its own
 * header. That half is graded by the drive, and it is named as owed in the task file rather
 * than implied to be covered.
 */

import { NODES_REQUIRING_BACKEND } from '../../src/editor/src/validation/backendRequirement';
import type { SchemaFetchOutcome } from '@noodl-utils/schemaCachePolicy';
import {
  ACTIVE_BACKEND_VALUE,
  addFieldTarget,
  schemaFieldNotice,
  schemaTableForNode,
  SCHEMA_FIELD_NODES,
  USER_ACCOUNTS_TABLE,
  type SchemaFieldSubject
} from '@noodl-utils/schemaFieldNotice';

/** A node in the state the defect is about: in the family, no fields, project's own backend. */
const silentNode = (outcome: SchemaFetchOutcome | undefined): SchemaFieldSubject => ({
  typename: 'net.noodl.user.SignUp',
  outcome,
  fieldPortCount: 0
});

const NO_BACKEND: SchemaFetchOutcome = {
  status: 'not-applicable',
  cause: 'no-endpoint',
  reason: 'the project has no backend endpoint'
};
const STOPPED: SchemaFetchOutcome = {
  status: 'unavailable',
  cause: 'not-running',
  reason: 'backend b1 is not running'
};

/** Every cause the outcome type can carry, so a new one cannot be added without a sentence. */
const EVERY_CAUSE: SchemaFetchOutcome[] = [
  NO_BACKEND,
  { status: 'not-applicable', cause: 'external-endpoint', reason: 'the endpoint is a parse server' },
  { status: 'unavailable', cause: 'no-project', reason: 'no project is open' },
  { status: 'unavailable', cause: 'no-ipc', reason: 'no ipcRenderer in this window' },
  { status: 'unavailable', cause: 'not-registered-yet', reason: 'no managed backend matches yet' },
  STOPPED,
  { status: 'unavailable', cause: 'unreadable-reply', reason: 'backend b1 returned no table list' },
  { status: 'unavailable', cause: 'threw', reason: 'Error: boom' }
];

describe('DEF-036 AC1 — the explanation exists, and it is not one message for two states', () => {
  it('says something for every state the fetch can end in', () => {
    // Cardinality, not a spot check: the union grew by six causes for this row, and a switch
    // that quietly returns `undefined` for one of them is the silence being restored.
    const notices = EVERY_CAUSE.map((outcome) => schemaFieldNotice(silentNode(outcome)));

    expect(notices.filter(Boolean)).toHaveLength(EVERY_CAUSE.length);
  });

  it('gives no-backend and backend-stopped two different sentences', () => {
    const attached = schemaFieldNotice(silentNode(NO_BACKEND));
    const stopped = schemaFieldNotice(silentNode(STOPPED));

    expect(attached).toBeDefined();
    expect(stopped).toBeDefined();
    expect(stopped.title).not.toBe(attached.title);
    expect(stopped.message).not.toBe(attached.message);
  });

  it('names a different next action in each', () => {
    // AC1's actual bar: two states with two next actions. "Create or attach one" is wrong
    // advice for a backend that exists and is merely stopped, and "start it" is impossible
    // advice for a project that has none.
    expect(schemaFieldNotice(silentNode(NO_BACKEND)).message).toMatch(/Create or attach a backend/i);
    expect(schemaFieldNotice(silentNode(STOPPED)).message).toMatch(/Start it/i);

    expect(schemaFieldNotice(silentNode(NO_BACKEND)).message).not.toMatch(/Start it/i);
    expect(schemaFieldNotice(silentNode(STOPPED)).message).not.toMatch(/Create or attach a backend/i);
  });

  it('gives every cause its own distinct message', () => {
    const messages = EVERY_CAUSE.map((o) => schemaFieldNotice(silentNode(o)).message);

    // The three "this editor could not ask" causes share one sentence on purpose, so the
    // expected count is the six distinct states, not eight.
    expect(new Set(messages).size).toBe(6);
  });

  it('does not blame the project when the editor is what failed', () => {
    for (const cause of ['no-project', 'no-ipc', 'threw'] as const) {
      const notice = schemaFieldNotice(silentNode({ status: 'unavailable', cause, reason: 'x' }));

      expect(notice.message).toMatch(/Nothing is wrong with the project itself/i);
    }
  });

  it('says whether the missing fields are ones this node writes or reads', () => {
    // The same state on an input-side node and an output-side node are different sentences to
    // the person: `Sign Up` has nothing to write, `User` has nothing to read.
    const signUp = schemaFieldNotice({ typename: 'net.noodl.user.SignUp', outcome: STOPPED, fieldPortCount: 0 });
    const user = schemaFieldNotice({ typename: 'net.noodl.user.User', outcome: STOPPED, fieldPortCount: 0 });

    expect(signUp.message).toContain('no fields to write');
    expect(user.message).toContain('no fields to read');
  });

  it('warns that a build taken in this state drops the connections', () => {
    // The person sentence is about the BUILD — "your build is the first place you find out".
    // Under Option B those wires still leave the build, so every message has to say so.
    for (const outcome of EVERY_CAUSE) {
      expect(schemaFieldNotice(silentNode(outcome)).message).toMatch(/drop/i);
    }
  });
});

describe('DEF-036 — the states that must stay silent', () => {
  it('says nothing about a node that has its fields', () => {
    // DEF-035 leaves a stale schema in place when a backend goes away, on purpose. A node
    // still offering its ports has nothing wrong with it to explain.
    expect(schemaFieldNotice({ ...silentNode(STOPPED), fieldPortCount: 3 })).toBeUndefined();

    // Control, from the same population: one field fewer and it does speak.
    expect(schemaFieldNotice({ ...silentNode(STOPPED), fieldPortCount: 0 })).toBeDefined();
  });

  it('says nothing before the first fetch has answered', () => {
    expect(schemaFieldNotice(silentNode(undefined))).toBeUndefined();
  });

  it('says nothing when the backend answered', () => {
    // A node with no fields under a working schema has some other cause — usually no table
    // chosen — and the Class picker above it already states that one.
    expect(schemaFieldNotice(silentNode({ status: 'schema', tables: [] }))).toBeUndefined();
  });

  it('says nothing about a node that names its own backend', () => {
    expect(schemaFieldNotice({ ...silentNode(NO_BACKEND), backendIdParameter: 'directus-1' })).toBeUndefined();
  });

  it('still speaks for a node set to Active Backend, which is not a backend', () => {
    // 🔴 The control that catches the obvious wrong reading. `backendId` is a declared port with
    // `default: '_active_'`, so any "does this node have a backendId" test reads true for a node
    // using the project's own — and would switch this whole feature off for the Record family,
    // silently, with every other assertion here still passing.
    expect(schemaFieldNotice({ ...silentNode(NO_BACKEND), backendIdParameter: ACTIVE_BACKEND_VALUE })).toBeDefined();
    expect(schemaFieldNotice({ ...silentNode(NO_BACKEND), backendIdParameter: '' })).toBeDefined();
    expect(schemaFieldNotice({ ...silentNode(NO_BACKEND), backendIdParameter: undefined })).toBeDefined();
  });

  it('says nothing about a node outside the two families', () => {
    for (const typename of ['DeleteDbModelProperties', 'AddDbModelRelation', 'Group', undefined]) {
      expect(schemaFieldNotice({ typename, outcome: NO_BACKEND, fieldPortCount: 0 })).toBeUndefined();
    }
  });
});

describe('DEF-036 AC4 — the Add a field button is never a second dead end', () => {
  const READ: SchemaFetchOutcome = {
    status: 'schema',
    tables: [{ name: '_User' }],
    backend: { id: 'b1', name: 'App backend' }
  };
  const onNode = (over: Partial<SchemaFieldSubject & { selectedTable?: string }> = {}) => ({
    typename: 'net.noodl.user.SignUp',
    outcome: READ,
    fieldPortCount: 4,
    selectedTable: '_User',
    ...over
  });

  it('gives a destination when the schema was read and a table is chosen', () => {
    // The positive control. Every refusal below is only meaningful beside it.
    expect(addFieldTarget(onNode())).toEqual({ backend: { id: 'b1', name: 'App backend' }, table: '_User' });
  });

  it('offers nothing in exactly the state AC1 explains', () => {
    expect(addFieldTarget(onNode({ outcome: STOPPED, fieldPortCount: 0 }))).toBeUndefined();
    expect(addFieldTarget(onNode({ outcome: NO_BACKEND, fieldPortCount: 0 }))).toBeUndefined();
    expect(addFieldTarget(onNode({ outcome: undefined, fieldPortCount: 0 }))).toBeUndefined();
  });

  it('offers nothing for an external backend — Richard’s rider, our internal DB only', () => {
    const external: SchemaFetchOutcome = {
      status: 'not-applicable',
      cause: 'external-endpoint',
      reason: 'the endpoint is a parse server we hold no key for'
    };

    expect(addFieldTarget(onNode({ outcome: external, fieldPortCount: 0 }))).toBeUndefined();
  });

  it('offers nothing when no table is chosen rather than picking one', () => {
    expect(addFieldTarget(onNode({ selectedTable: undefined }))).toBeUndefined();
    expect(addFieldTarget(onNode({ selectedTable: '' }))).toBeUndefined();
  });

  it('offers nothing on a node aimed at its own backend', () => {
    expect(addFieldTarget(onNode({ backendIdParameter: 'directus-1' }))).toBeUndefined();
  });

  it('still offers on a node set to Active Backend', () => {
    expect(addFieldTarget(onNode({ backendIdParameter: ACTIVE_BACKEND_VALUE }))).toBeDefined();
  });

  it('offers nothing when the read did not record which backend answered', () => {
    // Jumping with an invented id would open some other backend's schema, and the header would
    // name that one — an author would have no way to know they were in the wrong place.
    expect(addFieldTarget(onNode({ outcome: { status: 'schema', tables: [] } }))).toBeUndefined();
  });

  it('never offers a button on a node that is showing the warning instead', () => {
    // AC2 as one assertion: the two surfaces are mutually exclusive by construction, not by
    // two call sites remembering to check each other.
    for (const outcome of EVERY_CAUSE) {
      const subject = onNode({ outcome, fieldPortCount: 0 });

      expect(schemaFieldNotice(subject)).toBeDefined();
      expect(addFieldTarget(subject)).toBeUndefined();
    }
  });
});

describe('DEF-036 AC4 — which table the jump lands on', () => {
  const noParameters = () => undefined;

  it('takes the Record family’s table from its Class dropdown', () => {
    const get = (name: string) => (name === 'collectionName' ? 'Puppy' : undefined);

    expect(schemaTableForNode('NewDbModelProperties', get)).toBe('Puppy');
    expect(schemaTableForNode('SetDbModelProperties', get)).toBe('Puppy');
    expect(schemaTableForNode('DbModel2', get)).toBe('Puppy');
  });

  it('returns nothing for a Record node with no class chosen', () => {
    expect(schemaTableForNode('NewDbModelProperties', noParameters)).toBeUndefined();
    expect(schemaTableForNode('NewDbModelProperties', () => '')).toBeUndefined();
  });

  it('uses the accounts table for the User family, which has no dropdown', () => {
    // ⚠️ And ignores `collectionName` if something has left one on the node: the User family's
    // table is chosen by the backend, and honouring a stray parameter would send an author into
    // a table their node never reads.
    const get = () => 'Puppy';

    expect(schemaTableForNode('net.noodl.user.SignUp', get)).toBe(USER_ACCOUNTS_TABLE);
    expect(schemaTableForNode('net.noodl.user.User', get)).toBe(USER_ACCOUNTS_TABLE);
    expect(schemaTableForNode('net.noodl.user.SetUserProperties', get)).toBe(USER_ACCOUNTS_TABLE);
  });

  it('returns nothing for a node outside the two families', () => {
    expect(schemaTableForNode('DeleteDbModelProperties', () => 'Puppy')).toBeUndefined();
    expect(schemaTableForNode(undefined, () => 'Puppy')).toBeUndefined();
  });
});

describe('DEF-036 — the family table cannot go stale silently', () => {
  it('names only nodes the backend-requirement table also knows', () => {
    // A typo'd type name would disable this for one node and nothing would say so. That table
    // has its own completeness guard against the catalog, so agreeing with it is a real check
    // rather than a second copy of the same guess.
    for (const typename of Object.keys(SCHEMA_FIELD_NODES)) {
      expect(Object.keys(NODES_REQUIRING_BACKEND)).toContain(typename);
    }
  });

  it('holds the six nodes DEF-036 §2 measured, and no more', () => {
    expect(Object.keys(SCHEMA_FIELD_NODES).sort()).toEqual(
      [
        'DbModel2',
        'NewDbModelProperties',
        'SetDbModelProperties',
        'net.noodl.user.SetUserProperties',
        'net.noodl.user.SignUp',
        'net.noodl.user.User'
      ].sort()
    );
  });
});
