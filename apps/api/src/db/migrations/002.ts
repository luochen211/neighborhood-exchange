export const migration002 = `
CREATE TABLE items_new (id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 60), description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 2000), trade_mode TEXT NOT NULL CHECK(trade_mode IN ('FREE','FLEXIBLE','FIXED')), price_cents INTEGER, image_key TEXT NOT NULL CHECK(image_key IN ('chair','lamp','cooker','books','stroller','monstera','rice-cooker','electric-kettle','table-fan','toaster','coffee-maker','vacuum-cleaner','side-table','bookshelf','office-chair','shoe-rack','floor-lamp','storage-basket','picture-books','building-blocks','baby-high-chair','balance-bike','yoga-mat','dumbbells','badminton-rackets','camping-chair','suitcase','guitar','ceramic-vase','succulents')), pickup_building TEXT NOT NULL CHECK(length(trim(pickup_building)) BETWEEN 1 AND 30), status TEXT NOT NULL CHECK(status IN ('AVAILABLE','RESERVED','GIVEN')), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, given_at INTEGER,
CHECK((trade_mode='FREE' AND price_cents IS NOT NULL AND price_cents=0) OR (trade_mode='FLEXIBLE' AND price_cents IS NULL) OR (trade_mode='FIXED' AND price_cents IS NOT NULL AND typeof(price_cents)='integer' AND price_cents BETWEEN 1 AND 9999900)),
CHECK((status='GIVEN' AND given_at IS NOT NULL AND given_at>=created_at) OR (status!='GIVEN' AND given_at IS NULL)));
INSERT INTO items_new SELECT * FROM items;
DROP TABLE items;
ALTER TABLE items_new RENAME TO items;
CREATE INDEX items_listing ON items(status,created_at,id);
`;
