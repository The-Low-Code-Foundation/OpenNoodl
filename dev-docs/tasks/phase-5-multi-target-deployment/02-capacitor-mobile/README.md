# Capacitor Mobile Target

**Phase ID:** PHASE-B  
**Priority:** 🔴 High (Primary Target)  
**Estimated Duration:** 4-5 weeks  
**Status:** Planning  
**Dependencies:** Phase A (BYOB Backend), Phase E (Target System Core)  
**Last Updated:** 2025-12-28

## Executive Summary

Enable Noodl users to build native iOS and Android applications using Capacitor as the bridge between web technologies and native device capabilities. This is the highest-priority target due to massive user demand for mobile app development without native code knowledge.

## Value Proposition

| Current State | With Capacitor Target |
|--------------|----------------------|
| Export static web, manually wrap in Capacitor | One-click Capacitor project export |
| No mobile preview | Hot-reload preview on device/simulator |
| No native API access | Camera, GPS, Push, Haptics nodes |
| Manual bridge setup | Automatic Capacitor bridge injection |
| 30-60s iteration cycles | 1-2s hot-reload cycles |

## Technical Architecture

### How Capacitor Works

Capacitor is a cross-platform native runtime that allows web apps to run natively on iOS and Android with access to native device features through JavaScript bridges.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CAPACITOR ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    YOUR NOODL APP                            │   │
│  │  (HTML, CSS, JavaScript - same as web export)               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  CAPACITOR BRIDGE                            │   │
│  │  window.Capacitor.Plugins.Camera.getPhoto()                 │   │
│  │  window.Capacitor.Plugins.Geolocation.getCurrentPosition()  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│              ┌───────────────┼───────────────┐                     │
│              ▼               ▼               ▼                     │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐      │
│  │   iOS Native    │ │ Android Native  │ │   Web Fallback  │      │
│  │  Swift/ObjC     │ │  Kotlin/Java    │ │  (PWA APIs)     │      │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Integration with Noodl

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NOODL EDITOR                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    VISUAL GRAPH                              │   │
│  │  [Button] ──onClick──▶ [Camera Capture] ──photo──▶ [Image]  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                CAPACITOR NODE LIBRARY                        │   │
│  │  Camera, Geolocation, Push, Haptics, StatusBar, etc.        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│          ┌───────────────────┼───────────────────┐                 │
│          ▼                   ▼                   ▼                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│  │   PREVIEW   │     │   EXPORT    │     │   PREVIEW   │          │
│  │   (Web)     │     │ (Capacitor) │     │  (Device)   │          │
│  │             │     │             │     │             │          │
│  │ Mock APIs   │     │ Real build  │     │ Hot-reload  │          │
│  │ in browser  │     │ to Xcode/   │     │ on physical │          │
│  │             │     │ Android     │     │ device      │          │
│  └─────────────┘     └─────────────┘     └─────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Preview Modes

### 1. Web Preview (Default)

Standard browser preview with mocked Capacitor APIs:

```typescript
// When in web preview mode, inject mock Capacitor
if (!window.Capacitor) {
  window.Capacitor = {
    isNativePlatform: () => false,
    Plugins: {
      Camera: {
        async getPhoto(options: CameraOptions): Promise<Photo> {
          // Use browser MediaDevices API
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          // ... capture and return photo
        }
      },
      Geolocation: {
        async getCurrentPosition(): Promise<Position> {
          // Use browser Geolocation API
          return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({
                coords: {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                }
              }),
              reject
            );
          });
        }
      },
      // ... other mocked plugins
    }
  };
}
```

**Limitations:**
- Push notifications won't work (no registration token)
- Some device-specific features unavailable
- Camera quality may differ from native

### 2. Capacitor Hot-Reload Preview

Connect physical device or simulator to Noodl's dev server:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Preview Mode: [Web ▾]                                               │
│               ├─ Web (Browser)                                      │
│               ├─ iOS Simulator ◀                                    │
│               ├─ Android Emulator                                   │
│               └─ Physical Device                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ⚠️ Capacitor Preview Setup Required                                │
│                                                                     │
│  To preview on iOS Simulator:                                       │
│                                                                     │
│  1. Install Xcode from the Mac App Store                           │
│  2. Open Terminal and run:                                         │
│     ┌─────────────────────────────────────────────────────────┐    │
│     │ npx cap run ios --livereload-url=http://localhost:8574 │    │
│     └─────────────────────────────────────────────────────────┘    │
│  3. Select a simulator when prompted                               │
│                                                                     │
│  [Generate Capacitor Project]  [Copy Command]  [Open Documentation] │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**How Hot-Reload Works:**

