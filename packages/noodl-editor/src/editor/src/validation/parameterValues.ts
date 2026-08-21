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
import { SkippedCheck, unknownTypeSkip } from './unknownTypeSkip';
import { isExpressionParameter } from '../models/ExpressionParameter';

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
  '- color/font/textStyle/image/component take a NAME (a token, a project style, or a component path).',
  '- Function node (JavaScriptFunction) ports are PREFIXED and its script names are not. `Inputs.x` is the',
  '  port "in-x", `Outputs.y` (and `Outputs.y()`) is the port "out-y"; the panel shows the bare name as a',
  '  display label only. Wire toProperty:"in-x" / fromProperty:"out-y". Its declared ports — run, done,',
  '  success, failure, completed, unchanged, error — stay unprefixed, and the Script node (Javascript2)',
  '  does not prefix at all.'
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

/**
 * DSG-004 §2.2 — the three ports `sizeMode` switches off, and the reason they
 * get a code of their own.
 *
 * `InactiveConditionalParameter` is one code over a wide population: 366 corpus
 * hits, most of them a `borderWidth` with no `borderStyle` or a `showScrollbar`
 * with scrolling off. Severity policy in `AUTHORED_BLOCKING_WARNINGS` is per
 * *code*, so a promotion decision about the 58 hits doctrine `§8` names —
 * *"`width`/`height`/`objectFit` are INERT unless `sizeMode: "explicit"`. A
 * `width: 100%` input that renders 170px wide is this, every time."* — cannot be
 * made without separating them.
 *
 * Keyed on the condition rather than on the node type, because the trap is
 * declared by `addDimensions` in `node-shared-port-definitions.ts` and inherited
 * by every visual type that calls it — including whichever type is added next.
 */
const SIZE_GATED_PORTS: ReadonlySet<string> = new Set(['width', 'height', 'objectFit']);

function isSizeModeGated(portName: string, condition: string): boolean {
  return SIZE_GATED_PORTS.has(portName) && /\bsizeMode\b/.test(condition);
}

/**
 * The mode that makes the port live, phrased as the edit that gets it: the
 * repair for `width` is `contentHeight` as much as `explicit`, and saying
 * "explicit" when the author wanted the height from the content is advice that
 * costs a second round.
 */
