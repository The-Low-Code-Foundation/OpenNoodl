/**
 * FB-019 scope (3) — *"what do I feed this port?"*, answered at the port.
 *
 * ## The complaint this exists for
 *
 * > *"Some ports are a bit tricky and look like they should take a number input, but they
 * > actually need like a JSON input? … the node width or something, you have to input a JSON
 * > with a number and the px/vw value in the body."*
 *
 * Two sessions of driving reduced FB-019 to this one thing. The runtime failures the task was
 * filed around turned out not to fire: a bare number wired into a never-set `Width` **does**
 * render, and so does one wired into `Pos X`. What is real is the asymmetry underneath the
 * report, and it is a legibility defect rather than a runtime one:
 *
 * | wire | port | renders |
 * |---|---|---|
 * | `300` | `Padding Left` | `300px` |
 * | `300` | `Width` | **`300%`** |
 *
 * Same node, same wire, same number. They differ because `defaultUnit` is `px` on one and `%`
 * on the other, and **nothing in the editor said so**. This module is the sentence that does.
 *
 * ## Why the landing unit is computed and not looked up
 *
 * A wire cannot carry a unit — `Node.setInputValue` merges a bare number into whatever
 * `{value, unit}` the port is already holding (`node.ts:372-390`, and the comment there says
 * why). So the unit a plain number lands in is a property of the **port and its current
 * value**, not of the type:
 *
 *  1. an author who has set a unit in the property panel gets that unit, always;
 *  2. otherwise `initializeDefaultValues` (`nodedefinition.ts:161-180`) has seeded
 *     `{unit: type.defaultUnit, value: default}` — but **only for a port that declares a
 *     `default`**, because it returns early when there is none.
 *
 * 🔴 **Case 3 — a `defaultUnit` with no `default` — is deliberately left unstated**, and that
 * is the whole reason this is a function rather than a template. 14 of the 104 units-typed
 * declarations in the viewer are in it, and they do not agree with each other: the `inputCss`
 * ports among them (margins, min/max sizes, `fontSize`) are coerced to `defaultUnit` a second
 * time by `react-component-node.ts:1925`, while `Columns`' two breakpoint ports are on
 * `inputProps`, where a value with no `.value` field is **deleted**
 * (`react-component-node.ts:635`). Which of the two a port is on is not exported to the editor
 * at all, so a sentence naming a unit here would be right about twelve ports and wrong about
 * two. It says the shape and stops.
 *
 * ⚠️ And this is why the copy may not simply be inherited from
 * {@link ../../validation/parameterValues WIRE_FORMAT_LEGEND}, which the task suggested reusing.
 * That legend tells the AI author *"a bare number means the FIRST unit listed for it"*. The
 * first unit listed and `defaultUnit` **disagree on 6 declarations** — `transformOriginX` and
 * `transformOriginY` list `['px', '%']` and default to `%`; the deprecated Checkbox and Radio
 * width/height ports list `['%', 'px', …]` and default to `px`. The runtime reads `defaultUnit`
 * (`nodedefinition.ts:171`), so the legend is wrong on those six and this uses `defaultUnit`.
 *
 * ## Why import-free, and why one module for two surfaces
 *
 * The same reasoning `portConnectivity.ts` next door records: the connection popup and the
 * Ports tab are two lists built from one `getPorts()` call that have twice drifted into saying
 * different things about the same port. Nothing here imports the editor, so
 * `tests-unit/property-editor/portWireShape.test.ts` grades the wording itself in the plain-Node
 * runner.
 *
 * ⚠️ The icon sentence overlaps `iconSourceProblem.ts` in the viewer — the warning FB-019 AC3
 * added, which is what an author sees *after* wiring the wrong thing. This is what they see
 * *before*. They name the same shape and the same reason on purpose, and a test pins the
 * overlap, because two half-matching explanations of one union is the drift `portCopy.ts` was
 * written to prevent.
 *
 * ## What is deliberately not here
 *
 * - **`pages`** (1 declaration, the Router's). Its property row is a bespoke page-tree editor;
 *   there is no shape an author types, so a sentence would be vocabulary for its own sake.
 * - **`dimension`'s third field.** The panel stores `{value, unit, isFixed}` and the viewer
 *   reads `isFixed` for `fixedWidth` (`layout.ts:85`), but it only changes anything for a
 *   percentage inside a row or column, and the merge preserves it across a bare-number wire
 *   anyway. It is a paragraph, not a clause, and it is not what anybody asked.
 */

import type { PortLike, PortTypeLike, PortTypeObject } from './portConnectivity';

/** A port type carrying units, as declared by the runtime. */
interface UnitsPortType extends PortTypeObject {
  units?: unknown;
  defaultUnit?: unknown;
}

/**
 * What a port takes, as a shape and a sentence.
 *
 * Two fields rather than one string because the two surfaces set them
 * differently: the Ports tab renders `shape` in code voice on its own line, the
 * hover explainer runs them together.
 */
export interface PortWireShape {
  /** The shape itself, e.g. `{value, unit}`. Code voice — never a sentence. */
  shape: string;
  /** One or two sentences of plain text. No markup: both call sites escape. */
  body: string;
}

/** A port row, plus the two fields {@link portWireShape} needs that `PortLike` does not name. */
export interface WireShapePort extends Partial<PortLike> {
  type?: PortTypeLike;
  /** The declared default, as exported by `nodelibraryexport.ts:178`. */
  default?: unknown;
}

