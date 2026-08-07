/**
 * AIB-007 slices 1 and 4 — the scope carries structure, and the plan carries a
 * provision.
 *
 * The asymmetry these specs exist to pin: **prose can conclude "no backend" and
 * can never conclude "provision one".** The scoping tool's `backend` field was a
 * bare string until this task, `noodl-mcp`'s `create_project` still accepts one,
 * and a model given the new schema does not always fill it in. Reading an
 * unclassifiable answer as `'nodegx'` would create a backend on someone's
 * machine because a sentence looked keen.
 */

import {
  DEFAULT_PROVISIONED_BACKEND_NAME,
  emptyScope,
  mergeScope,
  normalizeScopeBackend,
  planFromScope,
  provisionFromScope,
  renderArchitecture,
  renderScopeRecord,
  scopeBackendDescription,
  scopeOutline
} from '../../src/editor/src/models/AiAssistant/scoping/scope';
import type { ProjectScope } from '../../src/editor/src/models/AiAssistant/scoping/scope';
import { validatePlan } from '../../src/editor/src/models/AiAssistant/authoring/plan';

function scopeWith(patch: Parameters<typeof mergeScope>[1]): ProjectScope {
  return mergeScope(emptyScope('A chat app'), patch);
}

describe('normalizeScopeBackend', () => {
  it('reads a bare string as prose, never as permission to provision', () => {
    const backend = normalizeScopeBackend('A Postgres database we already run');
    expect(backend).toEqual({ kind: 'unspecified', description: 'A Postgres database we already run' });
    expect(provisionFromScope(scopeWith({ backend: 'A Postgres database we already run' }))).toBeUndefined();
  });

  it('does conclude "none" from prose that plainly says so', () => {
    expect(normalizeScopeBackend('None')?.kind).toBe('none');
    expect(normalizeScopeBackend('no backend')?.kind).toBe('none');
    // Whole-string only. "None of the data leaves the device" is a description,
    // not the word "none", and reading it as one would silently turn the
    // AIB-007 diagnostic from a warning into an error.
    expect(normalizeScopeBackend('None of the data leaves the device')?.kind).toBe('unspecified');
  });

  it('refuses an unrecognised kind rather than trusting the model', () => {
    const backend = normalizeScopeBackend({ kind: 'supabase' as never, description: 'Supabase' });
    expect(backend?.kind).toBe('unspecified');
  });

  it('drops collections and fields it cannot use, and keeps the ones it can', () => {
    const backend = normalizeScopeBackend({
      kind: 'nodegx',
      description: 'The built-in one',
      collections: [
        { name: '  Message  ', fields: [{ name: 'body', type: 'text' }, { name: '', type: 'text' }] },
        { name: '   ' } as never
      ]
    });
    expect(backend?.collections).toEqual([{ name: 'Message', fields: [{ name: 'body', type: 'text' }] }]);
  });

  it('accepts either shape through mergeScope, whole-field replacement intact', () => {
    const first = scopeWith({ backend: 'None' });
    expect(first.backend?.kind).toBe('none');
    const second = mergeScope(first, { backend: { kind: 'nodegx', description: 'Actually we do need accounts' } });
    expect(second.backend).toEqual({ kind: 'nodegx', description: 'Actually we do need accounts' });
  });
});

describe('the documents keep their character', () => {
  const scope = scopeWith({
    summary: 'A chat app',
    pages: [{ name: 'Chats', purpose: 'List the conversations.' }],
    backend: { kind: 'nodegx', description: 'The built-in backend, because nobody wants to run one.', needsAuth: true }
  });

  it('renders the conversation\'s own prose under Backend contracts and nothing else', () => {
    const architecture = renderArchitecture(scope);
    expect(architecture).toContain('## Backend contracts\n\nThe built-in backend, because nobody wants to run one.');
    // Criterion 1. The structure drives the plan; it must not turn a prose
    // section into a generated table.
    expect(architecture).not.toContain('nodegx');
    expect(architecture).not.toContain('needsAuth');
  });

  it('keeps the scoping record and the outline on the prose too', () => {
    expect(renderScopeRecord({ scope, transcript: [], at: 'T' })).toContain(
      '**Backend.** The built-in backend, because nobody wants to run one.'
    );
    expect(scopeOutline(scope)).toContain('Backend: The built-in backend, because nobody wants to run one.');
    expect(scopeBackendDescription(scope)).toBe('The built-in backend, because nobody wants to run one.');
  });
});

