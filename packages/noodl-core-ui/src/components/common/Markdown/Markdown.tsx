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
      // ⚠️ AIB-009 F2 — this was `true`, and the result went straight into
      // `dangerouslySetInnerHTML` below with no sanitiser.
      //
      // That was defensible while doc bodies were written by the user. It stopped
      // being defensible at AIX-011 criterion 7, when `DocSession` began
      // authoring them, and at AIX-009, when the Docs panel began rendering
      // them: a prompt-injected or simply careless model can emit
      // `<img src=x onerror=…>` into `docs/ARCHITECTURE.md`, and it executes in
      // the editor's own renderer, which can reach `ipcRenderer`.
      //
      // Off at the parser rather than sanitised at the output, deliberately.
      // Measured against Remarkable 2.0.1 (`tests-unit/aib-009/markdownHtml.test.ts`
      // pins all of it):
      //
      //  - `html: false` escapes every raw-HTML vector — blocks, inline tags and
      //    event-handler attributes all come out as text;
      //  - Remarkable **already** refuses `javascript:`, `vbscript:` and
      //    `data:text/html` link targets, so the remaining vector was raw HTML
      //    alone. There is nothing left for an allow-list sanitiser to add that
      //    this does not already deny.
      //
      // The cost is that genuine inline HTML in a document renders as literal
      // text. Nothing shipped writes any — not a doc template, not a prompt —
      // and the alternative was a hand-rolled HTML allow-list, which is the one
      // kind of security code that is worse than the hole it closes. If a
      // document ever needs `<details>`, the right answer is a markdown pipeline
      // that never builds an HTML string (the editor already depends on
      // `react-markdown`), not raw HTML plus a filter.
      html: false,
      breaks: true
    });

    // AIB-006: kept, and still doing work. With `html: false` an unterminated
    // `<!--` can no longer swallow the document — but it would now render as
    // *visible literal text*, which for CONVENTIONS.md means a page of template
    // commentary the reader never asked for.
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
