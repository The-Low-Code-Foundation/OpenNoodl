# Phase 6E: UBA Reference Backend

## Erleah AI Agent - Full UBA Implementation

**Phase:** 6E of 6  
**Duration:** 3 weeks (15 working days)  
**Priority:** HIGH  
**Status:** NOT STARTED  
**Depends On:** Phase 6A-6D complete

---

## Overview

Phase 6E implements a complete, production-ready UBA backend using the Erleah AI Agent. This serves as both a real product deliverable for Visual Hive and the definitive reference implementation for the UBA specification.

The Erleah backend will demonstrate:
- Complete schema with all field types
- Config endpoint with validation and hot-reload
- Debug streaming for agent observability
- Health monitoring
- Best practices for UBA integration

### Dual Purpose

| Visual Hive CTO Hat | Low Code Foundation Hat |
|---------------------|------------------------|
| Production AI agent for conferences | Reference implementation for community |
| Real-world validation of UBA | Documentation and examples |
| Solves client configuration needs | Proves UBA works at scale |

---

## Goals

1. **Complete Erleah schema** - Full-featured schema demonstrating all capabilities
2. **Config endpoint** - Receive, validate, and apply configuration
3. **Debug streaming** - Real-time agent execution visibility
4. **Schema endpoint** - Serve schema with proper caching
5. **End-to-end testing** - Full integration validation
6. **Documentation** - Erleah-specific setup and usage guides

---

## Prerequisites

- Phase 6A-6D complete ✅
- Erleah Python backend repository ✅
- FastAPI server running ✅
- LangGraph agent functional ✅

---

## Task Breakdown

### UBA-023: Erleah Schema
**Effort:** 2 days  
**Assignee:** TBD  
**Branch:** `feature/uba-023-erleah-schema`

#### Description

Create the complete Erleah schema file demonstrating all UBA capabilities relevant to an AI agent backend.

#### Schema Structure

