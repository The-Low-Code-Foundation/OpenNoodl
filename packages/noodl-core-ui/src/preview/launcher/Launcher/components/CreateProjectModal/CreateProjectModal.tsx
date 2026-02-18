import React, { useState, useEffect } from 'react';

import { PrimaryButton, PrimaryButtonVariant, PrimaryButtonSize } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { PresetDisplayInfo, PresetSelector } from '@noodl-core-ui/components/StylePresets';
import { Label } from '@noodl-core-ui/components/typography/Label';

import css from './CreateProjectModal.module.scss';

export interface CreateProjectModalProps {
  isVisible: boolean;
  onClose: () => void;
  /**
   * Called when the user confirms project creation.
   * @param name    Project name entered by the user.
   * @param location Directory path chosen by the user.
   * @param presetId Id of the selected style preset (e.g. 'modern', 'minimal').
   */
  onConfirm: (name: string, location: string, presetId: string) => void;
  onChooseLocation?: () => Promise<string | null>;
  /**
   * Optional list of style presets to show in the modal.
   * When provided a PresetSelector is rendered; when omitted the selector is hidden.
   * Pass the result of `getAllPresets()` from noodl-editor's StylePresetsModel.
   */
  presets?: PresetDisplayInfo[];
}

const DEFAULT_PRESET_ID = 'modern';

export function CreateProjectModal({
  isVisible,
  onClose,
  onConfirm,
  onChooseLocation,
  presets
}: CreateProjectModalProps) {
  const [projectName, setProjectName] = useState('');
  const [location, setLocation] = useState('');
  const [isChoosingLocation, setIsChoosingLocation] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESET_ID);

  // Reset state when modal opens
  useEffect(() => {
    if (isVisible) {
      setProjectName('');
      setLocation('');
      setSelectedPresetId(DEFAULT_PRESET_ID);
    }
  }, [isVisible]);

  const handleChooseLocation = async () => {
    if (!onChooseLocation) return;

    setIsChoosingLocation(true);
    try {
      const chosen = await onChooseLocation();
      if (chosen) {
        setLocation(chosen);
      }
    } finally {
      setIsChoosingLocation(false);
    }
  };

  const handleCreate = () => {
    if (!projectName.trim() || !location) return;
    onConfirm(projectName.trim(), location, selectedPresetId);
  };

  const isValid = projectName.trim().length > 0 && location.length > 0;

  if (!isVisible) return null;

  return (
    <div className={css['Backdrop']} onClick={onClose}>
      <div className={css['Modal']} onClick={(e) => e.stopPropagation()}>
        <div className={css['Header']}>
          <h3 className={css['Title']}>Create New Project</h3>
        </div>

        <div className={css['Content']}>
          {/* Project Name */}
          <div className={css['Field']}>
            <Label>Project Name</Label>
            <TextInput
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My New Project"
              isAutoFocus
              UNSAFE_style={{ marginTop: 'var(--spacing-2)' }}
            />
          </div>

          {/* Location */}
          <div className={css['Field']}>
            <Label>Location</Label>
            <div className={css['LocationRow']}>
              <TextInput
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Choose folder..."
                isReadonly
                UNSAFE_style={{ flex: 1 }}
              />
              <PrimaryButton
                label="Choose..."
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={handleChooseLocation}
                isDisabled={isChoosingLocation}
                UNSAFE_style={{ marginLeft: 'var(--spacing-2)' }}
              />
            </div>
          </div>

          {/* Style Preset Selector */}
          {presets && presets.length > 0 && (
            <div className={css['Field']}>
              <PresetSelector presets={presets} selectedId={selectedPresetId} onChange={setSelectedPresetId} />
            </div>
          )}

          {/* Preview full path */}
          {projectName && location && (
            <div className={css['PathPreview']}>
              <span className={css['PathText']}>
                Full path: {location}/{projectName}/
              </span>
            </div>
          )}
        </div>

        <div className={css['Footer']}>
          <PrimaryButton
            label="Cancel"
            size={PrimaryButtonSize.Default}
            variant={PrimaryButtonVariant.Muted}
            onClick={onClose}
            UNSAFE_style={{ marginRight: 'var(--spacing-2)' }}
          />
          <PrimaryButton label="Create" size={PrimaryButtonSize.Default} onClick={handleCreate} isDisabled={!isValid} />
        </div>
      </div>
    </div>
  );
}
