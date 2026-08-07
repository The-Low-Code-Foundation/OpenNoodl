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
      /**
       * Anchor to the button when there is one, not to `container`.
       *
       * `MenuDialog` portals out of `container` into the dialog layer and
       * positions itself from this rect in a one-shot `useLayoutEffect`. Two
       * things then go wrong at once: `container` holds nothing (its only child
       * has been portalled away) so it measures 0×0, and PopupLayer positions it
       * *after* that effect has already run. The menu was measuring a zero-sized
       * box at the origin and landing in the window's top-left corner — 280px
       * and two hundred pixels away from the button that opened it.
       *
       * The `attachTo` element is the one thing here with a real, stable rect
       * that is already laid out when the effect runs. With no `attachTo` the
       * old behaviour is unchanged: `container` is positioned at the cursor
       * point, which is what a right-click menu wants.
       */
      triggerRef={{ current: attachTo ?? container }}
      renderDirection={renderDirection}
      onClose={() => {
        PopupLayer.instance.hidePopout(popout);
      }}
      items={items}
    />
  );
}