```yaml
# erleah/nodegx-schema.yaml

schema_version: "1.0"

backend:
  id: "erleah-ai-agent"
  name: "Erleah AI Agent"
  description: "Agentic AI assistant for conference attendees, exhibitors, and VIP guests"
  version: "1.0.0"
  icon: "https://erleah.com/assets/icon.png"
  homepage: "https://docs.erleah.com"
  
  endpoints:
    config: "/nodegx/config"
    health: "/health"
    debug_stream: "/nodegx/debug"
    
  auth:
    type: "bearer"
    header: "X-Nodegx-Token"
    
  capabilities:
    hot_reload: true
    debug: true
    batch_config: false

# =============================================================================
# SECTION 1: Data Sources
# =============================================================================
sections:
  - id: "data_sources"
    name: "Data Sources"
    description: "Configure where your conference data comes from"
    icon: "database"
    
    fields:
      # Primary data backend selection
      - id: "primary_backend"
        type: "backend_reference"
        name: "Primary Data Backend"
        description: "Select your Directus or Supabase instance containing conference data"
        required: true
        backend_types: ["directus", "supabase"]
        
      # Attendee configuration
      - id: "attendee_collection"
        type: "directus_collection"
        name: "Attendee Collection"
        description: "Collection containing attendee/participant data"
        backend_field: "primary_backend"
        required: true
        
      - id: "attendee_mappings"
        type: "field_mapping"
        name: "Attendee Field Mappings"
        description: "Map your attendee fields to Erleah's expected format"
        
        source:
          type: "directus_fields"
          backend_field: "primary_backend"
          collection_field: "attendee_collection"
          
        targets:
          - id: "name"
            name: "Full Name"
            description: "Attendee's display name"
            required: true
            
          - id: "email"
            name: "Email"
            description: "Contact email (used for identification)"
            required: true
            
          - id: "title"
            name: "Job Title"
            description: "Professional title or role"
            required: false
            
          - id: "company"
            name: "Company/Organization"
            description: "Employer or organization name"
            required: false
            
          - id: "bio"
            name: "Biography"
            description: "Description or bio text"
            required: true
            hint: "Used for semantic search - longer, descriptive text works best"
            
          - id: "interests"
            name: "Interests/Tags"
            description: "Topics, skills, or interests"
            required: false
            array: true
            hint: "Array of keywords or tags"
            
          - id: "photo_url"
            name: "Photo URL"
            description: "Profile photo URL"
            required: false
            
          - id: "location"
            name: "Current Location"
            description: "Real-time or default location"
            required: false
            hint: "Required for proximity features"
            
      # Session configuration
      - id: "session_collection"
        type: "directus_collection"
        name: "Session Collection"
        description: "Collection containing conference sessions/talks"
        backend_field: "primary_backend"
        
      - id: "session_mappings"
        type: "field_mapping"
        name: "Session Field Mappings"
        
        source:
          type: "directus_fields"
          backend_field: "primary_backend"
          collection_field: "session_collection"
          
        targets:
          - id: "title"
            name: "Session Title"
            required: true
            
          - id: "description"
            name: "Description"
            required: true
            hint: "Used for semantic search"
            
          - id: "speaker_name"
            name: "Speaker Name"
            required: false
            
          - id: "speaker_id"
            name: "Speaker ID"
            description: "Reference to attendee record"
            required: false
            
          - id: "start_time"
            name: "Start Time"
            required: true
            
          - id: "end_time"
            name: "End Time"
            required: true
            
          - id: "location"
            name: "Room/Location"
            required: false
            
          - id: "track"
            name: "Track/Category"
            required: false
            
          - id: "capacity"
            name: "Capacity"
            required: false
            
      # Exhibitor configuration
      - id: "exhibitor_collection"
        type: "directus_collection"
        name: "Exhibitor Collection"
        description: "Collection containing exhibitor/sponsor data"
        backend_field: "primary_backend"
        
      - id: "exhibitor_mappings"
        type: "field_mapping"
        name: "Exhibitor Field Mappings"
        visible_when:
          field: "data_sources.exhibitor_collection"
          is_not_empty: true
          
        source:
          type: "directus_fields"
          backend_field: "primary_backend"
          collection_field: "exhibitor_collection"
          
        targets:
          - id: "name"
            name: "Company Name"
            required: true
            
          - id: "description"
            name: "Description"
            required: true
            
          - id: "booth_location"
            name: "Booth Location"
            required: false
            
          - id: "website"
            name: "Website URL"
            required: false
            
          - id: "categories"
            name: "Categories/Tags"
            array: true
            required: false

# =============================================================================
# SECTION 2: Vector Database
# =============================================================================
  - id: "vector_db"
    name: "Vector Database"
    description: "Configure semantic search capabilities"
    icon: "search"
    
    fields:
      - id: "qdrant_url"
        type: "url"
        name: "Qdrant URL"
        description: "URL of your Qdrant vector database"
        required: true
        default: "http://localhost:6333"
        protocols: ["http", "https"]
        
      - id: "qdrant_api_key"
        type: "secret"
        name: "Qdrant API Key"
        description: "Leave empty for local development without auth"
        required: false
        
      - id: "embedding_provider"
        type: "select"
        name: "Embedding Provider"
        description: "Service to use for generating embeddings"
        options:
          - value: "openai"
            label: "OpenAI"
          - value: "voyage"
            label: "Voyage AI"
          - value: "cohere"
            label: "Cohere"
        default: "openai"
        
      - id: "embedding_model"
        type: "select"
        name: "Embedding Model"
        options_from:
          endpoint: "/nodegx/embedding-models"
          value_field: "id"
          label_field: "name"
          
      - id: "collection_prefix"
        type: "string"
        name: "Collection Prefix"
        description: "Prefix for Qdrant collection names (useful for multi-tenant)"
        default: "erleah_"
        validation:
          pattern: "^[a-z][a-z0-9_]*$"
          pattern_message: "Use lowercase letters, numbers, and underscores only"
          
      - id: "auto_index"
        type: "boolean"
        name: "Auto-Index on Startup"
        description: "Automatically index/update vectors when agent starts"
        default: true

# =============================================================================
# SECTION 3: Agent Tools
# =============================================================================
  - id: "tools"
    name: "Agent Tools"
    description: "Enable or disable agent capabilities"
    icon: "wrench"
    
    fields:
      - id: "attendee_search"
        type: "tool_toggle"
        name: "Attendee Search"
        description: "Find attendees by interests, role, company, or description"
        icon: "users"
        default: true
        
        config:
          - id: "default_limit"
            type: "number"
            name: "Default Result Limit"
            default: 10
            min: 1
            max: 50
            
          - id: "min_similarity"
            type: "slider"
            name: "Minimum Similarity Score"
            description: "Filter out results below this threshold"
            min: 0
            max: 1
            step: 0.05
            default: 0.65
            marks:
              - value: 0.5
                label: "Lenient"
              - value: 0.7
                label: "Balanced"
              - value: 0.9
                label: "Strict"
                
      - id: "session_search"
        type: "tool_toggle"
        name: "Session Search"
        description: "Find sessions by topic, speaker, or track"
        icon: "calendar"
        default: true
        
        config:
          - id: "include_past"
            type: "boolean"
            name: "Include Past Sessions"
            description: "Show sessions that have already ended"
            default: false
            
          - id: "default_limit"
            type: "number"
            name: "Default Result Limit"
            default: 10
            
      - id: "exhibitor_search"
        type: "tool_toggle"
        name: "Exhibitor Search"
        description: "Find exhibitors by product, service, or category"
        icon: "building"
        default: true
        
        depends_on:
          field: "data_sources.exhibitor_collection"
          condition: "is_not_empty"
          message: "Configure exhibitor collection first"
          
      - id: "proximity_search"
        type: "tool_toggle"
        name: "Proximity Search"
        description: "Find people and places near a location"
        icon: "map-pin"
        default: true
        
        depends_on:
          field: "data_sources.attendee_mappings.location"
          condition: "is_mapped"
          message: "Map the location field to enable proximity search"
          
        config:
          - id: "default_radius"
            type: "number"
            name: "Default Search Radius"
            default: 100
            min: 10
            max: 1000
            unit: "meters"
            
          - id: "location_update_interval"
            type: "number"
            name: "Location Update Interval"
            description: "How often to refresh location data"
            default: 60
            unit: "seconds"
            
      - id: "schedule_management"
        type: "tool_toggle"
        name: "Schedule Management"
        description: "Help users build and manage their conference agenda"
        icon: "clipboard-list"
        default: true
        
        config:
          - id: "conflict_detection"
            type: "boolean"
            name: "Detect Schedule Conflicts"
            description: "Warn when sessions overlap"
            default: true
            
          - id: "travel_time_buffer"
            type: "number"
            name: "Travel Time Buffer"
            description: "Minutes to allow between sessions in different locations"
            default: 10
            min: 0
            max: 30
            unit: "minutes"
            
          - id: "max_sessions_per_day"
            type: "number"
            name: "Max Sessions per Day"
            description: "Suggest breaks when schedule is too packed"
            default: 8
            
      - id: "connection_recommendations"
        type: "tool_toggle"
        name: "Connection Recommendations"
        description: "Suggest relevant people to meet based on interests and goals"
        icon: "user-plus"
        default: true
        
        config:
          - id: "recommendation_count"
            type: "number"
            name: "Recommendations per Request"
            default: 5
            min: 1
            max: 20
            
          - id: "factors"
            type: "multi_select"
            name: "Recommendation Factors"
            description: "What to consider when recommending connections"
            options:
              - value: "interests"
                label: "Shared Interests"
              - value: "industry"
                label: "Same Industry"
              - value: "company_size"
                label: "Similar Company Size"
              - value: "role"
                label: "Complementary Roles"
              - value: "location"
                label: "Proximity"
            default: ["interests", "industry", "role"]
            
      - id: "venue_navigation"
        type: "tool_toggle"
        name: "Venue Navigation"
        description: "Help users find their way around the venue"
        icon: "navigation"
        default: false
        
        config:
          - id: "floor_plans"
            type: "file_upload"
            name: "Floor Plan Images"
            description: "Upload venue maps for AI-powered navigation"
            accept: ["image/png", "image/jpeg", "application/pdf"]
            multiple: true
            max_size: "10MB"
            upload_endpoint: "/nodegx/upload/floor-plans"
            
          - id: "use_vision"
            type: "boolean"
            name: "Use Vision AI"
            description: "Analyze floor plans with computer vision"
            default: true

# =============================================================================
# SECTION 4: Language Model
# =============================================================================
  - id: "llm"
    name: "Language Model"
    description: "Configure the AI model powering the agent"
    icon: "cpu"
    
    fields:
      - id: "provider"
        type: "select"
        name: "LLM Provider"
        options:
          - value: "anthropic"
            label: "Anthropic (Claude)"
          - value: "openai"
            label: "OpenAI (GPT)"
        default: "anthropic"
        
      - id: "anthropic_api_key"
        type: "secret"
        name: "Anthropic API Key"
        required: true
        visible_when:
          field: "llm.provider"
          equals: "anthropic"
          
      - id: "anthropic_model"
        type: "select"
        name: "Claude Model"
        visible_when:
          field: "llm.provider"
          equals: "anthropic"
        options:
          - value: "claude-sonnet-4-20250514"
            label: "Claude Sonnet 4 (Recommended)"
          - value: "claude-haiku-4-20250514"
            label: "Claude Haiku 4 (Faster, Cheaper)"
          - value: "claude-opus-4-20250514"
            label: "Claude Opus 4 (Most Capable)"
        default: "claude-sonnet-4-20250514"
        
      - id: "openai_api_key"
        type: "secret"
        name: "OpenAI API Key"
        required: true
        visible_when:
          field: "llm.provider"
          equals: "openai"
          
      - id: "openai_model"
        type: "select"
        name: "OpenAI Model"
        visible_when:
          field: "llm.provider"
          equals: "openai"
        options:
          - value: "gpt-4o"
            label: "GPT-4o (Recommended)"
          - value: "gpt-4o-mini"
            label: "GPT-4o Mini (Cheaper)"
          - value: "gpt-4-turbo"
            label: "GPT-4 Turbo"
        default: "gpt-4o"
        
      - id: "temperature"
        type: "slider"
        name: "Temperature"
        description: "Higher = more creative, Lower = more focused"
        min: 0
        max: 1
        step: 0.1
        default: 0.7
        
      - id: "max_tokens"
        type: "number"
        name: "Max Response Tokens"
        description: "Maximum length of agent responses"
        default: 2048
        min: 256
        max: 8192

# =============================================================================
# SECTION 5: Prompts
# =============================================================================
  - id: "prompts"
    name: "Prompts"
    description: "Customize the agent's personality and behavior"
    icon: "message-square"
    
    fields:
      - id: "system_prompt"
        type: "prompt"
        name: "System Prompt"
        description: "Main instructions defining the agent's behavior"
        rows: 20
        
        variables:
          - name: "conference_name"
            description: "Name of the conference"
            source: "project.name"
            
          - name: "conference_dates"
            description: "Conference date range"
            source: "runtime"
            
          - name: "current_date"
            description: "Today's date"
            source: "system.date"
            
          - name: "current_time"
            description: "Current time"
            source: "system.time"
            
          - name: "attendee_count"
            description: "Number of registered attendees"
            source: "runtime"
            
          - name: "session_count"
            description: "Number of sessions"
            source: "runtime"
            
          - name: "exhibitor_count"
            description: "Number of exhibitors"
            source: "runtime"
            
        default: |
          You are Erleah, an AI conference assistant for {{conference_name}}.
          
          Conference dates: {{conference_dates}}
          Current date and time: {{current_date}} {{current_time}}
          
          Conference statistics:
          - {{attendee_count}} registered attendees
          - {{session_count}} sessions and talks
          - {{exhibitor_count}} exhibitors
          
          Your role is to help conference attendees:
          1. Find relevant sessions and talks matching their interests
          2. Connect with other attendees who share their professional goals
          3. Navigate the venue efficiently
          4. Build an optimized conference schedule
          5. Discover exhibitors relevant to their needs
          
          Guidelines:
          - Be helpful, concise, and proactive
          - When you can anticipate what the user might need next, suggest it
          - Use the user's interests and background to personalize recommendations
          - Consider time constraints and travel between locations
          - Be aware of session capacities and popularity
          
          Always maintain a friendly, professional tone appropriate for a business conference.
          
      - id: "greeting"
        type: "text"
        name: "Greeting Message"
        description: "First message shown to new users"
        rows: 3
        default: "Hi! I'm Erleah, your AI conference assistant. I can help you find sessions, connect with other attendees, and make the most of your conference experience. What would you like to explore?"
        
      - id: "fallback_message"
        type: "text"
        name: "Fallback Message"
        description: "Shown when the agent can't help with a request"
        rows: 2
        default: "I'm not sure I can help with that specific request, but I'd be happy to help you find sessions, connect with other attendees, or navigate the venue. What would be most useful?"

# =============================================================================
# SECTION 6: Advanced Settings
# =============================================================================
  - id: "advanced"
    name: "Advanced Settings"
    description: "Fine-tune agent behavior and performance"
    icon: "settings"
    collapsed: true
    
    fields:
      - id: "request_timeout"
        type: "number"
        name: "Request Timeout"
        description: "Maximum time for a single user request"
        default: 60
        min: 10
        max: 300
        unit: "seconds"
        
      - id: "max_iterations"
        type: "number"
        name: "Max Agent Iterations"
        description: "Maximum tool calls per request (prevents infinite loops)"
        default: 15
        min: 3
        max: 30
        
      - id: "parallel_tool_calls"
        type: "boolean"
        name: "Parallel Tool Calls"
        description: "Execute independent tool calls simultaneously"
        default: true
        
      - id: "cache_enabled"
        type: "boolean"
        name: "Enable Response Caching"
        description: "Cache frequent queries for faster responses"
        default: true
        
      - id: "cache_ttl"
        type: "number"
        name: "Cache TTL"
        description: "How long to cache responses"
        visible_when:
          field: "advanced.cache_enabled"
          equals: true
        default: 300
        unit: "seconds"
        
      - id: "rate_limit_per_user"
        type: "number"
        name: "Rate Limit per User"
        description: "Maximum requests per user per minute"
        default: 20
        min: 1
        max: 100
        
      - id: "logging_level"
        type: "select"
        name: "Logging Level"
        options:
          - value: "error"
            label: "Errors Only"
          - value: "warn"
            label: "Warnings & Errors"
          - value: "info"
            label: "Info (Recommended)"
          - value: "debug"
            label: "Debug (Verbose)"
        default: "info"
        
      - id: "metrics_enabled"
        type: "boolean"
        name: "Enable Metrics"
        description: "Collect usage and performance metrics"
        default: true

# =============================================================================
# DEBUG SCHEMA
# =============================================================================
debug:
  enabled: true
  
  event_types:
    - id: "request_start"
      name: "Request Started"
      fields:
        - id: "user_id"
          type: "string"
        - id: "message"
          type: "string"
        - id: "context"
          type: "object"
          expandable: true
          
    - id: "agent_step"
      name: "Agent Step"
      fields:
        - id: "step"
          type: "string"
          display: "badge"
          colors:
            understand: "#3B82F6"
            plan: "#8B5CF6"
            execute: "#F59E0B"
            reflect: "#06B6D4"
            respond: "#10B981"
            
        - id: "thought"
          type: "string"
          optional: true
          
        - id: "duration_ms"
          type: "number"
          format: "duration"
          
    - id: "tool_call"
      name: "Tool Execution"
      fields:
        - id: "tool"
          type: "string"
          display: "badge"
          color: "#F59E0B"
          
        - id: "args"
          type: "object"
          expandable: true
          
        - id: "result"
          type: "object"
          expandable: true
          
        - id: "result_count"
          type: "number"
          optional: true
          
        - id: "duration_ms"
          type: "number"
          format: "duration"
          
        - id: "cached"
          type: "boolean"
          optional: true
          
        - id: "error"
          type: "string"
          optional: true
          highlight: "error"
          
    - id: "llm_call"
      name: "LLM Call"
      fields:
        - id: "model"
          type: "string"
          
        - id: "prompt_tokens"
          type: "number"
          
        - id: "completion_tokens"
          type: "number"
          
        - id: "total_tokens"
          type: "number"
          
        - id: "cost_usd"
          type: "number"
          format: "currency"
          
        - id: "duration_ms"
          type: "number"
          format: "duration"
          
    - id: "request_end"
      name: "Request Completed"
      fields:
        - id: "status"
          type: "string"
          display: "badge"
          colors:
            success: "#10B981"
            error: "#EF4444"
            timeout: "#F59E0B"
            
        - id: "total_duration_ms"
          type: "number"
          format: "duration"
          
        - id: "tool_calls"
          type: "number"
          
        - id: "llm_calls"
          type: "number"
          
        - id: "total_tokens"
          type: "number"
          
        - id: "total_cost_usd"
          type: "number"
          format: "currency"
          
    - id: "error"
      name: "Error"
      fields:
        - id: "code"
          type: "string"
          highlight: "error"
          
        - id: "message"
          type: "string"
          highlight: "error"
          
        - id: "stack"
          type: "string"
          optional: true
          expandable: true
          
        - id: "recoverable"
          type: "boolean"
```

