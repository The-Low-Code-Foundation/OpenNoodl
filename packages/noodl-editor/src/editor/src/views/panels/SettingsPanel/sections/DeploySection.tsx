import React, { useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import { Box } from '@noodl-core-ui/components/layout/Box';
import { PropertyPanelCheckbox } from '@noodl-core-ui/components/property-panel/PropertyPanelCheckbox';
import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { ExperimentalFlag, ExperimentalFlagVariant } from '@noodl-core-ui/components/sidebar/ExperimentalFlag';
import { PanelRow, PanelRowVariant } from '@noodl-core-ui/components/sidebar/PanelRow';
import { Text } from '@noodl-core-ui/components/typography/Text';

export function DeploySection() {
  const [enabledDeployDate, setEnabledDeployDate] = useState(!!ProjectModel.instance.settings['deployEnvDate']);
  const [enabledGitStats, setEnabledGitStats] = useState(!!ProjectModel.instance.settings['deployEnvGitStats']);
  const [baseUrl, setBaseUrl] = useState<string>(ProjectModel.instance.settings['baseUrl']);

  function handleBaseUrl(value: string) {
    setBaseUrl(value);
    ProjectModel.instance.setSetting('baseUrl', value);
  }

  function handleEnableDeployDate(value: boolean) {
    setEnabledDeployDate(value);
    ProjectModel.instance.setSetting('deployEnvDate', value);
  }

  function handleEnableGitStats(value: boolean) {
    setEnabledGitStats(value);
    ProjectModel.instance.setSetting('deployEnvGitStats', value);
  }

  return (
    <CollapsableSection title="Experimental features - Deploy Settings" hasGutter hasVisibleOverflow isClosed>
      <ExperimentalFlag
        variant={ExperimentalFlagVariant.NoPadding}
        text="All these settings are temporary and will be moved to another place in a future version."
      />
      <PanelRow label="Custom base url" helpText="Noodl.Env.BaseUrl: get the current base url.">
        <PropertyPanelTextInput value={baseUrl} onChange={handleBaseUrl} />
      </PanelRow>

      <Box hasBottomSpacing hasTopSpacing>
        <Text>Include some extra variables in Noodl.Env:</Text>
      </Box>

      <PanelRow
        label="Deploy date"
        variant={PanelRowVariant.Toggle}
        helpText="Noodl.Env.DeployedAt: the deploy date time in UTC format."
      >
        <PropertyPanelCheckbox value={enabledDeployDate} onChange={handleEnableDeployDate} />
      </PanelRow>

      <PanelRow
        label="Git stats"
        variant={PanelRowVariant.Toggle}
        helpText="Noodl.Env.GitBranch and Noodl.Env.GitSha: the current git branch and commit sha."
      >
        <PropertyPanelCheckbox value={enabledGitStats} onChange={handleEnableGitStats} />
      </PanelRow>
    </CollapsableSection>
  );
}
