# TASK-007G: Authentication System

## Overview

Implement a complete authentication system for the local backend, including user management, session handling, and frontend nodes that mirror the existing Parse auth nodes, ensuring backward compatibility for existing projects.

**Parent Task:** TASK-007 (Integrated Local Backend)
**Phase:** G (Authentication)
**Effort:** 10-14 hours
**Priority:** HIGH
**Depends On:** TASK-007A (LocalSQL Adapter), TASK-007B (Backend Server)

---

## Objectives

1. Implement secure user storage with password hashing (bcrypt)
2. Create authentication endpoints (signup, login, logout, session validation)
3. Implement JWT-based session management
4. Build frontend auth nodes (Sign Up, Log In, Log Out, Current User, Update User)
5. Add user context injection to all authenticated requests
6. Support optional ACL (Access Control List) for record-level permissions
7. Maintain API compatibility with existing Parse auth nodes

---

## Architecture

### Auth Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (Viewer)                              │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Sign Up Node │  │ Log In Node  │  │ Log Out Node │  │ Current User   │  │
│  │              │  │              │  │              │  │ Node           │  │
│  │ email ────┐  │  │ email ────┐  │  │              │  │                │  │
│  │ password ─┼──│──│ password ─┼──│──│ ──────────┐  │  │ ┌─→ user       │  │
│  │           │  │  │           │  │  │           │  │  │ │   isLoggedIn │  │
│  │ success ←─┘  │  │ success ←─┘  │  │ success ←─┘  │  │ │              │  │
│  │ failure     │  │ failure     │  │ failure      │  │ └───────────────┘  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                      │
│         │                 │                 │                              │
└─────────┼─────────────────┼─────────────────┼──────────────────────────────┘
          │                 │                 │
          ↓                 ↓                 ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Local Backend Server                              │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Auth Middleware                                 │ │
│  │  • Extract JWT from Authorization header                                │ │
│  │  • Validate token, attach user to request                               │ │
│  │  • Pass through for public routes                                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐            │
│         ↓                          ↓                          ↓            │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────────┐     │
│  │ POST        │          │ POST        │          │ POST            │     │
│  │ /auth/signup│          │ /auth/login │          │ /auth/logout    │     │
│  │             │          │             │          │                 │     │
│  │ • Validate  │          │ • Find user │          │ • Invalidate    │     │
│  │ • Hash pwd  │          │ • Verify pwd│          │   session       │     │
│  │ • Create    │          │ • Issue JWT │          │ • Clear token   │     │
│  │ • Issue JWT │          │ • Return    │          │                 │     │
│  └─────────────┘          └─────────────┘          └─────────────────┘     │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          _User Table                                    │ │
│  │  objectId | email | passwordHash | username | sessionToken | ...       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Token Flow

```
1. Sign Up / Log In
   Client ──POST /auth/login──→ Server
   Client ←── { user, token } ── Server

2. Store Token
   Client stores token in localStorage/memory

3. Authenticated Requests
   Client ──GET /api/todos──→ Server
           Authorization: Bearer <token>
   Server validates token, attaches user context
   Server ←── { results } ── Client

4. Token Refresh (optional)
   Client ──POST /auth/refresh──→ Server
   Client ←── { token } ────────── Server
```

---

## Implementation Steps

### Step 1: User Schema and Password Utilities (2 hours)

**File:** `packages/noodl-editor/src/main/src/local-backend/auth/password-utils.ts`

```typescript
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a secure random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a password reset token (shorter-lived)
 */
export function generateResetToken(): string {
  return crypto.randomBytes(20).toString('hex');
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  // Optional: Add more rules as needed
  // if (!/[A-Z]/.test(password)) errors.push('Must contain uppercase letter');
  // if (!/[a-z]/.test(password)) errors.push('Must contain lowercase letter');
  // if (!/[0-9]/.test(password)) errors.push('Must contain a number');

  return { valid: errors.length === 0, errors };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

**File:** `packages/noodl-editor/src/main/src/local-backend/auth/jwt-utils.ts`

```typescript
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';

// Secret key management
let JWT_SECRET: string;

/**
 * Get or create JWT secret for this installation
 */
export function getJWTSecret(backendsPath: string): string {
  if (JWT_SECRET) return JWT_SECRET;

  const secretPath = path.join(backendsPath, '.jwt-secret');

  try {
    JWT_SECRET = fs.readFileSync(secretPath, 'utf-8').trim();
  } catch (e) {
    // Generate new secret
    JWT_SECRET = crypto.randomBytes(64).toString('hex');
    fs.writeFileSync(secretPath, JWT_SECRET, { mode: 0o600 });
  }

  return JWT_SECRET;
}

