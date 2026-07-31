/**
 * The traversal every dialect shares, and the capability gate in front of it.
 *
 * ## Why the gate is here and not in each translator
 *
 * The obvious design gives each translator its own list of operators it can
 * express, and BCN-003's spec asks for exactly that: *"each translator declares
 * which of BCN-001's enumerated operators it can express"*. But the descriptor
 * **already** declares that, once per backend, with a sentence written for the
 * user — and BCN-010 greys the port out using the same cell. Two declarations
 * of the same fact drift, and this phase has already paid for that once: the
 * two `toDirectusFilter` copies disagreed about a condition with no operator
 * because nothing made them agree.
 *
 * So the declaration is the descriptor, and the translator reads it. The
 * consequences are worth stating because they are the point:
 *
 * - The message a developer sees when a filter is refused at runtime is
 *   *character-for-character* the sentence the editor shows on the greyed-out
 *   port. It cannot be otherwise.
 * - `custom` works with no extra machinery. The user fills in a capability
 *   table in the Backend Services panel and the gate reads theirs.
 * - A cell cannot be flipped to `supported` without an emitter, or an emitter
 *   added without a cell, because `translators.test.ts` walks every backend ×
 *   every operator and asserts the two agree.
 *
 * @module backend-contract/translators/translate
 */

import type { BackendType } from '../backends';
import { isUsable, type BackendDescriptor, type Capability } from '../capabilities';
import { descriptorFor } from '../descriptors';
import type { Filter, FilterOperator } from '../filter';
import { FilterTranslationError, type DialectContext, type FilterDialect, type TranslateOptions } from './types';
import { parseFilterNode } from './walk';

/**
 * Resolve the descriptor a translation is gated on.
 *
 * This is the import that puts the descriptor table in the viewer bundle, and
 * it is a deliberate purchase rather than an oversight. BCN-002 kept the
 * contract to `import type` only precisely so this decision would be taken on
 * purpose when something needed the data.
 *
 * **Measured, not estimated:** bundling `noodl-runtime`'s entry with esbuild
 * (minified, gzipped) goes from 103,668 to 115,883 bytes — **+12.2 KB gzipped,
 * +11.8%**. Roughly 8 KB of that is the descriptors and the rest is the five
 * dialects. An earlier draft of this comment guessed 8 KB for the whole thing,
 * which was wrong in the flattering direction; the number above is what the
 * command actually prints.
 *
 * What it buys is in the module comment above: one declaration of what a
 * backend can do, so the sentence shown on a greyed-out port and the sentence
 * thrown at runtime cannot say different things. The alternative — a second
 * per-dialect support list kept in step by a test — is the exact shape that
 * produced this phase's two-copies problem in the first place.
 */
export function resolveDescriptor(backend: BackendType | BackendDescriptor): BackendDescriptor {
  return typeof backend === 'string' ? descriptorFor(backend) : backend;
}

/**
 * May this operator be used against this backend right now?
 *
 * `conditional` is the interesting state. The contract's rule is that it is
 * **treated as unsupported until proven**, so a Supabase full-text filter is
 * refused unless the caller passes the operator in `probed` to say the live
 * check came back yes. Getting this backwards would mean shipping a filter that
 * works on the developer's instance and silently returns nothing on the user's.
 */
export function operatorState(
  descriptor: BackendDescriptor,
  operator: FilterOperator,
  probed: readonly FilterOperator[] = []
): { usable: boolean; capability: Capability } {
  const capability = descriptor.filters[operator];
  if (!capability) {
    return {
      usable: false,
      capability: { state: 'unsupported', reason: `"${operator}" is not declared for ${descriptor.type}.` }
    };
  }
  if (capability.state === 'conditional') {
    return { usable: probed.includes(operator), capability };
  }
  return { usable: isUsable(capability), capability };
}

/**
 * Walk a neutral filter and hand each node to a dialect.
 *
 * Group handling is here rather than in the dialects, and the two rules it
 * applies are the ones the two `toDirectusFilter` copies each implemented
 * separately:
 *
 * - A child that translates to nothing is **dropped from its group** — an empty
 *   group contributes no condition rather than an empty `_and: []` that some
 *   backends read as "match nothing".
 * - A group with exactly one surviving child **is** that child. Wrapping a lone
 *   condition in `_and` is harmless on Directus and a syntax error on
 *   PocketBase, so unwrapping is the portable choice as well as the tidy one.
 *
 * Note what is *not* dropped: a condition whose operator the backend cannot
 * express. That raises. Dropping it is the data-exposure bug this task exists
 * to close.
 */
export function translateWith<T>(
  dialect: FilterDialect<T>,
  filter: Filter | null | undefined,
  options: TranslateOptions
): T {
  const descriptor = resolveDescriptor(options.backend);
  const probed = options.probed ?? [];

  const ctx: DialectContext = {
    schema: options.schema,
    fail(message, details) {
      throw new FilterTranslationError(message, details);
    }
  };

  const gate = (operator: FilterOperator, field?: string): void => {
    const { usable, capability } = operatorState(descriptor, operator, probed);
    if (usable) return;
    const reason = capability.state === 'supported' ? undefined : capability.reason;
    const where = field ? ` on "${field}"` : '';
    throw new FilterTranslationError(
      `${descriptor.type} cannot apply the "${operator}" filter${where}. ${reason ?? ''}`.trim(),
      { operator, field, reason }
    );
  };

  const visit = (current: Filter | null | undefined): T => {
    const node = parseFilterNode(current);

    switch (node.kind) {
      case 'empty':
        return dialect.empty();

      case 'group': {
        const children = node.children.map(visit).filter((child) => !dialect.isEmpty(child));
        if (children.length === 0) return dialect.empty();
        if (children.length === 1) return children[0];
        return dialect.group(node.combinator, children, ctx);
      }

      case 'id':
        gate(node.operator);
        return dialect.id(node, ctx);

      case 'relatedTo':
        gate('relatedTo');
        return dialect.relatedTo(node, ctx);

      case 'condition':
        gate(node.operator, node.field);
        return dialect.condition(node, ctx);
    }
  };

  return visit(filter);
}
