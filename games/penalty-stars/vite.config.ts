import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// وضعان للبناء:
//   build      → ملف HTML واحد (singlefile) لسهولة النشر كرابط مستقل/Artifact
//   build:web  → ملفات منفصلة (dist-web) لنشر أفضل تخزينًا مؤقتًا على استضافة حكيم
const singleFile = process.env.BUILD_MODE !== 'web';

export default defineConfig({
  // في وضع الويب المسار مطلق تحت /penalty-stars حتى تصل الأصول أيًا كان شكل الرابط
  base: singleFile ? './' : '/penalty-stars/',
  plugins: singleFile ? [viteSingleFile()] : [],
  // عزل عن postcss.config.js في المشروع الأب
  css: { postcss: { plugins: [] } },
  build: {
    target: 'es2020',
    outDir: singleFile ? 'dist' : 'dist-web',
    // في الوضع المتعدد: الأصول ملفات مستقلة قابلة للتخزين المؤقت (حد ٤KB للدمج)
    assetsInlineLimit: singleFile ? 100000000 : 4096,
    chunkSizeWarningLimit: 5000,
  },
});
