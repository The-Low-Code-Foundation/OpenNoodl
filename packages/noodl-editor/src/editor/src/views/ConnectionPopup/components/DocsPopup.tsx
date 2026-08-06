import React, { useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

import { NodeLibrary } from '@noodl-models/nodelibrary';

import css from '../ConnectionPopup.module.scss';
import { DOCS_POPUP_MARGIN, DocsPopupPlacement, placeDocsPopup } from '../docsPopupPlacement';

/**
 * SPR-003 §4 (F94) — the port explainer, placed next to the port it explains.
 *
 * ## What was actually wrong
 *
 * Not z-index. This portals into `.popup-small-docs`, a host `popuplayer.ts`
 * appends to `.popup-layer` — which is a child of `<body>` at `z-index: 10`,
 * above every overlay the editor draws (the canvas overlay layer that carries
 * the connection popups is 5, by FH-012's design). It was already on top.
 *
 * The host was `position: absolute; bottom: 2px` with **no `left` or `right`**.
 * With both auto, the used value is the static position — and as the first
 * child of a full-viewport containing block that is `0`. So the explainer
 * rendered in the **bottom-left corner of the window**, 300px wide, wherever
 * the port being hovered happened to be: half under the components panel,
 * nowhere near the list it belonged to, and looking for all the world like
 * something drawn behind the panel.
 *
 * ## What it does now
 *
 * The hovered row hands over its `DOMRect` and this places itself beside it,
 * flipping side when the preferred one would leave the viewport. The arithmetic
 * is in `docsPopupPlacement.ts` — its own import-free module so the flip is
 * graded by a test rather than only by hovering the right port at the right
 * window width (`tests-unit/connection-popup/docsPopupPlacement.test.ts`).
 *
 * The measure-then-place pass is why the first render is `hidden`: the width is
 * fixed in CSS but the height is whatever the docs say, and placing before
 * measuring is what produces a box half off the bottom of the screen. One
 * invisible frame is not perceptible against the hover delay and the async
 * catalog lookup that precede it.
 *
 * ⚠️ `.popup-layer` is `pointer-events: none` and nothing here re-enables it.
 * That is load-bearing: the explainer is often directly under the pointer's
 * path, and a box that took the mouse would fire `mouseout` on the port and
 * close itself.
 */

export interface DocsPopupProps {
  name: string;
  type: TSFixme;
  body: string;
  /** Bounding box of the port row being hovered. */
  anchor?: DOMRect;
}

export function DocsPopup({ name, type, body, anchor }: DocsPopupProps) {
  const enums = typeof type === 'object' && type !== null && type.name === 'enum' ? type.enums : undefined;

  const typeDocs =
    '(' + NodeLibrary.nameForPortType(type) + (enums !== undefined ? ':' + enums.map((e) => e.label).join(',') : '') + ')';

  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<DocsPopupPlacement | undefined>(undefined);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    setPlacement(
      placeDocsPopup(anchor, ref.current.offsetHeight, { width: window.innerWidth, height: window.innerHeight })
    );
    // `body` is in the deps because the same hovered row can swap its docs in
    // once the catalog lookup returns, changing the height under us.
  }, [anchor, body]);

  const host = document.querySelector('.popup-small-docs');
  if (!host) return null;

  return ReactDOM.createPortal(
    <div
      ref={ref}
      className={css.docsPopup}
      style={
        placement
          ? { left: placement.left, top: placement.top, maxHeight: placement.maxHeight }
          : // First pass: laid out where it will roughly land so the measured
            // height is the one it will really have, but not yet shown.
            { left: DOCS_POPUP_MARGIN, top: DOCS_POPUP_MARGIN, visibility: 'hidden' as const }
      }
    >
      <div className={css.docsHeader}>
        <span>{name}</span>
        <span className={css.docsType}>{typeDocs}</span>
      </div>

      <div className={css.docsBody} dangerouslySetInnerHTML={{ __html: body }} />
    </div>,
    host
  );
}
