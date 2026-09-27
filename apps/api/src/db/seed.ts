import { eq } from "drizzle-orm";
import type { Db } from "./index.js";
import { users, items, interests, comments, trades } from "./schema.js";
export const DEMO_USERS = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    nickname: "林小禾",
    building: "1 号楼",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    nickname: "陈阿姨",
    building: "2 号楼",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    nickname: "周同学",
    building: "3 号楼",
  },
] as const;
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
/** Insert-only fixed synthetic IDs. Re-running never changes existing business rows. */
export function seed(db: Db, now = Date.now()) {
  db.sqlite
    .transaction(() => {
      for (const u of DEMO_USERS)
        db.orm
          .insert(users)
          .values({ ...u, createdAt: now })
          .onConflictDoNothing()
          .run();
      const examples = [
        {
          title: "闲置木椅",
          description: "收拾房间整理出的木椅，可在楼下交接。",
          tradeMode: "FREE",
          priceCents: 0,
          imageKey: "chair",
          age: 2,
          status: "AVAILABLE",
        },
        {
          title: "桌面台灯",
          description: "搬家整理的台灯，细节可留言询问。",
          tradeMode: "FLEXIBLE",
          priceCents: null,
          imageKey: "lamp",
          age: 36,
          status: "AVAILABLE",
        },
        {
          title: "闲置电磁炉",
          description: "闲置电磁炉，线下查看后交接。",
          tradeMode: "FIXED",
          priceCents: 5000,
          imageKey: "cooker",
          age: 96,
          status: "RESERVED",
        },
        {
          title: "读完的书籍",
          description: "整理出的书籍，已经交给邻居继续阅读。",
          tradeMode: "FREE",
          priceCents: 0,
          imageKey: "books",
          age: 120,
          status: "GIVEN",
        },
      ] as const;
      examples.forEach((e, i) => {
        const itemId = id(100 + i);
        if (db.orm.select().from(items).where(eq(items.id, itemId)).get())
          return;
        const createdAt = now - e.age * 3600000,
          givenAt = e.status === "GIVEN" ? now - 3600000 : null;
        db.orm
          .insert(items)
          .values({
            id: itemId,
            ownerId: DEMO_USERS[0].id,
            title: e.title,
            description: e.description,
            tradeMode: e.tradeMode,
            priceCents: e.priceCents,
            imageKey: e.imageKey,
            pickupBuilding: "1 号楼",
            status: e.status,
            createdAt,
            updatedAt: now,
            givenAt,
          })
          .run();
        db.orm
          .insert(interests)
          .values({
            id: id(200 + i),
            itemId,
            userId: DEMO_USERS[1].id,
            active: true,
            createdAt: createdAt + 1000,
            updatedAt: createdAt + 1000,
          })
          .run();
        db.orm
          .insert(comments)
          .values({
            id: id(300 + i),
            itemId,
            authorId: DEMO_USERS[1].id,
            body: "谢谢分享，方便在小区门口交接吗？",
            createdAt: createdAt + 2000,
          })
          .run();
        if (e.status !== "AVAILABLE")
          db.orm
            .insert(trades)
            .values({
              id: id(400 + i),
              itemId,
              recipientId: DEMO_USERS[1].id,
              status: e.status === "GIVEN" ? "COMPLETED" : "PENDING",
              meetingStart: now + 3600000,
              meetingEnd: now + 7200000,
              meetingPlace: "小区公共活动室门口",
              createdAt: createdAt + 3000,
              confirmedAt: e.status === "GIVEN" ? createdAt + 4000 : null,
              completedAt: givenAt,
            })
            .run();
      });
    })
    .immediate();
}
