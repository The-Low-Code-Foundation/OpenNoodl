/**
 * LGC-007 §2 — the saved-definition format, and the two shelves.
 *
 * §2 ends with a sentence this file is the gate for: *"A definition is JSON, so export and
 * import are free, which makes a shared library a natural surface later. Not in this task, but
 * do not design a format that forecloses it."* A format claim like that is only worth
 * anything if something runs it, so the export/import round trip is asserted here — including
 * the case that decides whether the format forecloses a library or not, which is **two
 * definitions with the same id arriving in one project**.
 */

import {
  MY_BLOCKS_FORMAT_VERSION,
  validateDefinition,
  validateLibrary
} from '../../src/editor/src/views/BlocklyEditor/myblocks/format';
import { collectReferences } from '../../src/editor/src/views/BlocklyEditor/myblocks/references';
import {
  InMemoryShelf,
  MyBlocksInUseError,
  MyBlocksStore
} from '../../src/editor/src/views/BlocklyEditor/myblocks/store';
import { arithmetic, callValue, getInput, number, sendSignal, setOutput, workspace } from './fixtures';

function newStore() {
  return new MyBlocksStore({ project: new InMemoryShelf('project'), user: new InMemoryShelf('user') });
}

describe('LGC-007 §2 — the definition format', () => {
  it('rejects a definition saved by a newer format version rather than silently downgrading it', () => {
    const result = validateDefinition({
      formatVersion: MY_BLOCKS_FORMAT_VERSION + 1,
      id: 'a',
      name: 'Later',
      shape: 'value',
      body: workspace(number(1))
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('newer version');
  });

  it('names every missing required field at once', () => {
    const result = validateDefinition({ id: '', name: '  ', shape: 'sideways' });

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps the good definitions when one entry in a library is malformed', () => {
    const { library, rejected } = validateLibrary({
      formatVersion: MY_BLOCKS_FORMAT_VERSION,
      definitions: [
        { id: 'a', name: 'Good', shape: 'value', body: workspace(number(1)) },
        { id: '', name: '', shape: 'nonsense' },
        { id: 'c', name: 'Also good', shape: 'statement', body: workspace(setOutput('r', number(2))) }
      ]
    });

    // Losing an entire project shelf to one bad entry is worse than losing the entry.
    expect(library.definitions.map((d) => d.id)).toEqual(['a', 'c']);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].index).toBe(1);
  });
});

describe('LGC-007 §2 — the two shelves', () => {
  it('saves to the shelf it was asked for and finds it again from either', () => {
    const store = newStore();
    const saved = store.save({ name: 'Half', body: workspace(arithmetic('DIVIDE', getInput('n'), number(2))), scope: 'user' });

    expect(store.scopeOf(saved.id)).toBe('user');
    expect(store.list('user').map((d) => d.id)).toEqual([saved.id]);
    expect(store.list('project')).toHaveLength(0);
    expect(store.get(saved.id).name).toBe('Half');
  });

  it('resolves the project copy when the same id sits on both shelves', () => {
    const project = new InMemoryShelf('project');
    const user = new InMemoryShelf('user');
    const store = new MyBlocksStore({ project, user });

    store.save({ id: 'shared', name: 'From the backpack', body: workspace(number(1)), scope: 'user' });
    // Written straight onto the project shelf, as an import from a collaborator would be.
    project.write({
      formatVersion: MY_BLOCKS_FORMAT_VERSION,
      definitions: [
        {
          formatVersion: MY_BLOCKS_FORMAT_VERSION,
          id: 'shared',
          name: 'From the project',
          shape: 'value',
          params: [],
          requires: [],
          body: workspace(number(2)),
          createdAt: '',
          updatedAt: ''
        }
      ]
    });

    // A program that generates differently for its author than for a collaborator is the
    // worse failure, so the copy that travels with the project wins.
    expect(store.get('shared').name).toBe('From the project');
    expect(store.list()).toHaveLength(1);
  });

  it('moves a definition between shelves without leaving the old copy behind', () => {
    const store = newStore();
    const saved = store.save({ name: 'Mine', body: workspace(number(1)), scope: 'user' });

    store.save({ id: saved.id, name: 'Mine', body: workspace(number(2)), scope: 'project' });

    expect(store.list('user')).toHaveLength(0);
    expect(store.list('project')).toHaveLength(1);
    expect(store.list()).toHaveLength(1);
  });

  it('renames without breaking a caller, because a call block stores the id', () => {
    const store = newStore();
    const target = store.save({ name: 'Old name', body: workspace(number(1)), scope: 'project' });
    const caller = store.save({ name: 'Caller', body: workspace(callValue(target.id)), scope: 'project' });

    store.rename(target.id, 'New name');

    expect(collectReferences(store.get(caller.id).body)).toEqual([target.id]);
    expect(store.get(target.id).name).toBe('New name');
  });

  it('recomputes shape, params and requires on every write instead of trusting what it was handed', () => {
    const store = newStore();
    const inner = store.save({ name: 'Inner', body: workspace(number(1)), scope: 'project' });

    const saved = store.save({
      name: 'Outer',
      // A hole in B, and a call to `inner` in A.
      body: workspace(arithmetic('ADD', callValue(inner.id), undefined)),
      scope: 'project'
    });

    expect(saved.requires).toEqual([inner.id]);
    expect(saved.shape).toBe('value');
    expect(saved.params.map((p) => p.name)).toEqual(['b']);
  });
});

