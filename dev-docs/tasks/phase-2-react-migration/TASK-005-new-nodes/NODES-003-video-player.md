# TASK: Video Player Node

**Task ID:** NODES-001  
**Priority:** Medium-High  
**Estimated Effort:** 16-24 hours  
**Prerequisites:** React 18.3+ runtime (completed)  
**Status:** Ready for Implementation

---

## Overview

Create a comprehensive Video Player node that handles video playback from URLs or blobs with rich inputs and outputs for complete video management. This addresses a gap in Noodl's visual node offerings - currently users must resort to Function nodes for anything beyond basic video display.

### Why This Matters

- **Table stakes feature** - Users expect video playback in any modern low-code tool
- **App builder unlock** - Enables video-centric apps (portfolios, e-learning, social, editors)
- **Blob support differentiator** - Play local files without server upload (rare in competitors)
- **Community requested** - Direct request from OpenNoodl community

---

## Success Criteria

- [ ] Video plays from URL (mp4, webm)
- [ ] Video plays from blob/File object (from File Picker node)
- [ ] All playback controls work via signal inputs
- [ ] Time tracking outputs update in real-time
- [ ] Events fire correctly for all lifecycle moments
- [ ] Fullscreen and Picture-in-Picture work cross-browser
- [ ] Frame capture produces valid base64 image
- [ ] Captions/subtitles display from VTT file
- [ ] Works in both editor preview and deployed apps
- [ ] Performance: time updates don't cause UI jank

---

## Technical Architecture

### Node Registration

```
Location: packages/noodl-viewer-react/src/nodes/visual/videoplayer.js (new file)
Type: Visual/Frontend node using createNodeFromReactComponent
Category: "Visual" or "UI Elements" > "Media"
Name: net.noodl.visual.videoplayer
Display Name: Video Player
```

### Core Implementation Pattern

```javascript
import { createNodeFromReactComponent } from '@noodl/react-component-node';

const VideoPlayer = createNodeFromReactComponent({
  name: 'net.noodl.visual.videoplayer',
  displayName: 'Video Player',
  category: 'Visual',
  docs: 'https://docs.noodl.net/nodes/visual/video-player',
  
  // Standard visual node frame options
  frame: {
    dimensions: true,
    position: true,
    margins: true,
    align: true
  },
  
  allowChildren: false,
  
  getReactComponent() {
    return VideoPlayerComponent; // Defined below
  },
  
  // ... inputs/outputs defined below
});
```

### React Component Structure

```javascript
function VideoPlayerComponent(props) {
  const videoRef = useRef(null);
  const [state, setState] = useState({
    isPlaying: false,
    isPaused: true,
    isEnded: false,
    isBuffering: false,
    isSeeking: false,
    isFullscreen: false,
    isPiP: false,
    hasError: false,
    errorMessage: '',
    currentTime: 0,
    duration: 0,
    bufferedPercent: 0,
    videoWidth: 0,
    videoHeight: 0
  });
  
  // Use deferred value for time to prevent jank
  const deferredTime = useDeferredValue(state.currentTime);
  
  // ... event handlers, effects, signal handlers
  
  return (
    <video
      ref={videoRef}
      style={props.style}
      src={props.url || undefined}
      poster={props.posterImage}
      controls={props.controlsVisible}
      loop={props.loop}
      muted={props.muted}
      autoPlay={props.autoplay}
      playsInline={props.playsInline}
      preload={props.preload}
      crossOrigin={props.crossOrigin}
      // ... all event handlers
    >
      {props.captionsUrl && (
        <track
          kind="subtitles"
          src={props.captionsUrl}
          srcLang={props.captionsLanguage || 'en'}
          default={props.captionsEnabled}
        />
      )}
    </video>
  );
}
```

---

## Input/Output Specification

### Inputs - Source

| Name | Type | Default | Description |
|------|------|---------|-------------|
| URL | string | - | Video URL (mp4, webm, ogg, hls) |
| Blob | any | - | File/Blob object from File Picker |
| Poster Image | string | - | Thumbnail URL shown before play |
| Source Type | enum | auto | auto/mp4/webm/ogg/hls |

### Inputs - Playback Control (Signals)

| Name | Type | Description |
|------|------|-------------|
| Play | signal | Start playback |
| Pause | signal | Pause playback |
| Toggle Play/Pause | signal | Toggle current state |
| Stop | signal | Pause and seek to 0 |
| Seek To | signal | Seek to "Seek Time" value |
| Skip Forward | signal | Skip forward by "Skip Amount" |
| Skip Backward | signal | Skip backward by "Skip Amount" |

### Inputs - Playback Settings

| Name | Type | Default | Description |
|------|------|---------|-------------|
| Seek Time | number | 0 | Target time for Seek To (seconds) |
| Skip Amount | number | 10 | Seconds to skip forward/backward |
| Volume | number | 1 | Volume level 0-1 |
| Muted | boolean | false | Mute audio |
| Playback Rate | number | 1 | Speed: 0.25-4 |
| Loop | boolean | false | Loop playback |
| Autoplay | boolean | false | Auto-start on load |
| Preload | enum | auto | none/metadata/auto |
| Controls Visible | boolean | true | Show native controls |

