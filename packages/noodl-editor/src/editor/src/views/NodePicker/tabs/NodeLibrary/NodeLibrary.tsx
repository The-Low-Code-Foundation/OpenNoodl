import React, { useCallback, useEffect, useRef, useState } from 'react';

import { NodeGraphModel, NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { RuntimeType } from '@noodl-models/nodelibrary/NodeLibraryData';
import { createNodeIndex } from '@noodl-utils/createnodeindex';

import PopupLayer from '../../../popuplayer';
import { NodePickerEmpty } from '../../components/NodePickerEmpty';
import { NodePickerPreview } from '../../components/NodePickerPreview';
import { NodePickerRail } from '../../components/NodePickerRail';
import { NodePickerResults } from '../../components/NodePickerResults';
import { NodePickerSearchBar } from '../../components/NodePickerSearchBar';
import { getResultColumns, NODE_PICKER_PREVIEW_MIN_WIDTH, NODE_PICKER_RAIL_MIN_WIDTH } from '../../NodePicker.constants';
import { useNodePickerContext } from '../../NodePicker.context';
import {
  useHoverPreview,
  useNodeCount,
  useNodeDocs,
  usePicker,
  usePickerKeys,
  useSearchFocus
} from '../../NodePicker.hooks';
import { pushRecentNodeName } from '../../NodePicker.recents';
import { PickerItem } from '../../NodePicker.search';
import { createNewComment, createNodeFunction } from '../../NodePicker.utils';
import css from './NodeLibrary.module.scss';

export interface NodeLibraryProps {
  model: NodeGraphModel;
  parentModel: NodeGraphNode;
  pos: TSFixme;
  attachToRoot: boolean;
  runtimeType: RuntimeType;
}

/**
 * The Nodes tab (UIX-013).
 *
 * Search-first and keyboard-first: the search field owns focus for as long as
 * the picker is open, the arrow keys drive a cursor that is always visibly on a
 * card, and `⏎` places the node it is on. Categories are a persistent rail
 * rather than an accordion — see `NodePicker.reducer.ts` for why that removed a
 * whole class of state bugs instead of fixing one.
 */
export function NodeLibrary({ model, parentModel, pos, attachToRoot, runtimeType }: NodeLibraryProps) {
  const { size, setFooter, setActiveTab } = useNodePickerContext();

  const [index] = useState(() => createNodeIndex(model, parentModel, runtimeType));
  const nodeCount = useNodeCount(index);

  const { state, results, cursoredItem, recentItems, setQuery, setActiveCategory, moveCursor, setCursor } =
    usePicker(index);

  const searchInput = useRef<HTMLInputElement>(null);
  useSearchFocus(searchInput);

  // One preview, and it only changes when you ask it to: hovering a card moves
  // the keyboard cursor after a short dwell, and nothing resets on mouse-out.
  // See `useHoverPreview`.
  const hover = useHoverPreview(setCursor);
  const previewItem = hover.override ?? cursoredItem;
  const docs = useNodeDocs(previewItem?.type);

  const createNode = createNodeFunction(model, parentModel, pos, attachToRoot);

  const insert = useCallback(
    (item: PickerItem | undefined) => {
      if (!item) return;

      if (item.kind === 'action') {
        createNewComment(model, pos);
      } else {
        createNode(item.type);
        pushRecentNodeName(item.name);
      }

      // Placing a node is the end of the interaction: close the picker rather
      // than leaving it covering the node that was just created.
      PopupLayer.instance.hidePopup();
    },
    // `createNode` is rebuilt every render from stable inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, pos, parentModel, attachToRoot]
  );

  const columns = getResultColumns(size.width);
  const hasRail = size.width >= NODE_PICKER_RAIL_MIN_WIDTH;
  const hasPreview = size.width >= NODE_PICKER_PREVIEW_MIN_WIDTH;

  usePickerKeys({
    columns,
    searchInput,
    onMove: (skip) => {
      // The keyboard always wins the pane back from a rail preview.
      hover.clearOverride();
      hover.cancelHover();
      moveCursor(skip);
    },
    onInsert: () => insert(previewItem)
  });

  const hasResults = results.items.length > 0;

  useEffect(() => {
    // No hints when there is nothing to navigate to — a shortcut list over an
    // empty pane is noise.
    setFooter({
      hints: hasResults
        ? [
            { keys: ['↑', '↓'], label: 'navigate' },
            { keys: ['←', '→'], label: 'move by one' },
            { keys: ['⏎'], label: 'insert' }
          ]
        : [],
      status: !hasResults
        ? 'No matches'
        : results.isSearching
        ? 'Ranked by match · exact names first'
        : 'Showing all categories'
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.isSearching, hasResults]);

  return (
    <div className={css['Root']}>
      <NodePickerSearchBar
        value={state.query}
        inputRef={searchInput}
        placeholder="Search nodes and components…"
        summaryValue={results.isSearching ? results.total : nodeCount}
        summary={
          results.isSearching
            ? `${results.total === 1 ? 'result' : 'results'} in ${results.matchingCategoryCount} ${
                results.matchingCategoryCount === 1 ? 'category' : 'categories'
              }`
            : nodeCount === 1
            ? 'node'
            : 'nodes'
        }
        onChange={setQuery}
      />

      <div className={css['Body']}>
        {hasRail && (
          <NodePickerRail
            categories={results.categories}
            activeCategory={state.activeCategory}
            total={results.total}
            isSearching={results.isSearching}
            recentItems={recentItems}
            onSelectCategory={setActiveCategory}
            onRecentHover={hover.hoverOverride}
            onRecentLeave={hover.cancelHover}
            onRecentClick={insert}
          />
        )}

        <div className={css['Results']}>
          {hasResults ? (
            <NodePickerResults
              groups={results.groups}
              cursorKey={state.cursorKey}
              columns={columns}
              onHover={hover.hoverItem}
              onLeave={hover.cancelHover}
              onSelect={insert}
            />
          ) : (
            <NodePickerEmpty
              query={state.query}
              onGoToTab={setActiveTab}
              onClearSearch={() => {
                setQuery('');
                searchInput.current?.focus();
              }}
            />
          )}
        </div>

        {hasPreview && <NodePickerPreview item={previewItem} docs={docs} />}
      </div>
    </div>
  );
}
