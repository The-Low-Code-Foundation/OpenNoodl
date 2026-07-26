/**
 * LIB-005: the browse-and-select stage.
 *
 * Left: everything the source project offers, in its folder structure, with a
 * search box over the full path so `forms/` filters a folder and `button` finds
 * one item. Right: the closure — what the current selection drags along, and why.
 *
 * Rows have three states, not two (see `selection.ts`):
 *   requested — solid box, clicking takes it back
 *   required  — outlined box, brought in by something else; there is no click
 *               that removes it, which is the point
 *   available — empty box
 *
 * @module noodl-editor/views/ImportFlow/components/SelectStage
 */

import classNames from 'classnames';
import React, { useMemo } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { SearchInput } from '@noodl-core-ui/components/inputs/SearchInput';
import { TextButton } from '@noodl-core-ui/components/inputs/TextButton';

import {
  buildTree,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  FlowItem,
  ItemCategory,
  itemKeysUnder,
  matchesQuery,
  TreeNode
} from '../model/items';
import { folderState, PlannedStatus, rowState, SelectionState } from '../model/selection';
import css from '../ImportFlow.module.scss';
import { ClosurePane } from './ClosurePane';
import type { LoadedSource } from '../model/session';

const CATEGORY_ICON: Record<ItemCategory, IconName> = {
  component: IconName.Component,
  resource: IconName.File,
  module: IconName.Components,
  variant: IconName.Palette,
  colorStyle: IconName.PaletteFill,
  textStyle: IconName.TextInBox
};

export interface SelectStageProps {
  source: LoadedSource;
  items: FlowItem[];
  selection: SelectionState;
  index: Map<string, PlannedStatus>;
  query: string;
  /** Folders the user has collapsed; everything else is open. */
  closedFolders: ReadonlySet<string>;
  focusedKey: string | null;
  onQueryChange: (query: string) => void;
  onToggleFolderOpen: (path: string) => void;
  onSetRequested: (keys: string[], select: boolean) => void;
  onFocus: (key: string | null) => void;
  onToggleLink: (linkKey: string) => void;
}

function SelectionBox({ state }: { state: 'requested' | 'required' | 'available' | 'some' }) {
  return (
    <span
      className={classNames(css['box'], {
        [css['boxRequested']]: state === 'requested',
        [css['boxRequired']]: state === 'required',
        [css['boxPartial']]: state === 'some'
      })}
    >
      {(state === 'requested' || state === 'required') && <Icon icon={IconName.Check} size={IconSize.Tiny} />}
    </span>
  );
}

export function SelectStage({
  source,
  items,
  selection,
  index,
  query,
  closedFolders,
  focusedKey,
  onQueryChange,
  onToggleFolderOpen,
  onSetRequested,
  onFocus,
  onToggleLink
}: SelectStageProps) {
  const visible = useMemo(() => items.filter((item) => matchesQuery(item, query)), [items, query]);

  const sections = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: visible.filter((item) => item.category === category)
      })).filter((section) => section.items.length > 0),
    [visible]
  );

  // A search narrows the tree, so folders open to reveal the matches; without a
  // query the user's own collapse choices stand.
  const isOpen = (path: string) => query.trim() !== '' || !closedFolders.has(path);

  function renderNode(node: TreeNode): JSX.Element {
    if (node.type === 'item') {
      const state = rowState(node.key, selection, index);
      const planned = index.get(node.key);
      const item = node.item;
      return (
        <div
          key={node.key}
          role="button"
          tabIndex={0}
          className={classNames(css['row'], {
            [css['rowFocused']]: focusedKey === node.key,
            [css['rowRequired']]: state === 'required'
          })}
          style={{ paddingLeft: 14 + node.depth * 14 }}
          onClick={() => onFocus(node.key)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onFocus(node.key);
            }
          }}
        >
          <span
            onClick={(e) => {
              e.stopPropagation();
              // A `required` row has no off switch — that is what makes an
              // unsatisfied selection unrepresentable rather than merely warned
              // about. Clicking it focuses its reason instead.
              if (state === 'required') {
                onFocus(node.key);
                return;
              }
              onSetRequested([node.key], state !== 'requested');
            }}
          >
            <SelectionBox state={state} />
          </span>
          <span className={css['rowIcon']}>
            <Icon icon={CATEGORY_ICON[item.category]} size={IconSize.Tiny} />
          </span>
          <span className={css['rowLabel']} title={item.typename ? `${item.typename} / ${item.name}` : item.name}>
            {item.label}
            {item.category === 'variant' && item.typename ? ` · ${item.typename}` : ''}
          </span>
          {typeof item.nodeCount === 'number' && item.nodeCount > 0 && (
            <span className={css['rowMeta']}>{item.nodeCount} nodes</span>
          )}
          {state === 'required' && !planned?.collides && <span className={css['rowMeta']}>required</span>}
          {planned?.collides && <span className={css['rowMeta']}>collides</span>}
        </div>
      );
    }

    const keys = itemKeysUnder(node);
    const state = folderState(keys, index);
    const open = isOpen(node.path);

    return (
      <div key={node.key}>
        <div
          role="button"
          tabIndex={0}
          className={css['row']}
          style={{ paddingLeft: 14 + node.depth * 14 }}
          onClick={() => onToggleFolderOpen(node.path)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleFolderOpen(node.path);
            }
          }}
        >
          <span
            onClick={(e) => {
              e.stopPropagation();
              onSetRequested(keys, state !== 'all');
            }}
          >
            <SelectionBox state={state === 'all' ? 'requested' : state === 'some' ? 'some' : 'available'} />
          </span>
          <span className={css['disclosure']}>
            <Icon icon={open ? IconName.CaretDown : IconName.CaretRight} size={IconSize.Tiny} />
          </span>
          <span className={css['rowIcon']}>
            <Icon icon={open ? IconName.FolderOpen : IconName.FolderClosed} size={IconSize.Tiny} />
          </span>
          <span className={css['rowLabel']}>{node.label}</span>
        </div>
        {open && node.children.map(renderNode)}
      </div>
    );
  }

  const allKeys = visible.map((item) => item.key);
  const everythingRequested = allKeys.length > 0 && allKeys.every((key) => selection.requested.has(key));

  return (
    <div className={css['body']}>
      <div className={css['leftPane']}>
        <div className={css['searchRow']}>
          <div className={css['searchBox']}>
            <SearchInput value={query} placeholder="Search components, files, styles…" onChange={onQueryChange} />
          </div>
          <TextButton
            label={everythingRequested ? 'Select none' : query.trim() ? 'Select matches' : 'Select all'}
            onClick={() => onSetRequested(allKeys, !everythingRequested)}
          />
        </div>

        <div className={css['scroll']}>
          {sections.length === 0 && (
            <div className={css['centered']}>
              {query.trim() === ''
                ? 'This project has nothing importable in it.'
                : `Nothing matches “${query}”.`}
            </div>
          )}
          {sections.map((section) => (
            <div className={css['section']} key={section.category}>
              <div className={css['sectionHeader']}>
                <span className={css['sectionTitle']}>{CATEGORY_LABEL[section.category]}</span>
                <span className={css['sectionCount']}>{section.items.length}</span>
              </div>
              {buildTree(section.items).map(renderNode)}
            </div>
          ))}
        </div>
      </div>

      <ClosurePane
        source={source}
        items={items}
        selection={selection}
        index={index}
        focusedKey={focusedKey}
        onFocus={onFocus}
        onToggleLink={onToggleLink}
      />
    </div>
  );
}