#### Acceptance Criteria

- [ ] Schema validates against UBA specification
- [ ] All 6 sections complete
- [ ] All relevant field types demonstrated
- [ ] Debug schema complete
- [ ] Variables defined for prompts
- [ ] Conditional visibility working

---

### UBA-024: Erleah Config Endpoint
**Effort:** 3 days  
**Assignee:** TBD  
**Branch:** `feature/uba-024-erleah-config`

#### Description

Implement the `/nodegx/config` endpoint in the Erleah Python backend to receive, validate, and apply configuration from Nodegx.

#### Files to Create/Modify

```
erleah/
├── api/
│   └── nodegx/
│       ├── __init__.py
│       ├── router.py
│       ├── config.py
│       └── models.py
├── config/
│   ├── loader.py
│   ├── validator.py
│   └── watcher.py
└── core/
    └── settings.py (update)
```

#### Implementation

```python
# erleah/api/nodegx/models.py
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from datetime import datetime

class ConfigMetadata(BaseModel):
    project_id: str
    project_name: str
    environment: str
    nodegx_version: str

class ConfigRequest(BaseModel):
    config: Dict[str, Any]
    metadata: ConfigMetadata

class ConfigWarning(BaseModel):
    field: str
    message: str
    code: str = "WARNING"

class ConfigError(BaseModel):
    field: str
    message: str
    code: str

class RuntimeValues(BaseModel):
    conference_dates: Optional[str] = None
    attendee_count: int = 0
    session_count: int = 0
    exhibitor_count: int = 0

class ConfigResponse(BaseModel):
    success: bool
    applied_at: str
    warnings: List[ConfigWarning] = []
    errors: List[ConfigError] = []
    runtime_values: Optional[RuntimeValues] = None


# erleah/api/nodegx/config.py
from fastapi import APIRouter, HTTPException, Depends
from .models import ConfigRequest, ConfigResponse, ConfigWarning, ConfigError, RuntimeValues
from erleah.config.loader import ConfigLoader
from erleah.config.validator import ConfigValidator
from erleah.core.settings import settings
from datetime import datetime
import asyncio

router = APIRouter(prefix="/nodegx", tags=["nodegx"])

config_loader = ConfigLoader()
config_validator = ConfigValidator()


@router.post("/config", response_model=ConfigResponse)
async def apply_config(request: ConfigRequest):
    """
    Receive and apply configuration from Nodegx.
    """
    config = request.config
    metadata = request.metadata
    
    warnings: List[ConfigWarning] = []
    errors: List[ConfigError] = []
    
    # Validate configuration
    validation_result = await config_validator.validate(config)
    
    if validation_result.errors:
        # Return validation errors without applying
        return ConfigResponse(
            success=False,
            applied_at=datetime.utcnow().isoformat() + "Z",
            errors=[
                ConfigError(field=e.field, message=e.message, code=e.code)
                for e in validation_result.errors
            ]
        )
    
    # Collect warnings
    for w in validation_result.warnings:
        warnings.append(ConfigWarning(field=w.field, message=w.message))
    
    # Apply configuration
    try:
        await config_loader.apply(config, metadata)
    except Exception as e:
        return ConfigResponse(
            success=False,
            applied_at=datetime.utcnow().isoformat() + "Z",
            errors=[ConfigError(field="", message=str(e), code="APPLY_FAILED")]
        )
    
    # Get runtime values
    runtime_values = await get_runtime_values(config)
    
    return ConfigResponse(
        success=True,
        applied_at=datetime.utcnow().isoformat() + "Z",
        warnings=warnings,
        runtime_values=runtime_values
    )


async def get_runtime_values(config: Dict[str, Any]) -> RuntimeValues:
    """
    Calculate runtime values based on current data.
    """
    from erleah.services.directus import DirectusService
    
    directus = DirectusService(config.get("data_sources", {}))
    
    # Get counts in parallel
    attendee_count, session_count, exhibitor_count = await asyncio.gather(
        directus.get_collection_count(config.get("data_sources", {}).get("attendee_collection")),
        directus.get_collection_count(config.get("data_sources", {}).get("session_collection")),
        directus.get_collection_count(config.get("data_sources", {}).get("exhibitor_collection")),
        return_exceptions=True
    )
    
    # Handle exceptions gracefully
    if isinstance(attendee_count, Exception):
        attendee_count = 0
    if isinstance(session_count, Exception):
        session_count = 0
    if isinstance(exhibitor_count, Exception):
        exhibitor_count = 0
    
    # Get conference dates from sessions
    conference_dates = await directus.get_conference_date_range()
    
    return RuntimeValues(
        conference_dates=conference_dates,
        attendee_count=attendee_count,
        session_count=session_count,
        exhibitor_count=exhibitor_count
    )


# erleah/config/loader.py
from typing import Dict, Any
import json
import asyncio
from pathlib import Path

class ConfigLoader:
    def __init__(self):
        self.config_path = Path("config/nodegx-config.json")
        self.current_config: Dict[str, Any] = {}
        self._subscribers: List[Callable] = []
    
    async def apply(self, config: Dict[str, Any], metadata: Dict[str, Any]):
        """
        Apply new configuration.
        """
        # Store config
        self.current_config = config
        
        # Persist to file (for restarts)
        self.config_path.parent.mkdir(exist_ok=True)
        with open(self.config_path, 'w') as f:
            json.dump({
                "config": config,
                "metadata": metadata,
                "applied_at": datetime.utcnow().isoformat()
            }, f, indent=2)
        
        # Notify subscribers (hot reload)
        await self._notify_subscribers()
    
    async def _notify_subscribers(self):
        """
        Notify all subscribers of config change.
        """
        for subscriber in self._subscribers:
            try:
                if asyncio.iscoroutinefunction(subscriber):
                    await subscriber(self.current_config)
                else:
                    subscriber(self.current_config)
            except Exception as e:
                logger.error(f"Config subscriber error: {e}")
    
    def subscribe(self, callback: Callable):
        """
        Subscribe to config changes.
        """
        self._subscribers.append(callback)
    
    def get(self, path: str, default: Any = None) -> Any:
        """
        Get config value by dot-notation path.
        """
        keys = path.split('.')
        value = self.current_config
        
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return default
        
        return value if value is not None else default


# erleah/config/validator.py
from typing import Dict, Any, List
from dataclasses import dataclass

@dataclass
class ValidationIssue:
    field: str
    message: str
    code: str = "VALIDATION_ERROR"

@dataclass
class ValidationResult:
    valid: bool
    errors: List[ValidationIssue]
    warnings: List[ValidationIssue]

class ConfigValidator:
    async def validate(self, config: Dict[str, Any]) -> ValidationResult:
        errors = []
        warnings = []
        
        # Validate data sources
        data_sources = config.get("data_sources", {})
        
        if not data_sources.get("primary_backend"):
            errors.append(ValidationIssue(
                field="data_sources.primary_backend",
                message="Primary backend is required",
                code="REQUIRED"
            ))
        
        if not data_sources.get("attendee_collection"):
            errors.append(ValidationIssue(
                field="data_sources.attendee_collection",
                message="Attendee collection is required",
                code="REQUIRED"
            ))
        
        # Validate field mappings
        attendee_mappings = data_sources.get("attendee_mappings", {})
        if not attendee_mappings.get("name"):
            errors.append(ValidationIssue(
                field="data_sources.attendee_mappings.name",
                message="Name field mapping is required",
                code="REQUIRED"
            ))
        
        if not attendee_mappings.get("bio"):
            warnings.append(ValidationIssue(
                field="data_sources.attendee_mappings.bio",
                message="Bio field not mapped - semantic search will be limited",
                code="RECOMMENDED"
            ))
        
        # Validate LLM config
        llm = config.get("llm", {})
        provider = llm.get("provider", "anthropic")
        
        if provider == "anthropic" and not llm.get("anthropic_api_key"):
            errors.append(ValidationIssue(
                field="llm.anthropic_api_key",
                message="Anthropic API key is required",
                code="REQUIRED"
            ))
        elif provider == "openai" and not llm.get("openai_api_key"):
            errors.append(ValidationIssue(
                field="llm.openai_api_key",
                message="OpenAI API key is required",
                code="REQUIRED"
            ))
        
        # Validate vector DB
        vector_db = config.get("vector_db", {})
        if not vector_db.get("qdrant_url"):
            errors.append(ValidationIssue(
                field="vector_db.qdrant_url",
                message="Qdrant URL is required",
                code="REQUIRED"
            ))
        
        # Check tool dependencies
        tools = config.get("tools", {})
        if tools.get("proximity_search", {}).get("enabled"):
            if not attendee_mappings.get("location"):
                warnings.append(ValidationIssue(
                    field="tools.proximity_search",
                    message="Proximity search enabled but location field not mapped",
                    code="DEPENDENCY"
                ))
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
```

