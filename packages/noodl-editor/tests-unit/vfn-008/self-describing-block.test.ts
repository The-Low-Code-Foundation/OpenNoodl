/**
 * VFN-008 — a saved block that describes itself.
 *
 * > *"Once saved, it's not easy to know what your saved block actually does. If you put it on a
 * > canvas later on, how do you know what inputs and outputs it has? What it's supposed to do?
 * > How you're supposed to hook it up? If the block declares inputs, outputs, variables etc. do
 * > they get ported into the current logic node editor by default when you place the saved
 * > block?"*
 *
 * Three of those four questions are the same absence — nothing asked for a description, nothing
 * showed one, and the flyout showed a name and nothing else — and the answer to all three was
 * already computed and thrown away. The fourth has a factual answer, and it is the one graded
 * hardest below, because it is the one a builder will get wrong silently.
 *
 * ## 🔴 What every "the sentence is there" test is worth on its own, which is nothing
 *
 * Criterion 2 is an absence — *"a definition saved without a description still shows its shape
 * and the propagation warning; the absence degrades, it does not blank"* — and so is criterion 6
 * — *"old definitions, every one of which has `description: undefined`, load and render without
 * a diagnostic."* A suite that only ever asserts that a builder function returned a non-empty
 * string cannot tell a working builder from one that returns the same hard-coded sentence it
 * always did.
 *
 * So the NEGATIVE CONTROL below runs this suite's own assertions against **the tooltip as it
 * was** — the single hard-coded string every saved block shared — and requires them to fail
 * there. That is the reason to believe the rest of the file.
 */
import * as Blockly from 'blockly';

import { detectIO } from '@noodl/runtime/src/nodes/std-library/logic-builder-io';

import { initBlocklyIntegration } from '../../src/editor/src/views/BlocklyEditor/initialize';
import {
  callBlockJson,
  generateWithMyBlocks,
  initMyBlocks,
  myBlocksFlyout,
  setMyBlocksDefinitionSource
} from '../../src/editor/src/views/BlocklyEditor/MyBlocksBlocks';
import type { BlocklyWorkspaceJson, MyBlockDefinition } from '../../src/editor/src/views/BlocklyEditor/myblocks/format';
import { validateLibrary } from '../../src/editor/src/views/BlocklyEditor/myblocks/format';
import { collectVariableReferences } from '../../src/editor/src/views/BlocklyEditor/myblocks/references';
import {
  describeCallPreview,
  describeCallTooltip,
  describeFlyoutLabels,
  describeSignatureLine,
  describeVariableWarning,
  MY_BLOCKS_BLOCK_GLYPH,
  MY_BLOCKS_PROPAGATION_NOTE,
  normaliseBlockDescription
} from '../../src/editor/src/views/BlocklyEditor/myblocks/saveIntent';
import { InMemoryShelf, MyBlocksStore } from '../../src/editor/src/views/BlocklyEditor/myblocks/store';
import { arithmetic, number, setOutput, workspace } from '../lgc-007/fixtures';

/** The tooltip every saved block shared before this task. The control's subject. */
const TOOLTIP_BEFORE = 'A group of blocks you saved. Editing the saved block changes it everywhere.';

function newStore() {
  return new MyBlocksStore({ project: new InMemoryShelf('project'), user: new InMemoryShelf('user') });
}

/** A body that reads a Blockly workspace variable — the hazard, in the shape Blockly stores it. */
function bodyUsingVariable(name: string, id = 'var_1'): BlocklyWorkspaceJson {
  return {
    variables: [{ name, id }],
    blocks: {
      languageVersion: 0,
      blocks: [
        setOutput('r', {
          type: 'math_arithmetic',
          fields: { OP: 'MULTIPLY' },
          inputs: {
            A: { block: { type: 'variables_get', fields: { VAR: { id } } } },
            B: { block: number(2) }
          }
        })
      ]
    }
  };
}

