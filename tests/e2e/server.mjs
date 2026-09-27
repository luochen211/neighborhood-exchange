import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../../apps/api/dist/app.js';
import { readConfig } from '../../apps/api/dist/plugins/config.js';
import { openDatabase, migrate } from '../../apps/api/dist/db/index.js';
import { seed } from '../../apps/api/dist/db/seed.js';
const dir = await mkdtemp(join(tmpdir(), 'neighborhood-e2e-'));
const db = openDatabase(join(dir, 'test.db'));
migrate(db); seed(db);
const app = await buildApp({ database: db, serveWeb: true, config: readConfig({
  DEMO_MODE: 'true', DATABASE_URL: join(dir, 'test.db'), PORT: '3117', APP_ORIGIN: 'http://127.0.0.1:3117',
}) });
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  await app.close(); db.sqlite.close(); await rm(dir, { recursive: true, force: true });
}
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => void stop());
await app.listen({ host: '127.0.0.1', port: 3117 });
console.log('Isolated real HTTP E2E server ready; real LLM disabled for CI.');
