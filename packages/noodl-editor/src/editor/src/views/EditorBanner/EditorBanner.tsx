/**
 * EditorBanner
 *
 * Warning banner shown when the whole project is opened in read-only mode
 * (an explicit choice from the launcher). Only says what read-only means —
 * it makes no claim about *why* the project was opened that way.
 *
 * @module noodl-editor/views/EditorBanner
 * @since 1.2.0
 */

import React, { useState } from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './EditorBanner.module.scss';

// =============================================================================
// Types
// =============================================================================

export interface EditorBannerProps {
  /** Called when user dismisses the banner */
  onDismiss: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function EditorBanner({ onDismiss }: EditorBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss();
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div className={css['EditorBanner']}>
      {/* Warning Icon */}
      <div className={css['Icon']}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10 6V11M10 14H10.01M19 10C19 14.9706 14.9706 19 10 19C5.02944 19 1 14.9706 1 10C1 5.02944 5.02944 1 10 1C14.9706 1 19 5.02944 19 10Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Message Content */}
      <div className={css['Content']}>
        <div className={css['Title']}>
          <Text textType={TextType.Default}>Read-Only Mode</Text>
        </div>
        <div className={css['Description']}>
          <Text textType={TextType.Secondary}>
            This project was opened read-only — changes will not be saved. Reopen it from the launcher to edit.
          </Text>
        </div>
      </div>

      {/* Close Button */}
      <div className={css['CloseButton']}>
        <IconButton icon={IconName.Close} onClick={handleDismiss} variant={IconButtonVariant.Transparent} />
      </div>
    </div>
  );
}

export default EditorBanner;
