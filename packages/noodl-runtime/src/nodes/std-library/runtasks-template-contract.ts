import type { EditorConnectionLike, GraphModelLike, GraphNodeModel } from '@noodl/types';

/**
 * The four port names Run Tasks matches by string, what each one is for, and which node
 * parameter overrides it.
 *
 * Kept beside the check rather than inline so the message an author reads and the behaviour
 * they are reading about cannot drift: the start input is pulsed at `startTask`, the success
 * and failure outputs are matched in `itemOutputSignalTriggered`, and the error output is read
 * there to say *why* a task failed.
 *
 * **§2 made these configurable rather than literal, and this table is the single definition
 * of the contract** — `runtasks.ts` resolves through {@link resolveTemplateContract} and the
 * editor-time check reads the same table, so a default cannot be changed in one and not the
 * other.
 */
export const TEMPLATE_CONTRACT = {
  start: {
    parameter: 'taskStartInput',
    default: 'Do',
    plug: 'input',
    purpose: 'Run Tasks pulses it to start each task'
  },
  success: {
    parameter: 'taskSuccessOutput',
    default: 'Success',
    plug: 'output',
    purpose: 'a task reports that it finished'
  },
  failure: {
    parameter: 'taskFailureOutput',
    default: 'Failure',
    plug: 'output',
    purpose: 'a task reports that it failed'
  },
  /**
   * Optional, and deliberately never warned about.
   *
   * The completion signals are bare signals, so a template that fails has no way to say why —
   * which is the whole of §3's problem. If the template happens to carry an output under this
   * name, its value is attached to the per-task failure report. A template that cannot explain
   * itself is a legitimate shape, so its absence is not a contract violation and must not
   * produce a warning; it simply means the report carries identity without a reason.
   */
  error: {
    parameter: 'taskErrorOutput',
    default: 'Error',
    plug: 'output',
    purpose: 'a failing task explains itself'
  }
} as const;

export interface ResolvedTemplateContract {
  start: string;
  success: string;
  failure: string;
  error: string;
}

/**
 * Resolve the four configured names, falling back to the defaults.
 *
 * **An empty name falls back rather than being honoured.** These ports are `allowEditOnly`, so
 * the only writer is an author editing the field, and the two ways to leave it blank are
 * clearing the text (empty string) and deleting the parameter (`undefined`, which queues the
 * port's default anyway). Neither can mean "match a port with no name" — there is no such
 * port — so both mean "the default". This is the one place in this phase where treating an
 * absent value as an abstention is right, and it is right *because* the port has a meaningful
 * default; contrast the Empty-Value Contract's records, where the absent value named a target
 * the author had just removed.
 */
export function resolveTemplateContract(read: (parameter: string) => unknown): ResolvedTemplateContract {
  const pick = (spec: { parameter: string; default: string }) => {
    const value = read(spec.parameter);
    return typeof value === 'string' && value.length > 0 ? value : spec.default;
  };

  return {
    start: pick(TEMPLATE_CONTRACT.start),
    success: pick(TEMPLATE_CONTRACT.success),
    failure: pick(TEMPLATE_CONTRACT.failure),
    error: pick(TEMPLATE_CONTRACT.error)
  };
}

const TEMPLATE_WARNING_KEY = 'run-tasks-template';

/** How many port names a "the template offers …" list may carry before it stops being readable. */
const MAX_ALTERNATIVES = 12;

function nameList(ports: Record<string, unknown> | undefined): string {
  const names = Object.keys(ports || {});
  if (names.length === 0) return 'none';
  const shown = names.slice(0, MAX_ALTERNATIVES).map((name) => '"' + name + '"');
  return shown.join(', ') + (names.length > shown.length ? ', …' : '');
}

/**
 * NDA-009 §1 — check the template contract when the template is chosen, not when the run hangs.
 * NDA-009 §2 — and check the *configured* names, listing what the template actually offers.
 *
 * The node drives its template entirely by string match and there is no wire on the canvas to
 * show it, so a template whose completion signal is called `Done` produces a run that sits in
 * `running` for ever. `startTask` gained a runtime backstop for the fatal case under NDA-004,
 * but a backstop fires when the author presses the button; this fires when they pick the
 * template, which is the moment they can still fix it cheaply.
 *
 * **Graded rather than uniform, because the three required ports are not equally fatal.** Read
 * `startTask` and `itemOutputSignalTriggered` and the ranks fall out: no start input and no task
 * ever starts; neither completion output and no task can ever complete; *one* of the two missing
 * is a template that works, and reporting it as breakage would be the "a Failure port on a node
 * that cannot fail" mistake this phase keeps naming — a task component that genuinely cannot
 * fail is a legitimate shape. So the missing counterpart is stated as a consequence ("a failing
 * task has no way to report it") rather than as an error.
 *
 * **The port list is §2's affordance.** The spec asked for three enum inputs populated from the
 * template's ports. Making them enums would mean `sendDynamicPorts`, which flips Run Tasks to a
 * dynamic-port node — and `nonexistentPort` then *skips* every Run Tasks connection rather than
 * checking it, which is the opposite of §2's own criterion 4. The names are therefore static
 * string ports, and the "pick from what exists" affordance is delivered here, in the message,
 * where it also covers the case a dropdown could not: the author who renamed the port on the
 * template rather than on this node.
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

  const contract = resolveTemplateContract((parameter) => node.parameters[parameter]);
  const problems: string[] = [];

  if (!component.inputPorts[contract.start]) {
    problems.push(
      'no "' +
        contract.start +
        '" signal input (' +
        TEMPLATE_CONTRACT.start.purpose +
        '), so no task will ever start — it has ' +
        nameList(component.inputPorts)
    );
  }

  const missingOutputs = ([TEMPLATE_CONTRACT.success, TEMPLATE_CONTRACT.failure] as const)
    .map((spec) => ({ spec, name: spec === TEMPLATE_CONTRACT.success ? contract.success : contract.failure }))
    .filter((port) => !component.outputPorts[port.name]);

  if (missingOutputs.length === 2) {
    problems.push(
      'neither a "' +
        contract.success +
        '" nor a "' +
        contract.failure +
        '" signal output, so no task can ever report completion — it has ' +
        nameList(component.outputPorts)
    );
  } else if (missingOutputs.length === 1) {
    const missing = missingOutputs[0];
    problems.push(
      'no "' + missing.name + '" signal output, so ' + missing.spec.purpose + ' has no way to be reported'
    );
  }

  if (problems.length === 0) return clear();

  editorConnection.sendWarning(node.component.name, node.id, TEMPLATE_WARNING_KEY, {
    message:
      'The task template "' +
      templateName +
      '" does not match what Run Tasks expects: ' +
      problems.join('; ') +
      '. Run Tasks matches these port names exactly — there is no connection between this node ' +
      'and the template. Rename the port, or set the matching name on this node.'
  });
}
