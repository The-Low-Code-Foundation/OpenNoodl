/**
 * The diagnostics that know a name is a **port** (FUN-004).
 *
 * The originating user typed `var Output_1 = Input_1` and needed
 * `Outputs.Output_1 = Inputs.Input_1`. They were already being told something was
 * wrong — `no-undef` carries *"'Input_1' is not defined"* today. That message is
 * true, generic and useless: it states a JavaScript fact about a name that is a
 * **port they created ninety seconds ago in the panel next door**.
 *
 * So this task adds no detection. It adds knowledge and a fix.
 *
 * ## The four messages
 *
 * | | When | Severity |
 * |---|---|---|
 * | 1 | an undefined name that **is** an input port | warning (`no-undef`'s own) |
 * | 2 | a local or implicit global written under an **output**'s name | warning |
 * | 3 | an undefined name that is **no** port | warning (`no-undef`'s own) |
 * | 4 | a declared port the code never mentions | **info**, once, at the top |
 *
 * 1 and 3 are a rewrite of a `no-undef` message the linter already produced. 2 is
 * a new rule over the syntax tree — the half that lints clean today. 4 is the
 * reverse blind spot, and is only expressible because the declared and mined port
 * lists are kept apart (`authoringContext.ts:69-77`).
 *
 * Every one of them ships a **fix-it**. A beginner who does not know the notation
 * cannot be asked to type the correction from a description; the click is the
 * teaching, because it shows the shape in their own code with their own names.
 *
 * ## ⚠️ None of this may reach `'expression'` mode
 *
 * Suggesting `Inputs.total` inside an Expression node is not merely unhelpful, it
 * is **destructive**: every undeclared identifier in an expression already *is* an
 * input port (`expression.ts:399`), so the "fix" mints a port literally named
 * `Inputs` plus a property access the author never meant. The gate is
 * `modeHasDeclaredPorts`, the same one `CodeEditorType` uses to decide whether to
 * publish an open node at all, and `portDiagnostics.test.ts` lints identical text
 * in both modes and asserts the difference.
 *
 * ## ⚠️ Message 2 is a syntax-tree rule, and the two forms are not the same bug
 *
 * `var Output_1 = …` declares a genuine local. Inside a helper function that is
 * **legal and common**, so it is reported only at the top level of the body.
 * `Output_1 = …` with no declaration lands on an *implicit global* at any depth —
 * it is the same defect wherever it appears, and is reported wherever it appears.
 * Collapsing the two into one rule gets one of them wrong.
 *
 * @module code-editor/utils
 */

import type { Action, Diagnostic } from '@codemirror/lint';
import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';

import { getCodeAuthoringContext } from '../authoringContext';
import { modeHasDeclaredPorts } from './declaredPorts';
import {
  declaredButUnreadMessage,
  localShadowsOutputMessage,
  readExpression,
  undefinedNameIsInputMessage,
  undefinedNameIsNoPortMessage,
  writeExpression,
  canExpressPort,
  type PortKind
} from './notation';
import type { ValidationType } from './types';
import { minesAnyPort } from './portBar';
import { unionPorts, type UnionPort } from './unionPorts';

/** `source` on the diagnostics this module owns, so the panel names the rule. */
const SOURCE = 'nodegx:ports';

/**
 * Levenshtein distance, capped — we only ever care whether it is small.
 *
 * Bounded so a long name against a long candidate exits early instead of filling
 * a matrix on every keystroke of every lint pass.
 */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      if (current[j] < best) best = current[j];
    }

    if (best > max) return max + 1;
    previous = current;
  }

  return previous[b.length];
}

/**
 * Every name the document itself defines — what a misspelling would be a
 * misspelling *of*.
 *
 * `VariableDefinition` covers `var`/`let`/`const`, function names and parameters,
 * which is the whole of what "in scope" can mean for a body with no imports.
 */
