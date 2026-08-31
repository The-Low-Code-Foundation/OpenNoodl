/**
 * DEF-029 — a file could not be dropped onto anything.
 *
 * Registered from phase 77 D15, where SBR-007 AC3 asked for "drop an image here" and the
 * finding was that no drop target was authorable at all. Measured word-boundary before the
 * build: `onDrop` / `onDragOver` / `onDragEnter` / `onDragLeave` / `dataTransfer` all read
 * **0** across the viewer, against known-firing controls of `onClick` = 37 and
 * `onMouseDown` = 8. (The register's original `onDrop` = 0 was right by luck — a substring
 * search reads 8, every one of them `onDropped`, ERG-001's queue-discard callback.)
 *
 * ## What these rows are really guarding
 *
 * Three things, and only the first is the feature:
 *
 * 1. A drop emits the shape `Upload File` already takes. `Open File Picker` puts a browser
 *    `File` on a `type: '*'` port and `Upload File`'s `File` input documents itself as
 *    receiving exactly that, so the identity row below — the emitted value *is* the dropped
 *    `File` — is the one that keeps the two doors interchangeable.
 *
 * 2. 🔴 **`preventDefault` is the whole feature and also the whole risk.** An element is
 *    droppable only because `dragover` prevents the default, and that same call is what stops
 *    the browser navigating away to the file. The `disabled` rows are therefore not
 *    box-ticking: they are the control proving that a node nobody switched this on for still
 *    behaves exactly as it did before. If they ever go green while the enabled rows do too,
 *    the feature has been made unconditional and every existing project changed.
 *
 * 3. The nested-child row. Dragging onto a child fires `dragleave` on the parent, so a plain
 *    boolean flickers off the moment the pointer crosses an inner edge — and every real drop
 *    zone has a child, because "Drop files here" is one. That row fails against the naive
 *    implementation and passes against the counter.
 *
 * ⚠️ No DOM: every package here pins `testEnvironment: 'node'` (FH-015 says so and it is still
 * true), so these drive the two places the behaviour actually lives — the handlers the compiled
 * node ships, and `pointerProps`, which is what puts them on the element.
 */

/* eslint-env jest */

// `group.ts` and friends read `Noodl.deployed` at import time to decide whether to build
// tooltips. A `beforeAll` runs too late and the whole suite fails to run — `Tests: 0 total`,
// which reads like a missing file. Same placement as CN-006's and DEF-031's.
(globalThis as Record<string, any>).Noodl = { deployed: false, baseUrl: '/' };

import NodeSharedPortDefinitions from '../src/node-shared-port-definitions';
import CircleNode from '../src/nodes/visual/circle';
import ImageNode from '../src/nodes/visual/image';
import TextNode from '../src/nodes/visual/text';
import VideoNode from '../src/nodes/visual/video';
import pointerProps from '../src/pointerlisteners';

type Handler = (event: any) => void;

/**
 * The compiled definition the rows below drive — what a project actually instantiates.
 *
 * ⚠️ `Text` and not `Group`, and not by preference: **`src/nodes/visual/group.ts` cannot be
 * imported from a test in this package at all.** Its component pulls in
 * `Group/scroll-plugins/nested-scroll-plugin.js`, a plain `.js` file using ESM `export`, and
 * this package's jest preset is bare `ts-jest`, which transforms `.ts`/`.tsx` only. The import
 * throws `SyntaxError: Unexpected token 'export'` and the suite reports `Tests: 0 total` —
 * which reads like a missing file rather than a broken import. Pre-existing, nothing to do with
 * this build, and registered as an unowned row: the runtime's most-used visual node is
 * unreachable from a unit test.
 *
 * Group is covered instead by the mutator row below, which drives the same function `group.ts`
 * calls, plus the four nodes here that do import.
 */
const text = (TextNode as any).node;

/** A `File` stand-in. `File` does not exist in a Node test environment. */
function makeFile(name: string, type: string, size = 1024) {
  return { name, type, size };
}

/** A synthetic `DragEvent`, recording the two calls the feature turns on. */
function makeDragEvent({ files = [] as any[], types = ['Files'] } = {}) {
  return {
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
    dataTransfer: { types, files, dropEffect: '' }
  };
}

