/**
 * AIB-001 — the parameter-value contract
 *
 * The catalog has always said what a port is *called* and what type it *is*. It
 * has never said what a value of that type has to *look like* on the wire — and
 * nothing checked. `nodes.schema.json` declares `parameters` as a free property
 * bag (`additionalProperties: true`), and SUB-006's semantic validator reasons
 * about node types and port connectivity, never about values. So an AI-authored
 * plan wrote `pathParams: ["id","slug"]` — the correct reading of a port typed
 * `stringlist` — and `PageInputsAdapter`'s `.split(',')` threw a `TypeError`
 * from inside the apply transaction, which rolled 44 nodes across three
 * components back and discarded an hour of model output.
 *
 * This module is the missing half of the catalog: one table mapping a port type
 * to the shape a value of it must have, used for **both** halves of the
 * problem —
 *
 *  - {@link checkParameterValues} rejects a bad value as an ordinary
 *    `Diagnostic`, so the authoring loop's existing repair round fixes it inside
 *    the session, before a user ever sees it;
 *  - {@link wireFormatHint} renders the same rule as prose for the prompt, so
 *    the model is told the format instead of inferring it from a type name.
 *
 * Keeping them one table is the point: a format the validator enforces and the
 * prompt does not describe is a format the model can only discover by failing.
 *
 * ## Where the rules come from
 *
 * Measured, not assumed. Every rule below was checked against every
 * `project.json` in this repository (35 projects, ~4,000 parameter values) and
 * against the runtime code that consumes each type. Two formats in AIB-001's
 * own table did not survive that: a `dimension` is **not** `"100px"` and a
 * units-typed `number` is **not** a bare number — both are
 * `{ value, unit }` objects, and a `"100px"` string is silently *dropped* by
 * `defineRegularInputProp` (it reads `value.value`). The corpus is the reason
 * this rule fires 9 times on 4,000 real values rather than hundreds.
 *
 * ## What it deliberately does not do
 *
 * **It never coerces.** A gate that quietly repairs teaches the model nothing
 * and hides the next port type's version of the same bug. Normalising belongs
 * at the consuming edge (the adapters), where it is a crash guard for
 * hand-edited files and imports, not a repair.
 *
 * **It never fills defaults.** A parameter absent from `parameters` is not
 * equivalent to one set to the port's declared default — a declared `default`
 * never runs the node's setter — so "helpfully" materialising one would change
 * behaviour.
 *
 * **It skips nodes whose ports are runtime-determined**, the same conservative
 * choice SUB-006's port rule makes: a `States` node's `value-<state>-<param>`
 * parameters name ports that exist only once the node has been seeded, and
 * erroring on them would cry wolf on the population most likely to be right.
 *
 * @module noodl-editor/validation/parameterValues
 */

import { CatalogIndex, nearest, type CatalogPort } from './CatalogIndex';
import { DiagnosticCode, type Diagnostic, type Severity } from './diagnostics';

/** The catalog's `type` field, normalised to its object form. */
export interface PortTypeShape {
  name?: string;
  units?: string[];
  defaultUnit?: string;
  enums?: Array<{ label?: string; value: unknown } | string>;
}

/** A node as this rule needs to see it: identity plus its parameter bag. */
export interface ParameterizedNode {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown> | null;
}

export interface CheckParameterValuesOptions {
  /** Component identifier for the diagnostics' location. */
  component: string;
  /**
   * Report a parameter naming no declared port. Default `true`. Always a
   * warning, and never emitted for a node with dynamic ports.
   */
  reportUnknownParameters?: boolean;
}

/** What a rule says about one value. `null` ⇒ the value is fine. */
interface ValueProblem {
  message: string;
  severity: Severity;
  /** A single high-confidence replacement, rendered as JSON in the message. */
  suggestion?: string;
  alternatives?: string[];
}

/** How many enum options a diagnostic will list before truncating. */
const MAX_ALTERNATIVES = 16;

// ─── Value predicates ────────────────────────────────────────────────────────

const NUMERIC_STRING = /^\s*-?\d+(\.\d+)?\s*$/;
/** A number with a CSS unit glued on: the shape a model writes for a dimension. */
const NUMBER_WITH_UNIT = /^\s*(-?\d+(?:\.\d+)?)\s*(px|%|vw|vh|em|rem|deg|s|ms)\s*$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A design-token reference. Legal wherever the value ends up as a CSS value:
 * the authoring prompt instructs the model to write these for colour, spacing,
 * radius and font size, and the runtime passes them through for the browser to
 * resolve.
 */
function isTokenReference(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('var(');
}

