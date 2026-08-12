/**
 * FUN-004 — the diagnostic that names the port.
 *
 * The originating user typed `var Output_1 = Input_1` against a node with both
 * ports declared, and was told *"'Input_1' is not defined"*. True, generic, and
 * about the wrong subject: `Input_1` is a port they made ninety seconds earlier.
 *
 * These specs pin the four messages, the fix-its, and the two places the task
 * says it will go wrong:
 *
 * - **§3, the expression gate.** The same text is linted in `'function'` and in
 *   `'expression'`, and the difference is asserted. A suggestion of `Inputs.total`
 *   inside an Expression node mints a port called `Inputs`; this is the spec that
 *   stops it.
 * - **Message 2's two forms.** `var Output_1 = …` inside a helper is a genuine
 *   local and legal; `Output_1 = …` with no declaration is an implicit global and
 *   the same defect at any depth. One rule for both gets one of them wrong.
 */
import { javascript } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';

import {
  setCodeAuthoringContext,
  setOpenNodeContext,
  EMPTY_AUTHORING_CONTEXT
} from '@noodl-core-ui/components/code-editor/authoringContext';
import { javascriptDiagnostics } from '@noodl-core-ui/components/code-editor/utils/esLintDiagnostics';
import type { ValidationType } from '@noodl-core-ui/components/code-editor/utils/types';

function openNode(inputs: string[], outputs: { name: string; type: string }[] = []) {
  setOpenNodeContext({
    nodeId: 'n1',
    typeName: 'JavaScriptFunction',
    declaredInputs: inputs.map((name) => ({ name, type: 'string' })),
    declaredOutputs: outputs
  });
}

function lint(code: string, validationType: ValidationType = 'function') {
  const state = EditorState.create({ doc: code, extensions: [javascript()] });
  return javascriptDiagnostics(state, validationType);
}

/** The messages this module owns, i.e. not the plain ESLint ones. */
function portMessages(code: string, validationType: ValidationType = 'function') {
  return lint(code, validationType)
    .filter((d) => d.source === 'nodegx:ports')
    .map((d) => d.message);
}

beforeEach(() => {
  setCodeAuthoringContext(EMPTY_AUTHORING_CONTEXT);
  setOpenNodeContext(null);
});

afterEach(() => {
  setOpenNodeContext(null);
});

describe('message 1 — an undefined name that is an input port', () => {
  it('names the port instead of the JavaScript fact', () => {
    openNode(['Input_1']);
    const [message] = portMessages('return Input_1;');

    expect(message).toBe('Input_1 is an input port on this node. Read it with Inputs.Input_1.');
  });

  it('matches the runtime’s wording for the same mistake (FUN-007 §3, F32)', () => {
    // `functionDiagnostics.ts#undeclaredPortNameMessage` produces this sentence
    // when the *run* throws instead of when the linter reads. Static and runtime
    // paths converge on one sentence; the two copies cannot be shared and are a
    // review obligation, so this row is where the drift would be caught.
    openNode(['Input_1']);
    expect(portMessages('return Input_1;')[0]).toBe(
      'Input_1' + ' is an input port on this node. Read it with ' + 'Inputs.Input_1' + '.'
    );
  });

  it('offers a fix-it that replaces exactly the identifier', () => {
    openNode(['Input_1']);
    const diagnostic = lint('return Input_1;').find((d) => d.source === 'nodegx:ports');

    expect(diagnostic.actions).toHaveLength(1);
    expect(diagnostic.actions[0].name).toBe('Replace with Inputs.Input_1');
    expect(diagnostic.from).toBe(7);
    expect(diagnostic.to).toBe(14);
  });

  it('knows a port mined from the code, not only a declared one', () => {
    // `Inputs.Value` on line 1 makes `Value` a port; the bare `Value` on line 2
    // is then the same mistake as the declared case.
    const messages = portMessages('const a = Inputs.Value;\nreturn Value;');
    expect(messages[0]).toBe('Value is an input port on this node. Read it with Inputs.Value.');
  });

  it('uses bracket notation for a name the dot form would not mine', () => {
    openNode(['My Value']);
    // A bare `My Value` is not one identifier, so this is reached through the
    // declared-but-unread message instead — which must still quote correctly.
    // ⚠️ The body has to mine *something*, or FUN-006's bar owns this state
    // instead — see the §3 handover block below.
    expect(portMessages('return Inputs.Other;')[0]).toContain('Inputs["My Value"]');
  });
});

