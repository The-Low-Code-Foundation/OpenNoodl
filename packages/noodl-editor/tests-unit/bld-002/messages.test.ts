/**
 * BLD-002 — the message hierarchy.
 *
 * Two halves again, and for the same reason BLD-003 needed two.
 *
 * The **collapse** half is a total function and is graded as one. The check that
 * matters is not "six tools become one run" — that is the feature — but that a
 * *failure never disappears into one*. Collapsing is the cure for D4's wall of
 * "Read node documentation"; a cure that also swallows the rejection explaining
 * why the agent is repairing something has fixed the legibility complaint by
 * deleting the evidence, and it would look completely normal on screen. There is
 * no way to notice that from a screenshot, which is exactly why it is pinned
 * here.
 *
 * The **type scale** half cannot be pinned by a pure spec — a font size lives in
 * a stylesheet — but the *decision underneath it* can be. BLD-002 chose option
 * (b): stop using `TextType.Secondary` in this panel and let size carry the
 * hierarchy, because `secondary-as-fg` and `fg-default` are the same hex in both
 * themes (measured live: both 7.70:1 dark, both 7.10:1 light, on the surface the
 * thread actually paints). The panel alternated between the two across ~40 call
 * sites believing it expressed a hierarchy. Nothing about that is visible to
 * `tsc`, and a screenshot cannot show it either — the two colours are identical,
 * so the defect is that the code *reads* as if it means something. The last
 * block reads the surfaces, per BLD-003's precedent.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { collapseActivities, isCollapsible, MIN_RUN_LENGTH, summariseRun } from '@noodl-models/AiAssistant/thread';
import type { ThreadItem, TurnActivity } from '@noodl-models/AiAssistant/thread';

const tool = (label: string): TurnActivity => ({ kind: 'tool', label });
const passed = (): TurnActivity => ({ kind: 'submit', ok: true, errorLines: [] });
const failed = (...lines: string[]): TurnActivity => ({ kind: 'submit', ok: false, errorLines: lines });
const prose = (text: string): TurnActivity => ({ kind: 'assistant', text });

const runs = (items: ThreadItem[]) => items.filter((i) => i.kind === 'run');
const singles = (items: ThreadItem[]) => items.filter((i) => i.kind === 'activity');

describe('collapseActivities', () => {
  it('collapses a run of twelve tool activities into one item', () => {
    // The acceptance criterion, as a spec: twelve lines become one, and the one
    // still holds all twelve for the disclosure to open.
    const activities = Array.from({ length: 12 }, (_, i) => tool(`Read node type ${i}`));
    const items = collapseActivities(activities);

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('run');
    expect(runs(items)[0].activities).toHaveLength(12);
  });

  it('never hides a failed submission inside a run', () => {
    // The rule the module exists to enforce. `errorLines` is the reason the
    // agent is about to repair something — the one thing in this region of the
    // feed a person needs — and a collapsed strip that swallowed it would be
    // indistinguishable on screen from one that had nothing to hide.
    const activities = [tool('a'), tool('b'), failed('port "title" does not exist'), tool('c'), tool('d')];
    const items = collapseActivities(activities);

    const hidden = runs(items).flatMap((r) => r.activities);
    expect(hidden.some((a) => a.kind === 'submit' && !a.ok)).toBe(false);
    expect(singles(items).map((s) => s.activity)).toContain(activities[2]);
  });

  it('breaks the run in two around the failure, keeping the order', () => {
    const activities = [tool('a'), tool('b'), failed('nope'), tool('c'), tool('d')];
    const items = collapseActivities(activities);

    expect(items.map((i) => i.kind)).toEqual(['run', 'activity', 'run']);
  });

  it('keeps a passing submission inside the run', () => {
    // The asymmetry is the judgement: a verdict of "fine" is exactly the noise
    // D4 is about, and it is recoverable by expanding.
    const items = collapseActivities([tool('a'), passed(), tool('b')]);

    expect(items).toHaveLength(1);
    expect(runs(items)[0].activities).toHaveLength(3);
  });

  it('leaves prose alone between runs', () => {
    const items = collapseActivities([tool('a'), tool('b'), prose('Now the layout.'), tool('c'), tool('d')]);

    expect(items.map((i) => i.kind)).toEqual(['run', 'activity', 'run']);
    expect(singles(items)[0].activity).toEqual(prose('Now the layout.'));
  });

  it('does not collapse a lone activity into a disclosure', () => {
    // One line of information replaced by one line of no information plus a
    // click is a loss, not a win.
    const items = collapseActivities([prose('Reading.'), tool('only one'), prose('Done.')]);

    expect(runs(items)).toHaveLength(0);
    expect(items.map((i) => i.kind)).toEqual(['activity', 'activity', 'activity']);
  });

  it('collapses at exactly MIN_RUN_LENGTH and not below', () => {
    expect(runs(collapseActivities(Array.from({ length: MIN_RUN_LENGTH }, () => tool('x'))))).toHaveLength(1);
    expect(runs(collapseActivities(Array.from({ length: MIN_RUN_LENGTH - 1 }, () => tool('x'))))).toHaveLength(0);
  });

  it('loses nothing — every activity survives collapsing, in order', () => {
    // The invariant that makes the disclosure honest. Anything the strip hides
    // must still be reachable, so "expand" is a view change and never a
    // different list.
    const activities = [prose('one'), tool('a'), tool('b'), failed('x'), passed(), tool('c'), prose('two')];
    const flat = collapseActivities(activities).flatMap((i) => (i.kind === 'run' ? i.activities : [i.activity]));

    expect(flat).toEqual(activities);
  });

  it('carries each item’s position in the original list', () => {
    // React keys taken from the collapsed list renumber whenever a run grows,
    // which collapses an expanded run on the next token.
    const items = collapseActivities([prose('one'), tool('a'), tool('b'), prose('two')]);

    expect(singles(items).map((s) => s.index)).toEqual([0, 3]);
    expect(runs(items)[0].startIndex).toBe(1);
  });

  it('returns nothing for nothing', () => {
    expect(collapseActivities([])).toEqual([]);
  });
});

describe('isCollapsible', () => {
  it('separates the noise from the evidence', () => {
    expect(isCollapsible(tool('Read node documentation'))).toBe(true);
    expect(isCollapsible(passed())).toBe(true);
    expect(isCollapsible(failed('a reason'))).toBe(false);
    expect(isCollapsible(prose('a sentence'))).toBe(false);
  });
});

describe('summariseRun', () => {
  it('counts steps and validations separately', () => {
    expect(summariseRun([tool('a'), tool('b'), tool('c'), passed()])).toBe('3 steps · validated once');
  });

  it('reads as English at one and two', () => {
    expect(summariseRun([tool('a'), passed()])).toBe('1 step · validated once');
    expect(summariseRun([tool('a'), tool('b'), passed(), passed()])).toBe('2 steps · validated twice');
    expect(summariseRun([tool('a'), passed(), passed(), passed()])).toBe('1 step · validated 3 times');
  });

  it('omits a clause it has no count for rather than printing a zero', () => {
    // "6 steps, 0 validations" is how a status line teaches people to stop
    // reading it — the same rule `decideIntent` follows for its sentence.
    expect(summariseRun([tool('a'), tool('b')])).toBe('2 steps');
    expect(summariseRun([passed(), passed()])).toBe('validated twice');
  });

  it('claims no duration, because the model holds no time', () => {
    // The task's example strip reads "… — 14s". `AuthoringActivity` carries no
    // timestamp, so any duration here would be invented at render time from
    // when React happened to mount. Rule 5 applies to a summary line exactly as
    // it applies to a spinner.
    const summary = summariseRun([tool('a'), tool('b'), tool('c'), passed()]);
    expect(summary).not.toMatch(/\d+\s*(s|ms|sec|second|min)\b/i);
  });
});

describe('the Build panel surfaces', () => {
  const PANEL = join(__dirname, '..', '..', 'src', 'editor', 'src', 'views', 'panels', 'AiAuthoringPanel');

  function panelFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return panelFiles(path);
      return entry.name.endsWith('.tsx') ? [path] : [];
    });
  }

  /** Comments name `Secondary` deliberately — the reason belongs beside the fix. */
  function code(path: string): string {
    return readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
  }

  const FILES = panelFiles(PANEL);

  it('finds the surfaces it is grading', () => {
    // A glob that silently matches nothing is a spec that passes forever.
    expect(FILES.length).toBeGreaterThan(4);
  });

  it('declares a height on every row in the thread header (C5)', () => {
    // `Stack` sets `height: 100%` on any row that does not declare one, and the
    // thread header is a *block* container — so a row resolved 100% against the
    // whole header rather than its own line, overflowed by the height of
    // whatever sat above it, and painted over the turn list beneath. Measured:
    // a 36px button drew a 96px box, 52px of it over the first turn's text.
    //
    // Graded structurally rather than by eye because the symptom is invisible
    // to `tsc`, invisible to every pure spec, and *invisible on screen too*
    // whenever the row above happens to be short — the overflow is exactly the
    // height of the content above it, so an empty header hides the bug
    // completely. The next row added here is the one that would reintroduce it.
    const source = readFileSync(join(PANEL, 'AiAuthoringPanel.tsx'), 'utf8');
    const start = source.indexOf('header={');
    const end = source.indexOf('emptyState={');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const header = source.slice(start, end);
    const rows = header.match(/<HStack[^>]*>/g) ?? [];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row).toContain('height:');
  });

  it.each(FILES)('expresses no hierarchy through a colour that has none: %s', (path) => {
    // Option (b) from the task. `secondary-as-fg` and `fg-default` are the same
    // hex in both themes, so every `TextType.Secondary` here was a hierarchy
    // the panel believed it had and did not. Size carries it now. Option (a) —
    // giving the token a real value — is a design-system change needing a
    // full-surface contrast pass, and belongs to a UIX task, not this one.
    expect(code(path)).not.toContain('TextType.Secondary');
  });
});