### Inputs - Advanced

| Name | Type | Default | Description |
|------|------|---------|-------------|
| Start Time | number | 0 | Auto-seek on load |
| End Time | number | - | Auto-pause/loop point |
| Plays Inline | boolean | true | iOS inline playback |
| Cross Origin | enum | anonymous | anonymous/use-credentials |
| PiP Enabled | boolean | true | Allow Picture-in-Picture |

### Inputs - Captions

| Name | Type | Default | Description |
|------|------|---------|-------------|
| Captions URL | string | - | VTT subtitle file URL |
| Captions Enabled | boolean | false | Show captions |
| Captions Language | string | en | Language code |

### Inputs - Actions (Signals)

| Name | Type | Description |
|------|------|-------------|
| Enter Fullscreen | signal | Request fullscreen mode |
| Exit Fullscreen | signal | Exit fullscreen mode |
| Toggle Fullscreen | signal | Toggle fullscreen state |
| Enter PiP | signal | Enter Picture-in-Picture |
| Exit PiP | signal | Exit Picture-in-Picture |
| Capture Frame | signal | Capture current frame to output |
| Reload | signal | Reload video source |

### Outputs - State

| Name | Type | Description |
|------|------|-------------|
| Is Playing | boolean | Currently playing |
| Is Paused | boolean | Currently paused |
| Is Ended | boolean | Playback ended |
| Is Buffering | boolean | Waiting for data |
| Is Seeking | boolean | Currently seeking |
| Is Fullscreen | boolean | In fullscreen mode |
| Is Picture-in-Picture | boolean | In PiP mode |
| Has Error | boolean | Error occurred |
| Error Message | string | Error description |

### Outputs - Time

| Name | Type | Description |
|------|------|-------------|
| Current Time | number | Current position (seconds) |
| Duration | number | Total duration (seconds) |
| Progress | number | Position 0-1 |
| Remaining Time | number | Time remaining (seconds) |
| Formatted Current | string | "1:23" or "1:23:45" |
| Formatted Duration | string | Total as formatted string |
| Formatted Remaining | string | Remaining as formatted string |

### Outputs - Media Info

| Name | Type | Description |
|------|------|-------------|
| Video Width | number | Native video width |
| Video Height | number | Native video height |
| Aspect Ratio | number | Width/height ratio |
| Buffered Percent | number | Download progress 0-1 |
| Ready State | number | HTML5 readyState 0-4 |

### Outputs - Events (Signals)

| Name | Type | Description |
|------|------|-------------|
| Loaded Metadata | signal | Duration/dimensions available |
| Can Play | signal | Ready to start playback |
| Can Play Through | signal | Can play to end without buffering |
| Play Started | signal | Playback started |
| Paused | signal | Playback paused |
| Ended | signal | Playback ended |
| Seeking | signal | Seek operation started |
| Seeked | signal | Seek operation completed |
| Time Updated | signal | Time changed (frequent) |
| Volume Changed | signal | Volume or mute changed |
| Rate Changed | signal | Playback rate changed |
| Entered Fullscreen | signal | Entered fullscreen |
| Exited Fullscreen | signal | Exited fullscreen |
| Entered PiP | signal | Entered Picture-in-Picture |
| Exited PiP | signal | Exited Picture-in-Picture |
| Error Occurred | signal | Error happened |
| Buffering Started | signal | Started buffering |
| Buffering Ended | signal | Finished buffering |

### Outputs - Special

| Name | Type | Description |
|------|------|-------------|
| Captured Frame | string | Base64 data URL of captured frame |

---

## Implementation Phases

### Phase 1: Core Playback (4-6 hours)
- [ ] Create node file structure
- [ ] Basic video element with URL support
- [ ] Play/Pause/Stop signal inputs
- [ ] Basic state outputs (isPlaying, isPaused, etc.)
- [ ] Time outputs (currentTime, duration, progress)
- [ ] Register node in node library

### Phase 2: Extended Controls (4-6 hours)
- [ ] Seek functionality (seekTo, skipForward, skipBackward)
- [ ] Volume and mute controls
- [ ] Playback rate control
- [ ] Loop and autoplay
- [ ] All time-related event signals
- [ ] Formatted time outputs

### Phase 3: Advanced Features (4-6 hours)
- [ ] Blob/File support (from File Picker)
- [ ] Fullscreen API integration
- [ ] Picture-in-Picture API integration
- [ ] Frame capture functionality
- [ ] Start/End time range support
- [ ] Buffering state and events

### Phase 4: Polish & Testing (4-6 hours)
- [ ] Captions/subtitles support
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile testing (iOS Safari, Android Chrome)
- [ ] Performance optimization (useDeferredValue for time)
- [ ] Error handling and edge cases
- [ ] Documentation

---

## File Locations

### New Files
```
packages/noodl-viewer-react/src/nodes/visual/videoplayer.js  # Main node
```

