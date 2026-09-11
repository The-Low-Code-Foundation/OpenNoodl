/**
 * FUN-007 — what the Function node is able to say after a run.
 *
 * Three jobs, deliberately in one module because two of them must agree on a sentence:
 *
 * 1. **The notation, built once.** `Inputs.name` / `Outputs.name`, bracketed when the port's
 *    label is not a JavaScript identifier, and a *call* rather than an assignment when the
 *    port is a signal. Phase 61's standing constraint: never concatenate a dot, never emit
 *    the `Noodl.Inputs` legacy alias, and never let two surfaces phrase one mistake
 *    differently.
 * 2. **The run-time line number**, mapped back to the document the author is looking at.
 * 3. **"the script ran and nothing came out"**, which is the silence FUN-007 exists to end.
 *
 * ⚠️ **This is the runtime's copy of the notation, and it cannot be the only one.**
 * `noodl-core-ui` (where FUN-001's `notation.ts` and FUN-004's diagnostics live) has no
 * dependency on `@noodl/runtime` — its `package.json` lists CodeMirror, ESLint and
 * `classnames`, and nothing from this repo. A runtime node cannot import a React package
 * either. So the *editor-side* builder is a separate file by force of the package graph, and
 * the two must be kept saying the same words by review; there is no import that can enforce
 * it. Recorded rather than papered over: FUN-007 §3 asks for "one place", and one place is
 * not reachable today without a new shared package.
 */

const JavascriptNodeParser = require('../../javascriptnodeparser');

/* ------------------------------------------------------------------ *
 * 1. The notation
 * ------------------------------------------------------------------ */

/** A label that may be written after a dot. Port labels come from a proplist a human typed. */
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export type PortSide = 'Inputs' | 'Outputs';

/** One output port of a Function node, as the author declared or wrote it. */
export interface DeclaredOutputPort {
  /** The author-visible name — the port name with its `out-` prefix already stripped. */
  label: string;
  isSignal: boolean;
}

/**
 * `Inputs.name`, or `Inputs["odd name"]` when the label cannot follow a dot.
 *
 * ⚠️ Port display names come from a proplist, so `My Value` is reachable and
 * `Inputs.My Value` is a syntax error. Bracket notation is not a nicety here.
 */
export function portReference(side: PortSide, label: string): string {
  return IDENTIFIER.test(label) ? side + '.' + label : side + '[' + JSON.stringify(label) + ']';
}

/**
 * How the author writes that port in the script.
 *
 * ⚠️ A value output is an *assignment* and a signal output is a *call*
 * (`javascriptnodeparser.js` types the port from the shape it finds in the text). Suggesting
 * `Outputs.Done = ...` for a signal would mint a second, value-typed port called `Done`.
 */
export function portUsage(side: PortSide, label: string, isSignal = false): string {
  const reference = portReference(side, label);
  if (side === 'Inputs') return reference;
  return isSignal ? reference + '()' : reference + ' = ...';
}

/* ------------------------------------------------------------------ *
 * 2. Where the error actually is
 * ------------------------------------------------------------------ */

/**
 * A V8 stack frame pointing inside `new Function`-compiled source.
 *
 * The frame text is `at eval (eval at <caller> (file.js:5:10), <anonymous>:4:7)`, so a frame
 * can mention `<anonymous>` twice — once as the *name of the compiling function* and once as
 * the synthesised source's own position. Only the second carries `:line:column`, and taking
 * the **last** match is what keeps that true if the first ever gains one.
 */
const ANONYMOUS_POSITION = /<anonymous>:(\d+):(\d+)/g;

export interface SourcePosition {
  line: number;
  column: number;
}

/** The raw position a stack reports, in the coordinates of the *compiled* source. */
export function rawPositionFromStack(stack: unknown): SourcePosition | undefined {
  if (typeof stack !== 'string') return undefined;

  const lines = stack.split('\n');
  for (let i = 0; i < lines.length; i++) {
    // The first line is `Error: message`, and a user's own message can contain anything.
    // Only frames are read.
    if (!/^\s*at /.test(lines[i])) continue;

    let match: RegExpExecArray | null;
    let last: RegExpExecArray | undefined;
    ANONYMOUS_POSITION.lastIndex = 0;
    while ((match = ANONYMOUS_POSITION.exec(lines[i])) !== null) last = match;

    if (last) return { line: Number(last[1]), column: Number(last[2]) };
  }

  return undefined;
}

let cachedOffset: number | undefined;

