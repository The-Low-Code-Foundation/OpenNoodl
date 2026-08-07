/**
 * NDA-004 §2 — Open File Picker, whose missing outcome was never a failure.
 *
 * Register ⏳ item 2: *"has `success` and no counterpart; cancel and read-error are both real."*
 * Half right, and the half it got wrong is the interesting one.
 *
 * **Cancel is real and it is not a failure.** `<input type="file">` fires `cancel` when the dialog
 * closes with nothing chosen (Chrome 113+, Safari 16.4+, Firefox 109+) and the node had no listener,
 * so "the user chose a file" and "the user changed their mind" were the same observable: `Success`
 * in one case and, for ever, nothing in the other. Anything an author put behind `Open` — a spinner,
 * a disabled button, a queued upload — had no way back. But a user declining a dialog is a
 * *legitimate empty result*, which the Failure Contract lists among the things that must **not**
 * raise. A `Failure` there would fire on a graph working exactly as written. So the fix is a
 * `Cancelled` **completion** signal, which is the contract's other clause, and the rows below assert
 * that nothing reaches the error channel on that path.
 *
 * **There is no read error.** The prediction assumed one; the node never reads the file. It hands
 * out the `File` object and five pieces of metadata, and reading is somebody else's node. Recorded
 * rather than invented.
 *
 * **There was a third thing, and it is the one that reported success wrongly.** `change` can arrive
 * with an empty `FileList` — a re-pick the user backed out of is the common way — and the node
 * assigned `files[0]` unconditionally, discarding whatever file *had* been picked, and then fired
 * `Success` with all five outputs reading `undefined`. Same class as everything else in this batch:
 * a completion signal for an operation that produced nothing.
 *
 * The `Failure` port it does get is for `input.click()` throwing, which is refused in a sandboxed
 * frame without `allow-modals`. Left unguarded, that exception propagated out of an input setter —
 * the shape that made `Response` a crash rather than a silence in §3.
 *
 * ## Limitation, recorded rather than hidden
 *
 * This monorepo has no `jest-environment-jsdom`, and the viewer runs `testEnvironment: node`, so
 * there is no `document` for `initialize` to call `createElement` on — the node cannot even be
 * constructed. These rows stub the element, which is the same call `nda-004-video-playback.test.tsx`
 * makes with a stub media element, for the same reason: the boundary this node owns ends at
 * `onchange` / `oncancel`, and everything past it is the browser's file dialog. Driving those
 * handlers *is* driving the node.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

/** The parts of `HTMLInputElement` this node touches, and nothing else. */
interface StubInput {
  type?: string;
  accept?: string;
  capture?: string;
  value: string;
  onchange: ((e: unknown) => void) | null;
  oncancel: (() => void) | null;
  click(): void;
  clicks: number;
  clickThrows?: Error;
}

function createStubInput(): StubInput {
  const input: StubInput = {
    value: '',
    onchange: null,
    oncancel: null,
    clicks: 0,
    click() {
      input.clicks++;
      if (input.clickThrows) throw input.clickThrows;
    }
  };
  return input;
}

/** One file's worth of the `File` surface the node reads. */
function stubFile(name: string) {
  return { name, size: 1234, type: 'text/plain', path: '/tmp/' + name };
}

let stubInput: StubInput;
let realDocument: unknown;

beforeEach(() => {
  stubInput = createStubInput();
  realDocument = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: () => stubInput
  };
});

afterEach(() => {
  (globalThis as { document?: unknown }).document = realDocument;
});

interface TriggerInstance extends NodeInstance {
  go(): void;
}

const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: { go: { type: 'signal' } },
    methods: {
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      }
    }
  }
};

interface PickerInternals {
  _internal: { file?: { name: string }; error?: string };
}

