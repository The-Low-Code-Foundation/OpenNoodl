/**
 * SUB-007: presentation rules for typed graph changes and conflicts.
 *
 * Kept apart from the components so Phase 15's AI review (AIX-003) can reuse
 * the grouping and iconography without importing the version-control panel.
 */

import { FeedbackType } from '@noodl-constants/FeedbackType';

import { IconName } from '@noodl-core-ui/components/common/Icon';

import { catalogDisplayNames, formatChange, formatConflict } from '@noodl-versioning';
import type { DisplayNameProvider, GraphChange, GraphConflict } from '@noodl-versioning';

/** Changes read best grouped by what the user did, not by field. */
export enum ChangeGroup {
  Nodes = 'Nodes',
  Wiring = 'Wiring',
  Values = 'Values',
  Layout = 'Layout',
  Comments = 'Comments',
  Component = 'Component'
}

const GROUP_ORDER: ChangeGroup[] = [
  ChangeGroup.Component,
  ChangeGroup.Nodes,
  ChangeGroup.Wiring,
  ChangeGroup.Values,
  ChangeGroup.Comments,
  ChangeGroup.Layout
];

export function groupOf(change: GraphChange): ChangeGroup {
  switch (change.kind) {
    case 'node-added':
    case 'node-removed':
    case 'node-recreated':
    case 'node-type-changed':
      return ChangeGroup.Nodes;
    case 'connection-added':
    case 'connection-removed':
    case 'connection-rewired':
      return ChangeGroup.Wiring;
    case 'node-renamed':
    case 'node-parameters-changed':
    case 'node-state-changed':
    case 'node-variant-changed':
    case 'node-ports-changed':
      return ChangeGroup.Values;
    case 'node-reparented':
    case 'node-reordered':
    case 'node-moved':
      return ChangeGroup.Layout;
    case 'comment-added':
    case 'comment-removed':
    case 'comment-changed':
    case 'comment-moved':
      return ChangeGroup.Comments;
    case 'component-renamed':
    case 'component-metadata-changed':
      return ChangeGroup.Component;
  }
}

/** Added / removed / changed, for the status dot beside each sentence. */
export type ChangeTone = 'added' | 'removed' | 'changed';

export function toneOf(change: GraphChange): ChangeTone {
  switch (change.kind) {
    case 'node-added':
    case 'connection-added':
    case 'comment-added':
      return 'added';
    case 'node-removed':
    case 'connection-removed':
    case 'comment-removed':
      return 'removed';
    default:
      return 'changed';
  }
}

export const TONE_ICON: Record<ChangeTone, IconName> = {
  added: IconName.Plus,
  removed: IconName.Minus,
  changed: IconName.PencilLine
};

export const TONE_FEEDBACK: Record<ChangeTone, FeedbackType> = {
  added: FeedbackType.Success,
  removed: FeedbackType.Danger,
  changed: FeedbackType.Notice
};

export interface PresentedChange {
  key: string;
  text: string;
  tone: ChangeTone;
  isCosmetic: boolean;
  change: GraphChange;
}

export interface PresentedGroup {
  group: ChangeGroup;
  changes: PresentedChange[];
}

/**
 * The catalog gives nodes their display names ("Text Input" rather than
 * `noodl.textinput`). Resolved once per render pass, not per change.
 */
export function createDisplayNameProvider(): DisplayNameProvider {
  return catalogDisplayNames();
}

export function presentChanges(
  changes: GraphChange[],
  displayName: DisplayNameProvider,
  options: { includeCosmetic?: boolean } = {}
): PresentedGroup[] {
  const visible = options.includeCosmetic ? changes : changes.filter((change) => change.category !== 'cosmetic');

  const byGroup = new Map<ChangeGroup, PresentedChange[]>();
  visible.forEach((change, index) => {
    const group = groupOf(change);
    const list = byGroup.get(group) ?? [];
    list.push({
      key: `${change.kind}-${index}`,
      text: formatChange(change, { displayName, includeCosmetic: true }),
      tone: toneOf(change),
      isCosmetic: change.category === 'cosmetic',
      change
    });
    byGroup.set(group, list);
  });

  return GROUP_ORDER.filter((group) => byGroup.has(group)).map((group) => ({
    group,
    changes: byGroup.get(group)
  }));
}

export function countCosmetic(changes: GraphChange[]): number {
  return changes.filter((change) => change.category === 'cosmetic').length;
}

export interface PresentedConflict {
  key: string;
  text: string;
  conflict: GraphConflict;
}

export function presentConflicts(conflicts: GraphConflict[], displayName: DisplayNameProvider): PresentedConflict[] {
  return conflicts.map((conflict) => ({
    key: conflict.id,
    text: formatConflict(conflict, { displayName }),
    conflict
  }));
}

/** Short, single-line rendering of a conflict side for the resolution UI. */
export function describeSide(value: unknown): string {
  if (value === undefined) return '(removed)';
  if (value === null) return 'null';
  if (typeof value === 'string') return value.length > 120 ? `${value.slice(0, 117)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const json = JSON.stringify(value);
  return json.length > 120 ? `${json.slice(0, 117)}…` : json;
}
