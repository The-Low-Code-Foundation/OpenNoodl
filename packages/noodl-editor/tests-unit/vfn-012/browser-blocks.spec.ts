/**
 * VFN-012 §2/§3 — the two blocks, in real headless Blockly, with the real generator.
 *
 * Real Blockly for `app-config-block.spec.ts`'s reason, which is not a figure of speech here
 * either: the failure mode this suite exists to prevent is one **Blockly commits by default**.
 *
 * > A stock `FieldDropdown` handed a value that is not in its option list logs *"Cannot set the
 * > dropdown's value to an unavailable option"* and then **replaces it with the first option**.
 *
 * §1 met that when a config variable was deleted. §2 meets it in a worse place: the library list
 * is read off disk *asynchronously*, so it is empty for the first tick of **every session**. A
 * stock dropdown would therefore not merely mis-handle a deleted library — it would rewrite every
 * library block in every program at the moment the editor opened. `stock dropdown` below builds
 * exactly that field beside ours and watches it happen; it is the negative control for the whole
 * design, and if Blockly ever stops doing it, that test — not ours — goes red.
 */
import * as Blockly from 'blockly';

import {
  refreshRegisteredLibraries,
  registeredLibrariesSnapshot,
  resetRegisteredLibraries,
  setRegisteredLibrariesLoader,
  BROWSER_CATEGORY,
  BROWSER_HUE,
  LIBRARY_GLOBAL_BLOCK_TYPE,
  LOADING_LIBRARIES_OPTION,
  UNKNOWN_GLOBAL_MARK
} from '../../src/editor/src/views/BlocklyEditor/appLibraries';
import { buildToolbox, DEFAULT_TOOLBOX_LABELS } from '../../src/editor/src/views/BlocklyEditor/BlocklyToolbox';
import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';
import { generateCode, initNoodlGenerators } from '../../src/editor/src/views/BlocklyEditor/NoodlGenerators';
import { WINDOW_BLOCK_TYPE } from '../../src/editor/src/views/BlocklyEditor/windowAccess';

initNoodlBlocks();
initNoodlGenerators();

function withWorkspace<T>(body: (workspace: Blockly.Workspace) => T): T {
  const workspace = new Blockly.Workspace();
  try {
    return body(workspace);
  } finally {
    workspace.dispose();
  }
}

/** Put the module in the `loaded` state with exactly these globals, and wait for it. */
async function registerGlobals(...globals: string[]): Promise<void> {
  setRegisteredLibrariesLoader(async () =>
    globals.map((global) => ({
      moduleName: global.toLowerCase(),
      displayName: global,
      global,
      dependencies: [],
      stylesheets: [],
      runtimes: ['browser'],
      vendored: true
    }))
  );
  await refreshRegisteredLibraries();
}

/** One reader wired into a `set output`, generated exactly as `flushSave` would. */
function programReading(type: string, field: string, value: string): string {
  return withWorkspace((workspace) => {
    const setOutput = workspace.newBlock('noodl_set_output');
    setOutput.setFieldValue('result', 'NAME');
    const read = workspace.newBlock(type);
    read.setFieldValue(value, field);
    setOutput.getInput('VALUE')!.connection!.connect(read.outputConnection!);

    return generateCode(workspace as Blockly.WorkspaceSvg);
  });
}

afterEach(() => {
  resetRegisteredLibraries();
});

describe('VFN-012 §2 — the library block', () => {
  it('is a value block with no inputs, and there is no setter beside it', async () => {
    await registerGlobals('PocketBase');

    withWorkspace((workspace) => {
      const block = workspace.newBlock(LIBRARY_GLOBAL_BLOCK_TYPE);
      expect(block.outputConnection).toBeTruthy();
      expect(block.previousConnection).toBeNull();
      expect(block.nextConnection).toBeNull();
      expect(block.getColour()).toBe(Blockly.utils.colour.hueToHex(Number(BROWSER_HUE)));
    });

    // A library is read, never assigned — assigning `window.X` from a visual function would be a
    // way to break a page with no way to see it had happened.
    expect(Blockly.Blocks['noodl_set_library_global']).toBeUndefined();
  });

  it('opens on the first registered library, so a dragged block reads something real', async () => {
    await registerGlobals('PocketBase', 'tinymce');
    withWorkspace((workspace) => {
      expect(workspace.newBlock(LIBRARY_GLOBAL_BLOCK_TYPE).getFieldValue('GLOBAL')).toBe('PocketBase');
    });
  });

  it('builds at all when nothing has been read yet — the empty option list would throw', () => {
    resetRegisteredLibraries();
    expect(registeredLibrariesSnapshot()).toEqual({ status: 'unknown' });

    withWorkspace((workspace) => {
      const block = workspace.newBlock(LIBRARY_GLOBAL_BLOCK_TYPE);
      expect(block.getFieldValue('GLOBAL')).toBe('');
      expect(block.getField('GLOBAL')!.getText()).toBe(LOADING_LIBRARIES_OPTION);
    });
  });

  it('generates `window.<global>` into a real program', async () => {
    await registerGlobals('PocketBase');
    expect(programReading(LIBRARY_GLOBAL_BLOCK_TYPE, 'GLOBAL', 'PocketBase')).toContain(
      'Outputs["result"] = window.PocketBase;'
    );
  });
});

