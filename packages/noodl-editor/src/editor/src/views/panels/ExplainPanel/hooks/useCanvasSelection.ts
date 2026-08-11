/**
 * AIX-004 — Explain Mode: what to explain
 *
 * Answers "what has the user pointed at" from two sources, in order:
 *
 *  1. The live canvas selection, which since FH-008 survives opening this panel
 *     (see `panelHoldsCanvasSelection` in EditorEventBindings).
 *  2. The remembered target from ./explainTarget, for the paths where the live
 *     read cannot see it.
 *
 * Falls back to no selection, which means whole-component scope.
 *
 * **Read on becoming visible, not on mount.** Sidebar panels are hidden behind
 * `display: none`, never unmounted, so a panel constructed the first time it is
 * opened would answer with that first selection forever. The caller passes
 * whether it is the active panel and every transition into active re-reads.
 *
 * @module noodl-editor/views/panels/ExplainPanel/hooks/useCanvasSelection
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import { useEventListener } from '@noodl-hooks/useEventListener';
import { useCallback, useEffect, useState } from 'react';

import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';
import { EXPLAIN_TARGET_CHANGED, rememberedTarget } from '../explainTarget';

export interface CanvasSelection {
  /** Full name of the active component, or null when no component is open. */
  componentName: string | null;
  /**
   * LEG-006 — the active component's own sentence, when it has one. The panel
   * already scopes to a component and offers "Explain this component"; it had
   * the target and lacked the sentence, which is the cheapest place in the
   * editor to read one.
   */
  componentDescription: string | null;
  selectedNodeIds: string[];
  /** True when the ids came from the remembered target rather than a live read. */
  isRemembered: boolean;
}

function readSelection(): CanvasSelection {
  const nodeGraph = NodeGraphContextTmp.nodeGraph;
  const component = nodeGraph?.activeComponent;
  if (!component) {
    return { componentName: null, componentDescription: null, selectedNodeIds: [], isRemembered: false };
  }

  const description = typeof component.description === 'string' && component.description.trim().length > 0
    ? component.description.trim()
    : null;

  // A view node's `id` is copied from its model's, so this is the graph id.
  const live = (nodeGraph?.getSelectedNodes?.() ?? []).map((node) => node?.id).filter(Boolean);
  if (live.length) {
    return {
      componentName: component.fullName,
      componentDescription: description,
      selectedNodeIds: live,
      isRemembered: false
    };
  }

  const target = rememberedTarget();
  return {
    componentName: component.fullName,
    componentDescription: description,
    selectedNodeIds: target ? target.nodeIds : [],
    isRemembered: Boolean(target)
  };
}

function isSameSelection(a: CanvasSelection, b: CanvasSelection): boolean {
  return (
    a.componentName === b.componentName &&
    a.componentDescription === b.componentDescription &&
    a.isRemembered === b.isRemembered &&
    a.selectedNodeIds.length === b.selectedNodeIds.length &&
    a.selectedNodeIds.every((id, index) => id === b.selectedNodeIds[index])
  );
}

export function useCanvasSelection(isPanelActive = true): CanvasSelection {
  const [selection, setSelection] = useState<CanvasSelection>(readSelection);

  const refresh = useCallback(
    () =>
      setSelection((previous) => {
        const next = readSelection();
        return isSameSelection(previous, next) ? previous : next;
      }),
    []
  );

  useEffect(() => {
    if (isPanelActive) refresh();
  }, [isPanelActive]);

  // A marquee on the canvas changes the selection without touching the sidebar,
  // and the canvas emits nothing for it — so while this panel is the visible one
  // there is no notification to subscribe to. The end of any mouse gesture is
  // the cheapest honest moment to look again; the compare above keeps a gesture
  // that changed nothing from re-rendering the panel.
  useEffect(() => {
    if (!isPanelActive) return;
    document.addEventListener('mouseup', refresh);
    return () => document.removeEventListener('mouseup', refresh);
  }, [isPanelActive]);

  useEventListener(EventDispatcher.instance, EXPLAIN_TARGET_CHANGED, refresh, []);

  useEventListener(EventDispatcher.instance, 'activeComponentChanged', refresh, []);

  return selection;
}
