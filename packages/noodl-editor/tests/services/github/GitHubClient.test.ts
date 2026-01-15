/**
 * Unit tests for GitHubClient
 *
 * Tests caching, rate limiting, error handling, and auth integration
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { GitHubClient } from '../../../src/editor/src/services/github/GitHubClient';
import { GitHubOAuthService } from '../../../src/editor/src/services/GitHubOAuthService';

// Mock Octokit
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    repos: {
      get: jest.fn(),
      listForAuthenticatedUser: jest.fn()
    },
    issues: {
      listForRepo: jest.fn(),
      get: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      listComments: jest.fn(),
      createComment: jest.fn(),
      listLabelsForRepo: jest.fn()
    },
    pulls: {
      list: jest.fn(),
      get: jest.fn(),
      listCommits: jest.fn()
    },
    rateLimit: {
      get: jest.fn()
    }
  }))
}));

// Mock GitHubOAuthService
jest.mock('../../../src/editor/src/services/GitHubOAuthService', () => ({
  GitHubOAuthService: {
    instance: {
      isAuthenticated: jest.fn(() => false),
      getToken: jest.fn(() => Promise.resolve('mock-token')),
      on: jest.fn(),
      off: jest.fn()
    }
  }
}));

describe('GitHubClient', () => {
  let client: GitHubClient;
  let mockOctokit: any;

  beforeEach(() => {
    // Reset singleton
    (GitHubClient as any)._instance = undefined;

    // Clear all mocks
    jest.clearAllMocks();

    // Get client instance
    client = GitHubClient.instance;

    // Get mock Octokit instance
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Octokit } = require('@octokit/rest');
    mockOctokit = new Octokit();
  });

  describe('initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = GitHubClient.instance;
      const instance2 = GitHubClient.instance;
      expect(instance1).toBe(instance2);
    });

    it('should listen for auth state changes', () => {
      expect(GitHubOAuthService.instance.on).toHaveBeenCalledWith(
        'auth-state-changed',
        expect.any(Function),
        expect.anything()
      );
    });

    it('should listen for disconnection', () => {
      expect(GitHubOAuthService.instance.on).toHaveBeenCalledWith(
        'disconnected',
        expect.any(Function),
        expect.anything()
      );
    });
  });

  describe('caching', () => {
    beforeEach(async () => {
      // Setup authenticated state
      (GitHubOAuthService.instance.isAuthenticated as jest.Mock).mockReturnValue(true);

      // Mock rate limit response
      mockOctokit.rateLimit.get.mockResolvedValue({
        data: {
          rate: {
            limit: 5000,
            remaining: 4999,
            reset: Math.floor(Date.now() / 1000) + 3600,
            used: 1
          }
        }
      });

      // Mock repo response
      mockOctokit.repos.get.mockResolvedValue({
        data: { id: 1, name: 'test-repo' },
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          'x-ratelimit-used': '1'
        }
      });

      // Initialize client
      await (client as any).initializeOctokit();
    });

    it('should cache API responses', async () => {
      // First call
      await client.getRepository('owner', 'repo');

      // Second call (should use cache)
      await client.getRepository('owner', 'repo');

      // API should only be called once
      expect(mockOctokit.repos.get).toHaveBeenCalledTimes(1);
    });

    it('should respect cache TTL', async () => {
      // First call
      await client.getRepository('owner', 'repo');

      // Wait for cache to expire (mock time)
      jest.useFakeTimers();
      jest.advanceTimersByTime(61000); // 61 seconds > 60 second TTL

      // Second call (cache expired)
      await client.getRepository('owner', 'repo');

      // API should be called twice
      expect(mockOctokit.repos.get).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should invalidate cache on mutations', async () => {
      // Mock issue responses
      mockOctokit.issues.listForRepo.mockResolvedValue({
        data: [{ id: 1, number: 1 }],
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4998',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          'x-ratelimit-used': '2'
        }
      });

      mockOctokit.issues.create.mockResolvedValue({
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

      // Should be called twice (once before create, once after)
      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache on disconnect', () => {
      // Add some cache entries
      (client as any).setCache('test-key', { data: 'test' });
      expect((client as any).cache.size).toBeGreaterThan(0);

      // Disconnect
      client.clearCache();

      // Cache should be empty
      expect((client as any).cache.size).toBe(0);
    });
  });

  describe('rate limiting', () => {
    beforeEach(async () => {
      (GitHubOAuthService.instance.isAuthenticated as jest.Mock).mockReturnValue(true);

      mockOctokit.rateLimit.get.mockResolvedValue({
        data: {
          rate: {
            limit: 5000,
            remaining: 4999,
            reset: Math.floor(Date.now() / 1000) + 3600,
            used: 1
          }
        }
      });

      await (client as any).initializeOctokit();
    });

    it('should track rate limit from response headers', async () => {
      mockOctokit.repos.get.mockResolvedValue({
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
      expect(rateLimit).toEqual({
        limit: 5000,
        remaining: 4500,
        reset: expect.any(Number),
        used: 500
      });
    });

    it('should emit warning when approaching rate limit', async () => {
      const warningListener = jest.fn();
      client.on('rate-limit-warning', warningListener, client);

      // Mock low remaining rate limit (9% = below 10% threshold)
      mockOctokit.repos.get.mockResolvedValue({
        data: { id: 1 },
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '450', // 9%
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          'x-ratelimit-used': '4550'
        }
      });

      await client.getRepository('owner', 'repo');

      expect(warningListener).toHaveBeenCalledWith({
        rateLimit: expect.objectContaining({
          remaining: 450,
          limit: 5000
        })
      });
    });

    it('should calculate time until rate limit reset', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      mockOctokit.repos.get.mockResolvedValue({
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
      (GitHubOAuthService.instance.isAuthenticated as jest.Mock).mockReturnValue(true);

      mockOctokit.rateLimit.get.mockResolvedValue({
        data: {
          rate: {
            limit: 5000,
            remaining: 4999,
            reset: Math.floor(Date.now() / 1000) + 3600,
            used: 1
          }
        }
      });

      await (client as any).initializeOctokit();
    });

    it('should handle 404 errors with friendly message', async () => {
      mockOctokit.repos.get.mockRejectedValue({
        status: 404,
        response: { data: { message: 'Not Found' } }
      });

      await expect(client.getRepository('owner', 'repo')).rejects.toThrow('Repository or resource not found.');
    });

    it('should handle 401 errors with friendly message', async () => {
      mockOctokit.repos.get.mockRejectedValue({
        status: 401,
        response: { data: { message: 'Unauthorized' } }
      });

      await expect(client.getRepository('owner', 'repo')).rejects.toThrow(
        'Authentication failed. Please reconnect your GitHub account.'
      );
    });

    it('should handle 403 rate limit errors', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 1800;

      // Set rate limit in client
      (client as any).rateLimit = {
        limit: 5000,
        remaining: 0,
        reset: resetTime,
        used: 5000
      };

      mockOctokit.repos.get.mockRejectedValue({
        status: 403,
        response: {
          data: {
            message: 'API rate limit exceeded'
          }
        }
      });

      await expect(client.getRepository('owner', 'repo')).rejects.toThrow(/Rate limit exceeded/);
    });

    it('should handle 422 validation errors', async () => {
      mockOctokit.issues.create.mockRejectedValue({
        status: 422,
        response: {
          data: {
            message: 'Validation Failed',
            errors: [{ field: 'title', code: 'missing' }]
          }
        }
      });

      await expect(client.createIssue('owner', 'repo', { title: '' })).rejects.toThrow(/Invalid request/);
    });
  });

  describe('API methods', () => {
    beforeEach(async () => {
      (GitHubOAuthService.instance.isAuthenticated as jest.Mock).mockReturnValue(true);

      mockOctokit.rateLimit.get.mockResolvedValue({
        data: {
          rate: {
            limit: 5000,
            remaining: 4999,
            reset: Math.floor(Date.now() / 1000) + 3600,
            used: 1
          }
        }
      });

      await (client as any).initializeOctokit();
    });

    it('should list issues with filters', async () => {
      mockOctokit.issues.listForRepo.mockResolvedValue({
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

      expect(result.data).toHaveLength(1);
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
      mockOctokit.issues.create.mockResolvedValue({
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
      mockOctokit.pulls.list.mockResolvedValue({
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

      (GitHubOAuthService.instance.isAuthenticated as jest.Mock).mockReturnValue(true);

      mockOctokit.rateLimit.get.mockResolvedValue({
        data: {
          rate: { limit: 5000, remaining: 4999, reset: Date.now() / 1000 + 3600, used: 1 }
        }
      });

      await (client as any).initializeOctokit();

      expect(client.isReady()).toBe(true);
    });

    it('should clear cache on demand', () => {
      (client as any).setCache('test-1', { data: 'value1' });
      (client as any).setCache('test-2', { data: 'value2' });

      expect((client as any).cache.size).toBe(2);

      client.clearCache();

      expect((client as any).cache.size).toBe(0);
    });
  });
});
