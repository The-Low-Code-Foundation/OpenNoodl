/**
 * The ports a Function or Script node has because somebody **declared** them in
 * the property panel — the half `minePorts` cannot see.
 *
 * FUN-003. `scriptPorts.ts` mines the document for `Inputs.x` / `Outputs.y` and
 * its header states the design honestly: *"the document in the editor **is** the
 * port list."* That is true of one of the two routes. The node's own source says
 * so (`simplejavascript.ts:701-705`): a Function's inputs *"arrive by two routes
 * — the proplist above and `parseAndAddPortsFromScript` reading `Inputs.x` out
 * of the script"*. This module is the other route.
 *
 * ## Where a declared port lives
 *
 * In two parameters and a naming convention, both shared by the Function node
 * (`noodl-runtime/.../simplejavascript.ts:624-682`) and the Script node
 * (`noodl-viewer-react/.../javascript.ts:767-823`):
 *
 * | Parameter | Holds |
 * |---|---|
 * | `scriptInputs` / `scriptOutputs` | a `proplist` — `Array<{ id, label }>`, the author's rows |
 * | `intype-<label>` / `outtype-<label>` | that row's chosen type, absent until it is changed |
 *
 * The type defaults differ by direction and are taken from the runtime: an
 * undeclared input is `'string'`, an undeclared output is `'*'`.
 *
 * ## ⚠️ Why nothing is stripped here, which is not what the trap says
 *
 * The standing warning is that internal port names carry `in-`/`out-` prefixes
 * (`simplejavascript.ts:711-714`) and that a consumer inserting `Inputs.in-Value`
 * writes valid JavaScript that mints a port called `in`. That is true of the
 * **assembled port list**. It is not true of the proplist, which is what this
 * reads: the runtime builds `'in-' + p.label`, so `label` is already the display
 * name and there is no prefix on it to remove.
 *
 * Stripping anyway would be a defect rather than a belt-and-braces. A row an
 * author literally labelled `in-Value` becomes the port `in-in-Value`, whose
 * notation is `Inputs["in-Value"]`; strip it to `Value` and every consumer
 * writes code for a port that does not exist. And the Script node applies no
 * prefix at all — its port name *is* `p.label` — so a generic stripper would
 * corrupt an ordinary name there.
 *
 * The prefix is real, and the place it has to be handled is any consumer that
 * reads a node's assembled ports. Reading the proplist is how this boundary
 * avoids ever holding a prefixed name.
 *
 * Nothing here touches the DOM or a node model — plain parameters in, plain
 * facts out — so it runs in this package's `testEnvironment: 'node'` runner
 * (CED-001).
 *
 * @module code-editor/utils
 */

import { decodePropList } from '../../json-editor/utils/listValueCodec';
import type { PortFact } from '../authoringContext';
import type { ValidationType } from './types';

/** The two lists a Function or Script node declares its ports in. */
export interface DeclaredPorts {
  inputs: PortFact[];
  outputs: PortFact[];
}

/** `simplejavascript.ts:655` / `javascript.ts:768`. */
const INPUT_LIST = 'scriptInputs';
/** `simplejavascript.ts:624` / `javascript.ts:767`. */
const OUTPUT_LIST = 'scriptOutputs';
/** `simplejavascript.ts:657` — one `intype-` port per proplist row. */
const INPUT_TYPE_PREFIX = 'intype-';
/** `simplejavascript.ts:626`. */
const OUTPUT_TYPE_PREFIX = 'outtype-';
/** `simplejavascript.ts:678` — `node.parameters['intype-' + label] || 'string'`. */
const DEFAULT_INPUT_TYPE = 'string';
/** `simplejavascript.ts:648` — `node.parameters['outtype-' + label] || '*'`. */
const DEFAULT_OUTPUT_TYPE = '*';

function readList(
  parameters: Record<string, unknown> | undefined,
  listName: string,
  typePrefix: string,
  defaultType: string
): PortFact[] {
  // `decodePropList` is the same reader the property panel uses (ERG-003), so a
  // list stored in either observed shape reads identically in both places.
  const entries = decodePropList(parameters ? parameters[listName] : undefined);

  const facts: PortFact[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const name = entry.label;

    // A blank row declares no port: the runtime would build `in-`, which no
    // notation can name.
    if (!name || !name.trim()) continue;

    // Two rows with the same label are one port — the runtime's port list is
    // keyed by name and the second `push` is simply shadowed. Offering it twice
    // would suggest there are two.
    if (seen.has(name)) continue;
    seen.add(name);

    const declaredType = parameters ? parameters[typePrefix + name] : undefined;
    facts.push({
      name,
      type: typeof declaredType === 'string' && declaredType ? declaredType : defaultType
    });
  }

  return facts;
}

/**
 * Read a node's declared ports out of its parameters.
 *
 * Takes the parameter bag rather than a node model on purpose: this package
 * owns no project model and imports none, exactly as `authoringContext.ts`
 * describes. The editor is what knows how to find it.
 */
export function collectDeclaredPorts(parameters: Record<string, unknown> | undefined): DeclaredPorts {
  return {
    inputs: readList(parameters, INPUT_LIST, INPUT_TYPE_PREFIX, DEFAULT_INPUT_TYPE),
    outputs: readList(parameters, OUTPUT_LIST, OUTPUT_TYPE_PREFIX, DEFAULT_OUTPUT_TYPE)
  };
}

/**
 * The modes in which "this node's declared ports" is a question with an answer.
 *
 * `'expression'` is missing deliberately and is the important one. An Expression
 * node's inputs are **every identifier in its text**
 * (`expression.ts:399`), so there is no declared/undeclared distinction to draw
 * — and an affordance that offered `Inputs.foo` there would create a port called
 * `Inputs`. `'json'`, `'text'`, `'css'` and `'html'` are not code at all; the
 * property panel reaches this editor for a CSS Definition's `style` and Static
 * Data's `csv`.
 */
const MODES_WITH_DECLARED_PORTS: readonly ValidationType[] = ['function', 'script'];

/**
 * Does this editor mode have declared ports?
 *
 * Gate on this, never on whether the lists came back empty: an empty list is
 * also what a Function node nobody has added a port to looks like, and telling
 * those two apart is the difference between "you have no ports yet" and "ports
 * are not a thing here".
 */
export function modeHasDeclaredPorts(validationType: ValidationType | undefined): boolean {
  return validationType !== undefined && MODES_WITH_DECLARED_PORTS.indexOf(validationType) !== -1;
}
