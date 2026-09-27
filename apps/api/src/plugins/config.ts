export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
  const host = env.HOST ?? '127.0.0.1';
  const appOrigin = env.APP_ORIGIN ?? `http://127.0.0.1:${port}`;
  const url = new URL(appOrigin);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== appOrigin) throw new Error('APP_ORIGIN must be an HTTP origin without a trailing slash');
  return { host, port, appOrigin };
}
