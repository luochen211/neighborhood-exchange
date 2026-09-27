# Shared API contract

This package freezes the SRS wire protocol for Issue #3. It supplies schemas/types, 23 endpoint definitions, a typed fetch client and **static contract examples**, not a backend. Database/auth/transaction enforcement and real model calls remain downstream work.

## Frontend client

```ts
import { createClient, ApiClientError } from '@neighborhood/contracts';
const api = createClient(); // /api/v1; same-origin cookies; no retry
const result = await api.call('listItems', {
  path: {}, query: { q: '灯', tradeMode: 'FREE' }, body: undefined,
});
// result.data: Item[]; result.page.nextCursor: string | null
await api.call('wantItem', {
  path: { id: result.data[0]!.id }, query: {}, body: undefined,
});
```

`call` accepts `Input<K>`, returns `Output<K>` including the envelope, validates both directions, and accepts `{signal}` as the third argument. Use empty path/query objects and `body: undefined` when absent. `limit` is a number (default 20, maximum 50). Cursor is opaque. Read response `serverNow` for freshness timing. `ApiClientError` has `status` and `error.{code,message,fieldErrors?,requestId}`. Malformed payload/status combinations raise `ApiProtocolError`; network errors and cancellation propagate. There are no automatic retries, including create item/trade and AI. Uncertain write results must be checked through “my” reads.

Operations: `health`, `demoUsers`, `demoLogin`, `logout`, `me`, `listItems`, `createItem`, `getItem`, `myItems`, `myInterests`, `wantItem`, `withdrawInterest`, `itemInterests`, `listComments`, `createComment`, `createTrade`, `myTrades`, `getTrade`, `confirmTrade`, `cancelTrade`, `completeTrade`, `dashboard`, `assistListing`.

## Explicit mock for feature tests/development

```ts
import { createClient } from '@neighborhood/contracts';
import { createMockFetch, fixtureItems } from '@neighborhood/contracts/mock';
const api = createClient({ fetch: createMockFetch({
  enabled: true,
  scenarios: {
    listItems: { data: { data: [fixtureItems[2]!], page: { nextCursor: null } } },
    assistListing: { error: { code: 'AI_TIMEOUT', message: '生成超时，请重试', requestId: 'mock-timeout' } },
  },
}) });
```

For multi-step UI tests, pass `handlers: { wantItem: async (input, {signal}) => ({data: {data: {active: true, count: 1}}}) }`. Each operation handler receives validated input, may maintain closure state, and returns either `{data: Output<K>}` (including the API envelope) or `{error: ...}`. Handlers override static scenarios and their results are also schema-validated. Use handlers for identity switching, publication, reservation/confirmation/cancellation and cache refresh tests without claiming backend business acceptance.

The mock is a separate package export; the ordinary package entry does not import it. No application imports or enables it in this PR. Feature tests may inject it; development integration must explicitly gate it to development, never select it as a fallback for failed production requests. Responses include `X-Contract-Mock: true`. Unknown routes fail locally and never contact a real server.

Mocks validate requests and responses but intentionally do **not** implement sessions, roles, search, pagination, state changes, persistence or AI. Set the scenario explicitly for each UI state; e.g. archive, empty list, next cursor, owner/visitor, error, cancelled or completed. Default fixture dates are fixed at `FIXTURE_NOW`; freeze the test clock accordingly. They are not proof of backend acceptance. Use actual API tests for business behavior.

## Backend use and stable values

- `SESSION_COOKIE_NAME = neighborhood_session`; Path=/, HttpOnly, SameSite=Lax, 24h; Secure over HTTPS. Do not return tokens in JSON. #4 owns implementation.
- `IMAGE_KEYS = chair | lamp | cooker | books`; #9 supplies corresponding local preset visuals. Keys are not URLs and do not imply upload support.
- Use the exported strict schemas, `endpoints`, `ERROR_STATUS`, DTO types and response helpers. No client-supplied owner/author fields.
- `parseQuery(schema, rawQuery)` accepts only digit-only HTTP limit strings; unknown keys/repeated values are rejected by strict schemas. Do not let framework coercion silently normalize malformed values first.
- `validateTradeWindow(body, serverNow)` checks the future/seven-day boundary. Call it again in the write transaction, alongside roles, effective interest, current state, unique constraints and conditional updates.
- Item DTO contains no trade details; obtain private trade fields only through authorized trade endpoints. Public comments contain author summaries. `myInterests` wraps `{id,item,createdAt}`; `itemInterests` exposes flattened user summary plus createdAt. All list envelopes, including demo users, have `page.nextCursor` (null for demo users).
- All cancellation/confirmation/completion endpoints return the same full Trade DTO; it includes `itemId`. The relevant service must enforce the correct resulting state and idempotence before responding.

## OpenAPI and checks

`docs/engineering/openapi.yaml` is generated JSON, valid YAML 1.2/OpenAPI 3.1. Regenerate with `npm run generate:openapi -w @neighborhood/contracts`. The test suite compares the generated document to the checked-in file and exercises every operation through client/mock, plus price/time/privacy/error boundaries. Run root `npm run check`.

Zod exports structural constraints as JSON Schema 2020-12. Cross-field refinements (trade timestamp/status consistency, meeting order/window, GIVEN/givenAt, and AI min <= max) are enforced by the exported runtime schemas and documented in SRS; OpenAPI tooling alone does not enforce them. Authorization, clock-dependent validation and transaction rules always remain server responsibilities. If the contract changes, update SRS first, regenerate OpenAPI, and coordinate #4/#9/#10 plus affected API modules before adoption.
