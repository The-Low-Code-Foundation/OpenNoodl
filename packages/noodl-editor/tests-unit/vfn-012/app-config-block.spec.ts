/**
 * VFN-012 §2 — the block, in real headless Blockly, with the real generator.
 *
 * Real Blockly for `hat-block.spec.ts`'s reason: every claim here is a claim about Blockly's
 * behaviour, and asserting it against a re-implementation of Blockly's rules would pass around
 * the defect rather than catch it. **This suite exists because that is not a figure of speech
 * here** — the defect criterion 2 forbids is one Blockly commits by default:
 *
 * > A stock `FieldDropdown` handed a value that is not in its option list logs *"Cannot set the
 * > dropdown's value to an unavailable option"* and then **replaces it with the first option**.
 *
 * So deleting a config variable in app settings would rewrite every block that read it to read
 * a *different* variable, at the moment the project was opened. `stockDropdownSnapsToFirstOption`
 * below builds exactly that block beside ours and watches it happen: it is the negative control
 * for the whole field, and if Blockly ever stops doing it, that test — not ours — goes red.
 */
import * as Blockly from 'blockly';

import type { ConfigVariable } from '@noodl/runtime/src/config/types';

import { withBlockProbes } from '../../src/editor/src/views/BlocklyEditor/BlockProbes';
import {
  appConfigReadExpression,
  resetConfigVariablesProvider,
  setConfigVariablesProvider,
  APP_CONFIG_BLOCK_TYPE,
  APP_CONFIG_CATEGORY,
  NO_CONFIG_VARIABLES_OPTION,
  UNKNOWN_KEY_MARK
} from '../../src/editor/src/views/BlocklyEditor/appConfig';
import { buildToolbox, DEFAULT_TOOLBOX_LABELS } from '../../src/editor/src/views/BlocklyEditor/BlocklyToolbox';
import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';
import { generateCode, initNoodlGenerators } from '../../src/editor/src/views/BlocklyEditor/NoodlGenerators';

initNoodlBlocks();
initNoodlGenerators();

function variable(key: string, type: ConfigVariable['type'] = 'string'): ConfigVariable {
  return { key, type, value: null };
}

function declare(...keys: string[]): void {
  setConfigVariablesProvider(() => keys.map((key) => variable(key)));
}

function withWorkspace<T>(body: (workspace: Blockly.Workspace) => T): T {
  const workspace = new Blockly.Workspace();
  try {
    return body(workspace);
  } finally {
    workspace.dispose();
  }
}

/** One config block wired into a `set output`, generated exactly as `flushSave` would. */
function programReading(key: string): string {
  return withWorkspace((workspace) => {
    const setOutput = workspace.newBlock('noodl_set_output');
    setOutput.setFieldValue('result', 'NAME');
    const read = workspace.newBlock(APP_CONFIG_BLOCK_TYPE);
    read.setFieldValue(key, 'KEY');
    setOutput.getInput('VALUE')!.connection!.connect(read.outputConnection!);

    return generateCode(workspace as Blockly.WorkspaceSvg);
  });
}

afterEach(() => {
  resetConfigVariablesProvider();
});

describe('VFN-012 — the App Config block', () => {
  it('is a value block with no inputs and no setter beside it', () => {
    declare('apiUrl');

    withWorkspace((workspace) => {
      const block = workspace.newBlock(APP_CONFIG_BLOCK_TYPE);

      expect(block.outputConnection).toBeTruthy();
      expect(block.previousConnection).toBeNull();
      expect(block.nextConnection).toBeNull();
    });

    // The read-only half of criterion 1: there is no `noodl_set_config` to register.
    expect(Blockly.Blocks['noodl_set_config']).toBeUndefined();
  });

  it('opens on the first declared variable, so a dragged block reads something real', () => {
    declare('apiUrl', 'maxItems');

    withWorkspace((workspace) => {
      expect(workspace.newBlock(APP_CONFIG_BLOCK_TYPE).getFieldValue('KEY')).toBe('apiUrl');
    });
  });

  it('🔴 builds at all in a project with no config variables, and says so on its face', () => {
    // The empty option list is not a nicety: `FieldDropdown.getOptions` throws a TypeError on an
    // empty array and is called from the field's own constructor, so this block would fail to
    // exist rather than appear empty.
    withWorkspace((workspace) => {
      const block = workspace.newBlock(APP_CONFIG_BLOCK_TYPE);

      expect(block.getFieldValue('KEY')).toBe('');
      expect(block.getField('KEY')!.getText()).toBe(NO_CONFIG_VARIABLES_OPTION);
    });
  });
});

