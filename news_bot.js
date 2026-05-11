#!/usr/bin/env node
// news-bot.js - بوت الأخبار المتكامل

const { Telegraf, Markup, session, Scenes } = require('telegraf');
const { message } = require('telegraf/filters');
const admin = require('firebase-admin');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// ==================== Firebase Initialization ====================
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync('./firebase-service-account.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

// ==================== Configuration ====================
const CONFIG = {
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "7560654484:AAEgkPzIvKr8FhPfag8QSo5zT28uaFzSNzs",
    ADMIN_IDS: [7082122839],
    BOT_USERNAME: process.env.BOT_USERNAME || "@your_bot_username",
    WEB_URL: process.env.WEB_URL || "https://your-domain.com",
    MAX_NEWS_PER_PAGE: 5,
    POINTS_PER_SUBSCRIBE: 10,
    POINTS_PER_REFERRAL: 50
};

// ==================== News Categories ====================
const NEWS_CATEGORIES = {
    general: { name: "📰 عام", icon: "📰", color: "blue" },
    politics: { name: "🏛️ سياسة", icon: "🏛️", color: "red" },
    economy: { name: "💰 اقتصاد", icon: "💰", color: "green" },
    sports: { name: "⚽ رياضة", icon: "⚽", color: "orange" },
    technology: { name: "💻 تكنولوجيا", icon: "💻", color: "purple" },
    health: { name: "🏥 صحة", icon: "🏥", color: "pink" },
    education: { name: "📚 تعليم", icon: "📚", color: "indigo" },
    entertainment: { name: "🎬 ترفيه", icon: "🎬", color: "yellow" },
    science: { name: "🔬 علوم", icon: "🔬", color: "cyan" },
    weather: { name: "🌤️ طقس", icon: "🌤️", color: "sky" },
    accidents: { name: "🚨 حوادث", icon: "🚨", color: "red" },
    religious: { name: "🕌 ديني", icon: "🕌", color: "emerald" }
};

// ==================== Database Helper Functions ====================

class Database {
    // News Operations
    static async addNews(newsData) {
        const docRef = db.collection('news').doc();
        const data = {
            id: docRef.id,
            ...newsData,
            status: 'pending',
            views: 0,
            shares: 0,
            likes: 0,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        };
        await docRef.set(data);
        return { id: docRef.id, ...data };
    }

    static async getNewsById(newsId) {
        const doc = await db.collection('news').doc(newsId).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    }

    static async getNewsList({ status = 'approved', category = null, limit = 20, lastDoc = null } = {}) {
        let query = db.collection('news').where('status', '==', status);
        
        if (category && category !== 'all') {
            query = query.where('category_id', '==', category);
        }
        
        query = query.orderBy('createdAt', 'desc');
        
        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }
        
        query = query.limit(limit);
        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    static async getPendingNews() {
        const snapshot = await db.collection('news')
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    static async approveNews(newsId, adminId) {
        await db.collection('news').doc(newsId).update({
            status: 'approved',
            approvedBy: String(adminId),
            approvedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
    }

    static async rejectNews(newsId, adminId, reason = '') {
        await db.collection('news').doc(newsId).update({
            status: 'rejected',
            rejectedBy: String(adminId),
            rejectedAt: FieldValue.serverTimestamp(),
            rejectionReason: reason,
            updatedAt: FieldValue.serverTimestamp()
        });
    }

    static async updateNews(newsId, updates) {
        updates.updatedAt = FieldValue.serverTimestamp();
        await db.collection('news').doc(newsId).update(updates);
    }

    static async deleteNews(newsId) {
        await db.collection('news').doc(newsId).delete();
    }

    static async incrementViews(newsId) {
        await db.collection('news').doc(newsId).update({
            views: FieldValue.increment(1)
        });
    }

    static async incrementShares(newsId) {
        await db.collection('news').doc(newsId).update({
            shares: FieldValue.increment(1)
        });
    }

    static async searchNews(query, limit = 20) {
        const snapshot = await db.collection('news')
            .where('status', '==', 'approved')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
        
        const results = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(news => {
                const title = (news.title || '').toLowerCase();
                const content = (news.content || '').toLowerCase();
                const q = query.toLowerCase();
                return title.includes(q) || content.includes(q);
            })
            .slice(0, limit);
        
        return results;
    }

    // Category Operations
    static async getCategories() {
        const snapshot = await db.collection('news_categories')
            .orderBy('order', 'asc')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    static async addCategory(categoryData) {
        const docRef = db.collection('news_categories').doc(categoryData.id);
        await docRef.set({
            ...categoryData,
            createdAt: FieldValue.serverTimestamp()
        });
    }

    // User Operations
    static async getUser(userId) {
        const doc = await db.collection('news_bot_users').doc(String(userId)).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    }

    static async createUser(userData) {
        const userId = String(userData.user_id);
        const data = {
            ...userData,
            points: 0,
            total_subscribes: 0,
            subscribed_entities: [],
            created_at: FieldValue.serverTimestamp(),
            last_active: FieldValue.serverTimestamp()
        };
        await db.collection('news_bot_users').doc(userId).set(data);
        return data;
    }

    static async updateUser(userId, updates) {
        updates.last_active = FieldValue.serverTimestamp();
        await db.collection('news_bot_users').doc(String(userId)).update(updates);
    }

    static async addUserPoints(userId, points) {
        await db.collection('news_bot_users').doc(String(userId)).update({
            points: FieldValue.increment(points)
        });
    }

    // Subscriber Operations
    static async addSubscriber(subscriberData) {
        const docRef = db.collection('news_subscribers').doc();
        const data = {
            id: docRef.id,
            ...subscriberData,
            status: 'active',
            subscribed_at: FieldValue.serverTimestamp()
        };
        await docRef.set(data);
        
        // Update user's subscribed entities
        await db.collection('news_bot_users').doc(String(subscriberData.user_id)).update({
            subscribed_entities: FieldValue.arrayUnion({
                type: subscriberData.entity_type,
                id: subscriberData.entity_id,
                name: subscriberData.entity_name,
                subscribed_at: new Date().toISOString()
            }),
            total_subscribes: FieldValue.increment(1)
        });
        
        return data;
    }

    static async getActiveSubscribers() {
        const snapshot = await db.collection('news_subscribers')
            .where('status', '==', 'active')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    static async removeSubscriber(entityId) {
        const snapshot = await db.collection('news_subscribers')
            .where('entity_id', '==', entityId)
            .get();
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { status: 'inactive', removed_at: FieldValue.serverTimestamp() });
        });
        await batch.commit();
    }

    // Stats Operations
    static async getStats() {
        const [totalNews, approvedNews, pendingNews, subscribers, users] = await Promise.all([
            db.collection('news').count().get().then(s => s.data().count),
            db.collection('news').where('status', '==', 'approved').count().get().then(s => s.data().count),
            db.collection('news').where('status', '==', 'pending').count().get().then(s => s.data().count),
            db.collection('news_subscribers').where('status', '==', 'active').count().get().then(s => s.data().count),
            db.collection('news_bot_users').count().get().then(s => s.data().count)
        ]);
        
        return { totalNews, approvedNews, pendingNews, subscribers, users };
    }
}

// ==================== Text Cleaner ====================
class TextCleaner {
    static badWords = ['كلمة_مسيئة1', 'كلمة_مسيئة2']; // أضف الكلمات المطلوبة
    
    static clean(text) {
        if (!text) return '';
        
        let cleaned = text;
        
        // Remove URLs
        cleaned = cleaned.replace(/https?:\/\/\S+/g, '');
        cleaned = cleaned.replace(/www\.\S+/g, '');
        
        // Remove usernames
        cleaned = cleaned.replace(/@\w+/g, '');
        
        // Remove bad words
        this.badWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            cleaned = cleaned.replace(regex, '***');
        });
        
        // Remove HTML tags
        cleaned = cleaned.replace(/<[^>]*>/g, '');
        
        // Clean extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        return cleaned;
    }
    
    static extractTitle(text, maxLength = 100) {
        const cleaned = this.clean(text);
        const lines = cleaned.split('\n');
        let title = lines[0].trim();
        
        // Remove symbols and hashtags
        title = title.replace(/[#@]\w+/g, '');
        title = title.replace(/[^\w\s\u0600-\u06FF]/g, '');
        title = title.trim();
        
        if (title.length < 10 && lines.length > 1) {
            title = cleaned.substring(0, maxLength).trim();
        }
        
        if (title.length > maxLength) {
            title = title.substring(0, maxLength - 3) + '...';
        }
        
        return title || 'خبر بدون عنوان';
    }
}

// ==================== Keyboard Builders ====================
class Keyboards {
    static mainMenu() {
        return Markup.inlineKeyboard([
            [Markup.button.callback('📰 آخر الأخبار', 'latest_news')],
            [Markup.button.callback('🔍 فئات الأخبار', 'categories')],
            [Markup.button.callback('🔔 تفعيل الأخبار', 'activate_news')],
            [Markup.button.callback('📊 إحصائياتي', 'my_stats')],
            [Markup.button.callback('❓ مساعدة', 'help')]
        ]);
    }

    static adminMenu(pendingCount = 0) {
        return Markup.inlineKeyboard([
            [Markup.button.callback(`📋 مراجعة الأخبار (${pendingCount})`, 'review_news')],
            [Markup.button.callback('📂 إدارة الفئات', 'manage_categories')],
            [Markup.button.callback('👥 المشتركين', 'subscribers_list')],
            [Markup.button.callback('📊 إحصائيات', 'admin_stats')],
            [Markup.button.callback('🔍 بحث', 'admin_search')],
            [Markup.button.callback('📤 إرسال جماعي', 'broadcast')],
            [Markup.button.callback('🔙 القائمة الرئيسية', 'back_main')]
        ]);
    }

    static categoriesMenu() {
        const buttons = [];
        const categories = Object.entries(NEWS_CATEGORIES);
        
        for (let i = 0; i < categories.length; i += 2) {
            const row = [];
            row.push(Markup.button.callback(
                `${categories[i][1].icon} ${categories[i][1].name}`,
                `category_${categories[i][0]}`
            ));
            if (i + 1 < categories.length) {
                row.push(Markup.button.callback(
                    `${categories[i + 1][1].icon} ${categories[i + 1][1].name}`,
                    `category_${categories[i + 1][0]}`
                ));
            }
            buttons.push(row);
        }
        
        buttons.push([Markup.button.callback('🔙 رجوع', 'back_main')]);
        return Markup.inlineKeyboard(buttons);
    }

    static newsReviewKeyboard(newsId, currentIndex, totalCount) {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('✅ موافقة', `approve_${newsId}`),
                Markup.button.callback('❌ رفض', `reject_${newsId}`)
            ],
            [
                Markup.button.callback('✏️ تعديل', `edit_${newsId}`),
                Markup.button.callback('🗑️ حذف', `delete_${newsId}`)
            ],
            [
                Markup.button.callback('◀️ السابق', `nav_left`),
                Markup.button.callback(`${currentIndex + 1}/${totalCount}`, 'nav_none'),
                Markup.button.callback('التالي ▶️', `nav_right`)
            ],
            [
                Markup.button.callback('🔙 رجوع', 'back_admin')
            ]
        ]);
    }

    static backButton(callbackData = 'back_main') {
        return Markup.inlineKeyboard([
            [Markup.button.callback('🔙 رجوع', callbackData)]
        ]);
    }

    static cancelButton() {
        return Markup.inlineKeyboard([
            [Markup.button.callback('❌ إلغاء', 'cancel_action')]
        ]);
    }
}

