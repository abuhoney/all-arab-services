#!/bin/bash
# stop.sh - إيقاف جميع عمليات النظام

echo "🛑 إيقاف نظام بوت الأخبار..."

# إيقاف عمليات Node.js
pkill -f "node server.js"
pkill -f "node news-bot.js"

# إيقاف عمليات Python
pkill -f "python3 app.py"
pkill -f "python3 bot.py"

echo "✅ تم إيقاف جميع العمليات"