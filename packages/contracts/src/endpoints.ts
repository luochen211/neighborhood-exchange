import { z } from 'zod';
import * as s from './schemas.js';
const empty = z.strictObject({});
const itemPath = z.strictObject({ id: s.idSchema });
const args = <P extends z.ZodType, Q extends z.ZodType, B extends z.ZodType>(path: P, query: Q, body: B) => z.strictObject({ path, query, body });
const noBody = z.undefined();
const plain = args(empty, empty, noBody);
const paged = args(empty, s.paginationSchema, noBody);
const byId = args(itemPath, empty, noBody);
const idPaged = args(itemPath, s.paginationSchema, noBody);
const body = <B extends z.ZodType>(b: B) => args(empty, empty, b);
const idBody = <B extends z.ZodType>(b: B) => args(itemPath, empty, b);
function endpoint<I extends z.ZodType, O extends z.ZodType>(method: 'GET'|'POST'|'PUT'|'DELETE', path: string, input: I, output: O, auth: 'public'|'session'|'demo'|'optional', status = 200, description = '') {
  return { method, path, input, output, auth, status, description };
}
export const endpoints = {
  health: endpoint('GET', '/health', plain, s.dataResponse(z.strictObject({ status: z.literal('ok'), database: z.literal('ok') })), 'public', 200, 'API and database readiness; failure is SERVICE_UNAVAILABLE 503.'),
  demoUsers: endpoint('GET', '/demo/users', plain, s.listResponse(s.userSchema), 'demo'),
  demoLogin: endpoint('POST', '/auth/demo-login', body(z.strictObject({ userId: s.idSchema })), s.dataResponse(s.userSchema), 'demo'),
  logout: endpoint('POST', '/auth/logout', plain, s.dataResponse(z.strictObject({ loggedOut: z.literal(true) })), 'optional', 200, 'Idempotent even without an active session; clears cookie.'),
  me: endpoint('GET', '/auth/me', plain, s.dataResponse(s.userSchema), 'session'),
  listItems: endpoint('GET', '/items', args(empty, s.itemQuerySchema, noBody), s.listResponse(s.itemSchema), 'public', 200, 'Default active includes AVAILABLE/RESERVED. archive includes GIVEN. Search and filters use AND. Order createdAt DESC,id DESC.'),
  createItem: endpoint('POST', '/items', body(s.createItemSchema), s.dataResponse(s.itemSchema), 'session', 201, 'Not automatically retried; owner inferred from session.'),
  getItem: endpoint('GET', '/items/{id}', byId, s.dataResponse(s.itemSchema), 'public'),
  myItems: endpoint('GET', '/me/items', paged, s.listResponse(s.itemSchema), 'session'),
  myInterests: endpoint('GET', '/me/interests', paged, s.listResponse(s.myInterestSchema), 'session', 200, 'Active interests including archived items; order interest createdAt DESC,id DESC.'),
  wantItem: endpoint('PUT', '/items/{id}/interest', byId, s.dataResponse(z.strictObject({ active: z.literal(true), count: z.number().int().nonnegative() })), 'session', 200, 'Non-owner, AVAILABLE only. Idempotent.'),
  withdrawInterest: endpoint('DELETE', '/items/{id}/interest', byId, s.dataResponse(z.strictObject({ active: z.literal(false), count: z.number().int().nonnegative() })), 'session', 200, 'Non-owner, AVAILABLE only. Idempotent.'),
  itemInterests: endpoint('GET', '/items/{id}/interests', idPaged, s.listResponse(s.interestUserSchema), 'session', 200, 'Owner only; active interests; createdAt DESC,id DESC.'),
  listComments: endpoint('GET', '/items/{id}/comments', idPaged, s.listResponse(s.commentSchema), 'public', 200, 'Order createdAt ASC,id ASC.'),
  createComment: endpoint('POST', '/items/{id}/comments', idBody(s.createCommentSchema), s.dataResponse(s.commentSchema), 'session', 201, 'GIVEN is read-only; RESERVED permits comments.'),
  createTrade: endpoint('POST', '/items/{id}/trades', idBody(s.createTradeSchema), s.dataResponse(s.tradeSchema), 'session', 201, 'Owner; AVAILABLE; recipient has active interest. now < meetingStart < meetingEnd <= now+7d. Recheck in transaction. No automatic retry.'),
  myTrades: endpoint('GET', '/me/trades', args(empty, s.tradeQuerySchema, noBody), s.listResponse(s.tradeSchema), 'session', 200, 'Both roles, optional status; order createdAt DESC,id DESC.'),
  getTrade: endpoint('GET', '/trades/{id}', byId, s.dataResponse(s.tradeSchema), 'session', 200, 'Parties only; third parties receive 403.'),
  confirmTrade: endpoint('POST', '/trades/{id}/confirm', byId, s.dataResponse(s.tradeSchema), 'session', 200, 'Recipient only: PENDING to CONFIRMED; same-target retry returns original record.'),
  cancelTrade: endpoint('POST', '/trades/{id}/cancel', byId, s.dataResponse(s.tradeSchema), 'session', 200, 'Either party: PENDING/CONFIRMED to CANCELLED; restore AVAILABLE. Retry never affects a newer trade.'),
  completeTrade: endpoint('POST', '/trades/{id}/complete', byId, s.dataResponse(s.tradeSchema), 'session', 200, 'Owner only: CONFIRMED to COMPLETED and item GIVEN. Same-target retry preserves completedAt. Response includes itemId.'),
  dashboard: endpoint('GET', '/dashboard', plain, s.dataResponse(s.dashboardSchema), 'public'),
  assistListing: endpoint('POST', '/ai/listing-assistance', body(s.aiRequestSchema), s.dataResponse(s.aiSuggestionSchema), 'session', 200, '15s timeout, no automatic retry, 5/user/min and 10/IP/min. Failure preserves manual draft; never fabricates success.'),
} as const;
export type Operation = keyof typeof endpoints;
export type Input<K extends Operation> = z.input<(typeof endpoints)[K]['input']>;
export type Output<K extends Operation> = z.output<(typeof endpoints)[K]['output']>;
