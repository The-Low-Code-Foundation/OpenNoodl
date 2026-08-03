import classNames from 'classnames';
import { Remarkable } from 'remarkable';
import React, { useMemo } from 'react';

import { UnsafeStyleProps } from '@noodl-core-ui/types/global';

import { stripHtmlComments } from './stripHtmlComments';

import css from './Markdown.module.scss';

export interface MarkdownProps extends UnsafeStyleProps {
  content: string;
}

export function Markdown({ content, UNSAFE_className, UNSAFE_style }: MarkdownProps) {
  const __html = useMemo(() => {
    const md = new Remarkable({
      html: true,
      breaks: true
    });

    // AIB-006: without this, a comment spanning a blank line reaches the DOM as
    // an unclosed `<!--` and the browser swallows the rest of the document —
    // see `stripHtmlComments` for why that is Remarkable's behaviour, not ours.
    return md.render(stripHtmlComments(content));
  }, [content]);

  return (
    <div
      className={classNames([css['Root'], UNSAFE_className])}
      style={UNSAFE_style}
      dangerouslySetInnerHTML={{ __html }}
    ></div>
  );
}
