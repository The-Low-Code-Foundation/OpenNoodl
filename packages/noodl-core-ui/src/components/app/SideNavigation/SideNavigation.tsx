import classNames from 'classnames';
import React, { useRef, useState } from 'react';

import {
  SideNavigationContextProvider,
  useSideNavigationContext
} from '@noodl-core-ui/components/app/SideNavigation/SideNavigation.context';
import { IconName } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonState, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { DialogRenderDirection } from '@noodl-core-ui/components/layout/BaseDialog';
import { MenuDialog, MenuDialogProps } from '@noodl-core-ui/components/popups/MenuDialog';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';
import { Label, LabelSize } from '@noodl-core-ui/components/typography/Label';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';
import { Slot } from '@noodl-core-ui/types/global';

import css from './SideNavigation.module.scss';

export interface SideNavigationButtonProps {
  isActive?: boolean;
  icon: IconName;
  label: string;
  fineType?: string;
  notification?: { count: number };
  isDisabled?: boolean;
  testId?: string;
  onClick?: () => void;
  menuItems?: MenuDialogProps['items'];
}

export function SideNavigationButton({
  isActive,
  icon,
  label,
  fineType,
  notification,
  isDisabled,
  testId,
  onClick,
  menuItems
}: SideNavigationButtonProps) {
  const context = useSideNavigationContext();
  const iconRef = useRef<HTMLDivElement>(null);
  const hasMenu = Boolean(menuItems);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // NOTE: Commented out extending sidebar labels in case we want to bring them back at some point

  return (
    <div
      className={css['SideNavigationButton']}
      onClick={() => {
        !isDisabled && onClick && onClick();
        //context.setIsShowingTooltips(false);
      }}
      // onMouseEnter={() => context.setIsShowingTooltips(true)}
      // onMouseLeave={() => context.setIsShowingTooltips(false)}
      data-test={testId}
    >
      {hasMenu && (
        <MenuDialog
          items={menuItems}
          onClose={() => setIsMenuVisible(false)}
          triggerRef={iconRef}
          isVisible={isMenuVisible}
        />
      )}

      <div className={css['IconButtonContainer']} ref={iconRef} onClick={() => hasMenu && setIsMenuVisible(true)}>
        <Tooltip
          content={label}
          fineType={fineType}
          renderDirection={DialogRenderDirection.Horizontal}
          showAfterMs={300}
        >
          <IconButton
            variant={IconButtonVariant.Transparent}
            state={isActive ? IconButtonState.Active : IconButtonState.Default}
            icon={icon}
            isDisabled={isDisabled}
          />
        </Tooltip>
        {notification && (
          <div className={css['NotificationBadge']}>{notification.count > 99 ? '99+' : notification.count}</div>
        )}
      </div>

      {/* <div
        className={classNames(css['Label'], context.isShowingTooltips && css['is-tooltip-visible'])}
        onClick={() => hasMenu && setIsMenuVisible(true)}
      >
        <div className={classNames(css['LabelInner'], isActive && css['is-active'])}>
          <Text textType={isActive ? TextType.Proud : TextType.Shy}>{label}</Text>
          {fineType && (
            <Label size={LabelSize.Small} variant={TextType.Shy} UNSAFE_className={css['Command']}>
              {fineType}
            </Label>
          )}
        </div>
      </div> */}
    </div>
  );
}

export interface SideNavigationProps {
  toolbar: Slot;
  panel: Slot;

  onExitClick?: React.MouseEventHandler<HTMLDivElement>;

  /**
   * PNL-009: how the panel is presented — beside the canvas, over it as a card,
   * or filling the editor area. **Purely CSS**: the panel element keeps the same
   * parent in every mode. Several panels host legacy imperative views through
   * `Frame`, and re-parenting their DOM subtree would unmount and remount views
   * that bind listeners in `render()` and hold direct DOM references.
   */
  panelMode?: 'docked' | 'floating' | 'full';
  /**
   * Where the detached panel sits, in viewport coordinates. Measured by the
   * host from the real editor area rather than guessed from a title-bar
   * constant, and applied for both detached modes.
   */
  panelStyle?: React.CSSProperties;
}

// PNL-003: `isExpanded` is gone. It existed only for the topology panel, whose
// registration has been commented out since it was shelved, so both the prop and
// the `55vw` rule it drove were unreachable. The idea it prototyped — a wide
// mode — is now general and lives in useSidePanelLayout.
export function SideNavigation({
  toolbar,
  panel,
  onExitClick,
  panelMode = 'docked',
  panelStyle
}: SideNavigationProps) {
  return (
    <SideNavigationContextProvider>
      <div className={classNames(css['Root'], panelMode !== 'docked' && css['is-panel-detached'])}>
        <div
          className={classNames(css['Panel'], panelMode !== 'docked' && css[`is-panel-${panelMode}`])}
          style={panelMode === 'docked' ? undefined : panelStyle}
        >
          {panel}
        </div>

        <div className={css['Toolbar']}>
          <div className={css['Logo']}>
            <Tooltip content="Back to projects" renderDirection={DialogRenderDirection.Horizontal} showAfterMs={300}>
              <button
                className={css['BrandExit']}
                aria-label="Back to projects"
                onClick={(e) => onExitClick?.(e as unknown as React.MouseEvent<HTMLDivElement>)}
              >
                <span className={css['BrandDot']} />
                <svg
                  className={css['BrandArrow']}
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M13 8H3.5M7.5 4 3.5 8l4 4" />
                </svg>
              </button>
            </Tooltip>
          </div>

          {toolbar}
        </div>
      </div>
    </SideNavigationContextProvider>
  );
}
