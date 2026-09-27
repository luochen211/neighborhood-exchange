import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text().primaryKey(),
  nickname: text().notNull(),
  building: text().notNull(),
  createdAt: integer("created_at").notNull(),
});
export const sessions = sqliteTable("sessions", {
  id: text().primaryKey(),
  tokenHash: text("token_hash").notNull(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const items = sqliteTable("items", {
  id: text().primaryKey(),
  ownerId: text("owner_id").notNull(),
  title: text().notNull(),
  description: text().notNull(),
  tradeMode: text("trade_mode", {
    enum: ["FREE", "FLEXIBLE", "FIXED"],
  }).notNull(),
  priceCents: integer("price_cents"),
  imageKey: text("image_key", {
    enum: ["chair", "lamp", "cooker", "books"],
  }).notNull(),
  pickupBuilding: text("pickup_building").notNull(),
  status: text({ enum: ["AVAILABLE", "RESERVED", "GIVEN"] }).notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  givenAt: integer("given_at"),
});
export const interests = sqliteTable("interests", {
  id: text().primaryKey(),
  itemId: text("item_id").notNull(),
  userId: text("user_id").notNull(),
  active: integer({ mode: "boolean" }).notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const comments = sqliteTable("comments", {
  id: text().primaryKey(),
  itemId: text("item_id").notNull(),
  authorId: text("author_id").notNull(),
  body: text().notNull(),
  createdAt: integer("created_at").notNull(),
});
export const trades = sqliteTable("trades", {
  id: text().primaryKey(),
  itemId: text("item_id").notNull(),
  recipientId: text("recipient_id").notNull(),
  status: text({
    enum: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"],
  }).notNull(),
  meetingStart: integer("meeting_start").notNull(),
  meetingEnd: integer("meeting_end").notNull(),
  meetingPlace: text("meeting_place").notNull(),
  createdAt: integer("created_at").notNull(),
  confirmedAt: integer("confirmed_at"),
  completedAt: integer("completed_at"),
  cancelledAt: integer("cancelled_at"),
  cancelledBy: text("cancelled_by"),
});
