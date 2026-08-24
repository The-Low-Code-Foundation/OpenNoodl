import React from 'react';

import { SearchInput } from '@noodl-core-ui/components/inputs/SearchInput';

/**
 * FB-017 AC7 — the property filter's input, deliberately in a module of its own.
 *
 * 🔴 The separate file is not tidiness, it is what keeps `PropertyGroups.tsx` gradeable.
 * `SearchInput` reaches `Icon`, and `Icon` is one of the imports that makes a spec in this repo's
 * `tests-unit` runner fail *to run* rather than fail — the failure mode that reads as a spec
 * nobody wrote. `groupHeading.test.tsx` imports `GroupHeading` from `PropertyGroups.tsx`, so
 * pulling the search chrome in there would have taken 94 existing assertions down with it, and
 * done it silently.
 *
 * ⚠️ `SearchInput` exposes no `onKeyDown`, so Escape is caught on the wrapper — React's synthetic
 * events bubble, so the keystroke reaches it from the input below. Escape-to-clear matters more
 * here than it does in most search boxes: the filter hides properties, and the way out of a panel
 * that has hidden the thing you were looking at should not be "select the text and delete it".
 */
export function PropertyFilterInput({
  value,
  onChange,
  matchCount
}: {
  value: string;
  onChange: (value: string) => void;
  /** Rows the current query leaves standing; announced for screen readers, not drawn. */
  matchCount?: number;
}) {
  return (
    <div
      className="property-filter"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && value) {
          // Stopping it here keeps Escape from reaching the popup layer, which would otherwise
          // read a clear-the-filter keystroke as close-the-panel.
          event.stopPropagation();
          onChange('');
        }
      }}
    >
      <SearchInput placeholder="Filter properties" value={value} onChange={onChange} />

      {/*
       * The count is announced rather than drawn. A filter that silently empties the panel is
       * indistinguishable from a panel that has broken, and a builder using a screen reader has
       * no scrollbar to tell them the difference — but a number next to the box is chrome the
       * sighted case does not need, since the rows themselves are the answer.
       */}
      <span className="property-filter-status" role="status" aria-live="polite">
        {value && typeof matchCount === 'number'
          ? `${matchCount} ${matchCount === 1 ? 'property' : 'properties'} match ${value}`
          : ''}
      </span>
    </div>
  );
}
