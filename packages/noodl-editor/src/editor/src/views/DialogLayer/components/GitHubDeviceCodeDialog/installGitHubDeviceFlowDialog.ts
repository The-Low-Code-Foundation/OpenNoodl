/**
 * F63 — wires the device-code dialog to whichever Connect button was pressed.
 *
 * There are three of them (the version-control credentials section, the GitHub
 * issues section, and the connect-to-GitHub empty state) and they all reach the
 * same singleton, so the dialog is opened by *the service's event*, not by any
 * of them. None has to know this file exists, and a fourth Connect button added
 * later gets the code for free — which matters more than it sounds, because a
 * device flow whose code is never shown looks exactly like a hung sign-in.
 *
 * Modelled on `installReportProblemListener`: installed once from
 * `createDialogLayer()`, idempotent because HMR re-runs module bodies and a
 * second listener would stack two dialogs per sign-in.
 *
 * @module views/DialogLayer/components/GitHubDeviceCodeDialog/installGitHubDeviceFlowDialog
 */

import React from 'react';

import { DialogLayerModel } from '@noodl-models/DialogLayerModel';

import { GitHubOAuthService, type GitHubDeviceCode } from '../../../../services/GitHubOAuthService';
import { GitHubDeviceCodeDialog } from './GitHubDeviceCodeDialog';

/** Stable, so a second sign-in replaces the dialog rather than stacking one. */
const DIALOG_ID = 'f63-github-device-code';

let installed = false;

export function openGitHubDeviceCodeDialog(device: GitHubDeviceCode): void {
  DialogLayerModel.instance.showDialog(
    (close) => React.createElement(GitHubDeviceCodeDialog, { device, onClose: close }),
    { id: DIALOG_ID }
  );
}

export function installGitHubDeviceFlowDialog(): void {
  if (installed) return;
  installed = true;

  // The group argument is `null` deliberately: `EventDispatcher#off` removes by
  // group, and this listener is meant to live as long as the window.
  GitHubOAuthService.instance.on(
    'oauth-device-code',
    (device: GitHubDeviceCode) => {
      if (!device || !device.userCode) return;
      openGitHubDeviceCodeDialog(device);
    },
    null
  );
}
