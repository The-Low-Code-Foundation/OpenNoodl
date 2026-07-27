import React, { useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import { PropertyPanelCheckbox } from '@noodl-core-ui/components/property-panel/PropertyPanelCheckbox';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PanelRow, PanelRowVariant } from '@noodl-core-ui/components/sidebar/PanelRow';

export function SitemapSection() {
  const [enabled, setEnabled] = useState(!!ProjectModel.instance.settings['sitemap.enabled']);

  function handleEnable(value: boolean) {
    setEnabled(value);
    ProjectModel.instance.setSetting('sitemap.enabled', value);
  }

  // function handlePreviewSitemap() {
  //   // TODO: Show sitemap
  // }

  return (
    <CollapsableSection title="Experimental features - Sitemap" hasGutter hasVisibleOverflow hasTopDivider isClosed>
      <PanelRow label="Enable" variant={PanelRowVariant.Toggle}>
        <PropertyPanelCheckbox value={enabled} onChange={handleEnable} />
      </PanelRow>

      {/* <PrimaryButton
        size={PrimaryButtonSize.Small}
        label="Preview Sitemap"
        variant={PrimaryButtonVariant.MutedOnLowBg}
        onClick={handlePreviewSitemap}
        isGrowing
      /> */}
    </CollapsableSection>
  );
}
