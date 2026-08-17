/**
 * FIX-016, the script-mode mining slice — the two surfaces that were still
 * mining `Inputs.`/`Outputs.` out of a Script node's text.
 *
 * s44 stopped the **diagnostics** pass doing this: a Script node now gets
 * message 6 and nothing else (`portDiagnostics.ts`). It left the other consumers
 * of the same union standing, and they were wrong in the same way and for the
 * same reason.
 *
 * ## The root cause is one predicate answering two questions
 *
 * `modeHasDeclaredPorts` is `true` for `'script'`, and correctly so — a Script
 * node's `scriptInputs`/`scriptOutputs` proplists are real, read by
 * `_managePortsForNode` (`javascript.ts:772-827`) exactly as a Function node's
 * are, and FIX-016's message 6 is gated on it. Three consumers reached for it
 * when the question they were really asking was *"is `Inputs.x` how ports are
 * written here"* — and for a Script node the answers differ. It is compiled
 * `Function('define', 'script', 'Node', 'Component', …)`, mines nothing from its
 * text, and takes its ports from `parser.getPorts()` instead.
 *
 * ## Measured before the fix, in this runner
 *
 * | surface | Script node | what it should be |
 * |---|---|---|
 * | bar, declared ports + a **correct** `define()` body | *"Read price with `Inputs.price`, write total with `Outputs.total = ….`"* | silent — that is working code |
 * | bar, blank node | *"This node has no ports yet. Type `Inputs.` — the name you use becomes an input port."* | silent — typing it creates nothing |
 * | bar, body writes `Outputs.Done()` | **silent**, read as success | silent — but not for that reason |
 * | completion, bare `pri` | offers **`Inputs.price`** | offers nothing |
 * | completion, bare `tot` | offers **`Outputs.total = `** | offers nothing |
 * | completion, after `Inputs.` | offers `price` | offers nothing |
 *
 * 🔴 **The last three are the sharp ones: the editor offered to insert the exact
 * notation message 6 was underlining as throwing, in the same popout.** A
 * completion arrives before a diagnostic and looks like knowledge, so it is the
 * half an author believes.
 *
 * ⚠️ **Every behavioural row here is a PAIR** — the same input through both
 * modes, so a row asserts a *difference between the nodes*. A change that
 * collapsed them back into one mode fails here instead of passing quietly, and a
 * fix that silenced both modes fails on the Function side.
 */
import { CompletionContext } from '@codemirror/autocomplete';
import { javascript } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';

import type { OpenNodeFact } from '@noodl-core-ui/components/code-editor/authoringContext';
import {
  EMPTY_AUTHORING_CONTEXT,
  setCodeAuthoringContext,
  setOpenNodeContext
} from '@noodl-core-ui/components/code-editor/authoringContext';
import { createNoodlCompletionSource } from '@noodl-core-ui/components/code-editor/noodl-completions';
import {
  modeHasDeclaredPorts,
  modeUsesPortNotation
} from '@noodl-core-ui/components/code-editor/utils/declaredPorts';
import { javascriptDiagnostics } from '@noodl-core-ui/components/code-editor/utils/esLintDiagnostics';
import { portBarMessage, portBarState } from '@noodl-core-ui/components/code-editor/utils/portBar';
import type { ValidationType } from '@noodl-core-ui/components/code-editor/utils/types';

/**
 * A Script node carrying a correct `define()` body — ports declared in the
 * proplist, and read the way the node actually reads them.
 */
const DEFINE_BODY = [
  'define({',
  '  inputs: { price: "number" },',
  '  outputs: { total: "number" },',
  '  run: function (inputs, outputs) { outputs.total = inputs.price * 2; }',
  '});'
].join('\n');

/**
 * The declared half is identical for both node types, and that is the point: the
 * two modes are handed the *same* node fact, so any difference below is the mode
 * and nothing else.
 */
function nodeWithPorts(typeName: string): OpenNodeFact {
  return {
    nodeId: 'n1',
    typeName,
    declaredInputs: [{ name: 'price', type: 'number' }],
    declaredOutputs: [{ name: 'total', type: 'number' }]
  };
}

function blankNode(typeName: string): OpenNodeFact {
  return { nodeId: 'n2', typeName, declaredInputs: [], declaredOutputs: [] };
}

const SCRIPT_NODE = () => nodeWithPorts('Javascript2');
const FUNCTION_NODE = () => nodeWithPorts('JavaScriptFunction');