```
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│  Noodl Editor │◄───────▶│  Dev Server   │◄───────▶│  iOS/Android  │
│               │ WebSocket│ localhost:8574│   HTTP  │  App in       │
│  Make changes │─────────▶│  Serves app   │─────────▶  WebView      │
│               │         │  + Capacitor  │         │               │
└───────────────┘         │  bridge       │         │  Native APIs  │
                          └───────────────┘         │  available    │
                                                    └───────────────┘
```

1. Noodl's dev server already serves the preview app at `localhost:8574`
2. Capacitor app's WebView loads from this URL instead of bundled assets
3. When you make changes in Noodl, the WebView automatically refreshes
4. Native Capacitor plugins are available because you're running in a native app

### 3. Device Preview (Physical Device)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Preview on Device                                              [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CONNECTED DEVICES                                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📱 Richard's iPhone 15 Pro                    ✓ Connected   │   │
│  │    iOS 17.2  •  USB Connected                               │   │
│  │                                                [Open App]   │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ 📱 Pixel 8                                    ✓ Connected   │   │
│  │    Android 14  •  WiFi (192.168.1.42)                      │   │
│  │                                                [Open App]   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  NETWORK PREVIEW (WiFi)                                            │
│  Devices on the same network can connect to:                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ http://192.168.1.100:8574                           [Copy]  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│              ┌─────────────────┐                                   │
│              │ ▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄│                                   │
│              │ █     █ █     █│  Scan with                        │
│              │ █ ███ █ █ ███ █│  Noodl Preview App                │
│              │ █     █ █     █│                                   │
│              │ ▀▀▀▀▀▀▀ ▀▀▀▀▀▀▀│                                   │
│              └─────────────────┘                                   │
│                                                                     │
│  [Download iOS Preview App]  [Download Android Preview App]         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Capacitor-Specific Nodes

### Core Plugin Nodes

#### Camera Node

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📷 Camera Capture                                    [📱] [🖥️]     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ INPUTS                                                              │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Capture                    ○────  (Signal - triggers capture)      │
│                                                                     │
│ Source:                    [Camera ▾]                               │
│                            ├─ Camera                                │
│                            ├─ Photos Library                        │
│                            └─ Prompt User                           │
│                                                                     │
│ Quality:                   [High ▾]                                 │
│                            ├─ Low (faster, smaller)                 │
│                            ├─ Medium                                │
│                            └─ High (best quality)                   │
│                                                                     │
│ Result Type:               [Base64 ▾]                               │
│                            ├─ Base64 (data URL)                     │
│                            ├─ URI (file path)                       │
│                            └─ Blob                                  │
│                                                                     │
│ Direction:                 [Rear ▾]                                 │
│ Correct Orientation:       [✓]                                      │
│ Allow Editing:             [✓]                                      │
│ Width:                     [1024    ] (0 = original)                │
│ Height:                    [0       ] (0 = original)                │
│                                                                     │
│ OUTPUTS                                                             │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Photo                      ────○  (String - base64/URI)             │
│ Format                     ────○  (String - "jpeg"/"png"/"gif")     │
│ Captured                   ────○  (Signal - on success)             │
│ Failed                     ────○  (Signal - on error)               │
│ Error                      ────○  (String - error message)          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// packages/noodl-runtime/src/nodes/capacitor/CameraNode.ts

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { createNodeDefinition } from '../../nodeDefinition';