describe('VFN-012 criterion 1 — what it generates', () => {
  it('reads Noodl.Config by key', () => {
    declare('apiUrl');

    expect(programReading('apiUrl')).toBe('Outputs["result"] = Noodl.Config["apiUrl"];\n');
  });

  it('generates a member access, so nothing around it acquires parentheses', () => {
    declare('maxItems');

    withWorkspace((workspace) => {
      const sum = workspace.newBlock('math_arithmetic');
      sum.setFieldValue('ADD', 'OP');
      const read = workspace.newBlock(APP_CONFIG_BLOCK_TYPE);
      read.setFieldValue('maxItems', 'KEY');
      sum.getInput('A')!.connection!.connect(read.outputConnection!);

      const setOutput = workspace.newBlock('noodl_set_output');
      setOutput.getInput('VALUE')!.connection!.connect(sum.outputConnection!);

      expect(generateCode(workspace as Blockly.WorkspaceSvg)).toContain('Noodl.Config["maxItems"] +');
    });
  });

  it('quotes a key that would otherwise break out of the string', () => {
    expect(appConfigReadExpression('a"b')).toBe('Noodl.Config["a\\"b"]');
    expect(appConfigReadExpression('back\\slash')).toBe('Noodl.Config["back\\\\slash"]');
    // …and is byte-identical to the neighbouring generators' spelling for an ordinary key.
    expect(appConfigReadExpression('apiUrl')).toBe('Noodl.Config["apiUrl"]');
  });

  it('refuses to read the placeholder key rather than emitting Noodl.Config[""]', () => {
    const code = programReading('');

    expect(code).not.toContain('Noodl.Config');
    expect(code).toContain('undefined');
  });

  it('survives LGC-003’s probes, which wrap every value expression', () => {
    declare('apiUrl');

    const probed = withBlockProbes(() =>
      withWorkspace((workspace) => {
        const read = workspace.newBlock(APP_CONFIG_BLOCK_TYPE);
        read.setFieldValue('apiUrl', 'KEY');
        const setOutput = workspace.newBlock('noodl_set_output');
        setOutput.getInput('VALUE')!.connection!.connect(read.outputConnection!);
        return generateCode(workspace as Blockly.WorkspaceSvg);
      })
    );

    // The identity wrapper goes *around* the read, which is what makes the block's value
    // watchable in the Do It / block-values path without changing what it computes.
    expect(probed.result).toContain('__p("');
    expect(probed.result).toContain(', Noodl.Config["apiUrl"])');
    expect(probed.probedIds.size).toBe(2);
  });
});

