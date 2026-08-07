# User Location Node Specification

## Overview

The **User Location** node provides user geolocation functionality with multiple precision levels and fallback strategies. It handles the browser Geolocation API, manages permissions gracefully, and provides clear status reporting for different location acquisition methods.

This is a **logic node** (non-visual) that responds to signal triggers and outputs location data with comprehensive error handling and status reporting.

## Use Cases

- **Location-aware features**: Show nearby stores, events, or services
- **Personalization**: Adapt content based on user's region
- **Analytics**: Track geographic usage patterns (with user consent)
- **Shipping/delivery**: Pre-fill location fields in forms
- **Weather apps**: Get local weather based on position
- **Progressive enhancement**: Start with coarse location, refine to precise GPS when available

## Technical Foundation

### Browser Geolocation API
- **Primary method**: `navigator.geolocation.getCurrentPosition()`
- **Permissions**: Requires user consent (browser prompt)
- **Accuracy**: GPS on mobile (~5-10m), WiFi/IP on desktop (~100-1000m)
- **Browser support**: Universal (Chrome, Firefox, Safari, Edge)
- **HTTPS requirement**: Geolocation API requires secure context

### IP-based Fallback
- **Service**: ipapi.co free tier (no API key required for basic usage)
- **Accuracy**: City-level (~10-50km radius)
- **Privacy**: Does not require user permission
- **Limits**: 1,000 requests/day on free tier
- **Fallback strategy**: Used when GPS unavailable or permission denied

## Node Interface

### Category & Metadata
```javascript
{
  name: 'User Location',
  category: 'Data',
  color: 'data',
  docs: 'https://docs.noodl.net/nodes/data/user-location',
  searchTags: ['geolocation', 'gps', 'position', 'coordinates', 'location'],
  displayName: 'User Location'
}
```

### Signal Inputs

#### `Get Location`
Triggers location acquisition based on current accuracy mode setting.

**Behavior:**
- Checks if geolocation is supported
- Requests appropriate permission level
- Executes location query
- Sends appropriate output signal when complete

#### `Cancel`
Aborts an in-progress location request.

**Behavior:**
- Clears any pending geolocation watchPosition
- Aborts any in-flight IP geolocation requests
- Sends `Canceled` signal
- Resets internal state

### Parameters

#### `Accuracy Mode`
**Type:** Enum (dropdown)  
**Default:** `"precise"`  
**Options:**
- `"precise"` - High accuracy GPS (mobile: ~5-10m, desktop: ~100m)
- `"coarse"` - Lower accuracy, faster, better battery (mobile: ~100m-1km)
- `"city"` - IP-based location, no permission required (~10-50km)

**Details:**
- **Precise**: Uses `enableHighAccuracy: true`, ideal for navigation/directions
- **Coarse**: Uses `enableHighAccuracy: false`, better for "nearby" features
- **City**: Uses IP geolocation service, for region-level personalization

#### `Timeout`
**Type:** Number  
**Default:** `10000` (10 seconds)  
**Unit:** Milliseconds  
**Range:** 1000-60000

Specifies how long to wait for location before timing out.

#### `Cache Age`
**Type:** Number  
**Default:** `60000` (1 minute)  
**Unit:** Milliseconds  
**Range:** 0-3600000

Maximum age of a cached position. Setting to `0` forces a fresh location.

#### `Auto Request`
**Type:** Boolean  
**Default:** `false`

If `true`, automatically requests location when node initializes (useful for apps that always need location).

**Warning:** Requesting location on load can be jarring to users. Best practice is to request only when needed.

### Data Outputs

#### `Latitude`
**Type:** Number  
**Precision:** 6-8 decimal places  
**Example:** `59.3293`

Geographic latitude in decimal degrees.

#### `Longitude`
**Type:** Number  
**Precision:** 6-8 decimal places  
**Example:** `18.0686`

Geographic longitude in decimal degrees.

#### `Accuracy`
**Type:** Number  
**Unit:** Meters  
**Example:** `10.5`

Accuracy radius in meters. Represents confidence circle around the position.

#### `Altitude` (Optional)
**Type:** Number  
**Unit:** Meters  
**Example:** `45.2`

Height above sea level. May be `null` if unavailable (common on desktop).

#### `Altitude Accuracy` (Optional)
**Type:** Number  
**Unit:** Meters

Accuracy of altitude measurement. May be `null` if unavailable.

#### `Heading` (Optional)
**Type:** Number  
**Unit:** Degrees (0-360)  
**Example:** `90.0` (East)

Direction of device movement. `null` when stationary or unavailable.

