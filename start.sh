#!/bin/bash
# start.sh - تشغيل النظام الكامل

echo "========================================="
echo "🚀 تشغيل نظام بوت الأخبار المتكامل"
echo "========================================="

# تحديد المسار الأساسي
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASE_DIR"

# إنشاء المجلدات المطلوبة
mkdir -p logs
mkdir -p data
mkdir -p temp

# التحقق من وجود Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js غير مثبت. الرجاء تثبيت Node.js 18+"
    exit 1
fi

# التحقق من وجود Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 غير مثبت"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ Python version: $(python3 --version)"

# تثبيت اعتماديات Node.js
echo ""
echo "📦 تثبيت اعتماديات Node.js..."
if [ -f "package.json" ]; then
    npm install --production
    if [ $? -eq 0 ]; then
        echo "✅ تم تثبيت اعتماديات Node.js"
    else
        echo "❌ فشل تثبيت اعتماديات Node.js"
        exit 1
    fi
fi

# تثبيت اعتماديات Python
echo ""
echo "📦 تثبيت اعتماديات Python..."
if [ -f "requirements.txt" ]; then
    pip3 install -r requirements.txt
    if [ $? -eq 0 ]; then
        echo "✅ تم تثبيت اعتماديات Python"
    else
        echo "⚠️ تحذير: بعض اعتماديات Python فشلت"
    fi
fi

# تهيئة الفئات في Firebase (أول مرة فقط)
echo ""
echo "📂 تهيئة الفئات في Firebase..."
if [ -f "init-categories.js" ]; then
    node init-categories.js
fi

# تشغيل السيرفر
echo ""
echo "🌐 تشغيل السيرفر..."
if [ -f "server.js" ]; then
    node server.js &
    SERVER_PID=$!
    echo "✅ السيرفر يعمل (PID: $SERVER_PID)"
    sleep 2
fi

# تشغيل بوت الأخبار (Node.js)
echo ""
echo "🤖 تشغيل بوت الأخبار..."
if [ -f "news-bot.js" ]; then
    node news-bot.js &
    BOT_PID=$!
    echo "✅ بوت الأخبار يعمل (PID: $BOT_PID)"
fi

# تشغيل البوت الأساسي (Python)
echo ""
echo "🐍 تشغيل البوت الأساسي..."
if [ -f "app.py" ]; then
    python3 app.py &
    PYTHON_BOT_PID=$!
    echo "✅ البوت الأساسي يعمل (PID: $PYTHON_BOT_PID)"
fi

echo ""
echo "========================================="
echo "✅ النظام يعمل بالكامل!"
echo "========================================="
echo ""
echo "📊 العمليات النشطة:"
echo "   • السيرفر: PID $SERVER_PID"
echo "   • بوت الأخبار: PID $BOT_PID"
echo "   • البوت الأساسي: PID $PYTHON_BOT_PID"
echo ""
echo "📝 للمراقبة: tail -f logs/*.log"
echo "🛑 للإيقاف: kill $SERVER_PID $BOT_PID $PYTHON_BOT_PID"
echo ""

# انتظار العمليات
wait