/**
 * How many lines sit above the author's line 1 in the source V8 actually compiled.
 *
 * Two contributions, and **neither is safe to hardcode**:
 *
 * - `JavascriptNodeParser.getCodePrefix()` is prepended to every body, and it is a string
 *   that has changed before and may change again;
 * - `new AsyncFunction(...)` synthesises a header (`async function anonymous(a,b,c,d\n) {\n`)
 *   whose line count is an engine detail, not ours.
 *
 * So it is *measured*, once, by compiling a probe whose only statement sits on the author's
 * line 1 and asking the engine where it thinks that is. An `AsyncFunction` body runs
 * synchronously up to its first `await`, so the probe's `new Error(...)` is constructed —
 * and its stack captured — before `probe(...)` returns.
 *
 * ⚠️ An error anchored one line off accuses innocent code, which is worse than anchoring
 * nothing. The fallback below therefore only ever runs if the probe itself fails, and the
 * callers treat "no position" as a legitimate answer.
 */
export function stackLineOffset(): number {
  if (cachedOffset !== undefined) return cachedOffset;

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    let captured: Error | undefined;
    const probe = new AsyncFunction(
      'Inputs',
      'Outputs',
      'Noodl',
      'Component',
      JavascriptNodeParser.getCodePrefix() + 'Inputs.__fun007Probe(new Error("fun-007 probe"));'
    );

    const settled = probe.call(
      {},
      {
        __fun007Probe(error: Error) {
          captured = error;
        }
      },
      {},
      {},
      {}
    );
    // The probe body cannot reject, but an unhandled rejection warning from a diagnostic
    // would be its own defect.
    if (settled && typeof settled.catch === 'function') settled.catch(() => undefined);

    const raw = rawPositionFromStack(captured && captured.stack);
    if (raw && raw.line >= 1) {
      cachedOffset = raw.line - 1;
      return cachedOffset;
    }
  } catch (e) {
    // fall through to the computed fallback
  }

  const prefixLines = (String(JavascriptNodeParser.getCodePrefix()).match(/\n/g) || []).length;
  // + 2 for the `async function anonymous(...)` header, which is the one part no computation
  // can reach from our own inputs.
  cachedOffset = prefixLines + 2;
  return cachedOffset;
}

/**
 * Where in the author's document an error was thrown, or `undefined` if it cannot be said.
 *
 * Columns are per line and the prefix ends in a newline, so the author's line 1 starts at
 * column 1 and the column needs no adjustment.
 */
export function userPositionForError(error: unknown): SourcePosition | undefined {
  const raw = rawPositionFromStack(error && (error as Error).stack);
  if (!raw) return undefined;

  const line = raw.line - stackLineOffset();
  if (line < 1) return undefined;

  return { line, column: raw.column };
}

/* ------------------------------------------------------------------ *
 * 3. The two things worth saying
 * ------------------------------------------------------------------ */

/**
 * The name a `ReferenceError` is complaining about, if it is complaining about a name.
 *
 * V8 and SpiderMonkey say `X is not defined`; JavaScriptCore says `Can't find variable: X`.
 * Anything else returns `undefined` and the caller falls back to the engine's own words.
 */
export function referenceErrorName(error: unknown): string | undefined {
  const e = error as Error;
  if (!e || e.name !== 'ReferenceError' || typeof e.message !== 'string') return undefined;

  const v8 = /^([A-Za-z_$][A-Za-z0-9_$]*) is not defined$/.exec(e.message);
  if (v8) return v8[1];

  const jsc = /^Can't find variable: ([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(e.message);
  if (jsc) return jsc[1];

  return undefined;
}

/**
 * FUN-004's message 1, reached from the run rather than from the linter.
 *
 * The whole originating failure in one sentence: the author typed a port's *name*, which is
 * a name JavaScript has never heard of, and the fix is two prefixes long.
 */
export function undeclaredPortNameMessage(name: string, side: PortSide, isSignal = false): string {
  if (side === 'Inputs') {
    return name + ' is an input port on this node. Read it with ' + portReference('Inputs', name) + '.';
  }
  return name + ' is an output port on this node. Write it with ' + portUsage('Outputs', name, isSignal) + '.';
}

/**
 * "the script ran and nothing came out", naming the ports that stayed empty.
 *
 * ⚠️ Advisory, and worded as advice. LEG-002 measured the equivalent question in phase 50 and
 * concluded advisory-not-blocking, for the reason FUN-007 §4 gives independently: a
 * legitimately side-effect-only run will trip this, and a node that goes *red* for a
 * legitimate program teaches people to ignore the dot.
 */
export function noOutputWrittenMessage(ports: DeclaredOutputPort[]): string {
  if (ports.length === 0) return '';

  const first = ports[0];
  const named = ports.map((p) => '"' + p.label + '"').join(', ');
  const which = ports.length === 1 ? 'it' : '"' + first.label + '"';

  if (first.isSignal) {
    return (
      'The script ran but produced no output: ' +
      named +
      ' never fired. Fire ' +
      which +
      ' in the script with ' +
      portUsage('Outputs', first.label, true) +
      '.'
    );
  }

  return (
    'The script ran but produced no output: ' +
    named +
    ' stayed empty. Write ' +
    which +
    ' in the script with ' +
    portUsage('Outputs', first.label, false) +
    ' — assigning to a plain variable of the same name does not reach the port.'
  );
}

