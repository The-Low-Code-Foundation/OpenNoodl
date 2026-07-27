import { getCurrentWindow, screen } from '@electron/remote';
import React from 'react';
import { createRoot } from 'react-dom/client';

import { DialogRenderDirection } from '@noodl-core-ui/components/layout/BaseDialog';
import { MenuDialog, MenuDialogItem, MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';

import PopupLayer from './popuplayer';

interface ShowContextMenuInPopupArgs {
  title?: string;
  items: (MenuDialogItem | 'divider')[];
  width?: MenuDialogWidth;
  renderDirection?: DialogRenderDirection;

  /**
   * PNL-009: anchor the menu to an element instead of to the mouse.
   *
   * The default anchor is `screen.getCursorScreenPoint()`, which is right for a
   * right-click but wrong for a menu opened *from a button*: the button may be
   * activated by the keyboard, and in a floating panel the panel moves while the
   * cursor does not. It is also why a cursor-anchored menu cannot be asserted on
   * by a script — a synthesised click does not move the OS cursor, so the menu
   * appears wherever the human's mouse happens to be.
   */
  attachTo?: HTMLElement;

  /** Where the menu sits relative to its anchor. Only read with `attachTo`. */
  position?: 'bottom' | 'top' | 'left' | 'right';
}

export function showContextMenuInPopup({
  title,
  items,
  width,
  attachTo,
  position,
  renderDirection = DialogRenderDirection.Vertical
}: ShowContextMenuInPopupArgs) {
  const container = document.createElement('div');
  const screenPoint = screen.getCursorScreenPoint();
  const [winX, winY] = getCurrentWindow().getPosition();
  const root = createRoot(container);

  const popout = PopupLayer.instance.showPopout({
    content: { el: container },
    arrowColor: 'transparent',
    ...(attachTo
      ? { attachTo }
      : {
          attachToPoint: {
            x: screenPoint.x - winX,
            y: screenPoint.y - winY
          }
        }),
    position: position || (attachTo ? 'bottom' : 'top'),
    onClose: () => {
      root.unmount();
    }
  });

  root.render(
    <MenuDialog
      title={title}
      width={width || MenuDialogWidth.Large}
      isVisible={true}
      triggerRef={{ current: container }}
      renderDirection={renderDirection}
      onClose={() => {
        PopupLayer.instance.hidePopout(popout);
      }}
      items={items}
    />
  );
}
