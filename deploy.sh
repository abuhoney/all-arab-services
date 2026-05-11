#!/bin/bash
# deploy.sh - نشر النظام على السيرفر

echo "🚀 نشر نظام بوت الأخبار..."

# تحديث الكود من GitHub
if [ -d ".git" ]; then
    echo "📥 تحديث الكود..."
    git pull origin main
fi

# تثبيت الاعتماديات
echo "📦 تثبيت الاعتماديات..."
npm install --production
pip3 install -r requirements.txt

# تهيئة قاعدة البيانات
echo "📂 تهيئة قاعدة البيانات..."
node init-categories.js

# إعادة تشغيل العمليات
echo "🔄 إعادة تشغيل العمليات..."
./stop.sh
sleep 2
./start.sh

echo "✅ تم النشر بنجاح!"