/**
 * BLD-009 — the same thread, in the surface that has room for it.
 *
 * ## This file is a shell, and that is the design
 *
 * A twenty-minute build across seven components, with a plan, a live preview and
 * a conversation, is not a 400px object — but a quick "change this component"
 * *is*, so moving the Build panel out of the rail would be a downgrade. Both
 * hosts therefore render **one** `AiAuthoringPanel` instance: this document
 * contributes a top bar and an empty box, publishes the box through
 * `expandedBuildHost`, and the panel paints itself into it with `createPortal`.
 *
 * That is what makes the acceptance criterion *"expand mid-run: the run
 * continues, the thread keeps its scroll position, nothing restarts"* true by
 * construction rather than by care. The panel holds the `AuthoringSession`, the
 * plan store subscription and the composer's text in `useState`; a second mount
 * would have none of them, and a run started in the rail would have carried on
 * invisibly behind an empty document. Nothing here is mounted twice, so there is
 * nothing to resynchronise.
 *
 * ⚠️ **Expanded-ness is not stored anywhere.** It is `CurrentDocumentId ===
 * ExpandedBuildDocumentProvider.ID`, derived on both sides through
 * `threadHost()`. A boolean beside it would be a second opinion that any other
 * `openDocument` call could silently falsify — and there are several: Accept
 * switches the canvas to the component it just wrote, and Review changes opens
 * the diff. Those take the surface, honestly and visibly, and the thread returns
 * to the rail with every piece of its state intact.
 *
 * @module noodl-editor/views/documents/ExpandedBuildDocument
 */

import React, { useCallback, useEffect } from 'react';

import { AppRegistry, IDocumentProvider } from '@noodl-models/app_registry';
import { COLLAPSE_LABEL } from '@noodl-models/AiAssistant/thread';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Label } from '@noodl-core-ui/components/typography/Label';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { EditorDocumentProvider } from '../EditorDocument';
import css from './ExpandedBuildDocument.module.scss';
import { setExpandedContainer } from './expandedBuildHost';

function ExpandedBuildDocument() {
  const collapse = useCallback(() => AppRegistry.instance.openDocument(EditorDocumentProvider.ID), []);

  /*
   * ⚠️ The release has to happen on unmount, not on the collapse button.
   *
   * Every other route out of this document — Accept switching to the canvas,
   * Review changes opening the diff, the user clicking a component in the
   * Components panel — replaces the document without going anywhere near that
   * button. Hanging the release off the click would leave a detached node
   * registered as the expanded surface, and the panel would keep portalling into
   * a box that is no longer in the page: a Build panel that renders nothing, in
   * either host.
   */
  useEffect(() => () => setExpandedContainer(null), []);

  return (
    <div className={css.Root}>
      <div className={css.Topbar}>
        <Label hasLeftSpacing>Build</Label>
        <div className={css.Status}>
          <Text textType={TextType.Shy}>
            The same conversation as the Build panel — it is the same thread, not a copy.
          </Text>
        </div>
        <div className={css.Actions}>
          <PrimaryButton
            label={COLLAPSE_LABEL}
            icon={IconName.ArrowLineLeft}
            variant={PrimaryButtonVariant.MutedOnLowBg}
            onClick={collapse}
            testId="build-collapse"
          />
        </div>
      </div>

      {/* The box the Build panel paints into. Empty in this file's own tree, by
          design — see the module note. */}
      <div className={css.Surface} data-test="expanded-build-surface" ref={setExpandedContainer} />
    </div>
  );
}

export class ExpandedBuildDocumentProvider implements IDocumentProvider {
  public static ID = 'ExpandedBuildDocumentProvider';

  getComponent() {
    return ExpandedBuildDocument;
  }
}
