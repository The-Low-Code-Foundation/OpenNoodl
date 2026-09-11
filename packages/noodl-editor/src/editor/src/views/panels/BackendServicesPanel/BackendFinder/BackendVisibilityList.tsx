/**
 * TUT-001 — the one list component both the panel and the finder draw through.
 *
 * A backend card takes a dozen props (start, stop, rename, delete, deploy cloud functions, the
 * ACTIVE badge, the conflict note, who else uses it). The finder has to draw the **same** card as
 * the panel — R1's answer depends on it, because Stop lives on that card and the finder is the only
 * place a hidden running backend can be reached — and a second copy of a dozen-prop call site is a
 * second copy that drifts. So the panel builds one `renderRow` and hands it to both.
 *
 * 🔴 This component is deliberately hook-free, which is what makes it gradeable: the panel calls
 * hooks and `LocalBackendCard` imports `common/Icon` (webpack's `require.context`, which ts-jest
 * rejects), so neither can be loaded by `tests-unit`'s runner. This one can — and with it, the
 * claim that *exactly one* card is drawn for a machine carrying seven backends.
 *
 * @module BackendServicesPanel/BackendFinder/BackendVisibilityList
 * @since 1.2.0
 */
import React from 'react';

import type { VisibilityCandidate } from '../backendVisibility';

export interface BackendVisibilityListProps {
  candidates: VisibilityCandidate[];
  /** Draws one backend as its own kind of card. Built once by the panel, shared with the finder. */
  renderRow: (candidate: VisibilityCandidate) => React.ReactNode;
  /** Drawn when `candidates` is empty — "no backend attached", or "nothing matched". */
  emptySlot?: React.ReactNode;
}

export function BackendVisibilityList({ candidates, renderRow, emptySlot }: BackendVisibilityListProps) {
  if (candidates.length === 0) return <>{emptySlot ?? null}</>;

  return (
    <>
      {candidates.map((candidate) => (
        <React.Fragment key={candidate.id}>{renderRow(candidate)}</React.Fragment>
      ))}
    </>
  );
}
