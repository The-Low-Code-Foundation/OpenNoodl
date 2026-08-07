# CONFIG-004: SEO Build Integration

## Overview

Integrate app configuration values into the HTML build process to generate proper SEO meta tags, Open Graph tags, and favicon links.

**Estimated effort:** 8-10 hours  
**Dependencies:** CONFIG-001, CONFIG-002  
**Blocks:** None

---

## Objectives

1. Inject `<title>` tag from appName
2. Inject meta description tag
3. Inject Open Graph tags (og:title, og:description, og:image)
4. Inject Twitter Card tags
5. Inject favicon link
6. Inject theme-color meta tag
7. Support canonical URL (optional)

---

## Generated HTML Structure

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Basic Meta -->
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Amazing App</title>
  <meta name="description" content="A visual programming app that makes building easy">
  
  <!-- Theme Color -->
  <meta name="theme-color" content="#d21f3c">
  
  <!-- Favicon -->
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="My Amazing App">
  <meta property="og:description" content="A visual programming app that makes building easy">
  <meta property="og:image" content="https://example.com/og-image.jpg">
  <meta property="og:url" content="https://example.com">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="My Amazing App">
  <meta name="twitter:description" content="A visual programming app that makes building easy">
  <meta name="twitter:image" content="https://example.com/og-image.jpg">
  
  <!-- PWA Manifest (if enabled) -->
  <link rel="manifest" href="/manifest.json">
  
  {{#customHeadCode#}}
</head>
```

---

## Files to Modify

### 1. HTML Processor

**File:** `packages/noodl-editor/src/editor/src/utils/compilation/build/processors/html-processor.ts`

Extend the existing processor:

```typescript
import { ProjectModel } from '@noodl-models/projectmodel';
import { AppConfig } from '@noodl/runtime/src/config/types';

export interface HtmlProcessorParameters {
  title?: string;
  headCode?: string;
  indexJsPath?: string;
  baseUrl?: string;
  envVariables?: Record<string, string>;
}

export class HtmlProcessor {
  constructor(public readonly project: ProjectModel) {}

  public async process(content: string, parameters: HtmlProcessorParameters): Promise<string> {
    const settings = this.project.getSettings();
    const appConfig = this.project.getAppConfig();
    
    let baseUrl = parameters.baseUrl || settings.baseUrl || '/';
    if (!baseUrl.endsWith('/')) {
      baseUrl = baseUrl + '/';
    }

    // Title from app config, falling back to settings, then default
    const title = parameters.title || appConfig.identity.appName || settings.htmlTitle || 'Noodl App';
    
    // Build head code with SEO tags
    let headCode = this.generateSEOTags(appConfig, baseUrl);
    headCode += settings.headCode || '';
    if (parameters.headCode) {
      headCode += parameters.headCode;
    }

    if (baseUrl !== '/') {
      headCode = `<base href="${baseUrl}" target="_blank" />\n` + headCode;
    }

    // Inject into template
    let injected = await this.injectIntoHtml(content, baseUrl);
    injected = injected.replace('{{#title#}}', this.escapeHtml(title));
    injected = injected.replace('{{#customHeadCode#}}', headCode);
    injected = injected.replace(/%baseUrl%/g, baseUrl);

    // ... rest of existing processing
    
    return injected;
  }
  
  private generateSEOTags(config: AppConfig, baseUrl: string): string {
    const tags: string[] = [];
    
    // Description
    const description = config.seo.ogDescription || config.identity.description;
    if (description) {
      tags.push(`<meta name="description" content="${this.escapeAttr(description)}">`);
    }
    
    // Theme color
    if (config.seo.themeColor) {
      tags.push(`<meta name="theme-color" content="${this.escapeAttr(config.seo.themeColor)}">`);
    }
    
    // Favicon
    if (config.seo.favicon) {
      const faviconPath = this.resolveAssetPath(config.seo.favicon, baseUrl);
      const faviconType = this.getFaviconType(config.seo.favicon);
      tags.push(`<link rel="icon" type="${faviconType}" href="${faviconPath}">`);
      
      // Apple touch icon (use og:image or favicon)
      const touchIcon = config.seo.ogImage || config.identity.coverImage || config.seo.favicon;
      if (touchIcon) {
        tags.push(`<link rel="apple-touch-icon" href="${this.resolveAssetPath(touchIcon, baseUrl)}">`);
      }
    }
    
    // Open Graph
    tags.push(...this.generateOpenGraphTags(config, baseUrl));
    
    // Twitter Card
    tags.push(...this.generateTwitterTags(config, baseUrl));
    
    // PWA Manifest
    if (config.pwa?.enabled) {
      tags.push(`<link rel="manifest" href="${baseUrl}manifest.json">`);
    }
    
    return tags.join('\n  ') + '\n';
  }
  
  private generateOpenGraphTags(config: AppConfig, baseUrl: string): string[] {
    const tags: string[] = [];
    
    tags.push(`<meta property="og:type" content="website">`);
    
    const ogTitle = config.seo.ogTitle || config.identity.appName;
    if (ogTitle) {
      tags.push(`<meta property="og:title" content="${this.escapeAttr(ogTitle)}">`);
    }
    
    const ogDescription = config.seo.ogDescription || config.identity.description;
    if (ogDescription) {
      tags.push(`<meta property="og:description" content="${this.escapeAttr(ogDescription)}">`);
    }
    
    const ogImage = config.seo.ogImage || config.identity.coverImage;
    if (ogImage) {
      // OG image should be absolute URL
      const imagePath = this.resolveAssetPath(ogImage, baseUrl);
      tags.push(`<meta property="og:image" content="${imagePath}">`);
    }
    
    // og:url would need the deployment URL - could be added via env variable
    // tags.push(`<meta property="og:url" content="${deployUrl}">`);
    
    return tags;
  }
  
  private generateTwitterTags(config: AppConfig, baseUrl: string): string[] {
    const tags: string[] = [];
    
    // Use large image card if we have an image
    const hasImage = config.seo.ogImage || config.identity.coverImage;
    tags.push(`<meta name="twitter:card" content="${hasImage ? 'summary_large_image' : 'summary'}">`);
    
    const title = config.seo.ogTitle || config.identity.appName;
    if (title) {
      tags.push(`<meta name="twitter:title" content="${this.escapeAttr(title)}">`);
    }
    
    const description = config.seo.ogDescription || config.identity.description;
    if (description) {
      tags.push(`<meta name="twitter:description" content="${this.escapeAttr(description)}">`);
    }
    
    if (hasImage) {
      const imagePath = this.resolveAssetPath(
        config.seo.ogImage || config.identity.coverImage!, 
        baseUrl
      );
      tags.push(`<meta name="twitter:image" content="${imagePath}">`);
    }
    
    return tags;
  }
  
  private resolveAssetPath(path: string, baseUrl: string): string {
    if (!path) return '';
    
    // Already absolute URL
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    
    // Relative path - prepend base URL
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return baseUrl + cleanPath;
  }
  
  private getFaviconType(path: string): string {
    if (path.endsWith('.ico')) return 'image/x-icon';
    if (path.endsWith('.png')) return 'image/png';
    if (path.endsWith('.svg')) return 'image/svg+xml';
    return 'image/png';
  }
  
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  
  private escapeAttr(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  
  private injectIntoHtml(template: string, pathPrefix: string) {
    return new Promise<string>((resolve) => {
      ProjectModules.instance.injectIntoHtml(
        this.project._retainedProjectDirectory, 
        template, 
        pathPrefix, 
        resolve
      );
    });
  }
}
```

### 2. Update HTML Template

**File:** `packages/noodl-viewer-react/static/index.html` (or equivalent)

Ensure template has the right placeholders:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{{#title#}}</title>
  {{#customHeadCode#}}
</head>
<body>
  <div id="root"></div>
  <%index_js%>
</body>
</html>
```

---

## Asset Handling

### Image Resolution

Images referenced in config (coverImage, ogImage, favicon) can be:

1. **Project file paths**: `/assets/images/cover.png` - copied to build output
2. **External URLs**: `https://example.com/image.jpg` - used as-is
3. **Uploaded files**: Handled through the existing project file system

**File:** Add to build process in `packages/noodl-editor/src/editor/src/utils/compilation/build/`

```typescript
async function copyConfigAssets(project: ProjectModel, outputDir: string): Promise<void> {
  const config = project.getAppConfig();
  const assets: string[] = [];
  
  // Collect asset paths
  if (config.identity.coverImage && !isExternalUrl(config.identity.coverImage)) {
    assets.push(config.identity.coverImage);
  }
  if (config.seo.ogImage && !isExternalUrl(config.seo.ogImage)) {
    assets.push(config.seo.ogImage);
  }
  if (config.seo.favicon && !isExternalUrl(config.seo.favicon)) {
    assets.push(config.seo.favicon);
  }
  
  // Copy each asset to output
  for (const asset of assets) {
    const sourcePath = path.join(project._retainedProjectDirectory, asset);
    const destPath = path.join(outputDir, asset);
    
    if (await fileExists(sourcePath)) {
      await ensureDir(path.dirname(destPath));
      await copyFile(sourcePath, destPath);
    }
  }
}

function isExternalUrl(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://');
}
```

---

## Testing Checklist

### Build Output Tests

- [ ] Title tag contains app name
- [ ] Meta description present
- [ ] Theme color meta tag present
- [ ] Favicon link correct type and path
- [ ] Apple touch icon link present
- [ ] og:type is "website"
- [ ] og:title matches config
- [ ] og:description matches config
- [ ] og:image URL correct
- [ ] Twitter card type correct
- [ ] Twitter tags mirror OG tags
- [ ] Manifest link present when PWA enabled
- [ ] Manifest link absent when PWA disabled

### Asset Handling Tests

- [ ] Local image paths copied to build
- [ ] External URLs used as-is
- [ ] Missing assets don't break build
- [ ] Paths correct with custom baseUrl

### Edge Cases

- [ ] Empty description doesn't create empty tag
- [ ] Missing favicon doesn't break build
- [ ] Special characters escaped in meta content
- [ ] Very long descriptions truncated appropriately

---

## Notes for Implementer

### OG Image Requirements

Open Graph images have specific requirements:
- Minimum 200x200 pixels
- Recommended 1200x630 pixels
- Maximum 8MB file size

Consider adding validation in the App Setup panel.

### Canonical URL

The canonical URL (`og:url`) requires knowing the deployment URL, which isn't always known at build time. Options:
1. Add a `canonicalUrl` field to app config
2. Inject via environment variable at deploy time
3. Use JavaScript to set dynamically (loses SEO benefit)

### Testing SEO Output

Use tools like:
- https://developers.facebook.com/tools/debug/ (OG tags)
- https://cards-dev.twitter.com/validator (Twitter cards)
- Browser DevTools to inspect head tags
