import classNames from 'classnames';
import React, { RefObject } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import css from './NodePickerSearchBar.module.scss';

export interface NodePickerSearchBarProps {
  value: string;
  placeholder?: string;
  inputRef?: RefObject<HTMLInputElement>;
  /** Right-hand readout: "128 nodes", "9 results in 4 categories". */
  summary?: string;
  summaryValue?: string | number;

  onChange: (value: string) => void;
}

/**
 * The picker's search field (UIX-013).
 *
 * Local rather than the shared `SearchInput` because this one carries two
 * things that field does not have: a clear button and the live result readout,
 * both of which the search-first layout depends on.
 */
export function NodePickerSearchBar({
  value,
  placeholder,
  inputRef,
  summary,
  summaryValue,
  onChange
}: NodePickerSearchBarProps) {
  const isActive = value.length > 0;

  return (
    <div className={css['Root']}>
      <label className={classNames(css['Field'], isActive && css['is-active'])}>
        <Icon icon={IconName.Search} UNSAFE_className={css['SearchIcon']} />

        <input
          ref={inputRef}
          className={css['Input']}
          type="text"
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          data-test="node-picker-search"
        />

        {isActive && (
          <button
            type="button"
            className={css['Clear']}
            title="Clear search"
            onClick={(event) => {
              event.preventDefault();
              onChange('');
              inputRef?.current?.focus();
            }}
          >
            <Icon icon={IconName.Close} />
          </button>
        )}
      </label>

      {Boolean(summary) && (
        <span className={css['Summary']}>
          <b>{summaryValue}</b> {summary}
        </span>
      )}
    </div>
  );
}