function sizeModeExit(portName: string): string {
  if (portName === 'objectFit') return 'Set sizeMode: "explicit" on this node — objectFit is read in no other mode.';
  const keeping = portName === 'width' ? 'contentHeight' : 'contentWidth';
  return (
    `Set sizeMode: "explicit" on this node to use both dimensions as given, or ${JSON.stringify(keeping)} to ` +
    `keep sizing the other axis to the content while this ${portName} applies.`
  );
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
 * A colour written as a literal rather than as a token. Anchored, so a
 * `var(--primary)` string — which is what the system wants — never matches, and
 * neither does a named colour like `transparent` (legitimate, and no token
 * replaces it).
 */
const RAW_COLOR = /^\s*(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/;

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

// ─── The unsized absolute box ────────────────────────────────────────────────

/**
 * Parameters that mean "this box is drawn", not merely "this box positions
 * something". An absolute Group with no paint is a layout device; one with a
 * background or a border is a *thing on the page*, and a thing on the page that
 * silently becomes parent-sized is the defect.
 */
const DECORATION = ['backgroundColor', 'borderColor', 'borderRadius', 'boxShadowColor', 'borderStyle'];

/** Set to anything at all — a `var()` string, a `{value,unit}`, a number. */
function parameterIsSet(parameters: Record<string, unknown>, name: string): boolean {
  const value = parameters[name];
  return value !== undefined && value !== null && value !== '';
}

/**
 * The badge-pill trap (audit F7).
 *
 * `width` and `height` are `dimension` ports declaring `default: 100` with
 * `defaultUnit: '%'`. A box taken out of flow with `position: absolute` and
 * given no dimensions is therefore **100% × 100% of its parent**. In flow that
 * is invisible, because the parent's layout sizes it; out of flow nothing does,
 * and the box quietly becomes its parent. Sonnet's cold replay authored a badge
 * this way: a `--primary` ellipse over four of six product photos, and a basket
 * count stretched across the whole navbar, under a clean report.
 *
 * ⚠️ **The decoration half of the predicate is the whole calibration**, measured
 * across the corpus before the severity was chosen:
 *
 * | Predicate | Hits |
 * |---|---|
 * | `absolute` + no `width` + no `height` | **151** |
 * | …carrying no decoration | 122 |
 * | …carrying decoration | **29** (21 of them editor test fixtures) |
 *
 * The 122 are not defects — a full-bleed absolute box IS the overlay/scrim
 * pattern, authored on purpose — and reporting them would cost a repair round
 * each time, the expensive failure here because diagnostics feed an automated
 * repair and the agent is told never to argue with one.
 *
 * A **warning**, not authored-blocking: `popup-modal` in the shipped prefab
 * library is a decorated full-bleed scrim, this exact shape on purpose.
 * Promotion is the kind of decision LAS-004 exists to make, with its own
 * evidence.
 *
 * A node-level check rather than a per-parameter one — the defect is the
 * *combination*, and no single parameter is wrong on its own. It lives here
 * rather than in `rules/` because values are this module's business.
 *
 * ⚠️ The reason recorded here used to be stronger — *"for a reason the type
 * system enforces: `NormNode` carries no `parameters` at all, because the
 * normalized model is structural"* — and **D13 ended that on 2026-08-18**: the
 * normalized model carries parameters and `rules/parameterValue` runs this whole
 * module from the CLI gate, this check included. The placement is now a
 * preference, not a constraint.
 */
function unsizedAbsoluteBox(
  component: string,
  node: ParameterizedNode,
  parameters: Record<string, unknown>
): Diagnostic | undefined {
  if (parameters.position !== 'absolute') return undefined;
  if (parameterIsSet(parameters, 'width') || parameterIsSet(parameters, 'height')) return undefined;

  const decoration = DECORATION.filter((name) => parameterIsSet(parameters, name));
  if (decoration.length === 0) return undefined;

  return {
    code: DiagnosticCode.UnsizedAbsoluteBox,
    severity: 'warning',
    message:
      `this ${node.type} is "position": "absolute" with no width or height, and both default to 100% — so it ` +
      `fills its parent instead of sizing to itself, and its ${decoration.join('/')} is painted across the ` +
      'whole of it. Give it a width and a height, or put it back in flow.',
    location: {
      component,
      nodeId: node.id,
      nodeType: node.type,
      ...(node.label ? { nodeLabel: node.label } : {})
    }
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
    if (!parameters) continue; // nothing set — nothing to check, and nothing skipped
    if (!catalog.hasType(node.type)) {
      // CN-002 — this is the biggest of the three silent skips: not one check
      // on one endpoint but *every* parameter on the node. On
      // `cashflow-command-centre` that was 26 parameters across five kit nodes,
      // reported as a clean pass. Say that the check did not run.
      diagnostics.push(
        unknownTypeSkip({
          component,
          nodeId: node.id,
          nodeType: node.type,
          nodeLabel: node.label,
          check: SkippedCheck.ParameterValues
        })
      );
      continue;
    }
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
    /**
     * CN-010 / AC2 — the parameters this node's carve-out is about to skip.
     *
     * Collected rather than reported inline so that one node yields one notice
     * naming all of them, which is CN-002's rule: four unverified parameters on
     * one node are one fact about that node.
     */
    const dynamicSkips: string[] = [];

    // LAS-003/F7 — node-level, because the defect is the combination of
    // parameters and no single one of them is wrong on its own.
    const unsized = unsizedAbsoluteBox(component, node, parameters);
    if (unsized) diagnostics.push(unsized);

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
        if (!reportUnknownParameters) continue;
        if (dynamic) {
          // CN-010 / AC2 — say so. This was a bare `continue`, and it is the
          // last silent skip of the three CN-002 found: the type resolves, the
          // node is fine, and the parameter is simply unverified. Measured over
          // the 29 projects in `NodeGX test projects`: **947 set parameters
          // across 321 nodes** reach this line, 6% of every parameter in them,
          // reported as a clean pass.
          //
          // ⚠️ The reason differs from `unknownTypeSkip`'s and the wording must
          // not be borrowed: that one says *"type X is not in the node catalog"*,
          // which is **false** here — the type is known, and for a kit node
          // CN-003 worked to make it known. Saying it would teach a kit author
          // that their node is unrecognised at the exact moment it is not.
          if (!isPageDeclarationGap(node.type, name)) dynamicSkips.push(name);
          continue;
        }
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
        // DSG-004 §2.2 — the `sizeMode` family is reported under its own code so
        // that it can block authored output while the wider population stays a
        // warning, and so that the message can carry the exit rather than only
        // the diagnosis. One diagnostic either way: the two codes are exclusive.
        const sizeGated = isSizeModeGated(name, condition);
        const repair = repairForCondition(condition);
        diagnostics.push(
          sizeGated
            ? {
                code: DiagnosticCode.InertDimension,
                severity: 'warning',
                message:
                  `${node.type}'s "${name}" is inert here: it only applies when ${describeCondition(condition)}, ` +
                  `and this node sizes itself to its content instead, so the value is never read. ${sizeModeExit(name)}`,
                location: locate(component, node, name),
                suggestion: 'sizeMode: "explicit"'
              }
            : {
                code: DiagnosticCode.InactiveConditionalParameter,
                severity: 'warning',
                message: `${node.type}'s "${name}" only applies when ${describeCondition(condition)}, so this parameter is never read.`,
                location: locate(component, node, name),
                ...(repair ? { suggestion: repair } : {})
              }
        );
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

      // SUB-011 — an inline `fx` expression is a **shipped** parameter form:
      // the toggle stores `{mode: 'expression', expression, fallback, version}`
      // on a port still typed `string`/`number`, and the typed runtime
      // evaluates it and coerces the result to the port's type
      // (`noodl-runtime/src/node.ts`). So the stored object's shape is beside
      // the point here in exactly the way a connection-only port's is above —
      // checking it against the port's primitive shape reports every working
      // expression in the project as a defect.
      //
      // 🔴 This is the carve-out SUB-011 predicted on 2026-07-24, before the
      // check existed: *"if it ever grows parameter/type checking, the object
      // form reads as invalid without an explicit carve-out (the same shape as
      // the existing dynamic-port carve-outs)"*. D13 grew exactly that on
      // 2026-08-18 by registering `rules/parameterValue`, and the corpus
      // fixture went from silent to 5 errors + 9 warnings. The guard is
      // `ExpressionParameter.ts`'s own, reused rather than reimplemented,
      // because that task says to reuse it.
      //
      // ⚠️ The port-existence check above deliberately runs FIRST and keeps its
      // diagnostic: an expression written on a port that does not exist is
      // still never read, and that is the more useful sentence.
      if (isExpressionParameter(value)) continue;

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

      // LAS-003/3 — a raw colour literal where a token is what the system
      // expects. A warning, never an error: the corpus carries 553 of these and
      // imported content is not wrong for being untokenised, it is just
      // untokenised. Warnings do not block `validate:project`.
      if (CatalogIndex.portTypeName(port) === 'color' && RAW_COLOR.test(String(value))) {
        diagnostics.push({
          code: DiagnosticCode.RawColorLiteral,
          severity: 'warning',
          message:
            `"${name}" is the literal ${JSON.stringify(value)}. Colours come from the project's design tokens — ` +
            'write "var(--token)" so the page can be re-themed and stays consistent with the identity the ' +
            'project already decided. get_style_vocabulary lists the token names that resolve.',
          location: locate(component, node, name)
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

    // CN-010 / AC2 — one notice per node, after its parameters are known.
    //
    // `info`, and that is load-bearing: these parameters are overwhelmingly
    // correct. A `NavigationShowPopup` really does take the target component's
    // inputs as ports, and 315 of the 947 measured skips are exactly that. The
    // statement being made is about the *checker*, not the graph.
    if (dynamicSkips.length > 0) {
      const named = dynamicSkips.map((n) => `"${n}"`).join(', ');
      // All 88 shipped descriptions end in punctuation and so does the kit
      // wording, but `dynamicPortNote`'s own fallback — `ports are
      // runtime-determined (...)` — does not, and that is the branch a kit with
      // an unrecognised entry shape lands on.
      const rawNote = catalog.dynamicPortNote(node.type) ?? 'this node determines ports at runtime';
      const note = /[.!?]$/.test(rawNote.trim()) ? rawNote.trim() : `${rawNote.trim()}.`;
      diagnostics.push({
        code: DiagnosticCode.DynamicPortSkipped,
        severity: 'info',
        message:
          `${dynamicSkips.length === 1 ? 'Parameter' : 'Parameters'} ${named} on ${node.type} ` +
          `${dynamicSkips.length === 1 ? 'names' : 'name'} no port the catalog can see, and ` +
          `${dynamicSkips.length === 1 ? 'it was' : 'they were'} not checked: ` +
          note +
          ' So this node is unverified by that check rather than verified as correct.',
        location: {
          component,
          nodeId: node.id,
          nodeType: node.type,
          ...(node.label ? { nodeLabel: node.label } : {})
        }
      });
    }
  }

  return diagnostics;
}

/**
 * ✅ **D16 — the two fields on `Page` that are a declaration gap, not a finding.**
 *
 * `Page` is `runtime-discovered`, and it declares **neither `title` nor
 * `urlPath`** as a static port: they are registered per instance by the router.
 * So the two most commonly set parameters on the most commonly written node in
 * the product reach the carve-out, and **96 of the 947 measured skips are
 * `Page`** — every page in every project carries at least one.
 *
 * The notice is a true statement about the checker, but here it describes one
 * shipped type's missing declaration rather than anything about the graph, and
 * it fires on work that is completely correct.
 *
 * 🔴 **Narrow to these two names on purpose, and this is the binding half of the
 * ruling.** Richard's recorded worry is the effect on LLM page authoring, and
 * suppressing the *node type* wholesale is exactly what would cause it: a model
 * that invents `pageTitle` or `path` on a `Page` would get silence where it
 * needs the notice. Everything except these two names still reports.
 *
 * ⚠️ **The honest fix is to declare the ports on `Page`**, at which point this
 * function has no population and should be deleted rather than left. It is here
 * because that is a runtime change to a shipped type and this is a validation
 * ruling.
 */
const PAGE_UNDECLARED_PORTS = new Set(['title', 'urlPath']);

function isPageDeclarationGap(nodeType: string, parameterName: string): boolean {
  return nodeType === 'Page' && PAGE_UNDECLARED_PORTS.has(parameterName);
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
