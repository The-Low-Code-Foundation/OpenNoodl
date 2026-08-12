/**
 * LGC-008 — the resize seam between a splitter drag and a Blockly workspace.
 *
 * What is actually being defended here is a *shape*, not a feature: the module that carries a
 * container-size change from the eagerly-loaded layout code into the lazily-loaded Blockly
 * chunk must hold plain closures and must not import `blockly`. If it ever does, the 1.1 MB
 * library lands in the main renderer bundle for every session — including the majority that
 * never open a Logic Builder — and nothing else in the build would say so.
 *
 * This file runs in plain Node with no DOM, which is only possible because of that constraint.
 * A test that had to import `blockly` to prove this would have proved the opposite.
 */

import {
  blocklyResizeHandlerCount,
  registerBlocklyResizeHandler,
  resizeBlocklyWorkspaces
} from '../../src/editor/src/views/BlocklyEditor/blocklyResize';

describe('LGC-008 blocklyResize registry', () => {
  afterEach(() => {
    // The registry is module state; leaving a handler behind would leak into the next spec.
    expect(blocklyResizeHandlerCount()).toBe(0);
  });

  it('calls nothing and throws nothing when no workspace is open', () => {
    // The common case by a wide margin: every splitter drag in a session that never opened a
    // Logic Builder goes through here.
    expect(blocklyResizeHandlerCount()).toBe(0);
    expect(() => resizeBlocklyWorkspaces()).not.toThrow();
  });

  it('calls every registered workspace, so a pane with two of them resizes both', () => {
    const first = jest.fn();
    const second = jest.fn();

    const unregisterFirst = registerBlocklyResizeHandler(first);
    const unregisterSecond = registerBlocklyResizeHandler(second);

    resizeBlocklyWorkspaces();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unregisterFirst();
    unregisterSecond();
  });

  it('stops calling a workspace once it has unregistered', () => {
    // The disposal contract. A handler left behind after `workspace.dispose()` would call
    // `svgResize` on a dead workspace at the next drag — which is a throw inside Blockly, at
    // mousemove frequency.
    const handler = jest.fn();
    const unregister = registerBlocklyResizeHandler(handler);

    resizeBlocklyWorkspaces();
    expect(handler).toHaveBeenCalledTimes(1);

    unregister();
    resizeBlocklyWorkspaces();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('unregistering twice is harmless', () => {
    // React strict mode runs an effect's cleanup more than once in development.
    const handler = jest.fn();
    const unregister = registerBlocklyResizeHandler(handler);

    unregister();
    expect(() => unregister()).not.toThrow();
    expect(blocklyResizeHandlerCount()).toBe(0);
  });

  it('keeps resizing the other workspaces when one of them throws', () => {
    // A drag must not be able to leave half the panes stale because one workspace was in a
    // bad state — and it must not take the mousemove handler down with it either.
    const thrower = jest.fn(() => {
      throw new Error('workspace is gone');
    });
    const survivor = jest.fn();

    const unregisterThrower = registerBlocklyResizeHandler(thrower);
    const unregisterSurvivor = registerBlocklyResizeHandler(survivor);

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => resizeBlocklyWorkspaces()).not.toThrow();
    expect(survivor).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
    unregisterThrower();
    unregisterSurvivor();
  });

  it('lets a handler unregister itself mid-dispatch without skipping its neighbour', () => {
    const calls: string[] = [];
    let unregisterSelf: (() => void) | null = null;

    unregisterSelf = registerBlocklyResizeHandler(() => {
      calls.push('self');
      unregisterSelf?.();
    });
    const unregisterOther = registerBlocklyResizeHandler(() => {
      calls.push('other');
    });

    resizeBlocklyWorkspaces();

    expect(calls).toEqual(['self', 'other']);
    expect(blocklyResizeHandlerCount()).toBe(1);

    unregisterOther();
  });

  it('does not call a workspace that registered during the dispatch', () => {
    /**
     * This is what the `Array.from` copy in `resizeBlocklyWorkspaces` is actually for, and
     * the first version of this file claimed the wrong thing: deleting the *current* entry
     * from a Set mid-`for…of` skips nothing, so that spec passed with or without the copy.
     * Adding is the asymmetric case — a `Set` iterator **does** visit entries appended while
     * it is running.
     *
     * It matters because a Blockly workspace registers from inside its injection, which can
     * land during a drag. With direct Set iteration the new workspace would be resized in the
     * same pass, against a container that has not finished moving; and a handler that
     * re-registered would spin the mousemove handler forever rather than fail visibly.
     */
    const calls: string[] = [];
    let unregisterLatecomer: (() => void) | null = null;

    const unregisterFirst = registerBlocklyResizeHandler(() => {
      calls.push('first');
      if (!unregisterLatecomer) {
        unregisterLatecomer = registerBlocklyResizeHandler(() => calls.push('latecomer'));
      }
    });

    resizeBlocklyWorkspaces();
    expect(calls).toEqual(['first']);

    // It is registered, though — the next drag reaches it.
    resizeBlocklyWorkspaces();
    expect(calls).toEqual(['first', 'first', 'latecomer']);

    unregisterFirst();
    unregisterLatecomer?.();
  });
});
