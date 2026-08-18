import path from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

const root = process.cwd();

const alias = [
  { find: '@shared', replacement: path.join(root, 'src/shared') },
  { find: '@renderer', replacement: path.join(root, 'src/renderer') },
  { find: '@main', replacement: path.join(root, 'src/main') }
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      rollupOptions: {
        input: path.join(root, 'src/main/index.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      rollupOptions: {
        input: path.join(root, 'src/preload/index.ts')
      }
    }
  },
  renderer: {
    root: path.join(root, 'src/renderer'),
    resolve: { alias },
    esbuild: {
      jsx: 'automatic',
      jsxImportSource: 'react'
    },
    build: {
      rollupOptions: {
        input: path.join(root, 'src/renderer/index.html')
      }
    }
  }
});
