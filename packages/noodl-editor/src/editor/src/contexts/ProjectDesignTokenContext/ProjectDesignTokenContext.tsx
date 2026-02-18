import { useEventListener } from '@noodl-hooks/useEventListener';
import { useModel } from '@noodl-hooks/useModel';
import React, { createContext, useContext, useState, useEffect } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';
import { StylesModel } from '@noodl-models/StylesModel';
import { StyleTokenRecord, StyleTokensModel } from '@noodl-models/StyleTokensModel';

import { Slot } from '@noodl-core-ui/types/global';

import { DesignTokenColor, extractProjectColors } from './extractProjectColors';

export interface ProjectDesignTokenContext {
  /** Legacy named color styles (used by old property editor). */
  staticColors: DesignTokenColor[];
  /** Raw hex colors used in project (used by old property editor). */
  dynamicColors: DesignTokenColor[];
  /** Legacy text styles. */
  textStyles: TSFixme[];
  /** New STYLE-001 design tokens — full flat list. */
  designTokens: StyleTokenRecord[];
  /** StyleTokensModel instance for direct interaction. */
  styleTokensModel: StyleTokensModel | null;
}

const ProjectDesignTokenContext = createContext<ProjectDesignTokenContext>({
  staticColors: [],
  dynamicColors: [],
  textStyles: [],
  designTokens: [],
  styleTokensModel: null
});

export interface ProjectDesignTokenContextProps {
  children: Slot;
}

export function ProjectDesignTokenContextProvider({ children }: ProjectDesignTokenContextProps) {
  useModel(ProjectModel.instance);
  const [group] = useState({});

  const [staticColors, setStaticColors] = useState<DesignTokenColor[]>([]);
  const [dynamicColors, setDynamicColors] = useState<DesignTokenColor[]>([]);
  const [textStyles, setTextStyles] = useState<TSFixme[]>([]);
  const [designTokens, setDesignTokens] = useState<StyleTokenRecord[]>([]);
  const [styleTokensModel] = useState<StyleTokensModel>(() => new StyleTokensModel());

  // Sync legacy colors/text styles
  useEffect(() => {
    const stylesModel = new StylesModel();

    function extract() {
      const styles = stylesModel.getStyles('colors');
      const colors = extractProjectColors(ProjectModel.instance, styles);
      const textStyles = stylesModel.getStyles('text');

      setStaticColors(colors.staticColors);
      setDynamicColors(colors.dynamicColors);
      setTextStyles(textStyles);
    }

    stylesModel.on('stylesChanged', (args) => {
      if (['colors', 'text'].includes(args.type)) {
        extract();
      }
    });

    extract();

    return () => {
      stylesModel.dispose();
      ProjectModel.instance.off(group);
    };
  }, []);

  // Sync design tokens from StyleTokensModel
  useEffect(() => {
    setDesignTokens(styleTokensModel.getTokens());
  }, [styleTokensModel]);

  useEventListener(styleTokensModel, 'tokensChanged', () => {
    setDesignTokens(styleTokensModel.getTokens());
  });

  // Cleanup StyleTokensModel on unmount
  useEffect(() => {
    return () => {
      styleTokensModel.dispose();
    };
  }, [styleTokensModel]);

  return (
    <ProjectDesignTokenContext.Provider
      value={{
        staticColors,
        dynamicColors,
        textStyles,
        designTokens,
        styleTokensModel
      }}
    >
      {children}
    </ProjectDesignTokenContext.Provider>
  );
}

export function useProjectDesignTokenContext() {
  const context = useContext(ProjectDesignTokenContext);

  if (context === undefined) {
    throw new Error('useProjectDesignTokenContext must be a child of ProjectDesignTokenContextProvider');
  }

  return context;
}