#### Acceptance Criteria

- [ ] Config endpoint receives configuration
- [ ] Validation returns errors/warnings
- [ ] Config persisted to file
- [ ] Hot reload notifies subscribers
- [ ] Runtime values calculated
- [ ] Error handling comprehensive

---

### UBA-025: Erleah Debug Stream
**Effort:** 4 days  
**Assignee:** TBD  
**Branch:** `feature/uba-025-erleah-debug`

#### Description

Implement the debug streaming endpoint that sends real-time agent execution events to Nodegx.

#### Implementation

```python
# erleah/api/nodegx/debug.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
import asyncio
import json
from datetime import datetime
from erleah.debug.emitter import DebugEmitter, DebugEvent

router = APIRouter(prefix="/nodegx", tags=["nodegx"])

# Global debug emitter
debug_emitter = DebugEmitter()


@router.websocket("/debug")
async def debug_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for debug events.
    """
    # Verify token from query params
    token = websocket.query_params.get("token")
    if not verify_nodegx_token(token):
        await websocket.close(code=4001, reason="Unauthorized")
        return
    
    await websocket.accept()
    
    # Subscribe to debug events
    queue: asyncio.Queue[DebugEvent] = asyncio.Queue(maxsize=100)
    
    async def event_handler(event: DebugEvent):
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            # Drop oldest event if queue is full
            try:
                queue.get_nowait()
                queue.put_nowait(event)
            except asyncio.QueueEmpty:
                pass
    
    subscription_id = debug_emitter.subscribe(event_handler)
    
    try:
        while True:
            event = await queue.get()
            await websocket.send_json(event.to_dict())
    except WebSocketDisconnect:
        pass
    finally:
        debug_emitter.unsubscribe(subscription_id)


@router.get("/debug")
async def debug_sse():
    """
    SSE endpoint for debug events (fallback for browsers without WebSocket).
    """
    async def event_generator() -> AsyncGenerator[str, None]:
        queue: asyncio.Queue[DebugEvent] = asyncio.Queue(maxsize=100)
        
        async def event_handler(event: DebugEvent):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass
        
        subscription_id = debug_emitter.subscribe(event_handler)
        
        try:
            while True:
                event = await queue.get()
                yield f"event: {event.type}\ndata: {json.dumps(event.to_dict())}\n\n"
        finally:
            debug_emitter.unsubscribe(subscription_id)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


# erleah/debug/emitter.py
from typing import Dict, Any, Callable, List
from dataclasses import dataclass, field
from datetime import datetime
import uuid
import asyncio

@dataclass
class DebugEvent:
    type: str
    data: Dict[str, Any]
    request_id: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "request_id": self.request_id,
            "type": self.type,
            "data": self.data
        }


class DebugEmitter:
    def __init__(self):
        self._subscribers: Dict[str, Callable] = {}
        self._enabled = True
    
    def subscribe(self, handler: Callable[[DebugEvent], None]) -> str:
        subscription_id = str(uuid.uuid4())
        self._subscribers[subscription_id] = handler
        return subscription_id
    
    def unsubscribe(self, subscription_id: str):
        self._subscribers.pop(subscription_id, None)
    
    async def emit(self, event_type: str, data: Dict[str, Any], request_id: str):
        if not self._enabled or not self._subscribers:
            return
        
        event = DebugEvent(type=event_type, data=data, request_id=request_id)
        
        for handler in self._subscribers.values():
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event)
                else:
                    handler(event)
            except Exception as e:
                # Don't let debug errors affect agent operation
                pass
    
    def enable(self):
        self._enabled = True
    
    def disable(self):
        self._enabled = False


# erleah/debug/context.py
from contextvars import ContextVar
from typing import Optional
import uuid

# Context variable for current request ID
current_request_id: ContextVar[Optional[str]] = ContextVar('request_id', default=None)

def get_request_id() -> str:
    return current_request_id.get() or str(uuid.uuid4())

def set_request_id(request_id: str):
    current_request_id.set(request_id)


# Integration with LangGraph agent
# erleah/agent/instrumented.py
from erleah.debug.emitter import debug_emitter
from erleah.debug.context import get_request_id
import time

class InstrumentedAgent:
    """
    Wrapper that adds debug instrumentation to the agent.
    """
    
    def __init__(self, agent):
        self.agent = agent
    
    async def run(self, message: str, user_context: Dict[str, Any]) -> str:
        request_id = get_request_id()
        start_time = time.time()
        
        # Emit request start
        await debug_emitter.emit("request_start", {
            "user_id": user_context.get("user_id"),
            "message": message,
            "context": user_context
        }, request_id)
        
        total_tokens = 0
        total_cost = 0
        tool_calls = 0
        llm_calls = 0
        
        try:
            # Run agent with step callbacks
            result = await self.agent.run(
                message,
                user_context,
                callbacks={
                    "on_step": lambda step, data: self._on_step(request_id, step, data),
                    "on_tool": lambda tool, args, result, duration: self._on_tool(
                        request_id, tool, args, result, duration
                    ),
                    "on_llm": lambda model, tokens, cost, duration: self._on_llm(
                        request_id, model, tokens, cost, duration
                    )
                }
            )
            
            # Emit request end
            await debug_emitter.emit("request_end", {
                "status": "success",
                "total_duration_ms": int((time.time() - start_time) * 1000),
                "tool_calls": tool_calls,
                "llm_calls": llm_calls,
                "total_tokens": total_tokens,
                "total_cost_usd": total_cost
            }, request_id)
            
            return result
            
        except Exception as e:
            await debug_emitter.emit("error", {
                "code": type(e).__name__,
                "message": str(e),
                "recoverable": False
            }, request_id)
            
            await debug_emitter.emit("request_end", {
                "status": "error",
                "total_duration_ms": int((time.time() - start_time) * 1000),
                "tool_calls": tool_calls,
                "llm_calls": llm_calls
            }, request_id)
            
            raise
    
    async def _on_step(self, request_id: str, step: str, data: Dict[str, Any]):
        await debug_emitter.emit("agent_step", {
            "step": step,
            "thought": data.get("thought"),
            "duration_ms": data.get("duration_ms", 0)
        }, request_id)
    
    async def _on_tool(self, request_id: str, tool: str, args: Dict, result: Any, duration_ms: int):
        nonlocal tool_calls
        tool_calls += 1
        
        await debug_emitter.emit("tool_call", {
            "tool": tool,
            "args": args,
            "result": self._summarize_result(result),
            "result_count": len(result) if isinstance(result, list) else None,
            "duration_ms": duration_ms,
            "cached": False
        }, request_id)
    
    async def _on_llm(self, request_id: str, model: str, tokens: Dict, cost: float, duration_ms: int):
        nonlocal llm_calls, total_tokens, total_cost
        llm_calls += 1
        total_tokens += tokens.get("total", 0)
        total_cost += cost
        
        await debug_emitter.emit("llm_call", {
            "model": model,
            "prompt_tokens": tokens.get("prompt", 0),
            "completion_tokens": tokens.get("completion", 0),
            "total_tokens": tokens.get("total", 0),
            "cost_usd": cost,
            "duration_ms": duration_ms
        }, request_id)
    
    def _summarize_result(self, result: Any) -> Any:
        """
        Summarize large results to avoid overwhelming the debug stream.
        """
        if isinstance(result, list) and len(result) > 5:
            return {
                "_summary": True,
                "count": len(result),
                "first_3": result[:3],
                "truncated": True
            }
        return result
```

