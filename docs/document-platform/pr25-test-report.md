# PR-2.5 Test Report

## أوامر القبول

```
npm ci
npm run typecheck
npm run lint
npm test
npm run test:document-inspection
npm run accuracy
npm run test:doc-node
npm run test:attachments-regression
npm run test:direct-url
npm run test:document-hardening
npm run build
```

## ما يغطيه `test:document-hardening`

- حدود الحجم الموحّدة
- Rate limiting (حد، تجاوز، عزل مستخدم/scope، نافذة، Retry-After)
- Malware (معطّل، غير متاح fail-closed/open، لا CLEAN كاذب)
- Queue inline + dedupe + عدم setTimeout
- Idempotency hashing بلا URL خام
- Logging آمن + metrics بلا labels حساسة
- Cleanup dry-run/apply + symlink
- شكل health بلا أسرار

## ما لم يُختبر على خدمة حقيقية

- ClamAV daemon
- Redis rate limiter / BullMQ
- شبكة خارجية لاستيراد URL (مغطى في PR-2 بـ mocks)
