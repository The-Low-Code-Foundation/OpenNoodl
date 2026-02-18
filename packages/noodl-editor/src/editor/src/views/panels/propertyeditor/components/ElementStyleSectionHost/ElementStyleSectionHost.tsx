/**
 * STYLE-005: ElementStyleSectionHost
 *
 * Editor-side wrapper that combines ElementStyleSection (variant + size picker)
 * with the SuggestionBanner. Lives in noodl-editor (not noodl-core-ui) so it
 * can import editor-specific hooks and services.
 *
 * Keeps its own StyleTokensModel instance for suggestion actions. Multiple
 * instances are safe — they sync via ProjectModel.metadataChanged events.
 */

import { useStyleSuggestions } from '@noodl-hooks/useStyleSuggestions';
import React, { useCallback, useEffect, useState } from 'react';

import { StyleTokensModel } from '@noodl-models/StyleTokensModel';

import {
  ElementStyleSection,
  ElementStyleSectionProps
} from '@noodl-core-ui/components/propertyeditor/ElementStyleSection';
import { SuggestionBanner } from '@noodl-core-ui/components/StyleSuggestions';

import { executeSuggestionAction } from '../../../../../services/StyleAnalyzer/SuggestionActionHandler';

/**
 * Drop-in replacement for ElementStyleSection in propertyeditor.ts.
 * Adds an optional SuggestionBanner beneath the style controls when
 * the StyleAnalyzer finds something worth suggesting.
 */
export function ElementStyleSectionHost(props: ElementStyleSectionProps) {
  const [tokenModel] = useState<StyleTokensModel>(() => new StyleTokensModel());

  // Dispose the model when the host unmounts to avoid listener leaks
  useEffect(() => {
    return () => tokenModel.dispose();
  }, [tokenModel]);

  const { activeSuggestion, dismissSession, dismissPermanent, refresh } = useStyleSuggestions();

  const handleAccept = useCallback(() => {
    if (!activeSuggestion) return;
    executeSuggestionAction(activeSuggestion, { tokenModel, onComplete: refresh });
  }, [activeSuggestion, tokenModel, refresh]);

  const handleDismiss = useCallback(() => {
    if (!activeSuggestion) return;
    dismissSession(activeSuggestion.id);
  }, [activeSuggestion, dismissSession]);

  const handleNeverShow = useCallback(() => {
    if (!activeSuggestion) return;
    dismissPermanent(activeSuggestion.id);
  }, [activeSuggestion, dismissPermanent]);

  return (
    <>
      <ElementStyleSection {...props} />
      {activeSuggestion && (
        <SuggestionBanner
          suggestion={activeSuggestion}
          onAccept={handleAccept}
          onDismiss={handleDismiss}
          onNeverShow={handleNeverShow}
        />
      )}
    </>
  );
}
