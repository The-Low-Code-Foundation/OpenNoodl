import { useEventListener } from '@noodl-hooks/useEventListener';
import React, { useState, useCallback } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';

import { IdentitySection } from './sections/IdentitySection';
import { PWASection } from './sections/PWASection';
import { SEOSection } from './sections/SEOSection';
import { VariablesSection } from './sections/VariablesSection';

export function AppSetupPanel() {
  const [, forceUpdate] = useState(0);

  // Listen for metadata changes to refresh the panel
  useEventListener(
    ProjectModel.instance,
    'ProjectModel.metadataChanged',
    useCallback((data: { key: string }) => {
      if (data.key === 'appConfig') {
        forceUpdate((prev) => prev + 1);
      }
    }, [])
  );

  const config = ProjectModel.instance.getAppConfig();

  const updateIdentity = useCallback((updates: Partial<typeof config.identity>) => {
    const currentConfig = ProjectModel.instance.getAppConfig();
    ProjectModel.instance.updateAppConfig({
      identity: { ...currentConfig.identity, ...updates }
    });
  }, []);

  const updateSEO = useCallback((updates: Partial<typeof config.seo>) => {
    const currentConfig = ProjectModel.instance.getAppConfig();
    ProjectModel.instance.updateAppConfig({
      seo: { ...currentConfig.seo, ...updates }
    });
  }, []);

  const updatePWA = useCallback((updates: Partial<NonNullable<typeof config.pwa>>) => {
    const currentConfig = ProjectModel.instance.getAppConfig();
    ProjectModel.instance.updateAppConfig({
      pwa: { ...(currentConfig.pwa || {}), ...updates } as NonNullable<typeof config.pwa>
    });
  }, []);

  const updateVariables = useCallback((variables: typeof config.variables) => {
    // Defer the update to avoid re-render race condition
    setTimeout(() => {
      ProjectModel.instance.updateAppConfig({
        variables
      });
    }, 0);
  }, []);

  return (
    <BasePanel title="App Setup" hasContentScroll>
      <IdentitySection identity={config.identity} onChange={updateIdentity} />

      <SEOSection seo={config.seo} identity={config.identity} onChange={updateSEO} />

      <PWASection pwa={config.pwa} onChange={updatePWA} />

      <VariablesSection variables={config.variables} onChange={updateVariables} />
    </BasePanel>
  );
}
