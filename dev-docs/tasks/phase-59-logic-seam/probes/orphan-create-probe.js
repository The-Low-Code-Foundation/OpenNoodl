/**
 * The path a user hits FIRST: drag a fresh block out of the toolbox.
 * disableOrphans keys on isBlockCreate too, so a newly created top-level statement
 * block should arrive already disabled.
 */
const R = '/Users/richardosborne/vscode_projects/OpenNoodl/node_modules/';
const Blockly = require(R + 'blockly');
const { javascriptGenerator } = require(R + 'blockly/javascript');

Blockly.Blocks['noodl_define_input'] = {
  init() {
    this.appendDummyInput().appendField('Define input');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
  }
};
javascriptGenerator.forBlock['noodl_define_input'] = () => '/* define */\n';

const workspace = new Blockly.Workspace();
workspace.isDragging = () => false; // WorkspaceSvg-only; gates the mid-drag case only

// Listener attached first, exactly as it is for the whole life of an open tab
// after the initial load has completed.
workspace.addChangeListener(Blockly.Events.disableOrphans);

async function main() {
  const block = workspace.newBlock('noodl_define_input', 'newblock000000000001');
  block.initSvg = undefined;
  Blockly.Events.fire(new Blockly.Events.BlockCreate(block));

  await new Promise((r) => setTimeout(r, 50));

  console.log('freshly created top-level block:', block.isEnabled() ? 'ENABLED' : 'DISABLED');
  console.log('code:', JSON.stringify(javascriptGenerator.workspaceToCode(workspace)));
  console.log(
    'serialised:',
    JSON.stringify(Blockly.serialization.workspaces.save(workspace))
  );
}
main();