### Modified Files
```
packages/noodl-viewer-react/src/nodes/index.js              # Register node
packages/noodl-runtime/src/nodelibraryexport.js             # Add to UI Elements category
```

### Reference Files (existing patterns)
```
packages/noodl-viewer-react/src/nodes/visual/image.js       # Similar visual node
packages/noodl-viewer-react/src/nodes/visual/video.js       # Existing basic video (if exists)
packages/noodl-viewer-react/src/nodes/controls/button.js    # Signal input patterns
```

---

## Testing Checklist

### Manual Testing

**Basic Playback**
- [ ] MP4 URL loads and plays
- [ ] WebM URL loads and plays
- [ ] Poster image shows before play
- [ ] Native controls appear when enabled
- [ ] Native controls hidden when disabled

**Signal Controls**
- [ ] Play signal starts playback
- [ ] Pause signal pauses playback
- [ ] Toggle Play/Pause works correctly
- [ ] Stop pauses and seeks to 0
- [ ] Seek To jumps to correct time
- [ ] Skip Forward/Backward work with Skip Amount

**State Outputs**
- [ ] Is Playing true when playing, false otherwise
- [ ] Is Paused true when paused
- [ ] Is Ended true when video ends
- [ ] Is Buffering true during buffering
- [ ] Current Time updates during playback
- [ ] Duration correct after load
- [ ] Progress 0-1 range correct

**Events**
- [ ] Loaded Metadata fires when ready
- [ ] Play Started fires on play
- [ ] Paused fires on pause
- [ ] Ended fires when complete
- [ ] Time Updated fires during playback

**Advanced Features**
- [ ] Blob from File Picker plays correctly
- [ ] Fullscreen enter/exit works
- [ ] PiP enter/exit works (where supported)
- [ ] Frame Capture produces valid image
- [ ] Captions display from VTT file
- [ ] Start Time auto-seeks on load
- [ ] End Time auto-pauses/loops

**Cross-Browser**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] iOS Safari
- [ ] Android Chrome

**Edge Cases**
- [ ] Invalid URL shows error state
- [ ] Network error during playback
- [ ] Rapid play/pause doesn't break
- [ ] Seeking while buffering
- [ ] Source change during playback
- [ ] Multiple Video Player nodes on same page

---

## Code Examples for Users

### Basic Video Playback
```
[Video URL] → [Video Player] 
                    ↓
              [Is Playing] → [If node for UI state]
```

### Custom Controls
```
[Button "Play"] → Play signal → [Video Player]
[Button "Pause"] → Pause signal ↗
[Slider] → Seek Time + Seek To signal ↗
                                    ↓
                           [Current Time] → [Text display]
                           [Duration] → [Text display]
```

### Video Upload Preview
```
[File Picker] → Blob → [Video Player]
                              ↓
                        [Capture Frame] → [Image node for thumbnail]
```

### E-Learning Progress Tracking
```
[Video Player] 
      ↓
[Progress] → [Progress Bar]
[Ended] → [Mark Lesson Complete logic]
```

---

## Performance Considerations

1. **Time Update Throttling**: The `timeupdate` event fires frequently (4-66Hz). Use `useDeferredValue` to prevent connected nodes from causing frame drops.

2. **Blob Memory**: When using blob sources, ensure proper cleanup on source change to prevent memory leaks.

3. **Frame Capture**: Canvas operations are synchronous. For large videos, this may cause brief UI freeze. Document this limitation.

4. **Multiple Instances**: Test with 3-5 Video Player nodes on same page to ensure no conflicts.

---

## React 19 Benefits

While this node works on React 18.3, React 19 offers:

1. **`ref` as prop** - Cleaner implementation without `forwardRef` wrapper
2. **`useDeferredValue` improvements** - Better time update performance
3. **`useTransition` for seeking** - Non-blocking seek operations

```javascript
// React 19 pattern for smooth seeking
const [isPending, startTransition] = useTransition();

function handleSeek(time) {
  startTransition(() => {
    videoRef.current.currentTime = time;
  });
}
// isPending can drive "Is Seeking" output
```

---

## Documentation Requirements

After implementation, create:
- [ ] Node reference page for docs site
- [ ] Example project: "Video Gallery"
- [ ] Example project: "Custom Video Controls"
- [ ] Migration guide from Function-based video handling

---

## Notes & Gotchas

1. **iOS Autoplay**: iOS requires `playsInline` and `muted` for autoplay to work
2. **CORS**: External videos may need proper CORS headers for frame capture
3. **HLS/DASH**: May require additional libraries (hls.js, dash.js) - consider Phase 2 enhancement
4. **Safari PiP**: Has different API than Chrome/Firefox
5. **Fullscreen**: Different browsers have different fullscreen APIs - use unified helper

---

## Future Enhancements (Out of Scope)

- HLS/DASH streaming support via hls.js
- Video filters/effects
- Multiple audio tracks
- Chapter markers
- Thumbnail preview on seek (sprite sheet)
- Analytics integration
- DRM support
