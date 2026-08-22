/**
 * FB-008 AC2 — the `?` menu lists the community platform, and every row in it
 * opens somewhere.
 *
 * Richard's item 8 was one line ("the community web page link should go into the
 * question mark icon"), and one line is exactly the kind of change that gets
 * undone by the next person to touch the menu without anyone noticing: before
 * this file, the only thing that would have caught it was a person opening the
 * menu and looking.
 *
 * This grades `HELP_CENTER_LINKS` — the table the shipped component maps over —
 * with no renderer, no portal and no `.help-center-layer` in the DOM. It cannot
 * import `HelpCenter.tsx` itself: that reaches core-ui's `Icon`, which calls
 * `require.context`, a webpack builtin that does not exist under jest, so the
 * suite would fail to *run*. Hence the last test here, which is the weaker
 * source-level half: it checks that the component still renders this table
 * rather than a list of its own.
 *
 * By label, deliberately: NAT-012 AC2 audits the editor's `openExternal` call
 * sites, and a label is what a reader of that audit can match against what they
 * see in the menu.
 */

import fs from 'fs';
import path from 'path';

import { COMMUNITY_URL } from '../../src/editor/src/models/community/communityorigin';
import { HELP_CENTER_LINKS, HelpCenterLink } from '../../src/editor/src/views/HelpCenter/helpCenterLinks';

const rows = HELP_CENTER_LINKS.filter((entry): entry is HelpCenterLink => entry !== 'divider');
const byLabel = new Map(rows.map((row) => [row.label, row.url]));

describe('the ? menu', () => {
  it('offers the community platform', () => {
    expect(byLabel.get('NodeGX Community')).toBe(COMMUNITY_URL);
  });

  it('still offers the destinations POL-002 and ALPHA-006 put there', () => {
    // A regression that DROPPED a row would otherwise pass the test above.
    expect([...byLabel.keys()]).toEqual([
      'Documentation',
      'YouTube',
      'NodeGX Community',
      'Discord',
      'Report a bug',
      'Report a node behaving wrongly',
      'Suggest a feature'
    ]);
  });

  it.each(rows.map((row) => [row.label, row.url]))('sends `%s` to an https URL (%s)', (_label, url) => {
    // `linkActionFor` ignores non-http schemes, so a row with a `noodl://` or a
    // bare path would render, be clickable, and do nothing at all.
    expect(url).toMatch(/^https:\/\/\S+$/);
  });

  it('is the list the ? button actually renders', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src', 'editor', 'src', 'views', 'HelpCenter', 'HelpCenter.tsx'),
      'utf8'
    );
    expect(source).toContain('HELP_CENTER_LINKS.map(');
    expect(source).toContain('platform.openExternal(entry.url)');
  });
});
