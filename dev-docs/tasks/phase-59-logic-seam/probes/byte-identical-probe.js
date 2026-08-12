/**
 * LGC-002 §2 / LGC-004 #13: is the serialised `workspace` byte-identical after an
 * open/close with NO user gesture?
 *
 * BlocklyWorkspace.tsx registers disableOrphans AFTER the load, explicitly so the
 * deserialisation BLOCK_CREATE storm does not run it. This isolates that claim:
 * load -> attach -> (nothing) -> save, and compare bytes.
 */
const R = '/Users/richardosborne/vscode_projects/OpenNoodl/node_modules/';
const Blockly = require(R + 'blockly');

for (const [t, prev] of [['noodl_define_input', true], ['noodl_set_output', true]]) {
  Blockly.Blocks[t] = {
    init() {
      this.appendDummyInput().appendField(t);
      this.setPreviousStatement(prev, null);
      this.setNextStatement(true, null);
    }
  };
}

const original = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'noodl_define_input',
        id: 'aaaaaaaaaaaaaaaaaaa1',
        x: 20,
        y: 20,
        next: { block: { type: 'noodl_set_output', id: 'aaaaaaaaaaaaaaaaaaa2' } }
      }
    ]
  }
};
const before = JSON.stringify(original);

async function main() {
  const workspace = new Blockly.Workspace();
  workspace.isDragging = () => false;

  // BlocklyWorkspace.tsx wraps the load in Events.disable()/enable() so deserialisation
  // fires no BLOCK_CREATE. Replicating that exactly — without it the probe lies.
  try {
    Blockly.Events.disable();
    Blockly.serialization.workspaces.load(original, workspace);
  } finally {
    Blockly.Events.enable();
  }
  // exactly BlocklyWorkspace.tsx's ordering: listener attached after the load
  workspace.addChangeListener(Blockly.Events.disableOrphans);

  // let any queued deserialisation events drain, touching nothing
  await new Promise((r) => setTimeout(r, 100));

  const after = JSON.stringify(Blockly.serialization.workspaces.save(workspace));
  console.log('before:', before);
  console.log('after: ', after);
  console.log('\nbyte-identical with NO gesture:', before === after ? 'YES ✅' : 'NO ❌');
  console.log('carries disabledReasons:', /disabledReasons/.test(after));
}
main();
