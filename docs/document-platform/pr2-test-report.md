# PR-2 Test Report

**Commit:** `13b027c741c16dfb51055da4cc9310a509146920`

## النتائج الفعلية

| الأمر | النتيجة |
|---|---|
| typecheck | ✅ |
| lint | ✅ |
| test | ✅ |
| test:document-inspection | ✅ 81 |
| accuracy | ✅ |
| test:doc-node | ✅ 7 |
| test:attachments-regression | ✅ 28 |
| test:direct-url | ✅ 30 |
| build | ✅ |

## تغطية SSRF

HTTPS · HTTP · file · localhost · 127.0.0.1 · 10/8 · 172.16/12 · 192.168/16 · 169.254.169.254 · IPv6 loopback/link-local · credentials · port 8080 · DNS fail · DNS rebinding mix · redirect→private · redirect→http · >5 redirects

## تغطية MIME / حجم

PDF/PNG/JPEG magic · HTML متنكر · TXT · FILE_TOO_LARGE مع/بدون Content-Length · SHA-256 · Content-Disposition عربي · أسماء خبيثة

## ما لم يُختبر بحساب حقيقي

تنزيل من CDN إنتاجي · Azure upload حي · SharePoint upload حي

## Feature flag

افتراضي `false` → endpoints تعيد 404.
