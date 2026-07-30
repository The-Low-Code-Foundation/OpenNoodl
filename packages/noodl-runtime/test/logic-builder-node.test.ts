/**
 * Logic Builder: the runtime half of the contract between the generated code and the node.
 *
 * The block editor writes JavaScript into `generatedCode`; this node compiles and runs it.
 * The two sides agree on a calling convention, and every bug this suite pins came from that
 * agreement being wrong or unstated:
 *
 *  - how the generated code reaches `sendSignalOnOutput` (it is a parameter, not a method);
 *  - what happens to an output the program writes but nothing is connected to;
 *  - whether a port named by the blocks becomes a signal port or a value port.
 */

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

import LogicBuilderModule = require('../src/nodes/std-library/logic-builder');

/** Build a Blockly `workspaces.save()` payload from top-level blocks. */
function workspace(...blocks: unknown[]) {
  return JSON.stringify({ blocks: { languageVersion: 0, blocks } });
}

function block(type: string, fields?: Record<string, string>) {
  return { type, ...(fields ? { fields } : {}) };
}

function createNode(opts: { workspace?: string; generatedCode?: string } = {}) {
  const context = new NodeContext();
  context.nodeRegister.register(NodeDefinition.defineNode(LogicBuilderModule.node));

  const node = context.nodeRegister.createNode('Logic Builder', 'lb-1');

  // Order matters: the workspace decides how later ports are registered.
  if (opts.workspace !== undefined) node.setInputValue('workspace', opts.workspace);
  if (opts.generatedCode !== undefined) node.setInputValue('generatedCode', opts.generatedCode);

  return node;
}

describe('Logic Builder execution', () => {
  it('calls sendSignalOnOutput as a bare function, the way the runtime passes it in', () => {
    const node = createNode({
      workspace: workspace(block('noodl_send_signal', { NAME: 'done' })),
      generatedCode: 'sendSignalOnOutput("done");\n'
    });

    node.setInputValue('run', true);

    expect(node.getOutput('error').value).toBe('');
    // The signal port was created on demand by the send itself.
    expect(node.hasOutput('done')).toBe(true);
  });

  it('rejects the `this.`-qualified form — the convention this node compiles against', () => {
    // `new Function(...)` bodies are sloppy-mode and are invoked with no receiver, so `this`
    // is the global object. This is not a style preference: emitting `this.sendSignalOnOutput`
    // is what made every "send signal" block throw, and this test is what stops it coming back.
    const node = createNode({
      workspace: workspace(block('noodl_send_signal', { NAME: 'done' })),
      generatedCode: 'this.sendSignalOnOutput("done");\n'
    });

    node.setInputValue('run', true);

    expect(node.getOutput('error').value).toMatch(/sendSignalOnOutput is not a function/);
  });

  it('writes every output the program sets, connected or not', () => {
    const node = createNode({
      workspace: workspace(block('noodl_set_output', { NAME: 'a' }), block('noodl_set_output', { NAME: 'b' })),
      generatedCode: 'Outputs["a"] = 1;\nOutputs["b"] = 2;\n'
    });

    node.setInputValue('run', true);

    // Flagging an unregistered output used to throw and abort the rest of the loop, so `b`
    // never landed and the run reported a spurious error.
    expect(node.getOutput('error').value).toBe('');
    expect(node.getOutput('a').value).toBe(1);
    expect(node.getOutput('b').value).toBe(2);
  });

  it('clears a previous error once a run succeeds', () => {
    const node = createNode({
      workspace: workspace(block('noodl_set_output', { NAME: 'a' })),
      generatedCode: 'throw new Error("boom");'
    });

    node.setInputValue('run', true);
    expect(node.getOutput('error').value).toBe('boom');

    node.setInputValue('generatedCode', 'Outputs["a"] = 1;\n');
    node.setInputValue('run', false);
    node.setInputValue('run', true);

    expect(node.getOutput('error').value).toBe('');
  });

  it('does nothing, quietly, when there is no program', () => {
    const node = createNode();

    node.setInputValue('run', true);

    expect(node.getOutput('error').value).toBe('');
  });
});

describe('Logic Builder dynamic ports', () => {
  it('registers a workspace-declared signal input as a signal that runs the program', () => {
    const node = createNode({
      workspace: workspace(
        block('noodl_define_signal_input', { NAME: 'start' }),
        block('noodl_set_output', { NAME: 'ran' })
      ),
      generatedCode: 'Outputs["ran"] = true;\n'
    });

    node.registerInputIfNeeded('start');
    expect(node.hasInput('start')).toBe(true);

    // A value input would merely have stored `true`; a signal input runs the program.
    node.setInputValue('start', true);
    expect(node.getOutput('ran').value).toBe(true);
  });

  it('registers everything else as a value input, carrying the declared type', () => {
    const node = createNode({
      workspace: workspace(block('noodl_define_input', { NAME: 'count', TYPE: 'number' })),
      generatedCode: 'Outputs["doubled"] = Inputs["count"] * 2;\n'
    });

    node.registerInputIfNeeded('count');
    expect(node.getInput('count').type).toBe('number');

    node.setInputValue('count', 21);
    // Setting a value must not run anything on its own.
    expect(node.hasOutput('doubled')).toBe(false);

    node.setInputValue('run', true);
    expect(node.getOutput('doubled').value).toBe(42);
  });

  it('registers a workspace-declared signal output as a signal port', () => {
    const node = createNode({
      workspace: workspace(block('noodl_define_signal_output', { NAME: 'finished' }))
    });

    node.registerOutputIfNeeded('finished');
    expect(node.hasOutput('finished')).toBe(true);
  });

  it('still accepts a port the workspace does not mention', () => {
    // A connection made before the blocks were written must not be dropped on the floor.
    const node = createNode({ workspace: workspace() });

    node.registerInputIfNeeded('legacy');
    expect(node.hasInput('legacy')).toBe(true);
  });
});
