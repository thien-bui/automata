import { describe, expect, it } from 'vitest';

import {
  buildInternalError,
  buildProviderError,
  buildRateLimitError,
  buildValidationError,
} from '../src/utils/errors';

describe('error builders', () => {
  it('builds rate limit error with retry hint', () => {
    const result = buildRateLimitError(42);

    expect(result.statusCode).toBe(429);
    expect(result.payload).toEqual({
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again shortly.',
      retryAfterSeconds: 42,
    });
  });

  it('builds provider error with optional status metadata', () => {
    const providerStatus = { reason: 'test' };
    const extra = { attempt: 1 };

    const result = buildProviderError('failed', providerStatus, extra);

    expect(result.statusCode).toBe(502);
    expect(result.payload).toEqual({
      code: 'PROVIDER_ERROR',
      message: 'failed',
      providerStatus,
      details: extra,
    });
  });

  it('builds internal error with details', () => {
    const details = { stack: 'trace' };
    const result = buildInternalError(details);

    expect(result.statusCode).toBe(500);
    expect(result.payload).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server error.',
      details,
    });
  });

  it('builds validation error with flattened issues', () => {
    const issues = { fieldErrors: { from: ['required'] } };

    const result = buildValidationError('invalid', issues);

    expect(result.statusCode).toBe(400);
    expect(result.payload).toEqual({
      error: 'Validation failed',
      code: 'INVALID_REQUEST',
      message: 'invalid',
      details: issues,
    });
  });
});