export interface TokenPayload {
  userId: string;
  email: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token
 */
export function generateToken(
  payload: Omit<TokenPayload, 'iat' | 'exp'>,
  secret: string,
  expiresIn: string = '7d'
): string {
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string, secret: string): TokenPayload | null {
  try {
    return jwt.verify(token, secret) as TokenPayload;
  } catch (e) {
    return null;
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch (e) {
    return null;
  }
}
```

**File:** `packages/noodl-editor/src/main/src/local-backend/auth/user-schema.ts`

```typescript
import type { TableSchema } from '@noodl/runtime/src/api/adapters/cloudstore-adapter';

/**
 * Built-in _User table schema
 */
export const UserTableSchema: TableSchema = {
  name: '_User',
  columns: [
    { name: 'email', type: 'String', required: true },
    { name: 'username', type: 'String', required: false },
    { name: 'passwordHash', type: 'String', required: true },
    { name: 'emailVerified', type: 'Boolean', required: false },
    { name: 'sessionToken', type: 'String', required: false },
    { name: 'lastLogin', type: 'Date', required: false },
    { name: 'resetToken', type: 'String', required: false },
    { name: 'resetTokenExpiry', type: 'Date', required: false }
    // Custom fields can be added dynamically
  ]
};

/**
 * Built-in _Session table schema (for session tracking/invalidation)
 */
export const SessionTableSchema: TableSchema = {
  name: '_Session',
  columns: [
    { name: 'userId', type: 'Pointer', targetClass: '_User', required: true },
    { name: 'token', type: 'String', required: true },
    { name: 'expiresAt', type: 'Date', required: true },
    { name: 'deviceInfo', type: 'String', required: false },
    { name: 'ipAddress', type: 'String', required: false }
  ]
};

/**
 * Sanitize user object for client response (remove sensitive fields)
 */
export function sanitizeUser(user: any): any {
  if (!user) return null;

  const { passwordHash, resetToken, resetTokenExpiry, sessionToken, ...safeUser } = user;
  return safeUser;
}
```

---

### Step 2: Auth Routes (3 hours)

**File:** `packages/noodl-editor/src/main/src/local-backend/auth/auth-routes.ts`

```typescript
import { Router, Request, Response } from 'express';
import { LocalSQLAdapter } from '@noodl/runtime/src/api/adapters/local-sql/LocalSQLAdapter';

import { generateToken, verifyToken, getJWTSecret } from './jwt-utils';
import { hashPassword, verifyPassword, generateSessionToken, validatePassword, validateEmail } from './password-utils';
import { UserTableSchema, SessionTableSchema, sanitizeUser } from './user-schema';

export function createAuthRouter(adapter: LocalSQLAdapter, backendsPath: string): Router {
  const router = Router();
  const jwtSecret = getJWTSecret(backendsPath);

  // Ensure auth tables exist
  ensureAuthTables(adapter);

  /**
   * POST /auth/signup
   * Create a new user account
   */
  router.post('/signup', async (req: Request, res: Response) => {
    try {
      const { email, password, username, ...customFields } = req.body;

      // Validate email
      if (!email || !validateEmail(email)) {
        return res.status(400).json({
          error: 'Invalid email address',
          code: 'INVALID_EMAIL'
        });
      }

      // Validate password
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          error: passwordValidation.errors.join(', '),
          code: 'WEAK_PASSWORD'
        });
      }

      // Check if email already exists
      const existing = await adapter.query({
        collection: '_User',
        where: { email: { equalTo: email.toLowerCase() } },
        limit: 1
      });

      if (existing.results.length > 0) {
        return res.status(400).json({
          error: 'An account with this email already exists',
          code: 'EMAIL_EXISTS'
        });
      }

      // Check if username already exists (if provided)
      if (username) {
        const existingUsername = await adapter.query({
          collection: '_User',
          where: { username: { equalTo: username } },
          limit: 1
        });

        if (existingUsername.results.length > 0) {
          return res.status(400).json({
            error: 'This username is already taken',
            code: 'USERNAME_EXISTS'
          });
        }
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const user = await adapter.create({
        collection: '_User',
        data: {
          email: email.toLowerCase(),
          username: username || null,
          passwordHash,
          emailVerified: false,
          lastLogin: new Date().toISOString(),
          ...customFields
        }
      });

      // Generate session token
      const sessionId = generateSessionToken();
      const token = generateToken({ userId: user.objectId, email: user.email, sessionId }, jwtSecret);

      // Store session
      await adapter.create({
        collection: '_Session',
        data: {
          userId: user.objectId,
          token: sessionId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          ipAddress: req.ip
        }
      });

      // Update user's session token
      await adapter.save({
        collection: '_User',
        objectId: user.objectId,
        data: { sessionToken: sessionId }
      });

      res.status(201).json({
        user: sanitizeUser(user),
        token
      });
    } catch (error: any) {
      console.error('[Auth] Signup error:', error);
      res.status(500).json({ error: 'Failed to create account', code: 'SIGNUP_FAILED' });
    }
  });

