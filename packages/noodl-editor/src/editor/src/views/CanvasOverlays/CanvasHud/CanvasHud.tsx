import { useKeyboardCommands } from '@noodl-hooks/useKeyboardCommands';
import React, { useEffect, useState } from 'react';

import { Keybindings } from '@noodl-constants/Keybindings';
import { SidebarModel } from '@noodl-models/sidebar';
import { SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';

import { AiAuthoringPanel_ID } from '../../panels/AiAuthoringPanel';
import css from './CanvasHud.module.scss';

export interface CanvasHudProps {
  /** Current canvas zoom, already rounded to a percentage. */
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomToFit: () => void;
  /** False on read-only canvases (diff/review documents) — no authoring there. */
  showAiPill: boolean;
}

/**
 * PAR-003: the two DOM overlays over the node-graph canvas from the editor
 * mock — the "Ask AI" pill (bottom-left) and the zoom cluster (bottom-right).
 * Pure presentation over real signals:
 *
 * - The AI pill opens the AIX-002 authoring loop UI (the "Build" side panel)
 *   and only renders while that panel is actually registered/enabled in the
 *   SidebarModel — bind-or-omit, no dead UI. Cmd/Ctrl+J does the same.
 * - The zoom cluster drives the canvas viewport API (ViewportActions) that
 *   mouse-wheel zoom already uses; fit binds to the existing center-to-fit.
 */
export function CanvasHud({ zoomPercent, onZoomIn, onZoomOut, onZoomToFit, showAiPill }: CanvasHudProps) {
  const [aiPanelAvailable, setAiPanelAvailable] = useState(() =>
    Boolean(SidebarModel.instance.getPanel(AiAuthoringPanel_ID))
  );

  useEffect(() => {
    const group = {};
    SidebarModel.instance.on(
      SidebarModelEvent.itemsChanged,
      () => setAiPanelAvailable(Boolean(SidebarModel.instance.getPanel(AiAuthoringPanel_ID))),
      group
    );
    return () => {
      SidebarModel.instance.off(group);
    };
  }, []);

  const aiEnabled = showAiPill && aiPanelAvailable;

  function openAiPanel() {
    SidebarModel.instance.switch(AiAuthoringPanel_ID);
  }

  useKeyboardCommands(
    () =>
      aiEnabled
        ? [
            {
              handler: openAiPanel,
              keybinding: Keybindings.OPEN_AI_PANEL.hash
            }
          ]
        : [],
    [aiEnabled]
  );

  return (
    <>
      {aiEnabled && (
        <button className={css.AiPill} onClick={openAiPanel} data-test="canvas-ai-pill">
          <span className={css.AiPillSpark} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1.5c.5 2.9 1.6 4 4.5 4.5-2.9.5-4 1.6-4.5 4.5-.5-2.9-1.6-4-4.5-4.5 2.9-.5 4-1.6 4.5-4.5ZM12.8 9.5c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5Z" />
            </svg>
          </span>
          Ask AI…
          <kbd>{Keybindings.OPEN_AI_PANEL.label}</kbd>
        </button>
      )}

      <div className={css.ZoomCluster} data-test="canvas-zoom-cluster">
        <button aria-label="Zoom out" onClick={onZoomOut}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M3.5 8h9" />
          </svg>
        </button>
        <span className={css.ZoomValue}>{zoomPercent}%</span>
        <button aria-label="Zoom in" onClick={onZoomIn}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M8 3.5v9M3.5 8h9" />
          </svg>
        </button>
        <button aria-label="Fit view" onClick={onZoomToFit}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 2.5H3.5c-.6 0-1 .4-1 1V6M10 2.5h2.5c.6 0 1 .4 1 1V6M6 13.5H3.5c-.6 0-1-.4-1-1V10M10 13.5h2.5c.6 0 1-.4 1-1V10" />
          </svg>
        </button>
      </div>
    </>
  );
}
