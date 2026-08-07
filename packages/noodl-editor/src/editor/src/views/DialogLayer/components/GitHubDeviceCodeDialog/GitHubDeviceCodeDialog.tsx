/**
 * F63 — the surface the device flow cannot work without.
 *
 * GitHub's device flow hands back a short code and a URL, and the person has to
 * type the one into the other. ⚠️ GitHub does **not** return
 * `verification_uri_complete`, so the code cannot ride in the URL and the
 * browser tab that just opened asks for something only this dialog knows. A
 * sign-in with no visible code is a sign-in that cannot complete — this is not
 * progress reporting, it is half the mechanism.
 *
 * Three things follow from that:
 *
 * 1. **It opens itself.** `installGitHubDeviceFlowDialog` listens on the
 *    service, so every Connect button in the editor (the version-control
 *    credentials section, the GitHub issues section, the connect-to-GitHub
 *    empty state) gets the code without any of them knowing this exists. Three
 *    call sites, one surface, and no fourth one to forget.
 * 2. **It stays up until it resolves.** `CoreBaseDialog` is given no
 *    `onClose`, so a stray backdrop click cannot dismiss the only copy of the
 *    code while the user is halfway through typing it. Cancel is a button.
 * 3. **The four endings say four different things.** Signed in, refused,
 *    expired, and broken are not the same event, and "please try again" is
 *    wrong advice for someone who has just deliberately pressed Cancel on
 *    github.com.
 */

import { useEventListener } from '@noodl-hooks/useEventListener';
import React, { useState } from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { CoreBaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { GitHubOAuthService, type GitHubDeviceCode } from '../../../../services/GitHubOAuthService';
import css from './GitHubDeviceCodeDialog.module.scss';

export interface GitHubDeviceCodeDialogProps {
  device: GitHubDeviceCode;
  onClose: () => void;
}

type Stage = 'waiting' | 'signed-in' | 'failed';

export function GitHubDeviceCodeDialog({ device, onClose }: GitHubDeviceCodeDialogProps) {
  const service = GitHubOAuthService.instance;

  const [stage, setStage] = useState<Stage>('waiting');
  const [username, setUsername] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ code: string; message: string } | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  useEventListener(service, 'oauth-success', (event: { user?: { login?: string } }) => {
    setUsername(event?.user?.login ?? null);
    setStage('signed-in');
  });

  useEventListener(service, 'oauth-error', (event: { error: string; code?: string }) => {
    setFailure({ code: event?.code ?? 'unknown_error', message: event?.error ?? 'GitHub sign-in failed.' });
    setStage('failed');
  });

  // A second flow started while this one was open replaces the code in place,
  // rather than leaving a stale one on screen next to a live poll.
  useEventListener(service, 'oauth-device-code', () => {
    setStage('waiting');
    setFailure(null);
    setHasCopied(false);
  });

  const copyCode = () => {
    navigator.clipboard.writeText(device.userCode).then(
      () => setHasCopied(true),
      () => setHasCopied(false)
    );
  };

  const cancel = () => {
    service.cancelOAuth().catch(() => {
      /* Cancelling a flow that already ended is not an error worth showing. */
    });
    onClose();
  };

  return (
    <CoreBaseDialog title="Connect your GitHub account" isVisible hasBackdrop>
      <Box hasXSpacing hasYSpacing UNSAFE_style={{ maxWidth: '420px' }}>
        {stage === 'waiting' && (
          <VStack>
            <Text hasBottomSpacing>
              We opened <span className={css['Url']}>{device.verificationUri}</span> in your browser. Enter this code
              there to finish signing in.
            </Text>

            <div className={css['Code']} data-test="github-device-code">
              {device.userCode}
            </div>

            <Box hasBottomSpacing>
              <HStack hasSpacing>
                <PrimaryButton
                  label={hasCopied ? 'Copied' : 'Copy code'}
                  icon={hasCopied ? IconName.Check : IconName.Copy}
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Muted}
                  onClick={copyCode}
                  testId="copy-github-device-code"
                />
              </HStack>
            </Box>

            <Text textType={TextType.Shy} hasBottomSpacing>
              Waiting for you to enter the code on GitHub. This window will update on its own — the code is valid for
              about {Math.max(1, Math.round((device.expiresIn || 900) / 60))} minutes.
            </Text>

            {/* Button convention (UIX-004): primary on the right. There is no
                primary action here — the primary action is happening in the
                browser — so Cancel stands alone, muted. */}
            <HStack hasSpacing>
              <PrimaryButton
                label="Cancel"
                variant={PrimaryButtonVariant.Muted}
                size={PrimaryButtonSize.Small}
                onClick={cancel}
              />
            </HStack>
          </VStack>
        )}

        {stage === 'signed-in' && (
          <VStack>
            <Text hasBottomSpacing>
              Signed in{username ? ' as ' : ''}
              {username ? <strong>{username}</strong> : ''}. Your GitHub account is connected.
            </Text>
            <HStack hasSpacing>
              <PrimaryButton label="Done" size={PrimaryButtonSize.Small} onClick={onClose} />
            </HStack>
          </VStack>
        )}

        {stage === 'failed' && (
          <VStack>
            {/* The message comes from the main process, which is the only side
                that knows *which* of `access_denied`, `expired_token`,
                `device_flow_disabled` or a network failure happened. Re-deriving
                the wording here would be a second place to forget a case. */}
            <Text hasBottomSpacing>{failure?.message}</Text>

            <HStack hasSpacing>
              <PrimaryButton
                label="Close"
                variant={PrimaryButtonVariant.Muted}
                size={PrimaryButtonSize.Small}
                onClick={onClose}
              />
              {/* Offered for the endings that a retry can actually fix. A user
                  who just pressed Cancel on GitHub is not asked to try again,
                  and neither is one whose OAuth app has device flow switched
                  off — nothing they do in this dialog changes either. */}
              {failure && ['expired_token', 'network_error', 'incorrect_device_code'].includes(failure.code) && (
                <PrimaryButton
                  label="Try again"
                  size={PrimaryButtonSize.Small}
                  onClick={() => {
                    onClose();
                    service.initiateOAuth().catch(() => {
                      /* The failure re-opens this dialog through the service. */
                    });
                  }}
                />
              )}
            </HStack>
          </VStack>
        )}
      </Box>
    </CoreBaseDialog>
  );
}