function isNumberLike(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && NUMERIC_STRING.test(value);
}

/** How a value reads in a diagnostic — short, and never the whole blob. */
function describeValue(value: unknown): string {
  if (Array.isArray(value)) return `an array (${JSON.stringify(value).slice(0, 60)})`;
  if (value === null) return 'null';
  if (isPlainObject(value)) return `an object (${JSON.stringify(value).slice(0, 60)})`;
  if (typeof value === 'string') return `the string ${JSON.stringify(value.slice(0, 60))}`;
  return `${typeof value} ${JSON.stringify(value)}`;
}

// ─── The table ───────────────────────────────────────────────────────────────

/**
 * The wire format of one port type, as both a sentence and a check.
 *
 * `hint` is what the model is told (see `ContextBuilder.portLine`); `check` is
 * what the gate enforces. They are properties of one object so they cannot
 * drift.
 */
export interface WireFormat {
  /** A short parenthetical for the prompt, e.g. `comma-separated string`. */
  hint?: string;
  /** A concrete legal value for the prompt, already JSON-rendered. */
  example?: string;
  check(value: unknown, type: PortTypeShape): ValueProblem | null;
}

/** Ports whose value is a name looked up in a project table — always a string. */
const NAME_TYPES: Record<string, string> = {
  color: 'a token name, a project colour-style name, or a hex string',
  font: 'a font family name or a project font path',
  textStyle: 'the name of a text style declared in this project',
  component: 'the full path of a component, e.g. "/Pages/Home"',
  image: 'a project-relative image path'
};

function nameTypeFormat(typeName: string): WireFormat {
  return {
    // No per-port hint: "color"/"font"/"component" already read as names, and
    // 120 colour ports each carrying a sentence would cost more prompt bytes
    // than the mistake costs repair rounds. The legend covers the rule.
    check(value) {
      if (typeof value === 'string') return null;
      return {
        severity: 'error',
        message:
          `${typeName} expects ${NAME_TYPES[typeName]} — a string. Got ${describeValue(value)}, ` +
          'which resolves to nothing and leaves the property unset.'
      };
    }
  };
}

/** A units-typed `number` or a `dimension`: the `{ value, unit }` object form. */
function unitsFormat(type: PortTypeShape): WireFormat {
  const units = type.units ?? [];
  const unit = type.defaultUnit || units[0] || 'px';
  return {
    // Deliberately terse: a visual node has ~45 of these and the general rule
    // (object form, or a bare number, or a token) is stated once in the legend.
    // Only the units themselves vary per port, so only they are repeated.
    hint: `{value, unit}, units: ${units.join('|') || unit}`,
    check(value) {
      // A bare number is merged into the port's current unit by
      // `Node.setInputValue`; a token reference resolves as CSS.
      if (isNumberLike(value) || isTokenReference(value)) return null;
      if (isPlainObject(value)) {
        if (!isNumberLike(value.value)) {
          return {
            severity: 'error',
            message:
              `${JSON.stringify(Object.keys(value))} is not the object form this port takes — it needs a ` +
              'numeric "value" (and optionally a "unit").',
            suggestion: JSON.stringify({ value: 16, unit })
          };
        }
        if (value.unit !== undefined && units.length > 0 && !units.includes(String(value.unit))) {
          return {
            severity: 'error',
            message: `unit ${JSON.stringify(value.unit)} is not one of this port's units.`,
            alternatives: units.map((u) => JSON.stringify(u)),
            suggestion: JSON.stringify({ ...value, unit })
          };
        }
        return null;
      }
      // "100px" is the single most likely model error here, and it is worse
      // than a crash: `defineRegularInputProp` reads `.value` off it, finds
      // undefined, and DELETES the property — so the value vanishes silently.
      const parsed = typeof value === 'string' ? NUMBER_WITH_UNIT.exec(value) : null;
      if (parsed) {
        return {
          severity: 'error',
          message:
            `a value with units is an object, not a string — ${JSON.stringify(value)} is dropped silently ` +
            'rather than applied.',
          suggestion: JSON.stringify({ value: Number(parsed[1]), unit: parsed[2] })
        };
      }
      return {
        severity: 'error',
        message: `expects a number or { "value", "unit" } object. Got ${describeValue(value)}.`,
        suggestion: JSON.stringify({ value: 16, unit })
      };
    }
  };
}