async function pickerGraph(): Promise<CorpusGraph> {
  // Required lazily: the module is imported *after* `document` is stubbed by `beforeEach`, and
  // `initialize` calls `createElement` on it. A top-level import is fine here in practice but
  // ties the file to load order for no benefit.
  const OpenFilePickerModule = (await import('../../src/nodes/std-library/openfilepicker')).default;

  const graph = await createCorpusGraph({
    modules: [TriggerModule, OpenFilePickerModule as unknown as NodeModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'picker', type: 'Open File Picker' }
          ],
          connections: [{ sourceId: 'trigger', sourcePort: 'go', targetId: 'picker', targetPort: 'open' }]
        }
      ]
    } as never
  });

  await graph.settle(4);
  graph.signalsFor('picker').length = 0;
  graph.errors.length = 0;
  return graph;
}

/** Pulse `Open`, which is what arms the handlers and calls `click()`. */
async function pressOpen(graph: CorpusGraph): Promise<void> {
  graph.node<TriggerInstance>('trigger').go();
  await graph.settle(4);
}

function internals(graph: CorpusGraph): PickerInternals['_internal'] {
  return (graph.node('picker') as unknown as PickerInternals)._internal;
}

describe('NDA-004 §2: Open File Picker — the dialog the user closed', () => {
  test('a cancelled dialog reports Unchanged, where it used to report nothing at all', async () => {
    const graph = await pickerGraph();
    await pressOpen(graph);

    stubInput.oncancel();

    // ERG-001 §4 renamed `cancelled` to the contract's `unchanged`, and `Completed` follows
    // every outcome.
    expect(graph.signalsFor('picker')).toEqual(['unchanged', 'completed']);
  });

  test('Unchanged is not a failure: nothing reaches the error channel and Failure stays quiet', async () => {
    const graph = await pickerGraph();
    await pressOpen(graph);

    stubInput.oncancel();

    // The discrimination this file exists for. A user declining a dialog is a legitimate empty
    // result — raising here would put a normal interaction into `On App Error` and train authors
    // to ignore the port.
    expect(graph.errors).toEqual([]);
    expect(graph.signalsFor('picker')).not.toContain('failure');
  });

  test('a change with an empty FileList reports Unchanged, not Done', async () => {
    const graph = await pickerGraph();
    await pressOpen(graph);

    stubInput.onchange({ target: { files: [] } });

    // `Success` used to fire here with all five outputs reading `undefined`.
    expect(graph.signalsFor('picker')).toEqual(['unchanged', 'completed']);
  });

  test('a cancelled pick does not discard the file already picked', async () => {
    const graph = await pickerGraph();

    await pressOpen(graph);
    stubInput.onchange({ target: { files: [stubFile('kept.txt')] } });

    await pressOpen(graph);
    stubInput.onchange({ target: { files: [] } });

    // The old code assigned `files[0]` unconditionally, so backing out of a re-pick wiped the
    // previous result *and* announced success. The last file picked is still the node's answer.
    expect(internals(graph).file.name).toBe('kept.txt');
  });

  test('the handlers come off after an outcome, so one Open cannot answer twice', async () => {
    const graph = await pickerGraph();
    await pressOpen(graph);

    stubInput.oncancel();

    expect(stubInput.onchange).toBeNull();
    expect(stubInput.oncancel).toBeNull();
  });
});