// ==================== Bot Class ====================
class NewsBot {
    constructor() {
        this.bot = new Telegraf(CONFIG.BOT_TOKEN);
        this.userSessions = new Map();
        this.userStates = new Map();
        this.pendingNewsCache = new Map();
        
        this.init();
    }

    init() {
        // Initialize categories in Firestore
        this.initCategories();
        
        // Register middlewares
        this.registerMiddlewares();
        
        // Register commands
        this.registerCommands();
        
        // Register actions
        this.registerActions();
        
        // Error handler
        this.bot.catch((err, ctx) => {
            console.error('Bot error:', err);
            ctx.reply('❌ حدث خطأ غير متوقع. الرجاء المحاولة مرة أخرى.').catch(() => {});
        });
    }

    async initCategories() {
        try {
            const existingCats = await Database.getCategories();
            if (existingCats.length === 0) {
                const batch = db.batch();
                Object.entries(NEWS_CATEGORIES).forEach(([id, data], index) => {
                    const ref = db.collection('news_categories').doc(id);
                    batch.set(ref, {
                        id,
                        ...data,
                        order: index + 1,
                        createdAt: FieldValue.serverTimestamp()
                    });
                });
                await batch.commit();
                console.log('✅ Categories initialized');
            }
        } catch (error) {
            console.error('Init categories error:', error);
        }
    }

