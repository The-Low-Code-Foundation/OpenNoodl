/**
 * The `?` button in the editor's bottom-right.
 *
 * POL-002 cut this down to the same three links the launcher footer carries.
 * What it used to be: eleven menu items, a full Algolia search modal wired to
 * index `docs_2-9` (Noodl's documentation index, with Noodl's app id and API
 * key hardcoded here), `docs.noodl.net/${version}/…` URLs built from
 * `platform.getVersion().slice(0, 3)` — which is `"0.1"`, so they would have
 * 404'd even on a domain we owned — plus `forum.noodl.net` and
 * `noodl.net/support`. None of it was ours and none of it resolved.
 *
 * Three items, one source of truth (`EXTERNAL_LINKS`), no search. A docs search
 * is worth having back once there is an index of our own to search; it is not
 * worth keeping a dependency on someone else's.
 */

import React, { useRef, useState } from 'react';

import { platform } from '@noodl/platform';

import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { Portal } from '@noodl-core-ui/components/layout/Portal';
import { MenuDialog } from '@noodl-core-ui/components/popups/MenuDialog';
import { EXTERNAL_LINKS } from '@noodl-core-ui/constants/externalLinks';

import css from './HelpCenter.module.scss';

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
        items={[
          { label: 'Documentation', onClick: () => platform.openExternal(EXTERNAL_LINKS.docs) },
          { label: 'YouTube', onClick: () => platform.openExternal(EXTERNAL_LINKS.youtube) },
          { label: 'Discord', onClick: () => platform.openExternal(EXTERNAL_LINKS.discord) }
        ]}
      />
    </Portal>
  );
}
