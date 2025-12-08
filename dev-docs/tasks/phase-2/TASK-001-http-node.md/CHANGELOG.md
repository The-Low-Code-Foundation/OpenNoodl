# TASK-001 Changelog

## 2025-01-08 - Cline

### Summary
Phase 1 implementation - Core HTTP Node created with declarative configuration support.

### Files Created
- `packages/noodl-runtime/src/nodes/std-library/data/httpnode.js` - Main HTTP node implementation with:
  - URL with path parameter support ({param} syntax)
  - HTTP methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
  - Dynamic port generation for headers, query params, body fields
  - Authentication presets: None, Bearer, Basic, API Key
  - Response mapping with JSONPath-like extraction
  - Timeout and cancel support
  - Inspector integration

### Files Modified
- `packages/noodl-runtime/noodl-runtime.js` - Added HTTP node registration

### Features Implemented
1. **URL Path Parameters**: `/users/{userId}` automatically creates `userId` input port
2. **Headers**: Visual configuration creates input ports per header
3. **Query Parameters**: Visual configuration creates input ports per param
4. **Body Types**: JSON, Form Data, URL Encoded, Raw
5. **Body Fields**: Visual configuration creates input ports per field
6. **Authentication**: Bearer, Basic Auth, API Key (header or query)
7. **Response Mapping**: Extract data using JSONPath syntax
8. **Outputs**: Response, Status Code, Response Headers, Success/Failure signals

### Testing Notes
- [ ] Need to run `npm run dev` to verify node appears in Node Picker
- [ ] Need to test basic GET request
- [ ] Need to test POST with JSON body

### Known Issues
- Uses `stringlist` type for headers/queryParams/bodyFields - may need custom visual editors in Phase 3