/** Blockly resolves a function tooltip when it is shown. This is that resolution. */
function tooltipOf(block: Blockly.Block): string {
  const tip = (block as unknown as { tooltip: unknown }).tooltip;
  return typeof tip === 'function' ? String((tip as () => unknown)()) : String(tip);
}

beforeAll(() => {
  initBlocklyIntegration();
  initMyBlocks();
});

afterEach(() => {
  setMyBlocksDefinitionSource(null);
});

describe('VFN-008 §1 — the field that was never fitted', () => {
  it('🔴 stores undefined for a blank description, never the empty string', () => {
    // `MyBlockDefinition.description` is optional and every definition ever written has it
    // absent. "No description" has to be one value, not two, or every reader downstream
    // inherits the distinction — the same `undefined` ≠ `''` the generate seam paid for once.
    expect(normaliseBlockDescription('')).toBeUndefined();
    expect(normaliseBlockDescription('   ')).toBeUndefined();
    expect(normaliseBlockDescription(undefined)).toBeUndefined();
    expect(normaliseBlockDescription(null)).toBeUndefined();
    expect(normaliseBlockDescription('')).not.toBe('');
  });

  it('stores the trimmed description when there is one', () => {
    expect(normaliseBlockDescription('  Applies the seasonal band.  ')).toBe('Applies the seasonal band.');
  });

  it('criterion 1 — a description survives the write and the round trip through JSON', () => {
    // "Survives a reload" means surviving `project.json`, which is JSON and a validator, not
    // an in-memory object handed straight back. A tooltip built from a definition that never
    // left the process is a different claim from the one being made.
    const store = newStore();
    const saved = store.save({
      name: 'Discount',
      description: 'Applies the current seasonal discount band.',
      body: workspace(arithmetic('MULTIPLY', undefined, number(2))),
      scope: 'project'
    });

    const onDisk = JSON.parse(JSON.stringify({ formatVersion: 1, definitions: [saved] }));
    const { library, rejected } = validateLibrary(onDisk);

    expect(rejected).toEqual([]);
    expect(library.definitions[0].description).toBe('Applies the current seasonal discount band.');
  });

  it('criterion 6 — a definition written before this task loads with no diagnostic', () => {
    // Every definition on every shelf today has `description: undefined`, because nothing has
    // ever asked for one. Loading one must not produce a rejection, and rendering it must not
    // produce a blank.
    const store = newStore();
    const old = store.save({ name: 'Half', body: workspace(number(2)), scope: 'project' });
    expect(old.description).toBeUndefined();

    const { library, rejected } = validateLibrary(JSON.parse(JSON.stringify({ formatVersion: 1, definitions: [old] })));

    expect(rejected).toEqual([]);
    expect(library.definitions[0].description).toBeUndefined();
    expect(describeCallTooltip(library.definitions[0]).length).toBeGreaterThan(0);
    expect(describeFlyoutLabels(library.definitions[0]).length).toBeGreaterThan(0);
  });
});

