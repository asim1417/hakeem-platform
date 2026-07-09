#!/bin/bash
# نشر خدمة معالجة الوثائق على VPS أو محلي

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  نشر خدمة معالجة الوثائق العربية (Python + Docker)"
echo "═══════════════════════════════════════════════════════════"

# 1. فحص Docker
echo ""
echo "[1/5] فحص Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker غير مثبت"
    echo "ثبّت Docker: https://docs.docker.com/engine/install/"
    exit 1
fi
echo "✓ Docker موجود: $(docker --version)"

# 2. بناء الصورة
echo ""
echo "[2/5] بناء صورة Docker..."
docker build -t hakeem-doc-service:latest .
echo "✓ الصورة جاهزة"

# 3. إنشاء المجلد الدائم
echo ""
echo "[3/5] تجهيز التخزين..."
mkdir -p /data/job_uploads
chmod 755 /data
echo "✓ التخزين جاهز: /data"

# 4. إيقاف الخدمة القديمة (إن وجدت)
echo ""
echo "[4/5] التنظيف..."
if docker ps -a --format '{{.Names}}' | grep -q "hakeem-doc-service"; then
    echo "   إيقاف الخدمة القديمة..."
    docker stop hakeem-doc-service 2>/dev/null || true
    docker rm hakeem-doc-service 2>/dev/null || true
fi
echo "✓ جاهز للنشر الجديد"

# 5. تشغيل الخدمة
echo ""
echo "[5/5] تشغيل الخدمة..."

# محاولة قراءة المتغيّرات من .env
GEMINI_API_KEY="${GEMINI_API_KEY:-}"
APP_PASSWORD="${APP_PASSWORD:-}"

# بناء أوامر البيئة
ENV_ARGS=""
if [ -n "$GEMINI_API_KEY" ]; then
    ENV_ARGS="$ENV_ARGS -e GEMINI_API_KEY=$GEMINI_API_KEY"
fi
if [ -n "$APP_PASSWORD" ]; then
    ENV_ARGS="$ENV_ARGS -e APP_PASSWORD=$APP_PASSWORD"
fi

# تشغيل الحاوية
docker run -d \
  --name hakeem-doc-service \
  -p 8080:8080 \
  -v /data:/data \
  $ENV_ARGS \
  --restart unless-stopped \
  hakeem-doc-service:latest

echo "✓ الخدمة تعمل!"

# انتظر قليل
sleep 2

# فحص الصحة
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  فحص الصحة"
echo "═══════════════════════════════════════════════════════════"

if curl -f http://localhost:8080/healthz > /dev/null 2>&1; then
    echo "✓ الخدمة تعمل بنجاح!"
    echo ""
    echo "الرابط: http://localhost:8080"
    echo ""
    echo "اختبر:"
    echo "  curl http://localhost:8080/api/providers"
else
    echo "⏳ الخدمة في طور التحميل... (الأول مرة 10-20 ثانية)"
    sleep 5
    if curl -f http://localhost:8080/healthz > /dev/null 2>&1; then
        echo "✓ الخدمة تعمل!"
    else
        echo "❌ الخدمة لم تبدأ. تحقق:"
        echo "  docker logs hakeem-doc-service"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