describe('VFN-012 §2 — 🔴 the field that does not rewrite the program', () => {
  const STOCK = 'vfn012_stock_library_dropdown';

  /**
   * The control. Same situation, stock field: a block saved on `PocketBase`, then serialised and
   * reloaded while the module is in its **`unknown`** state — which is not a contrived scenario,
   * it is the first tick of every editor session, before the disk read returns.
   */
  it('stock dropdown: reloading before the scan lands rewrites the saved global', async () => {
    await registerGlobals('PocketBase', 'tinymce');

    Blockly.Blocks[STOCK] = {
      init: function () {
        this.appendDummyInput().appendField(
          new Blockly.FieldDropdown(() => {
            const snapshot = registeredLibrariesSnapshot();
            const libraries = snapshot.status === 'loaded' ? snapshot.libraries : [];
            const options = libraries.map((library) => [library.global, library.global] as [string, string]);
            return options.length > 0 ? options : [['(none)', '']];
          }),
          'GLOBAL'
        );
        this.setOutput(true, null);
      }
    };

    const saved = withWorkspace((workspace) => {
      const block = workspace.newBlock(STOCK);
      block.setFieldValue('PocketBase', 'GLOBAL');
      return Blockly.serialization.blocks.save(block) as Blockly.serialization.blocks.State;
    });

    // The project reopens; the scan has not returned yet.
    resetRegisteredLibraries();

    const reloaded = withWorkspace((workspace) => {
      Blockly.serialization.blocks.append(saved, workspace);
      return workspace.getAllBlocks(false)[0].getFieldValue('GLOBAL');
    });

    // The defect, reproduced: the author's library silently became the placeholder.
    expect(reloaded).not.toBe('PocketBase');
    expect(reloaded).toBe('');

    delete Blockly.Blocks[STOCK];
  });

  it('ours survives the identical treatment', async () => {
    await registerGlobals('PocketBase', 'tinymce');

    const saved = withWorkspace((workspace) => {
      const block = workspace.newBlock(LIBRARY_GLOBAL_BLOCK_TYPE);
      block.setFieldValue('PocketBase', 'GLOBAL');
      return Blockly.serialization.blocks.save(block) as Blockly.serialization.blocks.State;
    });

    resetRegisteredLibraries();

    const reloaded = withWorkspace((workspace) => {
      Blockly.serialization.blocks.append(saved, workspace);
      return workspace.getAllBlocks(false)[0];
    });
    expect(reloaded).toBeTruthy();

    withWorkspace((workspace) => {
      Blockly.serialization.blocks.append(saved, workspace);
      const block = workspace.getAllBlocks(false)[0];

      expect(block.getFieldValue('GLOBAL')).toBe('PocketBase');
      // 🔴 And it is not accused of being deleted while nothing has been read.
      expect(block.getField('GLOBAL')!.getText()).toBe('PocketBase');
    });
  });

  it('🔴 marks it once a completed scan says the library is gone', async () => {
    await registerGlobals('PocketBase');

    const saved = withWorkspace((workspace) => {
      const block = workspace.newBlock(LIBRARY_GLOBAL_BLOCK_TYPE);
      block.setFieldValue('PocketBase', 'GLOBAL');
      return Blockly.serialization.blocks.save(block) as Blockly.serialization.blocks.State;
    });

    await registerGlobals('tinymce');

    withWorkspace((workspace) => {
      Blockly.serialization.blocks.append(saved, workspace);
      const block = workspace.getAllBlocks(false)[0];

      expect(block.getFieldValue('GLOBAL')).toBe('PocketBase');
      expect(block.getField('GLOBAL')!.getText()).toBe(UNKNOWN_GLOBAL_MARK + 'PocketBase');
    });
  });

  it('🔴 generates the same code it generated before the library was removed', async () => {
    await registerGlobals('PocketBase');
    const before = programReading(LIBRARY_GLOBAL_BLOCK_TYPE, 'GLOBAL', 'PocketBase');

    await registerGlobals('tinymce');
    expect(programReading(LIBRARY_GLOBAL_BLOCK_TYPE, 'GLOBAL', 'PocketBase')).toBe(before);

    resetRegisteredLibraries();
    expect(programReading(LIBRARY_GLOBAL_BLOCK_TYPE, 'GLOBAL', 'PocketBase')).toBe(before);
  });
});

