import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit suite: fast, DB-free, runs everywhere. DB-backed integration specs
    // (*.integration.test.ts) are excluded here and run via vitest.integration.config.ts.
    exclude: ['dist/**', 'node_modules/**', '**/*.integration.test.ts'],
  },
});
