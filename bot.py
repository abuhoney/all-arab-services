#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
بوت الأخبار المتكامل - ربط تيليجرام بصفحة الويب
"""

import asyncio
import json
import os
import re
import time
from datetime import datetime
from typing import Dict, List, Optional, Any
import logging

import requests
import firebase_admin
from firebase_admin import credentials, firestore, storage
from pyrogram import Client, filters
from pyrogram.types import (
    Message, CallbackQuery, InlineKeyboardMarkup, 
    InlineKeyboardButton, ForceReply
)
from pyrogram.enums import ParseMode, ChatType
from pyrogram.errors import FloodWait, BadRequest

# ==================== إعدادات ====================
logging.basicConfig(
    format='%(asctime)s - %(levelname)s - %(message)s',
    level=logging.INFO,
    handlers=[
        logging.FileHandler('news_bot.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class Config:
    BOT_TOKEN = "7560654484:AAEgkPzIvKr8FhPfag8QSo5zT28uaFzSNzs"
    API_ID = 28635681
    API_HASH = "9ab1acca768da671ab3f16eff541d999"
    SESSION_STRING = "BAG08iEATdMNVilKG2JCVKGq3JPdwQqvgAnre6YDFHHKDDMVnEdzLZHizqk9hnWkeMXpX5O8K0tkEYU20fPw6FwRXxyWAu8LnuJBT4WszjIECCPO7KWGpjjJNAIErQhZPyE9b-1CMEr_5m8wE-sqPgpK4nwBfg_l_4wbRccs3bnXC95hLQwwXr-pGYjvftef5_MUmtk6uRGVSK5r9YMKkmYunxLFB6b9jQlRlDRFm0WfHjgYQ3FYI2z10AeVlBY_6FHaXRFBecNPwzxDBJ3bQXtmBNWV46gHbr2-L5wb1nRbkZL2RN1Xv1f0GeamkiwcTy1_ZiTRl6IYBrscKFi6pbGfL8Y1zQAAAAGLsSjtAA"
    ADMIN_ID = 7082122839
    BOT_USERNAME = "@your_bot_username"
    FIREBASE_CRED_PATH = "firebase-service-account.json"
    FIREBASE_STORAGE_BUCKET = "all-arab-services-750ad.firebasestorage.app"

# Initialize Firebase Admin
cred = credentials.Certificate(Config.FIREBASE_CRED_PATH)
firebase_admin.initialize_app(cred, {
    'storageBucket': Config.FIREBASE_STORAGE_BUCKET
})
db = firestore.client()
bucket = storage.bucket()

# ==================== فئات الأخبار ====================
NEWS_CATEGORIES = {
    "general": {"name": "📰 عام", "icon": "📰"},
    "politics": {"name": "🏛️ سياسة", "icon": "🏛️"},
    "economy": {"name": "💰 اقتصاد", "icon": "💰"},
    "sports": {"name": "⚽ رياضة", "icon": "⚽"},
    "technology": {"name": "💻 تكنولوجيا", "icon": "💻"},
    "health": {"name": "🏥 صحة", "icon": "🏥"},
    "education": {"name": "📚 تعليم", "icon": "📚"},
    "entertainment": {"name": "🎬 ترفيه", "icon": "🎬"},
    "science": {"name": "🔬 علوم", "icon": "🔬"},
    "weather": {"name": "🌤️ طقس", "icon": "🌤️"},
    "accidents": {"name": "🚨 حوادث", "icon": "🚨"},
    "religious": {"name": "🕌 ديني", "icon": "🕌"},
}

# ==================== دوال قاعدة البيانات ====================
def get_news_collection():
    return db.collection('news')

def get_categories_collection():
    return db.collection('news_categories')

def get_subscribers_collection():
    return db.collection('news_subscribers')

def get_user_collection():
    return db.collection('news_bot_users')

def add_news(news_data: dict) -> str:
    """إضافة خبر جديد"""
    doc_ref = get_news_collection().document()
    news_data['id'] = doc_ref.id
    news_data['createdAt'] = firestore.SERVER_TIMESTAMP
    news_data['updatedAt'] = firestore.SERVER_TIMESTAMP
    news_data['views'] = 0
    news_data['shares'] = 0
    news_data['status'] = 'pending'  # pending, approved, rejected
    doc_ref.set(news_data)
    return doc_ref.id

def approve_news(news_id: str) -> bool:
    """الموافقة على خبر"""
    try:
        get_news_collection().document(news_id).update({
            'status': 'approved',
            'approvedAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        return True
    except Exception as e:
        logger.error(f"Approve news error: {e}")
        return False

def reject_news(news_id: str, reason: str = "") -> bool:
    """رفض خبر"""
    try:
        get_news_collection().document(news_id).update({
            'status': 'rejected',
            'rejectedAt': firestore.SERVER_TIMESTAMP,
            'rejectionReason': reason,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        return True
    except Exception as e:
        logger.error(f"Reject news error: {e}")
        return False

def delete_news(news_id: str) -> bool:
    """حذف خبر"""
    try:
        get_news_collection().document(news_id).delete()
        return True
    except Exception as e:
        logger.error(f"Delete news error: {e}")
        return False

def get_user_data(user_id: int) -> dict:
    """جلب بيانات المستخدم"""
    doc = get_user_collection().document(str(user_id)).get()
    if doc.exists:
        return doc.to_dict()
    return None

def create_user(user_id: int, username: str = "", name: str = "") -> dict:
    """إنشاء مستخدم جديد"""
    user_data = {
        'user_id': str(user_id),
        'username': username,
        'name': name,
        'points': 0,
        'subscribed_entities': [],
        'joined_at': firestore.SERVER_TIMESTAMP,
        'is_admin': user_id == Config.ADMIN_ID
    }
    get_user_collection().document(str(user_id)).set(user_data)
    return user_data

def subscribe_entity(user_id: int, entity_type: str, entity_id: str, entity_name: str) -> bool:
    """اشتراك في كيان (قناة/مجموعة)"""
    try:
        doc_ref = get_subscribers_collection().document()
        doc_ref.set({
            'id': doc_ref.id,
            'user_id': str(user_id),
            'entity_type': entity_type,
            'entity_id': entity_id,
            'entity_name': entity_name,
            'subscribed_at': firestore.SERVER_TIMESTAMP,
            'status': 'active'
        })
        
        # تحديث قائمة المشتركين للمستخدم
        user_ref = get_user_collection().document(str(user_id))
        user_ref.update({
            'subscribed_entities': firestore.ArrayUnion([{
                'type': entity_type,
                'id': entity_id,
                'name': entity_name
            }])
        })
        return True
    except Exception as e:
        logger.error(f"Subscribe entity error: {e}")
        return False

def get_all_subscribers() -> List[dict]:
    """جلب جميع المشتركين النشطين"""
    docs = get_subscribers_collection().where('status', '==', 'active').stream()
    return [doc.to_dict() for doc in docs]

def get_pending_news() -> List[dict]:
    """جلب الأخبار قيد المراجعة"""
    docs = get_news_collection().where('status', '==', 'pending').order_by('createdAt', direction=firestore.Query.DESCENDING).stream()
    return [doc.to_dict() for doc in docs]

def clean_text(text: str) -> str:
    """تنظيف النص من الروابط والكلمات غير المرغوبة"""
    # إزالة الروابط
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'www\.\S+', '', text)
    
    # إزالة اليوزرات
    text = re.sub(r'@\w+', '', text)
    
    # إزالة الكلمات غير الأخلاقية (قائمة أساسية)
    bad_words = ['كلمة1', 'كلمة2']  # أضف الكلمات المطلوبة
    for word in bad_words:
        text = re.sub(word, '***', text, flags=re.IGNORECASE)
    
    # تنظيف المسافات الزائدة
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

# ==================== البوت الرئيسي ====================
def create_app():
    """إنشاء تطبيق Pyrogram"""
    return Client(
        "news_bot_session",
        api_id=Config.API_ID,
        api_hash=Config.API_HASH,
        bot_token=Config.BOT_TOKEN,
        session_string=Config.SESSION_STRING,
        in_memory=True
    )

class NewsBot:
    def __init__(self):
        self.app = None
        self.user_sessions = {}  # لتخزين جلسات المستخدمين
        self.user_states = {}    # لتخزين حالات المستخدمين
        
    def register_handlers(self):
        """تسجيل معالجات الأوامر"""
        
        @self.app.on_message(filters.command("start"))
        async def start_command(client: Client, message: Message):
            await self.handle_start(client, message)
        
        @self.app.on_message(filters.command("news"))
        async def news_command(client: Client, message: Message):
            await self.handle_news_activation(client, message)
        
        @self.app.on_message(filters.command("admin"))
        async def admin_command(client: Client, message: Message):
            await self.handle_admin_panel(client, message)
        
        @self.app.on_message(filters.text & ~filters.command(["start", "news", "admin"]))
        async def text_handler(client: Client, message: Message):
            await self.handle_text(client, message)
        
        @self.app.on_callback_query()
        async def callback_handler(client: Client, callback: CallbackQuery):
            await self.handle_callback(client, callback)
        
        # مراقبة القنوات والمجموعات
        @self.app.on_message(filters.channel)
        async def channel_handler(client: Client, message: Message):
            await self.handle_channel_message(client, message)
        
        @self.app.on_message(filters.group)
        async def group_handler(client: Client, message: Message):
            await self.handle_group_message(client, message)
    
    async def handle_start(self, client: Client, message: Message):
        """معالجة أمر /start"""
        user = message.from_user
        user_id = user.id
        
        # إنشاء أو جلب المستخدم
        user_data = get_user_data(user_id)
        if not user_data:
            user_data = create_user(user_id, user.username or "", user.first_name or "")
        
        welcome_text = f"""
