// transfer.js - تم إنشاؤه بواسطة البوت
const API_URL = window.location.origin;


async function loadPage() {
    try {
        const response = await fetch(`${API_URL}/api/page-data/transfer`);
        const data = await response.json();
        if (data.success) {
            document.getElementById('content').innerHTML = data.html;
        }
    } catch(e) {
        console.error(e);
    }
}
loadPage();


console.log("✅ transfer loaded");