/* ------------------------------------------------------------------ *
 * The node's own port set, without needing the node
 * ------------------------------------------------------------------ */

/** As much of a graph node model as these helpers read. */
export interface FunctionNodeModelLike {
  outputPorts?: Record<string, { type?: unknown } | undefined>;
  inputPorts?: Record<string, { type?: unknown } | undefined>;
  parameters?: Record<string, unknown>;
}

interface ProplistRow {
  id?: string;
  label?: string;
}

function proplistLabels(model: FunctionNodeModelLike | undefined, parameter: string): string[] {
  const rows = model && model.parameters && model.parameters[parameter];
  if (!Array.isArray(rows)) return [];

  const labels: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as ProplistRow;
    if (row && typeof row.label === 'string' && row.label !== '') labels.push(row.label);
  }
  return labels;
}

/**
 * Every output port this Function has, by the name user code would use.
 *
 * ⚠️ **Two routes, and both are needed.** A Function's ports "arrive by two routes — the
 * proplist and `parseAndAddPortsFromScript` reading `Inputs.x` out of the script"
 * (`simplejavascript.ts`'s own comment). `model.outputPorts` is the assembled truth in a live
 * editor, but it is delivered by the module's `setup` over `sendDynamicPorts`, so reading it
 * alone would make this invisible anywhere that plumbing is not running — including in a
 * spec. The proplist is read straight off `parameters` and covers exactly the case FUN-007
 * was opened for: **the author declared the port in the property panel and never mentioned
 * it in the code.**
 */
export function declaredOutputPorts(model: FunctionNodeModelLike | undefined): DeclaredOutputPort[] {
  const found: DeclaredOutputPort[] = [];
  const seen: Record<string, boolean> = {};

  function add(label: string, isSignal: boolean) {
    if (!label || seen[label]) return;
    seen[label] = true;
    found.push({ label, isSignal });
  }

  const outputPorts = model && model.outputPorts;
  if (outputPorts) {
    for (const name in outputPorts) {
      if (name.indexOf('out-') !== 0) continue;
      const port = outputPorts[name];
      add(name.substring('out-'.length), !!port && port.type === 'signal');
    }
  }

  const parameters = (model && model.parameters) || {};
  const labels = proplistLabels(model, 'scriptOutputs');
  for (let i = 0; i < labels.length; i++) {
    add(labels[i], parameters['outtype-' + labels[i]] === 'signal');
  }

  return found;
}

/** The author-visible names of this Function's input ports, from both routes. */
export function declaredInputPortNames(model: FunctionNodeModelLike | undefined): string[] {
  const names: string[] = [];
  const seen: Record<string, boolean> = {};

  function add(label: string) {
    if (!label || seen[label]) return;
    seen[label] = true;
    names.push(label);
  }

  const inputPorts = model && model.inputPorts;
  if (inputPorts) {
    for (const name in inputPorts) {
      if (name.indexOf('in-') !== 0) continue;
      add(name.substring('in-'.length));
    }
  }

  const labels = proplistLabels(model, 'scriptInputs');
  for (let i = 0; i < labels.length; i++) add(labels[i]);

  return names;
}

/**
 * FUN-007 §3 — the single most diagnosable error the product can produce.
 *
 * A `ReferenceError` naming something that *is* a port on this very node is unambiguous: the
 * author knows what they meant and JavaScript does not. Anything else returns `undefined`,
 * because a hint about a name we cannot vouch for is worse than the engine's own message.
 */
export function hintForThrownError(error: unknown, model: FunctionNodeModelLike | undefined): string | undefined {
  const name = referenceErrorName(error);
  if (!name) return undefined;

  if (declaredInputPortNames(model).indexOf(name) !== -1) {
    return undeclaredPortNameMessage(name, 'Inputs');
  }

  const outputs = declaredOutputPorts(model);
  for (let i = 0; i < outputs.length; i++) {
    if (outputs[i].label === name) return undeclaredPortNameMessage(name, 'Outputs', outputs[i].isSignal);
  }

  return undefined;
}

/**
 * The one line the node shows for a throw: where it happened, what the engine said, and — when
 * we can be certain — what the author probably meant.
 */
export function runtimeErrorMessage(
  rawMessage: string,
  position: SourcePosition | undefined,
  hint: string | undefined
): string {
  let message = position ? 'Line ' + position.line + ': ' + rawMessage : rawMessage;
  if (hint) message += ' — ' + hint;
  return message;
}
