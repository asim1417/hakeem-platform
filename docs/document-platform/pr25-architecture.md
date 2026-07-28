# PR-2.5 Architecture — التحصين التشغيلي

**المرجع:** HKM-DOCUMENTS-UPGRADE-004  
**يعتمد على:** PR-2 المدمج `#543` → `2e620b752eaf6407a7b2fa1be83baf34c01218e1`

## النطاق

طبقة تشغيل وأمان حول استيراد/رفع الوثائق **دون** تغيير عقد PR-2 ودون موصلات Google/Microsoft/Dropbox/Box.

## المكوّنات

| المكوّن | المسار | ملاحظة |
|---|---|---|
| حدود موحّدة | `lib/modules/documents/document-limits.ts` | مصدر حقيقة واحد |
| Rate limit | `lib/modules/rate-limit/` | Memory افتراضي؛ Redis هيكل |
| Malware hook | `lib/modules/documents/malware/` | Noop / ClamAV هيكل — لا CLEAN كاذب |
| Queue | `lib/modules/documents/jobs/` | Inline افتراضي؛ BullMQ خلف علم |
| Idempotency | `lib/modules/documents/idempotency.ts` + Prisma | `Idempotency-Key` على import-url |
| Logging | `lib/modules/observability/document-logger.ts` | بلا URL/نص/توكن |
| Metrics | `lib/modules/observability/metrics.ts` | labels منخفضة التعدد فقط |
| Cleanup | `lib/modules/documents/cleanup-temp.ts` | dry-run افتراضي |
| Health | `GET /api/admin/document-platform/health` | صلاحية إدارية |

## Feature Flags (افتراضيات آمنة)

```
DOCUMENT_DIRECT_URL_IMPORT_ENABLED=false   # من PR-2
DOCUMENT_MALWARE_SCAN_ENABLED=false
DOCUMENT_QUEUE_ENABLED=false
DOCUMENT_METRICS_ENABLED=true
DOCUMENT_RATE_LIMIT_ENABLED=true
DOCUMENT_MALWARE_SCAN_FAIL_CLOSED=true
```

## حدود الحجم

- `DOCUMENT_MAX_UPLOAD_BYTES=104857600`
- `DOCUMENT_DIRECT_URL_MAX_BYTES=104857600`
- `DOCUMENT_URL_INSPECT_MAX_BYTES=65536`

## Rate limits

- inspect-url: 30/د
- import-url: 10/د
- upload: 20/د

## ما لم يُنفَّذ (محظور في هذه الجولة)

Google Drive / Picker / Docs Export / OneDrive / SharePoint OAuth / Dropbox / Box / Docling / OCRmyPDF.
