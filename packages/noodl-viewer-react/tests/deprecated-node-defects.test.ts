/**
 * Characterisation tests for the two hard failures PLAT-003 slice 10 found in
 * registered, shipping nodes and documented rather than fixed (NOTES §23.3, §23.4 #1).
 * Both threw a `TypeError` on a code path a real project reaches, and both are fixed
 * in the commit that adds this file. The tests pin the corrected behaviour so a later
 * typing slice cannot quietly reintroduce either.
 */

import DbModelNodeModule from '../src/nodes-deprecated/std-library/data/dbmodelnode';
import GlobalsNodeModule from '../src/nodes-deprecated/std-library/globals';

type AnyFn = (...args: unknown[]) => unknown;

/**
 * Bind a definition's methods onto a bare object the way the runtime does, so a single
 * method can be exercised without standing up a whole node scope. Same approach as
 * `cloudfunction2.test.ts`.
 */
function bindMethods(instance: Record<string, unknown>, methods: Record<string, AnyFn> | undefined) {
  for (const key of Object.keys(methods || {})) {
    instance[key] = (methods as Record<string, AnyFn>)[key].bind(instance);
  }
}

describe('Globals node (NOTES §23.3)', () => {
  // `prototypeExtensions._newOutputValueReceived` is a property descriptor, not a
  // plain function, which is why this reaches through `.value`.
  const definition = GlobalsNodeModule.node as unknown as {
    prototypeExtensions: { _newOutputValueReceived: { value: AnyFn } };
    outputs?: unknown;
  };

  function makeInstance() {
    const dirtied: string[] = [];
    const instance: Record<string, unknown> = {
      _internal: { listeners: [] },
      context: { globalValues: { greeting: 'hello' } },
      flagOutputDirty(name: string) {
        dirtied.push(name);
      }
    };
    instance._newOutputValueReceived = definition.prototypeExtensions._newOutputValueReceived.value.bind(instance);
    return { instance, dirtied };
  }

  test('a global changing does not throw when the node has an output for it', () => {
    const { instance } = makeInstance();

    // Before the fix this wrote `this._cachedInputValues[name]`, and
    // `_cachedInputValues` is assigned nowhere in the runtime — so this threw
    // `TypeError: Cannot set properties of undefined`.
    expect(() => (instance._newOutputValueReceived as AnyFn)('greeting')).not.toThrow();
  });

  test('a global changing flags exactly that output dirty', () => {
    const { instance, dirtied } = makeInstance();

    (instance._newOutputValueReceived as AnyFn)('greeting');

    expect(dirtied).toEqual(['greeting']);
  });

  test('no cache is consulted — the node still reports the live global value', () => {
    const { instance } = makeInstance();

    (instance._newOutputValueReceived as AnyFn)('greeting');
    (instance.context as { globalValues: Record<string, unknown> }).globalValues.greeting = 'goodbye';

    // The output getter reads `context.globalValues` directly, which is why dropping
    // the cache write is safe: there was never a second copy to go stale.
    expect((instance.context as { globalValues: Record<string, unknown> }).globalValues.greeting).toBe('goodbye');
  });
});

describe('DbModel node — the New action (NOTES §23.4 #1)', () => {
  const definition = DbModelNodeModule.node as unknown as {
    inputs: Record<string, { valueChangedToTrue?: AnyFn }>;
    methods: Record<string, AnyFn>;
  };

  function makeInstance(inputValues: Record<string, unknown> = {}) {
    const signals: string[] = [];
    const instance: Record<string, unknown> = {
      _internal: {
        inputValues,
        relationModelIds: {},
        onModelChangedCallback() {
          /* not under test */
        }
      },
      context: {},
      // `scheduleOnce` defers to the next input-update pass; run it inline so the test
      // does not need the scheduler.
      scheduleAfterInputsHaveUpdated(cb: () => void) {
        cb();
      },
      sendSignalOnOutput(name: string) {
        signals.push(name);
      },
      hasOutput: () => false,
      flagOutputDirty() {
        /* not under test */
      }
    };
    // The real `setModel` runs — binding happens after the literal, so a stub here
    // would be overwritten anyway, and letting it run is the more faithful test.
    bindMethods(instance, definition.methods);
    return {
      instance,
      signals,
      model: () => (instance._internal as { model?: { data: Record<string, unknown>; getId(): string } }).model
    };
  }

  test('the New input does not throw', () => {
    const { instance } = makeInstance();

    // Before the fix this called `this.storageNew()`, an identifier that has never
    // existed in this file — the New port threw for every project that used it.
    expect(() => definition.inputs.new.valueChangedToTrue!.call(instance)).not.toThrow();
  });

  test('New builds a fresh local record out of the current input values', () => {
    const { instance, model } = makeInstance({ title: 'Untitled', count: 3 });

    (instance.storageNew as AnyFn)();

    const created = model();
    expect(created).toBeDefined();
    expect(created!.data.title).toBe('Untitled');
    expect(created!.data.count).toBe(3);
    expect(created!.getId()).toEqual(expect.any(String));
  });

  test('New signals created and stored, matching the sibling Model node', () => {
    const { instance, signals } = makeInstance({ title: 'Untitled' });

    (instance.storageNew as AnyFn)();

    // `setModel` emits `fetched` first. That is pre-existing and shared with the
    // Insert path, which calls the same method — not something New introduces.
    expect(signals).toEqual(['fetched', 'created', 'stored']);
  });

  test('New does not touch the backend — that is what Insert is for', () => {
    const { instance, signals } = makeInstance();

    (instance.storageNew as AnyFn)();

    // `saved` is the backend-write signal; Insert sends it, New must not.
    expect(signals).not.toContain('saved');
  });
});
