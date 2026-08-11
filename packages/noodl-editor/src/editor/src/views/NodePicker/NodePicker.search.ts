/**
 * The node picker's result model (UIX-013).
 *
 * One function turns the node index into everything the picker renders: the
 * category rail with its counts, the result groups, and the flat render-ordered
 * list the keyboard cursor indexes into. Nothing here knows about React.
 *
 * Two things it deliberately keeps from the accordion implementation:
 *
 *  - the *ranking*: name matches ordered by where the term appears (so an exact
 *    / leading match sorts first), ties broken by the shorter name;
 *  - the taxonomy: categories and sub-categories come from the runtime's
 *    `nodelibraryexport.js` blob via `createnodeindex`, and are not restructured.
 *
 * What it adds is a *reason* for every non-obvious match. A node that appears
 * because of a search tag or a port name used to look like a bug; now the card
 * says which one it was.
 */
import { INodeType } from '@noodl-types/nodeTypes';
import { pickerCapabilityReason } from '@noodl-utils/capability-gating/pickerReason';

import { INodeIndex, INodeIndexCategory } from '@noodl-utils/createnodeindex';

/** Category tint keys — the UIX-001 `--theme-color-node-category-*` family. */
export type PickerTint = 'visual' | 'data' | 'logic' | 'javascript' | 'component' | 'default';

const TINTS: PickerTint[] = ['visual', 'data', 'logic', 'javascript', 'component'];

export type MatchReasonKind = 'tag' | 'port';

export interface MatchReason {
  kind: MatchReasonKind;
  text: string;
}

export type PickerItemKind = 'node' | 'action';

export interface PickerItem {
  /** Stable identity across re-ranking — the keyboard cursor is stored as a key. */
  key: string;
  kind: PickerItemKind;
  /** What the card shows. */
  label: string;
  /** Node type name, or the action id for `kind: 'action'`. */
  name: string;
  /** Undefined for actions. */
  type?: INodeType;
  categoryName: string;
  subCategoryName: string;
  tint: PickerTint;
  /** Secondary line on the card, when the match itself doesn't explain the row. */
  meta: string;
  /**
   * LEG-006 — the component's own sentence, for the project components that
   * have one. Core node types carry `docs`/`shortDocs` and never set this, so
   * it is present only on a project component whose `component.json` has a
   * `description`.
   *
   * It is the reason the field exists: a picker row that says
   * `/Pages/Checkout` and nothing else cannot be told apart from
   * `/Pages/CheckoutV2` without opening both.
   */
  description?: string;
  /** Why this matched, when it wasn't the name. */
  reason: MatchReason | null;
  /** Lower sorts first. `-1` means "no query". */
  rank: number;
  /** Character range of the query inside `label`, for highlighting. */
  highlight: [number, number] | null;
  /**
   * BCN-010 — the chosen backend cannot serve this node, and why.
   *
   * ⚠️ **The row stays in the list.** The spec is explicit and it is easy to get
   * backwards: *"Hiding it answers the question 'why can't I do X on Directus?'
   * with silence; showing it disabled answers it in place."* Deprecation in this
   * picker works by *exclusion* (`createnodeindex.ts` drops anything
   * `getCreateStatus` refuses), and routing capability through the same seam
   * would have made a Directus project's Request Magic Link simply not exist.
   *
   * `undefined` means "nothing to say", which is both "no binding" and
   * "supported here".
   */
  unavailableReason?: string;
}

export interface PickerGroup {
  key: string;
  title: string;
  items: PickerItem[];
}

export interface PickerCategoryEntry {
  name: string;
  tint: PickerTint;
  /** Matches for the current query — 0 means "dimmed in the rail", never hidden. */
  count: number;
  source: 'core' | 'custom';
}

export interface PickerResults {
  /** Rendered groups, in render order. */
  groups: PickerGroup[];
  /** Every item in `groups`, flattened in render order. The cursor indexes this. */
  items: PickerItem[];
  /** Every category in the index, with counts for the current query. */
  categories: PickerCategoryEntry[];
  /** Matches for the current query, ignoring the category filter. */
  total: number;
  /** Categories with at least one match. */
  matchingCategoryCount: number;
  isSearching: boolean;
}

/* -------------------------------------------------------------------------- */
/* Ranking                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Rank bands. A name match ranks by the index the term was found at, so `0`
 * (starts with the term) beats `4` (contains it). Tag and port matches are
 * pushed below every name match rather than interleaved with them — they are
 * the "why is this here?" results.
 */