const FORMATS: Record<string, (type: PortTypeShape) => WireFormat> = {
  stringlist: () => ({
    // The one hint worth shouting: it is the format that cost this task its
    // name, and the type's own word ("list") argues for the wrong answer.
    hint: 'a COMMA-SEPARATED STRING, not an array',
    example: '"id,slug"',
    check(value) {
      if (typeof value === 'string') return null;
      if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
        return {
          severity: 'error',
          message:
            'a stringlist is one comma-separated string, not an array — the editor calls .split(",") on it, ' +
            'and an array throws.',
          suggestion: JSON.stringify(value.join(','))
        };
      }
      return {
        severity: 'error',
        message: `a stringlist is one comma-separated string, e.g. "a,b,c". Got ${describeValue(value)}.`
      };
    }
  }),

  proplist: () => ({
    hint: 'array of {label, value} rows',
    check(value) {
      if (Array.isArray(value)) {
        const bad = value.findIndex((entry) => !isPlainObject(entry));
        if (bad === -1) return null;
        return {
          severity: 'error',
          message: `every row of a proplist is an object; row ${bad} is ${describeValue(value[bad])}.`
        };
      }
      return {
        severity: 'error',
        message: `a proplist is an array of { label, value } rows. Got ${describeValue(value)}.`
      };
    }
  }),

  enum: (type) => {
    const options = (type.enums ?? []).map((e) => (typeof e === 'string' ? e : String(e.value)));
    return {
      hint: options.length > 0 ? `one of: ${options.slice(0, MAX_ALTERNATIVES).join(', ')}` : undefined,
      example: options.length > 0 ? JSON.stringify(options[0]) : undefined,
      check(value) {
        if (options.length === 0) return null; // nothing to check against
        if (typeof value !== 'string') {
          return {
            severity: 'error',
            message: `an enum value is one of the declared option strings. Got ${describeValue(value)}.`,
            alternatives: options.slice(0, MAX_ALTERNATIVES)
          };
        }
        if (options.includes(value)) return null;
        const guess = nearest(value, options);
        return {
          severity: 'error',
          message: `${JSON.stringify(value)} is not one of this port's options.`,
          ...(guess ? { suggestion: guess } : {}),
          alternatives: options.slice(0, MAX_ALTERNATIVES)
        };
      }
    };
  },

  boolean: () => ({
    check(value) {
      if (typeof value === 'boolean') return null;
      const asString = typeof value === 'string' ? value.trim().toLowerCase() : undefined;
      if (asString === 'true' || asString === 'false') {
        return {
          severity: 'error',
          message:
            `a boolean port takes true/false, not ${JSON.stringify(value)} — the string "false" is truthy, ` +
            'so this reads as the opposite of what it says.',
          suggestion: asString
        };
      }
      return { severity: 'error', message: `expects true or false. Got ${describeValue(value)}.` };
    }
  }),

  number: (type) =>
    type.units
      ? unitsFormat(type)
      : {
          check(value) {
            if (isNumberLike(value)) return null;
            return {
              severity: 'error',
              message: `expects a number. Got ${describeValue(value)}.`
            };
          }
        },

  dimension: (type) => unitsFormat(type),

  string: () => ({
    check(value) {
      if (typeof value === 'string') return null;
      // Consumable — React renders a number, and a JSON blob stringifies — so
      // this is off-format rather than broken.
      return {
        severity: 'warning',
        message: `expects a string. Got ${describeValue(value)}, which will be stringified.`
      };
    }
  }),

  icon: () => ({
    hint: '{class, code}, e.g. {"class":"material-icons","code":"search"}',
    check(value) {
      if (typeof value === 'string') return null;
      if (isPlainObject(value) && typeof value.code === 'string') return null;
      return {
        severity: 'error',
        message: `an icon is { "class", "code" } or an icon name. Got ${describeValue(value)}.`
      };
    }
  }),

  color: () => nameTypeFormat('color'),
  font: () => nameTypeFormat('font'),
  textStyle: () => nameTypeFormat('textStyle'),
  component: () => nameTypeFormat('component'),
  image: () => nameTypeFormat('image')
};

/**
 * The `type` field, normalised. A catalog port's type is either a bare name
 * string or an object carrying the name plus its options/units.
 */
export function portTypeShape(port: CatalogPort | undefined): PortTypeShape | undefined {
  if (!port) return undefined;
  const raw = port.type as unknown;
  if (typeof raw === 'string') return { name: raw };
  if (isPlainObject(raw)) return raw as PortTypeShape;
  return undefined;
}

/**
 * The wire-format rule for a port, or `undefined` when its type has no
 * constrained shape (`*`, `array`, `object`, `reference`, `signal`, and the
 * handful of exotic types whose values are opaque here).
 */
export function wireFormatFor(port: CatalogPort | undefined): WireFormat | undefined {
  const type = portTypeShape(port);
  if (!type?.name) return undefined;
  const build = FORMATS[type.name];
  return build ? build(type) : undefined;
}

