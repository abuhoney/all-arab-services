const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ======================== Firebase Admin Initialization ========================
// Service Account from environment variable (from config.py data)
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
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40all-arab-services-750ad.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "all-arab-services-750ad.firebasestorage.app",
    databaseURL: "https://all-arab-services-750ad-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.firestore();
const storage = admin.storage().bucket();
const messaging = admin.messaging();
const FieldValue = admin.firestore.FieldValue;

// ======================== Helper Functions ========================
function getStatusText(status) {
    const map = {
        pending: 'قيد الانتظار',
        confirmed: 'تم التأكيد',
        completed: 'مكتمل',
        cancelled: 'ملغي',
        reserved: 'محجوز'
    };
    return map[status] || status;
}

function formatWhatsAppOrder(order, buyer, service) {
    return `🏢 *طلب حجز جديد*
📦 المنتج: ${service.productName}
🆔 رقم الطلب: ${order.id}
💰 السعر: ${service.price} ${service.currency}
💎 العربون المدفوع: ${order.depositPoints} نقطة

👤 *بيانات المشتري*
الاسم: ${buyer.name}
الجوال: ${buyer.phone}

الرجاء التواصل لإتمام الشراء. الدفع الحقيقي خارج التطبيق.`;
}

// ======================== Notification System ========================
async function sendNotification({ userId, type, title, body, data = {} }) {
    try {
        const notifRef = db.collection('notifications').doc();
        await notifRef.set({
            id: notifRef.id,
            userId: userId,
            type: type,
            title: title,
            body: body,
            data: data,
            read: false,
            createdAt: FieldValue.serverTimestamp()
        });

        const userDoc = await db.collection('users').doc(userId).get();
        const fcmToken = userDoc.data()?.fcmToken;

        if (fcmToken) {
            await messaging.send({
                token: fcmToken,
                notification: { title, body },
                data: { ...data, type, notifId: notifRef.id },
                android: { priority: 'high' }
            });
        }

        return { success: true, notifId: notifRef.id };
    } catch (error) {
        console.error('Notification Error:', error);
        return { success: false, error: error.message };
    }
}

// ======================== Wallet System ========================
async function updateWallet(uid, amount, type, refType, refId, description) {
    const userRef = db.collection('users').doc(uid);

    return await db.runTransaction(async (t) => {
        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw new Error('User not found');

        const currentPoints = userDoc.data().points || 0;
        const newBalance = currentPoints + amount;

        if (newBalance < 0) throw new Error('رصيد النقاط غير كافي');
        if (userDoc.data().walletFrozen) throw new Error('المحفظة مجمدة');

        t.update(userRef, {
            points: newBalance,
            totalEarned: FieldValue.increment(amount > 0 ? amount : 0),
            totalSpent: FieldValue.increment(amount < 0 ? Math.abs(amount) : 0)
        });

        const txnRef = db.collection('wallet_transactions').doc();
        t.set(txnRef, {
            id: txnRef.id,
            userId: uid,
            type: type,
            amount: amount,
            balanceBefore: currentPoints,
            balanceAfter: newBalance,
            refType: refType,
            refId: refId,
            description: description,
            deviceId: userDoc.data().deviceId,
            createdAt: FieldValue.serverTimestamp(),
            status: 'completed'
        });

        return { newBalance, txnId: txnRef.id };
    });
}

