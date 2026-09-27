import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

test('server process restart preserves published item and signed-in session', async ({ playwright }) => {
  const dir = await mkdtemp(join(tmpdir(), 'neighborhood-restart-'));
  const env = { PATH: process.env.PATH, DEMO_MODE: 'true', DATABASE_URL: join(dir, 'restart.db'), PORT: '3119', HOST: '127.0.0.1', APP_ORIGIN: 'http://127.0.0.1:3119' };
  let child: ChildProcess | undefined;
  const client = await playwright.request.newContext({ baseURL: env.APP_ORIGIN });
  const stop = async () => {
    if (!child || child.exitCode !== null) return;
    const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited;
  };
  const start = async () => {
    child = spawn(process.execPath, ['apps/api/dist/server.js'], { env, stdio: 'ignore' });
    await expect.poll(async () => {
      try { return (await client.get('/api/v1/health')).status(); } catch { return 0; }
    }).toBe(200);
  };
  try {
    const seed = spawn(process.execPath, ['apps/api/dist/db/cli.js', 'seed'], { env, stdio: 'ignore' });
    expect((await once(seed, 'exit'))[0]).toBe(0);
    await start();
    const users = (await (await client.get('/api/v1/demo/users')).json()).data;
    const signedIn = await client.post('/api/v1/auth/demo-login', { data: { userId: users[0].id } });
    expect(signedIn.status()).toBe(200);
    const created = await client.post('/api/v1/items', { data: { title: '重启持久化验收', description: '虚构物品，验证服务器进程重启后保留', tradeMode: 'FREE', priceCents: 0, imageKey: 'chair', pickupBuilding: '1 号楼' } });
    expect(created.status()).toBe(201);
    const item = (await created.json()).data;
    await stop(); await start();
    expect((await (await client.get(`/api/v1/items/${item.id}`)).json()).data).toMatchObject({ id: item.id, title: item.title, status: 'AVAILABLE' });
    expect((await (await client.get('/api/v1/auth/me')).json()).data.id).toBe(users[0].id);
  } finally { await stop(); await client.dispose(); await rm(dir, { recursive: true, force: true }); }
});