📰 **مرحباً بك في بوت الأخبار!**

▬▬▬▬▬▬▬▬▬▬▬▬
👤 **المستخدم:** {user.first_name}
🆔 **الآي دي:** `{user_id}`
💎 **النقاط:** {user_data.get('points', 0)}
▬▬▬▬▬▬▬▬▬▬▬▬

**الخدمات المتاحة:**
• 📰 تصفح آخر الأخبار
• 🔔 تفعيل الأخبار في قناتك/مجموعتك
• 🔍 البحث في الأخبار حسب الفئة

**لتفعيل الأخبار مجاناً:**
استخدم الأمر /news

**للمشرفين:**
استخدم الأمر /admin
"""
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("📰 آخر الأخبار", callback_data="latest_news")],
            [InlineKeyboardButton("🔍 فئات الأخبار", callback_data="categories")],
            [InlineKeyboardButton("🔔 تفعيل الأخبار", callback_data="activate_news")]
        ])
        
        await message.reply_text(
            welcome_text,
            reply_markup=keyboard,
            parse_mode=ParseMode.MARKDOWN
        )
    
    async def handle_news_activation(self, client: Client, message: Message):
        """معالجة تفعيل الأخبار"""
        user = message.from_user
        
        activation_text = """
🔔 **لتفعيل الأخبار في قناتك أو مجموعتك مجاناً**

