import { AI_DISCLAIMER, type Item, type Trade, type User } from './schemas.js';
import type { Operation, Output } from './endpoints.js';
export const fixtureUsers: User[] = [
  { id: '00000000-0000-4000-8000-000000000001', nickname: '邻居小林', building: '1栋' },
  { id: '00000000-0000-4000-8000-000000000002', nickname: '邻居小周', building: '2栋' },
  { id: '00000000-0000-4000-8000-000000000003', nickname: '邻居小陈', building: '3栋' },
];
const owner = fixtureUsers[0]!;
const recipient = fixtureUsers[1]!;
export const FIXTURE_NOW = '2026-09-27T02:00:00.000Z';
export const fixtureItem: Item = {
  id: '00000000-0000-4000-8000-000000000011', owner, title: '闲置电磁炉', description: '功能正常，搬家转让。',
  tradeMode: 'FIXED', priceCents: 3000, imageKey: 'cooker', pickupBuilding: '1栋', status: 'AVAILABLE',
  createdAt: '2026-09-27T01:00:00.000Z', givenAt: null, interestCount: 1, viewerHasInterest: true, freshnessLabel: '刚上架', serverNow: FIXTURE_NOW,
};
export const fixtureTrade: Trade = {
  id: '00000000-0000-4000-8000-000000000021', itemId: fixtureItem.id, owner, recipient, status: 'PENDING',
  meetingStart: '2026-09-28T01:00:00.000Z', meetingEnd: '2026-09-28T02:00:00.000Z', meetingPlace: '社区公共活动室',
  createdAt: FIXTURE_NOW, confirmedAt: null, completedAt: null, cancelledAt: null, cancelledBy: null,
};
export const fixtureItems: Item[] = [fixtureItem,
  { ...fixtureItem, id: '00000000-0000-4000-8000-000000000012', title: '台灯', imageKey: 'lamp', tradeMode: 'FREE', priceCents: 0, status: 'RESERVED', createdAt: '2026-09-25T02:00:00.000Z', freshnessLabel: '新上架' },
  { ...fixtureItem, id: '00000000-0000-4000-8000-000000000013', title: '旧书', imageKey: 'books', tradeMode: 'FLEXIBLE', priceCents: null, status: 'GIVEN', createdAt: '2026-09-23T02:00:00.000Z', givenAt: FIXTURE_NOW, freshnessLabel: '已上架 4 天' },
];
const comment = { id: '00000000-0000-4000-8000-000000000031', itemId: fixtureItem.id, author: recipient, body: '周末方便领取吗？', createdAt: FIXTURE_NOW };
const list = <T>(...data: T[]) => ({ data, page: { nextCursor: null } });
export const fixtures = {
  health: { data: { status: 'ok', database: 'ok' } }, demoUsers: list(...fixtureUsers), demoLogin: { data: owner }, logout: { data: { loggedOut: true } }, me: { data: owner },
  listItems: list(...fixtureItems.slice(0, 2)), createItem: { data: fixtureItem }, getItem: { data: fixtureItem }, myItems: list(...fixtureItems),
  myInterests: list({ id: '00000000-0000-4000-8000-000000000041', item: fixtureItem, createdAt: FIXTURE_NOW }),
  wantItem: { data: { active: true, count: 1 } }, withdrawInterest: { data: { active: false, count: 0 } }, itemInterests: list({ ...recipient, createdAt: FIXTURE_NOW }),
  listComments: list(comment), createComment: { data: comment }, createTrade: { data: fixtureTrade }, myTrades: list(fixtureTrade), getTrade: { data: fixtureTrade },
  confirmTrade: { data: { ...fixtureTrade, status: 'CONFIRMED', confirmedAt: FIXTURE_NOW } },
  cancelTrade: { data: { ...fixtureTrade, status: 'CANCELLED', cancelledAt: FIXTURE_NOW, cancelledBy: recipient.id } },
  completeTrade: { data: { ...fixtureTrade, status: 'COMPLETED', confirmedAt: FIXTURE_NOW, completedAt: FIXTURE_NOW } },
  dashboard: { data: { month: '2026-09', timezone: 'Asia/Shanghai', publishedThisMonth: 3, completedThisMonth: 1, activeCount: 2, fastestItem: { itemId: fixtureItems[2]!.id, title: '旧书', durationSeconds: 345600 }, mostWantedItem: { itemId: fixtureItem.id, title: fixtureItem.title, interestCount: 1 }, asOf: FIXTURE_NOW } },
  assistListing: { data: { title: fixtureItem.title, description: fixtureItem.description, suggestedTradeMode: 'FIXED', suggestedPriceRangeCents: { min: 3000, max: 6000 }, rationale: '仅根据提供的描述。', missingInfo: ['品牌和型号'], disclaimer: AI_DISCLAIMER } },
} satisfies { [K in Operation]: Output<K> };
