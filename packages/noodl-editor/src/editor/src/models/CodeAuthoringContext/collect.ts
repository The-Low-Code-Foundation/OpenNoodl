/**
 * FH-019 — reading the names a project uses, for the code editor to complete.
 *
 * Pure over a `ProjectModel`, so it is testable without a running editor and
 * without a `noodl-core-ui` import. `install.ts` is what binds it to project
 * events and publishes the result.
 *
 * ## Where a variable name lives
 *
 * There is no register of variables anywhere. A variable exists because some
 * node names it: `Variable`'s `name` input is typed
 * `{ name: 'string', identifierOf: 'VariableName' }`
 * (`noodl-runtime/src/nodes/std-library/data/variablenode2.ts:165-170`), and
 * `Set Variable` declares the same type. The property panel already collects
 * them exactly this way to fill its picker
 * (`propertyeditor/DataTypes/IdentifierType.ts:36-47`) — this is the same walk,
 * reachable from outside that panel.
 *
 * `Noodl.Objects` and `Noodl.Arrays` are keyed the same way, by `ModelName` and
 * `CollectionName`.
 *
 * ## And where else it lives
 *
 * A name used only in code has no port to be read off. `Noodl.Variables.total`
 * inside a Function node is as real a variable as one a `Set Variable` node
 * writes, and the graph walk cannot see it — so the code in the project is
 * mined too, with the same patterns the expression evaluator uses to work out
 * what an expression depends on (`expression-evaluator.ts:100-114`, which is
 * why the optional `Noodl.` prefix is part of the pattern).
 *
 * The result is "every name this project uses", which is the right answer for a
 * completion list: it is a set of names that already mean something here.
 *
 * @module CodeAuthoringContext
 */

import type { ProjectModel } from '../projectmodel';

/** The three identifier families the code editor completes. */
export interface ProjectNames {
  variables: string[];
  objects: string[];
  arrays: string[];
}

/** `identifierOf` value → which list its parameter values belong in. */
const IDENTIFIER_FAMILIES: Record<string, keyof ProjectNames> = {
  VariableName: 'variables',
  ModelName: 'objects',
  CollectionName: 'arrays'
};

/** `Noodl.Variables.x`, `Variables.x`, and the bracket forms of both. */
function namePatterns(namespace: string): RegExp[] {
  return [
    new RegExp('(?:Noodl\\.)?' + namespace + '\\.([A-Za-z_$][A-Za-z0-9_$]*)', 'g'),
    new RegExp('(?:Noodl\\.)?' + namespace + '\\[\\s*["\']([^"\']+)["\']\\s*\\]', 'g')
  ];
}

const CODE_PATTERNS: Record<keyof ProjectNames, RegExp[]> = {
  variables: namePatterns('Variables'),
  objects: namePatterns('Objects'),
  arrays: namePatterns('Arrays')
};

/**
 * A parameter value long enough to be worth scanning for code.
 *
 * Every string parameter in the project passes through here, and the vast
 * majority are labels, colours and unit strings. `Variables.a` is the shortest
 * thing that can match, so anything below its length cannot contain one — this
 * is a cheap way to skip most of a project rather than a heuristic about what
 * "looks like" code, which would silently miss the cases it guessed wrong.
 */
const MIN_CODE_LENGTH = 'Variables.a'.length;

function addMatches(source: string, patterns: RegExp[], into: Set<string>): void {
  for (const pattern of patterns) {
    // Fresh, because `lastIndex` on a shared /g literal makes the second
    // string a different answer from the first.
    const scan = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = scan.exec(source)) !== null) {
      if (match[1]) into.add(match[1]);
    }
  }
}

/**
 * Every variable, object and array name the project uses — from the ports that
 * declare them and from the code that reads them.
 *
 * Order is insertion order, which is graph order then code order: stable across
 * calls for an unchanged project, so the completion list does not reshuffle
 * itself between keystrokes.
 */
export function collectProjectNames(project: ProjectModel | undefined): ProjectNames {
  const found: Record<keyof ProjectNames, Set<string>> = {
    variables: new Set<string>(),
    objects: new Set<string>(),
    arrays: new Set<string>()
  };

  if (!project) return { variables: [], objects: [], arrays: [] };

  project.forEachComponent((component) => {
    component.forEachNode((node) => {
      const parameters = node.parameters || {};

      for (const port of node.getPorts()) {
        const type = port.type;
        if (typeof type !== 'object' || type === null) continue;

        const family = IDENTIFIER_FAMILIES[(type as { identifierOf?: string }).identifierOf ?? ''];
        if (!family) continue;

        const value = parameters[port.name];
        if (typeof value === 'string' && value.trim()) found[family].add(value);
      }

      // Then the code. Not restricted to the ports we believe hold code: a
      // parameter's edit type is decided by the node definition, and a list of
      // which ports those are is one more thing to keep in step with the node
      // library. Any string can be scanned; only real matches count.
      for (const value of Object.values(parameters)) {
        if (typeof value !== 'string' || value.length < MIN_CODE_LENGTH) continue;

        addMatches(value, CODE_PATTERNS.variables, found.variables);
        addMatches(value, CODE_PATTERNS.objects, found.objects);
        addMatches(value, CODE_PATTERNS.arrays, found.arrays);
      }
    });
  });

  return {
    variables: Array.from(found.variables),
    objects: Array.from(found.objects),
    arrays: Array.from(found.arrays)
  };
}
