import type { EditorConnectionLike, GraphModelLike, GraphNodeModel } from '@noodl/types';

/**
 * The three port names Run Tasks matches by string, and what each one is for.
 *
 * Kept beside the check rather than inline so the message an author reads and the behaviour
 * they are reading about cannot drift: `Do` is pulsed at `startTask`, `Success`/`Failure` are
 * matched in `itemOutputSignalTriggered`.
 */
const TEMPLATE_CONTRACT = {
  input: {
    name: 'Do',
    purpose: 'Run Tasks pulses it to start each task'
  },
  outputs: [
    { name: 'Success', purpose: 'a task reports that it finished' },
    { name: 'Failure', purpose: 'a task reports that it failed' }
  ]
} as const;

const TEMPLATE_WARNING_KEY = 'run-tasks-template';

/**
 * NDA-009 §1 — check the template contract when the template is chosen, not when the run hangs.
 *
 * The node drives its template entirely by string match and there is no wire on the canvas to
 * show it, so a template whose completion signal is called `Done` produces a run that sits in
 * `running` for ever. `startTask` gained a runtime backstop for the fatal case under NDA-004,
 * but a backstop fires when the author presses the button; this fires when they pick the
 * template, which is the moment they can still fix it cheaply.
 *
 * **Graded rather than uniform, because the three ports are not equally fatal.** Read
 * `startTask` and `itemOutputSignalTriggered` and the ranks fall out: no `Do` and no task ever
 * starts; neither `Success` nor `Failure` and no task can ever complete; *one* of the two
 * missing is a template that works, and reporting it as breakage would be the "a Failure port
 * on a node that cannot fail" mistake this phase keeps naming — a task component that genuinely
 * cannot fail is a legitimate shape. So the missing counterpart is stated as a consequence
 * ("a failing task has no way to report it") rather than as an error.
 */
export function checkTemplateContract(
  editorConnection: EditorConnectionLike,
  node: GraphNodeModel,
  graphModel: GraphModelLike
) {
  const clear = () => editorConnection.clearWarning(node.component.name, node.id, TEMPLATE_WARNING_KEY);

  const templateName = node.parameters['taskTemplate'] as string | undefined;

  // No template is already covered, at run time, by `run`'s own "No task template specified."
  // Duplicating it here would put two warnings on one node for one mistake.
  if (!templateName) return clear();

  const component = graphModel.components[templateName];

  // A template naming a component that does not exist: `createNode` will throw and
  // `startTask` reports `run-tasks/task-start-failed`, but only once the author runs it.
  if (!component) {
    return editorConnection.sendWarning(node.component.name, node.id, TEMPLATE_WARNING_KEY, {
      message: 'The task template "' + templateName + '" does not exist. Pick a component that does.'
    });
  }

  const problems: string[] = [];

  if (!component.inputPorts[TEMPLATE_CONTRACT.input.name]) {
    problems.push(
      'no "' +
        TEMPLATE_CONTRACT.input.name +
        '" signal input (' +
        TEMPLATE_CONTRACT.input.purpose +
        '), so no task will ever start'
    );
  }

  const missingOutputs = TEMPLATE_CONTRACT.outputs.filter((port) => !component.outputPorts[port.name]);

  if (missingOutputs.length === TEMPLATE_CONTRACT.outputs.length) {
    problems.push('neither a "Success" nor a "Failure" signal output, so no task can ever report completion');
  } else if (missingOutputs.length === 1) {
    const missing = missingOutputs[0];
    problems.push('no "' + missing.name + '" signal output, so ' + missing.purpose + ' has no way to be reported');
  }

  if (problems.length === 0) return clear();

  editorConnection.sendWarning(node.component.name, node.id, TEMPLATE_WARNING_KEY, {
    message:
      'The task template "' +
      templateName +
      '" does not match what Run Tasks expects: ' +
      problems.join('; ') +
      '. Run Tasks matches these port names exactly — there is no connection between this node and the template.'
  });
}
