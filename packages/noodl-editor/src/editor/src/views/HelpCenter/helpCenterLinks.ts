/**
 * Every place the `?` button's menu can send you, as data rather than as eight
 * closures inline in the JSX.
 *
 * FB-008 (Richard's item 8: "the community web page link should go into the
 * question mark icon") made this a table for two reasons. The first is that
 * adding a fourth destination made it a list worth enumerating: NAT-012 AC2
 * audits every `openExternal` in the editor, and a table has one call site to
 * account for where eight inline `onClick`s have eight.
 *
 * The second is that it is the only way to grade the menu from a test. This
 * file is deliberately a **sibling** of `HelpCenter.tsx` rather than part of it:
 * the component reaches core-ui's `Icon`, which calls `require.context` — a
 * webpack builtin that does not exist under `jest`, so a spec that imports the
 * component fails to *run*, let alone assert anything. This module's only
 * imports are two dependency-free constants, which is what makes the shipped
 * list reachable from `tests-unit/`.
 *
 * @module views/HelpCenter/helpCenterLinks
 */
import { COMMUNITY_URL } from '@noodl-models/community/communityorigin';

import { EXTERNAL_LINKS } from '@noodl-core-ui/constants/externalLinks';

/**
 * This repository. The issue forms below live in `.github/ISSUE_TEMPLATE/`;
 * `blank_issues_enabled` is on, so `issues/new/choose` is a valid fallback if a
 * form is ever renamed.
 */
const REPO_URL = 'https://github.com/The-Low-Code-Foundation/NodeGX';

/** File an issue against one of `.github/ISSUE_TEMPLATE/`'s forms. */
function issueForm(template: string): string {
  return `${REPO_URL}/issues/new?template=${template}`;
}

/** One destination in the `?` menu: a label, and the URL it opens externally. */
export interface HelpCenterLink {
  label: string;
  url: string;
}

export const HELP_CENTER_LINKS: readonly (HelpCenterLink | 'divider')[] = [
  { label: 'Documentation', url: EXTERNAL_LINKS.docs },
  { label: 'YouTube', url: EXTERNAL_LINKS.youtube },
  /**
   * FB-008. The community wing exists to retire the Discord (UNI-011: "the
   * immediate goal behind it is Richard retiring the Discord"), but retiring it
   * is a move you make once the replacement has people in it, not the day you
   * first list it — so both rows stand until Richard says otherwise, with the
   * destination we own listed first.
   */
  { label: 'NodeGX Community', url: COMMUNITY_URL },
  { label: 'Discord', url: EXTERNAL_LINKS.discord },
  'divider',
  { label: 'Report a bug', url: issueForm('bug_report.yml') },
  { label: 'Report a node behaving wrongly', url: issueForm('node_report.yml') },
  { label: 'Suggest a feature', url: issueForm('feature_request.yml') }
];
