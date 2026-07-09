# خادم معالجة الوثائق (Node) — يعيد استخدام النواة المشتركة (الدماغ الموحّد).
# يُبنى من جذر المستودع (يحتاج lib/ و tsconfig.json):
#   docker build -f services/doc-node/Dockerfile -t hakeem-doc-node .
FROM node:22-slim

WORKDIR /app

# التبعيات (للنواة المشتركة: pdfjs، zod، وأدوات التشغيل tsx)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
RUN npm install tsx@^4 --no-save

# الكود: النواة المشتركة + الخدمة + الإعدادات
COPY tsconfig.json ./
COPY lib ./lib
COPY data ./data
COPY services ./services

# البيانات الدائمة (المهام + الرفع)
ENV DOC_NODE_DATA=/data
ENV PORT=8090
# اختياري: -e GEMINI_API_KEY=... (يفعّل السحابي) · -e QARI_ENDPOINT=... (يفعّل GPU)
# اختياري: -e APP_PASSWORD=... (قفل) · -e JOBS_CONCURRENCY=6 (توازي أكبر)
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8090
CMD ["npx", "tsx", "services/doc-node/server.ts"]
