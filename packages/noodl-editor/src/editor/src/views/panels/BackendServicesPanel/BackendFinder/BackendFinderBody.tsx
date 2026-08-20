/**
 * TUT-001 — the finder's contents: three filters and whatever survives them.
 *
 * Split out of {@link BackendFinderDialog} and kept **hook-free** on purpose. The dialog holds the
 * query state and the `Modal` chrome; this half is a pure function from (rows, query) to elements,
 * so `tests-unit` can assert that a filter which excludes nothing fails — the one property a
 * finder over fifteen backends actually has to have.
 *
 * The rows it draws are the **same cards** the panel draws, through the `renderRow` the panel
 * builds once. That is not tidiness: R1's answer requires that a hidden running backend can be
 * stopped from here, and Stop lives on `LocalBackendCard`.
 *
 * @module BackendServicesPanel/BackendFinder/BackendFinderBody
 * @since 1.2.0
 */
import React from 'react';

import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { FinderQuery, VisibilityCandidate, filterFinderRows } from '../backendVisibility';
import { BackendVisibilityList } from './BackendVisibilityList';
import css from './BackendFinder.module.scss';

export interface BackendFinderBodyProps {
  /** Everything the panel is not showing — `BackendVisibility.others`. */
  rows: VisibilityCandidate[];
  query: FinderQuery;
  onQueryChange: (query: FinderQuery) => void;
  renderRow: (candidate: VisibilityCandidate) => React.ReactNode;
}

export function BackendFinderBody({ rows, query, onQueryChange, renderRow }: BackendFinderBodyProps) {
  const matches = filterFinderRows(rows, query);
  const set = (patch: Partial<FinderQuery>) => onQueryChange({ ...query, ...patch });

  return (
    <VStack>
      <Box hasBottomSpacing>
        <TextInput
          value={query.name ?? ''}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Search by name"
          testId="backend-finder-name"
        />
      </Box>

      <div className={css.FilterRow}>
        <TextInput
          value={query.createdFrom ?? ''}
          onChange={(e) => set({ createdFrom: e.target.value })}
          placeholder="Created after (YYYY-MM-DD)"
          testId="backend-finder-created-from"
        />
        <TextInput
          value={query.createdTo ?? ''}
          onChange={(e) => set({ createdTo: e.target.value })}
          placeholder="Created before (YYYY-MM-DD)"
          testId="backend-finder-created-to"
        />
      </div>

      <Box hasTopSpacing hasBottomSpacing>
        <TextInput
          value={query.project ?? ''}
          onChange={(e) => set({ project: e.target.value })}
          placeholder="Used by project"
          testId="backend-finder-project"
        />
      </Box>

      {/* The count is the honest part of a filtered list: "3 of 14" says both that something was
          hidden and how much, where a bare list of three says neither. */}
      <Box hasBottomSpacing>
        <Text textType={TextType.Shy} testId="backend-finder-count">
          {matches.length === rows.length
            ? `${rows.length} backend${rows.length === 1 ? '' : 's'}`
            : `${matches.length} of ${rows.length}`}
        </Text>
      </Box>

      <BackendVisibilityList
        candidates={matches}
        renderRow={renderRow}
        emptySlot={
          <Box hasTopSpacing hasBottomSpacing>
            <Text textType={TextType.Shy} testId="backend-finder-empty">
              {rows.length === 0
                ? 'This computer has no other backends.'
                : 'No backend matches those filters.'}
            </Text>
          </Box>
        }
      />
    </VStack>
  );
}
