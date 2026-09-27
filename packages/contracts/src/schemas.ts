import { z } from 'zod';

export const API_PREFIX = '/api/v1';
export const SESSION_COOKIE_NAME = 'neighborhood_session';
export const IMAGE_KEYS = ["chair", "lamp", "cooker", "books", "stroller", "monstera", "rice-cooker", "electric-kettle", "table-fan", "toaster", "coffee-maker", "vacuum-cleaner", "side-table", "bookshelf", "office-chair", "shoe-rack", "floor-lamp", "storage-basket", "picture-books", "building-blocks", "baby-high-chair", "balance-bike", "yoga-mat", "dumbbells", "badminton-rackets", "camping-chair", "suitcase", "guitar", "ceramic-vase", "succulents"] as const;
export const AI_DISCLAIMER = '基于描述的 AI 建议，非市场行情估价';
export const idSchema = z.uuid();
export const timestampSchema = z.iso.datetime({ offset: true });
const text = (max: number) => z.string().trim().min(1).max(max);
const count = z.number().int().nonnegative();
export const tradeModeSchema = z.enum(['FREE', 'FLEXIBLE', 'FIXED']);
export const itemStatusSchema = z.enum(['AVAILABLE', 'RESERVED', 'GIVEN']);
export const tradeStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']);
export const imageKeySchema = z.enum(IMAGE_KEYS);
export const priceCentsSchema = z.number().int().min(1).max(9_999_900);
export const userSchema = z.strictObject({ id: idSchema, nickname: text(30), building: text(30) });
const itemInputFields = { title: text(60), description: text(2000), imageKey: imageKeySchema, pickupBuilding: text(30) };
const pricing = [
  { tradeMode: z.literal('FREE'), priceCents: z.literal(0) },
  { tradeMode: z.literal('FLEXIBLE'), priceCents: z.null() },
  { tradeMode: z.literal('FIXED'), priceCents: priceCentsSchema },
] as const;
export const createItemSchema = z.discriminatedUnion('tradeMode', [
  z.strictObject({ ...itemInputFields, ...pricing[0] }),
  z.strictObject({ ...itemInputFields, ...pricing[1] }),
  z.strictObject({ ...itemInputFields, ...pricing[2] }),
]);
const itemFields = {
  ...itemInputFields, id: idSchema, owner: userSchema, status: itemStatusSchema,
  createdAt: timestampSchema, givenAt: timestampSchema.nullable(), interestCount: count,
  viewerHasInterest: z.boolean(), freshnessLabel: text(100), serverNow: timestampSchema,
};
export const itemSchema = z.discriminatedUnion('tradeMode', [
  z.strictObject({ ...itemFields, ...pricing[0] }),
  z.strictObject({ ...itemFields, ...pricing[1] }),
  z.strictObject({ ...itemFields, ...pricing[2] }),
]).refine(i => (i.status === 'GIVEN') === (i.givenAt !== null), { message: 'givenAt must exist exactly when GIVEN', path: ['givenAt'] });
export const commentSchema = z.strictObject({ id: idSchema, itemId: idSchema, author: userSchema, body: text(500), createdAt: timestampSchema });
export const interestUserSchema = userSchema.extend({ createdAt: timestampSchema });
export const myInterestSchema = z.strictObject({ id: idSchema, item: itemSchema, createdAt: timestampSchema });
export const createCommentSchema = z.strictObject({ body: text(500) });
export const createTradeSchema = z.strictObject({ recipientId: idSchema, meetingStart: timestampSchema, meetingEnd: timestampSchema, meetingPlace: text(100) })
  .refine(t => Date.parse(t.meetingEnd) > Date.parse(t.meetingStart), { message: 'meetingEnd must follow meetingStart', path: ['meetingEnd'] });