function definedNames(state: EditorState): string[] {
  const names: string[] = [];

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== VARIABLE_DEFINITION) return;
      const text = state.doc.sliceString(node.from, node.to);
      if (text && names.indexOf(text) === -1) names.push(text);
    }
  });

  return names;
}

/**
 * Is this name close enough to something in scope to be a typo of it?
 *
 * ⚠️ This is message 3's own warning made operational: *"a fix-it that turns a
 * misspelled local into a phantom input port is a worse outcome than the
 * warning."* `const total = 1; Outputs.x = totl` is the case — `totl` is one
 * edit from `total`, and offering "create an input port `totl`" there would
 * mint a real port for a slip, and mint it on a click the user is being invited
 * to make.
 *
 * The threshold is one edit, not two: at two, `sum` and `num` become typos of
 * each other and a legitimate new port stops being offerable. One edit catches
 * the transposition and dropped-character slips that actually happen.
 */
function looksLikeTypo(name: string, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => candidate !== name && editDistance(name, candidate, 1) <= 1);
}

/**
 * Names that look like a port rather than a typo of something in scope.
 *
 * A single character, or a name that cannot be written in any notation at all,
 * gets the plain `no-undef` message and no offer.
 */
function looksInsertable(name: string, state: EditorState, ports: { inputs: UnionPort[]; outputs: UnionPort[] }): boolean {
  if (name.length <= 1 || !canExpressPort(name)) return false;

  const inScope = [...definedNames(state), ...ports.inputs.map((p) => p.name), ...ports.outputs.map((p) => p.name)];

  return !looksLikeTypo(name, inScope);
}

/** One replacement, as CodeMirror's lint panel wants it. */
function replaceWith(label: string, from: number, to: number, insert: string): Action {
  return {
    name: label,
    apply(view) {
      view.dispatch({ changes: { from, to, insert } });
    }
  };
}

/**
 * The ports this document's node has, from both routes, or `null` where the
 * question does not apply.
 *
 * Read per lint pass rather than captured, for the same reason the completion
 * sources read per keystroke: the popout mounts once and outlives any number of
 * changes to the node beneath it.
 */
function portsFor(state: EditorState, validationType: ValidationType) {
  if (!modeHasDeclaredPorts(validationType)) return null;

  return unionPorts(getCodeAuthoringContext().openNode ?? null, state.doc.toString());
}

function findPort(ports: readonly UnionPort[], name: string): UnionPort | undefined {
  return ports.find((port) => port.name === name);
}

/* ------------------------------------------------------------------ *
 * Messages 1 and 3 — rewriting what `no-undef` already found
 * ------------------------------------------------------------------ */

/**
 * Turn a `no-undef` diagnostic into one that knows about ports.
 *
 * Returns the diagnostic unchanged when the name is neither a port nor
 * insertable — the generic message is still the right one for a genuine typo.
 *
 * ⚠️ The identifier is read from **the document**, at the range ESLint reported,
 * rather than parsed out of the message text. `'x' is not defined` is a string
 * that has changed between ESLint versions and would take this with it.
 */
export function withPortKnowledge(
  state: EditorState,
  diagnostic: Diagnostic,
  ports: { inputs: UnionPort[]; outputs: UnionPort[] } | null
): Diagnostic {
  if (!ports) return diagnostic;
  if (diagnostic.to <= diagnostic.from) return diagnostic;

  const name = state.doc.sliceString(diagnostic.from, diagnostic.to);
  if (!name || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) return diagnostic;

  const input = findPort(ports.inputs, name);

  // Message 1 — it is an input port. The user's exact case.
  if (input) {
    const insert = readExpression(name);

    return {
      ...diagnostic,
      message: undefinedNameIsInputMessage(name),
      source: SOURCE,
      actions: [replaceWith(`Replace with ${insert}`, diagnostic.from, diagnostic.to, insert)]
    };
  }

  // An *output* read as a bare name is not message 1 — reading an output is not a
  // thing you do. Leave `no-undef` to say so plainly rather than offering
  // `Inputs.Output_1`, which would create a second port with a confusing name.
  if (findPort(ports.outputs, name)) return diagnostic;

  // Message 3 — no port by that name, but the name could become one.
  if (!looksInsertable(name, state, ports)) return diagnostic;

  const insert = readExpression(name);

  return {
    ...diagnostic,
    message: undefinedNameIsNoPortMessage(name),
    source: SOURCE,
    actions: [replaceWith(`Create input port ${name}`, diagnostic.from, diagnostic.to, insert)]
  };
}

