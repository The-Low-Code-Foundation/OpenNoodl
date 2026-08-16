/**
 * FIX-016 ruling 1 — *"a Script node has always been strict AF, keep it that
 * way … and the node should teach."*
 *
 * The Script node and the Function node are compiled with **different
 * parameters**, and the editor treated them as one mode:
 *
 * | node | compiled as |
 * |---|---|
 * | Function (`JavaScriptFunction`) | `AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', …)` |
 * | Script (`Javascript2`) | `Function('define', 'script', 'Node', 'Component', …)` |
 *
 * Measured before this fix, in this runner:
 *
 * - `define({ … })` — the notation `NOTATION_RULES.script` **tells** the author
 *   to write — produced *"No port named define. Create an input port by reading
 *   it: `Inputs.define`"*, with a fix-it inserting notation the Script node does
 *   not have.
 * - `Outputs.Done()` in a Script node produced **nothing at all**, which is the
 *   silence the ruling is about.
 *
 * ⚠️ **Every row here is paired.** The same document is linted in both modes, so
 * a row asserts a *difference between the nodes* rather than a fact about one of
 * them — and a change that collapsed the two modes back into one would fail here
 * rather than pass quietly.
 */
import { javascript } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';

import {
  setCodeAuthoringContext,
  setOpenNodeContext,
  EMPTY_AUTHORING_CONTEXT
} from '@noodl-core-ui/components/code-editor/authoringContext';
import { globalsFor } from '@noodl-core-ui/components/code-editor/noodl-api-surface';
import { javascriptDiagnostics } from '@noodl-core-ui/components/code-editor/utils/esLintDiagnostics';
import type { ValidationType } from '@noodl-core-ui/components/code-editor/utils/types';

/** A Script node's popout: `'script'` mode with a node under it. */
function openScriptNode(outputs: { name: string; type: string }[] = []) {
  setOpenNodeContext({
    nodeId: 'n1',
    typeName: 'Javascript2',
    declaredInputs: [],
    declaredOutputs: outputs
  });
}

function openFunctionNode(outputs: { name: string; type: string }[] = []) {
  setOpenNodeContext({
    nodeId: 'n1',
    typeName: 'JavaScriptFunction',
    declaredInputs: [],
    declaredOutputs: outputs
  });
}

function lint(code: string, validationType: ValidationType) {
  const state = EditorState.create({ doc: code, extensions: [javascript()] });
  return javascriptDiagnostics(state, validationType);
}

function messages(code: string, validationType: ValidationType) {
  return lint(code, validationType).map((d) => d.message);
}

const DEFINE_BODY = "define({ inputs: { A: 'string' }, outputs: { B: 'string' }, run: function (inputs, outputs) {} });";

beforeEach(() => {
  setCodeAuthoringContext(EMPTY_AUTHORING_CONTEXT);
  setOpenNodeContext(null);
});

afterEach(() => {
  setOpenNodeContext(null);
});

describe('the Script node’s own API is no longer reported as a mistake', () => {
  it('says nothing about define() in a Script node', () => {
    openScriptNode();
    expect(messages(DEFINE_BODY, 'script')).toEqual([]);
  });

  it('still reports define() in a Function node, where it really is not in scope', () => {
    // 🔴 The control, and the reason the globals are per-mode rather than a union.
    // A Function body is compiled without `define`, so this line throws there —
    // making both halves of the split observable in one pair.
    openFunctionNode();
    const reported = messages(DEFINE_BODY, 'function');

    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain('define');
  });

  it('says nothing about script(), the second-generation form', () => {
    openScriptNode();
    expect(messages("script({ inputs: { A: 'string' } });", 'script')).toEqual([]);
  });

  it('says nothing about the Node declaration API', () => {
    openScriptNode();
    expect(messages('Node.Signals.Go = function () { Node.Outputs.Done(); };', 'script')).toEqual([]);
  });
});

