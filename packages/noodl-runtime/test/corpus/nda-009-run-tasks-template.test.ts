/**
 * NDA-009 §1 — the task-template contract, checked when the template is picked.
 *
 * Run Tasks drives its template by string match and there is no wire on the canvas to show it,
 * so a template whose completion signal is called `Done` produces a run that sits in `running`
 * for ever. NDA-004 §1 added a runtime backstop (corpus F1, `nda-001-failure-reporting`), but a
 * backstop fires when the author presses the button. §1 is the earlier half: report it at
 * *selection* time, while the author is still looking at the thing they got wrong.
 *
 * Two layers are pinned separately, because this phase's own lesson is that testing a helper is
 * not testing that anything calls it:
 *
 *  - **I-rows** drive `checkTemplateContract` directly — what is reported, and what is not.
 *  - **J-rows** drive the module's real `setup` against a fake graph model, so the wiring — the
 *    `editorImportComplete` gate, `nodeAdded.RunTasks`, `parameterUpdated`, and the *template's*
 *    own port events — is pinned rather than assumed. `graph-harness` cannot serve here: it
 *    never calls a node module's `setup` and says so in its own comment.
 */

/* eslint-env jest */

import { checkTemplateContract } from '../../src/nodes/std-library/runtasks-template-contract';

import RunTasksNodeModule = require('../../src/nodes/std-library/runtasks');

type Listener = (data?: unknown) => void;

/** The smallest emitter with the two methods these models are used through. */
function emitter() {
  const listeners: Record<string, Listener[]> = {};
  return {
    listeners,
    on(name: string, callback: Listener) {
      (listeners[name] || (listeners[name] = [])).push(callback);
    },
    emit(name: string, data?: unknown) {
      for (const callback of listeners[name] || []) callback(data);
    }
  };
}

function aComponent(name: string, inputs: string[], outputs: string[]) {
  const base = emitter();
  return Object.assign(base, {
    name,
    inputPorts: Object.fromEntries(inputs.map((port) => [port, { name: port }])),
    outputPorts: Object.fromEntries(outputs.map((port) => [port, { name: port }]))
  });
}

function aRunTasksNode(template: string | undefined) {
  const base = emitter();
  return Object.assign(base, {
    id: 'runner',
    type: 'RunTasks',
    component: { name: '/root' },
    parameters: { taskTemplate: template } as Record<string, unknown>
  });
}

function aConnection() {
  const warnings: Array<{ nodeId: string; key: string; message: string }> = [];
  return {
    warnings,
    isRunningLocally: () => true,
    sendWarning(_component: string, nodeId: string, key: string, warning: { message: string }) {
      // The real `EditorConnection` de-duplicates by (nodeId, key) through `ActiveWarnings`;
      // replacing rather than appending is what makes "the current warning" a single readable
      // value here, and it matches what an author sees on the node.
      const existing = warnings.findIndex((w) => w.nodeId === nodeId && w.key === key);
      const entry = { nodeId, key, message: warning.message };
      if (existing === -1) warnings.push(entry);
      else warnings[existing] = entry;
    },
    clearWarning(_component: string, nodeId: string, key: string) {
      const index = warnings.findIndex((w) => w.nodeId === nodeId && w.key === key);
      if (index !== -1) warnings.splice(index, 1);
    }
  };
}

const KEY = 'run-tasks-template';

const currentWarning = (connection: ReturnType<typeof aConnection>) =>
  connection.warnings.find((w) => w.key === KEY);

describe('NDA-009 §1: the template contract, at selection time', () => {
  function check(template: string | undefined, component?: ReturnType<typeof aComponent>) {
    const connection = aConnection();
    const node = aRunTasksNode(template);
    const graphModel = { components: component ? { [component.name]: component } : {} };

    checkTemplateContract(connection as never, node as never, graphModel as never);

    return { connection, warning: currentWarning(connection) };
  }

  test('I1: a template with no Do input is reported, and the message says no task will start', () => {
    const { warning } = check('/Task', aComponent('/Task', [], ['Success', 'Failure']));

    expect(warning).toBeDefined();
    expect(warning!.message).toContain('"Do"');
    expect(warning!.message).toContain('no task will ever start');
  });

  test('I2: a template with neither Success nor Failure is reported as unable to complete', () => {
    const { warning } = check('/Task', aComponent('/Task', ['Do'], ['Done']));

    expect(warning).toBeDefined();
    expect(warning!.message).toContain('neither a "Success" nor a "Failure"');
    expect(warning!.message).toContain('report completion');
  });

  /**
   * The grading, and the reason for it. A template with `Success` and no `Failure` *works* —
   * `itemOutputSignalTriggered` completes on either — and a task component that genuinely
   * cannot fail is a legitimate shape. Reporting it as breakage would be the "a Failure port on
   * a node that cannot fail" mistake this phase keeps naming, one level up. So it is stated as
   * a consequence, and the two fatal phrases must not appear.
   */
  test('I3: one missing output is stated as a consequence, not as breakage', () => {
    const { warning } = check('/Task', aComponent('/Task', ['Do'], ['Success']));

    expect(warning).toBeDefined();
    expect(warning!.message).toContain('"Failure"');
    expect(warning!.message).toContain('has no way to be reported');
    expect(warning!.message).not.toContain('no task will ever start');
    expect(warning!.message).not.toContain('report completion');
  });

  test('I4: a template naming a component that does not exist is reported', () => {
    const { warning } = check('/Missing');

    expect(warning).toBeDefined();
    expect(warning!.message).toContain('does not exist');
  });

  /**
   * `run` already reports "No task template specified." at run time. Two warnings on one node
   * for one mistake is worse than one, so this stays silent deliberately — and the row is what
   * stops a later tidy-up from "completing the set".
   */
  test('I5: no template at all is left to the existing run-time warning', () => {
    const { warning } = check(undefined);

    expect(warning).toBeUndefined();
  });

  test('I6 (control): a template that satisfies the contract produces no warning', () => {
    const { warning } = check('/Task', aComponent('/Task', ['Do'], ['Success', 'Failure']));

    expect(warning).toBeUndefined();
  });

  test('I7: a warning clears when the template is corrected', () => {
    const connection = aConnection();
    const node = aRunTasksNode('/Task');
    const component = aComponent('/Task', ['Do'], ['Done']);
    const graphModel = { components: { '/Task': component } };

    checkTemplateContract(connection as never, node as never, graphModel as never);
    expect(currentWarning(connection)).toBeDefined();

    component.outputPorts['Success'] = { name: 'Success' };
    component.outputPorts['Failure'] = { name: 'Failure' };
    checkTemplateContract(connection as never, node as never, graphModel as never);

    expect(currentWarning(connection)).toBeUndefined();
  });
});

