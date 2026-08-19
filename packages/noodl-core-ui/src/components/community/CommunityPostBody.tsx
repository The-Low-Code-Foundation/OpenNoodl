/**
 * NAT-007 — a stranger's post, drawn.
 *
 * ## 🔴 The one rule this file exists to keep
 *
 * **No `dangerouslySetInnerHTML`, ever.** This renders in the same `nodeIntegration: true,
 * contextIsolation: false` window as the editor's graph — `require` is reachable from page script
 * — and this phase has already had a `javascript:` URL compiled into a live anchor once
 * (RULINGS.md, the second amendment). Every string below reaches React as a **text child**, which
 * the runtime escapes because it is text. {@link PostBlock} has no field that could hold markup,
 * so there is nothing here to hand to a sink even by mistake.
 *
 * ## ⚠️ A link is a hand-off, and it is deliberate rather than incidental
 *
 * An anchor here is `onClick`-intercepted and calls `onOpenLink`, never navigating. The editor's
 * main process already refuses a same-window navigation — `main.js`'s `will-navigate` guard,
 * which exists because the update dialog started rendering release notes as markdown — so this is
 * **not** a fix for an open hole. It is the difference between a hand-off that happened and a
 * hand-off that was *decided*: NAT-012's model is that `openExternal` survives only as a labelled
 * hand-off with an audited call site, and a link that reaches the browser by falling through a
 * main-process safety net has no call site to audit. 🔴 `preventDefault` runs whether or not a
 * handler was supplied, so a host that forgets to pass one gets a dead link rather than a
 * navigation.
 *
 * @module noodl-core-ui/components/community/CommunityPostBody
 */

import React from 'react';

import { CommunityDensity } from './CommunityRow';
import css from './Community.module.scss';
import type { PostBlock, PostInline } from './postBlocks';

export interface CommunityPostBodyProps {
  blocks: PostBlock[];
  density?: CommunityDensity;
  /** Where a link goes. Absent means links are drawn and do nothing — never navigate. */
  onOpenLink?: (href: string) => void;
}

function Inlines({ inlines, onOpenLink }: { inlines: PostInline[]; onOpenLink?: (href: string) => void }) {
  return (
    <>
      {inlines.map((inline, index) => {
        // ⚠️ The index IS the identity here. Inlines have no ids and two identical runs of text
        // in one paragraph are genuinely two things in a fixed order; a content-derived key would
        // collide on exactly that case.
        const key = index;
        if (inline.kind === 'code') {
          return (
            <code key={key} className={css['PostCode']}>
              {inline.text}
            </code>
          );
        }
        if (inline.kind === 'strong') return <strong key={key}>{inline.text}</strong>;
        if (inline.kind === 'em') return <em key={key}>{inline.text}</em>;
        if (inline.kind === 'link') {
          return (
            <a
              key={key}
              className={css['PostLink']}
              href={inline.href}
              onClick={(event) => {
                // See the module note: never a navigation, handler or no handler.
                event.preventDefault();
                onOpenLink?.(inline.href);
              }}
            >
              {inline.text}
            </a>
          );
        }
        return <React.Fragment key={key}>{inline.text}</React.Fragment>;
      })}
    </>
  );
}

/**
 * The blocks of one post.
 *
 * 🔴 **Hook-free on purpose.** `tests-unit/support/renderElements.ts` walks a component by calling
 * it, and a hook throws under that walk — which is how NAT-005 got an assertion that a D15-refused
 * view draws *nothing* with a live control beside it. Every Tier-3 surface keeps this split.
 */
export function CommunityPostBody({ blocks, density = CommunityDensity.Page, onOpenLink }: CommunityPostBodyProps) {
  return (
    <div className={`${css['PostBody']} ${css[`is-density-${density}`]}`}>
      {blocks.map((block, index) => {
        const key = index;

        if (block.kind === 'paragraph') {
          return (
            <p key={key} className={css['PostParagraph']}>
              <Inlines inlines={block.inlines} onOpenLink={onOpenLink} />
            </p>
          );
        }

        if (block.kind === 'heading') {
          // ⚠️ Levels are shifted down, not used raw. A post's `#` is a heading *within* a post,
          // and a page whose thread title is an h2 must not contain an h1 in a reply — an outline
          // where a stranger's post outranks the page it is on is a real defect for anybody
          // navigating by headings.
          const Tag = (['h3', 'h4', 'h5', 'h6'] as const)[block.level - 1] ?? 'h6';
          return (
            <Tag key={key} className={css['PostHeading']}>
              <Inlines inlines={block.inlines} onOpenLink={onOpenLink} />
            </Tag>
          );
        }

        if (block.kind === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul';
          return (
            <Tag key={key} className={css['PostList']}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inlines inlines={item} onOpenLink={onOpenLink} />
                </li>
              ))}
            </Tag>
          );
        }

        if (block.kind === 'codeblock') {
          return (
            <pre key={key} className={css['PostCodeBlock']}>
              <code>{block.text}</code>
            </pre>
          );
        }

        // 🔴 AC3 — skipped VISIBLY. The label is the sanitised wire `kind`; the content is not
        // here at all, because a marker that quoted the thing it could not render would be the
        // pass-through it exists to replace.
        return (
          <p key={key} className={css['PostUnsupported']}>
            This post has a “{block.label}” section that this version of the editor cannot show.
          </p>
        );
      })}
    </div>
  );
}
