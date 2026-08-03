/**
 * The "?" in the bottom bar.
 *
 * ALPHA-006 §6 (finding F69). Every destination in here used to be Noodl's: the
 * Noodl docs host (with a `/<version>/` segment) for getting started, guides and
 * release notes, the Noodl forum for support, the Noodl site for contact,
 * Noodl's YouTube channel for videos, and Noodl's Discord for the community.
 * None of them went through `getDocsEndpoint()`, so they reached the actual
 * Noodl site — a different product — and the version segment came from *our*
 * version number, which that site has never had a build for.
 *
 * The "Quick search docs" box was the worst of it: a hardcoded Algolia
 * application id, search key, and an index name pinned to **Noodl 2.9's
 * documentation**. Every result it returned described a product we do not ship,
 * and getting there sent whatever the user typed to a third party — one of the
 * nine data flows PRIVACY.md declares, and the only one that ever carried typed
 * text.
 *
 * ## What replaced it, and what did not
 *
 * The docs site has had its own local search since it moved off Algolia; the
 * editor never followed. Rather than re-implement an in-editor search box
 * against a search index that does not exist yet, the box links out to the
 * site's `/search` page. That deletes the Algolia client outright, so the data
 * flow goes with it (PRIVACY.md is updated in the same commit).
 *
 * ⚠️ **There is deliberately no community link.** The Discord that was here is
 * Noodl's, and whether there is to be a NodeGX server is an open question for
 * Richard (ALPHA-007's open question 4), not something to invent a URL for.
 * GitHub Discussions is not enabled on the repository either — the issue forms
 * are the only channel that genuinely exists today, so they are the only one
 * offered. Add the community entry when there is a community to point at.
 */

import React, { useRef, useState } from 'react';

import { platform } from '@noodl/platform';

import getDocsEndpoint from '@noodl-utils/getDocsEndpoint';

import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { Portal } from '@noodl-core-ui/components/layout/Portal';
import { MenuDialog } from '@noodl-core-ui/components/popups/MenuDialog';

import css from './HelpCenter.module.scss';

/**
 * This repository. The issue forms below were added 2026-07-30 and are the
 * product's only working feedback channel; `blank_issues_enabled` is on, so
 * `issues/new/choose` is a valid fallback if a form is ever renamed.
 */
const REPO_URL = 'https://github.com/The-Low-Code-Foundation/OpenNoodl';

/** File an issue against one of `.github/ISSUE_TEMPLATE/`'s forms. */
function issueForm(template: string): string {
  return `${REPO_URL}/issues/new?template=${template}`;
}

export function HelpCenter() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isDialogVisible, setIsDialogVisible] = useState(false);

  const portalRoot = document.querySelector('.help-center-layer');

  if (!portalRoot) return null;

  // Read at open time rather than at module load: `useLocalDocs` points this at
  // a local docs build, and a developer who starts one mid-session should not
  // have to restart the editor to reach it.
  const openDocs = (path: string) => () => platform.openExternal(getDocsEndpoint() + path);

  return (
    <Portal portalRoot={portalRoot}>
      <div className={css['Root']} ref={rootRef} onClick={() => setIsDialogVisible(true)}>
        <IconButton icon={IconName.QuestionFree} variant={IconButtonVariant.OpaqueOnHover} size={IconSize.Large} />
      </div>

      <MenuDialog
        triggerRef={rootRef}
        isVisible={isDialogVisible}
        onClose={() => setIsDialogVisible(false)}
        items={[
          { label: 'Search the docs', icon: IconName.Search, onClick: openDocs('/search') },
          'divider',
          { label: 'Getting started', onClick: openDocs('/docs/getting-started/overview') },
          { label: 'Guides', onClick: openDocs('/docs/learn') },
          { label: 'Release notes', onClick: openDocs('/whats-new/') },
          'divider',
          { label: 'Report a bug', onClick: () => platform.openExternal(issueForm('bug_report.yml')) },
          { label: 'Report a node behaving wrongly', onClick: () => platform.openExternal(issueForm('node_report.yml')) },
          { label: 'Suggest a feature', onClick: () => platform.openExternal(issueForm('feature_request.yml')) }
        ]}
      />
    </Portal>
  );
}
