# TASK-006: Authentication Nodes

**Task ID:** TASK-006  
**Phase:** 5 - Multi-Target Deployment (BYOB)  
**Priority:** 🔴 Critical  
**Difficulty:** 🟡 Medium  
**Estimated Time:** 1 week  
**Prerequisites:** TASK-001 (Backend Services Panel), TASK-002 (Data Nodes)  
**Branch:** `feature/byob-auth-nodes`

## Objective

Create authentication nodes (Sign Up, Log In, Log Out) for BYOB backends, starting with Directus support.

## Background

The BYOB data nodes (TASK-002) enable full CRUD operations, but users cannot build real applications without authentication. This task adds the missing authentication layer, enabling:

- User registration (Sign Up)
- User authentication (Log In)
- Session management (Log Out)
- Secure token storage

Without these nodes, users would need to manually construct auth requests using HTTP nodes, which is error-prone and insecure.

## User Story

> As a Noodl user, I want to authenticate users against my Directus backend, so I can build secure applications with proper user management.

## Current State

- BYOB data nodes work but require manual token management
- No built-in authentication nodes for BYOB backends
- Existing auth nodes only work with Noodl Cloud (deprecated)

## Desired State

- Sign Up node for user registration
- Log In node for authentication
- Log Out node for session cleanup
- Secure token storage mechanism
- Seamless integration with existing BYOB data nodes

## Scope

### In Scope

- **Sign Up Node** - Register new users
- **Log In Node** - Authenticate existing users
- **Log Out Node** - End user session
- **Token Management** - Secure storage and auto-injection into requests
- **Directus Support** - Primary authentication provider

### Out of Scope

- OAuth/Social login (future enhancement)
- Multi-factor authentication (future enhancement)
- Password reset UI (can use existing Directus endpoints)
- Supabase/Appwrite auth adapters (future task)
- Role-based access control UI (use Query Data with directus_roles)

---

## Node Specifications

### 1. Sign Up Node

**Purpose:** Register a new user account

#### Inputs

| Input      | Type     | Description                        |
| ---------- | -------- | ---------------------------------- |
| Backend    | dropdown | Select backend (or Active Backend) |
| Email      | string   | User's email address               |
| Password   | string   | User's password                    |
| First Name | string   | Optional first name                |
| Last Name  | string   | Optional last name                 |
| Role       | dropdown | Optional role assignment           |
| Sign Up    | signal   | Trigger registration               |

#### Outputs

| Output  | Type   | Description                |
| ------- | ------ | -------------------------- |
| User    | object | Created user object        |
| User ID | string | ID of created user         |
| Success | signal | Fires on successful signup |
| Failed  | signal | Fires on error             |
| Error   | object | Error details              |

#### API Call (Directus)

```
POST /users
Body: {
  email: "user@example.com",
  password: "secure-password",
  first_name: "John",
  last_name: "Doe",
  role: "role-uuid"
}
```

**Note:** User registration in Directus typically requires admin permissions. For public registration, use Directus's public registration endpoint or configure appropriate permissions.

---

### 2. Log In Node

**Purpose:** Authenticate a user and store access tokens

#### Inputs

| Input    | Type     | Description                        |
| -------- | -------- | ---------------------------------- |
| Backend  | dropdown | Select backend (or Active Backend) |
| Email    | string   | User's email                       |
| Password | string   | User's password                    |
| Log In   | signal   | Trigger authentication             |

#### Outputs

| Output        | Type   | Description                         |
| ------------- | ------ | ----------------------------------- |
| Access Token  | string | JWT access token (handle securely!) |
| Refresh Token | string | Token for refreshing access         |
| Expires       | number | Token expiration time (ms)          |
| User          | object | Authenticated user object           |
| Success       | signal | Fires on successful login           |
| Failed        | signal | Fires on error                      |
| Error         | object | Error details                       |

#### API Call (Directus)

```
POST /auth/login
Body: {
  email: "user@example.com",
  password: "password"
}

Response: {
  data: {
    access_token: "eyJhbGc...",
    refresh_token: "eyJhbGc...",
    expires: 900000
  }
}
```

#### Token Storage Strategy

**Critical Security Consideration:** Where to store tokens?

**Options:**

1. **Runtime Memory** (Default - Most Secure)

   - ✅ Cleared on app refresh
   - ✅ Not accessible to XSS attacks
   - ❌ Lost on page reload

2. **Session Storage** (Balanced)

   - ✅ Cleared on tab close
   - ✅ Reasonably secure
   - ❌ Lost on tab close

3. **Local Storage** (Least Secure)

   - ✅ Persists across sessions
   - ❌ Vulnerable to XSS
   - ❌ Not recommended for production

4. **Electron Secure Storage** (Best for Desktop)
   - ✅ OS-level encryption
   - ✅ Persistent and secure
   - ✅ Ideal for Noodl desktop apps
   - ❌ Not available in web viewer

**Recommended Approach:**

- Desktop apps → Electron `safeStorage` API
- Web apps → Session Storage with "Remember Me" option for Local Storage
- Always clear sensitive data from node outputs after use

---

### 3. Log Out Node

**Purpose:** End user session and clear stored tokens

#### Inputs