**الخطوات:**
1️⃣ أضف يوزر البوت كمشرف
`@{bot_username}`

2️⃣ ثم طبق أحد هذه الخطوات:

**للمجموعات والسوبرات:**
أرسل اليوزر نيم أو الرابط
مثال: `@mygroup` أو `https://t.me/mygroup`

**للقنوات:**
أعد توجيه أي رسالة من القناة إلى هنا 👇

▬▬▬▬▬▬▬▬▬▬▬▬
""".replace('{bot_username}', Config.BOT_USERNAME.replace('@', ''))
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("❌ إلغاء", callback_data="cancel_activation")]
        ])
        
        await message.reply_text(
            activation_text,
            reply_markup=keyboard,
            parse_mode=ParseMode.MARKDOWN
        )
        
        # تعيين حالة المستخدم
        self.user_states[user.id] = "waiting_for_entity"
    
    async def handle_admin_panel(self, client: Client, message: Message):
        """لوحة تحكم المشرف"""
        user_id = message.from_user.id
        
        if user_id != Config.ADMIN_ID:
            await message.reply_text("❌ غير مصرح لك بالوصول")
            return
        
        pending_count = len(get_pending_news())
        
        admin_text = f"""
⚙️ **لوحة تحكم المشرف**

▬▬▬▬▬▬▬▬▬▬▬▬
📊 **أخبار قيد المراجعة:** {pending_count}
▬▬▬▬▬▬▬▬▬▬▬▬