  /**
   * POST /auth/login
   * Authenticate user and return token
   */
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password, username } = req.body;

      // Find user by email or username
      const whereClause = email ? { email: { equalTo: email.toLowerCase() } } : { username: { equalTo: username } };

      const users = await adapter.query({
        collection: '_User',
        where: whereClause,
        limit: 1
      });

      if (users.results.length === 0) {
        return res.status(401).json({
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      const user = users.results[0];

      // Verify password
      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Generate new session
      const sessionId = generateSessionToken();
      const token = generateToken({ userId: user.objectId, email: user.email, sessionId }, jwtSecret);

      // Store session
      await adapter.create({
        collection: '_Session',
        data: {
          userId: user.objectId,
          token: sessionId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          ipAddress: req.ip
        }
      });

      // Update last login and session token
      await adapter.save({
        collection: '_User',
        objectId: user.objectId,
        data: {
          lastLogin: new Date().toISOString(),
          sessionToken: sessionId
        }
      });

      res.json({
        user: sanitizeUser(user),
        token
      });
    } catch (error: any) {
      console.error('[Auth] Login error:', error);
      res.status(500).json({ error: 'Login failed', code: 'LOGIN_FAILED' });
    }
  });

  /**
   * POST /auth/logout
   * Invalidate current session
   */
  router.post('/logout', async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const sessionId = (req as any).sessionId;

      if (user && sessionId) {
        // Delete session
        const sessions = await adapter.query({
          collection: '_Session',
          where: {
            userId: { equalTo: user.objectId },
            token: { equalTo: sessionId }
          },
          limit: 1
        });

        for (const session of sessions.results) {
          await adapter.delete({
            collection: '_Session',
            objectId: session.objectId
          });
        }

        // Clear user's session token
        await adapter.save({
          collection: '_User',
          objectId: user.objectId,
          data: { sessionToken: null }
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Auth] Logout error:', error);
      res.status(500).json({ error: 'Logout failed', code: 'LOGOUT_FAILED' });
    }
  });

  /**
   * GET /auth/me
   * Get current authenticated user
   */
  router.get('/me', async (req: Request, res: Response) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({
        error: 'Not authenticated',
        code: 'NOT_AUTHENTICATED'
      });
    }

    res.json({ user: sanitizeUser(user) });
  });

  /**
   * PUT /auth/me
   * Update current user's profile
   */
  router.put('/me', async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const { email, password, username, ...customFields } = req.body;
      const updates: any = { ...customFields };

      // Handle email change
      if (email && email !== user.email) {
        if (!validateEmail(email)) {
          return res.status(400).json({
            error: 'Invalid email address',
            code: 'INVALID_EMAIL'
          });
        }

        // Check if new email is taken
        const existing = await adapter.query({
          collection: '_User',
          where: { email: { equalTo: email.toLowerCase() } },
          limit: 1
        });

        if (existing.results.length > 0) {
          return res.status(400).json({
            error: 'Email already in use',
            code: 'EMAIL_EXISTS'
          });
        }

        updates.email = email.toLowerCase();
        updates.emailVerified = false;
      }

      // Handle password change
      if (password) {
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
          return res.status(400).json({
            error: passwordValidation.errors.join(', '),
            code: 'WEAK_PASSWORD'
          });
        }
        updates.passwordHash = await hashPassword(password);
      }

      // Handle username change
      if (username && username !== user.username) {
        const existingUsername = await adapter.query({
          collection: '_User',
          where: { username: { equalTo: username } },
          limit: 1
        });

        if (existingUsername.results.length > 0) {
          return res.status(400).json({
            error: 'Username already taken',
            code: 'USERNAME_EXISTS'
          });
        }
        updates.username = username;
      }

      const updatedUser = await adapter.save({
        collection: '_User',
        objectId: user.objectId,
        data: updates
      });

      res.json({ user: sanitizeUser(updatedUser) });
    } catch (error: any) {
      console.error('[Auth] Update user error:', error);
      res.status(500).json({ error: 'Failed to update profile', code: 'UPDATE_FAILED' });
    }
  });

  /**
   * POST /auth/request-password-reset
   * Request a password reset email
   */
  router.post('/request-password-reset', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const users = await adapter.query({
        collection: '_User',
        where: { email: { equalTo: email.toLowerCase() } },
        limit: 1
      });

      // Always return success to prevent email enumeration
      if (users.results.length === 0) {
        return res.json({ success: true });
      }

      const user = users.results[0];
      const resetToken = generateSessionToken();
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await adapter.save({
        collection: '_User',
        objectId: user.objectId,
        data: {
          resetToken,
          resetTokenExpiry: resetExpiry.toISOString()
        }
      });

      // In a real implementation, send email here
      // For local development, log the token
      console.log(`[Auth] Password reset token for ${email}: ${resetToken}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Auth] Password reset request error:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  });

  /**
   * POST /auth/reset-password
   * Reset password using token
   */
  router.post('/reset-password', async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: 'Token and password are required' });
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          error: passwordValidation.errors.join(', '),
          code: 'WEAK_PASSWORD'
        });
      }

      const users = await adapter.query({
        collection: '_User',
        where: { resetToken: { equalTo: token } },
        limit: 1
      });

      if (users.results.length === 0) {
        return res.status(400).json({
          error: 'Invalid or expired reset token',
          code: 'INVALID_TOKEN'
        });
      }

      const user = users.results[0];

      // Check if token is expired
      if (new Date(user.resetTokenExpiry) < new Date()) {
        return res.status(400).json({
          error: 'Reset token has expired',
          code: 'EXPIRED_TOKEN'
        });
      }

      // Update password and clear reset token
      const passwordHash = await hashPassword(password);
      await adapter.save({
        collection: '_User',
        objectId: user.objectId,
        data: {
          passwordHash,
          resetToken: null,
          resetTokenExpiry: null
        }
      });

      // Invalidate all existing sessions
      const sessions = await adapter.query({
        collection: '_Session',
        where: { userId: { equalTo: user.objectId } }
      });

      for (const session of sessions.results) {
        await adapter.delete({
          collection: '_Session',
          objectId: session.objectId
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Auth] Password reset error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  return router;
}

/**
 * Ensure _User and _Session tables exist
 */
async function ensureAuthTables(adapter: LocalSQLAdapter): Promise<void> {
  try {
    const schema = await adapter.getSchema();
    const tableNames = schema.tables.map((t) => t.name);

    if (!tableNames.includes('_User')) {
      await adapter.createTable(UserTableSchema);
      console.log('[Auth] Created _User table');
    }

    if (!tableNames.includes('_Session')) {
      await adapter.createTable(SessionTableSchema);
      console.log('[Auth] Created _Session table');
    }
  } catch (error) {
    console.error('[Auth] Failed to create auth tables:', error);
  }
}
```

---

### Step 3: Auth Middleware (1 hour)

**File:** `packages/noodl-editor/src/main/src/local-backend/auth/auth-middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { LocalSQLAdapter } from '@noodl/runtime/src/api/adapters/local-sql/LocalSQLAdapter';

import { verifyToken, getJWTSecret } from './jwt-utils';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      sessionId?: string;
      isAuthenticated: boolean;
    }
  }
}

/**
 * Create auth middleware that validates JWT tokens
 */
export function createAuthMiddleware(adapter: LocalSQLAdapter, backendsPath: string) {
  const jwtSecret = getJWTSecret(backendsPath);

  return async (req: Request, res: Response, next: NextFunction) => {
    req.isAuthenticated = false;

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    try {
      // Verify JWT
      const payload = verifyToken(token, jwtSecret);
      if (!payload) {
        return next();
      }

      // Validate session still exists and hasn't expired
      const sessions = await adapter.query({
        collection: '_Session',
        where: {
          userId: { equalTo: payload.userId },
          token: { equalTo: payload.sessionId }
        },
        limit: 1
      });

      if (sessions.results.length === 0) {
        return next();
      }

      const session = sessions.results[0];
      if (new Date(session.expiresAt) < new Date()) {
        // Session expired, clean it up
        await adapter.delete({
          collection: '_Session',
          objectId: session.objectId
        });
        return next();
      }

      // Get user
      const user = await adapter.fetch({
        collection: '_User',
        objectId: payload.userId
      });

      if (user) {
        req.user = user;
        req.sessionId = payload.sessionId;
        req.isAuthenticated = true;
      }
    } catch (error) {
      console.error('[Auth Middleware] Error:', error);
    }

    next();
  };
}

/**
 * Middleware that requires authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  next();
}

/**
 * Middleware that optionally uses auth but doesn't require it
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  // Auth middleware already ran, just continue
  next();
}
```

---

### Step 4: Frontend Auth Nodes (3 hours)

**File:** `packages/noodl-viewer-cloud/src/nodes/auth/sign-up.ts`

```typescript
export const node = {
  name: 'noodl.auth.signUp',
  displayNodeName: 'Sign Up',
  docs: 'https://docs.nodegex.com/nodes/auth/sign-up',
  category: 'Authentication',
  color: 'data',

  initialize() {
    this._internal.customFields = {};
  },

  getInspectInfo() {
    if (this._internal.error) {
      return { type: 'text', value: `Error: ${this._internal.error}` };
    }
    if (this._internal.user) {
      return { type: 'text', value: `Signed up: ${this._internal.user.email}` };
    }
    return { type: 'text', value: 'Ready' };
  },

  inputs: {
    email: {
      type: 'string',
      displayName: 'Email',
      group: 'Credentials',
      set(value: string) {
        this._internal.email = value;
      }
    },
    password: {
      type: 'string',
      displayName: 'Password',
      group: 'Credentials',
      set(value: string) {
        this._internal.password = value;
      }
    },
    username: {
      type: 'string',
      displayName: 'Username',
      group: 'Profile',
      set(value: string) {
        this._internal.username = value;
      }
    },
    customFields: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Custom Fields',
      group: 'Profile',
      set(value: string) {
        this._internal.customFieldNames = value
          ?.split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    },
    signUp: {
      type: 'signal',
      displayName: 'Sign Up',
      group: 'Actions',
      valueChangedToTrue() {
        this.doSignUp();
      }
    }
  },

  outputs: {
    user: {
      type: 'object',
      displayName: 'User',
      group: 'Result',
      getter() {
        return this._internal.user;
      }
    },
    userId: {
      type: 'string',
      displayName: 'User ID',
      group: 'Result',
      getter() {
        return this._internal.user?.objectId;
      }
    },
    success: {
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter() {
        return this._internal.error;
      }
    },
    errorCode: {
      type: 'string',
      displayName: 'Error Code',
      group: 'Events',
      getter() {
        return this._internal.errorCode;
      }
    }
  },

  methods: {
    async doSignUp() {
      try {
        const authService = this.context.getAuthService();

        const payload: any = {
          email: this._internal.email,
          password: this._internal.password
        };

        if (this._internal.username) {
          payload.username = this._internal.username;
        }

        // Add custom fields
        for (const fieldName of this._internal.customFieldNames || []) {
          if (this._internal.customFields[fieldName] !== undefined) {
            payload[fieldName] = this._internal.customFields[fieldName];
          }
        }

        const result = await authService.signUp(payload);

        this._internal.user = result.user;
        this._internal.error = null;
        this._internal.errorCode = null;

        this.flagOutputDirty('user');
        this.flagOutputDirty('userId');
        this.flagOutputDirty('error');
        this.flagOutputDirty('errorCode');
        this.sendSignalOnOutput('success');
      } catch (e: any) {
        this._internal.error = e.message || 'Sign up failed';
        this._internal.errorCode = e.code || 'SIGNUP_FAILED';
        this._internal.user = null;

        this.flagOutputDirty('error');
        this.flagOutputDirty('errorCode');
        this.flagOutputDirty('user');
        this.sendSignalOnOutput('failure');
      }
    },

    setCustomField(name: string, value: any) {
      this._internal.customFields[name] = value;
    },

    registerInputIfNeeded(name: string) {
      if (this.hasInput(name)) return;

      if (name.startsWith('cf-')) {
        this.registerInput(name, {
          set: this.setCustomField.bind(this, name.substring(3))
        });
      }
    }
  },

  dynamicports: [
    {
      name: 'conditionalports/extended',
      condition: 'customFields',
      inputs: (parameters: any) => {
        const fields =
          parameters.customFields
            ?.split(',')
            .map((s: string) => s.trim())
            .filter(Boolean) || [];
        return fields.map((f: string) => ({
          name: 'cf-' + f,
          displayName: f,
          type: '*',
          group: 'Custom Fields'
        }));
      }
    }
  ]
};
```

**File:** `packages/noodl-viewer-cloud/src/nodes/auth/log-in.ts`

```typescript
export const node = {
  name: 'noodl.auth.logIn',
  displayNodeName: 'Log In',
  docs: 'https://docs.nodegex.com/nodes/auth/log-in',
  category: 'Authentication',
  color: 'data',

  getInspectInfo() {
    if (this._internal.error) {
      return { type: 'text', value: `Error: ${this._internal.error}` };
    }
    if (this._internal.user) {
      return { type: 'text', value: `Logged in: ${this._internal.user.email}` };
    }
    return { type: 'text', value: 'Ready' };
  },

  inputs: {
    email: {
      type: 'string',
      displayName: 'Email',
      group: 'Credentials',
      set(value: string) {
        this._internal.email = value;
      }
    },
    password: {
      type: 'string',
      displayName: 'Password',
      group: 'Credentials',
      set(value: string) {
        this._internal.password = value;
      }
    },
    username: {
      type: 'string',
      displayName: 'Username (alternative)',
      group: 'Credentials',
      set(value: string) {
        this._internal.username = value;
      }
    },
    logIn: {
      type: 'signal',
      displayName: 'Log In',
      group: 'Actions',
      valueChangedToTrue() {
        this.doLogIn();
      }
    }
  },

  outputs: {
    user: {
      type: 'object',
      displayName: 'User',
      group: 'Result',
      getter() {
        return this._internal.user;
      }
    },
    userId: {
      type: 'string',
      displayName: 'User ID',
      group: 'Result',
      getter() {
        return this._internal.user?.objectId;
      }
    },
    success: {
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter() {
        return this._internal.error;
      }
    },
    errorCode: {
      type: 'string',
      displayName: 'Error Code',
      group: 'Events',
      getter() {
        return this._internal.errorCode;
      }
    }
  },

  methods: {
    async doLogIn() {
      try {
        const authService = this.context.getAuthService();

        const result = await authService.logIn({
          email: this._internal.email,
          password: this._internal.password,
          username: this._internal.username
        });

        this._internal.user = result.user;
        this._internal.error = null;
        this._internal.errorCode = null;

        this.flagOutputDirty('user');
        this.flagOutputDirty('userId');
        this.flagOutputDirty('error');
        this.flagOutputDirty('errorCode');
        this.sendSignalOnOutput('success');
      } catch (e: any) {
        this._internal.error = e.message || 'Login failed';
        this._internal.errorCode = e.code || 'LOGIN_FAILED';
        this._internal.user = null;

        this.flagOutputDirty('error');
        this.flagOutputDirty('errorCode');
        this.flagOutputDirty('user');
        this.sendSignalOnOutput('failure');
      }
    }
  }
};
```

**File:** `packages/noodl-viewer-cloud/src/nodes/auth/log-out.ts`

```typescript
export const node = {
  name: 'noodl.auth.logOut',
  displayNodeName: 'Log Out',
  docs: 'https://docs.nodegex.com/nodes/auth/log-out',
  category: 'Authentication',
  color: 'data',

  inputs: {
    logOut: {
      type: 'signal',
      displayName: 'Log Out',
      group: 'Actions',
      valueChangedToTrue() {
        this.doLogOut();
      }
    }
  },

  outputs: {
    success: {
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter() {
        return this._internal.error;
      }
    }
  },

  methods: {
    async doLogOut() {
      try {
        const authService = this.context.getAuthService();
        await authService.logOut();

        this._internal.error = null;
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('success');
      } catch (e: any) {
        this._internal.error = e.message || 'Logout failed';
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
      }
    }
  }
};
```

**File:** `packages/noodl-viewer-cloud/src/nodes/auth/current-user.ts`

```typescript
export const node = {
  name: 'noodl.auth.currentUser',
  displayNodeName: 'Current User',
  docs: 'https://docs.nodegex.com/nodes/auth/current-user',
  category: 'Authentication',
  color: 'data',

  initialize() {
    // Subscribe to auth state changes
    const authService = this.context.getAuthService();
    this._internal.unsubscribe = authService.onAuthStateChange((user: any) => {
      this._internal.user = user;
      this.flagOutputDirty('user');
      this.flagOutputDirty('userId');
      this.flagOutputDirty('email');
      this.flagOutputDirty('username');
      this.flagOutputDirty('isLoggedIn');

      if (user) {
        this.sendSignalOnOutput('loggedIn');
      } else {
        this.sendSignalOnOutput('loggedOut');
      }
    });

    // Get initial state
    this._internal.user = authService.getCurrentUser();
  },

  destroy() {
    if (this._internal.unsubscribe) {
      this._internal.unsubscribe();
    }
  },

  getInspectInfo() {
    if (this._internal.user) {
      return { type: 'text', value: `Logged in: ${this._internal.user.email}` };
    }
    return { type: 'text', value: 'Not logged in' };
  },

  inputs: {
    fetch: {
      type: 'signal',
      displayName: 'Fetch',
      group: 'Actions',
      valueChangedToTrue() {
        this.fetchUser();
      }
    }
  },

  outputs: {
    user: {
      type: 'object',
      displayName: 'User',
      group: 'User Data',
      getter() {
        return this._internal.user;
      }
    },
    userId: {
      type: 'string',
      displayName: 'User ID',
      group: 'User Data',
      getter() {
        return this._internal.user?.objectId;
      }
    },
    email: {
      type: 'string',
      displayName: 'Email',
      group: 'User Data',
      getter() {
        return this._internal.user?.email;
      }
    },
    username: {
      type: 'string',
      displayName: 'Username',
      group: 'User Data',
      getter() {
        return this._internal.user?.username;
      }
    },
    isLoggedIn: {
      type: 'boolean',
      displayName: 'Is Logged In',
      group: 'Status',
      getter() {
        return !!this._internal.user;
      }
    },
    loggedIn: {
      type: 'signal',
      displayName: 'Logged In',
      group: 'Events'
    },
    loggedOut: {
      type: 'signal',
      displayName: 'Logged Out',
      group: 'Events'
    }
  },

  methods: {
    async fetchUser() {
      const authService = this.context.getAuthService();
      this._internal.user = await authService.fetchCurrentUser();

      this.flagOutputDirty('user');
      this.flagOutputDirty('userId');
      this.flagOutputDirty('email');
      this.flagOutputDirty('username');
      this.flagOutputDirty('isLoggedIn');
    }
  }
};
```

**File:** `packages/noodl-viewer-cloud/src/nodes/auth/update-user.ts`

```typescript
export const node = {
  name: 'noodl.auth.updateUser',
  displayNodeName: 'Update User',
  docs: 'https://docs.nodegex.com/nodes/auth/update-user',
  category: 'Authentication',
  color: 'data',

  initialize() {
    this._internal.updates = {};
  },

  inputs: {
    email: {
      type: 'string',
      displayName: 'Email',
      group: 'Update Fields',
      set(value: string) {
        this._internal.email = value;
      }
    },
    password: {
      type: 'string',
      displayName: 'New Password',
      group: 'Update Fields',
      set(value: string) {
        this._internal.password = value;
      }
    },
    username: {
      type: 'string',
      displayName: 'Username',
      group: 'Update Fields',
      set(value: string) {
        this._internal.username = value;
      }
    },
    customFields: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Custom Fields',
      group: 'Update Fields',
      set(value: string) {
        this._internal.customFieldNames = value
          ?.split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    },
    save: {
      type: 'signal',
      displayName: 'Save',
      group: 'Actions',
      valueChangedToTrue() {
        this.doUpdate();
      }
    }
  },

  outputs: {
    user: {
      type: 'object',
      displayName: 'Updated User',
      group: 'Result',
      getter() {
        return this._internal.updatedUser;
      }
    },
    success: {
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter() {
        return this._internal.error;
      }
    }
  },

  methods: {
    async doUpdate() {
      try {
        const authService = this.context.getAuthService();

        const updates: any = {};

        if (this._internal.email) updates.email = this._internal.email;
        if (this._internal.password) updates.password = this._internal.password;
        if (this._internal.username) updates.username = this._internal.username;

        // Add custom fields
        for (const fieldName of this._internal.customFieldNames || []) {
          if (this._internal.updates[fieldName] !== undefined) {
            updates[fieldName] = this._internal.updates[fieldName];
          }
        }

        const result = await authService.updateCurrentUser(updates);

        this._internal.updatedUser = result.user;
        this._internal.error = null;

        this.flagOutputDirty('user');
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('success');
      } catch (e: any) {
        this._internal.error = e.message || 'Update failed';
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
      }
    },

    setCustomField(name: string, value: any) {
      this._internal.updates[name] = value;
    },

    registerInputIfNeeded(name: string) {
      if (this.hasInput(name)) return;

      if (name.startsWith('cf-')) {
        this.registerInput(name, {
          set: this.setCustomField.bind(this, name.substring(3))
        });
      }
    }
  },

  dynamicports: [
    {
      name: 'conditionalports/extended',
      condition: 'customFields',
      inputs: (parameters: any) => {
        const fields =
          parameters.customFields
            ?.split(',')
            .map((s: string) => s.trim())
            .filter(Boolean) || [];
        return fields.map((f: string) => ({
          name: 'cf-' + f,
          displayName: f,
          type: '*',
          group: 'Custom Fields'
        }));
      }
    }
  ]
};
```

---

### Step 5: Auth Service for Frontend (2 hours)

**File:** `packages/noodl-runtime/src/api/auth/AuthService.ts`

```typescript
import { EventEmitter } from 'events';

export interface AuthUser {
  objectId: string;
  email: string;
  username?: string;
  emailVerified?: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export class AuthService extends EventEmitter {
  private baseUrl: string;
  private token: string | null = null;
  private currentUser: AuthUser | null = null;
  private storageKey = 'noodl_auth_token';

  constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.loadStoredSession();
  }

  /**
   * Load session from storage on init
   */
  private async loadStoredSession(): Promise<void> {
    if (typeof localStorage === 'undefined') return;

    const storedToken = localStorage.getItem(this.storageKey);
    if (storedToken) {
      this.token = storedToken;
      try {
        await this.fetchCurrentUser();
      } catch (e) {
        // Token invalid, clear it
        this.clearSession();
      }
    }
  }

  /**
   * Sign up a new user
   */
  async signUp(data: { email: string; password: string; username?: string; [key: string]: any }): Promise<AuthResult> {
    const response = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new AuthError(error.error, error.code);
    }

    const result = await response.json();
    this.setSession(result.token, result.user);
    return result;
  }

  /**
   * Log in an existing user
   */
  async logIn(data: { email?: string; password: string; username?: string }): Promise<AuthResult> {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new AuthError(error.error, error.code);
    }

    const result = await response.json();
    this.setSession(result.token, result.user);
    return result;
  }

  /**
   * Log out current user
   */
  async logOut(): Promise<void> {
    if (this.token) {
      try {
        await this.request('/auth/logout', {
          method: 'POST'
        });
      } catch (e) {
        // Ignore logout errors
      }
    }

    this.clearSession();
  }

  /**
   * Get current user
   */
  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * Fetch current user from server
   */
  async fetchCurrentUser(): Promise<AuthUser | null> {
    if (!this.token) return null;

    const response = await this.request('/auth/me', {
      method: 'GET'
    });

    if (!response.ok) {
      this.clearSession();
      return null;
    }

    const { user } = await response.json();
    this.currentUser = user;
    this.emit('authStateChange', user);
    return user;
  }

  /**
   * Update current user
   */
  async updateCurrentUser(updates: {
    email?: string;
    password?: string;
    username?: string;
    [key: string]: any;
  }): Promise<AuthResult> {
    const response = await this.request('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new AuthError(error.error, error.code);
    }

    const { user } = await response.json();
    this.currentUser = user;
    this.emit('authStateChange', user);
    return { user, token: this.token! };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const response = await this.request('/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new AuthError(error.error, error.code);
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, password: string): Promise<void> {
    const response = await this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new AuthError(error.error, error.code);
    }
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    this.on('authStateChange', callback);
    return () => this.off('authStateChange', callback);
  }

  /**
   * Get auth token for requests
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn(): boolean {
    return this.token !== null && this.currentUser !== null;
  }

  // Private methods

  private setSession(token: string, user: AuthUser): void {
    this.token = token;
    this.currentUser = user;

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, token);
    }

    this.emit('authStateChange', user);
  }

  private clearSession(): void {
    this.token = null;
    this.currentUser = null;

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }

    this.emit('authStateChange', null);
  }

  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers
    });
  }
}

export class AuthError extends Error {
  code: string;

  constructor(message: string, code: string = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
```

---

### Step 6: Integration with Backend Server (1 hour)

**File:** Modifications to `packages/noodl-editor/src/main/src/local-backend/LocalBackendServer.ts`

```typescript
// Add imports
import { createAuthRouter } from './auth/auth-routes';
import { createAuthMiddleware } from './auth/auth-middleware';

// In LocalBackendServer constructor, after setupMiddleware():

private setupAuth(): void {
  // Add auth middleware (runs on every request)
  this.app.use(createAuthMiddleware(this.adapter!, this.config.backendsPath));

  // Add auth routes
  this.app.use('/auth', createAuthRouter(this.adapter!, this.config.backendsPath));
}

// In start() method, after adapter.connect():
async start(): Promise<void> {
  // ... existing code ...

  await this.adapter.connect();

  // Set up authentication
  this.setupAuth();

  // ... rest of existing code ...
}
```

---

## Files to Create

```
packages/noodl-editor/src/main/src/local-backend/auth/
├── password-utils.ts
├── jwt-utils.ts
├── user-schema.ts
├── auth-routes.ts
├── auth-middleware.ts
└── index.ts

packages/noodl-viewer-cloud/src/nodes/auth/
├── sign-up.ts
├── log-in.ts
├── log-out.ts
├── current-user.ts
├── update-user.ts
└── index.ts

packages/noodl-runtime/src/api/auth/
├── AuthService.ts
└── index.ts
```

## Files to Modify

```
packages/noodl-editor/src/main/src/local-backend/LocalBackendServer.ts
  - Add auth middleware and routes

packages/noodl-viewer-cloud/src/nodes/index.ts
  - Register auth nodes

packages/noodl-runtime/src/api/cloudstore.js
  - Inject AuthService into context
  - Auto-attach auth token to requests

packages/noodl-editor/package.json
  - Add bcrypt and jsonwebtoken dependencies
```

---

## API Reference

### Auth Endpoints

| Method | Endpoint                       | Description         | Auth Required |
| ------ | ------------------------------ | ------------------- | ------------- |
| POST   | `/auth/signup`                 | Create new account  | No            |
| POST   | `/auth/login`                  | Authenticate user   | No            |
| POST   | `/auth/logout`                 | Invalidate session  | Yes           |
| GET    | `/auth/me`                     | Get current user    | Yes           |
| PUT    | `/auth/me`                     | Update current user | Yes           |
| POST   | `/auth/request-password-reset` | Request reset email | No            |
| POST   | `/auth/reset-password`         | Reset with token    | No            |

### Request/Response Examples

**Sign Up:**

```javascript
// Request
POST /auth/signup
{
  "email": "user@example.com",
  "password": "securepass123",
  "username": "johndoe",
  "displayName": "John Doe"  // custom field
}

// Response
{
  "user": {
    "objectId": "abc123",
    "email": "user@example.com",
    "username": "johndoe",
    "displayName": "John Doe",
    "emailVerified": false,
    "createdAt": "2024-01-15T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Log In:**

```javascript
// Request
POST /auth/login
{
  "email": "user@example.com",
  "password": "securepass123"
}

// Response
{
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Error Codes

| Code                  | Description                        |
| --------------------- | ---------------------------------- |
| `INVALID_EMAIL`       | Email format is invalid            |
| `WEAK_PASSWORD`       | Password doesn't meet requirements |
| `EMAIL_EXISTS`        | Email already registered           |
| `USERNAME_EXISTS`     | Username already taken             |
| `INVALID_CREDENTIALS` | Wrong email/password               |
| `NOT_AUTHENTICATED`   | No valid session                   |
| `AUTH_REQUIRED`       | Endpoint requires auth             |
| `INVALID_TOKEN`       | Reset token invalid                |
| `EXPIRED_TOKEN`       | Reset token expired                |

---

## Testing Checklist

### Password Utilities

- [ ] Password hashing works correctly
- [ ] Password verification works
- [ ] Weak passwords rejected
- [ ] Email validation works

### JWT Utilities

- [ ] Token generation works
- [ ] Token verification works
- [ ] Expired tokens rejected
- [ ] Secret persists across restarts

### Auth Routes

- [ ] Sign up creates user
- [ ] Sign up rejects duplicate email
- [ ] Sign up rejects weak password
- [ ] Login succeeds with valid credentials
- [ ] Login fails with wrong password
- [ ] Login fails with unknown email
- [ ] Logout invalidates session
- [ ] /me returns current user
- [ ] /me returns 401 when not logged in
- [ ] Update user changes email
- [ ] Update user changes password
- [ ] Password reset flow works

### Auth Middleware

- [ ] Extracts token from header
- [ ] Validates token signature
- [ ] Checks session exists
- [ ] Attaches user to request
- [ ] Passes through without token

### Frontend Nodes

- [ ] Sign Up node works
- [ ] Log In node works
- [ ] Log Out node works
- [ ] Current User shows correct state
- [ ] Current User updates on auth change
- [ ] Update User saves changes
- [ ] Custom fields work

### Integration

- [ ] Auth state persists after page refresh
- [ ] Authenticated requests include token
- [ ] 401 response triggers logout
- [ ] Multiple sessions work

---

## Success Criteria

1. Users can sign up, log in, log out via visual nodes
2. Session persists across page refreshes
3. Password stored securely (bcrypt hash)
4. Token expiry and refresh work correctly
5. API compatible with existing Parse auth nodes
6. Custom user fields supported

---

## Security Considerations

1. **Password Storage**: bcrypt with cost factor 12
2. **Token Security**: JWT with 7-day expiry, stored in localStorage
3. **Session Tracking**: Server-side session validation
4. **Rate Limiting**: Should add to prevent brute force (future enhancement)
5. **HTTPS**: Recommend for production deployments
6. **Email Enumeration**: Signup/reset responses don't reveal if email exists

---

## Dependencies

**NPM packages to add:**

- `bcrypt` - Password hashing
- `jsonwebtoken` - JWT generation/verification

**Internal:**

- TASK-007A (LocalSQLAdapter)
- TASK-007B (LocalBackendServer)

**Blocks:**

- ACL/permissions system (future enhancement)

---

## Estimated Session Breakdown

| Session   | Focus                                        | Hours  |
| --------- | -------------------------------------------- | ------ |
| 1         | Password/JWT utilities + User schema         | 2      |
| 2         | Auth routes (signup, login, logout)          | 2      |
| 3         | Auth routes (me, update, reset) + middleware | 2      |
| 4         | Frontend auth nodes                          | 3      |
| 5         | AuthService + integration                    | 2      |
| 6         | Testing + edge cases                         | 1      |
| **Total** |                                              | **12** |

---

## Future Enhancements

These are out of scope for initial implementation but could be added later:

1. **Email Verification**: Send verification emails, verify endpoint
2. **OAuth/Social Login**: Google, GitHub, etc.
3. **Two-Factor Authentication**: TOTP support
4. **Rate Limiting**: Prevent brute force attacks
5. **ACL System**: Record-level permissions
6. **Role-Based Access**: Admin, User, etc. roles
7. **Session Management UI**: View/revoke active sessions
8. **Audit Log**: Track auth events
