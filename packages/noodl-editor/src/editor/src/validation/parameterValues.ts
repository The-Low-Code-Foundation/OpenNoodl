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
import { conditionForInput, conditionIsUnsatisfied } from './portConditions';

/** The catalog's `type` field, normalised to its object form. */
export interface PortTypeShape {
  name?: string;
  units?: string[];
  defaultUnit?: string;
  enums?: Array<{ label?: string; value: unknown } | string>;
  /**
   * The port accepts a wired connection and nothing else. A value written into
   * `parameters` for such a port is discarded without complaint — see
   * `DiagnosticCode.ConnectionOnlyParameter`.
   */
  allowConnectionsOnly?: boolean;
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
   * warning, and never emitted for a node whose ports are *runtime-determined* —
   * a node that merely declares conditional port groups is checked, because the
   * catalog enumerates those ports in full.
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
  '- A bare number on such a port means the FIRST unit listed for it, which for width/height/maxWidth is',
  '  "%" and NOT px. Write {"value":260,"unit":"px"} for 260 pixels; a bare 260 renders at 260% wide.',
  '  There is no "widthUnit"/"heightUnit" parameter — the unit goes inside the object.',
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

// ─── Conditional ports ───────────────────────────────────────────────────────

/**
 * A port condition as a sentence.
 *
 * The stored form (`sizeMode = explicit OR sizeMode = contentHeight`) is already
 * close to readable, so this only unpicks the two bits of punctuation a reader
 * would stumble on: `NOT SET` reads as a phrase, and `=` reads as "is".
 */
function describeCondition(condition: string): string {
  return condition
    .replace(/\s+NOT SET/g, ' is not set')
    .replace(/\s*!=\s*/g, ' is not ')
    .replace(/\s*=\s*/g, ' is ')
    .replace(/\bOR\b/g, 'or')
    .replace(/\bAND\b/g, 'and');
}

/**
 * The sibling edit that switches the port on, when the condition names exactly
 * one — which covers the cases that actually bite (`sizeMode = explicit`,
 * `boxShadowEnabled = true`). A multi-clause `OR` offers a choice this is not
 * entitled to make for the author, so it stays silent and the message alone
 * carries the repair.
 */
function repairForCondition(condition: string): string | undefined {
  const single = /^\s*(\w+)\s*=\s*'?([\w-]+)'?\s*$/.exec(condition);
  return single ? `${single[1]}: ${JSON.stringify(single[2])}` : undefined;
}

// ─── The rule ────────────────────────────────────────────────────────────────

/**
 * The `width: 260, widthUnit: "px"` trap.
 *
 * Legacy Noodl stored a dimension as a number plus a sibling `<port>Unit`
 * string, and that pairing is all over the training data — so it is what a model
 * writes when it means "260 pixels". Nothing here is loud enough to stop it:
 * `widthUnit` is not a port, so it is a mere warning, and the bare `260` is
 * explicitly *legal* (`unitsFormat` merges a bare number into the port's current
 * unit). The port's `defaultUnit` is `%`, so the node silently renders at
 * **260% wide**. That is how an authored image card became a full-bleed
 * overflowing block with a clean validation report.
 *
 * Reported as an error rather than folded into `UnknownParameter` because the
 * fix is not "drop this parameter" — dropping it leaves the 260% behind. The
 * suggestion carries the whole repair: the object form, with the unit the
 * author already told us they wanted.
 */
function unitSuffixTrap(
  catalog: CatalogIndex,
  component: string,
  node: ParameterizedNode,
  name: string,
  value: unknown,
  parameters: Record<string, unknown>
): Diagnostic | undefined {
  if (!name.endsWith('Unit') || name.length <= 4) return undefined;

  const base = name.slice(0, -4);
  const type = portTypeShape(catalog.getPort(node.type, 'input', base));
  if (!type?.units?.length) return undefined;

  const unit = String(value);
  if (!type.units.includes(unit)) return undefined;

  const paired = parameters[base];
  // Only a bare number is silently mis-united. An author who already wrote the
  // object form has the unit right and merely left a stray sibling behind —
  // that is the plain unknown-parameter warning, not this.
  if (!isNumberLike(paired)) return undefined;

  const effective = type.defaultUnit || type.units[0];
  // The unit the author asked for is the one they were going to get anyway.
  // `width: 100, widthUnit: "%"` renders at exactly 100% — the sibling is
  // redundant, not harmful, and an error here would spend a repair round
  // producing a byte-identical result.
  if (unit === effective) return undefined;

  return {
    code: DiagnosticCode.InvalidParameterValue,
    severity: 'error',
    message:
      `"${base}" is a bare number, so it is read in this port's default unit — ${JSON.stringify(
        `${paired}${effective}`
      )}, not ${JSON.stringify(`${paired}${unit}`)}. "${name}" is not a port and is ignored.`,
    location: locate(component, node, base),
    suggestion: JSON.stringify({ value: Number(paired), unit })
  };
}

// ─── The Columns layout string ───────────────────────────────────────────────

/** The three ports that take a layout string. All on the one node that reflows. */
const COLUMNS_TYPE = 'net.noodl.visual.columns';
const LAYOUT_STRING_PORTS = new Set(['layoutString', 'mediumLayout', 'smallLayout']);

/** A trailing CSS unit on an otherwise-numeric track: `1fr`, `260px`, `50%`. */
const UNIT_SUFFIXED_TRACK = /^(\d+(?:\.\d+)?)(fr|px|%|em|rem|vw|vh)$/;

/**
 * Mirrors `readLayoutToken` in the runtime
 * (`noodl-viewer-react/src/components/visual/Columns/Columns.tsx`), which is the
 * authority on this grammar. Deliberately `Number`, not `parseInt` — the
 * runtime's own docblock records that `parseInt` truncated `'1 2.5 1'` to
 * `1 2 1`, and nothing downstream assumes integers because `_calcAutofold` only
 * sums and divides. **Fractional proportions are legal**, whatever the recipes
 * say. And `Number` rather than `parseFloat`, because `parseFloat` reads a
 * *prefix* and would turn `'1abc'` into `1`.
 */
function usableTrack(token: string): boolean {
  const fraction = Number(token);
  return Number.isFinite(fraction) && fraction > 0;
}

/**
 * The `"1fr 1fr 1fr 1fr"` trap (audit F3).
 *
 * CSS Grid's dialect is what a model has seen a million times and what nothing
 * in this runtime speaks. `parseLayout` drops every token that is not a
 * positive finite number and falls back to `[1]` when nothing survives — so the
 * grid renders as ONE COLUMN at every width, on the one node in the runtime
 * that exists to reflow, and the graph looks perfect. That is the whole failure
 * mode: not a crash, not a warning, a silently correct-looking single column.
 *
 * An error rather than a warning, from day one: no legitimate population can
 * exist for a string the thing that reads it cannot parse.
 */
function layoutStringProblem(value: unknown): { message: string; suggestion?: string } | undefined {
  if (typeof value !== 'string') return undefined;

  // An empty layout string is how a breakpoint is deliberately made inert —
  // the port's own description says so — and a double space is dropped by the
  // runtime on purpose. Neither is a mistake, and a gate that disagrees with
  // `describeLayoutString` about the same string is the drift, not the fix.
  const tokens = value.split(' ').filter((token) => token !== '');
  if (tokens.length === 0) return undefined;

  const unusable = tokens.filter((token) => !usableTrack(token));
  if (unusable.length === 0) return undefined;

  // Only offer a repair when EVERY token can be recovered — stripping a unit is
  // the one transformation that provably preserves the author's ratios. A
  // partial guess would be auto-applied by an agent told never to argue with a
  // diagnostic, and would be wrong.
  const repaired = tokens.map((token) => UNIT_SUFFIXED_TRACK.exec(token)?.[1]);
  const suggestion = repaired.every((n) => n !== undefined && usableTrack(n)) ? repaired.join(' ') : undefined;

  const listed = unusable.map((token) => JSON.stringify(token)).join(', ');
  const survivors = tokens.length - unusable.length;
  const rendered = survivors === 0 ? 1 : survivors;

  return {
    message:
      `a layout string is space-separated proportions ("1 1", "2 1", "1 2.5 1"), so ${listed} ` +
      `${unusable.length === 1 ? 'is not a positive number and is' : 'are not positive numbers and are'} ` +
      `dropped — ${tokens.length} column(s) authored, ${rendered} rendered. Columns is the only node in the ` +
      'runtime that reflows, and a layout string it cannot parse silently voids that.',
    ...(suggestion ? { suggestion } : {})
  };
}

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
    // Only *runtime-unbounded* dynamism earns the skip below. The broader
    // `isDynamicNode` was exempting all 88 types that declare any dynamic ports,
    // and for 20 of them — `Text`, `Group`, `Image`, `Button`, `Text Input` and
    // the rest of the visual vocabulary — the dynamism is `declared-port-groups`,
    // whose every member is enumerable from the catalog. So the one rule that
    // catches a parameter naming no port was switched off for exactly the nodes
    // a page is built from: 18 `fontWeight` parameters across five components of
    // an authored project validated clean, and every word on the page rendered
    // at weight 400 because no node in the runtime has a `fontWeight` port.
    const dynamic = catalog.hasRuntimeDynamicPorts(node.type);
    const portGroups = catalog.declaredPortGroups(node.type);

