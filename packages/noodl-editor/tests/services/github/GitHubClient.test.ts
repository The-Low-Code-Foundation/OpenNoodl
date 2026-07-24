/**
 * Unit tests for GitHubClient
 *
 * Tests caching, rate limiting, error handling, and auth integration.
 *
 * Converted from Jest to the Electron/Jasmine suite by DEBT-005 (2026-07-25).
 * The original was a Jest spec in a package with no Jest runner, so none of it
 * had ever executed. Jest's module mocks are replaced by seeding the
 * GitHubOAuthService singleton slot with a stub before the client constructs,
 * and by installing the mock Octokit directly on the client instead of letting
 * `initializeOctokit` build a real one (which would hit the network).
 */

import { GitHubClient } from '../../../src/editor/src/services/github/GitHubClient';
import { GitHubOAuthService } from '../../../src/editor/src/services/GitHubOAuthService';

import type { GitHubRateLimit } from '../../../src/editor/src/services/github/GitHubTypes';

/**
 * The private surface these specs drive. The behaviours under test — cache TTL
 * expiry, invalidation on mutation, the 403 rate-limit path — are only reachable
 * through members GitHubClient keeps private, and TypeScript offers no way to
 * name a private member from outside the class. So the shape is declared once,
 * here, and reached through a single documented cast instead of fifteen bare
 * `as any` at the call sites.
 */
interface GitHubClientInternals {
  octokit: unknown;
  updateRateLimit(): Promise<GitHubRateLimit>;
  setCache<T>(key: string, data: T, etag?: string): void;
  cache: Map<string, unknown>;
  rateLimit: GitHubRateLimit | null;
}

function internals(client: GitHubClient): GitHubClientInternals {
  return client as unknown as GitHubClientInternals;
}

/** The singleton slots, reset between specs. */
interface GitHubClientStatics {
  _instance: GitHubClient | undefined;
}

interface GitHubOAuthServiceStatics {
  _instance: unknown;
}

/**
 * The Octokit methods the mock below installs. Declaring them means a typo in
 * `mockOctokit.issues.listForRepo` fails to compile rather than silently
 * stubbing nothing.
 */
interface MockOctokit {
  repos: { get: jasmine.Spy; listForAuthenticatedUser: jasmine.Spy };
  issues: {
    listForRepo: jasmine.Spy;
    get: jasmine.Spy;
    create: jasmine.Spy;
    update: jasmine.Spy;
    listComments: jasmine.Spy;
    createComment: jasmine.Spy;
    listLabelsForRepo: jasmine.Spy;
  };
  pulls: { list: jasmine.Spy; get: jasmine.Spy; listCommits: jasmine.Spy };
  rateLimit: { get: jasmine.Spy };
}

function makeMockOctokit(): MockOctokit {
  return {
    repos: {
      get: jasmine.createSpy('repos.get'),
      listForAuthenticatedUser: jasmine.createSpy('repos.listForAuthenticatedUser')
    },
    issues: {
      listForRepo: jasmine.createSpy('issues.listForRepo'),
      get: jasmine.createSpy('issues.get'),
      create: jasmine.createSpy('issues.create'),
      update: jasmine.createSpy('issues.update'),
      listComments: jasmine.createSpy('issues.listComments'),
      createComment: jasmine.createSpy('issues.createComment'),
      listLabelsForRepo: jasmine.createSpy('issues.listLabelsForRepo')
    },
    pulls: {
      list: jasmine.createSpy('pulls.list'),
      get: jasmine.createSpy('pulls.get'),
      listCommits: jasmine.createSpy('pulls.listCommits')
    },
    rateLimit: {
      get: jasmine.createSpy('rateLimit.get')
    }
  };
}

/** Stubbed auth service, seeded into the singleton slot before the client constructs. */
interface MockAuthService {
  isAuthenticated: jasmine.Spy;
  getToken: jasmine.Spy;
  on: jasmine.Spy;
  off: jasmine.Spy;
}

function makeMockAuthService(): MockAuthService {
  return {
    isAuthenticated: jasmine.createSpy('isAuthenticated').and.returnValue(false),
    getToken: jasmine.createSpy('getToken').and.resolveTo('mock-token'),
    on: jasmine.createSpy('on'),
    off: jasmine.createSpy('off')
  };
}

