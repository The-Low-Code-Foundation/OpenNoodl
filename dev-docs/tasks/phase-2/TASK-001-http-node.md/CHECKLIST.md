# TASK-001 Checklist

## Prerequisites
- [ ] Phase 1 complete (build is stable)
- [ ] Read README.md completely
- [ ] Review existing REST node implementation
- [ ] Review QueryEditor patterns for visual list builders
- [ ] Create branch: `git checkout -b feature/002-robust-http-node`

## Phase 1: Core Node Implementation (Day 1-2)

### 1.1 Node Definition
- [ ] Create `packages/noodl-runtime/src/nodes/std-library/data/httpnode.js`
- [ ] Define basic node structure (name, category, color, docs)
- [ ] Implement static inputs (url, method)
- [ ] Implement static outputs (status, success, failure, response)
- [ ] Register node in `packages/noodl-runtime/noodl-runtime.js`
- [ ] Verify node appears in Node Picker under "Data"
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 1.2 Request Execution
- [ ] Implement `doFetch` function (browser fetch API)
- [ ] Handle GET requests
- [ ] Handle POST/PUT/PATCH with body
- [ ] Handle DELETE requests
- [ ] Implement timeout handling
- [ ] Implement error handling
- [ ] Test basic GET request works
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 1.3 Dynamic Port Generation
- [ ] Implement `setup` function for editor integration
- [ ] Parse URL for path parameters (`{param}` → input port)
- [ ] Generate ports from headers configuration
- [ ] Generate ports from query params configuration
- [ ] Generate ports from body fields configuration
- [ ] Generate ports from response mapping
- [ ] Listen for parameter changes → update ports
- [ ] Test: adding header creates input port
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

## Phase 2: Helper Modules (Day 2-3)

### 2.1 cURL Parser
- [ ] Create `packages/noodl-runtime/src/nodes/std-library/data/httpnode/curlParser.js`
- [ ] Parse URL from curl command
- [ ] Extract HTTP method (-X flag)
- [ ] Extract headers (-H flags)
- [ ] Extract query parameters (from URL)
- [ ] Extract body (-d or --data flag)
- [ ] Detect body type from Content-Type header
- [ ] Parse JSON body into fields
- [ ] Write unit tests
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 2.2 JSONPath Extractor
- [ ] Create `packages/noodl-runtime/src/nodes/std-library/data/httpnode/jsonPath.js`
- [ ] Implement basic path extraction (`$.data.value`)
- [ ] Support array access (`$.items[0]`)
- [ ] Support nested paths (`$.data.users[0].name`)
- [ ] Handle null/undefined gracefully
- [ ] Write unit tests
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 2.3 Authentication Presets
- [ ] Create `packages/noodl-runtime/src/nodes/std-library/data/httpnode/authPresets.js`
- [ ] Implement Bearer Token preset
- [ ] Implement Basic Auth preset
- [ ] Implement API Key preset (header and query variants)
- [ ] Test each preset generates correct headers
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 2.4 Pagination Strategies
- [ ] Create `packages/noodl-runtime/src/nodes/std-library/data/httpnode/pagination.js`
- [ ] Implement Offset/Limit strategy
- [ ] Implement Cursor-based strategy
- [ ] Implement Page Number strategy
- [ ] Implement pagination loop in node
- [ ] Test: offset pagination fetches multiple pages
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

## Phase 3: Editor UI Components (Day 3-5)

