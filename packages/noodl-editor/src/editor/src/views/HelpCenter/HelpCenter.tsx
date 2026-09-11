/**
 * The `?` button in the editor's bottom-right.
 *
 * Two tasks arrived at this file independently and reached the same verdict:
 * POL-002 (phase 39) and ALPHA-006 §6 / finding F69 (phase 33). What it used to
 * be: eleven menu items, a full Algolia search modal wired to index `docs_2-9`
 * (Noodl's documentation index, with Noodl's app id and API key hardcoded here),
 * `docs.noodl.net/${version}/…` URLs built from `platform.getVersion().slice(0, 3)`
 * — which is `"0.1"`, so they would have 404'd even on a domain we owned — plus
 * `forum.noodl.net` and `noodl.net/support`. None of it was ours, none of it
 * resolved, and the search box was the only data flow in PRIVACY.md that ever
 * carried text the user typed.
 *
 * POL-002 landed first and owns the shape: three destinations, one source of
 * truth (`EXTERNAL_LINKS`, shared with the launcher footer), no search. A docs
 * search is worth having back once there is an index of our own to search; it is
 * not worth keeping a dependency on someone else's.
 *
 * ALPHA-006 §6 adds the second group: the repository's issue forms. Those are
 * the product's only working feedback channel that lives on our side of the
 * fence, so they belong in the one menu a user actually finds. Deliberately
 * *not* deep links into the docs site — POL-002 removed the last set of
 * versioned docs paths precisely because nothing verified they resolved, and
 * `EXTERNAL_LINKS.docs` is the one URL that is known to.
 *
 * FB-008 adds a fourth destination to POL-002's three — the community platform
 * — and moves the whole list into `./helpCenterLinks`, which is where the
 * reasoning for both now lives. In short: the origin is imported from
 * `@noodl-models/community` rather than added to `EXTERNAL_LINKS`, because that
 * constant is core-ui's and core-ui must not know about the platform.
 *
 * Note that this is not the richer report path: ALPHA-007 §1 puts
 * `Help → Report a problem…` in the *native* menu, where the main process can
 * screenshot the editor in the click handler before any dialog paints over the
 * evidence. That capture cannot be triggered from the renderer, so it is not
 * offered here; these entries open the plain GitHub forms.
 */

import React, { useRef, useState } from 'react';
import { platform } from '@noodl/platform';

import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { Portal } from '@noodl-core-ui/components/layout/Portal';
import { MenuDialog } from '@noodl-core-ui/components/popups/MenuDialog';

import css from './HelpCenter.module.scss';
import { HELP_CENTER_LINKS } from './helpCenterLinks';

export function HelpCenter() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isDialogVisible, setIsDialogVisible] = useState(false);

  const portalRoot = document.querySelector('.help-center-layer');

  if (!portalRoot) return null;

  return (
    <Portal portalRoot={portalRoot}>
      <div className={css['Root']} ref={rootRef} onClick={() => setIsDialogVisible(true)}>
        <IconButton icon={IconName.QuestionFree} variant={IconButtonVariant.OpaqueOnHover} size={IconSize.Large} />
      </div>

      <MenuDialog
        triggerRef={rootRef}
        isVisible={isDialogVisible}
        onClose={() => setIsDialogVisible(false)}
        items={HELP_CENTER_LINKS.map((entry) =>
          entry === 'divider' ? entry : { label: entry.label, onClick: () => platform.openExternal(entry.url) }
        )}
      />
    </Portal>
  );
}
