import { endpoints, type Input, type Operation, type Output } from './endpoints.js';
import { API_PREFIX, ERROR_STATUS, errorResponseSchema, type ApiErrorResponse } from './schemas.js';
export class ApiClientError extends Error {
  constructor(readonly status: number, readonly error: ApiErrorResponse['error']) { super(error.message); this.name = 'ApiClientError'; }
}
export class ApiProtocolError extends Error {
  constructor(readonly status: number) { super('API response does not match the shared contract'); this.name = 'ApiProtocolError'; }
}
export interface ClientOptions { baseUrl?: string; fetch?: typeof globalThis.fetch }
export function createClient(options: ClientOptions = {}) {
  const transport = options.fetch ?? globalThis.fetch.bind(globalThis);
  const base = (options.baseUrl ?? API_PREFIX).replace(/\/$/, '');
  return {
    async call<K extends Operation>(operation: K, input: Input<K>, options: { signal?: AbortSignal } = {}): Promise<Output<K>> {
      const spec = endpoints[operation];
      const parsed = spec.input.parse(input);
      let path = spec.path;
      for (const [key, value] of Object.entries(parsed.path)) path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(parsed.query)) if (value !== undefined) query.set(key, String(value));
      const response = await transport(`${base}${path}${query.size ? `?${query}` : ''}`, {
        method: spec.method, credentials: 'same-origin', signal: options.signal,
        ...(parsed.body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.body) }),
      });
      let json: unknown;
      try { json = await response.json(); } catch { throw new ApiProtocolError(response.status); }
      if (!response.ok) {
        const failure = errorResponseSchema.safeParse(json);
        if (!failure.success || ERROR_STATUS[failure.data.error.code] !== response.status) throw new ApiProtocolError(response.status);
        throw new ApiClientError(response.status, failure.data.error);
      }
      const result = spec.output.safeParse(json);
      if (response.status !== spec.status || !result.success) throw new ApiProtocolError(response.status);
      return result.data as Output<K>;
    },
  };
}
export type ApiClient = ReturnType<typeof createClient>;