#### `Speed` (Optional)
**Type:** Number  
**Unit:** Meters per second  
**Example:** `1.5` (walking pace)

Device movement speed. `null` when stationary or unavailable.

#### `Timestamp`
**Type:** Number  
**Format:** Unix timestamp (milliseconds since epoch)  
**Example:** `1703001234567`

When the position was acquired.

#### `City`
**Type:** String  
**Example:** `"Stockholm"`

City name (only available with IP-based location).

#### `Region`
**Type:** String  
**Example:** `"Stockholm County"`

Region/state name (only available with IP-based location).

#### `Country`
**Type:** String  
**Example:** `"Sweden"`

Country name (only available with IP-based location).

#### `Country Code`
**Type:** String  
**Example:** `"SE"`

ISO 3166-1 alpha-2 country code (only available with IP-based location).

#### `Postal Code`
**Type:** String  
**Example:** `"111 22"`

Postal/ZIP code (only available with IP-based location).

#### `Error Message`
**Type:** String  
**Example:** `"User denied geolocation permission"`

Human-readable error message when location acquisition fails.

#### `Error Code`
**Type:** Number  
**Values:**
- `0` - No error
- `1` - Permission denied
- `2` - Position unavailable
- `3` - Timeout
- `4` - Browser not supported
- `5` - Network error (IP geolocation)

Numeric error code for programmatic handling.

### Signal Outputs

#### `Success`
Sent when location is successfully acquired.

**Guarantees:**
- `Latitude` and `Longitude` are populated
- `Accuracy` contains valid accuracy estimate
- Other outputs populated based on method and device capabilities

#### `Permission Denied`
Sent when user explicitly denies location permission.

**User recovery:**
- Show message explaining why location is needed
- Provide alternative (manual location entry)
- Offer "Settings" link to browser permissions

#### `Position Unavailable`
Sent when location service reports position cannot be determined.

**Causes:**
- GPS signal lost (indoors, urban canyon)
- WiFi/cell network unavailable
- Location services disabled at OS level

#### `Timeout`
Sent when location request exceeds configured timeout.

**Response:**
- May succeed if retried with longer timeout
- Consider falling back to IP-based location

#### `Not Supported`
Sent when browser doesn't support geolocation.

**Response:**
- Fall back to manual location entry
- Use IP-based estimation
- Show graceful degradation message

#### `Canceled`
Sent when location request is explicitly canceled via `Cancel` signal.

#### `Network Error`
Sent when IP geolocation service fails (only for city-level accuracy).

**Causes:**
- Network connectivity issues
- API rate limit exceeded
- Service unavailable

## State Management

The node maintains internal state to track:

```javascript
this._internal = {
  watchId: null,              // Active geolocation watch ID
  abortController: null,      // For canceling IP requests
  pendingRequest: false,      // Is request in progress?
  lastPosition: null,         // Cached position data
  lastError: null,            // Last error encountered
  permissionState: 'prompt'   // 'granted', 'denied', 'prompt'
}
```

## Implementation Details

### Permission Handling Strategy

1. **Check permission state** (if Permissions API available)
2. **Request location** based on accuracy mode
3. **Handle response** with appropriate success/error signal
4. **Cache result** for subsequent requests within cache window

### Geolocation Options

```javascript
// For "precise" mode
{
  enableHighAccuracy: true,
  timeout: this._internal.timeout,
  maximumAge: this._internal.cacheAge
}

// For "coarse" mode
{
  enableHighAccuracy: false,
  timeout: this._internal.timeout,
  maximumAge: this._internal.cacheAge
}
```

### IP Geolocation Implementation

```javascript
async function getIPLocation() {
  const controller = new AbortController();
  this._internal.abortController = controller;
  
  try {
    const response = await fetch('https://ipapi.co/json/', {
      signal: controller.signal
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Populate outputs
    this.setOutputs({
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: 50000, // ~50km city-level accuracy
      city: data.city,
      region: data.region,
      country: data.country_name,
      countryCode: data.country_code,
      postalCode: data.postal,
      timestamp: Date.now()
    });
    
    this.sendSignalOnOutput('success');
    
  } catch (error) {
    if (error.name === 'AbortError') {
      this.sendSignalOnOutput('canceled');
    } else {
      this._internal.lastError = error.message;
      this.flagOutputDirty('errorMessage');
      this.sendSignalOnOutput('networkError');
    }
  }
}
```

### Error Mapping

