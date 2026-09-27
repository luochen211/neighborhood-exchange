import { writeFileSync } from 'node:fs';
import { buildOpenApi } from '../src/openapi.js';
// JSON is valid YAML 1.2; use deterministic serialization without another dependency.
writeFileSync(new URL('../../../docs/engineering/openapi.yaml', import.meta.url), `${JSON.stringify(buildOpenApi(), null, 2)}\n`);