**الخيارات المتاحة:**
"""
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton(f"📋 مراجعة الأخبار ({pending_count})", callback_data="review_news")],
            [InlineKeyboardButton("📂 إدارة الفئات", callback_data="manage_categories")],
            [InlineKeyboardButton("👥 المشتركين", callback_data="subscribers_list")],
            [InlineKeyboardButton("📊 إحصائيات", callback_data="admin_stats")]
        ])
        
        await message.reply_text(
            admin_text,
            reply_markup=keyboard,
            parse_mode=ParseMode.MARKDOWN
        )
    
    async def handle_text(self, client: Client, message: Message):
        """معالجة النصوص"""
        user_id = message.from_user.id
        text = message.text.strip()
        state = self.user_states.get(user_id)
        
        if state == "waiting_for_entity":
            await self.process_entity_submission(client, message)
            return
        
        if state == "waiting_for_category_name":
            await self.process_new_category(client, message)
            return
        
        if state == "waiting_for_news_edit":
            await self.process_news_edit(client, message)
            return
        
        # البحث عن الأخبار
        if text.startswith("/search"):
            query_text = text.replace("/search", "").strip()
            if query_text:
                await self.search_news(client, message, query_text)
            else:
                await message.reply_text("🔍 الرجاء إدخال نص البحث\nمثال: `/search اقتصاد`")
    
    async def handle_channel_message(self, client: Client, message: Message):
        """معالجة رسائل القنوات"""
        # التحقق من أن القناة مشتركة
        chat_id = str(message.chat.id)
        subscribers = get_subscribers_collection().where('entity_id', '==', chat_id).where('status', '==', 'active').stream()
        
        is_subscribed = any(subscribers)
        
        if not is_subscribed:
            return
        
        # جمع الأخبار من القنوات المشتركة
        if message.text or message.caption:
            text = message.text or message.caption
            
            # فحص إذا كانت رسالة تحتوي على أخبار
            if len(text) > 50 and not message.forward_from:
                news_data = {
                    'title': self.extract_title(text),
                    'content': clean_text(text),
                    'source_chat_id': chat_id,
                    'source_chat_name': message.chat.title or "قناة",
                    'status': 'pending',
                    'category_id': 'general'
                }
                
                # إرسال للمشرف للمراجعة
                await self.send_to_admin_for_review(client, news_data)
    
    async def handle_group_message(self, client: Client, message: Message):
        """معالجة رسائل المجموعات"""
        # التحقق من الأمر /news في المجموعات
        if message.text and message.text.startswith('/news'):
            await self.handle_news_activation(client, message)
    
    async def handle_callback(self, client: Client, callback: CallbackQuery):
        """معالجة الأزرار التفاعلية"""
        user_id = callback.from_user.id
        data = callback.data
        
        try:
            if data == "latest_news":
                await self.show_latest_news(client, callback)
            
            elif data == "categories":
                await self.show_categories(client, callback)
            
            elif data == "activate_news":
                await self.handle_news_activation(client, callback.message)
                await callback.answer()
            
            elif data == "cancel_activation":
                self.user_states.pop(user_id, None)
                await callback.message.edit_text("❌ تم إلغاء عملية التفعيل")
                await callback.answer()
            
            elif data == "review_news":
                if user_id != Config.ADMIN_ID:
                    await callback.answer("❌ غير مصرح", show_alert=True)
                    return
                await self.show_pending_news_list(client, callback)
            
            elif data == "manage_categories":
                if user_id != Config.ADMIN_ID:
                    await callback.answer("❌ غير مصرح", show_alert=True)
                    return
                await self.show_category_management(client, callback)
            
            elif data == "admin_stats":
                if user_id != Config.ADMIN_ID:
                    await callback.answer("❌ غير مصرح", show_alert=True)
                    return
                await self.show_admin_stats(client, callback)
            
            elif data.startswith("category_"):
                category_id = data.replace("category_", "")
                await self.show_category_news(client, callback, category_id)
            
            elif data.startswith("approve_"):
                news_id = data.replace("approve_", "")
                await self.approve_news_action(client, callback, news_id)
            
            elif data.startswith("reject_"):
                news_id = data.replace("reject_", "")
                await self.reject_news_action(client, callback, news_id)
            
            elif data.startswith("edit_"):
                news_id = data.replace("edit_", "")
                await self.edit_news_action(client, callback, news_id)
            
            elif data.startswith("delete_"):
                news_id = data.replace("delete_", "")
                await self.delete_news_action(client, callback, news_id)
            
            elif data.startswith("nav_"):
                direction = data.replace("nav_", "")
                await self.navigate_news(client, callback, direction)
            
            elif data == "share_news":
                await self.share_current_news(client, callback)
            
            elif data == "back_admin":
                await self.handle_admin_panel(client, callback.message)
                await callback.answer()
            
            elif data == "back_main":
                await self.handle_start(client, callback.message)
                await callback.answer()
            
            else:
                await callback.answer()
                
        except Exception as e:
            logger.error(f"Callback error: {e}")
            await callback.answer("حدث خطأ", show_alert=True)
    
    # ==================== دوال عرض الأخبار ====================
    async def show_latest_news(self, client: Client, callback: CallbackQuery, page: int = 0):
        """عرض آخر الأخبار"""
        news_list = get_news_collection().where('status', '==', 'approved').order_by(
            'createdAt', direction=firestore.Query.DESCENDING
        ).limit(5).stream()
        
        news_items = list(news_list)
        
        if not news_items:
            await callback.message.edit_text(
                "📰 لا توجد أخبار متاحة حالياً\nجاري تحديث المحتوى...",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("🔙 رجوع", callback_data="back_main")]
                ])
            )
            return
        
        text = "📰 **آخر الأخبار**\n▬▬▬▬▬▬▬▬▬▬▬▬\n\n"
        
        for i, news in enumerate(news_items, 1):
            title = news.get('title', 'خبر بدون عنوان')
            if len(title) > 50:
                title = title[:47] + "..."
            text += f"{i}. **{title}**\n"
            text += f"   📅 {self.format_date(news.get('createdAt'))}\n"
            text += f"   👁 {news.get('views', 0)} مشاهدة\n\n"
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("📖 عرض التفاصيل", callback_data=f"view_news_list")],
            [InlineKeyboardButton("🔍 بحث", callback_data="search_news")],
            [InlineKeyboardButton("🔙 رجوع", callback_data="back_main")]
        ])
        
        await callback.message.edit_text(
            text,
            reply_markup=keyboard,
            parse_mode=ParseMode.MARKDOWN
        )
        await callback.answer()
    
    async def show_categories(self, client: Client, callback: CallbackQuery):
        """عرض فئات الأخبار"""
        text = "📂 **فئات الأخبار**\n▬▬▬▬▬▬▬▬▬▬▬▬\n\n"
        
        buttons = []
        row = []
        for cat_id, cat_data in NEWS_CATEGORIES.items():
            text += f"• {cat_data['icon']} **{cat_data['name']}**\n"
            row.append(InlineKeyboardButton(
                f"{cat_data['icon']} {cat_data['name']}",
                callback_data=f"category_{cat_id}"
            ))
            if len(row) == 2:
                buttons.append(row)
                row = []
        if row:
            buttons.append(row)
        
        buttons.append([InlineKeyboardButton("🔙 رجوع", callback_data="back_main")])
        
        await callback.message.edit_text(
            text,
            reply_markup=InlineKeyboardMarkup(buttons),
            parse_mode=ParseMode.MARKDOWN
        )
        await callback.answer()
    
    async def show_category_news(self, client: Client, callback: CallbackQuery, category_id: str):
        """عرض أخبار فئة معينة"""
        news_list = get_news_collection().where('status', '==', 'approved').where(
            'category_id', '==', category_id
        ).order_by('createdAt', direction=firestore.Query.DESCENDING).limit(5).stream()
        
        news_items = list(news_list)
        cat_name = NEWS_CATEGORIES.get(category_id, {}).get('name', category_id)
        
        if not news_items:
            await callback.message.edit_text(
                f"📂 لا توجد أخبار في فئة {cat_name}\nجاري تحديث المحتوى...",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("🔙 رجوع للفئات", callback_data="categories")]
                ])
            )
            return
        
        text = f"📂 **{cat_name}**\n▬▬▬▬▬▬▬▬▬▬▬▬\n\n"
        
        for i, news in enumerate(news_items, 1):
            title = news.get('title', 'خبر')
            if len(title) > 50:
                title = title[:47] + "..."
            text += f"{i}. **{title}**\n"
            text += f"   👁 {news.get('views', 0)} مشاهدة\n\n"
        
        await callback.message.edit_text(
            text,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🔙 رجوع للفئات", callback_data="categories")]
            ]),
            parse_mode=ParseMode.MARKDOWN
        )
        await callback.answer()
    
    # ==================== دوال المشرف ====================
    async def show_pending_news_list(self, client: Client, callback: CallbackQuery):
        """عرض قائمة الأخبار قيد المراجعة"""
        pending = get_pending_news()
        
        if not pending:
            await callback.message.edit_text(
                "✅ لا توجد أخبار قيد المراجعة",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("🔙 رجوع", callback_data="back_admin")]
                ])
            )
            await callback.answer()
            return
        
        # تخزين الأخبار في session
        self.user_sessions[callback.from_user.id] = {
            'pending_news': pending,
            'current_index': 0
        }
        
        await self.show_single_news_review(client, callback)
        await callback.answer()
    
    async def show_single_news_review(self, client: Client, callback: CallbackQuery):
        """عرض خبر واحد للمراجعة"""
        user_id = callback.from_user.id
        session = self.user_sessions.get(user_id, {})
        pending = session.get('pending_news', [])
        index = session.get('current_index', 0)
        
        if not pending or index >= len(pending):
            await callback.message.edit_text(
                "✅ تمت مراجعة جميع الأخبار",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("🔙 رجوع", callback_data="back_admin")]
                ])
            )
            return
        
        news = pending[index]
        
        text = f"""