```javascript
function handleGeolocationError(error) {
  this._internal.lastError = error;
  this.setOutputValue('errorCode', error.code);
  
  switch(error.code) {
    case 1: // PERMISSION_DENIED
      this.setOutputValue('errorMessage', 'User denied geolocation permission');
      this.sendSignalOnOutput('permissionDenied');
      break;
      
    case 2: // POSITION_UNAVAILABLE
      this.setOutputValue('errorMessage', 'Position unavailable');
      this.sendSignalOnOutput('positionUnavailable');
      break;
      
    case 3: // TIMEOUT
      this.setOutputValue('errorMessage', 'Location request timed out');
      this.sendSignalOnOutput('timeout');
      break;
      
    default:
      this.setOutputValue('errorMessage', 'Unknown error occurred');
      this.sendSignalOnOutput('positionUnavailable');
  }
}
```

## Security & Privacy Considerations

### User Privacy
- **Explicit permission**: Always require user consent for GPS (precise/coarse)
- **Clear purpose**: Document why location is needed in app UI
- **Minimal data**: Only request accuracy level needed for feature
- **No storage**: Don't store location unless explicitly needed
- **User control**: Provide easy way to revoke/change location settings

### HTTPS Requirement
- Geolocation API **requires HTTPS** in modern browsers
- Will fail silently or throw error on HTTP pages
- Development exception: `localhost` works over HTTP

### Rate Limiting
- IP geolocation service has 1,000 requests/day limit (free tier)
- Implement smart caching to reduce API calls
- Consider upgrading to paid tier for high-traffic apps

### Permission Persistence
- Browser remembers user's permission choice
- Can be revoked at any time in browser settings
- Node should gracefully handle permission changes

## User Experience Guidelines

### When to Request Location

**✅ DO:**
- Request when user triggers location-dependent feature
- Explain why location is needed before requesting
- Provide fallback for users who decline

**❌ DON'T:**
- Request on page load without context
- Re-prompt immediately after denial
- Block functionality if permission denied

### Error Handling UX

```
┌─────────────────────────────────────┐
│  Permission Denied                   │
├─────────────────────────────────────┤
│  We need your location to show      │
│  nearby stores. You can enable it   │
│  in your browser settings.          │
│                                      │
│  [Enter Location Manually]          │
└─────────────────────────────────────┘
```

### Progressive Enhancement

1. **Start coarse**: Request city-level (no permission)
2. **Offer precise**: "Show exact location" button
3. **Graceful degradation**: Manual entry fallback

## Testing Strategy

### Unit Tests

```javascript
describe('User Location Node', () => {
  it('should request high accuracy location in precise mode', () => {
    // Mock navigator.geolocation.getCurrentPosition
    // Verify enableHighAccuracy: true
  });
  
  it('should timeout after configured duration', () => {
    // Set timeout to 1000ms
    // Mock delayed response
    // Verify timeout signal fires
  });
  
  it('should use cached location within cache age', () => {
    // Get location once
    // Get location again within cache window
    // Verify no new geolocation call made
  });
  
  it('should fall back to IP location in city mode', () => {
    // Set mode to 'city'
    // Trigger get location
    // Verify fetch called to ipapi.co
  });
  
  it('should handle permission denial gracefully', () => {
    // Mock permission denied error
    // Verify permissionDenied signal fires
    // Verify error message set
  });
  
  it('should cancel in-progress requests', () => {
    // Start location request
    // Trigger cancel
    // Verify canceled signal fires
  });
});
```

### Integration Tests

- Test on actual devices (mobile + desktop)
- Test with/without GPS enabled
- Test with permission granted/denied/prompt states
- Test network failures for IP geolocation
- Test timeout behavior with slow networks
- Test HTTPS requirement enforcement

### Browser Compatibility Tests

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 90+ | Full support |
| Firefox | 88+ | Full support |
| Safari | 14+ | Full support, may prompt per session |
| Edge | 90+ | Full support |
| Mobile Safari | iOS 14+ | High accuracy works well |
| Mobile Chrome | Android 10+ | High accuracy works well |

## Example Usage Patterns

### Pattern 1: Simple Location Request

```
[Button] → Click Signal
  ↓
[User Location] → Get Location
  ↓
Success → [Text] "Your location: {Latitude}, {Longitude}"
Permission Denied → [Text] "Please enable location access"
```

### Pattern 2: Progressive Enhancement

```
[User Location] (mode: city)
  ↓
Success → [Text] "Shopping near {City}"
  ↓
[Button] "Show exact location"
  ↓
[User Location] (mode: precise) → Get Location
  ↓
Success → Update map with precise position
```

### Pattern 3: Error Recovery Chain

```
[User Location] (mode: precise)
  ↓
Permission Denied OR Timeout
  ↓
[User Location] (mode: city) → Get Location
  ↓
Success → Use coarse location
Network Error → [Text] "Enter location manually"
```