/**
 * The minimum of a node instance the drop handlers touch, plus recorders.
 *
 * `hasOutput` answers true for the File Drop ports because they are registered whenever the
 * feature is on — which is the state every row here that reads an output is in.
 */
function makeNode({ accept = true, acceptedFileTypes = undefined as string | undefined } = {}) {
  return {
    _internal: { acceptFileDrops: accept, acceptedFileTypes },
    signals: [] as string[],
    dirtied: [] as string[],
    hasOutput() {
      return true;
    },
    flagOutputDirty(name: string) {
      this.dirtied.push(name);
    },
    sendSignalOnOutput(name: string) {
      this.signals.push(name);
    }
  };
}

/** The handlers the compiled node ships, called exactly as React would call them. */
function handlers(node: any): Record<string, Handler> {
  const props = text.outputs.filesDropped.props as Record<string, Handler>;
  const bound: Record<string, Handler> = {};
  for (const name of Object.keys(props)) bound[name] = (e: any) => props[name].call(node, e);
  return bound;
}

/** Reads a File Drop output the way the runtime does. */
function readOutput(node: any, name: string) {
  return text.outputs[name].get.call(node);
}

describe('DEF-029 — the ports exist at all', () => {
  it('gives every interactive visual node the File Drop ports', () => {
    for (const [name, mod] of [
      ['Text', TextNode],
      ['Image', ImageNode],
      ['Circle', CircleNode],
      ['Video', VideoNode]
    ] as const) {
      const def = (mod as any).node;
      expect(`${name}:${!!def.inputs.acceptFileDrops}`).toBe(`${name}:true`);
      expect(`${name}:${!!def.outputs.droppedFile}`).toBe(`${name}:true`);
      expect(`${name}:${!!def.outputs.filesDropped}`).toBe(`${name}:true`);
    }
  });

  it('emits the File on a `*` port, which is what Upload File takes', () => {
    expect(text.outputs.droppedFile.type).toBe('*');
  });

  it('gives Group the same ports, through the mutator group.ts calls', () => {
    // Group cannot be imported here — see the note on `text` above. This drives
    // `addFileDropPorts` directly, which is the whole of what `group.ts` does for this feature,
    // so the port surface a Group ships is graded even though the module will not load.
    const def: any = { name: 'Group', inputs: {}, outputs: {}, inputCss: {} };
    NodeSharedPortDefinitions.addFileDropPorts(def);

    expect(def.inputs.acceptFileDrops.default).toBe(false);
    expect(def.outputs.droppedFile.type).toBe('*');
    expect(typeof def.outputProps.filesDropped.props.onDrop).toBe('function');
    expect(def.dynamicports[0].condition).toBe('acceptFileDrops = true');
  });

  it('hides everything but the one checkbox until drops are switched on', () => {
    const entry = text.dynamicports.find((d: any) => d.condition === 'acceptFileDrops = true');

    expect(entry).toBeDefined();
    expect(entry.inputs).toEqual(['acceptedFileTypes']);
    // 🔴 The outputs must be listed here, not merely declared: a port that is declared but not
    // gated shows on every Group in every project whether or not the feature is used.
    expect(entry.outputs).toEqual([
      'filesDropped',
      'filesRejected',
      'droppedFile',
      'droppedFiles',
      'droppedFileName',
      'droppedFileType',
      'droppedFileSizeInBytes',
      'isDragOver'
    ]);
  });

  it('defaults to off, so no existing project gains a drop target', () => {
    expect(text.inputs.acceptFileDrops.default).toBe(false);
  });
});

describe('DEF-029 — the control: a node nobody enabled behaves as before', () => {
  it('does not prevent the default on dragover, so the browser is unchanged', () => {
    const node = makeNode({ accept: false });
    const e = makeDragEvent();

    handlers(node).onDragOver(e);

    expect(e.defaultPrevented).toBe(false);
  });

  it('ignores a drop entirely, leaving the browser to do what it always did', () => {
    const node = makeNode({ accept: false });
    const e = makeDragEvent({ files: [makeFile('a.png', 'image/png')] });

    handlers(node).onDrop(e);

    expect(e.defaultPrevented).toBe(false);
    expect(node.signals).toEqual([]);
  });

  it('ignores a drag that carries no files even when drops are on', () => {
    // Dragging selected text or an in-page image must not light the zone up, and must not
    // have its default suppressed.
    const node = makeNode();
    const e = makeDragEvent({ types: ['text/plain'] });

    handlers(node).onDragOver(e);
    handlers(node).onDragEnter(e);

    expect(e.defaultPrevented).toBe(false);
    expect(readOutput(node, 'isDragOver')).toBe(false);
  });
});

