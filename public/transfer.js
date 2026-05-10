// transfer.js - تم إنشاؤه بواسطة البوت
const API_URL = window.location.origin;

async function sendRequest(endpoint, data) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch(e) {
        console.error(e);
        return { success: false, error: e.message };
    }
}

console.log('✅ transfer.js loaded');
