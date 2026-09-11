import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { CommunityRow, CommunityDensity } from './CommunityRow';
import { CommunitySection } from './CommunitySection';
import { CommunitySectionBody, CommunitySectionState } from './CommunitySectionBody';
import { metaLine, relativeTime, replyLatency, kindLabel, absoluteDate } from './communityMeta';

/**
 * NAT-005 — the four states, side by side, with no editor present.
 *
 * 🔴 **AC4's real assertion is that these render with no editor present**, which is the one thing
 * Storybook proves and a jest run cannot: the launcher tab is `pages/ProjectsPage` inside the
 * editor's own window, and every previous version of this surface was inline styles that could
 * only ever be looked at by launching the whole app.
 *
 * ⚠️ The states are laid out together deliberately. Each one is defensible alone; what AC1 asks
 * is whether they are still *distinguishable*, and that is a question about the set.
 */
const meta: Meta = {
  title: 'Community/Vocabulary'
};

export default meta;
type Story = StoryObj;

/** A fixed instant, so a story does not read differently depending on the day it is opened. */
const NOW = new Date('2026-08-19T18:00:00.000Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Thread = {
  id: string;
  title: string;
  createdAt: string;
  firstReplyMinutes: number | null;
  replyCount: number;
};

const THREADS: Thread[] = [
  { id: '1', title: 'Why does my For Each render one row?', createdAt: ago(2 * HOUR), firstReplyMinutes: 41, replyCount: 3 },
  { id: '2', title: 'Deploy to a folder writes twice — is that expected?', createdAt: ago(3 * DAY), firstReplyMinutes: null, replyCount: 0 },
  { id: '3', title: 'Component Inputs ports not arriving on the instance', createdAt: ago(30 * DAY), firstReplyMinutes: 60 * 26, replyCount: 1 },
  // FIX-025 bug 7 — the asker answered themselves: a reply on the row, and still nobody else.
  { id: '4', title: 'Text node styling — never mind, found it', createdAt: ago(5 * DAY), firstReplyMinutes: null, replyCount: 1 }
];

const threadRows = (items: Thread[]) =>
  items.map((t) => (
    <CommunityRow
      key={t.id}
      title={t.title}
      meta={metaLine([relativeTime(t.createdAt, NOW), replyLatency(t.firstReplyMinutes, t.replyCount)])}
    />
  ));

function Canvas({ children }: { children: React.ReactNode }) {
  // The launcher's own ground — `Launcher.module.scss` paints `.ContentArea` with `bg-0`.
  return <div style={{ background: 'var(--theme-color-bg-0)', padding: 24, maxWidth: 640 }}>{children}</div>;
}

/** 🔴 The whole point of the set: four states, four shapes. */
export const TheFourStates: Story = {
  render: () => {
    const states: Array<[string, CommunitySectionState<Thread>]> = [
      ['loading', { state: 'loading' }],
      ['items', { state: 'items', items: THREADS }],
      ['empty', { state: 'empty' }],
      ['unreachable', { state: 'unreachable', detail: 'ENOTFOUND community.nodegx.io' }]
    ];
    return (
      <Canvas>
        {states.map(([label, state]) => (
          <CommunitySection
            key={label}
            title={`Discussions — ${label}`}
            state={state}
            emptyLine="Questions asked from the editor land here. Right-click any node and choose “Ask about this node”."
            onRetry={() => undefined}
          >
            {threadRows}
          </CommunitySection>
        ))}
      </Canvas>
    );
  }
};

/** The rail's density — no card of its own, sitting on `BasePanel`'s `bg-2`. */
export const PanelDensity: Story = {
  render: () => (
    <div style={{ background: 'var(--theme-color-bg-2)', padding: 12, width: 280 }}>
      <CommunitySectionBody
        state={{ state: 'items', items: THREADS }}
        emptyLine="Questions asked from the editor land here."
        onRetry={() => undefined}
        density={CommunityDensity.Panel}
      >
        {(items) =>
          items.map((t) => (
            <CommunityRow
              key={t.id}
              density={CommunityDensity.Panel}
              title={t.title}
              meta={metaLine([relativeTime(t.createdAt, NOW), replyLatency(t.firstReplyMinutes, t.replyCount)])}
            />
          ))
        }
      </CommunitySectionBody>
    </div>
  )
};

/** AC2 — the metadata the view model always carried and the old rows threw away. */
export const RowsWithTheirMetadata: Story = {
  render: () => (
    <Canvas>
      <CommunitySection
        title="Guides and tutorials"
        state={{
          state: 'items',
          items: [
            { slug: 'a', title: 'Wiring a repeater', kind: 'tutorial', summary: 'Static Data into a For Each, and the two ports that decide whether a row draws at all.' },
            { slug: 'b', title: 'A faster deploy loop', kind: 'tip', summary: null }
          ]
        }}
        emptyLine="Written guides published to the community appear here."
        onRetry={() => undefined}
      >
        {(items) =>
          items.map((a: any) => (
            <CommunityRow key={a.slug} title={a.title} meta={kindLabel(a.kind)} detail={a.summary} />
          ))
        }
      </CommunitySection>

      <CommunitySection
        title="Call replays"
        state={{
          state: 'items',
          items: [{ slug: 'r', title: 'Weekly call — the logic node', heldOn: ago(9 * DAY), description: 'Walking the Blockly seam and what it does with a signal port.' }]
        }}
        emptyLine="Recordings of the weekly call are listed here, newest first."
        onRetry={() => undefined}
      >
        {(items) =>
          items.map((r: any) => (
            <CommunityRow
              key={r.slug}
              title={r.title}
              meta={metaLine([absoluteDate(r.heldOn), relativeTime(r.heldOn, NOW)])}
              detail={r.description}
            />
          ))
        }
      </CommunitySection>
    </Canvas>
  )
};
