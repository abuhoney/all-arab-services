// init-categories.js
const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('./firebase-service-account.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const categories = [
    { id: "general", name: "📰 عام", icon: "📰", color: "blue", order: 1 },
    { id: "politics", name: "🏛️ سياسة", icon: "🏛️", color: "red", order: 2 },
    { id: "economy", name: "💰 اقتصاد", icon: "💰", color: "green", order: 3 },
    { id: "sports", name: "⚽ رياضة", icon: "⚽", color: "orange", order: 4 },
    { id: "technology", name: "💻 تكنولوجيا", icon: "💻", color: "purple", order: 5 },
    { id: "health", name: "🏥 صحة", icon: "🏥", color: "pink", order: 6 },
    { id: "education", name: "📚 تعليم", icon: "📚", color: "indigo", order: 7 },
    { id: "entertainment", name: "🎬 ترفيه", icon: "🎬", color: "yellow", order: 8 },
    { id: "science", name: "🔬 علوم", icon: "🔬", color: "cyan", order: 9 },
    { id: "weather", name: "🌤️ طقس", icon: "🌤️", color: "sky", order: 10 },
    { id: "accidents", name: "🚨 حوادث", icon: "🚨", color: "red", order: 11 },
    { id: "religious", name: "🕌 ديني", icon: "🕌", color: "emerald", order: 12 }
];

async function initCategories() {
    const batch = db.batch();
    
    for (const cat of categories) {
        const ref = db.collection('news_categories').doc(cat.id);
        batch.set(ref, {
            ...cat,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
    }
    
    await batch.commit();
    console.log('✅ Categories initialized successfully!');
}

initCategories().catch(console.error);