describe('NDA-009 §1: the setup wiring that calls it', () => {
  function install(nodes: Array<ReturnType<typeof aRunTasksNode>>, components: Record<string, unknown>) {
    const connection = aConnection();
    const base = emitter();
    const graphModel = Object.assign(base, {
      components,
      getNodesWithType: (type: string) => (type === 'RunTasks' ? nodes : [])
    });

    (RunTasksNodeModule as unknown as { setup(context: unknown, graphModel: unknown): void }).setup(
      { editorConnection: connection },
      graphModel
    );

    return { connection, graphModel };
  }

  test('J1: existing Run Tasks nodes are checked once the import completes', () => {
    const node = aRunTasksNode('/Task');
    const { connection, graphModel } = install([node], { '/Task': aComponent('/Task', ['Do'], ['Done']) });

    // Nothing before the gate: at `nodeAdded` time the template may not be imported yet, and
    // checking then reports every template as missing.
    expect(currentWarning(connection)).toBeUndefined();

    graphModel.emit('editorImportComplete');

    expect(currentWarning(connection)).toBeDefined();
  });

  test('J2: a node added later is checked too', () => {
    const { connection, graphModel } = install([], { '/Task': aComponent('/Task', ['Do'], ['Done']) });
    graphModel.emit('editorImportComplete');

    graphModel.emit('nodeAdded.RunTasks', aRunTasksNode('/Task'));

    expect(currentWarning(connection)).toBeDefined();
  });

  test('J3: changing the template re-checks against the new one', () => {
    const node = aRunTasksNode('/Good');
    const { connection, graphModel } = install([node], {
      '/Good': aComponent('/Good', ['Do'], ['Success', 'Failure']),
      '/Bad': aComponent('/Bad', ['Do'], ['Done'])
    });
    graphModel.emit('editorImportComplete');
    expect(currentWarning(connection)).toBeUndefined();

    node.parameters.taskTemplate = '/Bad';
    node.emit('parameterUpdated', { name: 'taskTemplate' });

    expect(currentWarning(connection)).toBeDefined();
  });

  /**
   * The insidious half of the defect, and the one a selection-time check would miss on its own:
   * the author is editing the *template*, not the Run Tasks node, so nothing draws their
   * attention to the node they have just broken.
   */
  test('J4: renaming the template’s Success output re-checks the node that depends on it', () => {
    const template = aComponent('/Task', ['Do'], ['Success', 'Failure']);
    const { connection, graphModel } = install([aRunTasksNode('/Task')], { '/Task': template });
    graphModel.emit('editorImportComplete');
    expect(currentWarning(connection)).toBeUndefined();

    delete template.outputPorts['Success'];
    delete template.outputPorts['Failure'];
    template.emit('outputPortRemoved');

    expect(currentWarning(connection)).toBeDefined();
    expect(currentWarning(connection)!.message).toContain('neither a "Success" nor a "Failure"');
  });

  test('J5 (control): setup does nothing at all without an editor watching', () => {
    const node = aRunTasksNode('/Task');
    const base = emitter();
    const graphModel = Object.assign(base, {
      components: { '/Task': aComponent('/Task', [], []) },
      getNodesWithType: () => [node]
    });

    // A deployed app has an `editorConnection` object but `isRunningLocally()` is false —
    // asserting on the absence of an object would pass for the wrong reason (see the
    // criterion-2 work: the connection is always constructed).
    const connection = { ...aConnection(), isRunningLocally: () => false };
    (RunTasksNodeModule as unknown as { setup(context: unknown, graphModel: unknown): void }).setup(
      { editorConnection: connection },
      graphModel
    );
    graphModel.emit('editorImportComplete');

    expect(connection.warnings).toEqual([]);
    // And it did not register listeners it would then never use.
    expect(Object.keys(graphModel.listeners)).toEqual([]);
  });
});
