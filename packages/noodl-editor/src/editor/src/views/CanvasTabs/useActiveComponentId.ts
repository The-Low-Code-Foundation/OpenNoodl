import { useEventListener } from '@noodl-hooks/useEventListener';
import { useState } from 'react';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { getActiveComponentId } from './tabNavigation';

/**
 * VFN-004 — the id of the component currently on the node graph canvas, kept current.
 *
 * 🔴 This is a **derivation**, not a store. The active component lives on `NodeGraphEditor` and
 * nowhere else; this reads it when it changes so React can paint the away mark. The same rule the
 * window's own visibility follows — derived from which tabs are open and from nothing else — and
 * for the same reason: a second copy of one fact is a defect this directory keeps finding.
 *
 * `activeComponentChanged` is emitted on `EventDispatcher.instance` by
 * `NodeGraphEditor.switchToComponent`, and only when the component actually changes. The seed
 * matters as much as the subscription: the Logic Builder window mounts long after a component is
 * already open, so a hook that waited for the next event would report "nowhere" — and therefore
 * "away" — for every tab until the user navigated.
 *
 * This is the same shape `ExecutionOverlay` uses to follow the canvas, deliberately.
 */
export function useActiveComponentId(): string | undefined {
  const [activeComponentId, setActiveComponentId] = useState<string | undefined>(() => getActiveComponentId());

  useEventListener(EventDispatcher.instance, 'activeComponentChanged', () => {
    setActiveComponentId(getActiveComponentId());
  });

  return activeComponentId;
}
