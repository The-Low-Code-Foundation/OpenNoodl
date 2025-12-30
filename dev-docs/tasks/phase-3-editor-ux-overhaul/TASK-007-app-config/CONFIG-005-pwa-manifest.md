# CONFIG-005: PWA Manifest Generation

## Overview

Generate a valid `manifest.json` file and auto-scale app icons from a single source image for Progressive Web App support.

**Estimated effort:** 10-14 hours  
**Dependencies:** CONFIG-001, CONFIG-002  
**Blocks:** None (enables Phase 5 Capacitor integration)

---

## Objectives

1. Generate `manifest.json` from app config
2. Auto-scale icons from single 512x512 source
3. Copy icons to build output
4. Validate PWA requirements
5. Generate service worker stub (optional)

---

## Generated manifest.json

```json
{
  "name": "My Amazing App",
  "short_name": "My App",
  "description": "A visual programming app that makes building easy",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#d21f3c",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## Files to Create

### 1. Manifest Generator

**File:** `packages/noodl-editor/src/editor/src/utils/compilation/build/processors/manifest-processor.ts`

```typescript
import * as path from 'path';
import * as fs from 'fs-extra';
import { ProjectModel } from '@noodl-models/projectmodel';
import { AppConfig } from '@noodl/runtime/src/config/types';

// Standard PWA icon sizes
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

export interface ManifestProcessorOptions {
  baseUrl?: string;
  outputDir: string;
}

export class ManifestProcessor {
  constructor(public readonly project: ProjectModel) {}
  
  public async process(options: ManifestProcessorOptions): Promise<void> {
    const config = this.project.getAppConfig();
    
    // Only generate if PWA is enabled
    if (!config.pwa?.enabled) {
      return;
    }
    
    const baseUrl = options.baseUrl || '/';
    
    // Generate icons from source
    await this.generateIcons(config, options.outputDir, baseUrl);
    
    // Generate manifest.json
    const manifest = this.generateManifest(config, baseUrl);
    const manifestPath = path.join(options.outputDir, 'manifest.json');
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
  }
  
  private generateManifest(config: AppConfig, baseUrl: string): object {
    const manifest: Record<string, any> = {
      name: config.identity.appName,
      short_name: config.pwa?.shortName || config.identity.appName,
      description: config.identity.description || '',
      start_url: config.pwa?.startUrl || '/',
      display: config.pwa?.display || 'standalone',
      background_color: config.pwa?.backgroundColor || '#ffffff',
      theme_color: config.seo.themeColor || '#000000',
      icons: this.generateIconsManifest(baseUrl)
    };
    
    // Optional fields
    if (config.identity.description) {
      manifest.description = config.identity.description;
    }
    
    return manifest;
  }
  
  private generateIconsManifest(baseUrl: string): object[] {
    return ICON_SIZES.map(size => ({
      src: `${baseUrl}icons/icon-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png'
    }));
  }
  
  private async generateIcons(
    config: AppConfig, 
    outputDir: string,
    baseUrl: string
  ): Promise<void> {
    const sourceIcon = config.pwa?.sourceIcon;
    
    if (!sourceIcon) {
      console.warn('PWA enabled but no source icon provided. Using placeholder.');
      await this.generatePlaceholderIcons(outputDir);
      return;
    }
    
    // Resolve source icon path
    const sourcePath = this.resolveAssetPath(sourceIcon);
    
    if (!await fs.pathExists(sourcePath)) {
      console.warn(`Source icon not found: ${sourcePath}. Using placeholder.`);
      await this.generatePlaceholderIcons(outputDir);
      return;
    }
    
    // Ensure icons directory exists
    const iconsDir = path.join(outputDir, 'icons');
    await fs.ensureDir(iconsDir);
    
    // Generate each size
    for (const size of ICON_SIZES) {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
      await this.resizeIcon(sourcePath, outputPath, size);
    }
  }
  
  private async resizeIcon(
    sourcePath: string, 
    outputPath: string, 
    size: number
  ): Promise<void> {
    // Use sharp for image resizing
    const sharp = require('sharp');
    
    try {
      await sharp(sourcePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
    } catch (error) {
      console.error(`Failed to resize icon to ${size}x${size}:`, error);
      throw error;
    }
  }
  
  private async generatePlaceholderIcons(outputDir: string): Promise<void> {
    const iconsDir = path.join(outputDir, 'icons');
    await fs.ensureDir(iconsDir);
    
    // Generate simple colored placeholder icons
    const sharp = require('sharp');
    
    for (const size of ICON_SIZES) {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
      
      // Create a simple colored square as placeholder
      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 100, g: 100, b: 100, alpha: 1 }
        }
      })
      .png()
      .toFile(outputPath);
    }
  }
  
  private resolveAssetPath(assetPath: string): string {
    if (path.isAbsolute(assetPath)) {
      return assetPath;
    }
    return path.join(this.project._retainedProjectDirectory, assetPath);
  }
}
```

### 2. Icon Validation

**File:** `packages/noodl-editor/src/editor/src/views/panels/AppSetupPanel/utils/icon-validation.ts`

```typescript
export interface IconValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  dimensions?: { width: number; height: number };
}

export async function validatePWAIcon(filePath: string): Promise<IconValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const sharp = require('sharp');
    const metadata = await sharp(filePath).metadata();
    
    const { width, height, format } = metadata;
    
    // Check format
    if (format !== 'png') {
      errors.push('Icon must be a PNG file');
    }
    
    // Check dimensions
    if (!width || !height) {
      errors.push('Could not read image dimensions');
    } else {
      // Check if square
      if (width !== height) {
        errors.push(`Icon must be square. Current: ${width}x${height}`);
      }
      
      // Check minimum size
      if (width < 512 || height < 512) {
        errors.push(`Icon must be at least 512x512 pixels. Current: ${width}x${height}`);
      }
      
      // Warn if not exactly 512x512
      if (width !== 512 && width > 512) {
        warnings.push(`Icon will be scaled down from ${width}x${height} to required sizes`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      dimensions: width && height ? { width, height } : undefined
    };
    
  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to read image: ${error.message}`],
      warnings: []
    };
  }
}
```

### 3. Service Worker Stub (Optional)

**File:** `packages/noodl-editor/src/editor/src/utils/compilation/build/templates/sw.js`

```javascript
// Basic service worker for PWA install prompt
// This is a minimal stub - users can replace with their own

const CACHE_NAME = 'app-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html'
];

