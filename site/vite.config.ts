import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

const commitHash = execSync('git rev-parse HEAD').toString().trim();
const shortHash = execSync('git rev-parse --short HEAD').toString().trim();

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __SHORT_HASH__: JSON.stringify(shortHash),
  },
});