#### Acceptance Criteria

- [ ] WebSocket endpoint works
- [ ] SSE fallback works
- [ ] Events emitted for all agent steps
- [ ] Tool calls tracked
- [ ] LLM calls tracked
- [ ] Request start/end events
- [ ] Error events
- [ ] No performance impact when no subscribers

---

### UBA-026: Erleah Schema Endpoint
**Effort:** 1 day  
**Assignee:** TBD  
**Branch:** `feature/uba-026-erleah-schema-endpoint`

#### Description

Serve the Erleah schema at the well-known URL with proper caching headers.

#### Implementation

```python
# erleah/api/nodegx/schema.py
from fastapi import APIRouter
from fastapi.responses import FileResponse, Response
from pathlib import Path
import hashlib

router = APIRouter(tags=["nodegx"])

SCHEMA_PATH = Path(__file__).parent.parent.parent / "nodegx-schema.yaml"


@router.get("/.well-known/nodegx-schema.yaml")
async def get_schema():
    """
    Serve the Nodegx configuration schema.
    """
    if not SCHEMA_PATH.exists():
        return Response(status_code=404, content="Schema not found")
    
    # Calculate ETag from file content
    content = SCHEMA_PATH.read_bytes()
    etag = hashlib.md5(content).hexdigest()
    
    return Response(
        content=content,
        media_type="application/x-yaml",
        headers={
            "Cache-Control": "public, max-age=3600",
            "ETag": f'"{etag}"'
        }
    )
```

