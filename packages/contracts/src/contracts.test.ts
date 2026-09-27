import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as s from './schemas.js';
import { endpoints, type Input, type Operation } from './endpoints.js';
import { ApiClientError, ApiProtocolError, createClient } from './client.js';
import { createMockFetch, fixtureItem, fixtureItems, fixtures, fixtureTrade, fixtureUsers, FIXTURE_NOW } from './mock.js';
import { buildOpenApi } from './openapi.js';
const itemInput = { title: ' 台灯 ', description: '功能正常', tradeMode: 'FREE' as const, priceCents: 0, imageKey: 'lamp' as const, pickupBuilding: '1栋' };
const tradeInput = { recipientId: fixtureUsers[1]!.id, meetingStart: fixtureTrade.meetingStart, meetingEnd: fixtureTrade.meetingEnd, meetingPlace: '活动室' };
function inputFor(operation: Operation): Input<Operation> {
  const e = endpoints[operation];
  const bodies: Partial<Record<Operation, unknown>> = {
    demoLogin: { userId: fixtureUsers[0]!.id }, createItem: itemInput, createComment: { body: '请问还在吗' }, createTrade: tradeInput, assistListing: { title: '台灯', description: '功能正常' },
  };
  return e.input.parse({ path: e.path.includes('{id}') ? { id: e.path.startsWith('/trades/') ? fixtureTrade.id : fixtureItem.id } : {}, query: {}, body: bodies[operation] });
}
describe('input and privacy invariants', () => {
  it('trims and enforces all price modes without accepting owner injection', () => {
    expect(s.createItemSchema.parse(itemInput).title).toBe('台灯');
    for (const change of [{ priceCents: 1 }, { ownerId: fixtureUsers[0]!.id }, { imageKey: 'https://example.com/x' }, { title: ' ' }, { title: 'x'.repeat(61) }, { description: 'x'.repeat(2001) }]) expect(s.createItemSchema.safeParse({ ...itemInput, ...change }).success).toBe(false);
    for (const priceCents of [0, -1, 1.5, 9_999_901, '100']) expect(s.createItemSchema.safeParse({ ...itemInput, tradeMode: 'FIXED', priceCents }).success).toBe(false);
    for (const priceCents of [1, 9_999_900]) expect(s.createItemSchema.parse({ ...itemInput, tradeMode: 'FIXED', priceCents }).priceCents).toBe(priceCents);
    expect(s.createItemSchema.parse({ ...itemInput, tradeMode: 'FLEXIBLE', priceCents: null }).priceCents).toBeNull();
    expect(s.createItemSchema.safeParse({ ...itemInput, tradeMode: 'FLEXIBLE' }).success).toBe(false);
  });
  it('normalizes only valid HTTP limits and rejects unknown/repeated query fields', () => {
    expect(s.parseQuery(s.itemQuerySchema, { limit: '50', q: ' 灯 ' })).toEqual({ limit: 50, q: '灯', scope: 'active' });
    expect(s.parseQuery(s.paginationSchema, {})).toEqual({ limit: 20 });
    for (const limit of ['0', '51', '1.5', '1e1', ' 2 ', '', ['2', '3'], null]) expect(() => s.parseQuery(s.paginationSchema, { limit })).toThrow();
    expect(() => s.parseQuery(s.itemQuerySchema, { ownerId: fixtureUsers[0]!.id })).toThrow();
  });
  it('enforces seven-day creation bounds using an injected server clock', () => {
    const now = new Date(FIXTURE_NOW);
    expect(s.validateTradeWindow(tradeInput, now)).toEqual(tradeInput);
    for (const meetingStart of [FIXTURE_NOW, '2026-09-26T02:00:00Z', '2026-09-28T03:00:00Z']) expect(() => s.validateTradeWindow({ ...tradeInput, meetingStart }, now)).toThrow();
    expect(() => s.validateTradeWindow({ ...tradeInput, meetingEnd: '2026-10-04T02:00:00.001Z' }, now)).toThrow();
    expect(s.validateTradeWindow({ ...tradeInput, meetingEnd: '2026-10-04T02:00:00.000Z' }, now)).toBeDefined();
    expect(s.timestampSchema.safeParse('2026-09-28T01:00:00').success).toBe(false);
  });
  it('rejects leaked private fields and contradictory item/trade states', () => {
    for (const value of fixtureItems) expect(s.itemSchema.parse(value)).toEqual(value);
    for (const field of ['token', 'session', 'meetingPlace']) expect(s.itemSchema.safeParse({ ...fixtureItem, [field]: 'private' }).success).toBe(false);
    expect(s.itemSchema.safeParse({ ...fixtureItem, status: 'GIVEN' }).success).toBe(false);
    expect(s.tradeSchema.safeParse({ ...fixtureTrade, status: 'COMPLETED' }).success).toBe(false);
    expect(s.tradeSchema.safeParse({ ...fixtureTrade, recipient: fixtureTrade.owner }).success).toBe(false);
    expect(s.tradeSchema.safeParse({ ...fixtures.cancelTrade.data, cancelledBy: fixtureUsers[2]!.id }).success).toBe(false);
  });
  it('validates AI range, fixed disclaimer and bounded missing information', () => {
    const ai = fixtures.assistListing.data;
    for (const change of [{ suggestedPriceRangeCents: { min: 6000, max: 3000 } }, { disclaimer: '保证准确' }, { missingInfo: Array(6).fill('型号') }, { suggestedTradeMode: 'FREE' }, { token: 'private' }]) expect(s.aiSuggestionSchema.safeParse({ ...ai, ...change }).success).toBe(false);
    expect(s.aiSuggestionSchema.parse({ ...ai, suggestedTradeMode: 'FREE', suggestedPriceRangeCents: { min: 0, max: 0 } })).toBeDefined();
    expect(s.aiSuggestionSchema.parse({ ...ai, suggestedTradeMode: 'FLEXIBLE', suggestedPriceRangeCents: null })).toBeDefined();
  });
});
describe('all endpoint contracts', () => {
  for (const operation of Object.keys(endpoints) as Operation[]) it(`${operation} validates example, client request and mock response`, async () => {
    const transport = vi.fn(createMockFetch({ enabled: true }));
    const result = await createClient({ fetch: transport }).call(operation, inputFor(operation));
    expect(result).toEqual(fixtures[operation]);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0]![1]?.credentials).toBe('same-origin');
    expect(endpoints[operation].output.parse(fixtures[operation])).toEqual(fixtures[operation]);
  });
  for (const [code, status] of Object.entries(s.ERROR_STATUS)) it(`preserves ${code} error envelope and HTTP status`, async () => {
    const error = { code: code as s.ErrorCode, message: '公开错误说明', fieldErrors: { title: ['请输入标题'] }, requestId: 'fixture-request' };
    const client = createClient({ fetch: createMockFetch({ enabled: true, scenarios: { assistListing: { error } } }) });
    await expect(client.call('assistListing', inputFor('assistListing'))).rejects.toMatchObject({ status, error });
  });
  it('generated OpenAPI covers all operations, schemas and fixtures without drift', () => {
    const document = buildOpenApi();
    expect(JSON.parse(readFileSync(new URL('../../../docs/engineering/openapi.yaml', import.meta.url), 'utf8'))).toEqual(document);
    expect(Object.values(document.paths).flatMap(path => Object.keys(path))).toHaveLength(23);
    expect(document.components.securitySchemes.cookieAuth.name).toBe(s.SESSION_COOKIE_NAME);
    expect(document.openapi).toBe('3.1.0');
  });
});
describe('transport failure and explicit mock boundaries', () => {
  it('returns structured errors without retrying writes or AI requests', async () => {
    const error = { code: 'CONFLICT' as const, message: '状态已变化，请刷新', requestId: 'request-1' };
    const fetch = vi.fn(createMockFetch({ enabled: true, scenarios: { createItem: { error } } }));
    await expect(createClient({ fetch }).call('createItem', inputFor('createItem'))).rejects.toMatchObject({ status: 409, error });
    expect(fetch).toHaveBeenCalledTimes(1);
    const failed = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('network'));
    await expect(createClient({ fetch: failed }).call('assistListing', inputFor('assistListing'))).rejects.toThrow('network');
    expect(failed).toHaveBeenCalledTimes(1);
  });
  it('supports explicit empty and archive fixtures', async () => {
    const client = createClient({ fetch: createMockFetch({ enabled: true, scenarios: { listItems: { data: { data: [], page: { nextCursor: null } } } } }) });
    expect((await client.call('listItems', { path: {}, query: { scope: 'archive' }, body: undefined })).data).toEqual([]);
  });
  it('allows typed stateful handlers for UI interactions and validates their responses', async () => {
    let wanted = false;
    const client = createClient({ fetch: createMockFetch({ enabled: true, handlers: {
      wantItem: ({ path }) => { expect(path.id).toBe(fixtureItem.id); wanted = true; return { data: { data: { active: true, count: 1 } } }; },
      withdrawInterest: () => { wanted = false; return { data: { data: { active: false, count: 0 } } }; },
      getItem: async () => ({ data: { data: { ...fixtureItem, viewerHasInterest: wanted, interestCount: wanted ? 1 : 0 } } }),
    } }) });
    const input = { path: { id: fixtureItem.id }, query: {}, body: undefined };
    expect((await client.call('getItem', input)).data.viewerHasInterest).toBe(false);
    await client.call('wantItem', input);
    expect((await client.call('getItem', input)).data.viewerHasInterest).toBe(true);
    await client.call('withdrawInterest', input);
    expect((await client.call('getItem', input)).data.viewerHasInterest).toBe(false);
  });
  it('rejects invalid mock calls, never falling through to a real network', async () => {
    const fetch = createMockFetch({ enabled: true });
    expect((await fetch('/api/v1/items?limit=2&limit=3')).status).toBe(400);
    expect((await fetch('/api/v1/items', { method: 'POST', body: '{' })).status).toBe(400);
    expect((await fetch('/api/v1/not-a-route')).status).toBe(404);
    expect(() => createMockFetch({ enabled: false as unknown as true })).toThrow('explicitly');
  });
  it('rejects invalid successful/error payloads and preserves cancellation', async () => {
    for (const [status, payload] of [[200, { data: { ...fixtureItem, token: 'secret' } }], [200, {}], [500, { stack: 'private' }], [201, fixtures.getItem]] as const) {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify(payload), { status }));
      await expect(createClient({ fetch }).call('getItem', { path: { id: fixtureItem.id }, query: {}, body: undefined })).rejects.toBeInstanceOf(ApiProtocolError);
    }
    const controller = new AbortController(); controller.abort();
    await expect(createClient({ fetch: createMockFetch({ enabled: true }) }).call('me', inputFor('me'), { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    const client = createClient({ fetch: createMockFetch({ enabled: true, scenarios: { me: { error: { code: 'UNAUTHORIZED', message: '请选择身份', requestId: 'mock' } } } }) });
    await expect(client.call('me', inputFor('me'))).rejects.toBeInstanceOf(ApiClientError);
  });
});