describe('DEF-029 — a drop delivers the file', () => {
  it('prevents the default on dragover, which is what makes the element droppable', () => {
    const node = makeNode();
    const e = makeDragEvent();

    handlers(node).onDragOver(e);

    expect(e.defaultPrevented).toBe(true);
    expect(e.dataTransfer.dropEffect).toBe('copy');
  });

  it('emits the dropped file itself, with its metadata', () => {
    const node = makeNode();
    const file = makeFile('avatar.png', 'image/png', 2048);
    const e = makeDragEvent({ files: [file] });

    handlers(node).onDrop(e);

    // Identity, not equality: `Upload File` is handed this object.
    expect(readOutput(node, 'droppedFile')).toBe(file);
    expect(readOutput(node, 'droppedFileName')).toBe('avatar.png');
    expect(readOutput(node, 'droppedFileType')).toBe('image/png');
    expect(readOutput(node, 'droppedFileSizeInBytes')).toBe(2048);
    expect(node.signals).toEqual(['filesDropped']);
  });

  it('carries every file of a multi-file drop', () => {
    const node = makeNode();
    const a = makeFile('a.png', 'image/png');
    const b = makeFile('b.png', 'image/png');
    const e = makeDragEvent({ files: [a, b] });

    handlers(node).onDrop(e);

    expect(readOutput(node, 'droppedFiles')).toEqual([a, b]);
    expect(readOutput(node, 'droppedFile')).toBe(a);
  });

  it('stops the drop at the innermost zone that handles it', () => {
    const node = makeNode();
    const e = makeDragEvent({ files: [makeFile('a.png', 'image/png')] });

    handlers(node).onDrop(e);

    expect(e.defaultPrevented).toBe(true);
    expect(e.propagationStopped).toBe(true);
  });

  it('marks the value outputs dirty, or the graph reads last drop’s file', () => {
    const node = makeNode();
    handlers(node).onDrop(makeDragEvent({ files: [makeFile('a.png', 'image/png')] }));

    expect(node.dirtied).toEqual(
      expect.arrayContaining([
        'droppedFile',
        'droppedFiles',
        'droppedFileName',
        'droppedFileType',
        'droppedFileSizeInBytes'
      ])
    );
  });
});

describe('DEF-029 — Accepted file types', () => {
  it('accepts everything when the port is blank', () => {
    const node = makeNode({ acceptedFileTypes: undefined });
    handlers(node).onDrop(makeDragEvent({ files: [makeFile('notes.pdf', 'application/pdf')] }));

    expect(node.signals).toEqual(['filesDropped']);
  });

  it('matches a wildcard MIME group', () => {
    const node = makeNode({ acceptedFileTypes: 'image/*' });
    handlers(node).onDrop(makeDragEvent({ files: [makeFile('a.png', 'image/png')] }));

    expect(node.signals).toEqual(['filesDropped']);
  });

  it('matches by extension', () => {
    const node = makeNode({ acceptedFileTypes: '.png, .jpg' });
    handlers(node).onDrop(makeDragEvent({ files: [makeFile('a.JPG', 'image/jpeg')] }));

    expect(node.signals).toEqual(['filesDropped']);
  });

  it('keeps only the acceptable files out of a mixed drop', () => {
    const node = makeNode({ acceptedFileTypes: 'image/*' });
    const png = makeFile('a.png', 'image/png');
    const e = makeDragEvent({ files: [makeFile('notes.pdf', 'application/pdf'), png] });

    handlers(node).onDrop(e);

    expect(readOutput(node, 'droppedFiles')).toEqual([png]);
    expect(node.signals).toEqual(['filesDropped']);
  });

  it('says so rather than going silent when nothing in the drop is acceptable', () => {
    // 🔴 The Failure Contract clause `Open File Picker` follows: a completion signal must not
    // fire for an operation that produced nothing. Silence is not the alternative — an author
    // who set "image/*" and dropped a PDF would have no way to tell the app from a broken one.
    const node = makeNode({ acceptedFileTypes: 'image/*' });
    const e = makeDragEvent({ files: [makeFile('notes.pdf', 'application/pdf')] });

    handlers(node).onDrop(e);

    expect(node.signals).toEqual(['filesRejected']);
    expect(readOutput(node, 'droppedFile')).toBeUndefined();
    expect(readOutput(node, 'droppedFiles')).toEqual([]);
    // Still consumed: the browser must not navigate away to the file it just refused.
    expect(e.defaultPrevented).toBe(true);
  });

  it('does not let `image/*` match a look-alike group', () => {
    const node = makeNode({ acceptedFileTypes: 'image/*' });
    handlers(node).onDrop(makeDragEvent({ files: [makeFile('x', 'imagex/png')] }));

    expect(node.signals).toEqual(['filesRejected']);
  });
});

