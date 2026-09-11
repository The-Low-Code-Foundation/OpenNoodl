/**
 * BLD-001 — a view that is sometimes its own surface and sometimes a card.
 *
 * `ProjectAuthoringView` and `ProjectReviewView` each opened a `ScrollArea`,
 * because each of them WAS the panel below the scope tabs. Inside the thread
 * they are outcome cards, and a scroller nested in a scroller is the bug where
 * the inner one eats the wheel event and the outer one never reaches the
 * composer.
 *
 * Kept as a component rather than an `isEmbedded ? <>… : <ScrollArea>…` at each
 * site, because that ternary has to wrap the entire body of a 1,600-line render
 * and JSX cannot express it without duplicating the children.
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/thread/ThreadBody
 */

import React from 'react';

import { Box } from '@noodl-core-ui/components/layout/Box';
import { ScrollArea } from '@noodl-core-ui/components/layout/ScrollArea';
import type { Slot } from '@noodl-core-ui/types/global';

export interface ThreadBodyProps {
  /** True when the thread owns the scrolling — the card renders flat. */
  isEmbedded?: boolean;
  className?: string;
  /** `Slot`, not `ReactNode`: `Box` narrows its children and this passes them straight through. */
  children: Slot;
}

export function ThreadBody({ isEmbedded, className, children }: ThreadBodyProps) {
  if (isEmbedded) return <>{children}</>;
  return (
    <ScrollArea UNSAFE_className={className}>
      <Box hasXSpacing hasYSpacing UNSAFE_style={{ width: '100%' }}>
        {children}
      </Box>
    </ScrollArea>
  );
}
