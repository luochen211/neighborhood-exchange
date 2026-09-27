import { it, expect } from 'vitest';
import { openDatabase, migrate } from './db/index.js';
import { migration001 } from './db/migrations/001.js';
import { IMAGE_KEYS } from '@neighborhood/contracts';
it('upgrades a populated v1 database without losing relations and allows all catalog images', () => {
  const db = openDatabase(':memory:');
  try {
    db.sqlite.exec(migration001);
    db.sqlite.pragma('user_version = 1');
    db.sqlite.exec(`INSERT INTO users VALUES ('u','居民','1号楼',0);
      INSERT INTO items VALUES ('i','u','木椅','说明','FREE',0,'chair','1号楼','AVAILABLE',0,0,NULL);
      INSERT INTO interests VALUES ('w','i','u',1,0,0);
      INSERT INTO comments VALUES ('c','i','u','留言',0);`);
    migrate(db); migrate(db);
    expect(db.sqlite.prepare('SELECT body FROM comments WHERE item_id=?').get('i')).toEqual({ body:'留言' });
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM interests').get()).toEqual({ n:1 });
    for (const key of IMAGE_KEYS) db.sqlite.prepare('UPDATE items SET image_key=? WHERE id=?').run(key,'i');
    expect(() => db.sqlite.prepare('UPDATE items SET image_key=?').run('unknown')).toThrow();
    expect(() => db.sqlite.prepare('DELETE FROM items').run()).toThrow();
    expect(db.sqlite.pragma('foreign_keys',{simple:true})).toBe(1);
    expect(db.sqlite.pragma('foreign_key_check')).toEqual([]);
  } finally { db.sqlite.close(); }
});
