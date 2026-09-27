import { buildApp } from './app.js';
import { readConfig } from './plugins/config.js';

const config = readConfig();
const app = await buildApp({ serveWeb: !process.argv.includes('--dev'), logger: {
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
} });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close().catch(() => { process.exitCode = 1; }); });
}
try { await app.listen({ host: config.host, port: config.port }); }
catch { app.log.error('Unable to start server'); await app.close(); process.exitCode = 1; }
