/**
 * CMP-008: Import Engine v2 — the tokens the target cannot resolve (pure core).
 *
 * ## The defect
 *
 * Design tokens travel by NAME, on purpose: that is what makes an installed part
 * adopt the host project's look instead of dragging the source project's palette
 * along with it (CMP-004 AC4). The gap that mechanism leaves is a token the host
 * has never DEFINED. `var(--brand-accent)` with no `--brand-accent` on `:root`
 * is an *unset property*, not an error — so the part installs, the import
 * reports success, and the thing draws the wrong colour with nothing anywhere
 * saying why.
 *
 * CMP-007 closed this for the agent (`install_prefab.tokensUnresolved`). This is
 * the same answer for the person, and it lives here rather than in either
 * installer for the reason CN-017 AC2 already put in `apply.ts`: this is the one
 * line every route converges on. A check in `ModuleLibraryModel` would miss a
 * project import; a check in `ImportFlow` would miss the one-click install,
 * which is the COMMON install and does not open the flow at all.
 *
 * ## 🔴 Why this takes `ProjectModel.toJSON()` and not `project.json`
 *
 * `noodl-mcp`'s `entryTokens` scans `<entry>/project/project.json`, which is
 * right for the shelf — all 75 entries are legacy single-file projects. It is
 * wrong for the editor: a project imported from elsewhere on this machine is
 * very likely v2 format, where components live in `components/**` and
 * `project.json` holds almost nothing. A `project.json` scan of a v2 source
 * returns an empty list — a silent zero on the door most likely to be carrying a
 * hand-made token. `toJSON()` is format-independent, and `apply()` already holds
 * the loaded model.
 *
 * ## It reports; it never refuses
 *
 * Everything here produces a warning string. A part whose tokens do not all
 * resolve still installs and the import still succeeds — the user may well be
 * about to define the token, or may be happy with the fallback. Refusing would
 * make a cosmetic mismatch fatal.
 *
 * @module noodl-editor/utils/import-engine/tokenGap
 */

import { collectTokenReferencesIn } from '@noodl-models/StyleTokensModel/TokenReferences';

import type { ImportPlan } from './types';

/** `ProjectModel.toJSON()`, narrowed to the parts that can hold a token. */
export interface SourceProjectJson {
  components?: { name?: string }[];
  variants?: { name?: string; typename?: string | { name?: string } }[];
  metadata?: {
    styles?: {
      colors?: Record<string, unknown>;
      text?: Record<string, unknown>;
    };
  };
}

const landing = (item: { policy: { action: string } }) => item.policy.action !== 'skip';

/**
 * Read a variant's type name, which is a bare string in a serialised project
 * and a `{ name }` object on a live model. Both shapes reach here depending on
 * which side of `toJSON()` the caller is on.
 */
function variantTypeName(typename: unknown): string {
  if (typeof typename === 'string') return typename;
  if (typename && typeof typename === 'object' && typeof (typename as { name?: unknown }).name === 'string') {
    return (typename as { name: string }).name;
  }
  return '';
}

/**
 * Every token referenced by the part of `source` that this plan actually lands.
 *
 * 🔴 **Scoped to the plan, not to the whole source.** In the one-click case the
 * two are the same thing — everything is selected — but in the flow the user has
 * made choices, and citing a token from a component they chose to skip is the
 * way a warning banner becomes decoration people learn to skim past. The result
 * stage's own LIB-006 note makes the same argument about the legacy banner.
 */
export function tokensReferencedByPlan(source: SourceProjectJson, plan: ImportPlan): string[] {
  const wanted = new Set(plan.components.filter(landing).map((c) => c.name));
  const found = new Set<string>();

  for (const component of source.components ?? []) {
    if (component?.name === undefined || !wanted.has(component.name)) continue;
    for (const token of collectTokenReferencesIn(component)) found.add(token);
  }

  const wantedVariants = new Set(plan.variants.filter(landing).map((v) => `${v.typename ?? ''}/${v.name}`));
  for (const variant of source.variants ?? []) {
    if (!wantedVariants.has(`${variantTypeName(variant?.typename)}/${variant?.name}`)) continue;
    for (const token of collectTokenReferencesIn(variant)) found.add(token);
  }

  // A style definition is itself a value that can be a token reference — a
  // colour style set to `var(--primary)` carries the dependency just as a node
  // parameter does, and it merges into the target's metadata where nothing else
  // will ever look at it again.
  const styles = source.metadata?.styles;
  for (const [kind, planned] of [
    ['colors', plan.styles.colors],
    ['text', plan.styles.text]
  ] as const) {
    const defs = styles?.[kind];
    if (!defs) continue;
    for (const item of planned) {
      if (!landing(item)) continue;
      for (const token of collectTokenReferencesIn(defs[item.name])) found.add(token);
    }
  }

  return [...found].sort();
}

/**
 * The tokens this plan lands that `defined` does not carry.
 *
 * `defined` is the target's EFFECTIVE vocabulary — the shipped defaults merged
 * with the project's own overrides, i.e. `buildEffectiveTokens(...).keys()`.
 * Passing only the overrides would report all 192 defaults as missing on every
 * single import.
 */
export function unresolvedTokensForPlan(
  source: SourceProjectJson,
  plan: ImportPlan,
  defined: ReadonlySet<string>
): string[] {
  return tokensReferencedByPlan(source, plan).filter((token) => !defined.has(token));
}

/**
 * The warnings `apply()` appends — zero or one — for one plan against one
 * target.
 *
 * 🔴 **The export exemption lives HERE, not in an `if` at the call site**, and
 * that is a deliberate move made after a control arm. An `if` in `apply.ts`
 * guarding the call meant the whole feature could be switched off with
 * `if (false && …)` while every static check on the caller still passed: the
 * import was still there, the call expression was still there, the spread was
 * still there. Pulling the condition in here does two things — it makes the
 * exemption gradeable by RUNNING it rather than by reading the caller, and it
 * leaves `apply.ts` with one unconditional statement, which is a property a
 * caller gate can actually assert.
 *
 * Why export is exempt at all: `openExportFlow` stages the selection into a
 * throwaway project that defines no tokens whatsoever, so every token a part
 * reads would read unresolved — a warning on every export, about nothing.
 */
export function tokenWarningsFor(
  plan: ImportPlan,
  source: SourceProjectJson,
  defined: ReadonlySet<string>
): string[] {
  if (plan.origin.kind === 'export-staging') return [];
  const sentence = describeUnresolvedTokens(unresolvedTokensForPlan(source, plan, defined));
  return sentence ? [sentence] : [];
}

/**
 * The sentence the person reads. Undefined when everything resolves, so the
 * caller pushes nothing rather than pushing an empty-but-present note.
 *
 * Says the three things a warning has to say to be worth showing: what is
 * wrong, what the visible consequence is (because there will not be an error
 * message later — that is the whole defect), and what to do about it. The
 * "Design Tokens panel" is the person's equivalent of the agent's
 * `set_project_tokens`, which is what `install_prefab` names.
 */
export function describeUnresolvedTokens(tokens: string[]): string | undefined {
  if (tokens.length === 0) return undefined;
  const isOne = tokens.length === 1;
  return (
    `This uses ${tokens.length} design ${isOne ? 'token' : 'tokens'} your project does not define ` +
    `(${tokens.join(', ')}). ${isOne ? 'It resolves' : 'They resolve'} to nothing, so ${isOne ? 'it' : 'they'} ` +
    `will draw unstyled without reporting an error. Define ${isOne ? 'it' : 'them'} in the Design Tokens ` +
    `panel, or repoint those parameters at tokens your project has.`
  );
}
