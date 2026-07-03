import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// singlefile: يدمج كل الكود في ملف HTML واحد لسهولة النشر كرابط مستقل
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  // عزل عن postcss.config.js في المشروع الأب
  css: { postcss: { plugins: [] } },
  build: {
    target: 'es2020',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 5000,
  },
});