describe('message 2 — a local or implicit global under an output’s name', () => {
  it('reports the declaration form, which lints clean today', () => {
    openNode([], [{ name: 'Output_1', type: 'string' }]);
    const messages = portMessages('var Output_1 = 1;');

    expect(messages).toEqual([
      'Output_1 is an output port. This writes a local variable instead, so the port stays empty. Write Outputs.Output_1 = ….'
    ]);
  });

  it('reports the implicit-global form', () => {
    openNode([], [{ name: 'Output_1', type: 'string' }]);
    expect(portMessages('Output_1 = 1;')[0]).toContain('the port stays empty');
  });

  it('is a warning, never an error', () => {
    openNode([], [{ name: 'Output_1', type: 'string' }]);
    const diagnostic = lint('var Output_1 = 1;').find((d) => d.source === 'nodegx:ports');
    expect(diagnostic.severity).toBe('warning');
  });

  it('leaves a genuine local inside a helper function alone', () => {
    // The acceptance's own case. A `var` in a nested scope is a real local and a
    // legitimate program; warning about it would be wrong.
    openNode([], [{ name: 'Output_1', type: 'string' }]);
    expect(portMessages('function helper() { var Output_1 = 3; return Output_1; }')).toEqual([]);
  });

  it('still reports an undeclared assignment inside a helper function', () => {
    // Not the same bug as the line above: with no `var`, this lands on an
    // implicit global at any depth and the port still never moves.
    openNode([], [{ name: 'Output_1', type: 'string' }]);
    expect(portMessages('function helper() { Output_1 = 3; }')[0]).toContain('the port stays empty');
  });

  it('does not fire on a correct write to the port', () => {
    openNode([], [{ name: 'Output_1', type: 'string' }]);
    expect(portMessages('Outputs.Output_1 = 1;')).toEqual([]);
  });

  it('does not fire on a read of the same name on the right-hand side', () => {
    openNode([], [{ name: 'Output_1', type: 'string' }]);
    // `x = Output_1` is a read, not a write to a shadowing local.
    const messages = portMessages('Outputs.Output_1 = 1;\nvar x = Output_1;');
    expect(messages.filter((m) => m.includes('stays empty'))).toEqual([]);
  });

  it('writes a signal output as a call, not an assignment', () => {
    openNode([], [{ name: 'Done', type: 'signal' }]);
    expect(portMessages('var Done = 1;')[0]).toContain('Outputs.Done()');
  });

  it('swallows the declaration keyword in the fix, so the result parses', () => {
    openNode([], [{ name: 'Output_1', type: 'string' }]);
    const diagnostic = lint('var Output_1 = 1;').find((d) => d.source === 'nodegx:ports');

    // `var Outputs.Output_1 = 1` is a syntax error — a fix-it that breaks the
    // document is worse than no fix-it.
    expect(diagnostic.actions[0]).toBeDefined();
    expect(diagnostic.from).toBe(4);
  });
});

describe('message 3 — an undefined name that is no port at all', () => {
  it('offers to create the port by reading it', () => {
    expect(portMessages('return total * 2;')[0]).toBe(
      'No port named total. Create an input port by reading it: Inputs.total.'
    );
  });

  it('declines a single-character name, which is more likely a typo', () => {
    // "a fix-it that turns a misspelled local into a phantom input port is a
    // worse outcome than the warning."
    expect(portMessages('return q;')).toEqual([]);
  });

  it('declines a name that is one edit from something in scope', () => {
    // The task's warning, made operational. `totl` beside `total` is a slip, and
    // offering to create the port `totl` would mint a real port for it — on a
    // click the user was invited to make. This was found by an existing
    // `esLintDiagnostics` spec going red, not by writing it down first.
    expect(portMessages('const total = 1;\nOutputs.x = totl;')).toEqual([]);
  });

  it('declines a name that is one edit from a port', () => {
    openNode(['Value']);
    expect(portMessages('return Valu;').filter((m) => m.includes('Create an input port'))).toEqual([]);
  });

  it('still offers a name that merely resembles a distant one', () => {
    // The threshold is one edit, not two: at two, `sum` and `num` are typos of
    // each other and a legitimate new port stops being offerable.
    expect(portMessages('const sum = 1;\nOutputs.x = quantity;')[0]).toContain('Create an input port');
  });

  it('leaves the plain no-undef message in place when it declines', () => {
    const all = lint('return q;');
    expect(all.some((d) => d.source === 'eslint:no-undef')).toBe(true);
  });

  it('does not offer to create a port for a name that is already an output', () => {
    // Reading an output is not a thing you do, and `Inputs.Output_1` would create
    // a second port with a confusing name.
    openNode([], [{ name: 'Output_1', type: 'string' }]);
    const messages = portMessages('return Output_1;');
    expect(messages.filter((m) => m.includes('Create an input port'))).toEqual([]);
  });
});