---

### UBA-027: End-to-End Testing
**Effort:** 3 days  
**Assignee:** TBD  
**Branch:** `feature/uba-027-e2e-testing`

#### Description

Create comprehensive integration tests for the full Erleah + Nodegx UBA flow.

#### Test Scenarios

```python
# tests/integration/test_uba_integration.py
import pytest
from httpx import AsyncClient
from erleah.main import app

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


class TestSchemaEndpoint:
    async def test_schema_returned(self, client):
        response = await client.get("/.well-known/nodegx-schema.yaml")
        assert response.status_code == 200
        assert "schema_version" in response.text
        assert response.headers["content-type"] == "application/x-yaml"
    
    async def test_schema_has_etag(self, client):
        response = await client.get("/.well-known/nodegx-schema.yaml")
        assert "etag" in response.headers
    
    async def test_schema_caching(self, client):
        response1 = await client.get("/.well-known/nodegx-schema.yaml")
        etag = response1.headers["etag"]
        
        response2 = await client.get(
            "/.well-known/nodegx-schema.yaml",
            headers={"If-None-Match": etag}
        )
        assert response2.status_code == 304


class TestConfigEndpoint:
    async def test_valid_config_applied(self, client):
        config = {
            "config": {
                "data_sources": {
                    "primary_backend": "backend_123",
                    "attendee_collection": "attendees",
                    "attendee_mappings": {
                        "name": "full_name",
                        "email": "email_address",
                        "bio": "biography"
                    }
                },
                "vector_db": {
                    "qdrant_url": "http://localhost:6333"
                },
                "llm": {
                    "provider": "anthropic",
                    "anthropic_api_key": "test-key"
                }
            },
            "metadata": {
                "project_id": "proj_123",
                "project_name": "Test Conference",
                "environment": "development",
                "nodegx_version": "2.0.0"
            }
        }
        
        response = await client.post("/nodegx/config", json=config)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "applied_at" in data
        assert "runtime_values" in data
    
    async def test_invalid_config_rejected(self, client):
        config = {
            "config": {
                "data_sources": {}  # Missing required fields
            },
            "metadata": {
                "project_id": "proj_123",
                "project_name": "Test",
                "environment": "development",
                "nodegx_version": "2.0.0"
            }
        }
        
        response = await client.post("/nodegx/config", json=config)
        data = response.json()
        
        assert data["success"] is False
        assert len(data["errors"]) > 0
    
    async def test_config_returns_warnings(self, client):
        config = {
            "config": {
                "data_sources": {
                    "primary_backend": "backend_123",
                    "attendee_collection": "attendees",
                    "attendee_mappings": {
                        "name": "full_name",
                        "email": "email_address"
                        # Missing bio - should warn
                    }
                },
                "vector_db": {
                    "qdrant_url": "http://localhost:6333"
                },
                "llm": {
                    "provider": "anthropic",
                    "anthropic_api_key": "test-key"
                }
            },
            "metadata": {
                "project_id": "proj_123",
                "project_name": "Test",
                "environment": "development",
                "nodegx_version": "2.0.0"
            }
        }
        
        response = await client.post("/nodegx/config", json=config)
        data = response.json()
        
        assert data["success"] is True
        assert len(data["warnings"]) > 0
        assert any("bio" in w["field"] for w in data["warnings"])


class TestHealthEndpoint:
    async def test_health_check(self, client):
        response = await client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert "version" in data


class TestDebugStream:
    async def test_websocket_connects(self, client):
        # This would use websocket testing utilities
        pass
    
    async def test_events_streamed(self, client):
        # Test that agent events appear in stream
        pass
```