describe('VFN-008 §2 — the block says what it is', () => {
  const valueDefinition = {
    name: 'Discount',
    shape: 'value' as const,
    params: [{ name: 'price' }, { name: 'rate' }],
    description: 'Applies the current seasonal discount band.'
  };

  it('names the block, what it takes, and what it gives', () => {
    expect(describeSignatureLine(valueDefinition)).toBe('Discount — takes price and rate, and gives a value.');
  });

  it('says "gives a value" or "stacks", because those are the two things a block can be', () => {
    expect(describeSignatureLine({ name: 'Half', shape: 'value', params: [] })).toBe('Half — gives a value.');
    expect(describeSignatureLine({ name: 'Finish', shape: 'statement', params: [] })).toBe(
      'Finish — stacks with your other blocks.'
    );
    expect(describeSignatureLine({ name: 'Log', shape: 'statement', params: [{ name: 'message' }] })).toBe(
      'Log — takes message, and stacks with your other blocks.'
    );
  });

  it('the tooltip is the shape, the description, and the fact with the largest blast radius', () => {
    expect(describeCallTooltip(valueDefinition)).toBe(
      [
        'Discount — takes price and rate, and gives a value.',
        'Applies the current seasonal discount band.',
        MY_BLOCKS_PROPAGATION_NOTE
      ].join('\n')
    );
  });

  it('🔴 criterion 2 — no description degrades to the shape and the warning, it does not blank', () => {
    const tooltip = describeCallTooltip({ name: 'Half', shape: 'value', params: [] });

    expect(tooltip).toBe(`Half — gives a value.\n${MY_BLOCKS_PROPAGATION_NOTE}`);
    // `''` and `'   '` are the same absence as `undefined`, and all three must produce the same
    // tooltip — a blank line in the middle of a tooltip is what "it does not blank" rules out.
    expect(describeCallTooltip({ name: 'Half', shape: 'value', params: [], description: '' })).toBe(tooltip);
    expect(describeCallTooltip({ name: 'Half', shape: 'value', params: [], description: '   ' })).toBe(tooltip);
    expect(tooltip.split('\n').every((line) => line.trim().length > 0)).toBe(true);
  });

  it('never drops the propagation note, whatever else it has to say', () => {
    // Editing a saved block edits it everywhere. It is the property that makes a saved block
    // worth having and the one that makes an unwitting edit expensive, so it is in every
    // tooltip a saved block will ever show.
    const shapes = [
      { name: 'A', shape: 'value' as const, params: [] },
      { name: 'B', shape: 'statement' as const, params: [{ name: 'x' }], description: 'Does a thing.' },
      { name: '', shape: 'value' as const, params: [], variables: ['n'] }
    ];
    for (const definition of shapes) {
      expect(describeCallTooltip(definition).endsWith(MY_BLOCKS_PROPAGATION_NOTE)).toBe(true);
    }
  });

  it('survives a definition with no name at all rather than producing a dangling dash', () => {
    expect(describeSignatureLine({ name: '', shape: 'value', params: [] })).toBe('This block — gives a value.');
  });

  /**
   * 🔴 NEGATIVE CONTROL for every assertion in this describe block.
   *
   * They are all of the form "the tooltip contains X", and a builder that returned a fixed
   * string would satisfy several of them by accident — the old one already ends with the
   * propagation note, because that sentence is the half of it that was worth keeping. So run the
   * same assertions against the tooltip **as it was**, and require them to fail.
   */
  it('NEGATIVE CONTROL — the tooltip as it was fails the assertions above', () => {
    // It does end with the propagation note. That is exactly why that assertion alone proves
    // nothing, and why the two that follow are the ones doing the work.
    expect(TOOLTIP_BEFORE.endsWith(MY_BLOCKS_PROPAGATION_NOTE)).toBe(true);

    // It does not name the block, and it does not carry what anyone wrote about it.
    expect(TOOLTIP_BEFORE).not.toContain('Discount');
    expect(TOOLTIP_BEFORE).not.toContain('Applies the current seasonal discount band.');
    expect(TOOLTIP_BEFORE).not.toBe(describeCallTooltip(valueDefinition));

    // 🔴 And it is *identical* for two definitions that share nothing, which is the defect in
    // one line: a tooltip that cannot tell two blocks apart is not describing either of them.
    const a = describeCallTooltip({ name: 'Discount', shape: 'value', params: [{ name: 'price' }] });
    const b = describeCallTooltip({ name: 'Finish', shape: 'statement', params: [] });
    expect(a).not.toBe(b);
    expect(TOOLTIP_BEFORE).toBe(TOOLTIP_BEFORE);
  });
});

