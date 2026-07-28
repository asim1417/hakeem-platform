# PR-2 Security Model

## ما أُغلق من SSRF

- HTTPS فقط (رفض http/file/ftp/data/javascript/ws…).
- رفض credentials في URL.
- المنفذ 443 أو فارغ فقط.
- رفض localhost و*.localhost.
- رفض IPs الخاصة/loopback/link-local/multicast/reserved وmetadata endpoints.
- DNS resolution لكل hostname قبل الاتصال.
- رفض خليط public+private (DNS rebinding risk).
- إعادة الفحص الكامل عند كل redirect (حد أقصى 5).
- رفض redirect إلى non-HTTPS أو private.

## ما بقي من مخاطر DNS rebinding

عميل `fetch` في Node/undici لا يثبّت عنوان IP بعد الحل بسهولة في كل الإصدارات. الحماية متعددة الطبقات:

1. فحص كل عناوين DNS قبل الطلب.
2. رفض الخلط public/private.
3. إعادة الحل والفحص عند كل redirect.
4. لا allowlist مفتوح للمضيفات الداخلية.

**قيد موثَّق:** لا ندّعي إغلاق DNS rebinding بالكامل على مستوى socket pinning.

## بيانات حساسة

- لا تُسجَّل query strings ولا تُعاد في الاستجابات.
- `safeDisplayUrl` يحذف query/fragment.
- audit: host + fileName + size + mime + sha256 prefix فقط.
- الروابط الحسّاسة لا تُخزَّن خامًا في metadata (safeDisplayUrl فقط).

## حدود

- الحجم الافتراضي 100MB (قابل للضبط).
- MIME بالـ magic bytes (+ file-type اختياريًا).
- Rate limit في ذاكرة العملية (يُفضَّل Redis للإنتاج متعدد النسخ).
