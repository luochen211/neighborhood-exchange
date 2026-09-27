import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
export default defineConfig({ plugins: [react()], test: { include: ['apps/**/*.test.{ts,tsx}', 'packages/**/*.test.ts'], environment: 'node' } });