describe('VFN-012 §3 — the window block', () => {
  it('is a value block with a free text field, not a picker', () => {
    withWorkspace((workspace) => {
      const block = workspace.newBlock(WINDOW_BLOCK_TYPE);
      expect(block.outputConnection).toBeTruthy();
      expect(block.previousConnection).toBeNull();
      expect(block.getField('PATH')).toBeInstanceOf(Blockly.FieldTextInput);
      expect(block.getField('PATH')).not.toBeInstanceOf(Blockly.FieldDropdown);
      expect(block.getFieldValue('PATH')).toBe('location.href');
    });
  });

  it('generates the path it was given, into a real program', () => {
    expect(programReading(WINDOW_BLOCK_TYPE, 'PATH', 'navigator.userAgent')).toContain(
      'Outputs["result"] = window["navigator"]["userAgent"];'
    );
  });

  it('generates a bare `window` when the field is emptied', () => {
    expect(programReading(WINDOW_BLOCK_TYPE, 'PATH', '')).toContain('Outputs["result"] = window;');
  });

  it('🔴 a path is a member access, so it never picks up parentheses it did not ask for', () => {
    // `Order.MEMBER`, like the four neighbouring readers. The negative control is the *value* of
    // the order: had this been `Order.NONE`, the generator would wrap it.
    const code = withWorkspace((workspace) => {
      const length = workspace.newBlock('noodl_array_length');
      const win = workspace.newBlock(WINDOW_BLOCK_TYPE);
      win.setFieldValue('history', 'PATH');
      length.getInput('ARRAY')!.connection!.connect(win.outputConnection!);

      const setOutput = workspace.newBlock('noodl_set_output');
      setOutput.setFieldValue('n', 'NAME');
      setOutput.getInput('VALUE')!.connection!.connect(length.outputConnection!);

      return generateCode(workspace as Blockly.WorkspaceSvg);
    });

    expect(code).toContain('window["history"].length');
    expect(code).not.toContain('(window["history"]).length');
  });

  it('there is no `set window` block — assigning a browser global from here is not on offer', () => {
    expect(Blockly.Blocks['noodl_set_window']).toBeUndefined();
  });
});

describe('VFN-012 §2/§3 — the toolbox', () => {
  const toolbox = () =>
    buildToolbox() as unknown as { contents: { name?: string; custom?: string; colour?: string }[] };

  it('adds one dynamic category, directly below App Config', () => {
    const names = toolbox().contents.map((c) => c.name);
    expect(names.indexOf(DEFAULT_TOOLBOX_LABELS.noodlLibraries)).toBe(
      names.indexOf(DEFAULT_TOOLBOX_LABELS.noodlAppConfig) + 1
    );
  });

  it('is `custom`, because its contents are read off disk and are unknown for a tick', () => {
    const category = toolbox().contents.find((c) => c.name === DEFAULT_TOOLBOX_LABELS.noodlLibraries);
    expect(category).toBeTruthy();
    expect(category!.custom).toBe(BROWSER_CATEGORY);
    expect(category!.colour).toBe(BROWSER_HUE);
  });

  it('🔴 changes no existing block type id — the seam categories are byte-identical otherwise', () => {
    const contents = (buildToolbox() as unknown as { contents: { name?: string; contents?: { type: string }[] }[] })
      .contents;
    const typesIn = (name: string) => contents.find((c) => c.name === name)?.contents?.map((b) => b.type);

    expect(typesIn(DEFAULT_TOOLBOX_LABELS.noodlVariables)).toEqual(['noodl_get_variable', 'noodl_set_variable']);
    expect(typesIn(DEFAULT_TOOLBOX_LABELS.noodlObjects)).toEqual([
      'noodl_get_object',
      'noodl_get_object_property',
      'noodl_set_object_property'
    ]);
    expect(typesIn(DEFAULT_TOOLBOX_LABELS.noodlArrays)).toEqual([
      'noodl_get_array',
      'noodl_array_length',
      'noodl_array_add'
    ]);
  });

  it('takes a hue no other category is using', () => {
    const colours = toolbox().contents.map((c) => c.colour).filter(Boolean);
    expect(colours.filter((c) => c === BROWSER_HUE).length).toBe(1);
  });

  it('the two new block type ids are the ones every saved project will hold', () => {
    expect(LIBRARY_GLOBAL_BLOCK_TYPE).toBe('noodl_library_global');
    expect(WINDOW_BLOCK_TYPE).toBe('noodl_window');
    expect(Blockly.Blocks[LIBRARY_GLOBAL_BLOCK_TYPE]).toBeTruthy();
    expect(Blockly.Blocks[WINDOW_BLOCK_TYPE]).toBeTruthy();
  });
});
