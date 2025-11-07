export type ApiErrorCode =
  | 'INVALID_REQUEST'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR';

export interface ApiErrorPayload {
  error?: string;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
  retryAfterSeconds?: number;
  providerStatus?: unknown;
}

export interface ApiErrorResponse {
  statusCode: number;
  payload: ApiErrorPayload;
}

export function buildRateLimitError(retryAfterSeconds: number): ApiErrorResponse {
  return {
    statusCode: 429,
    payload: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again shortly.',
      retryAfterSeconds,
    },
  };
}

export function buildProviderError(
  message: string,
  providerStatus?: unknown,
  details?: unknown,
): ApiErrorResponse {
  return {
    statusCode: 502,
    payload: {
      code: 'PROVIDER_ERROR',
      message,
      providerStatus,
      details,
    },
  };
}

export function buildInternalError(details?: unknown): ApiErrorResponse {
  return {
    statusCode: 500,
    payload: {
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server error.',
      details,
    },
  };
}

export function buildValidationError(message: string, details?: unknown): ApiErrorResponse {
  return {
    statusCode: 400,
    payload: {
      error: 'Validation failed',
      code: 'INVALID_REQUEST',
      message,
      details,
    },
  };
}
