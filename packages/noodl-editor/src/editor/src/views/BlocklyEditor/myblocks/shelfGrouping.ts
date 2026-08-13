/**
 * VFN-010 §1 — telling the two shelves apart at the point of use.
 *
 * > *"for backpack blocks (which should be marked in the block picker in a way you can tell which
 * > are backpack and which are project scoped)"*
 *
 * ## Why this matters more than it looks
 *
 * A block on the backpack works for its author and is **missing for a collaborator** who opens the
 * project. The picker is the moment that consequence is choosable, and before this the two shelves
 * were indistinguishable there — the flyout listed every definition in one undivided run.
 *
 * ## 🔴 Headings, not a mark on the block
 *
 * Two reasons, both from this register:
 *
 * 1. A call block's colour is already the My Blocks category's hue and carries meaning; a second
 *    colour meaning "shelf" would collide with it.
 * 2. A per-block glyph on an SVG block is the exact shape that produced nine dark-on-dark glyphs
 *    in DSG-008 — an icon host that sets `fill` sets nothing, and the worst of them measured
 *    1.16:1. A `kind: 'label'` is real text in the flyout's own theme and cannot go dark-on-dark.
 *
 * ⚠️ **Project wins on an id collision** (`store.ts`'s header), and `list()` deliberately returns
 * only the resolving copy. So a definition appears in exactly one group, and the group it appears
 * in is the shelf the editor would actually *read* it from. Grouping must not imply a block is on
 * both shelves — see {@link shelfGroups}, which partitions rather than tagging.
 *
 * Pure, and in `myblocks/` for the usual reason: `MyBlocksBlocks.ts` imports Blockly and cannot be
 * reached from the plain-Node runner, so the decision about *what the picker shows* lives here and
 * the plumbing lives there.
 *
 * @module BlocklyEditor/myblocks
 */

import { SCOPES, type MyBlocksScope } from './store';

/** Just enough of a definition to be grouped. Kept structural so a spec can hand in a stub. */
export interface ShelvedDefinition {
  id: string;
}

/** Anything that can say which shelf an id resolves from. `MyBlocksStore` satisfies it. */
export interface ShelfLookup {
  scopeOf(id: string): MyBlocksScope | undefined;
}

export interface ShelfGroup<T extends ShelvedDefinition> {
  /**
   * The shelf, or `undefined` when the caller supplied no lookup — the ungrouped run.
   *
   * 🔴 `undefined` is *"nobody asked"*, not *"neither shelf"*. A source with no `scopeOf` is a
   * legitimate caller (a spec, a headless generate) and it gets the flat list it had before this
   * existed rather than a heading that would be a guess.
   */
  scope?: MyBlocksScope;
  definitions: T[];
}

/**
 * Partition definitions by the shelf each one resolves from, in resolution order.
 *
 * **Partition, not tag.** Every definition lands in exactly one group, because `list()` already
 * resolved the collision and a block that appeared under both headings would tell the builder
 * something false about which copy their call blocks point at.
 *
 * An empty group is dropped, so a builder with nothing in their backpack sees no *My backpack*
 * heading over an empty run — a heading with nothing under it reads as a bug in the picker.
 *
 * ⚠️ A definition whose scope the lookup cannot answer (it has been deleted between the `list()`
 * and this call, or the source is not a store) keeps its place in a trailing group with no scope,
 * rather than being dropped. Dropping it would make a block vanish from the picker for a reason
 * nobody could see; showing it unlabelled is the smaller lie.
 */
export function shelfGroups<T extends ShelvedDefinition>(
  definitions: readonly T[],
  lookup?: ShelfLookup | null
): ShelfGroup<T>[] {
  const all = Array.from(definitions ?? []);
  if (!lookup || typeof lookup.scopeOf !== 'function') {
    return all.length > 0 ? [{ definitions: all }] : [];
  }

  const groups: ShelfGroup<T>[] = [];
  const placed = new Set<T>();

  for (const scope of SCOPES) {
    const members = all.filter((definition) => {
      if (placed.has(definition)) return false;
      let resolved: MyBlocksScope | undefined;
      try {
        resolved = lookup.scopeOf(definition.id);
      } catch {
        // A lookup that throws is a lookup that cannot answer; the definition falls through to
        // the trailing group rather than taking the whole flyout with it.
        return false;
      }
      if (resolved !== scope) return false;
      placed.add(definition);
      return true;
    });

    if (members.length > 0) groups.push({ scope, definitions: members });
  }

  const unplaced = all.filter((definition) => !placed.has(definition));
  if (unplaced.length > 0) groups.push({ definitions: unplaced });

  return groups;
}
