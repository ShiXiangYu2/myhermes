import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'

const __dirname = path.resolve()

// https://vitejs.dev/config/
export default defineConfig({
  // 路径解析 - 关键：让 @/ 指向 web/src
  resolve: {
    alias: {
      '@': path.join(__dirname, 'web/src'),
    },
  },

  // 明确指定入口
  build: {
    rollupOptions: {
      input: path.join(__dirname, 'web/index.html'),
    },
    outDir: 'dist-web',
    emptyOutDir: true,
  },

  plugins: [
    electron({
      main: {
        entry: 'electron/main/index.ts',
        onstart: ({ startup }) => startup(),
        vite: {
          resolve: {
            alias: {
              '@': path.join(__dirname, 'web/src'),
            },
          },
          build: {
            sourcemap: true,
            minify: false,
            outDir: 'dist-electron/main',
          },
        },
      },
      preload: {
        input: 'electron/preload/index.ts',
        vite: {
          resolve: {
            alias: {
              '@': path.join(__dirname, 'web/src'),
            },
          },
          build: {
            sourcemap: true,
            minify: false,
            outDir: 'dist-electron/preload',
          },
        },
      },
      renderer: {},
    }),
    renderer(),
  ],

  server: {
    port: 5173,
  },

  clearScreen: false,
})
