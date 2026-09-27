import { z } from 'zod';
import { endpoints, type Operation } from './endpoints.js';
import { API_PREFIX, SESSION_COOKIE_NAME, ERROR_STATUS, errorResponseSchema } from './schemas.js';
import { fixtures } from './fixtures.js';
const jsonSchema = (schema: z.ZodType) => {
  const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' });
  void _dialect;
  return rest;
};
export function buildOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const name of Object.keys(endpoints) as Operation[]) {
    const e = endpoints[name];
    const parameters: unknown[] = [];
    for (const location of ['path', 'query'] as const) {
      const object = jsonSchema(e.input.shape[location]);
      for (const [key, schema] of Object.entries(object.properties ?? {})) parameters.push({ name: key, in: location, required: location === 'path' || object.required?.includes(key) === true, schema });
    }
    const response = { description: 'Success', content: { 'application/json': { schema: jsonSchema(e.output), example: fixtures[name] } },
      ...(name === 'demoLogin' || name === 'logout' ? { headers: { 'Set-Cookie': { description: `${SESSION_COOKIE_NAME}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${name === 'logout' ? '0' : '86400'}; Secure on HTTPS. Login rotates the old session.`, schema: { type: 'string' } } } } : {}) };
    const responses: Record<string, unknown> = { [e.status]: response };
    for (const status of new Set(Object.values(ERROR_STATUS))) responses[status] = { description: `Public error (${Object.entries(ERROR_STATUS).filter(([, s]) => s === status).map(([c]) => c).join(', ')})`, content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } };
    const operation = {
      operationId: name, description: `${e.description} ${e.auth === 'demo' ? 'DEMO_MODE required; disabled returns 403.' : ''} Unknown input properties are rejected. Writes require same-origin Origin (absent Origin allowed for local clients). JSON body limit 32KB; business writes 60/user/min. Cookie auth and role checks remain server responsibilities.`,
      security: e.auth === 'session' ? [{ cookieAuth: [] }] : [], parameters,
      ...(e.input.shape.body instanceof z.ZodUndefined ? {} : { requestBody: { required: true, content: { 'application/json': { schema: jsonSchema(e.input.shape.body) } } } }),
      responses,
    };
    paths[e.path] ??= {};
    paths[e.path]![e.method.toLowerCase()] = operation;
  }
  return { openapi: '3.1.0', jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema', info: { title: '邻里闲置 API', version: '1.0.0', description: 'SRS baseline contract. Generated from packages/contracts. Runtime schemas additionally enforce cross-field state, price-range and meeting-time invariants documented in SRS; authorization and transactional checks must be implemented by the server.' }, servers: [{ url: API_PREFIX }], paths, components: { securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: SESSION_COOKIE_NAME } }, schemas: { ErrorResponse: jsonSchema(errorResponseSchema) } } };
}
