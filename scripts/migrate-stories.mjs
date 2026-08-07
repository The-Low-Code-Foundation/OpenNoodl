#!/usr/bin/env node
/**
 * Storybook CSF2 to CSF3 Migration Script
 * 
 * Migrates story files from:
 * - ComponentMeta/ComponentStory → Meta/StoryObj
 * - Template.bind({}) pattern → object-based stories
 */

import fs from 'fs';
import path from 'path';

const STORIES_DIR = 'packages/noodl-core-ui/src';

// Simple recursive file finder
function findFiles(dir, pattern, results = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findFiles(filePath, pattern, results);
    } else if (pattern.test(file)) {
      results.push(filePath);
    }
  }
  return results;
}

async function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  
  // Skip already migrated files
  if (content.includes('StoryObj<typeof meta>') || content.includes("from '@storybook/react'")) {
    if (!content.includes('ComponentStory') && !content.includes('ComponentMeta')) {
      console.log(`✓ Already migrated: ${filePath}`);
      return { skipped: true };
    }
  }

  // Step 1: Update imports
  // Replace: import { ComponentStory, ComponentMeta } from '@storybook/react';
  // With: import type { Meta, StoryObj } from '@storybook/react';
  content = content.replace(
    /import\s*\{?\s*ComponentStory\s*,\s*ComponentMeta\s*\}?\s*from\s*['"]@storybook\/react['"];?/g,
    "import type { Meta, StoryObj } from '@storybook/react';"
  );
  
  // Handle case where only ComponentMeta is imported
  content = content.replace(
    /import\s*\{?\s*ComponentMeta\s*\}?\s*from\s*['"]@storybook\/react['"];?/g,
    "import type { Meta, StoryObj } from '@storybook/react';"
  );
  
  // Handle case where only ComponentStory is imported
  content = content.replace(
    /import\s*\{?\s*ComponentStory\s*\}?\s*from\s*['"]@storybook\/react['"];?/g,
    "import type { Meta, StoryObj } from '@storybook/react';"
  );

  // Remove React import if it's only used for JSX (not hooks)
  // Keep if useState, useEffect, etc. are used
  const usesReactHooks = /\b(useState|useEffect|useCallback|useMemo|useRef|useContext)\b/.test(content);
  if (!usesReactHooks) {
    content = content.replace(/import\s+React(?:\s*,\s*\{[^}]*\})?\s+from\s+['"]react['"];?\n/g, '');
    content = content.replace(/import\s+\{[^}]*\}\s+from\s+['"]react['"];?\n/g, '');
  }

  // Step 2: Extract component name from the file
  const componentMatch = content.match(/component:\s*(\w+)/);
  if (!componentMatch) {
    console.log(`⚠ Could not find component in: ${filePath}`);
    return { skipped: true, reason: 'no component found' };
  }
  const componentName = componentMatch[1];

  // Step 3: Convert default export with ComponentMeta
  // From: export default { ... } as ComponentMeta<typeof Component>;
  // To: const meta: Meta<typeof Component> = { ... }; export default meta;
  content = content.replace(
    /export\s+default\s+(\{[\s\S]*?\})\s+as\s+ComponentMeta<typeof\s+(\w+)>;/,
    (match, config, comp) => {
      return `const meta: Meta<typeof ${comp}> = ${config};\n\nexport default meta;\ntype Story = StoryObj<typeof meta>;`;
    }
  );

  // Step 4: Remove Template function
  // Pattern: const Template: ComponentStory<typeof X> = (args) => <X {...args} />;
  const simpleTemplateRegex = /const\s+Template:\s*ComponentStory<typeof\s+\w+>\s*=\s*\(args\)\s*=>\s*<\w+\s+\{\.\.\.args\}\s*\/?>;?\n*/g;
  content = content.replace(simpleTemplateRegex, '');
  
  // Handle Templates with wrapper divs (needs render function)
  const complexTemplateRegex = /const\s+Template:\s*ComponentStory<typeof\s+\w+>\s*=\s*\(args\)\s*=>\s*\(/;
  const hasComplexTemplate = complexTemplateRegex.test(content);

  // Step 5: Convert story exports
  // From: export const Name = Template.bind({}); Name.args = { ... };
  // To: export const Name: Story = { args: { ... } };
  
  // Pattern for stories with args
  content = content.replace(
    /export\s+const\s+(\w+)\s*=\s*Template\.bind\(\{\}\);?\s*\n\1\.args\s*=\s*(\{[\s\S]*?\});/gm,
    (match, storyName, args) => {
      return `export const ${storyName}: Story = {\n  args: ${args.trim()},\n};`;
    }
  );

  // Pattern for stories without args (empty)
  content = content.replace(
    /export\s+const\s+(\w+)\s*=\s*Template\.bind\(\{\}\);?\s*\n\1\.args\s*=\s*\{\s*\};/gm,
    (match, storyName) => {
      return `export const ${storyName}: Story = {\n  args: {},\n};`;
    }
  );

  // Pattern for stories that just use Template.bind({}) without setting args
  content = content.replace(
    /export\s+const\s+(\w+)\s*=\s*Template\.bind\(\{\}\);?\n(?!\1\.)/gm,
    (match, storyName) => {
      return `export const ${storyName}: Story = {\n  args: {},\n};\n`;
    }
  );

  // Step 6: Convert inline typed stories (export const X: ComponentStory<typeof Y> = ...)
  content = content.replace(
    /export\s+const\s+(\w+):\s*ComponentStory<typeof\s+\w+>\s*=\s*\(args\)\s*=>\s*\(/gm,
    (match, storyName) => {
      return `export const ${storyName}: Story = {\n  render: (args) => (`;
    }
  );

  // Clean up any remaining ComponentStory/ComponentMeta references
  content = content.replace(/ComponentStory<typeof\s+\w+>/g, 'Story');
  content = content.replace(/ComponentMeta<typeof\s+\w+>/g, `Meta<typeof ${componentName}>`);

  // Clean up formatting
  content = content.replace(/\n{3,}/g, '\n\n');
  content = content.trim() + '\n';

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ Migrated: ${filePath}`);
    return { migrated: true };
  } else {
    console.log(`- No changes: ${filePath}`);
    return { unchanged: true };
  }
}

async function main() {
  console.log('🔄 Starting Storybook CSF2 to CSF3 migration...\n');
  
  const files = findFiles(STORIES_DIR, /\.stories\.tsx$/);
  console.log(`Found ${files.length} story files\n`);
  
  let migrated = 0;
  let skipped = 0;
  let unchanged = 0;
  let errors = 0;
  
  for (const file of files) {
    try {
      const result = await migrateFile(file);
      if (result.migrated) migrated++;
      else if (result.skipped) skipped++;
      else if (result.unchanged) unchanged++;
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error.message);
      errors++;
    }
  }
  
  console.log('\n📊 Migration Summary:');
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Unchanged: ${unchanged}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total: ${files.length}`);
}

main().catch(console.error);