describe('NDA-004 §2: Open File Picker — the dialog that would not open', () => {
  test('click() throwing is a Failure, reported on the runtime channel', async () => {
    const graph = await pickerGraph();
    stubInput.clickThrows = new Error('blocked by sandbox');

    await pressOpen(graph);

    expect(graph.signalsFor('picker')).toContain('failure');
    const raised = graph.errors.filter((e) => e.code === 'open-file-picker/open-failed');
    expect(raised.length).toBe(1);
    expect(raised[0].message).toContain('blocked by sandbox');
    expect(internals(graph).error).toContain('blocked by sandbox');
  });

  test('the report is structured, which a thrown exception could never be', async () => {
    const graph = await pickerGraph();
    stubInput.clickThrows = new Error('blocked by sandbox');

    await pressOpen(graph);

    // This row started life as "the exception does not propagate", and the discrimination check
    // showed it green with the `try`/`catch` removed — because `nodecontext.ts:220-228` already
    // wraps every node's `update()` in a catch that `console.error`s. So an unguarded throw here
    // was never a crash; the runtime's blanket catch is why nobody noticed it.
    //
    // What it *was* is a bare console line with no code and no provenance — nothing on the
    // channel, nothing for `On App Error`, and the rest of this node's pass abandoned, because
    // `Node.update` rethrows to that catch. Clause 2 of the contract, "structured, not a string",
    // is therefore the claim worth pinning, and provenance is the half a console line cannot have.
    const raised = graph.errors.filter((e) => e.code === 'open-file-picker/open-failed');
    expect(raised.length).toBe(1);
    expect(raised[0].nodeId).toBe('picker');
    expect(raised[0].nodeType).toBe('Open File Picker');
    expect(raised[0].componentName).toBe('/root');
  });

  test('a failed open leaves no handlers armed for a later attempt to trip over', async () => {
    const graph = await pickerGraph();
    stubInput.clickThrows = new Error('blocked by sandbox');

    await pressOpen(graph);

    expect(stubInput.onchange).toBeNull();
    expect(stubInput.oncancel).toBeNull();
  });

  test('the three outcome ports, Completed and the Error output all exist', async () => {
    const graph = await pickerGraph();
    const picker = graph.node('picker');

    // Asserted directly, because `signalsFor` records a port name before delegating and
    // `sendSignalOnOutput` on a port the node lacks only logs — see the corpus README.
    // ERG-001 §4: `success` -> `done`, `cancelled` -> `unchanged`, plus the universal
    // `completed`.
    expect(picker.hasOutput('done')).toBe(true);
    expect(picker.hasOutput('unchanged')).toBe(true);
    expect(picker.hasOutput('failure')).toBe(true);
    expect(picker.hasOutput('completed')).toBe(true);
    expect(picker.hasOutput('error')).toBe(true);
    expect(picker.hasOutput('success')).toBe(false);
    expect(picker.hasOutput('cancelled')).toBe(false);
  });
});

describe('NDA-004 §2: Open File Picker — the happy path is untouched', () => {
  // ✅ Pinned control. Without this every row above is equally consistent with a node that has
  // stopped picking files.
  test('(pinned control) a picked file reports Done and publishes all five outputs', async () => {
    const graph = await pickerGraph();
    await pressOpen(graph);

    expect(stubInput.clicks).toBe(1);
    stubInput.onchange({ target: { files: [stubFile('report.pdf')] } });

    expect(graph.signalsFor('picker')).toEqual(['done', 'completed']);
    expect(graph.errors).toEqual([]);

    const picker = graph.node('picker');
    expect(picker.getOutput('name').value).toBe('report.pdf');
    expect(picker.getOutput('type').value).toBe('text/plain');
    expect(picker.getOutput('sizeInBytes').value).toBe(1234);
    expect(picker.getOutput('path').value).toBe('/tmp/report.pdf');
    expect(picker.getOutput('file').value).toBeDefined();
  });

  // ✅ Pinned control. The value reset that lets the same file be picked twice is load-bearing
  // behaviour the original had, and easy to lose while moving the surrounding lines.
  test('(pinned control) the element value is reset so the same file can be picked again', async () => {
    const graph = await pickerGraph();
    await pressOpen(graph);

    stubInput.value = 'C:\\fakepath\\report.pdf';
    stubInput.onchange({ target: { files: [stubFile('report.pdf')] } });

    expect(stubInput.value).toBe('');
  });

  // ✅ Pinned control. Two successive picks both report, which is what says `_detachHandlers` did
  // not disarm the node permanently.
  test('(pinned control) a second Open works after a cancelled first', async () => {
    const graph = await pickerGraph();

    await pressOpen(graph);
    stubInput.oncancel();

    await pressOpen(graph);
    stubInput.onchange({ target: { files: [stubFile('second.txt')] } });

    expect(graph.signalsFor('picker')).toEqual(['unchanged', 'completed', 'done', 'completed']);
    expect(internals(graph).file.name).toBe('second.txt');
  });
});
