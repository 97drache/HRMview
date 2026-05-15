/**
 * 인원현황(1번) 숫자·차트만 — Vercel 별도 프로젝트용 정적 사이트.
 *
 * Vercel 설정 예 (저장소 루트 연결, 새 프로젝트):
 * - Install: npm ci
 * - Build: npm run build:headcount-web
 * - Output: headcount-web/dist
 * 기존 Polar Run 프로젝트와 도메인·환경변수가 분리됩니다.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: path.join(root, 'headcount-web'),
  publicDir: path.join(root, 'headcount-web', 'public'),
  base: '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@hrm': path.join(root, 'src'),
    },
  },
  build: {
    outDir: path.join(root, 'headcount-web', 'dist'),
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    fs: { allow: [root] },
  },
})