    registerMiddlewares() {
        // Session middleware
        this.bot.use(async (ctx, next) => {
            if (!ctx.from) return next();
            
            const userId = ctx.from.id;
            let user = await Database.getUser(userId);
            
            if (!user) {
                user = await Database.createUser({
                    user_id: String(userId),
                    username: ctx.from.username || '',
                    first_name: ctx.from.first_name || '',
                    last_name: ctx.from.last_name || '',
                    is_admin: CONFIG.ADMIN_IDS.includes(userId),
                    language: 'ar'
                });
            }
            
            ctx.user = user;
            return next();
        });
    }

    registerCommands() {
        // Start command
        this.bot.command('start', async (ctx) => {
            await this.handleStart(ctx);
        });

        // News activation command
        this.bot.command('news', async (ctx) => {
            await this.handleNewsActivation(ctx);
        });

        // Admin panel command
        this.bot.command('admin', async (ctx) => {
            await this.handleAdminPanel(ctx);
        });

        // Search command
        this.bot.command('search', async (ctx) => {
            const query = ctx.message.text.replace('/search', '').trim();
            if (query) {
                await this.handleSearch(ctx, query);
            } else {
                ctx.reply('🔍 الرجاء إدخال نص البحث\nمثال: /search اقتصاد');
            }
        });

        // Stats command
        this.bot.command('stats', async (ctx) => {
            await this.handleUserStats(ctx);
        });
    }

    registerActions() {
        // Handle callback queries
        this.bot.on('callback_query', async (ctx) => {
            const data = ctx.callbackQuery.data;
            const userId = ctx.from.id;
            
            try {
                if (data === 'latest_news') {
                    await this.showLatestNews(ctx);
                } else if (data === 'categories') {
                    await this.showCategories(ctx);
                } else if (data === 'activate_news') {
                    await this.handleNewsActivation(ctx);
                } else if (data === 'my_stats') {
                    await this.handleUserStats(ctx);
                } else if (data === 'help') {
                    await this.showHelp(ctx);
                } else if (data === 'back_main') {
                    await this.showMainMenu(ctx);
                } else if (data === 'back_admin') {
                    await this.handleAdminPanel(ctx);
                } else if (data === 'cancel_action') {
                    await this.cancelAction(ctx);
                } else if (data === 'review_news') {
                    await this.showPendingNews(ctx);
                } else if (data === 'manage_categories') {
                    await this.showCategoryManagement(ctx);
                } else if (data === 'subscribers_list') {
                    await this.showSubscribersList(ctx);
                } else if (data === 'admin_stats') {
                    await this.showAdminStats(ctx);
                } else if (data === 'admin_search') {
                    await this.startAdminSearch(ctx);
                } else if (data === 'broadcast') {
                    await this.startBroadcast(ctx);
                } else if (data.startsWith('category_')) {
                    const categoryId = data.replace('category_', '');
                    await this.showCategoryNews(ctx, categoryId);
                } else if (data.startsWith('approve_')) {
                    const newsId = data.replace('approve_', '');
                    await this.approveNews(ctx, newsId);
                } else if (data.startsWith('reject_')) {
                    const newsId = data.replace('reject_', '');
                    await this.rejectNews(ctx, newsId);
                } else if (data.startsWith('edit_')) {
                    const newsId = data.replace('edit_', '');
                    await this.startEditNews(ctx, newsId);
                } else if (data.startsWith('delete_')) {
                    const newsId = data.replace('delete_', '');
                    await this.deleteNews(ctx, newsId);
                } else if (data.startsWith('nav_')) {
                    await this.navigateNews(ctx, data);
                } else if (data.startsWith('share_')) {
                    const newsId = data.replace('share_', '');
                    await this.shareNews(ctx, newsId);
                } else if (data.startsWith('view_news_')) {
                    const newsId = data.replace('view_news_', '');
                    await this.viewNewsDetails(ctx, newsId);
                } else if (data.startsWith('page_')) {
                    const page = parseInt(data.replace('page_', ''));
                    await this.showLatestNews(ctx, page);
                } else {
                    ctx.answerCbQuery('⚠️ إجراء غير معروف');
                }
                
                ctx.answerCbQuery().catch(() => {});
            } catch (error) {
                console.error('Callback error:', error);
                ctx.answerCbQuery('❌ حدث خطأ').catch(() => {});
            }
        });

        // Handle text messages
        this.bot.on('text', async (ctx) => {
            const userId = ctx.from.id;
            const text = ctx.message.text.trim();
            const state = this.userStates.get(userId);
            
            if (state) {
                await this.handleStateMessage(ctx, state, text);
                return;
            }
            
            // Handle forwarded messages for channel activation
            if (ctx.message.forward_from_chat) {
                await this.handleForwardedMessage(ctx);
                return;
            }
            
            // Check if it's an entity submission
            if (text.startsWith('@') || text.startsWith('https://t.me/')) {
                await this.handleEntitySubmission(ctx, text);
                return;
            }
        });

        // Handle channel posts
        this.bot.on('channel_post', async (ctx) => {
            await this.handleChannelPost(ctx);
        });
    }

    // ==================== Command Handlers ====================
    async handleStart(ctx) {
        const user = ctx.from;
        const userData = ctx.user;
        
        const welcomeText = `
📰 **مرحباً بك في بوت الأخبار!**

▬▬▬▬▬▬▬▬▬▬▬▬
👤 **المستخدم:** ${user.first_name}
🆔 **الآي دي:** \`${user.id}\`
💎 **النقاط:** ${userData.points || 0}
📡 **المشتركين:** ${userData.total_subscribes || 0}
▬▬▬▬▬▬▬▬▬▬▬▬

**الخدمات المتاحة:**
• 📰 تصفح آخر الأخبار
• 🔔 تفعيل الأخبار في قناتك/مجموعتك
• 🔍 البحث في الأخبار حسب الفئة
• 💎 نظام نقاط ومكافآت

**لتفعيل الأخبار مجاناً:**
استخدم الأمر /news

**للبحث:**
استخدم الأمر /search

**للمشرفين:**
استخدم الأمر /admin
`;

        await ctx.reply(welcomeText, {
            parse_mode: 'Markdown',
            ...Keyboards.mainMenu()
        });
    }

