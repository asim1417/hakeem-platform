# PR-2 Test Report

## الأوامر

```
npm run test:direct-url
npm run test:attachments-regression
npm run typecheck
npm run lint
npm test
npm run test:document-inspection
npm run accuracy
npm run test:doc-node
npm run build
```

## تغطية SSRF (وحدة + DNS محقون)

HTTPS · HTTP · file · localhost · 127.0.0.1 · 10/8 · 172.16/12 · 192.168/16 · 169.254.169.254 · IPv6 loopback/link-local · credentials · port 8080 · DNS fail · DNS rebinding mix · redirect→private · redirect→http · >5 redirects

## تغطية MIME / حجم

PDF/PNG/JPEG magic · HTML متنكر · TXT · FILE_TOO_LARGE مع/بدون Content-Length · SHA-256 · Content-Disposition عربي · أسماء خبيثة

## ما لم يُختبر بحساب حقيقي

تنزيل من CDN إنتاجي · Azure upload حي · SharePoint upload حي

## Feature flag

افتراضي `false` → endpoints تعيد 404.