📋 **مراجعة خبر #{index + 1}/{len(pending)}**

▬▬▬▬▬▬▬▬▬▬▬▬
**العنوان:** {news.get('title', 'بدون عنوان')}

**المحتوى:**
{news.get('content', '')[:500]}{'...' if len(news.get('content', '')) > 500 else ''}

▬▬▬▬▬▬▬▬▬▬▬▬
**المصدر:** {news.get('source_chat_name', 'غير معروف')}
**الفئة:** {NEWS_CATEGORIES.get(news.get('category_id', 'general'), {}).get('name', 'عام')}
**التاريخ:** {self.format_date(news.get('createdAt'))}
"""
        
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("✅ موافقة", callback_data=f"approve_{news.get('id')}"),
                InlineKeyboardButton("❌ رفض", callback_data=f"reject_{news.get('id')}")
            ],
            [
                InlineKeyboardButton("✏️ تعديل", callback_data=f"edit_{news.get('id')}"),
                InlineKeyboardButton("🗑️ حذف", callback_data=f"delete_{news.get('id')}")
            ],
            [
                InlineKeyboardButton("◀️ السابق", callback_data="nav_left"),
                InlineKeyboardButton("التالي ▶️", callback_data="nav_right")
            ],
            [
                InlineKeyboardButton("🔙 رجوع", callback_data="back_admin")
            ]
        ])
        
        await callback.message.edit_text(
            text,
            reply_markup=keyboard,
            parse_mode=ParseMode.MARKDOWN
        )
    
    async def navigate_news(self, client: Client, callback: CallbackQuery, direction: str):
        """التنقل بين الأخبار"""
        user_id = callback.from_user.id
        session = self.user_sessions.get(user_id, {})
        pending = session.get('pending_news', [])
        index = session.get('current_index', 0)
        
        if direction == "right" and index < len(pending) - 1:
            session['current_index'] = index + 1
            self.user_sessions[user_id] = session
        elif direction == "left" and index > 0:
            session['current_index'] = index - 1
            self.user_sessions[user_id] = session
        
        await self.show_single_news_review(client, callback)
        await callback.answer()
    
    async def approve_news_action(self, client: Client, callback: CallbackQuery, news_id: str):
        """الموافقة على خبر"""
        if callback.from_user.id != Config.ADMIN_ID:
            await callback.answer("❌ غير مصرح", show_alert=True)
            return
        
        if approve_news(news_id):
            # إرسال الخبر إلى جميع المشتركين
            await self.broadcast_news(client, news_id)
            
            await callback.answer("✅ تمت الموافقة والنشر", show_alert=True)
            
            # الانتقال إلى الخبر التالي
            session = self.user_sessions.get(callback.from_user.id, {})
            pending = session.get('pending_news', [])
            index = session.get('current_index', 0)
            
            # إزالة الخبر من القائمة
            pending = [n for n in pending if n.get('id') != news_id]
            session['pending_news'] = pending
            if index >= len(pending):
                session['current_index'] = max(0, len(pending) - 1)
            self.user_sessions[callback.from_user.id] = session
            
            await self.show_single_news_review(client, callback)
        else:
            await callback.answer("❌ فشلت العملية", show_alert=True)
    
    async def reject_news_action(self, client: Client, callback: CallbackQuery, news_id: str):
        """رفض خبر"""
        if callback.from_user.id != Config.ADMIN_ID:
            await callback.answer("❌ غير مصرح", show_alert=True)
            return
        
        if reject_news(news_id, "مرفوض من المشرف"):
            await callback.answer("❌ تم رفض الخبر", show_alert=True)
            
            session = self.user_sessions.get(callback.from_user.id, {})
            pending = session.get('pending_news', [])
            pending = [n for n in pending if n.get('id') != news_id]
            session['pending_news'] = pending
            self.user_sessions[callback.from_user.id] = session
            
            await self.show_single_news_review(client, callback)
        else:
            await callback.answer("❌ فشلت العملية", show_alert=True)
    
    async def edit_news_action(self, client: Client, callback: CallbackQuery, news_id: str):
        """تعديل خبر"""
        if callback.from_user.id != Config.ADMIN_ID:
            await callback.answer("❌ غير مصرح", show_alert=True)
            return
        
        self.user_states[callback.from_user.id] = f"editing_{news_id}"
        
        await callback.message.reply_text(
            "✏️ أرسل التعديلات بالتنسيق التالي:\n\n"
            "`title: العنوان الجديد`\n"
            "`category: معرف_الفئة`\n"
            "`content: المحتوى الجديد`\n\n"
            "أو أرسل /cancel للإلغاء",
            parse_mode=ParseMode.MARKDOWN
        )
        await callback.answer()
    
    async def delete_news_action(self, client: Client, callback: CallbackQuery, news_id: str):
        """حذف خبر"""
        if callback.from_user.id != Config.ADMIN_ID:
            await callback.answer("❌ غير مصرح", show_alert=True)
            return
        
        if delete_news(news_id):
            await callback.answer("🗑️ تم حذف الخبر", show_alert=True)
            
            session = self.user_sessions.get(callback.from_user.id, {})
            pending = session.get('pending_news', [])
            pending = [n for n in pending if n.get('id') != news_id]
            session['pending_news'] = pending
            self.user_sessions[callback.from_user.id] = session
            
            await self.show_single_news_review(client, callback)
        else:
            await callback.answer("❌ فشل الحذف", show_alert=True)
    
    async def broadcast_news(self, client: Client, news_id: str):
        """نشر الخبر إلى جميع المشتركين"""
        news_doc = get_news_collection().document(news_id).get()
        if not news_doc.exists:
            return
        
        news = news_doc.to_dict()
        subscribers = get_all_subscribers()
        
        news_text = f"""
