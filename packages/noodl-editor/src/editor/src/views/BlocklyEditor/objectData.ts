/**
 * FIX-004 §C — objects as data: the expressions, in one import-free place.
 *
 * Its own module for `convertModes.ts`'s reason: the block definitions need the dropdown
 * options and the tooltips, the generators need the expressions, and a table split across
 * those two files is a table that drifts. Nothing here imports Blockly, so `tests-unit` can
 * grade every string directly.
 *
 * ## The gap this closes
 *
 * The Logic Builder could reach *into* an object at a name it knew when the program was
 * written (`noodl_get_object_property` holds the field in a text field, so the key is baked
 * into the generated code) and it could do nothing else. It could not make an object, could
 * not compute a key, could not ask what keys an object has — `controls_forEach` takes lists
 * only, so **an object could not be iterated at all** — and could not cross the JSON boundary
 * a backend or a `fetch` puts values on the other side of.
 *
 * ## 🔴 The one measured trap: `in` is inverted on a Noodl Object
 *
 * `Noodl.Objects[id]` is not a plain object. Both runtimes hand back a **Model proxy**
 * (`model.ts` `_modelProxyHandler`; browser `noodl-js-api.ts:67`, cloud
 * `noodl-js-api.js:27`), and that handler implements `get`, `set`, `ownKeys` and
 * `getOwnPropertyDescriptor` — but **not `has`**. So `key in object` falls through to
 * `Reflect.has` on the *instance*, whose own properties are the model's internals. Measured
 * on a Model carrying `{title, count}`:
 *
 * | expression | answer |
 * |---|---|
 * | `Object.keys(o)` | `['title','count']` ✅ |
 * | `Object.values(o)` | `['hello',3]` ✅ |
 * | `o['title']` | `'hello'` ✅ |
 * | `Object.prototype.hasOwnProperty.call(o,'title')` | `true` ✅ |
 * | **`'title' in o`** | **`false`** 🔴 |
 * | **`'data' in o`** | **`true`** 🔴 |
 *
 * Exactly inverted: false for every key the author put there, true for the plumbing. So
 * {@link objectHasPropertyExpression} emits `hasOwnProperty.call`, and it is not a style
 * preference — `in` would produce a block that answers "no" about every Noodl Object.
 *
 * ⚠️ **`JSON.stringify` of a Noodl Object adds an `id` key**, because `Model.prototype.toJSON`
 * returns `Object.assign({}, this.data, { id: this.id })`. A round trip through JSON therefore
 * does not give back what went in. Stated in the block's tooltip rather than worked around:
 * the id is genuinely part of that record's identity, and hiding it would surprise the other
 * way.
 *
 * @module BlocklyEditor
 */

/** The dropdown value stored on the members block. Never change these — saved programs hold them. */
export type ObjectMembersMode = 'KEYS' | 'VALUES';

interface ObjectMembersSpec {
  /** The dropdown label. Plain words, as in `convertModes.ts`. */
  label: string;
  /** Builds the expression from an already-parenthesised argument. */
  expression: (object: string) => string;
  /** Hover text, so the block explains what it is for rather than naming a JavaScript call. */
  tooltip: string;
}

/**
 * The two modes, in dropdown order.
 *
 * ⚠️ **`Object.entries` is deliberately absent.** It yields an array of two-element arrays,
 * and a block language with no destructuring can only take those apart with
 * `lists_getIndex`-of-`lists_getIndex` — which is harder to read than the thing it replaces.
 * `keys` plus `get property ( ) of object ( )` walks keys *and* values in two blocks that both
 * say what they do, so entries would add a rope without adding reach.
 */
const MEMBERS: Readonly<Record<ObjectMembersMode, ObjectMembersSpec>> = Object.freeze({
  KEYS: {
    label: 'the property names',
    expression: (o) => `Object.keys(${o})`,
    tooltip: 'A list of the property names in an object — feed it to a For each block to walk them.'
  },
  VALUES: {
    label: 'the values',
    expression: (o) => `Object.values(${o})`,
    tooltip: 'A list of the values in an object, without their names.'
  }
});