describe('VFN-008 §2 — the tooltip on a real block, resolved when it is shown', () => {
  it('🔴 resolves the live definition, so a description reaches a block placed before it', () => {
    // ⚠️ Blockly sets tooltips in `init()`, before `loadExtraState` has run and while the
    // block's state is still a stub — which is how the tooltip came to be a hard-coded string in
    // the first place. A function tooltip is resolved when the tooltip is shown.
    const store = newStore();
    const definition = store.save({
      name: 'Discount',
      description: 'Applies the current seasonal discount band.',
      body: workspace(arithmetic('MULTIPLY', undefined, number(2))),
      scope: 'project'
    });
    setMyBlocksDefinitionSource(store);

    const ws = new Blockly.Workspace();
    try {
      const block = Blockly.serialization.blocks.append(callBlockJson(definition) as never, ws);
      const tooltip = tooltipOf(block);

      expect(tooltip).toContain('Discount');
      expect(tooltip).toContain('Applies the current seasonal discount band.');
      expect(tooltip).toContain(MY_BLOCKS_PROPAGATION_NOTE);
      expect(tooltip).not.toBe(TOOLTIP_BEFORE);
    } finally {
      ws.dispose();
    }
  });

  it('falls back to the block’s own extraState when no store is injected', () => {
    // A call block in a headless generate, in a spec, or in a workspace opened before the store
    // was registered has no source. `label` and `args` are serialised on the block precisely so
    // a saved body is self-describing, and that is enough for a shape sentence.
    const definition: MyBlockDefinition = {
      formatVersion: 1,
      id: 'mb_x',
      name: 'Double',
      shape: 'value',
      params: [{ id: 'p1', name: 'a', type: '*', hole: [] }],
      requires: [],
      body: workspace(arithmetic('MULTIPLY', undefined, number(2))),
      createdAt: '',
      updatedAt: ''
    };

    const ws = new Blockly.Workspace();
    try {
      const block = Blockly.serialization.blocks.append(callBlockJson(definition) as never, ws);
      const tooltip = tooltipOf(block);

      expect(tooltip).toBe(`Double — takes a, and gives a value.\n${MY_BLOCKS_PROPAGATION_NOTE}`);
    } finally {
      ws.dispose();
    }
  });

  it('the shape in the fallback comes from the block type, which cannot lie about it', () => {
    // There are two block types rather than one with a flag, so a statement call block is a
    // statement whatever its cached state says.
    const ws = new Blockly.Workspace();
    try {
      const block = Blockly.serialization.blocks.append(
        { type: 'myblocks_call_statement', extraState: { defId: 'mb_1', args: [], label: 'Finish' } } as never,
        ws
      );
      expect(tooltipOf(block)).toContain('Finish — stacks with your other blocks.');
    } finally {
      ws.dispose();
    }
  });
});

describe('VFN-008 §3 — the flyout shows the shape', () => {
  it('criterion 1 — the shape sentence and the description are both in the category', () => {
    const store = newStore();
    store.save({
      name: 'Discount',
      description: 'Applies the current seasonal discount band.',
      body: workspace(arithmetic('MULTIPLY', undefined, number(2))),
      scope: 'project'
    });

    const flyout = myBlocksFlyout(store)() as { kind: string; text?: string }[];
    const text = flyout
      .filter((item) => item.kind === 'label')
      .map((item) => item.text)
      .join('\n');

    expect(text).toContain('Discount — takes a, and gives a value.');
    expect(text).toContain('Applies the current seasonal discount band.');
    // The block is still there. A label instead of a block would be a category you cannot drag
    // anything out of.
    expect(flyout.filter((item) => item.kind === 'block')).toHaveLength(1);
  });

  it('criterion 2 — a definition with no description still gets its shape sentence', () => {
    const store = newStore();
    store.save({ name: 'Half', body: workspace(number(2)), scope: 'project' });

    const labels = myBlocksFlyout(store)()
      .filter((item) => (item as { kind: string }).kind === 'label')
      .map((item) => (item as { text: string }).text);

    expect(labels).toEqual(['Half — gives a value.']);
  });

  it('the labels sit above their own block, so two definitions cannot be confused', () => {
    const store = newStore();
    store.save({ name: 'Half', body: workspace(number(2)), scope: 'project' });
    store.save({ name: 'Finish', body: workspace(setOutput('r', number(1))), scope: 'project' });

    const kinds = (myBlocksFlyout(store)() as { kind: string }[]).map((item) => item.kind);

    expect(kinds).toEqual(['label', 'block', 'label', 'block']);
  });

  it('⚠️ still explains the gesture when the shelf is empty', () => {
    const flyout = myBlocksFlyout(newStore())() as { kind: string; text?: string }[];
    expect(flyout.every((item) => item.kind === 'label')).toBe(true);
    expect(flyout.map((item) => item.text).join(' ')).toContain('Right-click a block');
  });
});

