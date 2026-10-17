/**
 * يحل استيراد TypeScript النسبي بلا امتداد عند تشغيل سكربتات HKM-002 بـ Node.
 * التطبيق نفسه يبقى على moduleResolution: bundler ولا يتغير استيراده.
 */
import { register } from "node:module";

register("./ts-ext-hook.mjs", import.meta.url);
