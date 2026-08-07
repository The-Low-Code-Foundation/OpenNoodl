import useTimeout from '@noodl-hooks/useTimeout';
import classNames from 'classnames';
import React, { useRef, useState } from 'react';

import { BaseDialog, DialogBackground, DialogRenderDirection } from '@noodl-core-ui/components/layout/BaseDialog';
import { Label, LabelSize } from '@noodl-core-ui/components/typography/Label';
import { TextType } from '@noodl-core-ui/components/typography/Text';
import { SingleSlot, Slot, UnsafeStyleProps } from '@noodl-core-ui/types/global';

import css from './Tooltip.module.scss';

export interface TooltipProps extends UnsafeStyleProps {
  content: SingleSlot;
  fineType?: string;
  children: Slot;
  showAfterMs?: number;

  renderDirection?: DialogRenderDirection;

  isInline?: boolean;
  isNotHiddenOnClick?: boolean;

  /**
   * HACK: Temporary solution to get a wider tooltip.
   */
  UNSAFE_tooltipMaxWidth?: string;
  UNSAFE_triggerClassName?: string;
}

export function Tooltip({
  content,
  fineType,
  children,
  renderDirection,
  isNotHiddenOnClick,
  isInline,

  showAfterMs = 900,

  UNSAFE_tooltipMaxWidth,
  UNSAFE_style,
  UNSAFE_className,
  UNSAFE_triggerClassName
}: TooltipProps) {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [isTimeoutRunning, setIsTimeoutRunning] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  // hovering the trigger sets triggers a timeout flag and not
  // tooltip visibility flag. this way we can cancel the timeout
  // if the user has stopped hovering before 500ms has passed
  useTimeout(() => setIsTooltipVisible(true), isTimeoutRunning ? showAfterMs : null);

  function reset() {
    setIsTimeoutRunning(false);
    setIsTooltipVisible(false);
  }

  if (!content) return <>{children}</>;

  return (
    <>
      <BaseDialog
        isVisible={isTooltipVisible}
        triggerRef={triggerRef}
        renderDirection={renderDirection}
        hasArrow
        /* POL-004: `Secondary` painted the ARROW near-white in dark mode and
           near-black in light, while the tooltip body below sets its own
           `--theme-color-bg-4`. Every tooltip in the editor had a mismatched
           arrow; nobody reported it because an arrow is 8px. `Default` maps to
           bg-4, which is exactly what `.Root` uses — so the two now agree by
           construction rather than by coincidence. */
        background={DialogBackground.Default}
      >
        <div className={css['Root']} style={{ maxWidth: UNSAFE_tooltipMaxWidth }}>
          {typeof content === 'string' ? (
            <Label variant={TextType.Proud} size={LabelSize.Medium}>
              {content}
            </Label>
          ) : (
            content
          )}
        </div>

        {fineType && (
          <div className={css['FineType']}>
            <Label size={LabelSize.Small} variant={TextType.Secondary}>
              {fineType}
            </Label>
          </div>
        )}
      </BaseDialog>

      <div
        ref={triggerRef}
        className={classNames(
          css['Trigger'],
          isInline && css['is-inline'],
          !isInline && css['is-block'],
          UNSAFE_triggerClassName,
          UNSAFE_className
        )}
        style={UNSAFE_style}
        onMouseOver={() => setIsTimeoutRunning(true)}
        onMouseOut={() => reset()}
        onClick={() => !isNotHiddenOnClick && reset()}
      >
        {children}
      </div>
    </>
  );
}