// Install event - cache basic assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});
```

---

## Files to Modify

### 1. Build Pipeline

**File:** `packages/noodl-editor/src/editor/src/utils/compilation/build/build.ts` (or equivalent)

Add manifest processing to build pipeline:

```typescript
import { ManifestProcessor } from './processors/manifest-processor';

async function buildProject(project: ProjectModel, options: BuildOptions): Promise<void> {
  // ... existing build steps ...
  
  // Generate PWA manifest and icons
  const manifestProcessor = new ManifestProcessor(project);
  await manifestProcessor.process({
    baseUrl: options.baseUrl,
    outputDir: options.outputDir
  });
  
  // ... rest of build ...
}
```

### 2. Deploy Build

Ensure the deploy process also runs manifest generation:

**File:** `packages/noodl-editor/src/editor/src/utils/compilation/deploy/`

```typescript
// Include manifest generation in deploy build
await manifestProcessor.process({
  baseUrl: deployConfig.baseUrl || '/',
  outputDir: deployOutputDir
});
```

---

## Icon Size Reference

| Size | Usage |
|------|-------|
| 72x72 | Android home screen (legacy) |
| 96x96 | Android home screen |
| 128x128 | Chrome Web Store |
| 144x144 | IE/Edge pinned sites |
| 152x152 | iPad home screen |
| 192x192 | Android home screen (modern), Chrome install |
| 384x384 | Android splash screen |
| 512x512 | Android splash screen, PWA install prompt |

---

## Testing Checklist

### Manifest Generation

- [ ] manifest.json created when PWA enabled
- [ ] manifest.json not created when PWA disabled
- [ ] name field matches appName
- [ ] short_name matches config or falls back to name
- [ ] description present if configured
- [ ] start_url correct
- [ ] display mode correct
- [ ] background_color correct
- [ ] theme_color correct
- [ ] icons array has all 8 sizes

### Icon Generation

- [ ] All 8 icon sizes generated
- [ ] Icons are valid PNG files
- [ ] Icons maintain aspect ratio
- [ ] Icons have correct dimensions
- [ ] Placeholder icons generated when no source
- [ ] Warning shown when source icon missing
- [ ] Error shown for invalid source format

### Validation

- [ ] Non-square icons rejected
- [ ] Non-PNG icons rejected
- [ ] Too-small icons rejected
- [ ] Valid icons pass validation
- [ ] Warnings for oversized icons

### Integration

- [ ] manifest.json linked in HTML head
- [ ] Icons accessible at correct paths
- [ ] PWA install prompt appears in Chrome
- [ ] App installs correctly
- [ ] Installed app shows correct icon
- [ ] Splash screen displays correctly

---

## Notes for Implementer

### Sharp Dependency

The `sharp` library is required for image processing. It should already be available in the editor dependencies. If not:

```bash
npm install sharp --save
```

### Service Worker Considerations

The basic service worker stub is intentionally minimal. Advanced features like:
- Offline caching strategies
- Push notifications
- Background sync

...should be implemented by users through custom code or future Noodl features.

### Capacitor Integration (Phase 5)

The icon generation logic will be reused for Capacitor builds:
- iOS requires specific sizes: 1024, 180, 167, 152, 120, 76, 60, 40, 29, 20
- Android uses adaptive icons with foreground/background layers

Consider making icon generation configurable for different target platforms.

### Testing PWA Installation

Test PWA installation on:
- Chrome (desktop and mobile)
- Edge (desktop)
- Safari (iOS - via Add to Home Screen)
- Firefox (Android)

Use Chrome DevTools > Application > Manifest to verify manifest is valid.
