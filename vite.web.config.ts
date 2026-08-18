import { defineConfig } from 'vite';
import path from 'node:path';

const root = process.cwd();

const alias = [
  { find: '@shared', replacement: path.join(root, 'src/shared') },
  { find: '@renderer', replacement: path.join(root, 'src/renderer') },
  { find: '@main', replacement: path.join(root, 'src/main') }
];

// Standalone web build of the renderer, deployed to GitHub Pages.
// The Electron shell is not involved: window.electron is provided by the
// browser fallback in src/renderer/lib/electronBridge.ts.
export default defineConfig({
  root: path.join(root, 'src/renderer'),
  base: '/ltalk/',
  resolve: { alias },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react'
  },
  build: {
    outDir: path.join(root, 'dist-web'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(root, 'src/renderer/index.html')
    }
  }
});
