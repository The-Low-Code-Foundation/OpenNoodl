/**
 * Claude API Client for Component Migration
 *
 * Handles communication with Anthropic's Claude API for
 * AI-assisted React component migration.
 *
 * @module migration/claudeClient
 */

import type { MigrationIssue } from '../../models/migration/types';
import { MIGRATION_SYSTEM_PROMPT, HELP_PROMPT_TEMPLATE } from './claudePrompts';

export interface AIPreferences {
  preferFunctional: boolean;
  preserveComments: boolean;
  verboseOutput: boolean;
}

export interface MigrationRequest {
  code: string;
  issues: MigrationIssue[];
  componentName: string;
  preferences: AIPreferences;
  previousAttempt?: {
    code: string | null;
    error: string;
  };
}

export interface MigrationResponse {
  success: boolean;
  code: string | null;
  changes: string[];
  warnings: string[];
  confidence: number;
  reason?: string;
  suggestion?: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  cost: number;
}

export interface HelpRequest {
  originalCode: string;
  attempts: number;
  attemptHistory: Array<{
    code: string | null;
    error: string;
  }>;
}

export class ClaudeClient {
  private client: any;
  private model = 'claude-sonnet-4-20250514';

  // Pricing per 1M tokens (as of Dec 2024)
  private pricing = {
    input: 3.0, // $3 per 1M input tokens
    output: 15.0 // $15 per 1M output tokens
  };

  constructor(apiKey: string) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Anthropic = require('@anthropic-ai/sdk');
    this.client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true // Safe in Electron - code runs locally, not in public browser
    });
  }

  async migrateComponent(request: MigrationRequest): Promise<MigrationResponse> {
    const userPrompt = this.buildUserPrompt(request);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: MIGRATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const tokensUsed = {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens
    };

    const cost = this.calculateCost(tokensUsed);

    // Parse the response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    try {
      const parsed = this.parseResponse(content.text);
      return {
        ...parsed,
        tokensUsed,
        cost
      };
    } catch (parseError) {
      return {
        success: false,
        code: null,
        changes: [],
        warnings: [],
        confidence: 0,
        reason: 'Failed to parse AI response',
        suggestion: content.text.slice(0, 500), // Include raw response for debugging
        tokensUsed,
        cost
      };
    }
  }

  async getHelp(request: HelpRequest): Promise<string> {
    const prompt = HELP_PROMPT_TEMPLATE.replace('{attempts}', String(request.attempts))
      .replace('{originalCode}', request.originalCode)
      .replace('{attemptHistory}', request.attemptHistory.map((a, i) => `Attempt ${i + 1}: ${a.error}`).join('\n'));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return content.text;
  }

  private buildUserPrompt(request: MigrationRequest): string {
    let prompt = `Migrate this React component to React 19:\n\n`;
    prompt += `Component: ${request.componentName}\n\n`;
    prompt += `Issues detected:\n`;
    request.issues.forEach((issue) => {
      prompt += `- ${issue.type} at line ${issue.location.line}: ${issue.description}\n`;
    });
    prompt += `\nCode:\n\`\`\`javascript\n${request.code}\n\`\`\`\n`;

    if (request.preferences.preferFunctional) {
      prompt += `\nPreference: Convert to functional component with hooks if clean.\n`;
    }

    if (request.previousAttempt) {
      prompt += `\n--- RETRY ---\n`;
      prompt += `Previous attempt failed: ${request.previousAttempt.error}\n`;
      if (request.previousAttempt.code) {
        prompt += `Previous code:\n\`\`\`javascript\n${request.previousAttempt.code}\n\`\`\`\n`;
      }
      prompt += `Please try a different approach.\n`;
    }

    return prompt;
  }

  private parseResponse(text: string): Omit<MigrationResponse, 'tokensUsed' | 'cost'> {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      success: parsed.success ?? false,
      code: parsed.code ?? null,
      changes: parsed.changes ?? [],
      warnings: parsed.warnings ?? [],
      confidence: parsed.confidence ?? 0,
      reason: parsed.reason,
      suggestion: parsed.suggestion
    };
  }

  private calculateCost(tokens: { input: number; output: number }): number {
    const inputCost = (tokens.input / 1_000_000) * this.pricing.input;
    const outputCost = (tokens.output / 1_000_000) * this.pricing.output;
    return inputCost + outputCost;
  }

  estimateCost(codeLength: number): number {
    // Rough estimation: ~4 chars per token
    const estimatedInputTokens = codeLength / 4 + 1000; // +1000 for system prompt
    const estimatedOutputTokens = (codeLength / 4) * 1.5; // Output usually larger

    return this.calculateCost({
      input: estimatedInputTokens,
      output: estimatedOutputTokens
    });
  }
}