describe('message 4 — a declared port the code never reads', () => {
  it('reports it once, as information, anchored at the top', () => {
    openNode(['Input_1']);
    const diagnostic = lint('return Inputs.Other;').find((d) => d.message.includes('never read'));

    expect(diagnostic.severity).toBe('info');
    expect(diagnostic.from).toBe(0);
    expect(diagnostic.to).toBe(0);
    expect(diagnostic.message).toBe('Input_1 is declared on this node but never read. Insert Inputs.Input_1.');
  });

  it('goes away once the port is read', () => {
    openNode(['Input_1']);
    expect(portMessages('return Inputs.Input_1;')).toEqual([]);
  });

  it('names several ports in one line rather than one line each', () => {
    openNode(['A_1', 'B_1']);
    const messages = portMessages('return Inputs.Other;');
    expect(messages).toContain(
      'A_1, B_1 are declared on this node but never read. Insert Inputs.A_1 to use the first.'
    );
  });

  it('says nothing when no node is open', () => {
    expect(portMessages('return 1;')).toEqual([]);
  });

  it('stands down entirely on a document that mines no port at all (FUN-006 §3)', () => {
    // The deliberate split, from this side. A blank page is FUN-006's bar —
    // "you have not started" is a document-level statement of fact, and two
    // components narrating it in different words is how a help surface stops
    // being believed. This message owns "you started and this specific port got
    // left behind", which needs the author to have started.
    openNode(['Input_1']);
    expect(portMessages('')).toEqual([]);
    expect(portMessages('return 1;')).toEqual([]);
    expect(portMessages('return Inputs.Other;').some((m) => m.includes('never read'))).toBe(true);
  });

  it('is not confused by a port that is mined but not declared', () => {
    // Mined-only ports are read by definition — the mention is the read.
    expect(portMessages('return Inputs.Value;')).toEqual([]);
  });

  it('does not flag Noodl.Inputs.foo as unread (F15)', () => {
    // F15, measured: the mining patterns have no left boundary, so
    // `Noodl.Inputs.foo` mines `foo` exactly as `Inputs.foo` does. Legacy code is
    // therefore never falsely accused — and, per §4, never flagged at all.
    openNode(['foo']);
    expect(portMessages('return Noodl.Inputs.foo;')).toEqual([]);
  });
});

describe('§3 — none of it may reach expression mode', () => {
  // The destructive case, and the reason this task was blocked until FUN-009.
  // Every row lints identical text in both modes and asserts the difference.

  it('offers no port for an undefined name in an expression', () => {
    // ⚠️ This row does **not** test the gate, and saying so is the point.
    // Deleting `modeHasDeclaredPorts` from `portsFor` leaves it green, because a
    // second mechanism already protects this case: `no-undef` is off in
    // expression mode, so there is no diagnostic for messages 1 and 3 to enrich.
    // Defence in depth is worth having and worth pinning — but the three rows
    // below are the ones that go red when the gate goes, and message 2 and
    // message 4 have no second mechanism behind them at all.
    expect(portMessages('total * 2', 'function').length).toBeGreaterThan(0);
    expect(portMessages('total * 2', 'expression')).toEqual([]);
  });

  it('does not report a declared-but-unread port in an expression', () => {
    openNode(['Input_1']);
    expect(portMessages('Inputs.Other + 1', 'function').length).toBeGreaterThan(0);
    expect(portMessages('Inputs.Other + 1', 'expression')).toEqual([]);
  });

  it('does not report an output shadow in an expression', () => {
    openNode([], [{ name: 'Output_1', type: 'string' }]);
    expect(portMessages('Output_1 = 1', 'function').length).toBeGreaterThan(0);
    expect(portMessages('Output_1 = 1', 'expression')).toEqual([]);
  });

  it('never puts the string `Inputs.` in front of an expression author', () => {
    // The single most destructive thing this module could do: `Inputs.total` in
    // an expression mints a port literally named `Inputs`.
    openNode(['Input_1']);
    const everything = lint('total * Input_1', 'expression')
      .map((d) => d.message + JSON.stringify(d.actions ?? []))
      .join(' ');

    expect(everything).not.toContain('Inputs.');
    expect(everything).not.toContain('Outputs.');
  });

  it('is silent in the non-JavaScript modes too', () => {
    openNode(['Input_1']);
    for (const mode of ['json', 'text', 'css', 'html'] as ValidationType[]) {
      expect(portMessages('return 1;', mode)).toEqual([]);
    }
  });
});

describe('the whole originating bug', () => {
  it('produces two actionable messages for `var Output_1 = Input_1`', () => {
    // The acceptance's first criterion, at the unit boundary. The live half —
    // applying both and confirming a value arrives at the output — is the drive.
    openNode(['Input_1'], [{ name: 'Output_1', type: 'string' }]);
    const messages = portMessages('var Output_1 = Input_1;');

    expect(messages).toHaveLength(2);
    expect(messages.some((m) => m.includes('is an input port on this node'))).toBe(true);
    expect(messages.some((m) => m.includes('so the port stays empty'))).toBe(true);
  });

  it('every message it produces carries a fix-it', () => {
    openNode(['Input_1'], [{ name: 'Output_1', type: 'string' }]);
    const ours = lint('var Output_1 = Input_1;').filter((d) => d.source === 'nodegx:ports');

    expect(ours.length).toBeGreaterThan(0);
    for (const diagnostic of ours) {
      expect(diagnostic.actions?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('says nothing about the corrected code', () => {
    openNode(['Input_1'], [{ name: 'Output_1', type: 'string' }]);
    expect(portMessages('Outputs.Output_1 = Inputs.Input_1;')).toEqual([]);
  });
});
