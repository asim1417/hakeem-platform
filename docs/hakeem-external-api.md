# Hakeem Legal API — دليل التكامل الخارجي

واجهة برمجية عامة تتيح لمواقع الأطراف الثالثة وأنظمة الذكاء الاصطناعي البحث في
النواة القانونية السعودية لمنصة حكيم (الأنظمة، المواد، المبادئ، المواءمة الفقهية)
عبر مفتاح API. كل استشهاد يأتي من النواة الرسمية — لا اختلاق ولا هلوسة.

---

## 1. المعلومات الأساسية

| البند | القيمة |
|---|---|
| **Base URL** | `https://hakeem-platform.vercel.app` |
| **مواصفة OpenAPI (آلية)** | `https://hakeem-platform.vercel.app/api/openapi` |
| **توثيق بشري** | `https://hakeem-platform.vercel.app/api-docs` |
| **المصادقة** | مفتاح API (Bearer أو `x-api-key`) |
| **النطاق (scope)** | `legal:read` |
| **حدّ المعدّل الافتراضي** | 60 طلب/دقيقة لكل مفتاح (قابل للضبط) |
| **CORS** | مفتوح (`*`) — يعمل من المتصفح وأنظمة الذكاء |
| **الصيغة** | JSON (طلبات GET) |

> **للمبرمج أو للذكاء الاصطناعي:** وجّه أداتك مباشرة إلى مواصفة OpenAPI أعلاه؛
> فهي تصف كل المسارات والمعاملات وأنواع المصادقة تلقائيًا.

---

## 2. المصادقة

مرّر المفتاح في ترويسة الطلب بإحدى الصيغتين:

```
Authorization: Bearer hk_live_XXXXXXXXXXXXXXXX
```
أو
```
x-api-key: hk_live_XXXXXXXXXXXXXXXX
```

- المفتاح يبدأ بـ `hk_live_`.
- يُخزَّن في القاعدة **مُجزَّأً (SHA-256)** فقط — لا تُحفظ نسخته الخام إطلاقًا،
  لذا يُعرض **مرة واحدة** عند الإنشاء.

---

## 3. المسارات (كلها GET)

### 3.1 بحث قانوني
```
GET /api/legal/search?q={عبارة}&limit={1..50}
```
بحث هجين (نصّي + دلالي + رسم معرفي) عبر المواد والأحكام والمبادئ.
- `q` (إلزامي، حرفان فأكثر) · `limit` (اختياري، افتراضي 20).

### 3.2 قائمة الأنظمة
```
GET /api/legal/systems?q=&classification=&page=&pageSize=
```

### 3.3 تفاصيل نظام
```
GET /api/legal/systems/{id}
```
`id` = معرّف النظام أو اسمه. يعيد النظام ومواده مجمّعة بالفصول.

### 3.4 تفاصيل مادة
```
GET /api/legal/articles/{id}
```
يعيد المادة + صيغة الاستناد الرسمية + المعرّف التشريعي الثابت (ELI).

### 3.5 مواد ذات صلة وإحالات
```
GET /api/legal/articles/{id}/related
```

### 3.6 مواءمة فقهية مساندة (غير مُلزِمة)
```
GET /api/legal/articles/{id}/fiqh
```
يرفق تنبيهًا صريحًا بأن المواءمة الفقهية غير ملزمة وليست نصًّا نظاميًا.

---

## 4. أمثلة

**cURL:**
```bash
curl -H "Authorization: Bearer hk_live_XXXX" \
  "https://hakeem-platform.vercel.app/api/legal/search?q=فسخ%20عقد%20الإيجار&limit=10"
```

**JavaScript (fetch):**
```js
const res = await fetch(
  "https://hakeem-platform.vercel.app/api/legal/search?q=" + encodeURIComponent("فسخ عقد الإيجار"),
  { headers: { Authorization: "Bearer hk_live_XXXX" } }
);
const data = await res.json();
console.log(data.results);
```

**Python (requests):**
```python
import requests
r = requests.get(
    "https://hakeem-platform.vercel.app/api/legal/search",
    params={"q": "فسخ عقد الإيجار", "limit": 10},
    headers={"Authorization": "Bearer hk_live_XXXX"},
)
print(r.json())
```

---

## 5. رموز الاستجابة

| الرمز | المعنى |
|---|---|
| `200` | نجاح |
| `400` | مدخل خاطئ (مثل عبارة بحث أقصر من حرفين) |
| `401` | مفتاح مفقود أو غير صالح أو موقوف |
| `403` | المفتاح لا يملك النطاق المطلوب (`legal:read`) |
| `404` | المورد غير موجود |
| `429` | تجاوز حدّ المعدّل (أعد المحاولة بعد `Retry-After` ثانية) |

كل استجابة تتضمّن `ok: true|false`، وعند الخطأ حقل `error` بوصف عربي.

---

## 6. إنشاء مفتاح API (للمسؤول)

قبل أن يعمل أي تكامل، يُنشئ **مسؤول المنصّة** مفتاحًا ويسلّمه للطرف الخارجي.
هذه المسارات محميّة بصلاحية `USERS_MANAGE` (جلسة مسؤول)، ولا تُستعمل من الخارج.

**إنشاء مفتاح:**
```bash
curl -X POST "https://hakeem-platform.vercel.app/api/admin/api-keys" \
  -H "Content-Type: application/json" \
  -d '{"name":"شريك خارجي","scopes":["legal:read"],"rateLimit":120}'
```
الاستجابة تتضمّن `apiKey: "hk_live_…"` — **يُعرض مرة واحدة فقط، فاحفظه فورًا.**

**قائمة المفاتيح:** `GET /api/admin/api-keys`
**تعديل (نطاق/حدّ/تفعيل):** `PATCH /api/admin/api-keys/{id}`
**إيقاف مفتاح:** `DELETE /api/admin/api-keys/{id}` (إيقاف آمن — لا حذف)

الحقول المتاحة عند الإنشاء:
- `name` (إلزامي): وصف بشري.
- `scopes` (اختياري، افتراضي `["legal:read"]`).
- `rateLimit` (اختياري، افتراضي 60/دقيقة).
- `expiresAt` (اختياري، ISO 8601): انتهاء صلاحية.

---

## 7. الحوكمة والحدود

- الاستشهاد بأي مادة/حكم يأتي **حصرًا من النواة القانونية** — لا يُختلق مصدر.
- المواءمة الفقهية **مساندة وغير مُلزِمة**، ومُعلّمة صراحةً في الاستجابة.
- المخرجات مرجعية للبحث والتكامل، ولا تُعدّ رأيًا قانونيًا نهائيًا أو حكمًا.

---

_مرجع مُولّد لمنصّة حكيم — واجهة `/api/legal/*` فوق مواصفة OpenAPI._