📰 **{news.get('title', 'خبر جديد')}**

▬▬▬▬▬▬▬▬▬▬▬▬
{news.get('content', '')[:1000]}{'...' if len(news.get('content', '')) > 1000 else ''}
▬▬▬▬▬▬▬▬▬▬▬▬

📂 **الفئة:** {NEWS_CATEGORIES.get(news.get('category_id', 'general'), {}).get('name', 'عام')}
🔗 **للمزيد:** {os.environ.get('WEB_URL', 'https://example.com')}/news.html?id={news_id}
🤖 **تابعنا:** {Config.BOT_USERNAME}
"""
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("📖 اقرأ المزيد", url=f"{os.environ.get('WEB_URL', 'https://example.com')}/news.html?id={news_id}")]
        ])
        
        for sub in subscribers:
            try:
                entity_id = sub.get('entity_id')
                if entity_id:
                    await client.send_message(
                        int(entity_id),
                        news_text,
                        reply_markup=keyboard,
                        parse_mode=ParseMode.MARKDOWN
                    )
                    await asyncio.sleep(0.5)  # تجنب flood
            except Exception as e:
                logger.error(f"Broadcast error to {sub.get('entity_id')}: {e}")
    
    # ==================== دوال التفعيل ====================
    async def process_entity_submission(self, client: Client, message: Message):
        """معالجة تقديم كيان للتفعيل"""
        user_id = message.from_user.id
        text = message.text.strip()
        
        # التحقق من نوع الكيان
        entity_type = None
        entity_id = None
        entity_name = text
        
        if text.startswith('@'):
            entity_type = 'group'  # يمكن أن تكون مجموعة أو سوبر
            entity_id = text
        elif text.startswith('https://t.me/'):
            entity_type = 'group'
            entity_id = text.split('/')[-1]
            if not entity_id.startswith('@'):
                entity_id = '@' + entity_id
        elif message.forward_from_chat:
            entity_type = 'channel'
            entity_id = str(message.forward_from_chat.id)
            entity_name = message.forward_from_chat.title or text
        
        if entity_type and entity_id:
            # التحقق من أن البوت مشرف في الكيان
            try:
                if entity_type == 'channel':
                    chat = await client.get_chat(int(entity_id))
                else:
                    chat = await client.get_chat(entity_id)
                
                # محاولة الاشتراك
                if subscribe_entity(user_id, entity_type, str(chat.id), chat.title or entity_name):
                    self.user_states.pop(user_id, None)
                    
                    success_text = f"""