/**
 * The general parameter-value rules, stated ONCE per node-documentation
 * handout rather than repeated on every port.
 *
 * A visual node has ~45 ports that would otherwise each carry "a bare number,
 * or a var(--token) reference" — about 3KB per node type fetched, against a
 * 120,000-char context budget shared with the project's own graphs. The per-port
 * hints carry only what varies (a port's units, an enum's options); everything
 * true of a whole type is here.
 */
export const WIRE_FORMAT_LEGEND = [
  'Parameter values — the wire format the editor reads:',
  '- Write numbers as numbers and booleans as true/false. A quoted "12" or "false" is not the same value.',
  '- A port shown as {value, unit} takes that object (e.g. {"value":16,"unit":"px"}), a bare number, or a',
  '  var(--token) reference. A CSS string like "16px" is DROPPED silently.',
  '- An enum takes one of its listed options, spelled exactly — not the label, not a synonym.',
  '- color/font/textStyle/image/component take a NAME (a token, a project style, or a component path).'
].join('\n');

/**
 * The parenthetical the prompt appends after a port's type name — the format
 * and, where one helps, an example. Empty string when the type speaks for
 * itself, so callers can append unconditionally.
 */
export function wireFormatHint(port: CatalogPort | undefined): string {
  const format = wireFormatFor(port);
  if (!format?.hint) return '';
  return format.example ? `${format.hint}, e.g. ${format.example}` : format.hint;
}

// ─── The rule ────────────────────────────────────────────────────────────────

/**
 * Check every node's parameter values against the wire format its port type
 * demands.
 *
 * Conservative by construction — it reports only what it can prove from the
 * catalog:
 *
 *  - a node whose **type** is unknown is skipped entirely (`unknown-node-type`
 *    already owns that, and guessing a format from a type we cannot resolve
 *    would be inventing one);
 *  - a node with **dynamic ports** has its unknown-parameter check skipped, for
 *    SUB-006's reason: those ports are real and the catalog cannot see them.
 *    Parameters that DO name a statically-declared port on such a node are
 *    still checked — a dynamic node's static ports are as static as anyone's,
 *    and `PageInputs.pathParams`, the port this whole task is about, is exactly
 *    one of those;
 *  - a port type with no constrained shape passes.
 */
export function checkParameterValues(
  nodes: readonly ParameterizedNode[],
  catalog: CatalogIndex,
  options: CheckParameterValuesOptions
): Diagnostic[] {
  const { component, reportUnknownParameters = true } = options;
  const diagnostics: Diagnostic[] = [];

  for (const node of nodes) {
    const parameters = node.parameters;
    if (!parameters || !catalog.hasType(node.type)) continue;
    const dynamic = catalog.isDynamicNode(node.type);

    for (const [name, value] of Object.entries(parameters)) {
      // "Not set". `undefined` is what the editor writes for a cleared field;
      // `null` is what a model writes to mean the same thing, and it behaves
      // that way at runtime too — a null colour resolves to nothing and leaves
      // the property unset, which is exactly what it asked for. Erroring on it
      // would spend a repair round making a candidate no better.
      if (value === undefined || value === null) continue;

      const port = catalog.getPort(node.type, 'input', name);
      if (!port) {
        if (!reportUnknownParameters || dynamic) continue;
        const suggestion = catalog.suggestPort(node.type, 'input', name);
        diagnostics.push({
          code: DiagnosticCode.UnknownParameter,
          severity: 'warning',
          message: `${node.type} has no input port "${name}", so this parameter is never read.`,
          location: locate(component, node, name),
          ...(suggestion ? { suggestion } : {})
        });
        continue;
      }

      const problem = wireFormatFor(port)?.check(value, portTypeShape(port)!);
      if (!problem) continue;

      const typeName = CatalogIndex.portTypeName(port) ?? 'unknown';
      diagnostics.push({
        code: DiagnosticCode.InvalidParameterValue,
        severity: problem.severity,
        message: `parameter "${name}" (${typeName}) ${problem.message}`,
        location: locate(component, node, name),
        ...(problem.suggestion !== undefined ? { suggestion: problem.suggestion } : {}),
        ...(problem.alternatives ? { alternatives: problem.alternatives } : {})
      });
    }
  }

  return diagnostics;
}

function locate(component: string, node: ParameterizedNode, port: string) {
  return {
    component,
    nodeId: node.id,
    nodeType: node.type,
    ...(node.label ? { nodeLabel: node.label } : {}),
    port,
    plug: 'input' as const
  };
}
