/**
 * What the agent is actually shown.
 *
 * 🔴 **Richard, 2026-08-10:** *"The user can preview the rendered page,
 * otherwise how would they know if the browser rendered the right part? … we
 * can't leave users in the dark about what the AI has seen."*
 *
 * That is a trust problem before it is a usability one. Every other reference
 * kind is inspectable by construction — a component is on the canvas, a doc is
 * in the docs panel, a mention names a thing the user chose. A **capture** is
 * the one whose entire content is invisible, produced by a browser window that
 * by definition nobody can see, and the chip could only ever say how many
 * kilobytes it was. A capture of a cookie banner, of a loading state, or of the
 * wrong viewport is indistinguishable from a good one until a billed turn comes
 * back confused.
 *
 * ⚠️ **It shows the bytes that will be sent, not a re-render.** The `src` is the
 * reference's own base64 block — so what is on screen here is byte-identical to
 * what the provider receives. A preview that re-captured, or that scaled from a
 * different source, would be a picture of *something like* what was sent, which
 * is exactly the reassurance-without-information this exists to remove.
 *
 * @module AiAuthoringPanel/thread/ReferencePreview
 */

import React, { useEffect } from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { formatBytes } from '../../../../models/AiAssistant/thread/fileAttachments';
import type { AttachedReference } from '../../../../models/AiAssistant/thread/references';

import css from './ReferencePreview.module.scss';

export interface ReferencePreviewProps {
  reference: AttachedReference;
  onClose: () => void;
}

export function ReferencePreview({ reference, onClose }: ReferencePreviewProps) {
  // Escape closes, like every other transient surface in this panel.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const image = reference.resolution?.images?.[0];
  if (!image) return null;

  return (
    <div
      className={css['Backdrop']}
      onClick={onClose}
      data-test="reference-preview-overlay"
      role="presentation"
    >
      {/* Stop a click inside the sheet closing it — the backdrop is the target. */}
      <div className={css['Sheet']} onClick={(event) => event.stopPropagation()}>
        <div className={css['Header']}>
          <Text textType={TextType.Default} isSpan className={css['Title']}>
            {reference.label}
          </Text>
          <PrimaryButton
            label="Close"
            icon={IconName.Close}
            variant={PrimaryButtonVariant.MutedOnLowBg}
            size={PrimaryButtonSize.Small}
            onClick={onClose}
            testId="reference-preview-close"
          />
        </div>

        {/*
         * ⚠️ Scrolls, and that is the point rather than a fallback. A full-page
         * capture of a long page is genuinely tall — measured at 195×4047 for a
         * page 9.6× its viewport — so fitting it to the sheet would shrink the
         * evidence to an unreadable strip. It is shown at its natural width
         * inside a scroller, which is how you check the bottom of a page
         * actually rendered.
         */}
        <div className={css['Stage']}>
          <img
            className={css['Image']}
            src={`data:${image.mediaType};base64,${image.data}`}
            alt={`Capture: ${reference.label}`}
            data-test="reference-preview-image"
          />
        </div>

        {/*
         * The twin, verbatim. The picture answers "did it render the right
         * thing"; this answers "and what was the agent told about it" — which
         * is the other half of not being in the dark, and the half a text-only
         * model acts on instead of the image.
         */}
        {reference.resolution?.text && (
          <details className={css['Twin']}>
            <summary className={css['TwinSummary']}>
              What the agent is told about this picture
              {reference.resolution.bytes !== undefined ? ` · ${formatBytes(reference.resolution.bytes)}` : ''}
            </summary>
            <pre className={css['TwinText']} data-test="reference-preview-twin">
              {reference.resolution.text}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