    async handleNewsActivation(ctx) {
        const activationText = `
🔔 **لتفعيل الأخبار في قناتك أو مجموعتك مجاناً**

**الخطوات:**
1️⃣ أضف يوزر البوت كمشرف
\`${CONFIG.BOT_USERNAME}\`

2️⃣ ثم طبق أحد هذه الخطوات:

**للمجموعات والسوبرات:**
أرسل اليوزر نيم أو الرابط
مثال: \`@mygroup\` أو \`https://t.me/mygroup\`

**للقنوات:**
أعد توجيه أي رسالة من القناة إلى هنا 👇

▬▬▬▬▬▬▬▬▬▬▬▬

💎 **ستحصل على ${CONFIG.POINTS_PER_SUBSCRIBE} نقاط** عند التفعيل
`;

        this.userStates.set(ctx.from.id, 'waiting_for_entity');
        
        await ctx.reply(activationText, {
            parse_mode: 'Markdown',
            ...Keyboards.cancelButton()
        });
    }

    async handleAdminPanel(ctx) {
        if (!CONFIG.ADMIN_IDS.includes(ctx.from.id)) {
            return ctx.reply('❌ غير مصرح لك بالوصول');
        }

        const stats = await Database.getStats();
        const pendingCount = stats.pendingNews;

        const adminText = `
⚙️ **لوحة تحكم المشرف**

▬▬▬▬▬▬▬▬▬▬▬▬
📊 **إحصائيات سريعة:**
• 📰 إجمالي الأخبار: ${stats.totalNews}
• ✅ المنشورة: ${stats.approvedNews}
• ⏳ قيد المراجعة: ${pendingCount}
• 👥 المشتركين: ${stats.subscribers}
• 👤 المستخدمين: ${stats.users}
▬▬▬▬▬▬▬▬▬▬▬▬

**الخيارات المتاحة:**
`;

        await ctx.reply(adminText, {
            parse_mode: 'Markdown',
            ...Keyboards.adminMenu(pendingCount)
        });
    }