### 3.1 Setup Editor Structure
- [ ] Create folder `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataProviders/HttpNode/`
- [ ] Create base `HttpNodeEditor.tsx`
- [ ] Register data provider for HTTP node
- [ ] Verify custom panel loads for HTTP node
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 3.2 Headers Editor
- [ ] Create `HeadersEditor.tsx`
- [ ] Visual list with add/remove buttons
- [ ] Key and value inputs for each header
- [ ] "Use input port" toggle for dynamic values
- [ ] Update node parameters on change
- [ ] Test: adding header updates node
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 3.3 Query Parameters Editor
- [ ] Create `QueryParamsEditor.tsx`
- [ ] Same pattern as HeadersEditor
- [ ] Key and value inputs
- [ ] "Use input port" toggle
- [ ] Update node parameters on change
- [ ] Test: adding query param creates port
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 3.4 Body Editor
- [ ] Create `BodyEditor.tsx`
- [ ] Body type selector (JSON, Form-data, URL-encoded, Raw)
- [ ] For JSON: Visual field list editor
- [ ] For JSON: Field type selector (string, number, boolean, object, array)
- [ ] For Form-data: Key-value list
- [ ] For Raw: Text area input
- [ ] Update node parameters on change
- [ ] Test: JSON fields create input ports
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 3.5 Response Mapping Editor
- [ ] Create `ResponseMappingEditor.tsx`
- [ ] Output name input
- [ ] JSONPath input with examples
- [ ] Output type selector
- [ ] Add/remove output mappings
- [ ] "Test" button to validate path against sample response
- [ ] Update node parameters on change
- [ ] Test: adding mapping creates output port
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 3.6 Authentication Editor
- [ ] Create `AuthEditor.tsx`
- [ ] Auth type dropdown (None, Bearer, Basic, API Key)
- [ ] Dynamic inputs based on auth type
- [ ] Inputs can be static or connected (input ports)
- [ ] Update node parameters on change
- [ ] Test: Bearer creates Authorization header
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 3.7 cURL Import Modal
- [ ] Create `CurlImportModal.tsx`
- [ ] "Import cURL" button in node panel
- [ ] Modal with text area for pasting
- [ ] "Import" button parses and populates fields
- [ ] Show preview of detected configuration
- [ ] Handle parse errors gracefully
- [ ] Test: paste curl → all fields populated
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 3.8 Pagination Editor
- [ ] Create `PaginationEditor.tsx`
- [ ] Pagination type dropdown (None, Offset, Cursor, Page)
- [ ] Dynamic configuration based on type
- [ ] Parameter name inputs
- [ ] Max pages limit
- [ ] Update node parameters on change
- [ ] Test: pagination config stored correctly
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

## Phase 4: Integration & Polish (Day 5-6)

### 4.1 Wire Everything Together
- [ ] Combine all editor components in HttpNodeEditor.tsx
- [ ] Ensure parameter changes flow to dynamic ports
- [ ] Ensure port values flow to request execution
- [ ] Ensure response data flows to output ports
- [ ] Test end-to-end: configure → fetch → data on outputs
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 4.2 Error Handling & UX
- [ ] Clear error messages for network failures
- [ ] Clear error messages for invalid JSON response
- [ ] Clear error messages for JSONPath extraction failures
- [ ] Loading state during request
- [ ] Timeout feedback
- [ ] Validation for required fields (URL)
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 4.3 Inspector Support
- [ ] Implement `getInspectInfo()` for debugging
- [ ] Show last request URL
- [ ] Show last response status
- [ ] Show last response body (truncated)
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

## Phase 5: Testing & Documentation (Day 6-7)

### 5.1 Unit Tests
- [ ] curlParser.test.js - all parsing scenarios
- [ ] jsonPath.test.js - all extraction scenarios
- [ ] authPresets.test.js - all auth types
- [ ] pagination.test.js - all strategies
- [ ] All tests pass
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 5.2 Integration Tests
- [ ] Create test Noodl project with HTTP node
- [ ] Test GET request to public API
- [ ] Test POST with JSON body
- [ ] Test with authentication
- [ ] Test pagination
- [ ] Test cURL import
- [ ] Test response mapping
- [ ] All scenarios work
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

### 5.3 Manual Testing Matrix
- [ ] macOS - Editor build works
- [ ] Windows - Editor build works
- [ ] Basic GET request works
- [ ] POST with JSON body works
- [ ] cURL import works
- [ ] All auth types work
- [ ] Pagination works
- [ ] Response mapping works
- [ ] Document results in CHANGELOG.md
- [ ] Confidence level: __/10

### 5.4 Documentation
- [ ] Add node documentation in library/prefabs/http/README.md
- [ ] Document all inputs and outputs
- [ ] Document authentication options
- [ ] Document pagination options
- [ ] Add usage examples
- [ ] Add cURL import examples
- [ ] Update dev-docs if patterns changed
- [ ] Document in CHANGELOG.md
- [ ] Confidence level: __/10

## Phase 6: Completion

### 6.1 Final Review
- [ ] Self-review all changes
- [ ] Check for debug console.log statements
- [ ] Check for TSFixme comments (avoid adding new ones)
- [ ] Verify all TypeScript compiles: `npx tsc --noEmit`
- [ ] Verify editor builds: `npm run build:editor`
- [ ] Verify all success criteria from README met
- [ ] Document in CHANGELOG.md
- [ ] Final confidence level: __/10

### 6.2 PR Preparation
- [ ] Write comprehensive PR description
- [ ] List all files changed with brief explanations
- [ ] Note any breaking changes (none expected)
- [ ] Add screenshots of editor UI
- [ ] Add GIF of cURL import in action
- [ ] Create PR

### 6.3 Post-Merge
- [ ] Verify main branch builds
- [ ] Announce in community channels
- [ ] Gather feedback for iteration
- [ ] Note follow-up items in NOTES.md
