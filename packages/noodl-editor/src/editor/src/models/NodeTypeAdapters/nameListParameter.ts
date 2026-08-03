/**
 * AIB-001 slice 3 — adapters stop trusting their parameters.
 *
 * Six places in the editor read a `stringlist` parameter by calling
 * `.split(',')` on it directly. All six run from a **model event listener** —
 * `nodeAdded`, `parametersChanged`, `projectLoaded` — or from a build, which
 * means a value of the wrong shape does not produce a bad port list, it throws
 * a `TypeError` out of whatever was dispatching. In the case this task is named
 * for that was `addAuthoredComponentToGroup` inside the apply transaction, so
 * one array-valued parameter rolled back 44 nodes across three components and
 * discarded an hour of paid model output.
 *
 * This is **not** the fix for that — slices 1 and 2 are, and they are the ones
 * that keep the value from being written at all. This is a crash guard, and it
 * earns its place by covering the populations the gate cannot see: a
 * hand-edited `project.json`, a legacy import, an MCP write from a client that
 * never ran the gate, and every project file that predates the rule.
 *
 * The rule it applies is deliberately narrow. It normalises the one shape that
 * is *unambiguously* the same list written differently — an array of strings —
 * and refuses to guess at anything else, because a helpful coercion here would
 * hide from the author the exact class of defect the report exists to surface.
 *
 * Pure: no editor singletons, so it is testable in plain Node. The warnings-model
 * wiring lives in `nameListParameter.warnings.ts`, which is what the adapters
 * actually call.
 *
 * @module noodl-editor/models/NodeTypeAdapters/nameListParameter
 */

/** What one read of a name-list parameter produced. */
export interface NameListRead {
  /** The names denoted, which is `[]` whenever the value could not be read. */
  names: string[];
  /**
   * An author-facing sentence, present only when the value was off-format.
   * Absent means "nothing to say" — including for an absent parameter.
   */
  problem?: string;
}

/**
 * A `stringlist`-typed parameter value, as the list of names it denotes.
 *
 *  - **a string** is split, exactly as the six call sites always did (empty
 *    string and whitespace behaviour included — this guard changes no working
 *    project's ports);
 *  - **an array of strings** is the same list in the wrong notation, so it is
 *    used *and* reported: the ports come out right and the author is told the
 *    file is off-format;
 *  - **anything else** yields no names and a report. Guessing would be worse
 *    than the empty list, which at least reads as "this node has no parameters"
 *    rather than as a plausible wrong set.
 */
export function parseNameList(value: unknown, parameterName: string): NameListRead {
  if (value === undefined || value === null) return { names: [] };
  if (typeof value === 'string') return { names: value.split(',') };

  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
    return {
      names: value as string[],
      problem:
        `"${parameterName}" is an array. This port takes one comma-separated string — ` +
        `${JSON.stringify(value.join(','))}. The ports were generated from it anyway; ` +
        'set the value again to write it back in the right shape.'
    };
  }

  return {
    names: [],
    problem:
      `"${parameterName}" is ${Array.isArray(value) ? 'an array' : typeof value}, not a comma-separated ` +
      'string, so no parameter ports could be generated from it.'
  };
}