function labelsFor(doc: string, mode: ValidationType): string[] | null {
  const state = EditorState.create({ doc, extensions: [javascript()] });
  const result = createNoodlCompletionSource(mode)(new CompletionContext(state, doc.length, false));
  return result ? result.options.map((option) => option.label) : null;
}

function messages(code: string, validationType: ValidationType) {
  const state = EditorState.create({ doc: code, extensions: [javascript()] });
  return javascriptDiagnostics(state, validationType).map((d) => d.message);
}

beforeEach(() => setCodeAuthoringContext(EMPTY_AUTHORING_CONTEXT));
afterEach(() => setCodeAuthoringContext(null));

/* ------------------------------------------------------------------ *
 * The predicate
 * ------------------------------------------------------------------ */

describe('modeUsesPortNotation', () => {
  it('is true for a Function node — its runtime really does mine its text', () => {
    expect(modeUsesPortNotation('function')).toBe(true);
  });

  it('is false for a Script node', () => {
    expect(modeUsesPortNotation('script')).toBe(false);
  });

  it('is false for every mode that is not code, and for an absent one', () => {
    for (const mode of ['expression', 'json', 'text', 'css', 'html'] as ValidationType[]) {
      expect(modeUsesPortNotation(mode)).toBe(false);
    }
    expect(modeUsesPortNotation(undefined)).toBe(false);
  });

  /*
   * 🔴 The load-bearing row. The tempting fix was to drop `'script'` from
   * `modeHasDeclaredPorts` instead of adding a second predicate — one edit rather
   * than four. It would have been wrong: FIX-016's **message 6 is gated on that
   * predicate** (`portDiagnostics.ts:191`), so dropping it there deletes the one
   * message the ruling asked for. The two questions have different answers for
   * this node and both answers are needed.
   */
  it('does NOT collapse into modeHasDeclaredPorts — a Script node has declared ports and no notation', () => {
    expect(modeHasDeclaredPorts('script')).toBe(true);
    expect(modeUsesPortNotation('script')).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * FUN-006's bar
 * ------------------------------------------------------------------ */

describe('the port bar', () => {
  it('says nothing to a Script node that declared its ports and wrote a correct define()', () => {
    const state = portBarState('script', SCRIPT_NODE(), DEFINE_BODY);

    expect(state.kind).toBe('silent');
    expect(portBarMessage(state)).toBeNull();
  });

  /*
   * The control for the row above, and the reason it means anything: the same
   * node fact and the same document through the Function node still produce the
   * bar. A fix that silenced the bar everywhere passes the row above and fails
   * this one.
   */
  it('control — the same node fact and document still produce the bar for a Function node', () => {
    const state = portBarState('function', FUNCTION_NODE(), DEFINE_BODY);

    expect(state.kind).toBe('unused-ports');
    expect(portBarMessage(state)).toContain('Inputs.price');
  });

  it('does not tell a blank Script node to type `Inputs.` — it mines nothing', () => {
    expect(portBarState('script', blankNode('Javascript2'), '').kind).toBe('silent');
    // Control: the Function node is exactly who that sentence is for.
    expect(portBarMessage(portBarState('function', blankNode('JavaScriptFunction'), ''))).toContain('Inputs.');
  });

  /*
   * 🔴 This row exists because the observable value did NOT change for one input.
   *
   * `Outputs.Done()` in a Script node read `silent` before this fix too — the bar
   * mined the call and took it for a written output, i.e. for success. It is
   * still `silent`, for the opposite reason. A single reading cannot tell those
   * apart, so the assertion is over a **set** of documents: the Script node never
   * leaves `silent` whatever is typed, while the Function node's state varies
   * across the very same set. That is a difference a stale mining path cannot
   * produce.
   */
  it('never leaves `silent` for a Script node, whatever the document says', () => {
    const documents = ['', DEFINE_BODY, 'Outputs.Done();', 'Inputs.price;', 'const x = 1;'];

    const scriptKinds = documents.map((doc) => portBarState('script', SCRIPT_NODE(), doc).kind);
    expect(scriptKinds).toEqual(documents.map(() => 'silent'));

    // The control: the same five documents move the Function node's bar around.
    const functionKinds = new Set(documents.map((doc) => portBarState('function', FUNCTION_NODE(), doc).kind));
    expect(functionKinds.size).toBeGreaterThan(1);
  });

  /*
   * A consequence of the row above that reaches beyond this node.
   * `JavaScriptEditor.tsx` records a "success" on a not-silent → silent
   * transition and retires the bar **per user** after enough of them. Before this
   * fix a Script node could make that transition by having Function notation
   * typed into it — so a node the bar should never have spoken to could retire it
   * for every Function node the author owns. A mode that never leaves `silent`
   * has no transition to record.
   */
  it('gives a Script node no transition that could retire the bar for Function nodes', () => {
    const before = portBarState('script', SCRIPT_NODE(), '').kind;
    const after = portBarState('script', SCRIPT_NODE(), 'Outputs.Done();').kind;

    expect(before).toBe('silent');
    expect(after).toBe('silent');
  });
});

/* ------------------------------------------------------------------ *
 * FUN-008's completions
 * ------------------------------------------------------------------ */

describe('completions', () => {
  it('offers no members after `Inputs.` in a Script node — it is not a binding there', () => {
    setOpenNodeContext(SCRIPT_NODE());
    expect(labelsFor('Inputs.', 'script')).toBeNull();
  });

  it('control — a Function node still completes its input ports after `Inputs.`', () => {
    setOpenNodeContext(FUNCTION_NODE());
    expect(labelsFor('Inputs.', 'function')).toEqual(['price']);
  });

  it('offers no members after `Outputs.` in a Script node', () => {
    setOpenNodeContext(SCRIPT_NODE());
    expect(labelsFor('Outputs.', 'script')).toBeNull();
  });

  it('control — a Function node still completes its output ports after `Outputs.`', () => {
    setOpenNodeContext(FUNCTION_NODE());
    expect(labelsFor('Outputs.', 'function')).toEqual(['total']);
  });

  /*
   * 🔴 The two rows the fix is really for. These offers *insert text*: accepting
   * one wrote `Inputs.price` into a Script node, which is not a port read, is not
   * a binding in scope, and throws when the node runs — the same line message 6
   * warns about.
   */
  it('does not offer to insert `Inputs.price` for a bare prefix in a Script node', () => {
    setOpenNodeContext(SCRIPT_NODE());
    expect(labelsFor('pri', 'script')).toBeNull();
  });

  it('control — a Function node is still offered `Inputs.price` for the same prefix', () => {
    setOpenNodeContext(FUNCTION_NODE());
    expect(labelsFor('pri', 'function')).toContain('Inputs.price');
  });

  it('does not offer to insert `Outputs.total = ` for a bare prefix in a Script node', () => {
    setOpenNodeContext(SCRIPT_NODE());
    expect(labelsFor('tot', 'script')).toBeNull();
  });

  it('control — a Function node is still offered `Outputs.total = ` for the same prefix', () => {
    setOpenNodeContext(FUNCTION_NODE());
    expect(labelsFor('tot', 'function')).toContain('Outputs.total = ');
  });

  /*
   * 🔴 The over-suppression control, and the row most worth having. Everything
   * above asserts an absence, and the cheapest way to pass all of it is to break
   * completion in script mode outright. s44 gave the Script node its own globals
   * (`define`, `Node`, `script`); they must still arrive.
   */
  it('still offers the Script node its OWN API — the suppression is of notation, not of completion', () => {
    setOpenNodeContext(SCRIPT_NODE());
    expect(labelsFor('def', 'script')).toContain('define');
  });

  /*
   * A second mode this fixes, stated rather than left silent. The member branch
   * excluded `'expression'` only, so `'json'` — which still gets the JavaScript
   * completion source (`codemirror-extensions.ts:323-333` excludes only text,
   * CSS and HTML) — reached the port completions too, and was handed whatever
   * node the property panel had last published.
   */
  it('offers no port members in a JSON editor either', () => {
    setOpenNodeContext(FUNCTION_NODE());
    expect(labelsFor('Inputs.', 'json')).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * What must NOT have changed
 * ------------------------------------------------------------------ */

describe('s44’s message 6 is untouched', () => {
  /*
   * The whole fix hangs off not widening `modeHasDeclaredPorts`. This is the row
   * that notices if a later reader "tidies" the two predicates into one: message
   * 6 is gated on the declared-ports predicate, so the tidy-up deletes it.
   */
  it('still fires for Function-node notation in a Script node', () => {
    setOpenNodeContext(SCRIPT_NODE());

    const said = messages('Outputs.Done();', 'script').join(' ');
    expect(said).toContain('Function node');
  });

  it('and the Function node still gets its own port messages for the same document', () => {
    setOpenNodeContext(FUNCTION_NODE());

    expect(messages('Outputs.Done();', 'function').join(' ')).not.toContain('Function node’s API');
  });
});
