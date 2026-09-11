import classNames from 'classnames';
import React, { useCallback } from 'react';
import { platform } from '@noodl/platform';

import { Markdown } from '@noodl-core-ui/components/common/Markdown';
import { UnsafeStyleProps } from '@noodl-core-ui/types/global';

import { aiLinkActionFor } from './linkActions';

import css from './AiMarkdown.module.scss';

export interface AiMarkdownProps extends UnsafeStyleProps {
  content: string;

  /**
   * Where a `noodl-node:` citation link goes. Without a handler a citation is
   * swallowed rather than opened — a canvas link means nothing outside a host
   * that has a canvas.
   */
  onCitationClick?: (nodeId: string) => void;
}

/**
 * FIX-003 — markdown as a model wrote it, on any AI surface.
 *
 * The commit-3f633df4 triple, promoted out of `UpdateDialog` so every
 * assistant-text surface gets all three at once rather than re-deriving them:
 *
 *  1. the shared `Markdown` component (raw HTML off at the parser — AIB-009);
 *  2. a selectable wrapper — explicit `user-select: text`, so the text stays
 *     copyable even when a host mounts this inside an opted-out drag surface;
 *  3. a delegated click handler that never lets the window navigate, routing
 *     through `aiLinkActionFor` → `platform.openExternal`.
 *
 * The handler is defence-in-depth on purpose: `main.js` carries a global
 * `will-navigate` guard, but relying on it alone would leave every future
 * surface silently depending on a guard invisible from the renderer.
 */
export function AiMarkdown({ content, onCitationClick, UNSAFE_className, UNSAFE_style }: AiMarkdownProps) {
  const onClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;

      // Always swallow the navigation, even for a scheme we refuse to open:
      // the point is that this window never navigates, and an unopened link is
      // a much smaller failure than a destroyed session.
      event.preventDefault();

      const action = aiLinkActionFor(anchor.getAttribute('href'));
      if (action.kind === 'open') platform.openExternal(action.href);
      else if (action.kind === 'citation') onCitationClick?.(action.nodeId);
    },
    [onCitationClick]
  );

  return (
    <div className={classNames(css['Root'], UNSAFE_className)} style={UNSAFE_style} onClick={onClick}>
      <Markdown content={content} />
    </div>
  );
}