export const CameraNode = createNodeDefinition({
  name: 'Camera Capture',
  category: 'Device & Platform',
  color: 'purple',
  
  inputs: {
    capture: { type: 'signal', displayName: 'Capture' },
    source: {
      type: 'enum',
      displayName: 'Source',
      default: 'camera',
      enums: [
        { value: 'camera', label: 'Camera' },
        { value: 'photos', label: 'Photos Library' },
        { value: 'prompt', label: 'Prompt User' },
      ],
    },
    quality: {
      type: 'number',
      displayName: 'Quality',
      default: 90,
      min: 1,
      max: 100,
    },
    resultType: {
      type: 'enum',
      displayName: 'Result Type',
      default: 'base64',
      enums: [
        { value: 'base64', label: 'Base64' },
        { value: 'uri', label: 'URI' },
      ],
    },
    direction: {
      type: 'enum',
      displayName: 'Direction',
      default: 'rear',
      enums: [
        { value: 'rear', label: 'Rear' },
        { value: 'front', label: 'Front' },
      ],
    },
    allowEditing: { type: 'boolean', displayName: 'Allow Editing', default: false },
    width: { type: 'number', displayName: 'Width', default: 0 },
    height: { type: 'number', displayName: 'Height', default: 0 },
  },
  
  outputs: {
    photo: { type: 'string', displayName: 'Photo' },
    format: { type: 'string', displayName: 'Format' },
    captured: { type: 'signal', displayName: 'Captured' },
    failed: { type: 'signal', displayName: 'Failed' },
    error: { type: 'string', displayName: 'Error' },
  },
  
  targetCompatibility: ['capacitor', 'electron', 'web'],
  
  async execute(inputs, outputs, context) {
    try {
      const sourceMap = {
        camera: CameraSource.Camera,
        photos: CameraSource.Photos,
        prompt: CameraSource.Prompt,
      };
      
      const resultTypeMap = {
        base64: CameraResultType.Base64,
        uri: CameraResultType.Uri,
      };
      
      const photo = await Camera.getPhoto({
        source: sourceMap[inputs.source],
        resultType: resultTypeMap[inputs.resultType],
        quality: inputs.quality,
        allowEditing: inputs.allowEditing,
        width: inputs.width || undefined,
        height: inputs.height || undefined,
        direction: inputs.direction === 'front' ? 'FRONT' : 'REAR',
      });
      
      if (inputs.resultType === 'base64') {
        outputs.photo = `data:image/${photo.format};base64,${photo.base64String}`;
      } else {
        outputs.photo = photo.webPath;
      }
      
      outputs.format = photo.format;
      outputs.captured.trigger();
      
    } catch (err) {
      outputs.error = err.message;
      outputs.failed.trigger();
    }
  },
});
```

#### Geolocation Node

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📍 Geolocation                               [🌐] [📱] [🖥️] [🧩]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ INPUTS                                                              │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Get Position              ○────  (Signal)                          │
│ Watch Position            ○────  (Signal - start watching)         │
│ Stop Watching             ○────  (Signal)                          │
│                                                                     │
│ High Accuracy:            [✓]   (uses GPS, slower, more battery)   │
│ Timeout (ms):             [10000]                                   │
│ Maximum Age (ms):         [0    ] (0 = always fresh)               │
│                                                                     │
│ OUTPUTS                                                             │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Latitude                  ────○  (Number)                           │
│ Longitude                 ────○  (Number)                           │
│ Accuracy                  ────○  (Number - meters)                  │
│ Altitude                  ────○  (Number - meters, may be null)     │
│ Speed                     ────○  (Number - m/s, may be null)        │
│ Heading                   ────○  (Number - degrees, may be null)    │
│ Timestamp                 ────○  (Date)                             │
│                                                                     │
│ Position Updated          ────○  (Signal)                           │
│ Error                     ────○  (Signal)                           │
│ Error Message             ────○  (String)                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Push Notifications Node

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔔 Push Notifications                                      [📱]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ INPUTS                                                              │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Register                  ○────  (Signal - request permission)     │
│                                                                     │
│ OUTPUTS                                                             │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Token                     ────○  (String - device token)            │
│ Registered                ────○  (Signal)                           │
│ Registration Failed       ────○  (Signal)                           │
│                                                                     │
│ Notification Received     ────○  (Signal)                           │
│ Notification Title        ────○  (String)                           │
│ Notification Body         ────○  (String)                           │
│ Notification Data         ────○  (Object - custom payload)          │
│ Notification Action       ────○  (String - action ID if tapped)     │
│                                                                     │
│ Notification Tapped       ────○  (Signal - user tapped notif)       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Additional Capacitor Nodes

| Node | Category | Description |
|------|----------|-------------|
| **Haptics** | Device | Trigger haptic feedback (impact, notification, selection) |
| **Status Bar** | UI | Control status bar appearance (style, color, visibility) |
| **Keyboard** | UI | Show/hide keyboard, get keyboard height |
| **Share** | Social | Native share sheet for content |
| **App Launcher** | System | Open other apps, URLs, settings |
| **Device Info** | System | Get device model, OS version, battery, etc. |
| **Network** | System | Get connection type, monitor connectivity |
| **Splash Screen** | UI | Control splash screen (hide, show) |
| **Local Notifications** | Notifications | Schedule local notifications |
| **Biometric Auth** | Security | Face ID, Touch ID, fingerprint auth |
| **Clipboard** | Utility | Read/write clipboard |
| **Browser** | Navigation | Open in-app browser |
| **App State** | Lifecycle | Monitor foreground/background state |

## Project Export

### Export Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Export for Mobile                                              [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ PLATFORM                                                            │
│ ┌───────────────────────────────┐ ┌───────────────────────────────┐ │
│ │         [Apple Logo]          │ │       [Android Logo]          │ │
│ │                               │ │                               │ │
│ │           iOS                 │ │          Android              │ │
│ │           ✓ Selected          │ │          ☐                    │ │
│ └───────────────────────────────┘ └───────────────────────────────┘ │
│                                                                     │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ APP CONFIGURATION                                                   │
│                                                                     │
│ App ID:                                                             │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ com.mycompany.myapp                                             │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ⓘ Must match your App Store / Play Store app ID                    │
│                                                                     │
│ App Name:                                                           │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ My Awesome App                                                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Version:                    Build Number:                           │
│ ┌─────────────────────────┐ ┌─────────────────────────┐            │
│ │ 1.0.0                   │ │ 1                       │            │
│ └─────────────────────────┘ └─────────────────────────┘            │
│                                                                     │
│ ▶ iOS Settings                                                      │
│   Team ID:                  [ABC123DEF4  ]                         │
│   Deployment Target:        [iOS 14.0 ▾]                           │
│                                                                     │
│ ▶ Plugins                                                           │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │ ☑ @capacitor/camera           (Used by: Camera Capture)    │  │
│   │ ☑ @capacitor/geolocation      (Used by: Geolocation)       │  │
│   │ ☑ @capacitor/push-notifications (Used by: Push Notif...)   │  │
│   │ ☐ @capacitor/haptics          (Not used)                   │  │
│   │ ☐ @capacitor/share            (Not used)                   │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│ ▶ Permissions (auto-detected from node usage)                       │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │ 📷 Camera Access                                            │  │
│   │    "This app needs camera access to take photos"            │  │
│   │                                                             │  │
│   │ 📍 Location When In Use                                     │  │
│   │    "This app needs your location to show nearby places"     │  │
│   │                                                             │  │
│   │ 🔔 Push Notifications                                       │  │
│   │    (Configured in Apple Developer Portal)                   │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ OUTPUT                                                              │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ○ Generate Xcode/Android Studio Project                        │ │
│ │   Full native project ready for building and customization     │ │
│ │                                                                 │ │
│ │ ● Generate Build-Ready Package                     RECOMMENDED │ │
│ │   Minimal project, just run `npx cap build`                    │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│                                    [Cancel]  [Export for iOS]       │
└─────────────────────────────────────────────────────────────────────┘
```

