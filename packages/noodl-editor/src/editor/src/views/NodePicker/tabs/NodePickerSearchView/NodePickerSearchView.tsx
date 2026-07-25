import { useModel } from '@noodl-hooks/useModel';
import { useTogglableArray } from '@noodl-hooks/useTogglableArray';
import React, { useMemo, useState } from 'react';

import { IModule, ModuleLibraryModel } from '@noodl-models/modulelibrarymodel';
import { arrayIntersection, getMatchIndex } from '@noodl-utils/common';

import { ActivityIndicator } from '@noodl-core-ui/components/common/ActivityIndicator';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { SearchInput } from '@noodl-core-ui/components/inputs/SearchInput';
import { TagButton } from '@noodl-core-ui/components/inputs/TagButton';
import { Text } from '@noodl-core-ui/components/typography/Text';
import { TextType } from '@noodl-core-ui/components/typography/Text/Text';
import { Title, TitleVariant } from '@noodl-core-ui/components/typography/Title';

import { ModuleCard } from '../../components/ModuleCard';
import { tempcard, tempterm } from '../../components/ModuleCard/MuduleCard.utils';
import css from './NodePickerSearchView.module.scss';

export interface NodePickerSearchViewProps {
  itemType: 'prefab' | 'module';
  searchInputPlaceholder: string;
}

export function NodePickerSearchView({ itemType, searchInputPlaceholder }: NodePickerSearchViewProps) {
  const moduleLibraryModel = useModel(ModuleLibraryModel.instance, ['libraryUpdated']);

  const libraryKey = itemType === 'prefab' ? 'prefabs' : 'modules';
  const modules = itemType === 'prefab' ? moduleLibraryModel.prefabs : moduleLibraryModel.modules;
  const status = itemType === 'prefab' ? moduleLibraryModel.prefabsStatus : moduleLibraryModel.modulesStatus;

  const [searchTerm, setSearchTerm] = useState('');

  const [selectedTags, toggleTag, isTagSelected] = useTogglableArray();

  const allTags = useMemo(() => {
    if (!Array.isArray(modules)) return [];

    return [
      ...new Set(
        modules.reduce((prev, curr) => {
          if (curr?.tags?.length) return [...prev, ...curr.tags];
          return prev;
        }, [])
      )
    ] as IModule['tags'] | []; // FIXME: prone to error
  }, [modules]);

  const filteredModules = useMemo(() => {
    if (!Array.isArray(modules)) return [];

    let tempModules = [...modules];

    if (selectedTags.length) {
      tempModules = tempModules.filter((module) => Boolean(arrayIntersection(module.tags, selectedTags).length));
    }

    if (searchTerm) {
      tempModules = tempModules
        .filter((module) => getMatchIndex(module.label, searchTerm) >= 0)
        .map((module) => ({
          module: module,
          matchIndex: getMatchIndex(module.label, searchTerm)
        }))
        .sort((a, b) => a.matchIndex - b.matchIndex)
        .map((module) => module.module);
    }

    if (searchTerm.toLowerCase() === tempterm) {
      tempModules = new Array(6).fill(tempcard);
    }

    return tempModules;
  }, [modules, searchTerm, selectedTags]);

  return (
    <div className={css['Root']}>
      <div className={css['SearchContainer']}>
        <SearchInput placeholder={searchInputPlaceholder} onChange={setSearchTerm} />
      </div>

      <div className={css['TagList']}>
        {allTags.map((tag) => (
          <TagButton key={tag} label={tag} onClick={() => toggleTag(tag)} isActive={isTagSelected(tag)} />
        ))}
      </div>

      <div className={css['GridContainer']}>
        {status === 'error' && (
          <div className={css['StatusState']}>
            <Title variant={TitleVariant.Danger} isCentered hasBottomSpacing>
              Couldn&apos;t load the library
            </Title>
            <Text textType={TextType.Shy} isCentered hasBottomSpacing>
              Check your internet connection and try again.
            </Text>
            <PrimaryButton
              label="Retry"
              variant={PrimaryButtonVariant.Muted}
              onClick={() => ModuleLibraryModel.instance.retry(libraryKey)}
            />
          </div>
        )}

        {status === 'loading' && !Array.isArray(modules) && (
          <div className={css['StatusState']}>
            <ActivityIndicator />
          </div>
        )}

        {status === 'loaded' && Array.isArray(modules) && (
          <ul className={css['Grid']}>
            {filteredModules.map((module) => (
              <li key={module.label} className={css['ModuleContainer']}>
                <ModuleCard {...module} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