/** The mode a freshly-dragged block starts in — names are what you iterate to reach values. */
export const DEFAULT_OBJECT_MEMBERS_MODE: ObjectMembersMode = 'KEYS';

/** `[label, value]` pairs in dropdown order, the shape `Blockly.FieldDropdown` takes. */
export function objectMembersOptions(): [string, string][] {
  return (Object.keys(MEMBERS) as ObjectMembersMode[]).map((mode) => [MEMBERS[mode].label, mode]);
}

/**
 * The JavaScript for a mode applied to `object`.
 *
 * An unrecognised mode falls back to the default rather than to nothing, for
 * `convertModeExpression`'s reason: it can only come from a hand-edited or future-versioned
 * program, and emitting a valid expression keeps that program running.
 */
export function objectMembersExpression(mode: string | null | undefined, object: string): string {
  return (MEMBERS[mode as ObjectMembersMode] ?? MEMBERS[DEFAULT_OBJECT_MEMBERS_MODE]).expression(object);
}

/** Tooltip text for a mode. */
export function objectMembersTooltip(mode: string | null | undefined): string {
  return (MEMBERS[mode as ObjectMembersMode] ?? MEMBERS[DEFAULT_OBJECT_MEMBERS_MODE]).tooltip;
}

/**
 * `has property` — 🔴 **`hasOwnProperty.call`, never `in`.** See the module note: the Model
 * proxy has no `has` trap, so `in` answers `false` for every property a Noodl Object actually
 * carries and `true` for its internals.
 *
 * `Object.prototype.hasOwnProperty.call(o, k)` rather than `o.hasOwnProperty(k)` because the
 * latter is a property *read* on the object under test: on a Model proxy it resolves through
 * the `get` trap, and on a `JSON.parse`d object with a `"hasOwnProperty"` key it resolves to
 * the author's data. The `.call` form asks the language, not the value.
 */
export function objectHasPropertyExpression(object: string, key: string): string {
  return `Object.prototype.hasOwnProperty.call(${object}, ${key})`;
}

/**
 * An empty object — 🔴 **parenthesised, and that is not cosmetic.**
 *
 * `noodl_set_object_property_expr` generates `<object>[<key>] = <value>;` at the start of a
 * line. With a bare `{}` in the object socket that statement begins with `{`, which JavaScript
 * parses as a **block**, not an object literal — the program then fails to compile with a
 * message about the assignment rather than about the block the author dropped. `({})` is the
 * same value in every context and cannot be misread, so the block emits it always rather than
 * depending on where it happens to be plugged.
 */
export const NEW_OBJECT_EXPRESSION = '({})';

/** `JSON.parse` — throws on malformed text, deliberately. See {@link JSON_PARSE_TOOLTIP}. */
export function jsonParseExpression(text: string): string {
  return `JSON.parse(${text})`;
}

/** `JSON.stringify`. */
export function jsonStringifyExpression(value: string): string {
  return `JSON.stringify(${value})`;
}

/**
 * ⚠️ **A malformed string makes this throw, and the throw is left to propagate.**
 *
 * That is the correct direction here and it was checked rather than assumed:
 * `logic-builder.ts` wraps the whole compiled call in a try/catch that ends in
 * `_fail('logic-builder/blocks-threw', …)`, which lights the node's `error` output, fires
 * `Failure`, and raises a runtime error the editor draws. So a bad JSON string is reported by
 * name on three channels. Catching it here and returning `null` instead would turn a visible
 * failure into an empty object, which is the shape this codebase has twice had to revert.
 */
export const JSON_PARSE_TOOLTIP =
  'Turns JSON text into an object or a list. If the text is not valid JSON the node fails and says so.';

/** ⚠️ A Noodl Object stringifies with its `id` added — `Model.prototype.toJSON`. */
export const JSON_STRINGIFY_TOOLTIP =
  'Turns an object or a list into JSON text. An App Object also carries its id into the text.';