describe('GitHubClient', () => {
  let client: GitHubClient;
  let mockOctokit: MockOctokit;
  let mockAuth: MockAuthService;
  let originalAuthInstance: unknown;

  /**
   * What `initializeOctokit` does, minus constructing a real Octokit (which
   * would sign a request with the stub token and hit the network): install the
   * mock and fetch the initial rate limit through it.
   */
  async function initWithMockOctokit(): Promise<void> {
    internals(client).octokit = mockOctokit;
    await internals(client).updateRateLimit();
  }

  function rateLimitResponse() {
    return {
      data: {
        rate: {
          limit: 5000,
          remaining: 4999,
          reset: Math.floor(Date.now() / 1000) + 3600,
          used: 1
        }
      }
    };
  }

  beforeEach(() => {
    // Seed the auth-service singleton with the stub, then reset the client
    // singleton so its constructor binds against the stub.
    originalAuthInstance = (GitHubOAuthService as unknown as GitHubOAuthServiceStatics)._instance;
    mockAuth = makeMockAuthService();
    (GitHubOAuthService as unknown as GitHubOAuthServiceStatics)._instance = mockAuth;

    (GitHubClient as unknown as GitHubClientStatics)._instance = undefined;
    client = GitHubClient.instance;

    mockOctokit = makeMockOctokit();
  });

  afterEach(() => {
    (GitHubClient as unknown as GitHubClientStatics)._instance = undefined;
    (GitHubOAuthService as unknown as GitHubOAuthServiceStatics)._instance = originalAuthInstance;
  });

  describe('initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = GitHubClient.instance;
      const instance2 = GitHubClient.instance;
      expect(instance1).toBe(instance2);
    });

    it('should listen for auth state changes', () => {
      expect(mockAuth.on).toHaveBeenCalledWith('auth-state-changed', jasmine.any(Function), jasmine.anything());
    });

    it('should listen for disconnection', () => {
      expect(mockAuth.on).toHaveBeenCalledWith('disconnected', jasmine.any(Function), jasmine.anything());
    });
  });

  describe('caching', () => {
    beforeEach(async () => {
      mockAuth.isAuthenticated.and.returnValue(true);
      mockOctokit.rateLimit.get.and.resolveTo(rateLimitResponse());

      mockOctokit.repos.get.and.resolveTo({
        data: { id: 1, name: 'test-repo' },
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          'x-ratelimit-used': '1'
        }
      });

      await initWithMockOctokit();
    });

    it('should cache API responses', async () => {
      await client.getRepository('owner', 'repo');
      await client.getRepository('owner', 'repo');

      // API should only be called once
      expect(mockOctokit.repos.get).toHaveBeenCalledTimes(1);
    });

    it('should respect cache TTL', async () => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date());
      try {
        await client.getRepository('owner', 'repo');

        // Advance past the cache TTL
        jasmine.clock().tick(61000);

        await client.getRepository('owner', 'repo');

        expect(mockOctokit.repos.get).toHaveBeenCalledTimes(2);
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('should invalidate cache on mutations', async () => {
      mockOctokit.issues.listForRepo.and.resolveTo({
        data: [{ id: 1, number: 1 }],
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4998',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          'x-ratelimit-used': '2'
        }
      });

      mockOctokit.issues.create.and.resolveTo({
        data: { id: 2, number: 2 },
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4997',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          'x-ratelimit-used': '3'
        }
      });

      // List issues (cached)
      await client.listIssues('owner', 'repo');

      // Create issue (invalidates cache)
      await client.createIssue('owner', 'repo', { title: 'Test' });

      // List again (cache invalidated, should call API)
      await client.listIssues('owner', 'repo');

      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache on disconnect', () => {
      internals(client).setCache('test-key', { data: 'test' });
      expect(internals(client).cache.size).toBeGreaterThan(0);

      client.clearCache();

      expect(internals(client).cache.size).toBe(0);
    });
  });

  describe('rate limiting', () => {
    beforeEach(async () => {
      mockAuth.isAuthenticated.and.returnValue(true);
      mockOctokit.rateLimit.get.and.resolveTo(rateLimitResponse());
      await initWithMockOctokit();
    });

    it('should track rate limit from response headers', async () => {
      mockOctokit.repos.get.and.resolveTo({
        data: { id: 1 },
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4500',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          'x-ratelimit-used': '500'
        }
      });

      await client.getRepository('owner', 'repo');

      const rateLimit = client.getRateLimit();
      expect(rateLimit).toEqual(
        jasmine.objectContaining({
          limit: 5000,
          remaining: 4500,
          used: 500
        })
      );
      expect(typeof rateLimit!.reset).toBe('number');
    });

    it('should emit warning when approaching rate limit', async () => {
      const warningListener = jasmine.createSpy('rate-limit-warning');
      client.on('rate-limit-warning', warningListener, client);

      // Mock low remaining rate limit (9% = below 10% threshold)
      mockOctokit.repos.get.and.resolveTo({
        data: { id: 1 },
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '450', // 9%
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          'x-ratelimit-used': '4550'
        }
      });

      await client.getRepository('owner', 'repo');

      // EventDispatcher passes the event name as a trailing argument, so
      // assert on the payload rather than the exact call shape.
      expect(warningListener).toHaveBeenCalled();
      expect(warningListener.calls.mostRecent().args[0]).toEqual({
        rateLimit: jasmine.objectContaining({
          remaining: 450,
          limit: 5000
        })
      });
    });

    it('should calculate time until rate limit reset', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      mockOctokit.repos.get.and.resolveTo({
        data: { id: 1 },
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-reset': String(resetTime),
          'x-ratelimit-used': '1'
        }
      });

      await client.getRepository('owner', 'repo');

      const timeUntilReset = client.getTimeUntilRateLimitReset();

      // Should be approximately 1 hour (within 1 second tolerance)
      expect(timeUntilReset).toBeGreaterThan(3599000);
      expect(timeUntilReset).toBeLessThan(3601000);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      mockAuth.isAuthenticated.and.returnValue(true);
      mockOctokit.rateLimit.get.and.resolveTo(rateLimitResponse());
      await initWithMockOctokit();
    });

    it('should handle 404 errors with friendly message', async () => {
      mockOctokit.repos.get.and.rejectWith({
        status: 404,
        response: { data: { message: 'Not Found' } }
      });

      await expectAsync(client.getRepository('owner', 'repo')).toBeRejectedWithError(
        'Repository or resource not found.'
      );
    });

    it('should handle 401 errors with friendly message', async () => {
      mockOctokit.repos.get.and.rejectWith({
        status: 401,
        response: { data: { message: 'Unauthorized' } }
      });

      await expectAsync(client.getRepository('owner', 'repo')).toBeRejectedWithError(
        'Authentication failed. Please reconnect your GitHub account.'
      );
    });

    it('should handle 403 rate limit errors', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 1800;

      internals(client).rateLimit = {
        limit: 5000,
        remaining: 0,
        reset: resetTime,
        used: 5000
      };

      mockOctokit.repos.get.and.rejectWith({
        status: 403,
        response: {
          data: {
            message: 'API rate limit exceeded'
          }
        }
      });

      await expectAsync(client.getRepository('owner', 'repo')).toBeRejectedWithError(/Rate limit exceeded/);
    });

    it('should handle 422 validation errors', async () => {
      mockOctokit.issues.create.and.rejectWith({
        status: 422,
        response: {
          data: {
            message: 'Validation Failed',
            errors: [{ field: 'title', code: 'missing' }]
          }
        }
      });

      await expectAsync(client.createIssue('owner', 'repo', { title: '' })).toBeRejectedWithError(/Invalid request/);
    });
  });

  describe('API methods', () => {
    beforeEach(async () => {
      mockAuth.isAuthenticated.and.returnValue(true);
      mockOctokit.rateLimit.get.and.resolveTo(rateLimitResponse());
      await initWithMockOctokit();
    });

    it('should list issues with filters', async () => {
      mockOctokit.issues.listForRepo.and.resolveTo({
        data: [{ id: 1, number: 1, title: 'Test' }],
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4998',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600)
        }
      });

      const result = await client.listIssues('owner', 'repo', {
        state: 'open',
        labels: ['bug', 'enhancement'],
        sort: 'updated'
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe('Test');

      // Verify filters were converted correctly
      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        state: 'open',
        labels: 'bug,enhancement',
        sort: 'updated',
        milestone: undefined
      });
    });

    it('should create issue with options', async () => {
      mockOctokit.issues.create.and.resolveTo({
        data: { id: 1, number: 1, title: 'New Issue' },
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4998',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600)
        }
      });

      const result = await client.createIssue('owner', 'repo', {
        title: 'New Issue',
        body: 'Description',
        labels: ['bug'],
        assignees: ['user1']
      });

      expect(result.data.title).toBe('New Issue');
      expect(mockOctokit.issues.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: 'New Issue',
        body: 'Description',
        labels: ['bug'],
        assignees: ['user1']
      });
    });

    it('should list pull requests with converted filters', async () => {
      mockOctokit.pulls.list.and.resolveTo({
        data: [{ id: 1, number: 1, title: 'PR' }],
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4998',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600)
        }
      });

      await client.listPullRequests('owner', 'repo', {
        state: 'open',
        sort: 'comments' // Should be converted to 'created' for PRs
      });

      expect(mockOctokit.pulls.list).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        state: 'open',
        sort: 'created', // Converted from 'comments'
        direction: undefined,
        per_page: undefined,
        page: undefined
      });
    });
  });

  describe('utility methods', () => {
    it('should report ready status', async () => {
      expect(client.isReady()).toBe(false);

      mockAuth.isAuthenticated.and.returnValue(true);
      mockOctokit.rateLimit.get.and.resolveTo(rateLimitResponse());

      await initWithMockOctokit();

      expect(client.isReady()).toBe(true);
    });

    it('should clear cache on demand', () => {
      internals(client).setCache('test-1', { data: 'value1' });
      internals(client).setCache('test-2', { data: 'value2' });

      expect(internals(client).cache.size).toBe(2);

      client.clearCache();

      expect(internals(client).cache.size).toBe(0);
    });
  });
});
