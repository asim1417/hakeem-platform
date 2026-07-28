# PR-2 Architecture — استيراد روابط HTTPS المباشرة

**المرجع:** HKM-DOCUMENTS-UPGRADE-003  
**الفرع:** `cursor/documents-pr2-direct-url-dfcc`

## التدفق

```
UI / API client
    │
    ├─ POST /api/attachments/inspect-url   (HEAD/مدى صغير — بلا تنزيل كامل)
    └─ POST /api/attachments/import-url
              │
        feature flag DOCUMENT_DIRECT_URL_IMPORT_ENABLED
              │
        ATTACHMENTS_FULL + case ownership + rate limit
              │
        UrlSecurityService (كل hop)
              │
        DirectUrlConnector
              │
        stream → tempfile + SHA-256 + MIME sniff
              │
        uploadAttachmentFromPath → Azure/SharePoint/metadata-only
              │
        Attachment (processingStatus: DOWNLOADING → UPLOADED | FAILED)
```

## ما لا يشمله

Google Drive OAuth/Picker · OneDrive · SharePoint links · Dropbox · Box · Docling · OCR في الطلب.

## endpoints

| المسار | الوظيفة |
|---|---|
| `POST /api/attachments/inspect-url` | فحص آمن للرابط |
| `POST /api/attachments/import-url` | تنزيل متدفق + إنشاء Attachment |

رفع `/api/attachments` الحالي **لم يتغير**.
