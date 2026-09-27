import type { z } from 'zod';
import { endpoints, type Operation, type Output } from './endpoints.js';
import { API_PREFIX, ERROR_STATUS, errorResponseSchema, parseQuery, type ApiErrorResponse } from './schemas.js';
import { fixtures } from './fixtures.js';
export { fixtures, fixtureItem, fixtureItems, fixtureTrade, fixtureUsers, FIXTURE_NOW } from './fixtures.js';
export type MockScenario<K extends Operation> = { data: Output<K> } | { error: ApiErrorResponse['error'] };
export type MockScenarios = { [K in Operation]?: MockScenario<K> };
export type MockHandlers = { [K in Operation]?: (input: z.output<(typeof endpoints)[K]['input']>, context: { signal: AbortSignal }) => MockScenario<K> | Promise<MockScenario<K>> };
/** Static defaults; callers may inject stateful handlers. No built-in business implementation. */
export function createMockFetch(options: { enabled: true; scenarios?: MockScenarios; handlers?: MockHandlers }): typeof globalThis.fetch {
  if (options.enabled !== true) throw new Error('Contract mock must be explicitly enabled');
  return async (input, init) => {
    const request = new Request(input instanceof Request ? input : new URL(input, 'http://contract.mock'), init);
    if (request.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const url = new URL(request.url);
    const respond = (data: unknown, status: number) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'X-Contract-Mock': 'true' } });
    const fail = (code: keyof typeof ERROR_STATUS, message: string) => respond({ error: { code, message, requestId: 'contract-mock' } }, ERROR_STATUS[code]);
    for (const operation of Object.keys(endpoints) as Operation[]) {
      const spec = endpoints[operation];
      const match = new RegExp(`^${API_PREFIX}${spec.path.replace('{id}', '([^/]+)')}$`).exec(url.pathname);
      if (request.method !== spec.method || !match) continue;
      let body: unknown;
      const raw = await request.text();
      try { body = raw ? JSON.parse(raw) : undefined; } catch { return fail('BAD_REQUEST', 'Invalid JSON'); }
      const query: Record<string, unknown> = {};
      for (const key of url.searchParams.keys()) {
        const values = url.searchParams.getAll(key);
        query[key] = values.length === 1 ? values[0] : values;
      }
      let parsed: z.output<(typeof endpoints)[Operation]['input']>;
      try {
        const normalizedQuery = parseQuery(spec.input.shape.query, query);
        parsed = spec.input.parse({ path: match[1] ? { id: decodeURIComponent(match[1]) } : {}, query: normalizedQuery, body });
      } catch { return fail('BAD_REQUEST', 'Request does not match contract'); }
      // The route selects matching request/handler types; mapped callbacks retain precise types for callers.
      const handler = options.handlers?.[operation] as ((input: typeof parsed, context: { signal: AbortSignal }) => MockScenario<Operation> | Promise<MockScenario<Operation>>) | undefined;
      const scenario = handler ? await handler(parsed, { signal: request.signal }) : options.scenarios?.[operation];
      if (request.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (scenario && 'error' in scenario) {
        const payload = errorResponseSchema.parse({ error: scenario.error });
        return respond(payload, ERROR_STATUS[payload.error.code]);
      }
      return respond(spec.output.parse(scenario?.data ?? fixtures[operation]), spec.status);
    }
    return fail('NOT_FOUND', 'No contract mock route');
  };
}