function typeObject(type: PortTypeLike): UnitsPortType | undefined {
  return type && typeof type === 'object' ? (type as UnitsPortType) : undefined;
}

/** The type's name, lower-cased. Mirrors `NodeLibrary.nameForPortType` without importing it. */
function typeName(type: PortTypeLike): string | undefined {
  if (!type) return undefined;
  const name = typeof type === 'string' ? type : (type as PortTypeObject).name;
  return typeof name === 'string' && name.length ? name.toLowerCase() : undefined;
}

/** The declared units, as strings, or an empty list. */
function unitsOf(type: PortTypeLike): string[] {
  const units = typeObject(type)?.units;
  return Array.isArray(units) ? units.filter((u): u is string => typeof u === 'string' && u.length > 0) : [];
}

/** True for the family this module's units sentence is about: `dimension`, or `number` with units. */
export function isUnitsPortType(type: PortTypeLike): boolean {
  const name = typeName(type);
  if (name === 'dimension') return true;
  return name === 'number' && unitsOf(type).length > 0;
}

/**
 * The unit a port is in when nothing has been stored on it — what the editor should *show*.
 *
 * ⚠️ Not the same question as {@link landingUnit}, and the difference is the point. This is
 * "what unit is this port in", which the property panel and the popup's name annotation have
 * always answered with `defaultUnit`; {@link landingUnit} is "what unit will a bare number off a
 * wire land in", which additionally needs the port to declare a `default` for the runtime to
 * have seeded one. This one may fall back to the first declared unit because a port with units
 * and no `defaultUnit` still has to be displayed as something — there are five such
 * declarations, all in the transition nodes and `Columns`.
 */
export function declaredUnit(type: PortTypeLike): string | undefined {
  const declared = typeObject(type)?.defaultUnit;
  if (typeof declared === 'string' && declared.length > 0) return declared;
  return unitsOf(type)[0];
}

/**
 * The unit a plain number arriving over a wire will land in, or `undefined` when the editor
 * cannot know.
 *
 * `storedValue` is the port's current parameter — `node.parameters[portName]` — which is where
 * an author's own choice of unit lives. See this module's header for why the no-`default` case
 * returns `undefined` rather than guessing `defaultUnit`.
 */
export function landingUnit(port: WireShapePort | undefined, storedValue?: unknown): string | undefined {
  if (!port || !isUnitsPortType(port.type)) return undefined;

  // 1. What the author set here. `setInputValue` copies this object and overwrites `.value`,
  //    so the unit survives every bare number that arrives afterwards.
  if (storedValue && typeof storedValue === 'object' && !Array.isArray(storedValue)) {
    const unit = (storedValue as { unit?: unknown }).unit;
    if (typeof unit === 'string' && unit.length > 0) return unit;
  }

  // 2. The seeded default. Both halves are required: no `default` means
  //    `initializeDefaultValues` returned early and nothing was seeded at all.
  const declared = typeObject(port.type)?.defaultUnit;
  if (typeof declared === 'string' && declared.length > 0 && port.default !== undefined) return declared;

  return undefined;
}

function unitsSentence(port: WireShapePort, storedValue: unknown): PortWireShape {
  const units = unitsOf(port.type);
  const unit = landingUnit(port, storedValue);

  const parts: string[] = [];
  if (units.length > 0) parts.push(`Units: ${units.join(', ')}.`);

  if (unit) {
    // The concrete case, and the one Richard hit. A number is used rather than a placeholder
    // because "lands in this port's unit" is the same sentence he already could not predict.
    parts.push(`A wire carries the number only, so a plain 300 lands here as 300${unit}.`);
  } else {
    parts.push('A wire carries the number only — the unit comes from this port, not from the wire.');
  }

  // Second on the list of likely mistakes, and the quietest: `isNaN('300px')` is true, so the
  // merge does not fire and a value with no `.value` field is dropped by both setters.
  parts.push('A text value like "300px" is not the same thing and is dropped silently.');

  return { shape: '{value, unit}', body: parts.join(' ') };
}

/**
 * What this port takes, for the structured types where the answer is not the type's own name.
 *
 * `undefined` for every ordinary port — a `string` port takes a string, and a line saying so on
 * all 1,600 of them is how a surface stops being read.
 */
export function portWireShape(port: WireShapePort | undefined, storedValue?: unknown): PortWireShape | undefined {
  if (!port) return undefined;

  if (isUnitsPortType(port.type)) return unitsSentence(port, storedValue);

  switch (typeName(port.type)) {
    case 'icon':
      return {
        shape: '{class, code}',
        body:
          'Pick the glyph with the icon picker. Over a wire it has to be an object, for example ' +
          '{"class":"material-icons","code":"search"} — the class comes from the installed icon set, ' +
          'so a bare name cannot be turned into one and nothing is drawn.'
      };

    case 'stringlist':
      // The trap this type's own name argues for. Every one of the 32 declarations is
      // `allowEditOnly`, so it is only ever read in the Ports tab — the popup never lists one.
      return {
        shape: 'a comma-separated string',
        body: 'One string with commas in it, like "id,slug" — not a list of separate values.'
      };

    case 'proplist':
      return {
        shape: '{label, value} rows',
        body: 'A list of rows, each naming one value.'
      };

    default:
      return undefined;
  }
}
