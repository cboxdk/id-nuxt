import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // `#imports` is a Nuxt build alias that only exists inside a Nuxt build, so runtime
  // files that use it are unimportable in a plain unit test. Point it at a stub so the
  // server routes can be exercised directly; the tests then vi.mock it per case.
  resolve: {
    alias: {
      '#imports': fileURLToPath(new URL('./test/stubs/imports.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
