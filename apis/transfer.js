module.exports = {
    method: 'POST',
    path: '/api/transfer',
    handler: async (req, res) => {
        try {
            const db = req.app.locals.db;
            const FieldValue = req.app.locals.FieldValue;
            const { fromUserId, toUserId, amount } = req.body; const db = req.app.locals.db; const fromDoc = await db.collection('users').doc(fromUserId).get(); const toDoc = await db.collection('users').doc(toUserId).get(); if (!fromDoc.exists) return res.status(404).json({ error: 'المرسل غير موجود' }); if (!toDoc.exists) return res.status(404).json({ error: 'المستلم غير موجود' }); const fromBalance = fromDoc.data().points  0; if (fromBalance < amount) return res.status(400).json({ error: 'رصيد غير كاف' }); await db.runTransaction(async (t) => { t.update(db.collection('users').doc(fromUserId), { points: (fromBalance - amount) }); t.update(db.collection('users').doc(toUserId), { points: (toDoc.data().points  0) + amount }); }); res.json({ success: true, message: 'تم التحويل بنجاح', newBalance: fromBalance - amount });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};