### Pattern 4: Map Integration

```
[User Location]
  ↓
Success → [Object] Store lat/lng
  ↓
[Function] Call map API
  ↓
[HTML Element] Display map with user marker
```

## Documentation Requirements

### Node Reference Page

1. **Overview section** explaining location acquisition
2. **Permission explanation** with browser screenshots
3. **Accuracy mode comparison** table
4. **Common use cases** with visual examples
5. **Error handling guide** with recovery strategies
6. **Privacy best practices** section
7. **HTTPS requirement** warning
8. **Example implementations** for each pattern

### Tutorial Content

- "Building a Store Locator with User Location"
- "Progressive Location Permissions"
- "Handling Location Errors Gracefully"

## File Locations

### Implementation
- **Path**: `/packages/noodl-runtime/src/nodes/std-library/data/userlocation.js`
- **Registration**: Add to `/packages/noodl-runtime/src/nodes/std-library/index.js`

### Tests
- **Unit**: `/packages/noodl-runtime/tests/nodes/data/userlocation.test.js`
- **Integration**: Manual testing checklist document

### Documentation
- **Main docs**: `/docs/nodes/data/user-location.md`
- **Examples**: `/docs/examples/location-features.md`

## Dependencies

### Runtime Dependencies
- Native browser APIs (no external dependencies)
- Optional: `ipapi.co` for IP-based location (free service, no npm package needed)

### Development Dependencies
- Jest for unit tests
- Mock implementations of `navigator.geolocation`

## Implementation Phases

### Phase 1: Core GPS Location (2-3 days)
- [ ] Basic node structure with inputs/outputs
- [ ] GPS location acquisition (precise/coarse modes)
- [ ] Permission handling
- [ ] Error handling and signal outputs
- [ ] Basic unit tests

### Phase 2: IP Fallback (1-2 days)
- [ ] City mode implementation
- [ ] IP geolocation API integration
- [ ] Network error handling
- [ ] Extended test coverage

### Phase 3: Polish & Edge Cases (1-2 days)
- [ ] Cancel functionality
- [ ] Cache management
- [ ] Auto request feature
- [ ] Browser compatibility testing
- [ ] Permission state tracking

### Phase 4: Documentation (1-2 days)
- [ ] Node reference documentation
- [ ] Usage examples
- [ ] Tutorial content
- [ ] Privacy guidelines
- [ ] Troubleshooting guide

**Total estimated effort:** 5-9 days

## Success Criteria

- [ ] Node successfully acquires location in all three accuracy modes
- [ ] Permission states handled gracefully (grant/deny/prompt)
- [ ] Clear error messages for all failure scenarios
- [ ] Timeout and cancel functionality work correctly
- [ ] Cache prevents unnecessary repeated requests
- [ ] Works across major browsers and devices
- [ ] Comprehensive unit test coverage (>80%)
- [ ] Documentation complete with examples
- [ ] Privacy considerations clearly documented
- [ ] Community feedback incorporated

## Future Enhancements

### Continuous Location Tracking
Add `Watch Location` signal input that continuously monitors position changes. Useful for:
- Navigation apps
- Fitness tracking
- Delivery tracking

**Implementation:** Use `navigator.geolocation.watchPosition()`

### Geofencing
Add ability to define geographic boundaries and trigger signals when user enters/exits.

**Outputs:**
- `Entered Geofence` signal
- `Exited Geofence` signal
- `Inside Geofence` boolean

### Custom IP Services
Allow users to specify their own IP geolocation service URL and API key for:
- Higher rate limits
- Additional data (ISP, timezone, currency)
- Enterprise requirements

### Location History
Optional caching of location history with timestamp array output for:
- Journey tracking
- Location analytics
- Movement patterns

### Distance Calculations
Built-in distance calculation between user location and target coordinates:
- Distance to store/event
- Sorting by proximity
- "Nearby" filtering

## Related Nodes

- **REST**: Can be used to send location data to APIs
- **Object**: Store location data in app state
- **Condition**: Branch logic based on error codes
- **Function**: Calculate distances, format coordinates
- **Array**: Store multiple location readings

## Questions for Community/Team

1. Should we include "Watch Location" in v1 or defer to v2?
2. Do we need additional country/region data beyond what ipapi.co provides?
3. Should we support other IP geolocation services?
4. Is 1-minute default cache age appropriate?
5. Should we add a "Remember Permission" feature?

---

**Document Version:** 1.0  
**Last Updated:** 2024-12-16  
**Author:** AI Assistant (Claude)  
**Status:** RFC - Ready for Review