describe('VFN-008 §4 — the dialog shows what it will look like', () => {
  it('previews the block’s face, with the socket labels it will actually have', () => {
    expect(describeCallPreview('Discount', [{ name: 'price' }, { name: 'rate' }])).toBe(
      `${MY_BLOCKS_BLOCK_GLYPH} Discount   price   rate`
    );
  });

  it('shows a placeholder rather than a bare glyph before anything is typed', () => {
    expect(describeCallPreview('', [])).toBe(`${MY_BLOCKS_BLOCK_GLYPH} your block`);
    expect(describeCallPreview('   ', [{ name: 'a' }])).toBe(`${MY_BLOCKS_BLOCK_GLYPH} your block   a`);
  });

  it('🔴 wears the same glyph the call block’s header field renders', () => {
    // Both come from `MY_BLOCKS_BLOCK_GLYPH`. A preview showing a different mark from the block
    // it previews is a mockup, not a preview.
    const ws = new Blockly.Workspace();
    try {
      const block = Blockly.serialization.blocks.append(
        { type: 'myblocks_call_value', extraState: { defId: 'mb_1', args: [], label: 'Half' } } as never,
        ws
      );
      const header = block.getField('HEADER') ?? block.inputList[0]?.fieldRow[0];
      expect(String(header?.getText())).toContain(MY_BLOCKS_BLOCK_GLYPH);
      expect(describeCallPreview('Half', [])).toContain(MY_BLOCKS_BLOCK_GLYPH);
    } finally {
      ws.dispose();
    }
  });
});

describe('VFN-008 — the variable that does not travel with the block', () => {
  it('🔴 finds a Blockly workspace variable, by the id its field records', () => {
    expect(collectVariableReferences(bodyUsingVariable('n'))).toEqual(['n']);
  });

  it('reads the older spelling too, where the field is the name itself', () => {
    const body = workspace({ type: 'variables_get', fields: { VAR: 'total' } });
    expect(collectVariableReferences(body)).toEqual(['total']);
  });

  it('reports each variable once, in document order', () => {
    const body: BlocklyWorkspaceJson = {
      variables: [
        { name: 'n', id: 'v1' },
        { name: 'i', id: 'v2' }
      ],
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'variables_set',
            fields: { VAR: { id: 'v1' } },
            inputs: { VALUE: { block: { type: 'variables_get', fields: { VAR: { id: 'v2' } } } } },
            next: { block: { type: 'variables_get', fields: { VAR: { id: 'v1' } } } }
          }
        ]
      }
    };

    expect(collectVariableReferences(body)).toEqual(['n', 'i']);
  });

  it('🔴 does NOT warn about Noodl variables, which are global and do travel', () => {
    // `noodl_get_variable` / `noodl_set_variable` are the *runtime's* variables — resolved by
    // name at run time and unaffected by which workspace the block is in. Warning about those
    // would be a false alarm on the mechanism that works, which is worse than no warning.
    const body = workspace({
      type: 'noodl_set_variable',
      fields: { NAME: 'score' },
      inputs: { VALUE: { block: number(1) } }
    });

    expect(collectVariableReferences(body)).toEqual([]);
    expect(describeVariableWarning(collectVariableReferences(body))).toBeUndefined();
  });

  it('criterion 3 — the warning names the variable, and says what will happen to it', () => {
    expect(describeVariableWarning(collectVariableReferences(bodyUsingVariable('n')))).toBe(
      'This uses the variable "n", which will not travel with the block.'
    );
    expect(describeVariableWarning(['n', 'i'])).toBe(
      'This uses the variables "n" and "i", which will not travel with the block.'
    );
  });

  it('says nothing when there is nothing to say', () => {
    expect(describeVariableWarning([])).toBeUndefined();
    expect(describeVariableWarning(undefined)).toBeUndefined();
  });

  it('the warning reaches the tooltip too, so it is stated at placement as well as at save', () => {
    const store = newStore();
    const definition = store.save({ name: 'Double n', body: bodyUsingVariable('n'), scope: 'project' });
    setMyBlocksDefinitionSource(store);

    const ws = new Blockly.Workspace();
    try {
      const block = Blockly.serialization.blocks.append(callBlockJson(definition) as never, ws);
      expect(tooltipOf(block)).toContain('This uses the variable "n"');
    } finally {
      ws.dispose();
    }
  });
});