const RANK_TAG = 1_000;
const RANK_PORT = 2_000;

export function getItemLabel(type: INodeType): string {
  return type.displayName || type.displayNodeName || type.name;
}

function findPortMatch(type: INodeType, term: string): string | undefined {
  const ports = Array.isArray(type?.ports) ? type.ports : [];

  for (const port of ports) {
    const name = String(port?.displayName || port?.name || '');
    if (name.toLowerCase().includes(term)) return name;
  }

  return undefined;
}

interface Match {
  rank: number;
  reason: MatchReason | null;
  highlight: [number, number] | null;
}

/**
 * Score one node against a lowercased search term, or `null` for no match.
 *
 * Order of precedence — name, then search tag, then port — is what makes
 * "exact name matches first" true regardless of how many tag matches exist.
 */
export function matchNode(type: INodeType, term: string): Match | null {
  const label = getItemLabel(type);
  const nameIndex = label.toLowerCase().indexOf(term);

  if (nameIndex !== -1) {
    return { rank: nameIndex, reason: null, highlight: [nameIndex, nameIndex + term.length] };
  }

  const tag = type.searchTags?.find((x) => String(x).toLowerCase().includes(term));
  if (tag) {
    return { rank: RANK_TAG, reason: { kind: 'tag', text: String(tag) }, highlight: null };
  }

  const port = findPortMatch(type, term);
  if (port) {
    return { rank: RANK_PORT, reason: { kind: 'port', text: port }, highlight: null };
  }

  return null;
}

function byRankThenName(a: PickerItem, b: PickerItem) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  if (a.label.length !== b.label.length) return a.label.length - b.label.length;
  return a.label.localeCompare(b.label);
}

/* -------------------------------------------------------------------------- */
/* Building                                                                    */
/* -------------------------------------------------------------------------- */

function tintFor(nodeColor: string | undefined, categoryType: string | undefined): PickerTint {
  if (TINTS.includes(nodeColor as PickerTint)) return nodeColor as PickerTint;
  if (TINTS.includes(categoryType as PickerTint)) return categoryType as PickerTint;
  return 'default';
}

export function makeItemKey(categoryName: string, nodeName: string) {
  return `${categoryName}::${nodeName}`;
}

interface FlatNode {
  type: INodeType;
  categoryName: string;
  categoryType: string;
  subCategoryName: string;
  source: 'core' | 'custom';
}

/** Walk the index once — categories, sub-categories and loose category items. */
function flatten(categories: INodeIndexCategory[], source: 'core' | 'custom'): FlatNode[] {
  const out: FlatNode[] = [];

  for (const category of categories || []) {
    const push = (items: TSFixme[], subCategoryName: string) => {
      for (const type of items || []) {
        if (!type) continue;
        out.push({
          type,
          categoryName: category.name,
          categoryType: category.type,
          subCategoryName,
          source
        });
      }
    };

    for (const subCategory of category.subCategories || []) {
      push(subCategory.items, subCategory.name || '');
    }

    push(category.items, '');
  }

  return out;
}

export function flattenIndex(index: INodeIndex): FlatNode[] {
  return [...flatten(index?.coreNodes || [], 'core'), ...flatten(index?.customNodes || [], 'custom')];
}

/**
 * LEG-006 — a project component's own sentence, when it has one.
 *
 * Project component rows are `ComponentModel`s cast through the index
 * (`createnodeindex.ts` pushes `NodeLibrary.getComponents()` straight into
 * "Project components"), so this reads the model field rather than anything on
 * `INodeType`, which has no such key.
 */
