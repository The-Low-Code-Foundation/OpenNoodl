/**
 * LGC-003 §2 probe: does `Blockly.Events.disableOrphans` disable a whole Noodl program?
 *
 * Every Noodl statement block declares setPreviousStatement(true) and there is no hat block
 * in NoodlBlocks.ts, so a Noodl program is a free-floating top-level statement stack.
 * disableOrphans disables any parentless block that has a previousConnection, plus its
 * entire next-chain. This asks Blockly itself, headless, instead of reading minified source.
 */
const Blockly = require('/Users/richardosborne/vscode_projects/OpenNoodl/node_modules/blockly');
const { javascriptGenerator } = require('/Users/richardosborne/vscode_projects/OpenNoodl/node_modules/blockly/javascript');

// Minimal stand-ins with the SAME connection shape as the real blocks.
Blockly.Blocks['noodl_define_input'] = {
  init() {
    this.appendDummyInput().appendField('Define input');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
  }
};
Blockly.Blocks['noodl_set_output'] = {
  init() {
    this.appendValueInput('VALUE').setCheck(null).appendField('set output');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
  }
};
javascriptGenerator.forBlock['noodl_define_input'] = () => '/* define */\n';
javascriptGenerator.forBlock['noodl_set_output'] = (b, g) =>
  'Outputs.total = ' + (g.valueToCode(b, 'VALUE', 0) || '0') + ';\n';

const workspace = new Blockly.Workspace();
// WorkspaceSvg-only method; disableOrphans uses it solely to skip the mid-drag case.
workspace.isDragging = () => false;

const program = {
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

Blockly.serialization.workspaces.load(program, workspace);

const ids = ['aaaaaaaaaaaaaaaaaaa1', 'aaaaaaaaaaaaaaaaaaa2'];
const state = (label) => {
  const bits = ids.map((id) => {
    const b = workspace.getBlockById(id);
    return `${b.type}=${b.isEnabled() ? 'ENABLED' : 'DISABLED'}`;
  });
  console.log(`${label.padEnd(34)} ${bits.join('  ')}`);
};

async function main() {
console.log('--- code generation and enabled state ---');
state('after load (no listener yet)');
console.log('code after load:', JSON.stringify(javascriptGenerator.workspaceToCode(workspace)));

// Exactly what BlocklyWorkspace.tsx:232 does, after the load.
workspace.addChangeListener(Blockly.Events.disableOrphans);

// The cheapest thing a user can do that emits a MOVE: nudge the top block.
const top = workspace.getBlockById('aaaaaaaaaaaaaaaaaaa1');
const move = new Blockly.Events.BlockMove(top);
move.oldCoordinate = new Blockly.utils.Coordinate(20, 20);
top.moveBy(10, 0);
move.recordNew();
Blockly.Events.fire(move);

await new Promise((r) => setTimeout(r, 50)); // Blockly fires events on a timeout
state('after ONE move of the top block');
const codeAfter = javascriptGenerator.workspaceToCode(workspace);
console.log('code after move:  ', JSON.stringify(codeAfter));

const saved = Blockly.serialization.workspaces.save(workspace);
const json = JSON.stringify(saved);
console.log('serialised carries disabled state:', /disabled/i.test(json));
console.log('serialised:', json);

console.log('\n--- verdict ---');
console.log('program still generates code:', codeAfter.trim().length > 0 ? 'YES' : 'NO — program is dead');
}
main();
