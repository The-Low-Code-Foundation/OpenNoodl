/**
 * ALPHA-007 §1 — the renderer end of `Help → Report a problem…`.
 *
 * The main process captures the screenshot in the menu click handler and then
 * sends `report-problem`; this opens the composer with what it captured. The
 * dialog goes into the DialogLayer, which is a sibling of the PopupLayer rather
 * than part of it — so an open menu or modal stays open behind it, which is §1's
 * design law.
 *
 * `showDialog` is given a stable `id`, so a reporter who hits the menu item
 * twice gets the same dialog rather than two stacked composers.
 *
 * @module views/DialogLayer/components/ReportProblemDialog/installReportProblemListener
 */

import { ipcRenderer } from 'electron';
import React from 'react';

import { DialogLayerModel } from '@noodl-models/DialogLayerModel';

import { installErrorCapture } from '@noodl-utils/report/errorTail';
import { ReportProblemDialog } from './ReportProblemDialog';

const DIALOG_ID = 'alpha-007-report-problem';

let installed = false;

export function openReportProblemDialog(payload: {
  captureId: string | null;
  preview: string | null;
  capturedAt: string;
}) {
  DialogLayerModel.instance.showDialog(
    (close) =>
      React.createElement(ReportProblemDialog, {
        captureId: payload?.captureId ?? null,
        preview: payload?.preview ?? null,
        capturedAt: payload?.capturedAt || new Date().toISOString(),
        onClose: close
      }),
    { id: DIALOG_ID }
  );
}

/**
 * Idempotent: HMR re-runs module bodies, and a second `ipcRenderer.on` would
 * open two composers per click.
 */
export function installReportProblemListener(): void {
  if (installed) return;
  installed = true;

  // The error tail has to be collecting *before* anything goes wrong, which is
  // why it is armed here rather than when the dialog opens.
  installErrorCapture();

  ipcRenderer.on('report-problem', (_event, payload) => openReportProblemDialog(payload));
}