describe('message 6 — the Function node’s API written in a Script node', () => {
  it('names what is not in scope and what to write instead', () => {
    openScriptNode();
    const reported = messages('Outputs.Done();', 'script');

    expect(reported).toHaveLength(1);
    expect(reported[0]).toBe(
      "Outputs is the Function node's API and is not in scope here, so this line throws when it runs. " +
        'A Script node declares its ports: define({ inputs: { … }, outputs: { … }, ' +
        'run: function (inputs, outputs) { … } }).'
    );
  });

  it('is silent on the identical document in a Function node', () => {
    // The pair. `Outputs.Done()` is how a Function node fires a signal — correct
    // code, and correctly unremarked. Without this row, message 6 could be
    // firing on both nodes and every assertion above would still pass.
    openFunctionNode();
    expect(messages('Outputs.Done();', 'function')).toEqual([]);
  });

  it('reports Inputs too, with the same sentence', () => {
    openScriptNode();
    const reported = messages('const v = Inputs.Value;', 'script');

    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain("Inputs is the Function node's API");
  });

  it('carries no fix-it', () => {
    // Unlike messages 1-4 and like message 5: the repair is a different program,
    // not a different spelling. Half of it inserted would still throw.
    openScriptNode();
    const [diagnostic] = lint('Outputs.Done();', 'script');

    expect(diagnostic.actions ?? []).toHaveLength(0);
    expect(diagnostic.source).toBe('nodegx:ports');
    expect(diagnostic.severity).toBe('warning');
  });

  it('does NOT offer to create a port called Outputs', () => {
    // The message this replaces. Message 3 would have said "No port named
    // Outputs. Create an input port by reading it: Inputs.Outputs." — an offer to
    // write more of the notation that does not work here.
    openScriptNode();
    const [diagnostic] = lint('Outputs.Done();', 'script');

    expect(diagnostic.message).not.toContain('Inputs.Outputs');
    expect(diagnostic.message).not.toContain('No port named');
  });
});

describe('the Function node’s port messages do not speak in a Script node', () => {
  it('does not offer Inputs. notation for an unknown name', () => {
    // Message 3 in a Function node offers to create a port by reading it. A
    // Script node mines nothing out of its text, so the offer would be false.
    openScriptNode();
    const reported = messages('const v = someUnknownName;', 'script');

    expect(reported).toHaveLength(1);
    expect(reported[0]).not.toContain('Inputs.');
    // ⚠️ ESLint's own sentence still arrives: a genuine unknown name is still a
    // problem, and dropping the *enrichment* must not drop the report.
    expect(reported[0]).toContain('someUnknownName');
  });

  it('offers exactly that in a Function node — the pair', () => {
    openFunctionNode();
    expect(messages('const v = someUnknownName;', 'function')[0]).toBe(
      'No port named someUnknownName. Create an input port by reading it: Inputs.someUnknownName.'
    );
  });

  it('does not tell a Script node author to set a Type to Signal', () => {
    // Message 5's advice is about the panel's Type row, which the Script node
    // does have — but the line it fires on throws for a different reason
    // entirely, and two warnings on one call disagreeing about the cause is
    // worse than one that is right.
    openScriptNode([{ name: 'Done', type: 'string' }]);
    const reported = messages('Outputs.Done();', 'script');

    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain("Outputs is the Function node's API");
  });

  it('does tell a Function node author exactly that — the pair', () => {
    openFunctionNode([{ name: 'Done', type: 'string' }]);
    expect(messages('Outputs.Done();', 'function')[0]).toContain('Set its Type to Signal');
  });
});

describe('a code file is not a Script node', () => {
  it('leaves a kit’s .js file with plain ESLint, no port advice', () => {
    // `CodeFileDocument` opens `noodl_modules/<kit>/index.js` in `'script'` mode
    // with **no** open node. `Outputs` is not in scope there either, but "declare
    // ports with define({…})" is advice about a node this file is not.
    setOpenNodeContext(null);
    const reported = messages('Outputs.Done();', 'script');

    expect(reported).toHaveLength(1);
    expect(reported[0]).not.toContain('define(');
    // ⚠️ Pinned to ESLint's own sentence rather than merely "mentions Outputs":
    // message 3 would also mention it, while offering to create a port called
    // `Outputs`. Naming the sentence is what tells those two apart.
    expect(reported[0]).toContain('is not defined');
  });
});

describe('completions offer the API the node actually has', () => {
  it('offers define to a Script node and not Inputs/Outputs', () => {
    const labels = globalsFor('script').map((member) => member.label);

    expect(labels).toContain('define');
    expect(labels).toContain('Node');
    expect(labels).not.toContain('Inputs');
    expect(labels).not.toContain('Outputs');
  });

  it('offers Inputs/Outputs to a Function node and not define — the pair', () => {
    const labels = globalsFor('function').map((member) => member.label);

    expect(labels).toContain('Inputs');
    expect(labels).toContain('Outputs');
    expect(labels).not.toContain('define');
  });

  it('leaves expression mode alone', () => {
    const labels = globalsFor('expression').map((member) => member.label);

    expect(labels).not.toContain('define');
    expect(labels).not.toContain('Inputs');
  });
});