/* ------------------------------------------------------------------ *
 * Message 2 — the half that lints clean
 * ------------------------------------------------------------------ */

/** Lezer node names, confirmed against `@codemirror/lang-javascript`'s own parse. */
const VARIABLE_DECLARATION = 'VariableDeclaration';
const VARIABLE_DEFINITION = 'VariableDefinition';
const ASSIGNMENT_EXPRESSION = 'AssignmentExpression';
const VARIABLE_NAME = 'VariableName';

/** The function-ish nodes that make a `var` genuinely local. */
const FUNCTION_SCOPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunction', 'MethodDeclaration']);

function insideFunctionScope(state: EditorState, pos: number): boolean {
  let node = syntaxTree(state).resolveInner(pos, 1).parent;

  while (node) {
    if (FUNCTION_SCOPES.has(node.name)) return true;
    node = node.parent;
  }

  return false;
}

/**
 * Find writes to a local or implicit global that carry an output port's name.
 *
 * The two forms and why they are gated differently are in the module header: a
 * declaration is only a defect at the top level, an undeclared assignment is a
 * defect anywhere.
 */
export function outputShadowDiagnostics(
  state: EditorState,
  ports: { outputs: UnionPort[] } | null
): Diagnostic[] {
  if (!ports || ports.outputs.length === 0) return [];

  const found: Diagnostic[] = [];
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      const isDeclaration = node.name === VARIABLE_DEFINITION && node.node.parent?.name === VARIABLE_DECLARATION;

      const isBareAssignment =
        node.name === VARIABLE_NAME &&
        node.node.parent?.name === ASSIGNMENT_EXPRESSION &&
        // The assignment *target* is the first child. `x = Output_1` reads it.
        node.node.parent.firstChild?.from === node.from;

      if (!isDeclaration && !isBareAssignment) return;

      const name = state.doc.sliceString(node.from, node.to);
      const port = findPort(ports.outputs, name);
      if (!port) return;

      // A `var` inside a helper is a real local and a legitimate program.
      if (isDeclaration && insideFunctionScope(state, node.from)) return;

      const kind: PortKind = port.kind;
      const insert = writeExpression(name, kind);

      found.push({
        from: node.from,
        to: node.to,
        // ⚠️ Never an error. `no-undef`'s own reasoning about honest severity
        // applies harder here: this rule depends on a port list that a rename in
        // the panel can change under a document that is still correct.
        severity: 'warning',
        message: localShadowsOutputMessage(name, kind),
        source: SOURCE,
        actions: [
          replaceWith(
            `Write the port instead`,
            // Swallow the declaration keyword: rewriting `var Output_1 =` as
            // `var Outputs.Output_1 =` is a syntax error, which would be a
            // fix-it that breaks the document.
            isDeclaration ? declarationStart(state, node.from) : node.from,
            node.to,
            kind === 'signal' ? insert : insert.trimEnd()
          )
        ]
      });
    }
  });

  return found;
}

/**
 * Where the `var`/`let`/`const` before a definition starts, so a fix-it can
 * replace the keyword along with the name.
 *
 * ⚠️ Only for the **first** declarator. `let a = 1, Output_1 = 2` shares one
 * keyword, and swallowing it there would delete `a`'s declaration too — so a
 * later declarator keeps its own start and the fix rewrites just the name,
 * leaving text that is still valid.
 */