    async handleSearch(ctx, query) {
        const results = await Database.searchNews(query);
        
        if (results.length === 0) {
            return ctx.reply(`🔍 لا توجد نتائج لـ: **${query}**`);
        }

        let text = `🔍 **نتائج البحث عن: ${query}**\n▬▬▬▬▬▬▬▬▬▬▬▬\n\n`;
        
        const buttons = [];
        results.slice(0, 10).forEach((news, index) => {
            const title = (news.title || 'خبر').substring(0, 50);
            text += `${index + 1}. **${title}**\n`;
            text += `   📂 ${NEWS_CATEGORIES[news.category_id]?.name || 'عام'}\n\n`;
            
            buttons.push([Markup.button.callback(
                `${index + 1}. ${title.substring(0, 30)}...`,
                `view_news_${news.id}`
            )]);
        });
        
        buttons.push([Markup.button.callback('🔙 رجوع', 'back_main')]);

        await ctx.reply(text, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    }

    async handleUserStats(ctx) {
        const user = ctx.user;
        const stats = await Database.getStats();
        
        const statsText = `
📊 **إحصائياتك**

▬▬▬▬▬▬▬▬▬▬▬▬
💎 **النقاط:** ${user.points || 0}
📡 **المشتركين:** ${user.total_subscribes || 0}
📅 **تاريخ الانضمام:** ${user.created_at ? new Date(user.created_at._seconds * 1000).toLocaleDateString('ar-EG') : 'غير معروف'}
▬▬▬▬▬▬▬▬▬▬▬▬

📊 **إحصائيات المنصة:**
• 📰 إجمالي الأخبار: ${stats.approvedNews}
• 👥 المستخدمين: ${stats.users}
`;

        await ctx.reply(statsText, {
            parse_mode: 'Markdown',
            ...Keyboards.backButton()
        });
    }

    async showHelp(ctx) {
        const helpText = `
❓ **مساعدة البوت**

▬▬▬▬▬▬▬▬▬▬▬▬

**الأوامر المتاحة:**
• /start - القائمة الرئيسية
• /news - تفعيل الأخبار
• /search [نص] - البحث في الأخبار
• /stats - إحصائياتك
• /admin - لوحة المشرف (للمشرفين فقط)

**كيفية تفعيل الأخبار:**
1. أضف البوت كمشرف في قناتك/مجموعتك
2. استخدم /news
3. أرسل معرف القناة أو المجموعة
4. للأخبار

**النقاط والمكافآت:**
• +${CONFIG.POINTS_PER_SUBSCRIBE} نقاط عند تفعيل قناة/مجموعة
• +${CONFIG.POINTS_PER_REFERRAL} نقاط عن كل مشترك جديد

**للمزيد من المساعدة:**
تواصل مع المشرف
`;

        await ctx.reply(helpText, {
            parse_mode: 'Markdown',
            ...Keyboards.backButton()
        });
    }

    // ==================== News Display ====================
    async showLatestNews(ctx, page = 0) {
        const newsList = await Database.getNewsList({
            limit: CONFIG.MAX_NEWS_PER_PAGE
        });

        if (newsList.length === 0) {
            return ctx.editMessageText(
                '📰 لا توجد أخبار متاحة حالياً\nجاري تحديث المحتوى...',
                { reply_markup: Keyboards.backButton().reply_markup, parse_mode: 'Markdown' }
            );
        }

        let text = '📰 **آخر الأخبار**\n▬▬▬▬▬▬▬▬▬▬▬▬\n\n';
        
        const buttons = [];
        newsList.forEach((news, index) => {
            const title = (news.title || 'خبر').substring(0, 60);
            text += `${index + 1}. **${title}**\n`;
            text += `   📂 ${NEWS_CATEGORIES[news.category_id]?.name || 'عام'} | 👁 ${news.views || 0}\n\n`;
            
            buttons.push([Markup.button.callback(
                `${index + 1}. ${title.substring(0, 40)}...`,
                `view_news_${news.id}`
            )]);
        });

        buttons.push([
            Markup.button.callback('🔍 بحث', 'admin_search'),
            Markup.button.callback('🔙 رجوع', 'back_main')
        ]);

        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    }

    async showCategories(ctx) {
        let text = '📂 **فئات الأخبار**\n▬▬▬▬▬▬▬▬▬▬▬▬\n\n';
        
        for (const [id, cat] of Object.entries(NEWS_CATEGORIES)) {
            text += `• ${cat.icon} **${cat.name}**\n`;
        }

        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            ...Keyboards.categoriesMenu()
        });
    }

    async showCategoryNews(ctx, categoryId) {
        const newsList = await Database.getNewsList({
            category: categoryId,
            limit: CONFIG.MAX_NEWS_PER_PAGE
        });

        const catName = NEWS_CATEGORIES[categoryId]?.name || categoryId;

        if (newsList.length === 0) {
            return ctx.editMessageText(
                `📂 لا توجد أخبار في فئة ${catName}\nجاري تحديث المحتوى...`,
                { reply_markup: Keyboards.backButton('categories').reply_markup, parse_mode: 'Markdown' }
            );
        }

        let text = `📂 **${catName}**\n▬▬▬▬▬▬▬▬▬▬▬▬\n\n`;
        
        const buttons = [];
        newsList.forEach((news, index) => {
            const title = (news.title || 'خبر').substring(0, 50);
            text += `${index + 1}. **${title}**\n`;
            text += `   👁 ${news.views || 0} | 📅 ${this.formatDate(news.createdAt)}\n\n`;
            
            buttons.push([Markup.button.callback(
                `${index + 1}. ${title.substring(0, 35)}...`,
                `view_news_${news.id}`
            )]);
        });

        buttons.push([Markup.button.callback('🔙 رجوع للفئات', 'categories')]);

        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    }

    async viewNewsDetails(ctx, newsId) {
        const news = await Database.getNewsById(newsId);
        if (!news) {
            return ctx.answerCbQuery('الخبر غير متوفر');
        }

        await Database.incrementViews(newsId);

        const text = `
📰 **${news.title || 'خبر بدون عنوان'}**

▬▬▬▬▬▬▬▬▬▬▬▬
${news.content || 'لا يوجد محتوى'}
▬▬▬▬▬▬▬▬▬▬▬▬

📂 **الفئة:** ${NEWS_CATEGORIES[news.category_id]?.name || 'عام'}
📅 **التاريخ:** ${this.formatDate(news.createdAt)}
👁 **المشاهدات:** ${(news.views || 0) + 1}
🔄 **المشاركات:** ${news.shares || 0}
`;

        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('🔄 مشاركة', `share_${newsId}`),
                Markup.button.url('🌐 عرض على الويب', `${CONFIG.WEB_URL}/news.html?id=${newsId}`)
            ],
            [Markup.button.callback('🔙 رجوع', 'latest_news')]
        ]);

        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            ...keyboard
        });
    }

    // ==================== Admin Functions ====================
    async showPendingNews(ctx) {
        const pending = await Database.getPendingNews();
        
        if (pending.length === 0) {
            return ctx.editMessageText(
                '✅ لا توجد أخبار قيد المراجعة',
                { reply_markup: Keyboards.backButton('back_admin').reply_markup, parse_mode: 'Markdown' }
            );
        }

        this.pendingNewsCache.set(ctx.from.id, {
            news: pending,
            currentIndex: 0
        });

        await this.showSingleNewsReview(ctx);
    }

    async showSingleNewsReview(ctx) {
        const cache = this.pendingNewsCache.get(ctx.from.id);
        if (!cache || cache.news.length === 0) {
            return ctx.editMessageText(
                '✅ تمت مراجعة جميع الأخبار',
                { reply_markup: Keyboards.backButton('back_admin').reply_markup, parse_mode: 'Markdown' }
            );
        }

        const { news, currentIndex } = cache;
        const currentNews = news[currentIndex];
        
        if (!currentNews) {
            this.pendingNewsCache.delete(ctx.from.id);
            return ctx.editMessageText(
                '✅ تمت مراجعة جميع الأخبار',
                { reply_markup: Keyboards.backButton('back_admin').reply_markup, parse_mode: 'Markdown' }
            );
        }

        const text = `
📋 **مراجعة خبر ${currentIndex + 1}/${news.length}**

▬▬▬▬▬▬▬▬▬▬▬▬
**العنوان:** ${currentNews.title || 'بدون عنوان'}

**المحتوى:**
${(currentNews.content || '').substring(0, 500)}${(currentNews.content || '').length > 500 ? '...' : ''}

▬▬▬▬▬▬▬▬▬▬▬▬
**المصدر:** ${currentNews.source_chat_name || 'غير معروف'}
**الفئة:** ${NEWS_CATEGORIES[currentNews.category_id]?.name || 'عام'}
**التاريخ:** ${this.formatDate(currentNews.createdAt)}
**الحالة:** ⏳ قيد المراجعة
`;

        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            ...Keyboards.newsReviewKeyboard(currentNews.id, currentIndex, news.length)
        });
    }

    async navigateNews(ctx, direction) {
        const cache = this.pendingNewsCache.get(ctx.from.id);
        if (!cache) return;

        if (direction === 'nav_right' && cache.currentIndex < cache.news.length - 1) {
            cache.currentIndex++;
        } else if (direction === 'nav_left' && cache.currentIndex > 0) {
            cache.currentIndex--;
        }

        this.pendingNewsCache.set(ctx.from.id, cache);
        await this.showSingleNewsReview(ctx);
    }

    async approveNews(ctx, newsId) {
        if (!CONFIG.ADMIN_IDS.includes(ctx.from.id)) {
            return ctx.answerCbQuery('❌ غير مصرح');
        }

        await Database.approveNews(newsId, ctx.from.id);
        
        // Remove from cache
        const cache = this.pendingNewsCache.get(ctx.from.id);
        if (cache) {
            cache.news = cache.news.filter(n => n.id !== newsId);
            if (cache.currentIndex >= cache.news.length) {
                cache.currentIndex = Math.max(0, cache.news.length - 1);
            }
            this.pendingNewsCache.set(ctx.from.id, cache);
        }

        // Broadcast to subscribers
        await this.broadcastNews(ctx, newsId);

        ctx.answerCbQuery('✅ تمت الموافقة والنشر');
        await this.showSingleNewsReview(ctx);
    }

    async rejectNews(ctx, newsId) {
        if (!CONFIG.ADMIN_IDS.includes(ctx.from.id)) {
            return ctx.answerCbQuery('❌ غير مصرح');
        }

        await Database.rejectNews(newsId, ctx.from.id, 'مرفوض من المشرف');
        
        const cache = this.pendingNewsCache.get(ctx.from.id);
        if (cache) {
            cache.news = cache.news.filter(n => n.id !== newsId);
            if (cache.currentIndex >= cache.news.length) {
                cache.currentIndex = Math.max(0, cache.news.length - 1);
            }
            this.pendingNewsCache.set(ctx.from.id, cache);
        }

        ctx.answerCbQuery('❌ تم رفض الخبر');
        await this.showSingleNewsReview(ctx);
    }

    async startEditNews(ctx, newsId) {
        if (!CONFIG.ADMIN_IDS.includes(ctx.from.id)) {
            return ctx.answerCbQuery('❌ غير مصرح');
        }

        this.userStates.set(ctx.from.id, {
            action: 'editing_news',
            newsId: newsId
        });

        await ctx.reply(
            '✏️ **تعديل الخبر**\n\n' +
            'أرسل التعديلات بالتنسيق التالي:\n\n' +
            '`title: العنوان الجديد`\n' +
            '`category: معرف_الفئة`\n' +
            '`content: المحتوى الجديد`\n\n' +
            'الفئات المتاحة:\n' +
            Object.entries(NEWS_CATEGORIES).map(([id, cat]) => `• \`${id}\` - ${cat.name}`).join('\n') +
            '\n\nأو أرسل /cancel للإلغاء',
            { parse_mode: 'Markdown', ...Keyboards.cancelButton() }
        );
    }

    async deleteNews(ctx, newsId) {
        if (!CONFIG.ADMIN_IDS.includes(ctx.from.id)) {
            return ctx.answerCbQuery('❌ غير مصرح');
        }

        await Database.deleteNews(newsId);
        
        const cache = this.pendingNewsCache.get(ctx.from.id);
        if (cache) {
            cache.news = cache.news.filter(n => n.id !== newsId);
            if (cache.currentIndex >= cache.news.length) {
                cache.currentIndex = Math.max(0, cache.news.length - 1);
            }
            this.pendingNewsCache.set(ctx.from.id, cache);
        }

        ctx.answerCbQuery('🗑️ تم حذف الخبر');
        await this.showSingleNewsReview(ctx);
    }

    async shareNews(ctx, newsId) {
        const news = await Database.getNewsById(newsId);
        if (!news) {
            return ctx.answerCbQuery('الخبر غير متوفر');
        }

        await Database.incrementShares(newsId);

        const shareText = `
📰 *${news.title}*

${(news.content || '').substring(0, 200)}...

🔗 للمزيد: ${CONFIG.WEB_URL}/news.html?id=${newsId}
🤖 تابعنا: ${CONFIG.BOT_USERNAME}
`;

        const shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.url('📤 مشاركة واتساب', shareUrl)],
            [Markup.button.callback('🔙 رجوع', `view_news_${newsId}`)]
        ]);

        await ctx.editMessageReplyMarkup(keyboard.reply_markup);
        ctx.answerCbQuery('تم نسخ رابط المشاركة');
    }

    async broadcastNews(ctx, newsId) {
        const news = await Database.getNewsById(newsId);
        if (!news) return;

        const subscribers = await Database.getActiveSubscribers();
        
        const broadcastText = `
📰 **${news.title || 'خبر جديد'}**

▬▬▬▬▬▬▬▬▬▬▬▬
${(news.content || '').substring(0, 1000)}${(news.content || '').length > 1000 ? '...' : ''}
▬▬▬▬▬▬▬▬▬▬▬▬

📂 **الفئة:** ${NEWS_CATEGORIES[news.category_id]?.name || 'عام'}
🔗 **للمزيد:** ${CONFIG.WEB_URL}/news.html?id=${newsId}
🤖 **تابعنا:** ${CONFIG.BOT_USERNAME}
`;

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.url('📖 اقرأ المزيد', `${CONFIG.WEB_URL}/news.html?id=${newsId}`)]
        ]);

        let successCount = 0;
        for (const sub of subscribers) {
            try {
                await this.bot.telegram.sendMessage(sub.entity_id, broadcastText, {
                    parse_mode: 'Markdown',
                    ...keyboard
                });
                successCount++;
                await new Promise(resolve => setTimeout(resolve, 500)); // Avoid flood
            } catch (error) {
                if (error.code === 403) {
                    // Bot was removed, deactivate subscription
                    await Database.removeSubscriber(sub.entity_id);
                }
                console.error(`Broadcast error to ${sub.entity_id}:`, error.message);
            }
        }

        console.log(`Broadcast completed: ${successCount}/${subscribers.length} successful`);
    }

    // ==================== Entity Management ====================
    async handleEntitySubmission(ctx, text) {
        const userId = ctx.from.id;
        
        let entityType = null;
        let entityId = null;
        let entityName = text;

        if (text.startsWith('@')) {
            entityType = 'group';
            entityId = text;
        } else if (text.startsWith('https://t.me/')) {
            entityType = 'group';
            const parts = text.split('/');
            entityId = '@' + parts[parts.length - 1];
        }

        if (entityType && entityId) {
            try {
                const chat = await this.bot.telegram.getChat(entityId);
                
                await Database.addSubscriber({
                    user_id: String(userId),
                    entity_type: entityType,
                    entity_id: String(chat.id),
                    entity_name: chat.title || entityName,
                    entity_username: chat.username || ''
                });

                await Database.addUserPoints(userId, CONFIG.POINTS_PER_SUBSCRIBE);
                this.userStates.delete(userId);

                const successText = `
✅ **تم تفعيل الأخبار بنجاح!**

▬▬▬▬▬▬▬▬▬▬▬▬
📋 **الكيان:** ${chat.title || entityName}
🆔 **المعرف:** ${chat.id}
📅 **النوع:** ${entityType === 'channel' ? 'قناة' : 'مجموعة'}
▬▬▬▬▬▬▬▬▬▬▬▬

🔔 سيتم إرسال الأخبار تلقائياً
💎 **+${CONFIG.POINTS_PER_SUBSCRIBE} نقطة** تمت إضافتها لحسابك!

**ملاحظة:** تأكد من أن البوت مشرف في الكيان
`;

                await ctx.reply(successText, {
                    parse_mode: 'Markdown',
                    ...Keyboards.mainMenu()
                });
            } catch (error) {
                await ctx.reply(
                    '❌ لا يمكن الوصول إلى الكيان. تأكد من:\n' +
                    '• إضافة البوت كمشرف\n' +
                    '• صحة الرابط أو المعرف\n\n' +
                    `خطأ: ${error.message?.substring(0, 100)}`
                );
            }
        }
    }

    async handleForwardedMessage(ctx) {
        const forwardChat = ctx.message.forward_from_chat;
        const userId = ctx.from.id;

        try {
            await Database.addSubscriber({
                user_id: String(userId),
                entity_type: 'channel',
                entity_id: String(forwardChat.id),
                entity_name: forwardChat.title || 'قناة',
                entity_username: forwardChat.username || ''
            });

            await Database.addUserPoints(userId, CONFIG.POINTS_PER_SUBSCRIBE);
            this.userStates.delete(userId);

            await ctx.reply(
                `✅ **تم تفعيل الأخبار للقناة!**\n\n` +
                `📋 **القناة:** ${forwardChat.title}\n` +
                `🆔 **المعرف:** ${forwardChat.id}\n` +
                `💎 **+${CONFIG.POINTS_PER_SUBSCRIBE} نقطة**\n\n` +
                `🔔 سيتم استقبال الأخبار تلقائياً`,
                { parse_mode: 'Markdown', ...Keyboards.mainMenu() }
            );
        } catch (error) {
            console.error('Forward handler error:', error);
            ctx.reply('❌ فشل التفعيل، حاول مرة أخرى');
        }
    }

    async handleChannelPost(ctx) {
        const chatId = String(ctx.chat.id);
        
        // Check if this channel is subscribed
        const subscribers = await Database.getActiveSubscribers();
        const isSubscribed = subscribers.some(s => s.entity_id === chatId);
        
        if (!isSubscribed) return;

        const text = ctx.channelPost.text || ctx.channelPost.caption;
        if (!text || text.length < 50) return;

        // Create news entry
        const newsData = {
            title: TextCleaner.extractTitle(text),
            content: TextCleaner.clean(text),
            source_chat_id: chatId,
            source_chat_name: ctx.chat.title || 'قناة',
            source_message_id: ctx.channelPost.message_id,
            category_id: 'general',
            status: 'pending'
        };

        const result = await Database.addNews(newsData);

        // Notify admin
        await this.notifyAdminNewNews(result);
    }

    async notifyAdminNewNews(news) {
        const adminText = `
📋 **خبر جديد للمراجعة**

▬▬▬▬▬▬▬▬▬▬▬▬
**المصدر:** ${news.source_chat_name}
**العنوان:** ${news.title}

**المحتوى:**
${(news.content || '').substring(0, 300)}...

▬▬▬▬▬▬▬▬▬▬▬▬
`;

        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('✅ موافقة', `approve_${news.id}`),
                Markup.button.callback('❌ رفض', `reject_${news.id}`)
            ],
            [Markup.button.callback('🔍 عرض كامل', `view_news_${news.id}`)]
        ]);

        for (const adminId of CONFIG.ADMIN_IDS) {
            try {
                await this.bot.telegram.sendMessage(adminId, adminText, {
                    parse_mode: 'Markdown',
                    ...keyboard
                });
            } catch (error) {
                console.error(`Notify admin ${adminId} error:`, error);
            }
        }
    }

    // ==================== State Handler ====================
    async handleStateMessage(ctx, state, text) {
        const userId = ctx.from.id;

        if (text === '/cancel') {
            this.userStates.delete(userId);
            return ctx.reply('❌ تم الإلغاء', Keyboards.mainMenu());
        }

        if (state.action === 'editing_news') {
            await this.processNewsEdit(ctx, state, text);
        } else if (state === 'waiting_for_entity') {
            await this.handleEntitySubmission(ctx, text);
        } else if (state.action === 'admin_search') {
            await this.handleSearch(ctx, text);
            this.userStates.delete(userId);
        } else if (state.action === 'broadcast') {
            await this.processBroadcast(ctx, text);
            this.userStates.delete(userId);
        }
    }

    async processNewsEdit(ctx, state, text) {
        const newsId = state.newsId;
        const updates = {};
        
        const lines = text.split('\n');
        for (const line of lines) {
            const [key, ...valueParts] = line.split(':');
            const value = valueParts.join(':').trim();
            
            if (key.trim() === 'title') updates.title = value;
            else if (key.trim() === 'category') updates.category_id = value;
            else if (key.trim() === 'content') updates.content = value;
        }

        if (Object.keys(updates).length === 0) {
            return ctx.reply('⚠️ لم يتم التعرف على أي تحديثات. حاول مرة أخرى.');
        }

        await Database.updateNews(newsId, updates);
        this.userStates.delete(ctx.from.id);

        await ctx.reply('✅ **تم تحديث الخبر بنجاح**', {
            parse_mode: 'Markdown',
            ...Keyboards.adminMenu()
        });
    }

    async processBroadcast(ctx, text) {
        const subscribers = await Database.getActiveSubscribers();
        
        let successCount = 0;
        for (const sub of subscribers) {
            try {
                await this.bot.telegram.sendMessage(sub.entity_id, text);
                successCount++;
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Broadcast error to ${sub.entity_id}:`, error.message);
            }
        }

        await ctx.reply(
            `✅ **تم الإرسال الجماعي**\n\n` +
            `📊 تم الإرسال إلى ${successCount}/${subscribers.length} مشترك`,
            { parse_mode: 'Markdown', ...Keyboards.adminMenu() }
        );
    }

    // ==================== Utility Functions ====================
    async showMainMenu(ctx) {
        const user = ctx.user;
        const welcomeText = `
📰 **القائمة الرئيسية**

▬▬▬▬▬▬▬▬▬▬▬▬
👤 **المستخدم:** ${ctx.from.first_name}
💎 **النقاط:** ${user.points || 0}
📡 **المشتركين:** ${user.total_subscribes || 0}
▬▬▬▬▬▬▬▬▬▬▬▬
`;

        await ctx.editMessageText(welcomeText, {
            parse_mode: 'Markdown',
            ...Keyboards.mainMenu()
        });
    }

    async showAdminStats(ctx) {
        const stats = await Database.getStats();
        
        const statsText = `
📊 **إحصائيات المنظومة**

▬▬▬▬▬▬▬▬▬▬▬▬
📰 **إجمالي الأخبار:** ${stats.totalNews}
✅ **المنشورة:** ${stats.approvedNews}
⏳ **قيد المراجعة:** ${stats.pendingNews}
👥 **المشتركين النشطين:** ${stats.subscribers}
👤 **المستخدمين:** ${stats.users}
▬▬▬▬▬▬▬▬▬▬▬▬
`;

        await ctx.editMessageText(statsText, {
            parse_mode: 'Markdown',
            ...Keyboards.backButton('back_admin')
        });
    }

    async showCategoryManagement(ctx) {
        let text = '📂 **إدارة فئات الأخبار**\n▬▬▬▬▬▬▬▬▬▬▬▬\n\n';
        
        for (const [id, cat] of Object.entries(NEWS_CATEGORIES)) {
            const count = (await Database.getNewsList({ category: id, limit: 1000 })).length;
            text += `• ${cat.icon} **${cat.name}** (${count} خبر)\n`;
        }

        text += '\n▬▬▬▬▬▬▬▬▬▬▬▬\n';
        text += '**الفئات المتاحة للإضافة:**\n';

        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('➕ إضافة فئة جديدة', 'add_new_category'),
                Markup.button.callback('🗑️ حذف فئة', 'delete_category')
            ],
            [Markup.button.callback('🔙 رجوع', 'back_admin')]
        ]);

        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            ...keyboard
        });
    }

    async showSubscribersList(ctx) {
        const subscribers = await Database.getActiveSubscribers();
        
        if (subscribers.length === 0) {
            return ctx.editMessageText(
                '👥 لا يوجد مشتركين حالياً',
                { reply_markup: Keyboards.backButton('back_admin').reply_markup, parse_mode: 'Markdown' }
            );
        }

        let text = `👥 **المشتركين النشطين (${subscribers.length})**\n▬▬▬▬▬▬▬▬▬▬▬▬\n\n`;
        
        subscribers.slice(0, 20).forEach((sub, index) => {
            text += `${index + 1}. **${sub.entity_name}**\n`;
            text += `   📅 النوع: ${sub.entity_type === 'channel' ? 'قناة' : 'مجموعة'}\n`;
            text += `   🆔: \`${sub.entity_id}\`\n\n`;
        });

        if (subscribers.length > 20) {
            text += `... و ${subscribers.length - 20} مشترك آخر\n`;
        }

        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            ...Keyboards.backButton('back_admin')
        });
    }

    async startAdminSearch(ctx) {
        this.userStates.set(ctx.from.id, { action: 'admin_search' });
        await ctx.reply(
            '🔍 **أدخل نص البحث:**',
            { parse_mode: 'Markdown', ...Keyboards.cancelButton() }
        );
    }

    async startBroadcast(ctx) {
        this.userStates.set(ctx.from.id, { action: 'broadcast' });
        await ctx.reply(
            '📤 **أدخل نص الرسالة للإرسال الجماعي:**',
            { parse_mode: 'Markdown', ...Keyboards.cancelButton() }
        );
    }

    async cancelAction(ctx) {
        this.userStates.delete(ctx.from.id);
        this.pendingNewsCache.delete(ctx.from.id);
        
        await ctx.editMessageText('❌ تم الإلغاء', {
            reply_markup: Keyboards.mainMenu().reply_markup
        });
    }

    formatDate(timestamp) {
        if (!timestamp) return 'غير معروف';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp._seconds * 1000);
            const now = new Date();
            const diff = now - date;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);

            if (minutes < 1) return 'الآن';
            if (minutes < 60) return `منذ ${minutes} دقيقة`;
            if (hours < 24) return `منذ ${hours} ساعة`;
            if (days < 7) return `منذ ${days} يوم`;
            return date.toLocaleDateString('ar-EG');
        } catch {
            return 'غير معروف';
        }
    }

    async start() {
        try {
            await this.bot.launch();
            console.log('✅ News Bot started successfully!');
            
            // Notify admins
            for (const adminId of CONFIG.ADMIN_IDS) {
                try {
                    await this.bot.telegram.sendMessage(
                        adminId,
                        '🤖 **بوت الأخبار يعمل الآن!**\n\nاستخدم /admin للوصول إلى لوحة التحكم',
                        { parse_mode: 'Markdown' }
                    );
                } catch {}
            }
        } catch (error) {
            console.error('Bot start error:', error);
            process.exit(1);
        }
    }

    async stop() {
        await this.bot.stop();
        console.log('Bot stopped');
    }
}

