/**
 * FB-002 AC3/AC4 — the Bench filter, as it is actually drawn.
 *
 * ## 🔴 Why this file exists beside `uni-011/mirrorview.test.ts`
 *
 * That file grades the composer: which rows, which counts, which sentence. **A correct view model
 * that nothing draws is the same screen as no fix at all**, and this phase has closed three
 * sessions on some version of *"the spec passed and the feature did not work"*. So this walks the
 * component and asks what reached the tree.
 *
 * ⚠️ **The view model here is built by the REAL composer** (`support/benchFixture`), never by a
 * literal. A hand-made `CommunityBenchViewModel` type-checks while agreeing with nothing, and
 * would keep passing after `composeBench` stopped producing it.
 *
 * 🔴 **What this cannot see**: no DOM, no effects, no paint — see `support/renderElements`. So it
 * asserts what was drawn and what each control was wired to, and it is the drive, not this, that
 * establishes the pills are clickable in a running editor.
 *
 * @module noodl-editor/tests-unit/fb-002/bench-filter-render
 */
import React from 'react';

import { CommunityBenchView, CommunityDensity } from '@noodl-core-ui/components/community';
import { MIRROR_THREAD_WINDOW, type ForumThread } from '@noodl-models/community/communityapi';

import { readFileSync } from 'fs';
import { join } from 'path';

import { byClass, render, stripComments, text, walk } from '../support/renderElements';
import { benchFrom, forumOf, threadOf } from '../support/benchFixture';

const thread = (id: string, accepted: boolean): ForumThread =>
  threadOf({ id, title: `Question ${id}`, createdAt: '2026-08-20T10:00:00.000Z', firstReplyMinutes: null, accepted });

/** Two waiting, one solved — so every arm below has something to be wrong about. */
const MIXED = [thread('w1', false), thread('s1', true), thread('w2', false)];

const noop = () => undefined;

function draw(
  read: Parameters<typeof benchFrom>[0],
  state: Parameters<typeof benchFrom>[1] = 'waiting',
  handlers: { onSelectFilter?: (key: string) => void; onOpenThread?: (id: string) => void } = {},
  density: CommunityDensity = CommunityDensity.Page
) {
  return render(
    CommunityBenchView({
      view: benchFrom(read, state),
      density,
      onSelectFilter: handlers.onSelectFilter ?? noop,
      onOpenThread: handlers.onOpenThread ?? noop,
      onRetry: noop
    }) as React.ReactNode
  );
}