// Call inside the creation transaction with the same server clock used for the write.
export function validateTradeWindow(input: unknown, now: Date) {
  return createTradeSchema.refine(t => Date.parse(t.meetingStart) > now.getTime() && Date.parse(t.meetingEnd) <= now.getTime() + 7 * 86400000,
    { message: 'Meeting must be in the next seven days', path: ['meetingStart'] }).parse(input);
}
export const tradeSchema = z.strictObject({
  id: idSchema, itemId: idSchema, owner: userSchema, recipient: userSchema,
  status: tradeStatusSchema, meetingStart: timestampSchema, meetingEnd: timestampSchema, meetingPlace: text(100),
  createdAt: timestampSchema, confirmedAt: timestampSchema.nullable(), completedAt: timestampSchema.nullable(),
  cancelledAt: timestampSchema.nullable(), cancelledBy: idSchema.nullable(),
}).superRefine((t, ctx) => {
  const valid = {
    PENDING: !t.confirmedAt && !t.completedAt && !t.cancelledAt && !t.cancelledBy,
    CONFIRMED: !!t.confirmedAt && !t.completedAt && !t.cancelledAt && !t.cancelledBy,
    COMPLETED: !!t.confirmedAt && !!t.completedAt && !t.cancelledAt && !t.cancelledBy,
    CANCELLED: !!t.cancelledAt && !!t.cancelledBy && !t.completedAt,
  }[t.status];
  if (!valid) ctx.addIssue({ code: 'custom', message: 'Trade timestamps disagree with status' });
  if (Date.parse(t.meetingEnd) <= Date.parse(t.meetingStart)) ctx.addIssue({ code: 'custom', path: ['meetingEnd'], message: 'Invalid meeting window' });
  if (t.owner.id === t.recipient.id) ctx.addIssue({ code: 'custom', path: ['recipient'], message: 'Owner cannot be recipient' });
  if (t.cancelledBy && ![t.owner.id, t.recipient.id].includes(t.cancelledBy)) ctx.addIssue({ code: 'custom', path: ['cancelledBy'], message: 'Only a party may cancel' });
});
export const paginationSchema = z.strictObject({ cursor: z.string().min(1).max(2048).optional(), limit: z.number().int().min(1).max(50).default(20) });
export const itemQuerySchema = paginationSchema.extend({ q: z.string().trim().max(100).optional(), tradeMode: tradeModeSchema.optional(), scope: z.enum(['active', 'archive']).default('active') });
export const tradeQuerySchema = paginationSchema.extend({ status: tradeStatusSchema.optional() });
// HTTP adapters convert only digit-only limit strings; never coerce malformed input.
export function parseQuery<S extends z.ZodType>(schema: S, raw: Record<string, unknown>): z.output<S> {
  const input = { ...raw };
  if (typeof input.limit === 'string' && /^[1-9]\d*$/.test(input.limit)) input.limit = Number(input.limit);
  return schema.parse(input);
}
export const dashboardSchema = z.strictObject({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), timezone: z.literal('Asia/Shanghai'),
  publishedThisMonth: count, completedThisMonth: count, activeCount: count,
  fastestItem: z.strictObject({ itemId: idSchema, title: text(60), durationSeconds: count }).nullable(),
  mostWantedItem: z.strictObject({ itemId: idSchema, title: text(60), interestCount: z.number().int().positive() }).nullable(), asOf: timestampSchema,
});
export const aiRequestSchema = z.strictObject({ title: text(60), description: text(2000) });
const aiFields = { ...aiRequestSchema.shape, rationale: text(500), missingInfo: z.array(text(100)).max(5), disclaimer: z.literal(AI_DISCLAIMER) };
export const aiSuggestionSchema = z.discriminatedUnion('suggestedTradeMode', [
  z.strictObject({ ...aiFields, suggestedTradeMode: z.literal('FREE'), suggestedPriceRangeCents: z.strictObject({ min: z.literal(0), max: z.literal(0) }) }),
  z.strictObject({ ...aiFields, suggestedTradeMode: z.literal('FLEXIBLE'), suggestedPriceRangeCents: z.null() }),
  z.strictObject({ ...aiFields, suggestedTradeMode: z.literal('FIXED'), suggestedPriceRangeCents: z.strictObject({ min: priceCentsSchema, max: priceCentsSchema }).refine(p => p.min <= p.max, { message: 'min must not exceed max' }) }),
]);
export const ERROR_STATUS = {
  BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413, RATE_LIMITED: 429, INTERNAL_ERROR: 500, SERVICE_UNAVAILABLE: 503,
  AI_INVALID_RESPONSE: 502, AI_NOT_CONFIGURED: 503, AI_UNAVAILABLE: 503, AI_TIMEOUT: 504, DATABASE_BUSY: 503,
} as const;
export const errorCodeSchema = z.enum(Object.keys(ERROR_STATUS) as [keyof typeof ERROR_STATUS, ...(keyof typeof ERROR_STATUS)[]]);
export const errorResponseSchema = z.strictObject({ error: z.strictObject({ code: errorCodeSchema, message: text(1000), fieldErrors: z.record(z.string(), z.array(z.string())).optional(), requestId: text(200) }) });
export const dataResponse = <S extends z.ZodType>(schema: S) => z.strictObject({ data: schema });
export const listResponse = <S extends z.ZodType>(schema: S) => z.strictObject({ data: z.array(schema), page: z.strictObject({ nextCursor: z.string().min(1).nullable() }) });
export type User = z.infer<typeof userSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Trade = z.infer<typeof tradeSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type CreateItem = z.infer<typeof createItemSchema>;
export type CreateTrade = z.infer<typeof createTradeSchema>;
export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type ApiErrorResponse = z.infer<typeof errorResponseSchema>;
export type TradeMode = z.infer<typeof tradeModeSchema>;
export type ItemStatus = z.infer<typeof itemStatusSchema>;
export type TradeStatus = z.infer<typeof tradeStatusSchema>;
export type ImageKey = z.infer<typeof imageKeySchema>;
export type ErrorCode = keyof typeof ERROR_STATUS;
export type ItemQuery = z.input<typeof itemQuerySchema>;
export type TradeQuery = z.input<typeof tradeQuerySchema>;
export type Pagination = z.input<typeof paginationSchema>;
export type MyInterest = z.infer<typeof myInterestSchema>;
export type InterestUser = z.infer<typeof interestUserSchema>;