// ======================== Log Action ========================
async function logAction(userId, action, targetType, targetId, details, status) {
    try {
        await db.collection('activity_logs').add({
            userId: userId,
            action: action,
            targetType: targetType,
            targetId: targetId,
            details: details,
            status: status,
            createdAt: FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Log action error:', error);
    }
}

// ======================== API: Create Service ========================
app.post('/api/services/create', async (req, res) => {
    try {
        const { uid, serviceData, imageBase64 } = req.body;

        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) return res.status(401).json({ error: 'Unauthorized' });

        const user = userDoc.data();

        // Check daily limit: 3 services per day
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayServices = await db.collection('services')
            .where('userId', '==', uid)
            .where('createdAt', '>=', today)
            .get();

        if (todayServices.size >= 3) {
            return res.status(429).json({ error: 'تم تجاوز الحد اليومي 3 خدمات' });
        }

        // Upload image to Firebase Storage
        let imageUrl = '';
        if (imageBase64) {
            const buffer = Buffer.from(imageBase64.split(',')[1], 'base64');
            const fileName = `services/${uid}/${Date.now()}.jpg`;
            const file = storage.file(fileName);
            await file.save(buffer, { contentType: 'image/jpeg' });
            await file.makePublic();
            imageUrl = `https://storage.googleapis.com/${storage.name}/${fileName}`;
        }

        // Calculate final price
        const finalPrice = serviceData.discountPercent > 0
            ? serviceData.basePrice - (serviceData.basePrice * serviceData.discountPercent / 100)
            : serviceData.basePrice;

        // Save service
        const serviceRef = db.collection('services').doc();
        const newService = {
            id: serviceRef.id,
            ...serviceData,
            price: parseFloat(finalPrice.toFixed(2)),
            image: imageUrl,
            userId: uid,
            deviceId: user.deviceId,
            status: 'pending',
            views: 0,
            avgRating: 0,
            reviewCount: 0,
            createdAt: FieldValue.serverTimestamp()
        };

        await serviceRef.set(newService);

        // Add points to user
        await updateWallet(uid, 10, 'earn', 'service', serviceRef.id, 'إضافة خدمة جديدة +10 نقاط');

        // Notify user
        await sendNotification({
            userId: uid,
            type: 'service',
            title: '✅ تم إنشاء الخدمة',
            body: `خدمتك "${serviceData.productName}" قيد المراجعة +10 نقاط`,
            data: { serviceId: serviceRef.id }
        });

        // Notify admins
        const admins = await db.collection('users').where('role', '==', 'admin').get();
        admins.forEach(async (adminDoc) => {
            await sendNotification({
                userId: adminDoc.id,
                type: 'admin',
                title: '🆕 خدمة جديدة للمراجعة',
                body: `${serviceData.establishment} - ${serviceData.productName}`,
                data: { serviceId: serviceRef.id, action: 'review' }
            });
        });

        await logAction(uid, 'create_service', 'service', serviceRef.id, serviceData, 'success');
        res.json({ success: true, serviceId: serviceRef.id, service: newService });

    } catch (error) {
        console.error('Create Service Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Reserve Service (15% deposit) ========================
app.post('/api/orders/reserve', async (req, res) => {
    try {
        const { uid, serviceId, couponCode } = req.body;

        const [userDoc, serviceDoc] = await Promise.all([
            db.collection('users').doc(uid).get(),
            db.collection('services').doc(serviceId).get()
        ]);

        if (!serviceDoc.exists) return res.status(404).json({ error: 'الخدمة غير موجودة' });

        const service = serviceDoc.data();
        const user = userDoc.data();
        const basePrice = parseFloat(service.price);

        // Calculate deposit 15% as points (1 SAR = 10 points)
        let depositPoints = Math.ceil(basePrice * 0.15 * 10);
        let finalDeposit = depositPoints;
        let discountApplied = 0;

        // Apply coupon if provided
        if (couponCode) {
            const couponSnap = await db.collection('coupons').where('code', '==', couponCode.toUpperCase()).limit(1).get();
            if (!couponSnap.empty) {
                const coupon = couponSnap.docs[0].data();
                if (coupon.isActive && coupon.type === 'percent_discount') {
                    discountApplied = basePrice * (coupon.value / 100);
                    finalDeposit = Math.ceil((basePrice - discountApplied) * 0.15 * 10);
                }
            }
        }

        // Check if user has enough points
        if ((user.points || 0) < finalDeposit) {
            return res.status(400).json({ error: 'رصيد النقاط غير كافي للحجز' });
        }

        // Deduct points from wallet
        await updateWallet(uid, -finalDeposit, 'spend', 'order', serviceId,
            `عربون حجز ${service.productName} - خصم ${discountApplied.toFixed(2)}`);

        // Create order
        const orderRef = db.collection('orders').doc();
        const order = {
            id: orderRef.id,
            buyerId: uid,
            buyerName: user.name,
            buyerPhone: user.phone,
            sellerId: service.userId,
            sellerName: service.establishment,
            serviceId: serviceId,
            serviceName: service.productName,
            servicePrice: basePrice,
            currency: service.currency,
            depositPoints: finalDeposit,
            discountApplied: discountApplied,
            couponUsed: couponCode || null,
            status: 'reserved',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            createdAt: FieldValue.serverTimestamp()
        };
        await orderRef.set(order);

        // Notify seller
        await sendNotification({
            userId: service.userId,
            type: 'order',
            title: '🔔 حجز جديد!',
            body: `${user.name} حجز ${service.productName}. العربون: ${finalDeposit} نقطة`,
            data: { orderId: orderRef.id, action: 'view_order', buyerPhone: user.phone }
        });

        // Notify buyer
        await sendNotification({
            userId: uid,
            type: 'order',
            title: '✅ تم الحجز بنجاح',
            body: `تم خصم ${finalDeposit} نقطة كعربون. تواصل مع البائع لإتمام الشراء`,
            data: { orderId: orderRef.id, sellerPhone: service.contact }
        });

        await logAction(uid, 'reserve_service', 'order', orderRef.id, { depositPoints: finalDeposit }, 'success');

        res.json({
            success: true,
            orderId: orderRef.id,
            depositPoints: finalDeposit,
            sellerContact: service.contact,
            whatsappMsg: formatWhatsAppOrder(order, user, service)
        });

    } catch (error) {
        console.error('Reserve Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Get Notifications ========================
app.get('/api/notifications/:uid', async (req, res) => {
    try {
        const { uid } = req.params;
        const snapshot = await db.collection('notifications')
            .where('userId', '==', uid)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json({ success: true, notifications });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Mark Notification as Read ========================
app.put('/api/notifications/:notifId/read', async (req, res) => {
    try {
        await db.collection('notifications').doc(req.params.notifId).update({ read: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Mark All Notifications as Read ========================
app.put('/api/notifications/mark-all-read', async (req, res) => {
    try {
        const { uid } = req.body;
        const batch = db.batch();
        const snapshot = await db.collection('notifications')
            .where('userId', '==', uid)
            .where('read', '==', false)
            .get();
        snapshot.docs.forEach(doc => batch.update(doc.ref, { read: true }));
        await batch.commit();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Get Reviews ========================
app.get('/api/reviews/:serviceId', async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { rating, sort = 'newest' } = req.query;

        let query = db.collection('reviews').where('serviceId', '==', serviceId);
        if (rating) query = query.where('rating', '==', parseInt(rating));
        if (sort === 'newest') query = query.orderBy('createdAt', 'desc');
        else query = query.orderBy('helpful', 'desc');

        const snapshot = await query.limit(50).get();
        const reviews = await Promise.all(snapshot.docs.map(async (doc) => {
            const review = doc.data();
            const userDoc = await db.collection('users').doc(review.userId).get();
            return {
                ...review,
                userName: userDoc.data()?.name || 'مستخدم',
                userAvatar: userDoc.data()?.avatar || null
            };
        }));

        res.json({ success: true, reviews });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Create Review ========================
app.post('/api/reviews/create', async (req, res) => {
    try {
        const { uid, serviceId, orderId, rating, comment } = req.body;

        // Verify order is completed and user is buyer
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) return res.status(404).json({ error: 'الطلب غير موجود' });
        if (orderDoc.data().buyerId !== uid) return res.status(403).json({ error: 'غير مصرح' });
        if (orderDoc.data().status !== 'completed') return res.status(400).json({ error: 'يجب إتمام الشراء أولاً' });

        // Check for existing review
        const existingReview = await db.collection('reviews')
            .where('orderId', '==', orderId).limit(1).get();
        if (!existingReview.empty) return res.status(400).json({ error: 'قيمت هذا الطلب مسبقاً' });

        const reviewRef = db.collection('reviews').doc();
        const review = {
            id: reviewRef.id,
            userId: uid,
            serviceId,
            orderId,
            rating: Math.min(5, Math.max(1, rating)),
            comment: comment || '',
            helpful: 0,
            reported: false,
            createdAt: FieldValue.serverTimestamp()
        };

        await reviewRef.set(review);

        // Update service average rating
        const reviewsSnap = await db.collection('reviews').where('serviceId', '==', serviceId).get();
        const avgRating = reviewsSnap.docs.reduce((sum, d) => sum + d.data().rating, 0) / reviewsSnap.size;

        await db.collection('services').doc(serviceId).update({
            avgRating: parseFloat(avgRating.toFixed(1)),
            reviewCount: reviewsSnap.size,
            lastReviewAt: FieldValue.serverTimestamp()
        });

        // Reward points for review
        await updateWallet(uid, 5, 'earn', 'review', reviewRef.id, 'مكافأة تقييم منتج +5 نقاط');

        // Notify seller
        const serviceDoc = await db.collection('services').doc(serviceId).get();
        await sendNotification({
            userId: serviceDoc.data().userId,
            type: 'review',
            title: '⭐ تقييم جديد',
            body: `تم تقييم ${serviceDoc.data().productName} بـ ${rating} نجوم`,
            data: { reviewId: reviewRef.id, serviceId }
        });

        await logAction(uid, 'create_review', 'review', reviewRef.id, { rating, serviceId }, 'success');
        res.json({ success: true, reviewId: reviewRef.id });

    } catch (error) {
        console.error('Create Review Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Admin - Get Pending Services ========================
app.get('/api/admin/services/pending', async (req, res) => {
    try {
        const snapshot = await db.collection('services').where('status', '==', 'pending').get();
        const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Admin - Approve Service ========================
app.put('/api/admin/services/:serviceId/approve', async (req, res) => {
    try {
        const { serviceId } = req.params;
        await db.collection('services').doc(serviceId).update({ status: 'approved' });
        
        const service = await db.collection('services').doc(serviceId).get();
        await sendNotification({
            userId: service.data().userId,
            type: 'service',
            title: '✅ تمت الموافقة على خدمتك',
            body: `خدمة "${service.data().productName}" أصبحت متاحة الآن`,
            data: { serviceId }
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Admin - Reject Service ========================
app.put('/api/admin/services/:serviceId/reject', async (req, res) => {
    try {
        await db.collection('services').doc(req.params.serviceId).update({ status: 'rejected' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Admin - Get Pending Reports ========================
app.get('/api/admin/reports/pending', async (req, res) => {
    try {
        const snapshot = await db.collection('reports').where('status', '==', 'pending').get();
        const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Admin - Resolve Report ========================
app.put('/api/admin/reports/:reportId/resolve', async (req, res) => {
    try {
        await db.collection('reports').doc(req.params.reportId).update({ status: 'resolved' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Admin - Dashboard Stats ========================
app.get('/api/admin/dashboard/stats', async (req, res) => {
    try {
        const { adminUid } = req.query;
        const adminDoc = await db.collection('users').doc(adminUid).get();
        if (adminDoc.data()?.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

        const [services, users, orders, reports] = await Promise.all([
            db.collection('services').count().get(),
            db.collection('users').count().get(),
            db.collection('orders').count().get(),
            db.collection('reports').where('status', '==', 'pending').count().get()
        ]);

        // Today's stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayOrders = await db.collection('orders').where('createdAt', '>=', today).count().get();
        const todayUsers = await db.collection('users').where('createdAt', '>=', today).count().get();

        res.json({
            total: {
                services: services.data().count,
                users: users.data().count,
                orders: orders.data().count,
                pendingReports: reports.data().count
            },
            today: {
                orders: todayOrders.data().count,
                users: todayUsers.data().count
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Admin - Financial Report ========================
app.get('/api/admin/financial-report', async (req, res) => {
    try {
        const { adminUid, startDate, endDate } = req.query;

        const adminDoc = await db.collection('users').doc(adminUid).get();
        if (adminDoc.data()?.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

        const start = new Date(startDate);
        const end = new Date(endDate);

        const [transactions, orders] = await Promise.all([
            db.collection('wallet_transactions')
                .where('createdAt', '>=', start)
                .where('createdAt', '<=', end)
                .get(),
            db.collection('orders')
                .where('createdAt', '>=', start)
                .where('createdAt', '<=', end)
                .get()
        ]);

        let totalPointsEarned = 0;
        let totalPointsSpent = 0;

        transactions.docs.forEach(doc => {
            const tx = doc.data();
            if (tx.type === 'earn') totalPointsEarned += tx.amount;
            if (tx.type === 'spend') totalPointsSpent += Math.abs(tx.amount);
        });

        const completedOrders = orders.docs.filter(d => d.data().status === 'completed').length;
        const totalRevenue = orders.docs
            .filter(d => d.data().status === 'completed')
            .reduce((sum, d) => sum + d.data().servicePrice, 0);
        const conversionRate = orders.size > 0 ? (completedOrders / orders.size * 100).toFixed(2) : 0;

        // Top sellers
        const sellerStats = {};
        orders.docs.forEach(doc => {
            const o = doc.data();
            if (o.status === 'completed') {
                if (!sellerStats[o.sellerId]) sellerStats[o.sellerId] = { revenue: 0, orders: 0 };
                sellerStats[o.sellerId].revenue += o.servicePrice;
                sellerStats[o.sellerId].orders += 1;
            }
        });

        const topSellers = await Promise.all(
            Object.entries(sellerStats)
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .slice(0, 5)
                .map(async ([sellerId, stats]) => {
                    const userDoc = await db.collection('users').doc(sellerId).get();
                    return { sellerId, name: userDoc.data()?.name || 'مستخدم', ...stats };
                })
        );

        res.json({
            success: true,
            points: { earned: totalPointsEarned, spent: totalPointsSpent },
            orders: { total: orders.size, completed: completedOrders, conversionRate: parseFloat(conversionRate), totalRevenue: parseFloat(totalRevenue.toFixed(2)) },
            topSellers
        });
    } catch (error) {
        console.error('Financial Report Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Report Creation ========================
app.post('/api/reports/create', async (req, res) => {
    try {
        const { uid, targetType, targetId, reason, description } = req.body;

        // Prevent duplicate reports within 24 hours
        const recentReport = await db.collection('reports')
            .where('reporterId', '==', uid)
            .where('targetId', '==', targetId)
            .where('createdAt', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
            .limit(1).get();

        if (!recentReport.empty) {
            return res.status(429).json({ error: 'بلغت عن هذا العنصر خلال 24 ساعة' });
        }

        const reportRef = db.collection('reports').doc();
        const report = {
            id: reportRef.id,
            reporterId: uid,
            targetType: targetType,
            targetId: targetId,
            reason: reason,
            description: description || '',
            status: 'pending',
            createdAt: FieldValue.serverTimestamp()
        };

        await reportRef.set(report);

        // Notify admins
        const admins = await db.collection('users').where('role', '==', 'admin').get();
        admins.forEach(async (adminDoc) => {
            await sendNotification({
                userId: adminDoc.id,
                type: 'admin',
                title: '🚨 بلاغ جديد',
                body: `بلاغ على ${targetType}: ${reason}`,
                data: { reportId: reportRef.id, action: 'review_report' }
            });
        });

        // Auto-moderation check
        let autoResolved = false;
        if (targetType === 'service') {
            const recentReports = await db.collection('reports')
                .where('targetId', '==', targetId)
                .where('createdAt', '>', new Date(Date.now() - 60 * 60 * 1000))
                .get();
            if (recentReports.size >= 3) {
                await db.collection('services').doc(targetId).update({ status: 'hidden' });
                autoResolved = true;
            }
        }

        res.json({ success: true, reportId: reportRef.id, autoResolved });

    } catch (error) {
        console.error('Report Creation Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Seller Dashboard ========================
app.get('/api/seller/dashboard/:uid', async (req, res) => {
    try {
        const { uid } = req.params;

        const services = await db.collection('services').where('userId', '==', uid).get();
        const orders = await db.collection('orders').where('sellerId', '==', uid).get();
        
        // Get reviews for seller's services
        const serviceIds = services.docs.map(d => d.id);
        let reviews = [];
        if (serviceIds.length > 0) {
            const reviewsSnap = await db.collection('reviews').where('serviceId', 'in', serviceIds.slice(0, 10)).get();
            reviews = reviewsSnap.docs;
        }

        const totalServices = services.size;
        const completedOrders = orders.docs.filter(d => d.data().status === 'completed').length;
        const pendingOrders = orders.docs.filter(d => d.data().status === 'reserved').length;
        const totalRevenue = orders.docs
            .filter(d => d.data().status === 'completed')
            .reduce((sum, d) => sum + d.data().servicePrice, 0);
        const avgRating = reviews.length > 0
            ? reviews.reduce((sum, d) => sum + d.data().rating, 0) / reviews.length
            : 0;

        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentOrders = orders.docs.filter(d => d.data().createdAt?.toDate() > weekAgo).length;

        res.json({
            success: true,
            stats: {
                totalServices,
                completedOrders,
                pendingOrders,
                totalRevenue: parseFloat(totalRevenue.toFixed(2)),
                avgRating: parseFloat(avgRating.toFixed(1)),
                totalReviews: reviews.length,
                recentOrders
            },
            topServices: services.docs
                .sort((a, b) => (b.data().views || 0) - (a.data().views || 0))
                .slice(0, 5)
                .map(d => ({ id: d.id, ...d.data() }))
        });
    } catch (error) {
        console.error('Seller Dashboard Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Referral Stats ========================
app.get('/api/referral/stats/:uid', async (req, res) => {
    try {
        const { uid } = req.params;

        const userDoc = await db.collection('users').doc(uid).get();
        const referrals = await db.collection('referrals').where('referrerId', '==', uid).get();

        const recentReferrals = await Promise.all(
            referrals.docs.slice(0, 10).map(async (ref) => {
                const referredUser = await db.collection('users').doc(ref.data().referredId).get();
                return {
                    name: referredUser.data()?.name || 'مستخدم',
                    joinedAt: ref.data().createdAt,
                    bonus: ref.data().bonusGiven
                };
            })
        );

        res.json({
            success: true,
            totalReferrals: userDoc.data()?.totalReferrals || 0,
            totalEarnings: userDoc.data()?.totalReferralEarnings || 0,
            referralCode: userDoc.data()?.referralCode,
            recentReferrals
        });
    } catch (error) {
        console.error('Referral Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Track Referral ========================
app.post('/api/referral/track', async (req, res) => {
    try {
        const { newUserId, referralCode } = req.body;

        if (!referralCode) return res.json({ success: false, reason: 'no_code' });

        const referrerSnap = await db.collection('users')
            .where('referralCode', '==', referralCode.toUpperCase())
            .limit(1).get();

        if (referrerSnap.empty) return res.json({ success: false, reason: 'invalid_code' });

        const referrer = referrerSnap.docs[0];
        const referrerId = referrer.id;

        if (referrerId === newUserId) return res.json({ success: false, reason: 'self_referral' });

        const existingRef = await db.collection('referrals')
            .where('referredId', '==', newUserId).limit(1).get();
        if (!existingRef.empty) return res.json({ success: false, reason: 'already_referred' });

        const bonusPoints = 50;

        await db.collection('referrals').add({
            referrerId: referrerId,
            referredId: newUserId,
            referralCode: referralCode,
            bonusGiven: bonusPoints,
            status: 'active',
            createdAt: FieldValue.serverTimestamp()
        });

        await updateWallet(referrerId, bonusPoints, 'earn', 'referral', newUserId, `مكافأة إحالة مستخدم جديد +${bonusPoints} نقاط`);
        await db.collection('users').doc(newUserId).update({ referredBy: referrerId });
        await db.collection('users').doc(referrerId).update({
            totalReferrals: FieldValue.increment(1),
            totalReferralEarnings: FieldValue.increment(bonusPoints)
        });

        await sendNotification({
            userId: referrerId,
            type: 'referral',
            title: '🎉 مكافأة إحالة جديدة!',
            body: `شخص جديد سجل بكودك! +${bonusPoints} نقطة`,
            data: { newUserId, bonus: bonusPoints }
        });

        res.json({ success: true, bonus: bonusPoints, referrerName: referrer.data().name });

    } catch (error) {
        console.error('Referral Track Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ======================== API: Upgrade Request Webhook ========================
app.post('/api/admin/upgrade-request-webhook', async (req, res) => {
    try {
        const { userId, userName, currentRole, requestedRole } = req.body;
        console.log(`Upgrade request from ${userName} (${userId}): ${currentRole} -> ${requestedRole}`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ======================== Serve Static Files & Catch-All ========================
const path = require('path');

// Serve static files from current directory
app.use(express.static(__dirname));

// Handle all other routes - return index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ======================== Start Server ========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Firebase initialized with project: all-arab-services-750ad`);
    console.log(`✅ API ready at http://localhost:${PORT}/api/`);
});