    for (const [name, value] of Object.entries(parameters)) {
      // "Not set". `undefined` is what the editor writes for a cleared field;
      // `null` is what a model writes to mean the same thing, and it behaves
      // that way at runtime too — a null colour resolves to nothing and leaves
      // the property unset, which is exactly what it asked for. Erroring on it
      // would spend a repair round making a candidate no better.
      if (value === undefined || value === null) continue;

      const port = catalog.getPort(node.type, 'input', name);
      if (!port) {
        // Checked ahead of the dynamic-node exemption: the port it pairs with
        // must be statically declared for the trap to fire at all, and a
        // dynamic node's static ports are as static as anyone's.
        const unitTrap = unitSuffixTrap(catalog, component, node, name, value, parameters);
        if (unitTrap) {
          diagnostics.push(unitTrap);
          continue;
        }
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

      // A port switched off by a sibling parameter reads like a live one: it is
      // declared, and the value is well formed. Reported first, because "this is
      // never read" is the useful sentence — but it does **not** `continue` the
      // way `allowConnectionsOnly` does below. A connection-only port discards
      // the value whatever else the author writes, so its shape is genuinely
      // moot; here a sibling edit makes the port live, and the value has to
      // survive that edit. `Image { width: 228 }` is wrong twice over — ignored
      // today because `sizeMode` defaults to `contentSize`, and 228 *percent*
      // once `sizeMode` is fixed — and a repair round that is told only the
      // first one produces a second broken image.
      const condition = conditionForInput(portGroups, name);
      if (condition && conditionIsUnsatisfied(condition, parameters)) {
        const repair = repairForCondition(condition);
        diagnostics.push({
          code: DiagnosticCode.InactiveConditionalParameter,
          severity: 'warning',
          message: `${node.type}'s "${name}" only applies when ${describeCondition(condition)}, so this parameter is never read.`,
          location: locate(component, node, name),
          ...(repair ? { suggestion: repair } : {})
        });
      }

      // Before the value is examined at all: a connection-only port discards
      // whatever is written here, so the *shape* of the value is beside the
      // point. Checking it first also keeps the diagnostic singular — a
      // statically-set `variant` should say "this port cannot be set", not
      // "this string is not a valid string".
      if (portTypeShape(port)?.allowConnectionsOnly) {
        diagnostics.push({
          code: DiagnosticCode.ConnectionOnlyParameter,
          severity: 'error',
          message:
            `"${name}" on ${node.type} only accepts a wired connection, so this value is discarded and the ` +
            'node renders as if it were never set.' +
            (name === 'variant'
              ? ' Set the concrete style parameters the variant implies instead — the STYLE VOCABULARY ' +
                'lists them for every variant.'
              : ' Drive it with a connection, or set the concrete parameters it would have applied.'),
          location: locate(component, node, name)
        });
        continue;
      }

      // A bare number on a port that is read as a percentage. Skipped when a
      // `<name>Unit` sibling is present: `unitSuffixTrap` already owns that
      // case and says something sharper about it, and one mistake should not
      // draw two diagnostics.
      const shape = portTypeShape(port);
      if (
        shape?.units?.length &&
        (shape.defaultUnit || shape.units[0]) === '%' &&
        isNumberLike(value) &&
        parameters[`${name}Unit`] === undefined
      ) {
        diagnostics.push({
          code: DiagnosticCode.UnitlessDimension,
          severity: 'warning',
          message:
            `"${name}" is a bare number, so it renders at ${JSON.stringify(`${value}%`)} — this port is read ` +
            'as a percentage. Write the object form to say which unit you mean.',
          location: locate(component, node, name),
          // Alternatives rather than a suggestion: `width: 100` meaning 100% is
          // as likely as `width: 228` meaning 228px, and the agent is told never
          // to argue with a diagnostic — so a confident guess here would be
          // auto-applied and would be wrong half the time.
          alternatives: [
            JSON.stringify({ value: Number(value), unit: 'px' }),
            JSON.stringify({ value: Number(value), unit: '%' })
          ]
        });
        continue;
      }

      // LAS-003/F3 — before the generic format check, because `layoutString` is
      // typed `string` and every string passes that. The constraint is the
      // node's, not the port type's, so it cannot live in the FORMATS table.
      if (node.type === COLUMNS_TYPE && LAYOUT_STRING_PORTS.has(name)) {
        const layout = layoutStringProblem(value);
        if (layout) {
          diagnostics.push({
            code: DiagnosticCode.InvalidParameterValue,
            severity: 'error',
            message: `"${name}" — ${layout.message}`,
            location: locate(component, node, name),
            ...(layout.suggestion !== undefined ? { suggestion: layout.suggestion } : {})
          });
          continue;
        }
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
