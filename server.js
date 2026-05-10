const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ========== Firebase Admin ==========
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

// ========== نظام API الديناميكي ==========
// تسجيل جميع الـ APIs تلقائياً من مجلد apis
const APIS_DIR = path.join(__dirname, 'apis');

if (!fs.existsSync(APIS_DIR)) {
    fs.mkdirSync(APIS_DIR, { recursive: true });
}

// تحميل جميع ملفات الـ API من مجلد apis
fs.readdirSync(APIS_DIR).forEach(file => {
    if (file.endsWith('.js')) {
        try {
            const apiModule = require(path.join(APIS_DIR, file));
            if (apiModule.method && apiModule.path && apiModule.handler) {
                app[apiModule.method.toLowerCase()](apiModule.path, apiModule.handler);
                console.log(`✅ API loaded: ${apiModule.method} ${apiModule.path}`);
            }
        } catch (e) {
            console.error(`Error loading API ${file}:`, e);
        }
    }
});

// ========== API: جلب جميع الخدمات ==========
app.get('/api/services', async (req, res) => {
    try {
        const snapshot = await db.collection('services').where('status', '==', 'approved').orderBy('createdAt', 'desc').limit(100).get();
        const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== API: جلب مستخدم ==========
app.get('/api/user/:userId', async (req, res) => {
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

// ========== API: تحديث نقاط المستخدم ==========
app.post('/api/update-points', async (req, res) => {
    try {
        const { userId, points, reason } = req.body;
        const userRef = db.collection('users').doc(userId);
        await userRef.update({ points: FieldValue.increment(points) });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== API: إنشاء API جديد (عن طريق البوت) ==========
app.post('/api/create-api', async (req, res) => {
    try {
        const { apiName, method, path, code } = req.body;
        
        // التحقق من الصلاحية (يجب أن يكون الطلب من المشرف)
        const apiKey = req.headers['x-admin-key'];
        if (apiKey !== 'ALL_ARAB_ADMIN_SECRET_KEY') {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        const apiContent = `
module.exports = {
    method: '${method}',
    path: '${path}',
    handler: async (req, res) => {
        try {
            ${code}
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};
`;
        const apiPath = path.join(APIS_DIR, `${apiName}.js`);
        fs.writeFileSync(apiPath, apiContent);
        
        res.json({ success: true, message: `API ${apiName} created successfully` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== API: تحويل النقاط (المدمج) ==========
app.post('/api/transfer-points', async (req, res) => {
    try {
        const { fromUserId, toUserId, amount, reason } = req.body;
        
        if (!fromUserId || !toUserId || !amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'بيانات غير صالحة' });
        }
        
        const fromUserDoc = await db.collection('users').doc(fromUserId).get();
        const toUserDoc = await db.collection('users').doc(toUserId).get();
        
        if (!fromUserDoc.exists) {
            return res.status(404).json({ success: false, message: 'المرسل غير موجود' });
        }
        if (!toUserDoc.exists) {
            return res.status(404).json({ success: false, message: 'المستلم غير موجود' });
        }
        
        const fromBalance = fromUserDoc.data().points || 0;
        
        if (fromBalance < amount) {
            return res.status(400).json({ success: false, message: `رصيد غير كافٍ. رصيدك: ${fromBalance} نقطة` });
        }
        
        await db.runTransaction(async (t) => {
            const fromRef = db.collection('users').doc(fromUserId);
            const toRef = db.collection('users').doc(toUserId);
            
            const fromDoc = await t.get(fromRef);
            const toDoc = await t.get(toRef);
            
            t.update(fromRef, { points: (fromDoc.data().points || 0) - amount });
            t.update(toRef, { points: (toDoc.data().points || 0) + amount });
        });
        
        const newBalance = (await db.collection('users').doc(fromUserId).get()).data().points;
        
        res.json({ success: true, message: `✅ تم تحويل ${amount} نقطة بنجاح`, newBalance });
        
    } catch (error) {
        console.error('Transfer error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== API: المستخدم الحالي ==========
app.get('/api/current-user', async (req, res) => {
    try {
        const userId = req.query.userId || 'admin';
        const userDoc = await db.collection('users').doc(userId).get();
        res.json({ success: true, points: userDoc.data()?.points || 0, userId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== Serve Static Files ==========
app.use(express.static(__dirname));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ========== الصفحة الرئيسية ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 APIs directory: ${APIS_DIR}`);
    console.log(`✅ Ready to accept dynamic APIs from bot`);
});
