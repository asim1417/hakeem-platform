/**
 * يلحق امتداد .ts على الاستيراد النسبي حتى يشغّل Node سكربتات HKM-002
 * منطق التطبيع القائم دون تغيير استيراد التطبيق (bundler، بلا امتداد).
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.(mjs|cjs|js|ts|json)$/.test(specifier)) {
    try {
      return await nextResolve(specifier + ".ts", context);
    } catch {
      /* fall through */
    }
  }
  return nextResolve(specifier, context);
}