#### Acceptance Criteria

- [ ] Schema endpoint tests pass
- [ ] Config endpoint tests pass
- [ ] Health endpoint tests pass
- [ ] Debug stream tests pass
- [ ] Error cases covered
- [ ] Performance tests pass

---

### UBA-028: Erleah Documentation
**Effort:** 2 days  
**Assignee:** TBD  
**Branch:** `feature/uba-028-erleah-docs`

#### Description

Create Erleah-specific documentation for setup and usage.

#### Documentation Structure

```
docs/erleah/
├── README.md              # Overview
├── setup.md               # Installation and setup
├── configuration.md       # All config options explained
├── tools.md               # Agent tools reference
├── debugging.md           # Using the debug panel
└── troubleshooting.md     # Common issues
```

#### Key Content

```markdown
# Erleah AI Agent - Setup Guide

## Prerequisites

- Python 3.11+
- Qdrant (local or cloud)
- Directus or Supabase with conference data
- Anthropic or OpenAI API key

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/visualhive/erleah.git
cd erleah
pip install -r requirements.txt
```

### 2. Start the Server

```bash
uvicorn erleah.main:app --host 0.0.0.0 --port 8000
```

### 3. Connect from Nodegx

1. Open your Nodegx project
2. Go to Backend Services
3. Click "Add Backend" → "Schema-Configured Backend"
4. Enter: `http://localhost:8000`
5. Configure your data sources and API keys