function declarationStart(state: EditorState, definitionFrom: number): number {
  const declaration = syntaxTree(state).resolveInner(definitionFrom, 1).parent;
  if (!declaration || declaration.name !== VARIABLE_DECLARATION) return definitionFrom;

  const firstDefinition = declaration.getChild(VARIABLE_DEFINITION);
  if (!firstDefinition || firstDefinition.from !== definitionFrom) return definitionFrom;

  return declaration.from;
}

/* ------------------------------------------------------------------ *
 * Message 4 — the reverse blind spot
 * ------------------------------------------------------------------ */

/**
 * The declared ports the document never mentions, as one informational line.
 *
 * ⚠️ Anchored at the very start of the document and severity `'info'`, so it
 * appears in the lint panel without underlining anything. A squiggle here would
 * fire on every port in the window between creating it and using it, which is
 * most of the time anyone is looking.
 */
export function unreadPortDiagnostics(
  state: EditorState,
  ports: { inputs: UnionPort[]; outputs: UnionPort[] } | null,
  alreadyNamed: ReadonlySet<string> = new Set()
): Diagnostic[] {
  if (!ports) return [];

  // ⚠️ `alreadyNamed` is not tidying. A port written as a bare `Input_1` is
  // declared and genuinely not *read* — message 4 is literally true about it —
  // but message 1 is already pointing at that exact name on that exact line with
  // a better sentence and a fix. Saying both turns the originating user's one-line
  // mistake into three diagnostics, two of them about the same port, which is the
  // grey wall this phase exists to remove rather than reproduce.
  // ⚠️ FUN-006 §3, the deliberate split, and this is the half that lives here.
  // A document that mines **no** port is the blank page, and FUN-006's bar owns
  // it — "you have not started" is a document-level statement of fact, in the
  // register the bar is written in. This message owns "you started and this
  // specific port got left behind". Without the line below, both surfaces
  // narrate the same fact in different words on a fresh node, which the task
  // names as how a help surface stops being believed.
  if (!minesAnyPort(ports)) return [];

  const unread = ports.inputs.filter((port) => port.declared && !port.mined && !alreadyNamed.has(port.name));
  if (unread.length === 0) return [];

  const names = unread.map((port) => port.name);
  const first = names[0];

  const actions: Action[] = canExpressPort(first)
    ? [
        {
          name: `Insert ${readExpression(first)}`,
          apply(view) {
            // At the cursor, not at the top: the author is somewhere, and an
            // insertion at offset 0 would land above their code.
            const at = view.state.selection.main.head;
            const insert = readExpression(first);
            view.dispatch({ changes: { from: at, insert }, selection: { anchor: at + insert.length } });
          }
        }
      ]
    : [];

  return [
    {
      from: 0,
      to: 0,
      severity: 'info',
      message: declaredButUnreadMessage(names),
      source: SOURCE,
      actions
    }
  ];
}

/* ------------------------------------------------------------------ *
 * The pass
 * ------------------------------------------------------------------ */

/**
 * Add port knowledge to a document's diagnostics.
 *
 * `base` is what ESLint produced. `no-undef` entries in it are rewritten where
 * the name turns out to be a port (or could become one); the two rules ESLint
 * cannot express are appended.
 */
export function portDiagnostics(
  state: EditorState,
  validationType: ValidationType,
  base: Diagnostic[]
): Diagnostic[] {
  const ports = portsFor(state, validationType);
  if (!ports) return base;

  // The input ports message 1 has already spoken about, so message 4 does not
  // repeat them — see the ⚠️ on `unreadPortDiagnostics`.
  const named = new Set<string>();

  const enriched = base.map((diagnostic) => {
    if (diagnostic.source !== 'eslint:no-undef') return diagnostic;

    const next = withPortKnowledge(state, diagnostic, ports);
    if (next.source === SOURCE) named.add(state.doc.sliceString(diagnostic.from, diagnostic.to));

    return next;
  });

  return [
    ...enriched,
    ...outputShadowDiagnostics(state, ports),
    ...unreadPortDiagnostics(state, ports, named)
  ];
}
