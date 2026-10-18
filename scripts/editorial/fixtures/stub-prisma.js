// بديل "@/lib/prisma" لاختبارات Node: يحيل كل خاصية إلى globalThis.__editorialTestPrisma.
const p = new Proxy({}, { get: (_t, k) => (globalThis.__editorialTestPrisma || {})[k] });
module.exports = { prisma: p, default: p, __esModule: true };
