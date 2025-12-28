#!/usr/bin/env node

/**
 * Phase 0 Foundation Health Check
 *
 * Validates that Phase 0 fixes are in place and working:
 * - Cache configuration
 * - useEventListener hook availability
 * - Build canary presence
 * - Anti-pattern detection
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
let exitCode = 0;
let checks = { passed: 0, warnings: 0, failed: 0 };

function pass(message) {
  console.log(`✅ ${message}`);
  checks.passed++;
}

function warn(message) {
  console.log(`⚠️  ${message}`);
  checks.warnings++;
}

function fail(message) {
  console.log(`❌ ${message}`);
  checks.failed++;
  exitCode = 1;
}

function section(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

// ==============================================================================
// CHECK 1: Webpack Cache Configuration
// ==============================================================================
section('1. Webpack Cache Configuration');

const webpackCorePath = path.join(rootDir, 'packages/noodl-editor/webpackconfigs/shared/webpack.renderer.core.js');

if (!fs.existsSync(webpackCorePath)) {
  fail('webpack.renderer.core.js not found');
} else {
  const webpackCore = fs.readFileSync(webpackCorePath, 'utf8');

  if (webpackCore.includes('cacheDirectory: false')) {
    pass('Babel cache disabled in webpack config');
  } else if (webpackCore.includes('cacheDirectory: true')) {
    fail('Babel cache ENABLED in webpack (should be false in dev)');
  } else {
    warn('Babel cacheDirectory setting not found (might be using defaults)');
  }
}

// ==============================================================================
// CHECK 2: Clean Script Exists
// ==============================================================================
section('2. Clean Script');

const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (packageJson.scripts && packageJson.scripts['clean:all']) {
  pass('clean:all script exists in package.json');
} else {
  fail('clean:all script missing from package.json');
}

// ==============================================================================
// CHECK 3: Build Canary
// ==============================================================================
section('3. Build Canary');

const editorEntryPath = path.join(rootDir, 'packages/noodl-editor/src/editor/index.ts');

if (!fs.existsSync(editorEntryPath)) {
  fail('Editor entry point not found');
} else {
  const editorEntry = fs.readFileSync(editorEntryPath, 'utf8');

  if (editorEntry.includes('BUILD TIMESTAMP')) {
    pass('Build canary present in editor entry point');
  } else {
    fail('Build canary missing from editor entry point');
  }
}

// ==============================================================================
// CHECK 4: useEventListener Hook
// ==============================================================================
section('4. useEventListener Hook');

const hookPath = path.join(rootDir, 'packages/noodl-editor/src/editor/src/hooks/useEventListener.ts');

if (!fs.existsSync(hookPath)) {
  fail('useEventListener.ts not found');
} else {
  const hookContent = fs.readFileSync(hookPath, 'utf8');

  if (hookContent.includes('export function useEventListener')) {
    pass('useEventListener hook exists and is exported');
  } else {
    fail('useEventListener hook not properly exported');
  }

  if (hookContent.includes('useRef') && hookContent.includes('useEffect')) {
    pass('useEventListener uses correct React hooks');
  } else {
    warn('useEventListener might not be using proper hook pattern');
  }
}

// ==============================================================================
// CHECK 5: Anti-Pattern Detection (Optional Warning)
// ==============================================================================
section('5. Anti-Pattern Detection (Scanning for Direct .on() Usage)');

const scanDirs = ['packages/noodl-editor/src/editor/src/views', 'packages/noodl-editor/src/editor/src/hooks'];

let foundAntiPatterns = false;

scanDirs.forEach((dir) => {
  const fullPath = path.join(rootDir, dir);
  if (!fs.existsSync(fullPath)) return;

  const files = getAllTsxFiles(fullPath);

  files.forEach((file) => {
    const content = fs.readFileSync(file, 'utf8');

    // Look for React components/hooks using .on() directly
    if (
      content.match(/function\s+\w+.*\{[\s\S]*?useEffect.*\.on\(/g) ||
      content.match(/const\s+\w+\s*=.*=>[\s\S]*?useEffect.*\.on\(/g)
    ) {
      const relativePath = path.relative(rootDir, file);
      warn(`Possible anti-pattern (direct .on() in useEffect): ${relativePath}`);
      foundAntiPatterns = true;
    }
  });
});

if (!foundAntiPatterns) {
  pass('No obvious anti-patterns detected in scanned directories');
}

// ==============================================================================
// CHECK 6: Documentation Files
// ==============================================================================
section('6. Documentation');

const docs = [
  'dev-docs/tasks/phase-0-foundation-stabalisation/TASK-009-verification-checklist/README.md',
  'dev-docs/tasks/phase-0-foundation-stabalisation/TASK-010-eventlistener-verification/README.md',
  'dev-docs/tasks/phase-0-foundation-stabalisation/TASK-011-react-event-pattern-guide/GOLDEN-PATTERN.md'
];

docs.forEach((doc) => {
  const docPath = path.join(rootDir, doc);
  if (fs.existsSync(docPath) && fs.statSync(docPath).size > 0) {
    pass(`${path.basename(doc)} exists`);
  } else {
    warn(`${doc} missing or empty`);
  }
});

// Check if .clinerules has EventListener section
const clinerulesPath = path.join(rootDir, '.clinerules');
if (fs.existsSync(clinerulesPath)) {
  const clinerules = fs.readFileSync(clinerulesPath, 'utf8');
  if (clinerules.includes('React + EventDispatcher') || clinerules.includes('useEventListener')) {
    pass('.clinerules contains EventListener documentation');
  } else {
    warn('.clinerules missing EventListener section');
  }
}

// ==============================================================================
// SUMMARY
// ==============================================================================
section('Health Check Summary');

console.log(`✅ Passed:   ${checks.passed}`);
console.log(`⚠️  Warnings: ${checks.warnings}`);
console.log(`❌ Failed:   ${checks.failed}\n`);

if (checks.failed > 0) {
  console.log('❌ HEALTH CHECK FAILED');
  console.log('Some critical Phase 0 fixes are missing or incorrect.');
  console.log('Please review the failed checks above.\n');
} else if (checks.warnings > 0) {
  console.log('⚠️  HEALTH CHECK PASSED WITH WARNINGS');
  console.log('Foundation is stable but some improvements recommended.');
  console.log('Review warnings above for details.\n');
} else {
  console.log('✅ HEALTH CHECK PASSED');
  console.log('Phase 0 Foundation is healthy!\n');
}

process.exit(exitCode);

// ==============================================================================
// Helpers
// ==============================================================================

function getAllTsxFiles(dir) {
  let results = [];

  try {
    const list = fs.readdirSync(dir);

    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat && stat.isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules') {
          results = results.concat(getAllTsxFiles(filePath));
        }
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(filePath);
      }
    });
  } catch (err) {
    // Skip directories that can't be read
  }

  return results;
}
