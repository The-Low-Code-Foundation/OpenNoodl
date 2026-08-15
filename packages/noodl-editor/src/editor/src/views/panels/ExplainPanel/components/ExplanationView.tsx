/**
 * AIX-004 — Explain Mode: explanation renderer
 *
 * Renders one answer as markdown, with node citations turned into links that
 * point at the canvas.
 *
 * Two deliberate choices:
 *
 *  - **`html: false`.** Model output is untrusted text. The editor's shared
 *    `Markdown` component enables raw HTML pass-through, which is fine for
 *    authored copy and wrong for anything a model wrote, so this renders its own.
 *  - **Event delegation, not a custom renderer.** Citations are ordinary
 *    markdown links with a `noodl-node:` scheme; one listener on the container
 *    handles every one, including the ones that arrive mid-stream.
 *
 * @module noodl-editor/views/panels/ExplainPanel/components/ExplanationView
 */

import React, { useCallback, useMemo } from 'react';
import { Remarkable } from 'remarkable';
import { platform } from '@noodl/platform';

import { CITATION_SCHEME } from '@noodl-models/AiAssistant/explain/citations';
import { linkActionFor } from '@noodl-core-ui/components/ai/AiMarkdown/linkActions';

import { clearCitedHighlight, highlightCitedNode, revealCitedNode } from '../canvasLink';
import css from './ExplanationView.module.scss';

export interface ExplanationViewProps {
  markdown: string;
  /** Component the explanation was assembled from; citations resolve within it. */
  componentName: string;
}

function citedNodeId(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) return undefined;
  const anchor = target.closest(`a[href^="${CITATION_SCHEME}"]`);
  const href = anchor?.getAttribute('href');
  return href ? href.slice(CITATION_SCHEME.length) : undefined;
}

export function ExplanationView({ markdown, componentName }: ExplanationViewProps) {
  const html = useMemo(() => {
    // html:false escapes any markup the model emitted rather than running it.
    const renderer = new Remarkable({ html: false, breaks: true });
    return renderer.render(markdown);
  }, [markdown]);

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const nodeId = citedNodeId(event.target);
      if (nodeId) {
        event.preventDefault();
        revealCitedNode(componentName, nodeId);
        return;
      }

      // FIX-003: any other link the model emits opens in the OS browser — or
      // nowhere. Swallow the navigation either way; this window never leaves
      // the editor, even for a scheme the policy refuses to open.
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor) return;
      event.preventDefault();

      const href = anchor.getAttribute('href');
      if (linkActionFor(href) === 'open') platform.openExternal(href);
    },
    [componentName]
  );

  const onMouseOver = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const nodeId = citedNodeId(event.target);
    if (nodeId) highlightCitedNode(nodeId);
  }, []);

  const onMouseOut = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (citedNodeId(event.target)) clearCitedHighlight();
  }, []);

  return (
    <div
      className={css['Root']}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
