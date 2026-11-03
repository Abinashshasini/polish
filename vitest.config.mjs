import { defineConfig } from 'vitest/config';

// separate from vite.config.mjs, whose root is renderer/ (tests live in test/ and cover src/ too)
export default defineConfig({
  test: {
    include: ['test/**/*.test.{js,mjs}'],
    environment: 'node',
  },
});
