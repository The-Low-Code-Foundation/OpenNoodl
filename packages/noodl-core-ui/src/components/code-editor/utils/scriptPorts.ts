/**
 * The ports a Function or Script node has, read out of the code you are looking
 * at.
 *
 * FH-019 slice 2, criterion 1 — "`Inputs.` lists this component's actual
 * inputs; renaming a port changes what completes."
 *
 * ## Why this needs no project context at all
 *
 * The task assumed these names had to be threaded in from the node model. They
 * don't, and the reason is worth stating because it is what makes this feature
 * small: **a Function node's ports come from its script text.**
 * `JavascriptNodeParser.parseAndAddPortsFromScript`
 * (`noodl-runtime/src/javascriptnodeparser.js:293-387`) mines the source for
 * `Inputs.x` / `Inputs["x"]` / `Outputs.y` / `Outputs["y"]` and pushes a port
 * per unique name; `simplejavascript.ts:568` is the Function node calling it.
 * The document in the editor *is* the port list.
 *
 * So "renaming a port changes what completes" holds for the strongest possible
 * reason: renaming it in the code is what renaming the port means. There is no
 * second source of truth to drift from — and none of this has to reach the
 * property panel, which is what let slice 2 ship without touching any of the
 * four call sites.
 *
 * The six patterns below are copied from that function deliberately, in the
 * same order and with the same character classes, including the asymmetry
 * (inputs allow `_`, output signals do not, bracket-notation outputs accept
 * only double quotes). Matching the runtime exactly is the point: a completion
 * this offers is a port that will exist, and a name it declines is one that
 * would silently not become a port.
 *
 * @module code-editor/utils
 */

/** Names mined from a script, in first-appearance order. */
export interface ScriptPorts {
  /** Every `Inputs.x` / `Inputs["x"]` in the document. */
  inputs: string[];
  /** Every `Outputs.y` / `Outputs["y"]` in the document. */
  outputs: string[];
  /**
   * The subset of `outputs` written as a call — `Outputs.Done()`. The runtime
   * types these `signal` rather than `*`, so the completion can say so.
   */
  signals: Set<string>;
}

/** `javascriptnodeparser.js:333` — regular `Inputs.` notation. */
const INPUT_DOT = /Inputs\.([A-Za-z0-9_]+)/g;
/** `:343` — `Inputs['A']` / `Inputs["A"]`. */
const INPUT_BRACKET = /Inputs\s*\[\s*(?:'|")(.*)(?:'|")\s*\]/g;
/** `:354` — output signals, `Outputs.Done()`. Note: no `_` in the class. */
const OUTPUT_SIGNAL_DOT = /Outputs\.([A-Za-z0-9]+)\s*\(\s*\)/g;
/** `:363` — output signals, `Outputs["Done"]()`. */
const OUTPUT_SIGNAL_BRACKET = /Outputs\s*\[\s*(?:'|")(.*)(?:'|")\s*\]\(\s*\)/g;
/** `:372` — regular `Outputs.` notation. */
const OUTPUT_DOT = /Outputs\.([A-Za-z0-9_]+)/g;
/** `:381` — `Outputs["A"]`. Double quotes only, exactly as upstream. */
const OUTPUT_BRACKET = /Outputs\s*\[\s*"([^"]*)"\s*\]/g;

/** Push every capture-group-1 match into `into`, ignoring repeats and blanks. */
function collect(source: string, pattern: RegExp, into: string[]): void {
  // A fresh RegExp per call: `lastIndex` on a shared /g literal makes the
  // second document a different answer from the first.
  const scan = new RegExp(pattern.source, pattern.flags);
  let match: RegExpExecArray | null;

  while ((match = scan.exec(source)) !== null) {
    const name = match[1];
    if (!name) continue;
    if (into.indexOf(name) === -1) into.push(name);

    // `Outputs[""]` matches at zero width against an empty capture; without
    // this the loop never advances past it.
    if (match[0].length === 0) scan.lastIndex++;
  }
}

/**
 * Mine a script for the ports it declares by using them.
 *
 * Text-only, like the runtime's own parser: a name inside a string or a comment
 * is mined here exactly as the runtime mines it, and therefore exactly as it
 * becomes a port. Being *more* correct than the runtime would mean offering a
 * different set than the node actually grows.
 */
export function minePorts(code: string): ScriptPorts {
  const inputs: string[] = [];
  const outputs: string[] = [];
  const signals = new Set<string>();

  if (!code) return { inputs, outputs, signals };

  collect(code, INPUT_DOT, inputs);
  collect(code, INPUT_BRACKET, inputs);

  const signalNames: string[] = [];
  collect(code, OUTPUT_SIGNAL_DOT, signalNames);
  collect(code, OUTPUT_SIGNAL_BRACKET, signalNames);
  for (const name of signalNames) {
    signals.add(name);
    if (outputs.indexOf(name) === -1) outputs.push(name);
  }

  collect(code, OUTPUT_DOT, outputs);
  collect(code, OUTPUT_BRACKET, outputs);

  return { inputs, outputs, signals };
}
