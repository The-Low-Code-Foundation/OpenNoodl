/**
 * FH-010 — a full-editor overlay opened from inside a panel.
 *
 * `BasePanel.Root` carries `container-type: inline-size`, which implies
 * `contain: layout style inline-size`, which makes the panel **the containing
 * block for every `position: fixed` descendant**. `BasePanel.module.scss`
 * states the resulting contract in its own comments: every full-screen overlay
 * reachable from a panel escapes the panel's DOM first — "nothing fixed is left
 * in-tree".
 *
 * Four overlays in the version-control panel were left in-tree and broke that
 * contract. `inset: 0` resolved against the ~300px panel body instead of the
 * viewport, so the backdrop painted as a grey wash confined to the panel and the
 * dialog it was supposed to centre was clipped out of sight by the panel's own
 * `overflow`. That is what Richard reported as "the left panel gets a grey
 * overlay but nothing comes up".
 *
 * This portals the backdrop to `.dialog-layer-portal-target` — the same body
 * child `BaseDialog` uses, created in `router.tsx`'s `createDialogLayer()` — so
 * `position: fixed` resolves against the viewport again. `BaseDialog` itself was
 * not used for these four: two of them are right-hand slide-out drawers rather
 * than centred sheets, and `BaseDialog` renders its children a second time
 * inside a hidden `MeasuringContainer`, which for these particular components
 * would mean duplicated element ids and a second round of GitHub API calls on
 * every open.
 *
 * ## Dismissal is a gesture, not a click
 *
 * All four used `onClick` on the backdrop plus `stopPropagation()` on the box.
 * That is the bug `CoreBaseDialog` documents under PNL-002: a `click` is
 * dispatched to the nearest common ancestor of `mousedown` and `mouseup`, so
 * pressing *inside* the dialog and releasing outside it fires a click on the
 * backdrop itself, which never passes through the inner `stopPropagation` and so
 * dismisses. Drag-selecting a repository name, or a line of an issue body, and
 * releasing past the edge threw the dialog away — and it got *far* more
 * reachable the moment the backdrop grew from a panel-sized box to the whole
 * window.
 *
 * Both ends of the gesture now have to land on the backdrop itself. Children
 * therefore need no `stopPropagation` guard of their own; the ones that existed
 * only to pair with the old `onClick` have been removed at their call sites.
 */

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PanelOverlayProps {
  /**
   * The backdrop's own class. Each overlay keeps its own layout — the two
   * GitHub modals centre their box, the two detail drawers pin theirs to the
   * right edge — so the class stays with the component and only the escape is
   * shared.
   */
  backdropClassName: string;
  /**
   * Dismiss on a press that both starts and ends on the backdrop. Pass
   * `undefined` to make the overlay undismissable — that is how the two GitHub
   * modals stay put while a repository is being created or connected.
   */
  onDismiss?: () => void;
  children: React.ReactNode;
}

export function PanelOverlay({ backdropClassName, onDismiss, children }: PanelOverlayProps) {
  // Read once, at mount, the way `BaseDialog` does. The target is appended to
  // `document.body` by `createDialogLayer()` long before any panel mounts;
  // `document.body` is a fallback for environments that never ran the editor's
  // router (a spec, a storybook) rather than an expected path.
  const [portalRoot] = useState<Element>(() => document.querySelector('.dialog-layer-portal-target') ?? document.body);

  const pressStartedOnBackdrop = useRef(false);

  return createPortal(
    <div
      className={backdropClassName}
      onPointerDown={(e) => {
        pressStartedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onPointerUp={(e) => {
        const shouldDismiss = pressStartedOnBackdrop.current && e.target === e.currentTarget;
        pressStartedOnBackdrop.current = false;
        if (shouldDismiss) onDismiss?.();
      }}
    >
      {children}
    </div>,
    portalRoot
  );
}