describe('provisionFromScope', () => {
  it('only provisions for kind "nodegx"', () => {
    for (const kind of ['none', 'external', 'unspecified'] as const) {
      expect(provisionFromScope(scopeWith({ backend: { kind, description: 'x' } }))).toBeUndefined();
    }
    expect(provisionFromScope(scopeWith({ backend: { kind: 'nodegx', description: 'x' } }))).toBeDefined();
  });

  it('never offers a second backend to a project that already has one', () => {
    const scope = scopeWith({ backend: { kind: 'nodegx', description: 'x' } });
    expect(provisionFromScope(scope, { hasBackend: true })).toBeUndefined();
  });

  it('falls back to the agreed objects when no collections were named', () => {
    const scope = scopeWith({
      backend: { kind: 'nodegx', description: 'x' },
      objects: [
        { name: 'Message', fields: ['body (text)', 'sentAt (date)'] },
        { name: 'Chat Room' },
        // Two objects that clean to the same collection name fold, rather than
        // producing a createTable that runs twice.
        { name: 'ChatRoom' }
      ]
    });
    const spec = provisionFromScope(scope);
    expect(spec?.collections.map((c) => c.name)).toEqual(['Message', 'ChatRoom']);
    expect(spec?.name).toBe(DEFAULT_PROVISIONED_BACKEND_NAME);
  });

  it('maps only field types it recognises, and never the backend\'s own columns', () => {
    const spec = provisionFromScope(
      scopeWith({
        backend: {
          kind: 'nodegx',
          description: 'x',
          collections: [
            {
              name: 'Message',
              fields: [
                { name: 'body', type: 'text' },
                { name: 'unread', type: 'yes/no' },
                { name: 'sentAt', type: 'timestamp' },
                { name: 'score', type: 'number' },
                // Unmapped: the backend infers it from the first record, which
                // beats a createTable the schema manager refuses.
                { name: 'mood', type: 'a vibe' },
                { name: 'createdAt', type: 'date' }
              ]
            }
          ]
        }
      })
    );
    expect(spec?.collections[0].columns).toEqual([
      { name: 'body', type: 'String' },
      { name: 'unread', type: 'Boolean' },
      { name: 'sentAt', type: 'Date' },
      { name: 'score', type: 'Number' }
    ]);
  });
});

describe('planFromScope with a backend', () => {
  const scope = scopeWith({
    backend: { kind: 'nodegx', description: 'The built-in one', needsAuth: true },
    objects: [{ name: 'Message' }],
    pages: [
      { name: 'Chats', purpose: 'List the conversations.' },
      { name: 'Sign Up', purpose: 'Create an account.' }
    ]
  });

  it('puts the provision first and gives it a spec', () => {
    const plan = planFromScope(scope);
    expect(plan.operations.map((op) => op.kind)).toEqual(['provision', 'create', 'create']);
    expect(plan.operations[0].provision).toEqual({
      name: DEFAULT_PROVISIONED_BACKEND_NAME,
      collections: [{ name: 'Message', columns: [] }],
      needsAuth: true
    });
    // The intent says where the backend lives. "A backend appears" is the
    // version of this that produces the next AIB-007.
    expect(plan.operations[0].intent).toContain('on this computer');
  });

  it('validates, and rejects a hand-built plan that provisions twice or provisions nothing', () => {
    const plan = planFromScope(scope);
    expect(validatePlan(plan, { existingComponents: new Set() })).toEqual([]);

    const twice = { ...plan, operations: [...plan.operations, { ...plan.operations[0], id: 'op-9' }] };
    expect(validatePlan(twice, { existingComponents: new Set() }).join(' ')).toContain('second "provision"');

    const empty = {
      ...plan,
      operations: [{ id: 'op-1', kind: 'provision' as const, target: 'x', intent: 'x' }]
    };
    expect(validatePlan(empty, { existingComponents: new Set() }).join(' ')).toContain('says nothing about what');

    const misplaced = {
      ...plan,
      operations: [{ id: 'op-1', kind: 'create' as const, target: 'Pages/X', intent: 'x', provision: plan.operations[0].provision }]
    };
    expect(validatePlan(misplaced, { existingComponents: new Set() }).join(' ')).toContain('cannot carry a backend');
  });

  it('plans no provision when the conversation agreed there is none — criterion 5', () => {
    const none = scopeWith({
      backend: { kind: 'none', description: 'None — it all lives in the browser.' },
      pages: [{ name: 'Notes', purpose: 'Jot things down.' }]
    });
    const plan = planFromScope(none);
    expect(plan.operations.map((op) => op.kind)).toEqual(['create']);
    expect(validatePlan(plan, { existingComponents: new Set() })).toEqual([]);
  });
});
