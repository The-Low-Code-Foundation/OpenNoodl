/**
 * TUT-001 — the finder: every backend the panel is not showing, and three ways to find one.
 *
 * Richard, 2026-08-19: *"just one database visible, the one that's currently attached or was
 * previously attached to the project, and all the other databases go into a search modal or
 * something that makes them invisible until you want to find them."* This is the modal.
 *
 * It holds one piece of state — the query — and delegates everything else. The contents are
 * {@link BackendFinderBody}, which is hook-free so the filtering can be graded without a DOM.
 *
 * @module BackendServicesPanel/BackendFinder/BackendFinderDialog
 * @since 1.2.0
 */
import React, { useState } from 'react';

import { Modal } from '@noodl-core-ui/components/layout/Modal';

import { FinderQuery, VisibilityCandidate } from '../backendVisibility';
import { BackendFinderBody } from './BackendFinderBody';

export interface BackendFinderDialogProps {
  isVisible: boolean;
  onClose: () => void;
  /** `BackendVisibility.others` — everything the panel is not showing. */
  rows: VisibilityCandidate[];
  /** The panel's one card renderer, so a backend looks and behaves the same in both places. */
  renderRow: (candidate: VisibilityCandidate) => React.ReactNode;
}

export function BackendFinderDialog({ isVisible, onClose, rows, renderRow }: BackendFinderDialogProps) {
  const [query, setQuery] = useState<FinderQuery>({});

  return (
    <Modal
      isVisible={isVisible}
      onClose={onClose}
      title="All backends on this computer"
      subtitle="Every backend this editor knows about, including the ones no open project is using. Starting or stopping one here does not change which backend this project points at."
    >
      <BackendFinderBody rows={rows} query={query} onQueryChange={setQuery} renderRow={renderRow} />
    </Modal>
  );
}
