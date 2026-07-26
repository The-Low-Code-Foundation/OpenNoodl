import React, { useEffect, useRef, useState } from 'react';

import { SelectOption } from '@noodl-core-ui/components/inputs/Select';

import css from './LauncherSearchBar.module.scss';

interface UseLauncherSearchBarProps {
  filterDropdownItems: SelectOption[];
  propertyNameToFilter: TSFixme;
  allItems: TSFixme;
}

interface LauncherSearchBarProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filterDropdownItems: UseLauncherSearchBarProps['filterDropdownItems'];
  filterValue: SelectOption['value'];
  setFilterValue: (value: SelectOption['value']) => void;
}

export function useLauncherSearchBar({
  filterDropdownItems,
  allItems,
  propertyNameToFilter
}: UseLauncherSearchBarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValue, setFilterValue] = useState(filterDropdownItems[0].value);

  function createFilterFunction(propertyName, value) {
    return (item) => {
      let propertyChain = propertyName.split('.');
      let currentValue = item;

      for (let prop of propertyChain) {
        if (currentValue.hasOwnProperty(prop)) {
          currentValue = currentValue[prop];
        } else {
          return false; // Property not found, filter it out
        }
      }

      return currentValue === value;
    };
  }

  const filteredItems =
    filterValue !== 'all' ? allItems.filter(createFilterFunction(propertyNameToFilter, filterValue)) : allItems;

  const searchedItems = Boolean(searchTerm)
    ? filteredItems.filter((project) => project.title.toLowerCase().includes(searchTerm.toLowerCase()))
    : filteredItems;

  return {
    items: searchedItems,
    filterValue,
    setFilterValue,
    searchTerm,
    setSearchTerm
  };
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

/**
 * Mock toolbar row (PAR-001): search box (14px glass icon, 13px input, kbd hint)
 * + the filter select in the same box treatment. Cmd/Ctrl+K focuses the search.
 */
export function LauncherSearchBar({
  searchTerm,
  setSearchTerm,
  filterDropdownItems,
  setFilterValue,
  filterValue
}: LauncherSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={css['Root']}>
      <div className={css['Search']}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="m10.5 10.5 3 3" />
        </svg>
        <input
          ref={inputRef}
          className={css['SearchInput']}
          placeholder="Search projects"
          aria-label="Search projects"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.currentTarget.value)}
          data-test="launcher-search-input"
        />
        <kbd className={css['Kbd']}>{IS_MAC ? '⌘K' : 'Ctrl K'}</kbd>
      </div>

      <label className={css['Select']}>
        <select
          className={css['SelectInput']}
          value={String(filterValue)}
          onChange={(e) => setFilterValue(e.currentTarget.value)}
          aria-label="Filter projects"
          data-test="launcher-filter-select"
        >
          {filterDropdownItems.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m4 6.5 4 4 4-4" />
        </svg>
      </label>
    </div>
  );
}