✅ **تم تفعيل الأخبار بنجاح!**

▬▬▬▬▬▬▬▬▬▬▬▬
📋 **الكيان:** {chat.title or entity_name}
🆔 **المعرف:** {chat.id}
📅 **النوع:** {'قناة' if entity_type == 'channel' else 'مجموعة'}
▬▬▬▬▬▬▬▬▬▬▬▬

🔔 سيتم إرسال الأخبار تلقائياً
💎 **+10 نقاط** تمت إضافتها لحسابك!

**ملاحظة:** تأكد من أن البوت مشرف في الكيان
"""
                    
                    # إضافة نقاط
                    user_ref = get_user_collection().document(str(user_id))
                    user_ref.update({'points': firestore.Increment(10)})
                    
                    await message.reply_text(
                        success_text,
                        reply_markup=InlineKeyboardMarkup([
                            [InlineKeyboardButton("🔙 القائمة الرئيسية", callback_data="back_main")]
                        ]),
                        parse_mode=ParseMode.MARKDOWN
                    )
                else:
                    await message.reply_text("❌ فشل التفعيل، حاول مرة أخرى")
            except Exception as e:
                await message.reply_text(
                    f"❌ لا يمكن الوصول إلى الكيان. تأكد من:\n"
                    f"• إضافة البوت كمشرف\n"
                    f"• صحة الرابط أو المعرف\n\n"
                    f"خطأ: {str(e)[:100]}"
                )
        else:
            await message.reply_text(
                "❌ صيغة غير صحيحة\n\n"
                "**للمجموعات:** أرسل `@username` أو الرابط\n"
                "**للقنوات:** أعد توجيه أي رسالة من القناة",
                parse_mode=ParseMode.MARKDOWN
            )
    
    async def send_to_admin_for_review(self, client: Client, news_data: dict):
        """إرسال خبر للمشرف للمراجعة"""
        try:
            news_id = add_news(news_data)
            
            admin_text = f"""
📋 **خبر جديد للمراجعة**

▬▬▬▬▬▬▬▬▬▬▬▬
**المصدر:** {news_data.get('source_chat_name')}
**العنوان:** {news_data.get('title', 'بدون عنوان')}

**المحتوى:**
{news_data.get('content', '')[:300]}...