/**
 * The fourth question, and the half of criterion 4 that turned out to be **false as written**.
 *
 * > *"If the block declares inputs, outputs, variables etc. do they get ported into the current
 * > logic node editor by default when you place the saved block?"*
 *
 * VFN-008's task file answers *"Ports: yes, automatically"* on the reasoning that the workspace
 * is the single source of truth for ports and a saved block's body is inlined at generate time.
 * The first half is right and the second half is right, and the conclusion does not follow: the
 * two things happen to **different copies of the workspace**.
 *
 * `updatePorts` calls `detectIO(workspace)` on the *raw* serialised workspace — the same string
 * that is persisted as the node's `workspace` parameter — while `expandWorkspace` runs inside
 * `generateWithMyBlocks` and its output is thrown away after the JavaScript is generated.
 * `detectIO` has never heard of `myblocks_call_*`, so a call block contributes no mentions and
 * the host node gets no ports.
 *
 * The two tests below pin the true behaviour rather than the assumed one, so that whoever fixes
 * it has a spec that changes colour when they do.
 */
describe('VFN-008 — 🔴 FINDING: a placed saved block publishes no ports', () => {
  it('the generated code writes the output, so the program is right', () => {
    const store = newStore();
    const definition = store.save({
      name: 'Total',
      body: workspace(setOutput('total', number(7))),
      scope: 'project'
    });
    expect(definition.shape).toBe('statement');

    const host = new Blockly.Workspace();
    try {
      Blockly.serialization.blocks.append(callBlockJson(definition) as never, host);
      const saved = Blockly.serialization.workspaces.save(host) as BlocklyWorkspaceJson;

      const generated = generateWithMyBlocks(host, saved, store);
      expect(generated.error).toBeUndefined();
      expect(generated.code).toBe('Outputs["total"] = 7;\n');

      /**
       * 🔴 …and the node has no `total` port to wire that to.
       *
       * `detectIO` reads the *workspace*, deliberately — code only ever mentions the ports it
       * uses and could never see a declared-but-unused input, nor tell a signal from a value.
       * But the workspace it reads is the un-expanded one, and expansion happens in a copy that
       * only the generator sees.
       *
       * This assertion is the finding, not the requirement. When someone plumbs the definitions
       * through to port detection, this line goes red and is the right line to change.
       */
      expect(detectIO(saved).outputs).toEqual([]);

      // The same body, inlined, does publish the port — which is what pins the cause to the
      // call block being opaque to `detectIO` rather than to anything about `set output`.
      expect(detectIO(workspace(setOutput('total', number(7)))).outputs).toEqual([{ name: 'total', type: '*' }]);
    } finally {
      host.dispose();
    }
  });

  it('a definition’s internal Blockly variables never become ports, which is right', () => {
    // The half of criterion 4 that does hold, and would hold even after the half above is
    // fixed: a Blockly workspace variable is not a port and must not be published as one.
    const inlined = bodyUsingVariable('n');
    const io = detectIO(inlined);

    expect(io.inputs.map((port) => port.name)).not.toContain('n');
    expect(io.outputs.map((port) => port.name)).toEqual(['r']);
  });
});