// ==================== Server Integration ====================
const express = require('express');
const newsApp = express();

newsApp.use(express.json());

// API Routes
newsApp.get('/api/news', async (req, res) => {
    try {
        const { category, limit = 20, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        const news = await Database.getNewsList({
            category: category !== 'all' ? category : null,
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            news: news.slice(offset, offset + parseInt(limit)),
            total: news.length,
            page: parseInt(page),
            totalPages: Math.ceil(news.length / parseInt(limit))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

newsApp.get('/api/news/:newsId', async (req, res) => {
    try {
        const news = await Database.getNewsById(req.params.newsId);
        if (!news) return res.status(404).json({ error: 'News not found' });
        
        await Database.incrementViews(req.params.newsId);
        
        res.json({ success: true, news });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

newsApp.get('/api/news-categories', async (req, res) => {
    try {
        const categories = await Database.getCategories();
        res.json({ success: true, categories });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

newsApp.get('/api/news-search', async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        if (!q) return res.status(400).json({ error: 'Query required' });
        
        const results = await Database.searchNews(q, parseInt(limit));
        res.json({ success: true, news: results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

newsApp.get('/api/news-stats', async (req, res) => {
    try {
        const stats = await Database.getStats();
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start both bot and API server
const PORT = process.env.NEWS_API_PORT || 3001;

async function main() {
    const bot = new NewsBot();
    await bot.start();

    newsApp.listen(PORT, () => {
        console.log(`📡 News API running on port ${PORT}`);
    });

    // Graceful shutdown
    process.once('SIGINT', async () => {
        await bot.stop();
        process.exit(0);
    });
    process.once('SIGTERM', async () => {
        await bot.stop();
        process.exit(0);
    });
}

main().catch(console.error);

module.exports = { Database, TextCleaner, Keyboards, NewsBot };