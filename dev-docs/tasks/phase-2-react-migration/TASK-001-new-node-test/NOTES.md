# TASK-001 Working Notes

## Research

### Existing Patterns Found

**REST Node (restnode.js)**
- Script-based request/response handling
- Dynamic ports created by parsing `Inputs.X` and `Outputs.X` from scripts
- Uses XMLHttpRequest in browser, fetch in cloud runtime
- Good reference for request execution flow

**DB Collection Node (dbcollectionnode2.js)**
- Best example of dynamic port generation from configuration
- Pattern: `setup()` function listens for node changes, calls `sendDynamicPorts()`
- Schema introspection creates visual filter UI
- Follow this pattern for visual editors

**Query Editor Components**
- `QueryRuleEditPopup` - good pattern for visual list item editors
- `RuleDropdown`, `RuleInput` - reusable input components
- Pattern: components update node parameters, ports regenerate

### Questions to Resolve
- [ ] How does node library export work for new nodes?
- [ ] Best way to handle file uploads in body?
- [ ] Should pagination results be streamed or collected?
- [ ] How to handle binary responses (images, files)?

### Assumptions
- We keep REST2 for backwards compatibility: ✅ Validated
- Dynamic ports pattern from DB nodes will work: ❓ Pending validation
- Editor can register custom property panels: ❓ Pending validation

## Implementation Notes

### Approach Decisions
- [To be filled during implementation]

### Gotchas / Surprises
- [To be filled during implementation]

### Useful Commands

```bash
# Find all REST node usages
grep -r "REST2" packages/ --include="*.ts" --include="*.tsx" --include="*.js"

# Find QueryEditor components for patterns
find packages/noodl-editor -name "*Query*" -type f

# Find how nodes register data providers
grep -r "DataProvider" packages/noodl-editor --include="*.ts" --include="*.tsx"

# Build just the runtime for testing
cd packages/noodl-runtime && npm run build

# Test node appears in editor
npm run dev
```

### Reference URLs
- n8n HTTP node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/
- JSONPath spec: https://goessner.net/articles/JsonPath/
- cURL manual: https://curl.se/docs/manpage.html

## Debug Log

[To be filled during implementation]
