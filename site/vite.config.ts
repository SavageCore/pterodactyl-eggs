import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const commitHash = execSync('git rev-parse HEAD').toString().trim();
const shortHash = execSync('git rev-parse --short HEAD').toString().trim();

const dummyCount = process.env.DUMMY_COUNT;

function seededDataPlugin() {
  const script = resolve(__dirname, '../scripts/build-data.mjs');
  const publicDir = resolve(__dirname, 'public');
  return {
    name: 'seeded-data',
    configureServer(server) {
      const run = () => {
        execSync(`node ${script} --dummy ${dummyCount}`, { stdio: 'inherit' });
      };
      run();
      server.watcher.on('change', (p) => {
        if (p.startsWith(publicDir)) return;
        run();
      });
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: dummyCount ? [seededDataPlugin()] : [],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __SHORT_HASH__: JSON.stringify(shortHash),
  },
});
