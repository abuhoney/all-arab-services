module.exports = {
    method: 'GET',
    path: '/api/points_transfer/data',
    handler: async (req, res) => {
        try {
            res.json({
                success: true,
                message: 'مرحباً بك في خدمة points_transfer',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

// إضافة POST endpoint للـ action
const express = require('express');
const app = express();
app.post('/api/points_transfer/action', async (req, res) => {
    try {
        const { data, userId } = req.body;
        
        // معالجة البيانات
        // يمكنك تخصيص هذه المعالجة حسب需求
        
        res.json({
            success: true,
            message: `تم استلام البيانات: ${data}`,
            receivedData: data
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
