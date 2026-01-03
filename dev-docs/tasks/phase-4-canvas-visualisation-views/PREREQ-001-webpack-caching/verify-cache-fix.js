#!/usr/bin/env node

/**
 * Webpack Cache Fix Verification Script
 * 
 * Run this after implementing the caching fixes to verify everything is correct.
 * Usage: node verify-cache-fix.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Verifying Webpack Caching Fixes...\n');

let passed = 0;
let failed = 0;

function check(name, condition, fix) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    console.log(`   Fix: ${fix}\n`);
    failed++;
  }
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

// Adjust these paths based on where this script is placed
const basePath = process.cwd();

// Check 1: webpack.renderer.core.js - Babel cache disabled
const corePath = path.join(basePath, 'packages/noodl-editor/webpackconfigs/shared/webpack.renderer.core.js');
const coreContent = readFile(corePath);

if (coreContent) {
  const hasCacheFalse = coreContent.includes('cacheDirectory: false');
  const hasCacheTrue = coreContent.includes('cacheDirectory: true');
  
  check(
    'Babel cacheDirectory disabled in webpack.renderer.core.js',
    hasCacheFalse && !hasCacheTrue,
    'Set cacheDirectory: false in babel-loader options'
  );
} else {
  console.log(`⚠️  Could not find ${corePath}`);
}

// Check 2: webpack.renderer.dev.js - Webpack cache disabled
const devPath = path.join(basePath, 'packages/noodl-editor/webpackconfigs/webpack.renderer.dev.js');
const devContent = readFile(devPath);

if (devContent) {
  const hasCache = devContent.includes('cache: false') || devContent.includes('cache:false');
  
  check(
    'Webpack cache disabled in webpack.renderer.dev.js',
    hasCache,
    'Add "cache: false" to the dev webpack config'
  );
} else {
  console.log(`⚠️  Could not find ${devPath}`);
}

// Check 3: viewer webpack - Babel cache disabled
const viewerPath = path.join(basePath, 'packages/noodl-viewer-react/webpack-configs/webpack.common.js');
const viewerContent = readFile(viewerPath);

if (viewerContent) {
  const hasCacheTrue = viewerContent.includes('cacheDirectory: true');
  
  check(
    'Babel cacheDirectory disabled in viewer webpack.common.js',
    !hasCacheTrue,
    'Set cacheDirectory: false in babel-loader options'
  );
} else {
  console.log(`⚠️  Could not find ${viewerPath} (may be optional)`);
}

// Check 4: clean:all script exists
const packageJsonPath = path.join(basePath, 'package.json');
const packageJson = readFile(packageJsonPath);

if (packageJson) {
  try {
    const pkg = JSON.parse(packageJson);
    check(
      'clean:all script exists in package.json',
      pkg.scripts && pkg.scripts['clean:all'],
      'Add clean:all script to package.json'
    );
  } catch {
    console.log('⚠️  Could not parse package.json');
  }
}

// Check 5: No .cache directories (optional - informational)
console.log('\n📁 Checking for cache directories...');

const cachePaths = [
  'node_modules/.cache',
  'packages/noodl-editor/node_modules/.cache',
  'packages/noodl-viewer-react/node_modules/.cache',
];

cachePaths.forEach(cachePath => {
  const fullPath = path.join(basePath, cachePath);
  if (fs.existsSync(fullPath)) {
    console.log(`   ⚠️  Cache exists: ${cachePath}`);
    console.log(`      Run: rm -rf ${cachePath}`);
  }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

if (failed === 0) {
  console.log('\n🎉 All cache fixes are in place! Hot reloading should work reliably.\n');
} else {
  console.log('\n⚠️  Some fixes are missing. Apply the changes above and run again.\n');
  process.exit(1);
}