describe('LGC-007 §4 — deleting a definition that is still referenced', () => {
  it('refuses, and names both the saved blocks and the nodes it would break', () => {
    const store = newStore();
    const target = store.save({ name: 'Shared', body: workspace(number(1)), scope: 'project' });
    const caller = store.save({ name: 'Caller', body: workspace(callValue(target.id)), scope: 'project' });

    let error: MyBlocksInUseError;
    try {
      store.remove(target.id, { referencingNodeIds: ['node-1', 'node-2'] });
    } catch (e) {
      error = e as MyBlocksInUseError;
    }

    expect(error).toBeDefined();
    expect(error.name).toBe('MyBlocksInUseError');
    expect(error.definitionIds).toEqual([caller.id]);
    expect(error.nodeIds).toEqual(['node-1', 'node-2']);
    // A refused delete must leave the shelf exactly as it was.
    expect(store.get(target.id)).toBeDefined();
  });

  it('deletes when nothing points at it', () => {
    const store = newStore();
    const target = store.save({ name: 'Lonely', body: workspace(number(1)), scope: 'project' });

    store.remove(target.id);

    expect(store.get(target.id)).toBeUndefined();
  });
});

describe('LGC-007 §2 — export and import, which is what a shared library would use', () => {
  it('exports the transitive closure by default, so an import cannot dangle', () => {
    const store = newStore();
    const leaf = store.save({ name: 'Leaf', body: workspace(number(1)), scope: 'project' });
    const mid = store.save({ name: 'Mid', body: workspace(callValue(leaf.id)), scope: 'project' });
    const top = store.save({ name: 'Top', body: workspace(callValue(mid.id)), scope: 'project' });

    const exported = store.exportDefinitions([top.id]);

    expect(exported.definitions.map((d) => d.id).sort()).toEqual([leaf.id, mid.id, top.id].sort());
    expect(exported.formatVersion).toBe(MY_BLOCKS_FORMAT_VERSION);
  });

  it('round-trips through JSON into a different project', () => {
    const source = newStore();
    const leaf = source.save({ name: 'Double', body: workspace(arithmetic('MULTIPLY', getInput('n'), number(2))), scope: 'project' });
    const top = source.save({ name: 'Quadruple', body: workspace(callValue(leaf.id)), scope: 'project' });

    const wire = JSON.stringify(source.exportDefinitions([top.id], { source: { name: 'Somebody else' } }));

    const destination = newStore();
    const result = destination.importLibrary(JSON.parse(wire), 'project');

    expect(result.rejected).toHaveLength(0);
    expect(destination.get(top.id).name).toBe('Quadruple');
    // The link survives the trip: the imported caller still points at the imported leaf.
    expect(collectReferences(destination.get(top.id).body)).toEqual([leaf.id]);
  });

  it('re-importing the same file is an update, not a duplicate', () => {
    const store = newStore();
    const original = store.save({ name: 'Once', body: workspace(number(1)), scope: 'project' });
    const wire = store.exportDefinitions([original.id]);

    store.importLibrary(wire, 'project');
    store.importLibrary(wire, 'project');

    expect(store.list()).toHaveLength(1);
  });

  it('remaps a colliding id and rewrites every reference to it — the case that decides whether a shared library is possible', () => {
    const store = newStore();
    // The project already has a definition under this id, from an unrelated source.
    store.save({ id: 'collides', name: 'Ours', body: workspace(number(99)), scope: 'project' });

    const incoming = {
      formatVersion: MY_BLOCKS_FORMAT_VERSION,
      definitions: [
        { id: 'collides', name: 'Theirs', shape: 'value', body: workspace(number(1)) },
        { id: 'theirCaller', name: 'Their caller', shape: 'value', body: workspace(callValue('collides')) }
      ]
    };

    const result = store.importLibrary(incoming, 'project', { remapExisting: true });

    const newId = result.remapped['collides'];
    expect(newId).toBeDefined();
    expect(store.get('collides').name).toBe('Ours');
    expect(store.get(newId).name).toBe('Theirs');
    // The imported caller follows the remap; it must not end up pointing at *our* block.
    expect(collectReferences(store.get('theirCaller').body)).toEqual([newId]);
  });

  it('a group with a signal in it is a statement block on both sides of the trip', () => {
    const store = newStore();
    const saved = store.save({ name: 'Notify', body: workspace(sendSignal('done')), scope: 'user' });
    expect(saved.shape).toBe('statement');

    const destination = newStore();
    destination.importLibrary(store.exportDefinitions([saved.id]), 'project');

    expect(destination.get(saved.id).shape).toBe('statement');
  });
});