describe('DEF-029 — Is Dragging Over survives a child', () => {
  it('stays true while the pointer crosses onto an inner element', () => {
    // 🔴 The row that fails against the obvious implementation. A drop zone with a label in it
    // fires: enter(zone), enter(label) + leave(zone). A plain boolean is false from here on and
    // the highlight flickers off exactly when the pointer is over the target.
    const node = makeNode();
    const h = handlers(node);

    h.onDragEnter(makeDragEvent());
    expect(readOutput(node, 'isDragOver')).toBe(true);

    h.onDragEnter(makeDragEvent()); // onto the child
    h.onDragLeave(makeDragEvent()); // off the parent, same gesture
    expect(readOutput(node, 'isDragOver')).toBe(true);

    h.onDragLeave(makeDragEvent()); // genuinely gone
    expect(readOutput(node, 'isDragOver')).toBe(false);
  });

  it('clears on drop, so the zone does not stay lit', () => {
    const node = makeNode();
    const h = handlers(node);

    h.onDragEnter(makeDragEvent());
    h.onDrop(makeDragEvent({ files: [makeFile('a.png', 'image/png')] }));

    expect(readOutput(node, 'isDragOver')).toBe(false);
  });

  it('publishes the change once, not on every dragover', () => {
    const node = makeNode();
    const h = handlers(node);

    h.onDragEnter(makeDragEvent());
    h.onDragOver(makeDragEvent());
    h.onDragOver(makeDragEvent());

    expect(node.dirtied.filter((n) => n === 'isDragOver')).toEqual(['isDragOver']);
  });
});

describe('DEF-029 — pointerProps puts the handlers on the element', () => {
  it('carries the drag events through', () => {
    const onDrop = jest.fn();
    const result = pointerProps({ pointer: { onDrop } } as any);

    expect(typeof result.onDrop).toBe('function');
    result.onDrop({});
    expect(onDrop).toHaveBeenCalled();
  });

  it('installs nothing when no drop handler was registered', () => {
    // Purely additive — the reason no existing project's rendered props change.
    const result = pointerProps({ pointer: {} } as any);

    expect(result.onDrop).toBeUndefined();
    expect(result.onDragOver).toBeUndefined();
  });

  it('🔴 does not let Block Pointer Events kill a parent drop zone', () => {
    // `blockTouch` installs a `stopPropagation` blocker on every event it covers, even ones
    // with no listener. If the drag events were folded into that list, a child with the port
    // switched on would stop `dragover` reaching the zone it sits inside — so the parent never
    // calls `preventDefault`, and the browser refuses the drop over that region with no
    // diagnosis anywhere. This row is why they are a separate list.
    const result = pointerProps({ blockTouch: true, pointer: {} } as any);

    expect(result.onDragOver).toBeUndefined();
    expect(result.onDrop).toBeUndefined();
    // The sixteen pointer events are still blocked exactly as before.
    expect(typeof result.onClick).toBe('function');
  });

  it('flushes dirty nodes after a drop, so the graph updates in the same frame', () => {
    let flushes = 0;
    const noodlNode = { context: { updateDirtyNodes: () => flushes++ } };
    const result = pointerProps({ pointer: { onDrop: () => undefined }, noodlNode } as any);

    result.onDrop({});

    expect(flushes).toBe(1);
  });
});