## Configuration Reference

### Data Sources

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| primary_backend | backend_reference | Yes | Your Directus/Supabase instance |
| attendee_collection | string | Yes | Collection containing attendees |
| attendee_mappings | field_mapping | Yes | Map your fields to Erleah format |

[Full reference →](./configuration.md)

## Troubleshooting

### "Backend unreachable"

1. Ensure the Erleah server is running
2. Check the URL is correct
3. Verify no firewall blocking

### "Semantic search not working"

1. Check Qdrant is running and accessible
2. Verify embedding API key is set
3. Check if indexing completed
```

---

## Phase 6E Checklist

### UBA-023: Erleah Schema
- [ ] Complete schema file
- [ ] All sections defined
- [ ] Debug schema complete
- [ ] Schema validates

### UBA-024: Config Endpoint
- [ ] Endpoint implemented
- [ ] Validation working
- [ ] Config persisted
- [ ] Hot reload working
- [ ] Runtime values returned

### UBA-025: Debug Stream
- [ ] WebSocket endpoint
- [ ] SSE fallback
- [ ] Agent instrumentation
- [ ] All event types

### UBA-026: Schema Endpoint
- [ ] Endpoint implemented
- [ ] ETag caching
- [ ] Proper headers

### UBA-027: E2E Testing
- [ ] Schema tests
- [ ] Config tests
- [ ] Health tests
- [ ] Debug tests

### UBA-028: Documentation
- [ ] Setup guide
- [ ] Configuration reference
- [ ] Troubleshooting

---

## Success Criteria

- [ ] Full UBA integration working
- [ ] Debug panel shows real agent execution
- [ ] Configuration changes apply in real-time
- [ ] Documentation enables self-service setup