describe('VFN-012 criterion 2 — deleting the variable must not change the program', () => {
  /**
   * The whole criterion, end to end: author a block against a declared key, delete the key in
   * app settings, reload the saved program.
   */
  function savedThenReloadedWith(saved: Blockly.serialization.blocks.State, remaining: string[]): Blockly.Block {
    declare(...remaining);
    const workspace = new Blockly.Workspace();
    Blockly.serialization.blocks.append(saved, workspace);
    return workspace.getAllBlocks(false)[0];
  }

  const saved = (() => {
    declare('apiUrl', 'maxItems');
    return withWorkspace((workspace) => {
      const block = workspace.newBlock(APP_CONFIG_BLOCK_TYPE);
      block.setFieldValue('maxItems', 'KEY');
      return Blockly.serialization.blocks.save(block) as Blockly.serialization.blocks.State;
    });
  })();

  it('holds the old key after it is deleted from app settings', () => {
    expect(savedThenReloadedWith(saved, ['apiUrl']).getFieldValue('KEY')).toBe('maxItems');
  });

  it('holds the old key even when app settings is emptied entirely', () => {
    expect(savedThenReloadedWith(saved, []).getFieldValue('KEY')).toBe('maxItems');
  });

  it('marks it on the block face, so the builder can see which one is stale', () => {
    const block = savedThenReloadedWith(saved, ['apiUrl']);

    expect(block.getField('KEY')!.getText()).toBe(UNKNOWN_KEY_MARK + 'maxItems');
  });

  it('generates the same code it generated before the deletion', () => {
    declare('apiUrl', 'maxItems');
    const before = programReading('maxItems');

    declare('apiUrl');
    const after = withWorkspace((workspace) => {
      Blockly.serialization.blocks.append(saved, workspace);
      const setOutput = workspace.newBlock('noodl_set_output');
      setOutput.setFieldValue('result', 'NAME');
      setOutput.getInput('VALUE')!.connection!.connect(workspace.getAllBlocks(false)[0].outputConnection!);
      return generateCode(workspace as Blockly.WorkspaceSvg);
    });

    expect(after).toBe(before);
    expect(after).toContain('Noodl.Config["maxItems"]');
  });

  it('🔴 negative control: the stock dropdown really does rewrite the program, and ours does not', () => {
    /**
     * Blockly 12.3.1's own behaviour, built here rather than described. If this ever stops being
     * true, this test goes red and the `ConfigKeyField` subclass can be deleted — which is the
     * only honest way to hold a workaround for someone else's default.
     */
    const STOCK = 'vfn012_stock_dropdown_control';
    let keys = ['apiUrl', 'maxItems'];
    Blockly.Blocks[STOCK] = {
      init: function (this: Blockly.Block) {
        this.appendDummyInput().appendField(
          new Blockly.FieldDropdown(() => keys.map((k) => [k, k]) as Blockly.MenuOption[]),
          'KEY'
        );
        this.setOutput(true, null);
      }
    };

    const stockSaved = withWorkspace((workspace) => {
      const block = workspace.newBlock(STOCK);
      block.setFieldValue('maxItems', 'KEY');
      return Blockly.serialization.blocks.save(block) as Blockly.serialization.blocks.State;
    });

    keys = ['apiUrl'];
    const stockReloaded = withWorkspace((workspace) => {
      Blockly.serialization.blocks.append(stockSaved, workspace);
      return workspace.getAllBlocks(false)[0].getFieldValue('KEY');
    });

    // The defect, reproduced: the author's key silently became somebody else's.
    expect(stockReloaded).toBe('apiUrl');
    expect(stockReloaded).not.toBe('maxItems');

    // Ours, given the identical treatment, does not.
    expect(savedThenReloadedWith(saved, ['apiUrl']).getFieldValue('KEY')).toBe('maxItems');

    delete Blockly.Blocks[STOCK];
  });
});

describe('VFN-012 criterion 5 — the rename is copy, and only copy', () => {
  it('renames the category that was claiming this one’s name', () => {
    expect(DEFAULT_TOOLBOX_LABELS.noodlVariables).toBe('Runtime Variables');
    expect(DEFAULT_TOOLBOX_LABELS.noodlAppConfig).toBe('App Config');
    // Two shelves, two names, neither readable as the other.
    expect(DEFAULT_TOOLBOX_LABELS.noodlVariables).not.toBe(DEFAULT_TOOLBOX_LABELS.noodlAppConfig);
  });

  it('🔴 changes no block type id — every saved project holds these two', () => {
    const toolbox = buildToolbox() as unknown as { contents: { name?: string; contents?: { type: string }[] }[] };
    const runtime = toolbox.contents.find((c) => c.name === DEFAULT_TOOLBOX_LABELS.noodlVariables);

    expect(runtime).toBeTruthy();
    expect(runtime!.contents!.map((b) => b.type)).toEqual(['noodl_get_variable', 'noodl_set_variable']);
    expect(Blockly.Blocks['noodl_get_variable']).toBeTruthy();
    expect(Blockly.Blocks['noodl_set_variable']).toBeTruthy();
  });

  it('sits where it was asked for: beside App Objects and App Arrays', () => {
    const toolbox = buildToolbox() as unknown as { contents: { name?: string; custom?: string }[] };
    const names = toolbox.contents.map((c) => c.name);

    expect(names.indexOf(DEFAULT_TOOLBOX_LABELS.noodlAppConfig)).toBe(
      names.indexOf(DEFAULT_TOOLBOX_LABELS.noodlArrays) + 1
    );
  });

  it('is a dynamic category, because app settings change under an open editor', () => {
    const toolbox = buildToolbox() as unknown as { contents: { name?: string; custom?: string }[] };
    const category = toolbox.contents.find((c) => c.name === DEFAULT_TOOLBOX_LABELS.noodlAppConfig);

    expect(category!.custom).toBe(APP_CONFIG_CATEGORY);
  });
});