describe('FB-002 — the Bench filter reaches the screen', () => {
  describe('🔴 the default list is the work, and the archive is one click away', () => {
    const tree = draw(forumOf(MIXED));

    it('CONTROL: the component drew something, and the waiting questions are in it', () => {
      // 🔴 Without this row every "not.toContain" below passes on an empty tree.
      expect(tree).not.toBeNull();
      expect(text(tree)).toContain('Question w1');
      expect(text(tree)).toContain('Question w2');
    });

    it('the SOLVED question is not in the default list', () => {
      expect(text(tree)).not.toContain('Question s1');
    });

    it('⚠️ …and the same component draws it when the other pill is on', () => {
      // The known-firing signal beside the absence: refused and never-requested look identical.
      expect(text(draw(forumOf(MIXED), 'solved'))).toContain('Question s1');
    });

    it('🔴 the row still carries its reply latency — the move did not drop it', () => {
      // ⚠️ `replyLatency` moved OUT of both surfaces and INTO `CommunityBenchView` with this
      // change, and an import that stops being used is invisible to `typecheck` here. "No reply
      // yet" is the row worth scanning for and the one the health readout counts as `unreplied`,
      // so it is asserted rather than assumed.
      const meta = byClass(tree, 'RowMeta').map((node) => node.ownText);
      expect(meta.length).toBe(2);
      expect(meta.every((line) => line.includes('no reply yet'))).toBe(true);
    });

    it('⚠️ CONTROL: a row that HAS a reply says so instead', () => {
      const replied = draw(forumOf([threadOf({ id: 'r1', title: 'Replied', createdAt: '2026-08-20T10:00:00.000Z', firstReplyMinutes: 41, replyCount: 2 })]));
      expect(byClass(replied, 'RowMeta').map((node) => node.ownText).join(' ')).not.toContain('no reply yet');
    });

    /**
     * FIX-025 bug 7, at the level that matters: `communityMeta` returning the right string is not
     * the same claim as the ROW drawing it. `replyCount` had to reach `CommunityBenchRow` through
     * `ForumThread` and `composeBench` for that to be true, and this walks the real component.
     *
     * 🔴 **Both rows are production, from the wire on 2026-08-27** — same title, same author,
     * both `firstReplyMinutes: null`, differing in `replyCount` alone. That is why the pair is
     * here rather than one row: before the fix they drew the identical meta line.
     */
    describe('🔴 FIX-025 bug 7 — the row a reply landed on stops calling itself unanswered', () => {
      const PRODUCTION_PAIR = [
        // de14371e… — the asker answered their own question, and accepted it.
        threadOf({ id: 'p-answered', title: 'Help with a Text node', createdAt: '2026-08-19T11:19:27.206Z', firstReplyMinutes: null, replyCount: 1, accepted: true }),
        // 2abd111a… — nobody has said anything.
        threadOf({ id: 'p-waiting', title: 'Help with a Text node', createdAt: '2026-08-19T11:18:13.201Z', firstReplyMinutes: null, replyCount: 0 })
      ];

      const metaOf = (state: 'waiting' | 'solved') =>
        byClass(draw(forumOf(PRODUCTION_PAIR), state), 'RowMeta').map((node) => node.ownText);

      it('CONTROL: each pill drew exactly the one row it should have', () => {
        // 🔴 Without this the assertions below could both be reading an empty list. The pair
        // splits across the two pills precisely because one is accepted and the other is not.
        expect(metaOf('waiting').length).toBe(1);
        expect(metaOf('solved').length).toBe(1);
      });

      it('🔴 the accepted, self-answered row does NOT say "no reply yet"', () => {
        const [meta] = metaOf('solved');
        expect(meta).toContain('no reply from anyone else yet');
        // The reported sentence, as the thing that must not come back. `toContain` matters:
        // the new sentence does not have the old one as a substring, which is why this can fail.
        expect(meta).not.toContain('no reply yet');
      });

      it('🔴 NEGATIVE CONTROL: the row nobody answered still says "no reply yet"', () => {
        const [meta] = metaOf('waiting');
        expect(meta).toContain('no reply yet');
        expect(meta).not.toContain('no reply from anyone else yet');
      });

      it('🔴 the two rows no longer draw the same meta line', () => {
        expect(metaOf('solved')[0]).not.toBe(metaOf('waiting')[0]);
      });
    });

    it('one row per thread the filter passed, and they are buttons', () => {
      const rows = byClass(tree, 'Row');
      expect(rows.length).toBe(2);
      expect(rows.every((row) => row.type === 'button')).toBe(true);
    });
  });

  describe('🔴 the pills', () => {
    const pills = byClass(draw(forumOf(MIXED)), 'FilterPill');

    it('there are exactly two, labelled as the web Bench labels them', () => {
      expect(pills.length).toBe(2);
      const labels = pills.map((pill) => text(pill));
      expect(labels[0]).toContain('Solved');
      expect(labels[1]).toContain('Waiting for an answer');
    });

    it('each carries its count, and the counts are the window’s not the list’s', () => {
      // "Solved 1" beside a list of two waiting questions. A pill that read `Solved 0` here is
      // the bug that makes a reader believe the archive is empty and never click it.
      expect(text(pills[0])).toContain('1');
      expect(text(pills[1])).toContain('2');
    });

    it('⚠️ the state is on `aria-pressed`, not only in the fill', () => {
      expect(pills.map((pill) => pill.props['aria-pressed'])).toEqual([false, true]);
    });

    it('and it moves with the selection', () => {
      const onSolved = byClass(draw(forumOf(MIXED), 'solved'), 'FilterPill');
      expect(onSolved.map((pill) => pill.props['aria-pressed'])).toEqual([true, false]);
    });

    it('🔴 clicking one asks the host for THAT key', () => {
      const asked: string[] = [];
      const clicked = byClass(draw(forumOf(MIXED), 'waiting', { onSelectFilter: (key) => asked.push(key) }), 'FilterPill');
      for (const pill of clicked) (pill.props.onClick as () => void)();
      expect(asked).toEqual(['solved', 'waiting']);
    });

    it('⚠️ no pills at all over a list nobody has — in all three non-`items` states', () => {
      // A control that cannot do anything, drawn as though it could, and it would push out the
      // sentence saying what the Bench is for.
      expect(byClass(draw(undefined), 'FilterPill').length).toBe(0);
      expect(byClass(draw(forumOf([])), 'FilterPill').length).toBe(0);
      expect(byClass(draw({ outcome: 'unreachable', status: null, detail: 'ETIMEDOUT' }), 'FilterPill').length).toBe(0);
    });
  });

  describe('🔴 a bounded list reports its bound, ABOVE the rows', () => {
    const many = Array.from({ length: MIRROR_THREAD_WINDOW }, (_unused, i) => thread(`t${i}`, false));

    it('the sentence is drawn, and it names the window', () => {
      const bound = byClass(draw(forumOf(many)), 'DirectoryBound');
      expect(bound.length).toBe(1);
      expect(text(bound[0])).toContain(String(MIRROR_THREAD_WINDOW));
    });

    it('⚠️ CONTROL: one thread fewer and the sentence is absent', () => {
      expect(byClass(draw(forumOf(many.slice(1))), 'DirectoryBound').length).toBe(0);
    });

    it('🔴 it is drawn BEFORE the first row, not after the last', () => {
      // A reader who stops scrolling at row eight never sees a footnote. Asserted by position in
      // the walk rather than by CSS, which this runner cannot see.
      const order = walk(draw(forumOf(many))).map((node) => String(node.props.className ?? ''));
      const bound = order.findIndex((cls) => cls.includes('DirectoryBound'));
      const firstRow = order.findIndex((cls) => cls.includes('Row') && !cls.includes('ChipRow'));
      expect([bound >= 0, firstRow >= 0]).toEqual([true, true]);
      expect(bound).toBeLessThan(firstRow);
    });
  });

  describe('🔴 the three silences reach the screen as three sentences', () => {
    const lineOf = (read: Parameters<typeof benchFrom>[0], state: Parameters<typeof benchFrom>[1]) =>
      byClass(draw(read, state), 'StateLine').map((node) => node.ownText);

    it('nobody has asked · everything is answered · nothing is accepted', () => {
      const nobodyAsked = lineOf(forumOf([]), 'waiting');
      const allAnswered = lineOf(forumOf([thread('s1', true)]), 'waiting');
      const noneAccepted = lineOf(forumOf([thread('w1', false)]), 'solved');
      for (const lines of [nobodyAsked, allAnswered, noneAccepted]) expect(lines.length).toBe(1);
      expect(new Set([...nobodyAsked, ...allAnswered, ...noneAccepted]).size).toBe(3);
      expect(allAnswered[0]).toContain('Solved');
    });

    it('⚠️ and `unreachable` is still none of them — it keeps its retry', () => {
      const tree = draw({ outcome: 'unreachable', status: null, detail: 'ETIMEDOUT' });
      expect(text(tree)).toContain('ETIMEDOUT');
      expect(byClass(tree, 'RetryButton').length).toBe(1);
    });
  });

  describe('⚠️ AC4 — the same list, at both densities', () => {
    it('the density reaches the wrapper, the pills row and the body', () => {
      // 🔴 The rail panel is the surface that would silently lose the controls' gutter: the
      // padding rule keys on `.Bench.is-density-panel`, so a wrapper drawn without the class
      // draws pills flush to the card edge. See `Community.module.scss`.
      for (const density of [CommunityDensity.Page, CommunityDensity.Panel]) {
        const tree = draw(forumOf(MIXED), 'waiting', {}, density);
        const classes = walk(tree).map((node) => String(node.props.className ?? ''));
        expect([density, classes.some((cls) => cls.includes(`Bench`) && cls.includes(`is-density-${density}`))]).toEqual([
          density,
          true
        ]);
      }
    });

    /**
     * 🔴 **AC4 is a claim about two files, and neither render above can see it.** The component
     * is handed a state; what makes the surfaces agree is that neither of them chooses one — both
     * take it from `useCommunityMirror`, whose default is `BENCH_DEFAULT_STATE`.
     *
     * ⚠️ Source analysis, and it is the weaker instrument: `CommunityPanel` reads three hooks so
     * `renderElements` cannot call it. So this asserts the two things source CAN see honestly,
     * with a control that proves the files were read — and it is the drive, not this, that
     * establishes the two surfaces open on the same list.
     */
    describe('🔴 neither surface chooses a state of its own', () => {
      const SRC = join(__dirname, '../../src/editor/src');
      const panel = stripComments(
        readFileSync(join(SRC, 'views/panels/CommunityPanel/CommunityPanel.tsx'), 'utf8')
      );
      const host = stripComments(readFileSync(join(SRC, 'pages/ProjectsPage/ProjectsPage.tsx'), 'utf8'));

      it('CONTROL: both files were read, and both mention the Bench at all', () => {
        expect([panel.length > 500, host.length > 500]).toEqual([true, true]);
        expect([panel.includes('CommunityBenchView'), host.includes('selectBenchFilter')]).toEqual([true, true]);
      });

      it('🔴 both take the selection from `useCommunityMirror`, not from a literal', () => {
        expect(panel).toContain('selectBenchFilter');
        expect(host).toContain('communityMirror.selectBenchFilter');
      });

      it('🔴 and neither hard-codes a pill — the mutation that would break AC4 silently', () => {
        // A later `benchState="solved"` on one surface would leave both suites green and the two
        // surfaces opening on different lists, which is precisely what D15's mirror-agreement
        // rule forbids. Stripped source, so the states named in this file's own prose do not
        // make it pass or fail.
        for (const [name, source] of [['panel', panel], ['host', host]] as const) {
          expect([name, source.includes("'solved'"), source.includes("'waiting'")]).toEqual([name, false, false]);
        }
      });
    });

    it('a row click asks the host to open THAT thread', () => {
      const opened: string[] = [];
      const tree = draw(forumOf(MIXED), 'waiting', { onOpenThread: (id) => opened.push(id) });
      for (const row of byClass(tree, 'Row')) (row.props.onClick as () => void)();
      expect(opened).toEqual(['w1', 'w2']);
    });
  });
});
