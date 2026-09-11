import { describeValue } from '@noodl/runtime/src/diagnostics';

/**
 * FB-019 AC3 — what an `icon` port should say about a value it cannot draw.
 *
 * ## The defect, measured rather than predicted (2026-08-23)
 *
 * A plain string **cannot legally connect** to an icon port: the cast table has no row whose
 * `to` contains `icon` (0 of 16, read live off `NodeLibrary.instance.library.typecasts`), so
 * `string -> icon` is refused with a `con-type-mismatch` error. The one route that gets through
 * is a `*` output — Function, Object — because `canCastPortTypes` short-circuits on `*` before
 * the table is consulted.
 *
 * Driven end to end on a three-arm fixture, the same node type in all three:
 *
 * | arm | `iconIconSource` | rendered |
 * |---|---|---|
 * | A | the string `'account_circle'`, via a Function's `*` output | `<span class="" style="font-size:40px"></span>` |
 * | B | `{class:'material-icons', code:'account_circle'}` (the picker's own value) | the glyph |
 * | C | never set | **no span at all** |
 *
 * Arm C is the one that makes arm A a defect rather than a non-event: a value the renderer
 * cannot use does not fall back to "nothing", it produces an **empty, styled span** that still
 * takes its `iconSize` in layout. Nothing was logged, no warning was raised, and the editor's
 * connection health had nothing to say — `unconvertedCast` returns `null` for a `*` source by
 * design, because a wire out of an undeclared output is not evidence of anything.
 *
 * ## Why this reports instead of coercing
 *
 * The obvious kindness — treat a string as `{codeAsClass: true, class: s}` — cannot be made
 * correct. `iconValueForGlyph` (`shared/utils/iconsets.ts`) builds a glyph's value from **the
 * set's manifest**: `class` is the set's `iconClass` and `codeAsClass` is the set's flag; only
 * `code` comes from the glyph name. A bare string carries the glyph name and nothing else, so
 * any coercion has to guess which installed set it belongs to — and the two shipped conventions
 * want opposite fields. Material Icons needs `{class:'material-icons', code:'account_circle'}`;
 * a class-per-glyph set needs the name in `class`/`code` as classes. Guessing wrong renders a
 * blank glyph *again*, having reported success. That is a worse defect than this one, because
 * it looks handled.
 *
 * So the port says what it got and what it wants, and draws nothing — which is what arm C
 * already does, and is honest about.
 */

/** Keys that identify a value as one of the three `Noodl.Icon` shapes. */
const ICON_KEYS = ['class', 'code', 'kind'] as const;

/**
 * One sentence naming what arrived at an icon port and what it needs, or `null` when the value
 * is drawable — or absent, which is not a problem but an unset port.
 *
 * ⚠️ Deliberately narrow. Every legal member of the union carries at least one of {@link
 * ICON_KEYS}, so this cannot refuse a value the renderer would have drawn; it catches the
 * primitives (the reported defect) and the object that has none of the union's fields, which
 * reaches `IconGlyph` and produces the same empty span.
 *
 * Provably inert for what ships: of the 76 `iconIconSource` parameters across the 97
 * `project.json` files in this repository — prefabs, lesson bundles, templates — all 76 are
 * accepted. ⚠️ That bound is *parameters*; a value arriving over a wire cannot be swept
 * statically, and is exactly the population this check exists for.
 */
export function iconSourceProblem(value: unknown, displayName = 'This icon input'): string | null {
  if (value === undefined || value === null) return null;

  if (typeof value === 'object' && !Array.isArray(value)) {
    const hasKey = ICON_KEYS.some((k) => k in (value as Record<string, unknown>));
    if (hasKey) return null;
  }

  return (
    `${displayName} expects an icon, received ${describeValue(value)}. ` +
    'Nothing will be drawn — pick the glyph with the icon picker, or wire an object of the ' +
    'shape {class, code} (for example {"class":"material-icons","code":"search"}); the class ' +
    'comes from the installed icon set, so a bare name cannot be turned into one.'
  );
}
