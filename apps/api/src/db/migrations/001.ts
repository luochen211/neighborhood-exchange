/** Versioned SQL is authoritative for constraints (including cross-field CHECKs). */
export const migration001 = `
CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL, nickname TEXT NOT NULL CHECK(length(trim(nickname)) BETWEEN 1 AND 30), building TEXT NOT NULL CHECK(length(trim(building)) BETWEEN 1 AND 30), created_at INTEGER NOT NULL);
CREATE TABLE sessions (id TEXT PRIMARY KEY NOT NULL, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, CHECK(expires_at > created_at));
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE items (id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 60), description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 2000), trade_mode TEXT NOT NULL CHECK(trade_mode IN ('FREE','FLEXIBLE','FIXED')), price_cents INTEGER, image_key TEXT NOT NULL CHECK(image_key IN ('chair','lamp','cooker','books')), pickup_building TEXT NOT NULL CHECK(length(trim(pickup_building)) BETWEEN 1 AND 30), status TEXT NOT NULL CHECK(status IN ('AVAILABLE','RESERVED','GIVEN')), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, given_at INTEGER,
CHECK((trade_mode='FREE' AND price_cents IS NOT NULL AND price_cents=0) OR (trade_mode='FLEXIBLE' AND price_cents IS NULL) OR (trade_mode='FIXED' AND price_cents IS NOT NULL AND typeof(price_cents)='integer' AND price_cents BETWEEN 1 AND 9999900)),
CHECK((status='GIVEN' AND given_at IS NOT NULL AND given_at>=created_at) OR (status!='GIVEN' AND given_at IS NULL)));
CREATE INDEX items_listing ON items(status,created_at,id);
CREATE TABLE interests (id TEXT PRIMARY KEY NOT NULL, item_id TEXT NOT NULL REFERENCES items(id), user_id TEXT NOT NULL REFERENCES users(id), active INTEGER NOT NULL CHECK(active IN (0,1)), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(item_id,user_id));
CREATE INDEX interests_active ON interests(item_id,active);
CREATE TABLE comments (id TEXT PRIMARY KEY NOT NULL, item_id TEXT NOT NULL REFERENCES items(id), author_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 500), created_at INTEGER NOT NULL);
CREATE INDEX comments_listing ON comments(item_id,created_at,id);
CREATE TABLE trades (id TEXT PRIMARY KEY NOT NULL, item_id TEXT NOT NULL REFERENCES items(id), recipient_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL CHECK(status IN ('PENDING','CONFIRMED','COMPLETED','CANCELLED')), meeting_start INTEGER NOT NULL, meeting_end INTEGER NOT NULL CHECK(meeting_end>meeting_start), meeting_place TEXT NOT NULL CHECK(length(trim(meeting_place)) BETWEEN 1 AND 100), created_at INTEGER NOT NULL, confirmed_at INTEGER, completed_at INTEGER, cancelled_at INTEGER, cancelled_by TEXT REFERENCES users(id),
CHECK((status='PENDING' AND confirmed_at IS NULL AND completed_at IS NULL AND cancelled_at IS NULL AND cancelled_by IS NULL) OR (status='CONFIRMED' AND confirmed_at IS NOT NULL AND completed_at IS NULL AND cancelled_at IS NULL AND cancelled_by IS NULL) OR (status='COMPLETED' AND confirmed_at IS NOT NULL AND completed_at IS NOT NULL AND cancelled_at IS NULL AND cancelled_by IS NULL) OR (status='CANCELLED' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND completed_at IS NULL)));
CREATE UNIQUE INDEX trades_one_live ON trades(item_id) WHERE status IN ('PENDING','CONFIRMED','COMPLETED');
CREATE INDEX trades_completed ON trades(completed_at);
`;
