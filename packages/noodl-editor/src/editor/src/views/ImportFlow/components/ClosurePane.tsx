/**
 * LIB-005: the closure pane — "what does this drag along, and why?"
 *
 * The old popup answered this with a faintly different tick mark. Here the
 * closure is the pane's whole subject:
 *
 * - With a row focused, it lists that item's dependencies with their provenance
 *   ("uses /Button", "Image.src (port type: image)", "colors: Primary"), which
 *   is LIB-004's `via` string shown verbatim rather than paraphrased.
 * - With nothing focused, it lists everything the current selection pulled in
 *   that the user did not ask for directly, each with its requirer.
 *
 * Heuristic links — LIB-004's `inferred` confidence, i.e. "this parameter value
 * merely *equals* a resource path" — are marked and individually droppable.
 * Dropping one recomputes the closure (see dependencyLinks.ts); it never
 * post-filters a plan.
 *
 * @module noodl-editor/views/ImportFlow/components/ClosurePane
 */

import classNames from 'classnames';
import React from 'react';

import { Chip, ChipVariant } from '@noodl-core-ui/components/common/Chip';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { TextButton } from '@noodl-core-ui/components/inputs/TextButton';

import type { DependencyKind } from '@noodl-utils/import-engine';

import { DependencyLink, sourceKey } from '../model/dependencyLinks';
import { FlowItem, ItemCategory, itemKey } from '../model/items';
import { PlannedStatus, SelectionState } from '../model/selection';
import css from '../ImportFlow.module.scss';
import type { LoadedSource } from '../model/session';

const KIND_LABEL: Record<DependencyKind, string> = {
  component: 'Components',
  file: 'Files',
  variant: 'Variants',
  colorStyle: 'Color styles',
  textStyle: 'Text styles',
  module: 'Modules'
};

const KIND_ORDER: DependencyKind[] = ['component', 'file', 'variant', 'colorStyle', 'textStyle', 'module'];

const KIND_TO_CATEGORY: Record<DependencyKind, ItemCategory> = {
  component: 'component',
  file: 'resource',
  variant: 'variant',
  colorStyle: 'colorStyle',
  textStyle: 'textStyle',
  module: 'module'
};

export interface ClosurePaneProps {
  source: LoadedSource;
  items: FlowItem[];
  selection: SelectionState;
  index: Map<string, PlannedStatus>;
  focusedKey: string | null;
  onFocus: (key: string | null) => void;
  onToggleLink: (linkKey: string) => void;
}

function LinkRow({
  link,
  isDropped,
  onToggleLink
}: {
  link: DependencyLink;
  isDropped: boolean;
  onToggleLink: (key: string) => void;
}) {
  return (
    <div className={classNames(css['link'], { [css['linkDropped']]: isDropped })}>
      <div className={css['linkBody']}>
        <div className={css['linkName']}>
          {link.to.typename ? `${link.to.name} · ${link.to.typename}` : link.to.name}
        </div>
        <div className={css['linkVia']}>{link.via.join(' · ')}</div>
      </div>
      {link.isInferred && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <Chip label="guess" variant={ChipVariant.Warning} />
          <TextButton label={isDropped ? 'Restore' : 'Drop'} onClick={() => onToggleLink(link.key)} />
        </div>
      )}
    </div>
  );
}

export function ClosurePane({
  source,
  items,
  selection,
  index,
  focusedKey,
  onFocus,
  onToggleLink
}: ClosurePaneProps) {
  const byKey = new Map(items.map((item) => [item.key, item] as const));
  const focused = focusedKey ? byKey.get(focusedKey) : undefined;

  if (focused) {
    // Only components, variants and (text) styles declare dependencies.
    const fromKind =
      focused.category === 'variant'
        ? 'variant'
        : focused.category === 'textStyle' || focused.category === 'colorStyle'
          ? 'style'
          : 'component';
    const key = sourceKey({ kind: fromKind, name: focused.name, typename: focused.typename });
    const links = source.linksBySource.get(key) ?? [];
    const grouped = KIND_ORDER.map((kind) => ({ kind, links: links.filter((l) => l.kind === kind) })).filter(
      (g) => g.links.length > 0
    );
    const planned = index.get(focused.key);

    return (
      <div className={css['rightPane']}>
        <div className={css['paneHeader']}>
          <p className={css['paneTitle']} title={focused.name}>
            {focused.name}
          </p>
          <p className={css['paneHint']}>
            {planned?.reason === 'dependency' && planned.requiredBy.length > 0
              ? `Required by ${planned.requiredBy.join(', ')} — it comes along with them.`
              : grouped.length === 0
                ? 'Nothing else comes along with this.'
                : 'Taking this also takes:'}
          </p>
          <div style={{ marginTop: 8 }}>
            <TextButton label="Show the whole closure" icon={IconName.ArrowLeft} onClick={() => onFocus(null)} />
          </div>
        </div>

        <div className={css['scroll']}>
          {grouped.map((group) => (
            <div className={css['linkGroup']} key={group.kind}>
              <div className={css['linkGroupTitle']}>{KIND_LABEL[group.kind]}</div>
              {group.links.map((link) => (
                <LinkRow
                  key={link.key}
                  link={link}
                  isDropped={selection.droppedLinks.has(link.key)}
                  onToggleLink={onToggleLink}
                />
              ))}
            </div>
          ))}
          {grouped.length === 0 && <div className={css['emptyPane']}>This item stands on its own.</div>}
        </div>
      </div>
    );
  }

  // Nothing focused: the running closure — what the selection pulled in that the
  // user did not ask for.
  const brought = [...index.values()].filter((planned) => planned.reason === 'dependency');

  return (
    <div className={css['rightPane']}>
      <div className={css['paneHeader']}>
        <p className={css['paneTitle']}>Coming along</p>
        <p className={css['paneHint']}>
          {selection.requested.size === 0
            ? 'Pick something on the left and everything it needs appears here.'
            : brought.length === 0
              ? 'Your selection stands on its own — nothing extra is being pulled in.'
              : 'These are not selected directly. They are here because something you picked needs them, so they cannot be left behind.'}
        </p>
      </div>

      <div className={css['scroll']}>
        {KIND_ORDER.map((kind) => {
          const category = KIND_TO_CATEGORY[kind];
          const rows = brought.filter((planned) => planned.category === category);
          if (rows.length === 0) return null;
          return (
            <div className={css['linkGroup']} key={kind}>
              <div className={css['linkGroupTitle']}>{KIND_LABEL[kind]}</div>
              {rows.map((planned) => (
                <div
                  className={css['link']}
                  key={planned.key}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onFocus(itemKey(planned.category, planned.name, planned.typename))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onFocus(itemKey(planned.category, planned.name, planned.typename));
                  }}
                >
                  <div className={css['linkBody']}>
                    <div className={css['linkName']}>{planned.name}</div>
                    <div className={css['linkVia']}>
                      {planned.requiredBy.length > 0 ? `needed by ${planned.requiredBy.join(', ')}` : 'dependency'}
                    </div>
                  </div>
                  {planned.collides && <Chip label="collides" variant={ChipVariant.Warning} />}
                </div>
              ))}
            </div>
          );
        })}

        {brought.length === 0 && selection.requested.size > 0 && (
          <div className={css['emptyPane']}>
            <Icon icon={IconName.Check} size={IconSize.Default} />
            <div style={{ marginTop: 8 }}>Nothing extra.</div>
          </div>
        )}
      </div>
    </div>
  );
}
