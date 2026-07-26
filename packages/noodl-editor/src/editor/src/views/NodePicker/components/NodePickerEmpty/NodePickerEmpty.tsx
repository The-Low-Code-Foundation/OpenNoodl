import React from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import css from './NodePickerEmpty.module.scss';

export interface NodePickerEmptyProps {
  query: string;
  onGoToTab: (tab: string) => void;
  onClearSearch: () => void;
}

/**
 * The no-results state (UIX-013).
 *
 * A dead end is a routing decision: if a node isn't in the core library or the
 * project, the likely homes are a module or a prefab. Offer them rather than
 * making the user retype the same query in another tab.
 */
export function NodePickerEmpty({ query, onGoToTab, onClearSearch }: NodePickerEmptyProps) {
  return (
    <div className={css['Root']}>
      <Icon icon={IconName.Search} UNSAFE_className={css['Glyph']} />

      <h3 className={css['Title']}>No nodes match “{query}”</h3>
      <p className={css['Text']}>
        Nothing in the core library or this project. It may exist as a module, or as a prefab you can clone.
      </p>

      <div className={css['Actions']}>
        <button type="button" className={css['Action']} onClick={() => onGoToTab('Modules')}>
          Search Modules
        </button>
        <button type="button" className={css['Action']} onClick={() => onGoToTab('Prefabs')}>
          Search Prefabs
        </button>
        <button type="button" className={css['Action']} onClick={onClearSearch}>
          Clear search
        </button>
      </div>
    </div>
  );
}
