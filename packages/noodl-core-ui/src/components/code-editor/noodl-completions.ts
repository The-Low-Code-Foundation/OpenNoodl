/**
 * Autocomplete that knows your project.
 *
 * Registered through `javascriptLanguage.data.of({ autocomplete })` so it runs
 * *beside* the JavaScript language's own sources (local variables, keywords,
 * snippets) rather than replacing them — see CED-001 (A2).
 *
 * ## What FH-019 changed
 *
 * This file used to open with a 25-element array of string literals. Everything
 * the editor could ever offer was in it, it was written from memory on one day
 * and maintained by nobody, and it was wrong in four separate ways at once:
 *
 * - it offered `State` and `Props`, which are not in scope in any Noodl code
 *   editor — a Function body is compiled with `Inputs, Outputs, Noodl,
 *   Component` and nothing else;
 * - it offered the fifteen Expression maths helpers inside Function and Script
 *   nodes, where `round` is genuinely undefined;
 * - it offered `Noodl.Records`, `Noodl.Users` and the rest of the API to
 *   nobody, because `Noodl.` answered with exactly three properties;
 * - and `Inputs.` answered with nothing at all, in the one editor where the
 *   answer is knowable from the text on screen.
 *
 * The three sources it is now made of are each anchored in something real:
 * {@link noodlMembersFor}/{@link globalsFor} in the runtime files that put the
 * names in scope, {@link minePorts} in the parser that turns `Inputs.x` into a
 * port, and the project surface in {@link getCodeAuthoringContext}.
 *
 * @module code-editor
 */

import { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';

import { getCodeAuthoringContext } from './authoringContext';
import { globalsFor, noodlMembersFor, type ApiMember } from './noodl-api-surface';
import { completesTopLevel, isMemberPosition } from './utils/completionPosition';
import { minePorts } from './utils/scriptPorts';
import type { ValidationType } from './utils/types';

/**
 * How far back to look for the object whose members are being completed.
 *
 * `Noodl.Variables.` is the longest path this file answers for, so a bounded
 * slice is enough and keeps the cost per keystroke independent of document
 * size.
 */
const MEMBER_PATH_LOOKBEHIND = 64;

/** A dotted path ending at the cursor: the `Noodl.Variables` of `Noodl.Variables.`. */
const MEMBER_PATH = /([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*)\.$/;

/**
 * The object being completed, or `null` at a top-level position.
 *
 * Whitespace is not tolerated around the dot on purpose — `Noodl .Variables` is
 * legal JavaScript and vanishingly rare, and accepting it would mean this
 * source answering for expressions it has not actually identified.
 */
function memberPathAt(context: CompletionContext, pos: number): string | null {
  if (!isMemberPosition(context, pos)) return null;

  const before = context.state.doc.sliceString(Math.max(0, pos - MEMBER_PATH_LOOKBEHIND), pos);
  const match = MEMBER_PATH.exec(before);
  return match ? match[1] : null;
}

/** Names from the project, as completions of one kind. */
function fromNames(names: readonly string[], type: Completion['type'], info: (name: string) => string): Completion[] {
  return names.map((name) => ({ label: name, type, info: info(name) }));
}

function asCompletions(members: readonly ApiMember[]): Completion[] {
  return members.map((member) => ({ label: member.label, type: member.type, info: member.info }));
}

/**
 * `Variables`, `Objects` and `Arrays` are top-level names in an Expression
 * (they are parameters of the compiled function) and are reached only through
 * `Noodl.` in a Function or Script. Answering for the bare form in a Function
 * would be completing an identifier that is not defined there.
 */
function resolveNamespace(path: string, validationType: ValidationType): 'variables' | 'objects' | 'arrays' | null {
  const bare = validationType === 'expression';

  if (path === 'Noodl.Variables' || (bare && path === 'Variables')) return 'variables';
  if (path === 'Noodl.Objects' || (bare && path === 'Objects')) return 'objects';
  if (path === 'Noodl.Arrays' || (bare && path === 'Arrays')) return 'arrays';

  return null;
}

/** Members of `Inputs.` / `Outputs.`, mined from the document. */
function scriptPortCompletions(context: CompletionContext, path: string): Completion[] | null {
  if (path !== 'Inputs' && path !== 'Outputs') return null;

  const ports = minePorts(context.state.doc.toString());

  if (path === 'Inputs') {
    return fromNames(
      ports.inputs,
      'variable',
      (name) => `Input port "${name}" — created by this node because your code reads it`
    );
  }

  return ports.outputs.map((name) => ({
    label: name,
    type: ports.signals.has(name) ? ('function' as const) : ('variable' as const),
    info: ports.signals.has(name)
      ? `Signal output "${name}" — fires when your code calls it`
      : `Output port "${name}" — created by this node because your code writes it`
  }));
}

/**
 * Members of whatever is before the cursor's dot, or `null` if this source does
 * not know that object — in which case the language's own sources answer, which
 * is why offering nothing here is the right behaviour and not a gap.
 */
function memberCompletions(
  context: CompletionContext,
  path: string,
  validationType: ValidationType
): Completion[] | null {
  if (path === 'Noodl') return asCompletions(noodlMembersFor(validationType));

  const namespace = resolveNamespace(path, validationType);
  if (namespace) {
    const project = getCodeAuthoringContext();

    if (namespace === 'variables') {
      return fromNames(project.variables, 'variable', (name) => `Variable "${name}", used elsewhere in this project`);
    }
    if (namespace === 'objects') {
      return fromNames(project.objects, 'variable', (name) => `Object "${name}", used elsewhere in this project`);
    }
    return fromNames(project.arrays, 'variable', (name) => `Array "${name}", used elsewhere in this project`);
  }

  if (validationType !== 'expression') return scriptPortCompletions(context, path);

  return null;
}

/**
 * Build the Noodl completion source for a mode.
 *
 * A factory rather than a bare function because what is in scope is a fact
 * about the mode, not about Noodl: an Expression and a Function node share
 * almost none of their globals, and the single conflated list they used to
 * share was wrong for both.
 */
export function createNoodlCompletionSource(
  validationType: ValidationType
): (context: CompletionContext) => CompletionResult | null {
  return function noodlCompletionSource(context: CompletionContext): CompletionResult | null {
    const word = context.matchBefore(/\w*/);
    if (!word) return null;

    // Members first. The word after a dot is always zero-length, so anything
    // that tests for an empty word has to run after this — that ordering is
    // FH-017 slice 1, and reversing it silently kills `Noodl.` again.
    const path = memberPathAt(context, word.from);
    if (path !== null) {
      const options = memberCompletions(context, path, validationType);
      // An empty list is still an answer for an object we recognise: returning
      // `null` would let another source claim `Inputs.`, and a menu with
      // nothing in it is CodeMirror's business, not ours.
      return options && options.length > 0 ? { from: word.from, options } : null;
    }

    if (!completesTopLevel(context, word)) return null;

    const prefix = word.text.toLowerCase();
    const options = asCompletions(globalsFor(validationType)).filter((option) =>
      option.label.toLowerCase().startsWith(prefix)
    );

    if (options.length === 0) return null;

    return { from: word.from, options };
  };
}
