/**
 * AIX-004 — Explain Mode: what to explain
 *
 * Answers "what has the user pointed at" from two sources, in order:
 *
 *  1. The live canvas selection, which survives a multi-select (dragging a
 *     marquee does not switch the sidebar) and is therefore still readable.
 *  2. The remembered target from ./explainTarget, for the far more common case —
 *     clicking a single node, which opens its property panel and, on the way,
 *     deselects everything. See that module for why a live read is not enough.
 *
 * Falls back to no selection, which means whole-component scope.
 *
 * @module noodl-editor/views/panels/ExplainPanel/hooks/useCanvasSelection
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import { useEventListener } from '@noodl-hooks/useEventListener';
import { useEffect, useState } from 'react';

import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';
import { EXPLAIN_TARGET_CHANGED, rememberedTarget } from '../explainTarget';

export interface CanvasSelection {
  /** Full name of the active component, or null when no component is open. */
  componentName: string | null;
  selectedNodeIds: string[];
  /** True when the ids came from the remembered target rather than a live read. */
  isRemembered: boolean;
}

function readSelection(): CanvasSelection {
  const nodeGraph = NodeGraphContextTmp.nodeGraph;
  const component = nodeGraph?.activeComponent;
  if (!component) return { componentName: null, selectedNodeIds: [], isRemembered: false };

  // A view node's `id` is copied from its model's, so this is the graph id.
  const live = (nodeGraph?.getSelectedNodes?.() ?? []).map((node) => node?.id).filter(Boolean);
  if (live.length) {
    return { componentName: component.fullName, selectedNodeIds: live, isRemembered: false };
  }

  const target = rememberedTarget();
  return {
    componentName: component.fullName,
    selectedNodeIds: target ? target.nodeIds : [],
    isRemembered: Boolean(target)
  };
}

export function useCanvasSelection(): CanvasSelection {
  const [selection, setSelection] = useState<CanvasSelection>(readSelection);

  useEffect(() => setSelection(readSelection()), []);

  useEventListener(EventDispatcher.instance, EXPLAIN_TARGET_CHANGED, () => setSelection(readSelection()), []);

  useEventListener(EventDispatcher.instance, 'activeComponentChanged', () => setSelection(readSelection()), []);

  return selection;
}