| Input         | Type     | Description                        |
| ------------- | -------- | ---------------------------------- |
| Backend       | dropdown | Select backend (or Active Backend) |
| Refresh Token | string   | Token to invalidate (optional)     |
| Log Out       | signal   | Trigger logout                     |

#### Outputs

| Output  | Type   | Description      |
| ------- | ------ | ---------------- |
| Success | signal | Fires on success |
| Failed  | signal | Fires on error   |
| Error   | object | Error details    |

#### API Call (Directus)

```
POST /auth/logout
Body: {
  refresh_token: "eyJhbGc..."
}
```

#### Cleanup Actions

1. Clear stored access token
2. Clear stored refresh token
3. Clear user session data
4. Optionally redirect to login page

---

## Token Auto-Injection

### Problem

After logging in, every data node (Query, Create, Update, Delete) needs the access token. Manual token management is tedious.

### Solution

Enhance `byob-utils.js` to check for stored auth token:

```javascript
function resolveBackend(backendId) {
  const backendConfig = /* ... resolve from metadata ... */;

  // Check for stored auth token
  const storedToken = getStoredAuthToken(backendId);
  if (storedToken) {
    backendConfig.token = storedToken;
  }

  return backendConfig;
}

function getStoredAuthToken(backendId) {
  // Check runtime memory first
  if (window.__noodlAuthTokens && window.__noodlAuthTokens[backendId]) {
    return window.__noodlAuthTokens[backendId];
  }

  // Fall back to session storage
  const stored = sessionStorage.getItem(`noodl_auth_${backendId}`);
  if (stored) {
    try {
      const { token, expires } = JSON.parse(stored);
      if (Date.now() < expires) {
        return token;
      }
    } catch (e) {
      // Invalid stored data
    }
  }

  return null;
}
```

This way, once a user logs in, all subsequent data node requests automatically include the auth token.

---

## Implementation Plan

### Phase 1: Core Authentication (Week 1)

1. **Create Auth Utility Module** (`byob-auth-utils.js`)

   - Token storage functions
   - Token validation
   - Auto-injection logic

2. **Implement Log In Node** (`byob-login.js`)

   - Most critical - enables testing
   - Store tokens securely
   - Output user object

3. **Implement Log Out Node** (`byob-logout.js`)

   - Clear stored tokens
   - Invalidate refresh token

4. **Enhance BYOB Utils**

   - Integrate token auto-injection
   - Update `resolveBackend()` to check stored tokens

5. **Testing**
   - Manual testing with real Directus instance
   - Verify token storage and auto-injection
   - Test logout cleanup

### Phase 2: User Registration (Week 1)

6. **Implement Sign Up Node** (`byob-signup.js`)
   - User creation
   - Optional auto-login after signup

### Phase 3: Documentation & Polish (Week 1)

7. **Documentation**

   - Update BYOB guide with auth examples
   - Security best practices
   - Token management guide

8. **Example Project**
   - Login/signup form
   - Protected routes
   - User dashboard

---

## Security Considerations

### ⚠️ Critical Security Rules

1. **Never Log Tokens**

   - Don't `console.log()` access tokens
   - Don't expose tokens in inspect data
   - Clear from outputs after use

2. **Use HTTPS Only**

   - Never send tokens over HTTP
   - Validate SSL certificates

3. **Token Expiration**

   - Respect token expiry times
   - Implement token refresh logic (future enhancement)

4. **Input Validation**

   - Validate email format
   - Enforce password strength (backend responsibility)
   - Sanitize all user inputs

5. **Error Messages**
   - Don't leak sensitive info in error messages
   - Generic errors for auth failures ("Invalid credentials")

---

## Testing Checklist

### Manual Testing

- [ ] Sign up new user
- [ ] Log in with valid credentials
- [ ] Log in with invalid credentials
- [ ] Token auto-injection works in Query Data node
- [ ] Log out clears tokens
- [ ] Token persists across page reload (if configured)
- [ ] Expired tokens are handled gracefully

### Edge Cases

- [ ] Duplicate email during signup
- [ ] Weak password validation
- [ ] Network errors during auth
- [ ] Concurrent login attempts
- [ ] Token storage quota exceeded

---

## Future Enhancements

### Phase 2 Features

- **Token Refresh Node** - Automatically refresh expired tokens
- **Current User Node** - Get currently logged-in user details
- **Password Reset Nodes** - Request and confirm password resets
- **Email Verification** - Send and verify email confirmation

### Phase 3 Features

- **OAuth/Social Login** - Google, GitHub, etc.
- **Multi-Factor Authentication** - TOTP support
- **Session Management** - View/revoke active sessions
- **Backend-Agnostic** - Supabase, Appwrite, custom APIs

---

## Success Criteria

- [ ] Users can sign up for new accounts
- [ ] Users can log in and receive tokens
- [ ] Tokens are stored securely
- [ ] Data nodes automatically use stored tokens
- [ ] Users can log out and clear session
- [ ] No security vulnerabilities
- [ ] Documentation complete
- [ ] Example project demonstrates usage

---

## Related Tasks

- **TASK-001:** Backend Services Panel (provides backend configuration)
- **TASK-002:** Data Nodes (consumes auth tokens)
- **TASK-007:** Token Refresh & Session Management (future)
- **TASK-008:** OAuth/Social Login Support (future)