### Generated Project Structure

```
my-app-capacitor/
├── package.json                 # Node.js package with Capacitor deps
├── capacitor.config.ts          # Capacitor configuration
├── www/                         # Built Noodl app (web assets)
│   ├── index.html
│   ├── main.js
│   ├── styles.css
│   └── assets/
├── ios/                         # iOS Xcode project
│   ├── App/
│   │   ├── App.xcodeproj
│   │   ├── App/
│   │   │   ├── AppDelegate.swift
│   │   │   ├── Info.plist       # Permissions, app config
│   │   │   └── Assets.xcassets  # App icons
│   │   └── Podfile              # iOS dependencies
│   └── Pods/
├── android/                     # Android Studio project
│   ├── app/
│   │   ├── build.gradle
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/.../MainActivity.java
│   │   │   └── res/             # Icons, splash screens
│   └── gradle/
└── README.md                    # Build instructions
```

### capacitor.config.ts

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mycompany.myapp',
  appName: 'My Awesome App',
  webDir: 'www',
  
  // Development: connect to Noodl dev server
  server: process.env.NODE_ENV === 'development' ? {
    url: 'http://localhost:8574',
    cleartext: true,
  } : undefined,
  
  plugins: {
    Camera: {
      // iOS requires these privacy descriptions
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  
  ios: {
    // iOS-specific configuration
  },
  
  android: {
    // Android-specific configuration
  },
};

export default config;
```

## Implementation Phases

### Phase B.1: Capacitor Bridge Integration (1 week)

**Goal:** Enable Noodl preview to run inside Capacitor WebView with hot-reload.

**Tasks:**
- [ ] Detect when running in Capacitor context (`window.Capacitor.isNativePlatform()`)
- [ ] Inject Capacitor bridge scripts in preview HTML
- [ ] Configure dev server for external access (CORS, network binding)
- [ ] Create "Capacitor Preview Mode" toggle in editor
- [ ] Document Xcode/Android Studio setup for live-reload

**Files to Create/Modify:**
```
packages/noodl-editor/src/frames/viewer-frame/src/views/
├── viewer.js                    # Modify: Add Capacitor bridge injection
└── capacitorBridge.js           # New: Capacitor-specific preview logic

packages/noodl-editor/src/editor/src/views/EditorTopbar/
└── PreviewModeSelector.tsx      # New: Preview mode dropdown component
```

### Phase B.2: Core Capacitor Nodes (2 weeks)

**Goal:** Implement essential device capability nodes.

**Week 1: High-priority nodes**
- [ ] Camera Capture node
- [ ] Geolocation node
- [ ] Push Notifications node
- [ ] Haptics node

**Week 2: Secondary nodes**
- [ ] Share node
- [ ] Status Bar node
- [ ] Device Info node
- [ ] Network Status node
- [ ] App State node

**Files to Create:**
```
packages/noodl-runtime/src/nodes/capacitor/
├── index.ts                     # Export all Capacitor nodes
├── CameraNode.ts
├── GeolocationNode.ts
├── PushNotificationsNode.ts
├── HapticsNode.ts
├── ShareNode.ts
├── StatusBarNode.ts
├── DeviceInfoNode.ts
├── NetworkNode.ts
├── AppStateNode.ts
└── _mocks/                      # Web fallback implementations
    ├── cameraMock.ts
    ├── geolocationMock.ts
    └── ...
```

### Phase B.3: Simulator/Device Launch (1 week)

**Goal:** One-click launch to iOS Simulator or Android Emulator.

**Tasks:**
- [ ] Detect installed simulators (`xcrun simctl list`)
- [ ] Detect installed Android emulators (`emulator -list-avds`)
- [ ] Create simulator selection UI
- [ ] Implement launch command execution
- [ ] Display QR code for physical device connection

**Files to Create:**
```
packages/noodl-editor/src/editor/src/views/panels/
└── CapacitorPreview/
    ├── SimulatorList.tsx
    ├── DeviceConnection.tsx
    └── QRCodeModal.tsx
```

### Phase B.4: Export Pipeline (1 week)

**Goal:** Generate production-ready Capacitor project.

**Tasks:**
- [ ] Build web assets to `www/` folder
- [ ] Generate `capacitor.config.ts`
- [ ] Generate `package.json` with correct dependencies
- [ ] Auto-detect required plugins from node usage
- [ ] Generate platform-specific permission strings
- [ ] Create iOS Xcode project scaffolding
- [ ] Create Android Studio project scaffolding
- [ ] Generate README with build instructions

**Files to Create:**
```
packages/noodl-editor/src/editor/src/export/
├── capacitor/
│   ├── CapacitorExporter.ts     # Main export orchestrator
│   ├── configGenerator.ts        # Generate capacitor.config.ts
│   ├── packageGenerator.ts       # Generate package.json
│   ├── pluginDetector.ts         # Detect required plugins from graph
│   ├── permissionGenerator.ts    # Generate iOS Info.plist entries
│   ├── iosProjectGenerator.ts    # Scaffold iOS project
│   └── androidProjectGenerator.ts # Scaffold Android project
└── templates/
    └── capacitor/
        ├── package.json.template
        ├── capacitor.config.ts.template
        └── ios/
            └── Info.plist.template
```

## Web Fallback Behavior

When Capacitor nodes are used in web preview or web deployment:

| Node | Web Fallback Behavior |
|------|----------------------|
| **Camera** | Uses `navigator.mediaDevices.getUserMedia()` |
| **Geolocation** | Uses `navigator.geolocation` |
| **Push Notifications** | Shows warning, suggests Web Push API setup |
| **Haptics** | Uses `navigator.vibrate()` (limited support) |
| **Share** | Uses Web Share API (Chrome, Safari) |
| **Status Bar** | No-op (not applicable to web) |
| **Device Info** | Returns `navigator.userAgent` parsed info |
| **Network** | Uses `navigator.connection` |

```typescript
// Example: Camera fallback implementation
async function capturePhotoWeb(options: CameraOptions): Promise<Photo> {
  // Check if we're in a native Capacitor context
  if (window.Capacitor?.isNativePlatform()) {
    return Camera.getPhoto(options);
  }
  
  // Web fallback using MediaDevices API
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: options.direction === 'front' ? 'user' : 'environment',
      width: options.width || undefined,
      height: options.height || undefined,
    }
  });
  
  // Create video element to capture frame
  const video = document.createElement('video');
  video.srcObject = stream;
  await video.play();
  
  // Draw frame to canvas
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0);
  
  // Stop stream
  stream.getTracks().forEach(track => track.stop());
  
  // Convert to base64
  const dataUrl = canvas.toDataURL('image/jpeg', options.quality / 100);
  
  return {
    base64String: dataUrl.split(',')[1],
    format: 'jpeg',
    webPath: dataUrl,
  };
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('CameraNode', () => {
  describe('web fallback', () => {
    it('should use MediaDevices API when not in native context', async () => {
      const mockGetUserMedia = jest.fn().mockResolvedValue(mockStream);
      navigator.mediaDevices.getUserMedia = mockGetUserMedia;
      
      const node = new CameraNode();
      node.setInput('source', 'camera');
      await node.executeCapture();
      
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: expect.any(Object),
      });
    });
  });
  
  describe('native context', () => {
    beforeEach(() => {
      window.Capacitor = { isNativePlatform: () => true };
    });
    
    it('should use Capacitor Camera plugin', async () => {
      const mockGetPhoto = jest.fn().mockResolvedValue(mockPhoto);
      Camera.getPhoto = mockGetPhoto;
      
      const node = new CameraNode();
      await node.executeCapture();
      
      expect(mockGetPhoto).toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

```typescript
describe('Capacitor Export', () => {
  it('should detect required plugins from node graph', async () => {
    const project = createTestProject([
      { type: 'Camera Capture' },
      { type: 'Geolocation' },
      { type: 'Text' }, // Not a Capacitor node
    ]);
    
    const detector = new PluginDetector(project);
    const plugins = detector.getRequiredPlugins();
    
    expect(plugins).toEqual([
      '@capacitor/camera',
      '@capacitor/geolocation',
    ]);
  });
  
  it('should generate valid capacitor.config.ts', async () => {
    const exporter = new CapacitorExporter(mockProject);
    const config = await exporter.generateConfig();
    
    expect(config).toContain("appId: 'com.test.app'");
    expect(config).toContain("appName: 'Test App'");
  });
});
```

### Manual Testing Checklist

- [ ] Create new Capacitor-target project
- [ ] Add Camera node, verify web fallback works
- [ ] Enable Capacitor preview mode
- [ ] Launch iOS Simulator with live-reload
- [ ] Take photo in simulator, verify it appears in Noodl
- [ ] Export project for iOS
- [ ] Open in Xcode, build successfully
- [ ] Run on physical iPhone, verify all features work

## Success Criteria

| Criteria | Target |
|----------|--------|
| Hot-reload latency | < 2 seconds from save to device update |
| Export time | < 30 seconds for complete Capacitor project |
| Xcode build success | First-time build succeeds without manual fixes |
| Plugin detection accuracy | 100% of used plugins detected automatically |
| Web fallback coverage | All Capacitor nodes have functional web fallbacks |

## Future Enhancements

### Phase B+ Features (Post-MVP)

1. **Capacitor Plugins Marketplace** - Browse and install community plugins
2. **Native UI Components** - Use platform-native UI (iOS UIKit, Android Material)
3. **Background Tasks** - Run code when app is backgrounded
4. **Deep Linking** - Handle custom URL schemes
5. **In-App Purchases** - Integrate with App Store / Play Store purchases
6. **App Store Deployment** - One-click submit to stores (via Fastlane)

### Advanced Native Integration

For users who need more native control:

```typescript
// Custom Capacitor Plugin Node
// Allows calling any Capacitor plugin method

interface CustomPluginNodeInputs {
  pluginName: string;      // e.g., "@capacitor/camera"
  methodName: string;      // e.g., "getPhoto"
  options: object;         // Method parameters
}

// This enables using ANY Capacitor plugin, even community ones
```
