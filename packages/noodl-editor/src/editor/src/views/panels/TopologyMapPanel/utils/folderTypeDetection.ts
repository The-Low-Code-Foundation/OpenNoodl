/**
 * Folder Type Detection
 *
 * Logic to classify folders into semantic types based on path and component characteristics.
 */

import { ComponentModel } from '@noodl-models/componentmodel';

import { FolderType } from './topologyTypes';

/**
 * Determines if a component is a page based on naming conventions.
 *
 * @param component Component to check
 * @returns True if component appears to be a page
 */
function isPageComponent(component: ComponentModel): boolean {
  const name = component.name.toLowerCase();
  const fullName = component.fullName.toLowerCase();

  return (
    name.includes('page') ||
    name.includes('screen') ||
    name.includes('route') ||
    name === 'app' ||
    name === 'root' ||
    fullName.startsWith('/app') ||
    fullName.startsWith('/page')
  );
}

/**
 * Detects the type of a folder based on its path and components.
 *
 * Classification rules:
 * - **page**: Root-level or contains page/screen components
 * - **integration**: Starts with # and matches known service patterns (Directus, Supabase, etc.)
 * - **ui**: Starts with # and matches UI patterns (#UI, #Components, #Design)
 * - **utility**: Starts with # and matches utility patterns (#Global, #Utils, #Shared, #Helpers)
 * - **feature**: Starts with # and represents a feature domain (#Forms, #Auth, etc.)
 * - **orphan**: Special case for components without connections (handled separately)
 *
 * @param folderPath The folder path
 * @param components Components in the folder
 * @returns The detected folder type
 */
export function detectFolderType(folderPath: string, components: ComponentModel[]): FolderType {
  const normalizedPath = folderPath.toLowerCase();

  // Root folder (/) - treat as pages
  if (folderPath === '/') {
    return 'page';
  }

  // Check if folder contains page components
  const hasPageComponents = components.some((c) => isPageComponent(c));
  if (hasPageComponents) {
    return 'page';
  }

  // Extract folder name (remove leading /, #, etc.)
  const folderName = folderPath.replace(/^\/+/, '').replace(/^#/, '').toLowerCase();

  // Integration patterns - external services
  const integrationPatterns = [
    'directus',
    'supabase',
    'firebase',
    'airtable',
    'stripe',
    'auth0',
    'swapcard',
    'api',
    'rest',
    'graphql',
    'backend'
  ];

  if (integrationPatterns.some((pattern) => folderName.includes(pattern))) {
    return 'integration';
  }

  // UI patterns - visual components
  const uiPatterns = ['ui', 'component', 'design', 'layout', 'widget', 'button', 'card', 'modal', 'dialog'];

  if (uiPatterns.some((pattern) => folderName.includes(pattern))) {
    return 'ui';
  }

  // Utility patterns - foundational utilities
  const utilityPatterns = ['global', 'util', 'helper', 'shared', 'common', 'core', 'lib', 'tool', 'function'];

  if (utilityPatterns.some((pattern) => folderName.includes(pattern))) {
    return 'utility';
  }

  // Feature patterns - domain-specific features
  const featurePatterns = ['form', 'auth', 'user', 'profile', 'dashboard', 'admin', 'setting', 'search', 'filter'];

  if (featurePatterns.some((pattern) => folderName.includes(pattern))) {
    return 'feature';
  }

  // Default to feature for any other # prefixed folder
  if (normalizedPath.startsWith('/#')) {
    return 'feature';
  }

  // Fallback to feature type
  return 'feature';
}
