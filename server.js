const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const app = express();

// ========== Middleware ==========
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use(express.static('.'));

// ========== Firebase Admin SDK Configuration ==========
const serviceAccount = {
    "type": "service_account",
    "project_id": "all-arab-services-750ad",
    "private_key_id": "a954de36507cacf294622b079a1d306b62d586f2",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDbjr/Mydykr2jl\nnyW4nO/30CdQm3TagNRbJmfrsrNm0n6cP55XBTpmFa2Et3GS7qXWTHN70Zm3tp3P\nLDZLiCnxND8M3X0+sP05Xf/wNpoK8MG2QW+CSnyYJwTg5QEBd4i5ohjbVBrTt9fC\nOfazQ9vvLmqyJ3sDzrDgrQ3pza2K+3xAAuRYNiprnCPzqgSKzu9gRvW8vh1Rteu5\nzKTEm97lBo9G7dqmq/GHjO57jp16aTFQ4O1iAOvk6SO2AeHKVk+IECEFcNsk+OSE\n/w58afBJKIPWjxHdNxWTZUJzCXdMiMmMh8c4Lzr7QviBCK3RQGFraMEO0uHHqFx5\nR0zm+67vAgMBAAECggEADugKspsz7URxgUGEXJvfGPqbaLgdP2aGxGd/n7uCvaTl\n7rLNC8hxlhO7s6qGvfyQ6tNG9e2dm6D85t9wEkG840DyVOvGwJZgot/0a/kxDTQa\nWsbnjLeE7QmdJa22m0Rj1oKgYGe96IjvT6MC0ln1mTAUE2Nl0TTbwm1NaAXMVgar\nzd4Y3r3DvnJf17BFlwIY0i0u9uQRae3NlhZ2OexhFmg2w0nJbRCQ6uftRSyMQNcc\nf8TViRafcMTmEr9tbkr4Kma9DO3nPWB3HFlCEy5KAV6sbgkkUJ9NQYQukHK2Yrh8\nqYcaLia5+xLdeeTUThFGGX0vMVY0nCsVDUGeuje2/QKBgQDyq5QHX2+ftXoe8yyx\nbzMBO9mm2YKxRklEejRCfdEsHF1FylwR1ze/uF3esB7TK3y9GTY4Ousks+pw73G/\n5E+m1+3smkKQ9QPFINBrRwhd2NJx2Pcca8bHBeq7+2sKUtoaUDheO7h47yVKWVV0\nFLWo6/Zeu5zShiC7Uej5wtlnkwKBgQDnnil92QI8G2po/kvxqC8dC8XumWnVvFwG\nY1mnNaPyvuusEmpVB9aUZXkZOXtjPdf7HTXlHLhBBurqX9XEiTp//WEXwb6E6fvT\nfDXczdsESmHC5bZukSIukutRLsr+6mKwJ8FRCYeUSkMaiQfvCKfS1WMZI879T/0a\nNzz0pmU8tQKBgBbLXyBCKq4J0erOVMhl9ZiMEqnFjK0yOPehsv776oYGNAy2MWfL\nm4T6wHaGfJ7BWvo4QAuQHT5ZWBA7raekvoahicvLwaz0FuKRboJlLbgDAeGHy85z\noTxYpe/6cdeKaMpH9sODQJS7gfk14v0AZP/1CjNj1BtCVhjCXOv5DYrZAoGBANjs\nPUnbK4el2ZQ5zmCmtnFKrHbZgdCm17034SiESWc4vjprCOFYNPTI0JD6UABTVGug\nIPDSZBKq6urVFL08FOj4Iq4AS3HqPmsEouGIfr5W95Z0U9bb4JqkCPYAkCgM1p7K\nrPg7p5oPrycz/ZU2kw8XwPcznVGLT6303Ab5rEkdAoGAeMTzYsM4JVVQZtRB4Uzm\nUjRTRHnc56pzVIeWwTaF8kxDfn4bUNUWNW7QzEKEQv/KopW6Cp7kaytux42scVhD\nsA+FBNK/M/ZBejSQB9vOuYdnZVDEEgSbYqejC2biLRRjeQeG86G2fdH15+uU6b3O\nHFKn9hz5tlSUFu5272lFKQM=\n-----END PRIVATE KEY-----\n",
    "client_email": "firebase-adminsdk-fbsvc@all-arab-services-750ad.iam.gserviceaccount.com",
    "client_id": "108825971665460266722",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40all-arab-services-750ad.iam.gserviceaccount.com"
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "all-arab-services-750ad.firebasestorage.app"
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// تخزين المتغيرات العامة للاستخدام في الـ APIs
app.locals.db = db;
app.locals.FieldValue = FieldValue;

// ========== نظام تحميل الـ APIs الديناميكية ==========
const APIS_DIR = path.join(__dirname, 'apis');

// إنشاء المجلد إذا لم يكن موجوداً
if (!fs.existsSync(APIS_DIR)) {
    fs.mkdirSync(APIS_DIR, { recursive: true });
}

// تحميل جميع ملفات API من مجلد apis
function loadAllAPIs() {
    const files = fs.readdirSync(APIS_DIR);
    for (const file of files) {
        if (file.endsWith('.js') && file !== '.gitkeep') {
            try {
                const apiModule = require(path.join(APIS_DIR, file));
                if (apiModule.method && apiModule.path && apiModule.handler) {
                    const method = apiModule.method.toLowerCase();
                    app[method](apiModule.path, apiModule.handler);
                    console.log(`✅ API Loaded: ${apiModule.method} ${apiModule.path}`);
                }
            } catch (error) {
                console.error(`❌ Error loading API ${file}:`, error.message);
            }
        }
    }
}

// مراقبة التغييرات في مجلد apis (للتطوير)
if (process.env.NODE_ENV !== 'production') {
    fs.watch(APIS_DIR, (eventType, filename) => {
        if (filename && filename.endsWith('.js')) {
            console.log(`📁 API file changed: ${filename}, reloading...`);
            // حذف الكاش وإعادة التحميل
            delete require.cache[require.resolve(path.join(APIS_DIR, filename))];
            loadAllAPIs();
        }
    });
}

// ========== APIs الأساسية (المدمجة) ==========

// API: جلب جميع الخدمات
app.get('/api/services', async (req, res) => {
    try {
        const snapshot = await db.collection('services')
            .where('status', '==', 'approved')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
        const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: جلب خدمة محددة
app.get('/api/services/:id', async (req, res) => {
    try {
        const doc = await db.collection('services').doc(req.params.id).get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Service not found' });
        }
        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: إنشاء خدمة جديدة
app.post('/api/services/create', async (req, res) => {
    try {
        const { userId, serviceData } = req.body;
        
        const serviceRef = db.collection('services').doc();
        const newService = {
            id: serviceRef.id,
            ...serviceData,
            userId: userId,
            status: 'pending',
            views: 0,
            avgRating: 0,
            reviewCount: 0,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        };
        
        await serviceRef.set(newService);
        res.json({ success: true, serviceId: serviceRef.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: تحديث خدمة
app.put('/api/services/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        updates.updatedAt = FieldValue.serverTimestamp();
        await db.collection('services').doc(id).update(updates);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: حذف خدمة
app.delete('/api/services/:id', async (req, res) => {
    try {
        await db.collection('services').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== APIs المستخدمين ==========

// API: جلب المستخدم الحالي
app.get('/api/current-user', async (req, res) => {
    try {
        const userId = req.query.userId || 'admin';
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            // إنشاء مستخدم جديد إذا لم يكن موجوداً
            const newUser = {
                userId: userId,
                name: 'زائر جديد',
                points: 100,
                role: 'user',
                createdAt: FieldValue.serverTimestamp(),
                lastActive: FieldValue.serverTimestamp()
            };
            await db.collection('users').doc(userId).set(newUser);
            return res.json({ success: true, points: 100, userId: userId, name: 'زائر جديد' });
        }
        
        res.json({ 
            success: true, 
            points: userDoc.data().points || 0,
            userId: userId,
            name: userDoc.data().name || 'زائر'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: جلب مستخدم محدد
app.get('/api/users/:userId', async (req, res) => {
    try {
        const userDoc = await db.collection('users').doc(req.params.userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(userDoc.data());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: تحديث بيانات المستخدم
app.put('/api/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;
        updates.lastActive = FieldValue.serverTimestamp();
        await db.collection('users').doc(userId).update(updates);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: إنشاء مستخدم جديد
app.post('/api/users/create', async (req, res) => {
    try {
        const { userId, name, phone } = req.body;
        
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        const newUser = {
            userId: userId,
            name: name || 'مستخدم جديد',
            phone: phone || '',
            points: 100,
            role: 'user',
            createdAt: FieldValue.serverTimestamp(),
            lastActive: FieldValue.serverTimestamp()
        };
        
        await userRef.set(newUser);
        res.json({ success: true, user: newUser });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== APIs النقاط والتحويلات ==========

// API: إضافة نقاط للمستخدم
app.post('/api/add-points', async (req, res) => {
    try {
        const { userId, points, reason } = req.body;
        
        if (!userId || !points || points <= 0) {
            return res.status(400).json({ error: 'بيانات غير صالحة' });
        }
        
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const currentPoints = userDoc.data().points || 0;
        const newPoints = currentPoints + points;
        
        await userRef.update({ points: newPoints });
        
        // تسجيل المعاملة
        await db.collection('transactions').add({
            userId: userId,
            type: 'earn',
            amount: points,
            newBalance: newPoints,
            reason: reason || 'إضافة نقاط',
            createdAt: FieldValue.serverTimestamp()
        });
        
        res.json({ success: true, newBalance: newPoints });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: خصم نقاط من المستخدم
app.post('/api/remove-points', async (req, res) => {
    try {
        const { userId, points, reason } = req.body;
        
        if (!userId || !points || points <= 0) {
            return res.status(400).json({ error: 'بيانات غير صالحة' });
        }
        
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const currentPoints = userDoc.data().points || 0;
        
        if (currentPoints < points) {
            return res.status(400).json({ error: 'رصيد غير كافٍ' });
        }
        
        const newPoints = currentPoints - points;
        await userRef.update({ points: newPoints });
        
        // تسجيل المعاملة
        await db.collection('transactions').add({
            userId: userId,
            type: 'spend',
            amount: -points,
            newBalance: newPoints,
            reason: reason || 'خصم نقاط',
            createdAt: FieldValue.serverTimestamp()
        });
        
        res.json({ success: true, newBalance: newPoints });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: تحويل النقاط بين المستخدمين
app.post('/api/transfer-points', async (req, res) => {
    try {
        const { fromUserId, toUserId, amount, reason } = req.body;
        
        if (!fromUserId || !toUserId || !amount || amount <= 0) {
            return res.status(400).json({ error: 'بيانات غير صالحة' });
        }
        
        if (fromUserId === toUserId) {
            return res.status(400).json({ error: 'لا يمكنك التحويل لنفسك' });
        }
        
        const fromRef = db.collection('users').doc(fromUserId);
        const toRef = db.collection('users').doc(toUserId);
        
        const fromDoc = await fromRef.get();
        const toDoc = await toRef.get();
        
        if (!fromDoc.exists) {
            return res.status(404).json({ error: 'المرسل غير موجود' });
        }
        if (!toDoc.exists) {
            return res.status(404).json({ error: 'المستلم غير موجود' });
        }
        
        const fromBalance = fromDoc.data().points || 0;
        
        if (fromBalance < amount) {
            return res.status(400).json({ error: `رصيد غير كافٍ. رصيدك: ${fromBalance} نقطة` });
        }
        
        // تنفيذ التحويل باستخدام المعاملة
        await db.runTransaction(async (t) => {
            const fromFresh = await t.get(fromRef);
            const toFresh = await t.get(toRef);
            
            const newFromBalance = (fromFresh.data().points || 0) - amount;
            const newToBalance = (toFresh.data().points || 0) + amount;
            
            t.update(fromRef, { points: newFromBalance });
            t.update(toRef, { points: newToBalance });
            
            // تسجيل معاملة التحويل
            const transferRef = db.collection('transfers').doc();
            t.set(transferRef, {
                fromUserId: fromUserId,
                toUserId: toUserId,
                amount: amount,
                reason: reason || 'تحويل نقاط',
                fromBalanceBefore: fromFresh.data().points || 0,
                fromBalanceAfter: newFromBalance,
                toBalanceBefore: toFresh.data().points || 0,
                toBalanceAfter: newToBalance,
                status: 'completed',
                createdAt: FieldValue.serverTimestamp()
            });
        });
        
        const finalFromBalance = (await fromRef.get()).data().points;
        
        res.json({ 
            success: true, 
            message: `✅ تم تحويل ${amount} نقطة بنجاح`,
            newBalance: finalFromBalance
        });
        
    } catch (error) {
        console.error('Transfer error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: جلب سجل معاملات المستخدم
app.get('/api/transactions/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const snapshot = await db.collection('transactions')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: جلب سجل تحويلات المستخدم
app.get('/api/transfers/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const snapshot = await db.collection('transfers')
            .where('fromUserId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        const transfers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(transfers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== APIs الكوبونات ==========

// API: جلب جميع الكوبونات
app.get('/api/coupons', async (req, res) => {
    try {
        const snapshot = await db.collection('coupons').get();
        const coupons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: التحقق من كوبون
app.post('/api/validate-coupon', async (req, res) => {
    try {
        const { couponCode, userId } = req.body;
        
        const snapshot = await db.collection('coupons')
            .where('code', '==', couponCode.toUpperCase())
            .where('isActive', '==', true)
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            return res.status(404).json({ error: 'كوبون غير صالح' });
        }
        
        const coupon = snapshot.docs[0].data();
        const now = new Date();
        
        if (coupon.expiryDate && coupon.expiryDate.toDate() < now) {
            return res.status(400).json({ error: 'انتهت صلاحية الكوبون' });
        }
        
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
            return res.status(400).json({ error: 'تم استخدام هذا الكوبون أقصى عدد مرات' });
        }
        
        if (coupon.usedBy && coupon.usedBy.includes(userId)) {
            return res.status(400).json({ error: 'لقد استخدمت هذا الكوبون مسبقاً' });
        }
        
        res.json({ 
            success: true, 
            coupon: { id: snapshot.docs[0].id, ...coupon }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: استخدام كوبون
app.post('/api/use-coupon', async (req, res) => {
    try {
        const { couponId, userId } = req.body;
        
        const couponRef = db.collection('coupons').doc(couponId);
        const couponDoc = await couponRef.get();
        
        if (!couponDoc.exists) {
            return res.status(404).json({ error: 'كوبون غير موجود' });
        }
        
        const coupon = couponDoc.data();
        
        if (coupon.type === 'points') {
            // إضافة نقاط للمستخدم
            const userRef = db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            const currentPoints = userDoc.data()?.points || 0;
            await userRef.update({ points: currentPoints + coupon.value });
        }
        
        // تحديث عدد الاستخدامات
        await couponRef.update({
            usedCount: FieldValue.increment(1),
            usedBy: FieldValue.arrayUnion(userId)
        });
        
        res.json({ 
            success: true, 
            message: `تم استخدام الكوبون بنجاح! ${coupon.type === 'points' ? `+${coupon.value} نقطة` : ''}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== APIs الإحصائيات ==========

// API: إحصائيات النظام
app.get('/api/stats', async (req, res) => {
    try {
        const [usersSnapshot, servicesSnapshot, ordersSnapshot] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('services').count().get(),
            db.collection('orders').count().get()
        ]);
        
        // حساب إجمالي النقاط
        const users = await db.collection('users').get();
        let totalPoints = 0;
        users.forEach(doc => {
            totalPoints += doc.data().points || 0;
        });
        
        res.json({
            totalUsers: usersSnapshot.data().count,
            totalServices: servicesSnapshot.data().count,
            totalOrders: ordersSnapshot.data().count,
            totalPoints: totalPoints
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== تحميل الـ APIs الديناميكية ==========
loadAllAPIs();

// ========== Serve Static Files ==========
app.use(express.static(__dirname));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ========== الصفحة الرئيسية ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ========== معالج الصفحات غير الموجودة (404) ==========
app.use('*', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// ========== بدء الخادم ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 APIs directory: ${APIS_DIR}`);
    console.log(`✅ Firebase connected: all-arab-services-750ad`);
    console.log(`🌐 Access at: https://all-arab-services.onrender.com`);
    console.log('='.repeat(60));
});
