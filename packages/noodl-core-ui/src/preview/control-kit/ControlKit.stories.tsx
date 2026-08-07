import React, { useState } from 'react';

import type { Meta } from '@storybook/react';

import { Chip, ChipVariant } from '@noodl-core-ui/components/common/Chip';
import { Checkbox, CheckboxSize } from '@noodl-core-ui/components/inputs/Checkbox';
import { ToggleSwitch } from '@noodl-core-ui/components/inputs/ToggleSwitch';
import { BindingChip } from '@noodl-core-ui/components/property-panel/BindingChip';
import { PropertyPanelCheckbox } from '@noodl-core-ui/components/property-panel/PropertyPanelCheckbox';
import { PropertyPanelMarginPadding } from '@noodl-core-ui/components/property-panel/PropertyPanelMarginPadding';

/**
 * UIX-003 Control Kit gallery — a single review surface for the refreshed
 * interactive controls and their states (default / checked / disabled), the
 * severity chips, the binding chip, and the box-model editor. Toggle Storybook's
 * light/dark background to check both themes.
 */
const meta: Meta = {
  title: 'UIX-003/Control Kit'
};
export default meta;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 34 }}>
      <div style={{ width: 140, color: 'var(--theme-color-fg-muted)', fontSize: 12.5 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: 'var(--theme-color-fg-muted)',
        margin: '24px 0 8px'
      }}
    >
      {children}
    </div>
  );
}

export const Gallery = () => {
  const [checkA, setCheckA] = useState(true);
  const [checkB, setCheckB] = useState(false);
  const [toggleA, setToggleA] = useState(true);
  const [toggleB, setToggleB] = useState(false);
  const [ppCheck, setPpCheck] = useState(true);
  const [box, setBox] = useState({
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
    padding: { top: '16', bottom: '16', left: '12', right: '12' }
  });

  return (
    <div
      style={{
        fontFamily: 'var(--font-family)',
        color: 'var(--theme-color-fg-default)',
        maxWidth: 520,
        padding: 24,
        background: 'var(--theme-color-bg-1)'
      }}
    >
      <SectionTitle>Checkbox</SectionTitle>
      <Row label="Checkbox">
        <Checkbox label="Checked" isChecked={checkA} onChange={() => setCheckA(!checkA)} />
        <Checkbox label="Unchecked" isChecked={checkB} onChange={() => setCheckB(!checkB)} />
        <Checkbox label="Disabled" isChecked isDisabled />
      </Row>
      <Row label="Large / panel">
        <PropertyPanelCheckbox value={ppCheck} onChange={setPpCheck} />
        <PropertyPanelCheckbox value={false} onChange={() => undefined} />
        <Checkbox isChecked checkboxSize={CheckboxSize.Large} />
      </Row>

      <SectionTitle>Toggle switch</SectionTitle>
      <Row label="Toggle">
        <ToggleSwitch label="On" isChecked={toggleA} onChange={() => setToggleA(!toggleA)} />
        <ToggleSwitch label="Off" isChecked={toggleB} onChange={() => setToggleB(!toggleB)} />
      </Row>

      <SectionTitle>Chips</SectionTitle>
      <Row label="Severity">
        <Chip label="Local only" variant={ChipVariant.Neutral} />
        <Chip label="Connected" variant={ChipVariant.Accent} />
        <Chip label="React 17 runtime" variant={ChipVariant.Warning} />
        <Chip label="Failed" variant={ChipVariant.Danger} />
      </Row>

      <SectionTitle>Binding chip</SectionTitle>
      <Row label="Connected prop">
        <BindingChip source="CallCF · Result" />
      </Row>

      <SectionTitle>Box-model editor</SectionTitle>
      <div style={{ width: 236 }}>
        <PropertyPanelMarginPadding values={box} onChange={setBox} />
      </div>
    </div>
  );
};
