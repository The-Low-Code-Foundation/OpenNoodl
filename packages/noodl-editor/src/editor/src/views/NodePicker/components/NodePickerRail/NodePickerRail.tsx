import classNames from 'classnames';
import React from 'react';

import { PickerCategoryEntry, PickerItem } from '../../NodePicker.search';
import css from './NodePickerRail.module.scss';

export interface NodePickerRailProps {
  categories: PickerCategoryEntry[];
  activeCategory: string | null;
  total: number;
  isSearching: boolean;

  recentItems: PickerItem[];

  onSelectCategory: (category: string | null) => void;
  onRecentHover: (item: PickerItem) => void;
  onRecentLeave: () => void;
  onRecentClick: (item: PickerItem) => void;
}

/**
 * The persistent category rail (UIX-013).
 *
 * This is what replaces the accordion. Nothing here expands or collapses:
 * every category is always listed with its live count, so "what exists" and
 * "what matched" are readable without opening anything — which removes the
 * reported expand-on-search bug by construction rather than by keeping two
 * copies of a boolean in sync.
 *
 * While searching, categories with no matches are *dimmed rather than hidden*.
 * "0 under Navigation" is information; a category that silently disappears is
 * not.
 */
export function NodePickerRail({
  categories,
  activeCategory,
  total,
  isSearching,
  recentItems,
  onSelectCategory,
  onRecentHover,
  onRecentLeave,
  onRecentClick
}: NodePickerRailProps) {
  return (
    <nav className={css['Root']}>
      <div className={css['Title']}>{isSearching ? 'Matching categories' : 'Categories'}</div>

      <button
        type="button"
        className={classNames(css['Item'], activeCategory === null && css['is-active'])}
        aria-current={activeCategory === null}
        onClick={() => onSelectCategory(null)}
      >
        <span className={classNames(css['Dot'], css['Dot--tint-default'])} />
        <span className={css['Label']}>{isSearching ? 'All results' : 'All nodes'}</span>
        <span className={css['Count']}>{total}</span>
      </button>

      {categories.map((category) => {
        const isEmpty = isSearching && category.count === 0;

        return (
          <button
            key={category.name}
            type="button"
            className={classNames(
              css['Item'],
              activeCategory === category.name && css['is-active'],
              isEmpty && css['is-empty']
            )}
            aria-current={activeCategory === category.name}
            disabled={isEmpty}
            onClick={() => onSelectCategory(activeCategory === category.name ? null : category.name)}
            title={category.name}
          >
            <span className={classNames(css['Dot'], css[`Dot--tint-${category.tint}`])} />
            <span className={css['Label']}>{category.name}</span>
            <span className={css['Count']}>{category.count}</span>
          </button>
        );
      })}

      {Boolean(recentItems.length) && (
        <>
          <div className={classNames(css['Title'], css['Title--is-spaced'])}>Recent</div>

          {recentItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={css['Item']}
              onMouseEnter={() => onRecentHover(item)}
              onMouseLeave={onRecentLeave}
              onClick={(event) => {
                event.stopPropagation();
                onRecentClick(item);
              }}
              title={`Insert ${item.label}`}
            >
              <span className={classNames(css['Dot'], css[`Dot--tint-${item.tint}`])} />
              <span className={css['Label']}>{item.label}</span>
            </button>
          ))}
        </>
      )}
    </nav>
  );
}