function componentDescription(type: INodeType): string | undefined {
  const value = (type as unknown as { description?: unknown }).description;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toItem(node: FlatNode, match: Match | null, isSearching: boolean): PickerItem {
  const label = getItemLabel(node.type);
  const reason = match?.reason ?? null;
  const description = componentDescription(node.type);

  // In browse the group heading is the sub-category, so the card's second line
  // carries the category. While searching the heading is the category, so the
  // card carries the sub-category — unless the match itself needs explaining,
  // which always wins.
  //
  // LEG-006 — a component's own description outranks both, because for a
  // project component the category line reads "Project components", which the
  // group heading already said. The match reason still wins: "why is this row
  // here" is a question the description does not answer.
  const meta = reason
    ? `${reason.kind} · ${reason.text}`
    : description
    ? description
    : isSearching
    ? node.subCategoryName || node.categoryName
    : node.categoryName;

  return {
    key: makeItemKey(node.categoryName, node.type.name),
    kind: 'node',
    label,
    name: node.type.name,
    type: node.type,
    categoryName: node.categoryName,
    subCategoryName: node.subCategoryName,
    tint: tintFor(node.type.color, node.categoryType),
    meta,
    ...(description ? { description } : {}),
    reason,
    rank: match?.rank ?? -1,
    highlight: match?.highlight ?? null,
    unavailableReason: pickerCapabilityReason(node.type.name)
  };
}

/** The "place a comment" affordance, kept keyboard-reachable as a result row. */
export const COMMENT_ACTION_KEY = 'action::comment';

function commentAction(): PickerItem {
  return {
    key: COMMENT_ACTION_KEY,
    kind: 'action',
    label: 'Comment',
    name: 'comment',
    categoryName: 'Other',
    subCategoryName: '',
    tint: 'default',
    meta: 'Place a comment in the node graph',
    reason: null,
    rank: 0,
    highlight: null
  };
}

export interface BuildResultsOptions {
  index: INodeIndex;
  query: string;
  /** `null` is "All", the rail's default. */
  activeCategory: string | null;
}

/**
 * Everything the picker renders for one (index, query, category) triple.
 *
 * Group shape differs by mode on purpose:
 *  - browsing groups by sub-category, which is how the library is organised;
 *  - searching groups by category and ranks the groups by their best match, so
 *    the strongest result is the first card on screen.
 */
export function buildResults({ index, query, activeCategory }: BuildResultsOptions): PickerResults {
  const term = query.trim().toLowerCase();
  const isSearching = term.length > 0;
  const nodes = flattenIndex(index);

  const matched: PickerItem[] = [];

  for (const node of nodes) {
    const match = isSearching ? matchNode(node.type, term) : null;
    if (isSearching && !match) continue;
    matched.push(toItem(node, match, isSearching));
  }

  // Counts are computed before the category filter — clicking a rail item must
  // not change the numbers next to the other rail items.
  const counts = new Map<string, number>();
  for (const item of matched) {
    counts.set(item.categoryName, (counts.get(item.categoryName) || 0) + 1);
  }

  const categories: PickerCategoryEntry[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    if (seen.has(node.categoryName)) continue;
    seen.add(node.categoryName);
    categories.push({
      name: node.categoryName,
      tint: tintFor(undefined, node.categoryType),
      count: counts.get(node.categoryName) || 0,
      source: node.source
    });
  }

  const visible = activeCategory ? matched.filter((item) => item.categoryName === activeCategory) : matched;

  const groups = isSearching ? groupBySearchRank(visible) : groupBySubCategory(visible);

  // The comment action rides along at the end of an unfiltered browse, and
  // whenever the query is looking for it.
  const wantsComment = isSearching ? 'comment'.includes(term) : true;
  if (wantsComment && !activeCategory) {
    groups.push({ key: 'group::Other', title: 'Other', items: [commentAction()] });
  }

  return {
    groups,
    items: groups.flatMap((group) => group.items),
    categories,
    total: matched.length,
    matchingCategoryCount: categories.filter((category) => category.count > 0).length,
    isSearching
  };
}

function groupBySubCategory(items: PickerItem[]): PickerGroup[] {
  const groups: PickerGroup[] = [];
  const byKey = new Map<string, PickerGroup>();

  for (const item of items) {
    const title = item.subCategoryName || item.categoryName;
    const key = `${item.categoryName}::${title}`;

    let group = byKey.get(key);
    if (!group) {
      group = { key, title, items: [] };
      byKey.set(key, group);
      groups.push(group);
    }

    group.items.push(item);
  }

  return groups;
}

function groupBySearchRank(items: PickerItem[]): PickerGroup[] {
  const groups: PickerGroup[] = [];
  const byKey = new Map<string, PickerGroup>();

  for (const item of items) {
    const key = `search::${item.categoryName}`;

    let group = byKey.get(key);
    if (!group) {
      group = { key, title: item.categoryName, items: [] };
      byKey.set(key, group);
      groups.push(group);
    }

    group.items.push(item);
  }

  for (const group of groups) {
    group.items.sort(byRankThenName);
  }

  // Best match wins the top of the page; the flat list follows the same order,
  // so the cursor's first stop is the highest-ranked result overall.
  groups.sort((a, b) => byRankThenName(a.items[0], b.items[0]));

  return groups;
}