▬▬▬▬▬▬▬▬▬▬▬▬
"""
            
            keyboard = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("✅ موافقة", callback_data=f"approve_{news_id}"),
                    InlineKeyboardButton("❌ رفض", callback_data=f"reject_{news_id}")
                ],
                [InlineKeyboardButton("🔍 عرض كامل", callback_data=f"view_full_{news_id}")]
            ])
            
            await client.send_message(
                Config.ADMIN_ID,
                admin_text,
                reply_markup=keyboard,
                parse_mode=ParseMode.MARKDOWN
            )
        except Exception as e:
            logger.error(f"Send to admin error: {e}")
    
    # ==================== دوال مساعدة ====================
    def extract_title(self, text: str) -> str:
        """استخراج العنوان من النص"""
        # محاولة العثور على سطر أول مناسب كعنوان
        lines = text.split('\n')
        
        # تنظيف السطر الأول
        title = lines[0].strip()
        
        # إزالة الرموز والهاشتاجات
        title = re.sub(r'[#@]\w+', '', title)
        title = re.sub(r'[^\w\s\u0600-\u06FF]', '', title)
        title = title.strip()
        
        # إذا كان العنوان قصيراً جداً، خذ أول 50 حرف
        if len(title) < 10 and len(lines) > 1:
            title = text[:100].strip()
        
        # تحديد الطول المناسب
        if len(title) > 100:
            title = title[:97] + "..."
        
        return title or "خبر بدون عنوان"
    
    def format_date(self, timestamp) -> str:
        """تنسيق التاريخ"""
        if not timestamp:
            return "غير معروف"
        try:
            if hasattr(timestamp, 'to_datetime'):
                dt = timestamp.to_datetime()
            elif isinstance(timestamp, datetime):
                dt = timestamp
            else:
                return str(timestamp)[:10]
            
            return dt.strftime("%Y-%m-%d %H:%M")
        except:
            return str(timestamp)[:10]
    
    async def show_admin_stats(self, client: Client, callback: CallbackQuery):
        """عرض إحصائيات المشرف"""
        # جلب الإحصائيات
        total_news = len(get_news_collection().stream())
        approved_news = len(get_news_collection().where('status', '==', 'approved').stream())
        pending_news = len(get_pending_news())
        total_subscribers = len(get_subscribers_collection().where('status', '==', 'active').stream())
        
        stats_text = f"""
📊 **إحصائيات المنظومة الإخبارية**

▬▬▬▬▬▬▬▬▬▬▬▬
📰 **إجمالي الأخبار:** {total_news}
✅ **الأخبار المنشورة:** {approved_news}
⏳ **قيد المراجعة:** {pending_news}
👥 **المشتركين:** {total_subscribers}
▬▬▬▬▬▬▬▬▬▬▬▬
"""
        
        await callback.message.edit_text(
            stats_text,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🔙 رجوع", callback_data="back_admin")]
            ]),
            parse_mode=ParseMode.MARKDOWN
        )
        await callback.answer()
    
    async def show_category_management(self, client: Client, callback: CallbackQuery):
        """إدارة الفئات"""
        text = "📂 **إدارة فئات الأخبار**\n▬▬▬▬▬▬▬▬▬▬▬▬\n\n"
        
        buttons = []
        for cat_id, cat_data in NEWS_CATEGORIES.items():
            count = len(get_news_collection().where('category_id', '==', cat_id).stream())
            text += f"• {cat_data['icon']} **{cat_data['name']}** ({count} خبر)\n"
        
        buttons.append([InlineKeyboardButton("➕ إضافة فئة", callback_data="add_category")])
        buttons.append([InlineKeyboardButton("🔙 رجوع", callback_data="back_admin")])
        
        await callback.message.edit_text(
            text,
            reply_markup=InlineKeyboardMarkup(buttons),
            parse_mode=ParseMode.MARKDOWN
        )
        await callback.answer()
    
    async def search_news(self, client: Client, message: Message, query: str):
        """البحث في الأخبار"""
        # البحث في العناوين والمحتوى
        all_news = get_news_collection().where('status', '==', 'approved').order_by(
            'createdAt', direction=firestore.Query.DESCENDING
        ).limit(20).stream()
        
        results = []
        for news in all_news:
            data = news.to_dict()
            if (query.lower() in data.get('title', '').lower() or 
                query.lower() in data.get('content', '').lower()):
                results.append(data)
        
        if not results:
            await message.reply_text(f"🔍 لا توجد نتائج لـ: **{query}**")
            return
        
        text = f"🔍 **نتائج البحث عن: {query}**\n▬▬▬▬▬▬▬▬▬▬▬▬\n\n"
        
        for i, news in enumerate(results[:5], 1):
            title = news.get('title', 'خبر')
            if len(title) > 50:
                title = title[:47] + "..."
            text += f"{i}. **{title}**\n"
            text += f"   📂 {NEWS_CATEGORIES.get(news.get('category_id', 'general'), {}).get('name', 'عام')}\n\n"
        
        await message.reply_text(
            text,
            parse_mode=ParseMode.MARKDOWN
        )
    
    async def run(self):
        """تشغيل البوت"""
        self.app = create_app()
        self.register_handlers()
        
        await self.app.start()
        logger.info("✅ News Bot started successfully!")
        
        # إرسال إشعار للمشرف
        try:
            await self.app.send_message(
                Config.ADMIN_ID,
                "🤖 **بوت الأخبار يعمل الآن!**\n\n"
                "استخدم /admin للوصول إلى لوحة التحكم",
                parse_mode=ParseMode.MARKDOWN
            )
        except:
            pass
        
        await asyncio.Event().wait()
    
    async def shutdown(self):
        """إيقاف البوت"""
        if self.app and self.app.is_connected:
            await self.app.stop()

# ==================== التشغيل ====================
async def main():
    bot = NewsBot()
    try:
        await bot.run()
    except KeyboardInterrupt:
        await bot.shutdown()
    except Exception as e:
        logger.error(f"Main error: {e}")
        await bot.shutdown()

if __name__ == "__main__":
    asyncio.run(main())