// ========== points_transfer.js - تم إنشاؤه بواسطة البوت ==========
const API_URL = window.location.origin;
const FEATURE_NAME = 'points_transfer';

// الحالة العامة
let state = {
    loading: false,
    data: null,
    error: null
};

// دوال مساعدة
function showLoading() {
    const btn = document.querySelector('#submitBtn');
    if (btn) {
        btn.classList.add('loading');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المعالجة...';
    }
}

function hideLoading() {
    const btn = document.querySelector('#submitBtn');
    if (btn) {
        btn.classList.remove('loading');
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> تنفيذ';
    }
}

function showMessage(msg, type = 'success') {
    const msgDiv = document.getElementById('message');
    if (msgDiv) {
        msgDiv.innerHTML = `<div class="p-3 rounded-xl text-center ${type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${msg}</div>`;
        setTimeout(() => {
            msgDiv.innerHTML = '';
        }, 3000);
    }
}

function updateUI(data) {
    const contentDiv = document.getElementById('content');
    if (contentDiv && data) {
        contentDiv.innerHTML = `
            <div class="bg-${color}-50 rounded-xl p-4 text-center">
                <p class="text-lg font-bold text-${color}-600">${data.message || 'تم التحميل بنجاح'}</p>
                ${data.points ? `<p class="text-sm mt-2">⭐ رصيدك: ${data.points} نقطة</p>` : ''}
            </div>
            <div class="space-y-3">
                <input type="text" id="input1" class="w-full border rounded-xl p-3" placeholder="أدخل البيانات المطلوبة">
                <button id="submitBtn" class="w-full bg-${color}-600 text-white py-3 rounded-xl font-bold btn-animate">
                    <i class="fa-solid fa-paper-plane"></i> تنفيذ
                </button>
                <div id="message"></div>
            </div>
        `;
        
        // ربط الحدث
        document.getElementById('submitBtn')?.addEventListener('click', submitData);
    }
}

async function loadData() {
    try {
        const response = await fetch(`${API_URL}/api/points_transfer/data`);
        const data = await response.json();
        if (data.success) {
            state.data = data;
            updateUI(data);
        } else {
            showMessage(data.error || 'فشل التحميل', 'error');
        }
    } catch(e) {
        console.error(e);
        showMessage('خطأ في الاتصال', 'error');
    }
}

async function submitData() {
    const input1 = document.getElementById('input1')?.value;
    if (!input1) {
        showMessage('الرجاء إدخال البيانات', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/api/points_transfer/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: input1, userId: localStorage.getItem('userId') || 'admin' })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage(result.message || 'تم التنفيذ بنجاح!', 'success');
            if (result.newPoints) {
                document.getElementById('userPoints').innerText = result.newPoints;
            }
            document.getElementById('input1').value = '';
        } else {
            showMessage(result.error || 'فشل التنفيذ', 'error');
        }
    } catch(e) {
        showMessage('خطأ في الاتصال', 'error');
    } finally {
        hideLoading();
    }
}

// تحديث رصيد المستخدم
async function updateUserPoints() {
    try {
        const userId = localStorage.getItem('userId') || 'admin';
        const response = await fetch(`${API_URL}/api/current-user?userId=${userId}`);
        const data = await response.json();
        if (data.success) {
            const pointsSpan = document.getElementById('userPoints');
            if (pointsSpan) pointsSpan.innerText = data.points;
        }
    } catch(e) {
        console.error(e);
    }
}

// بدء التشغيل
loadData();
updateUserPoints();
setInterval(updateUserPoints, 30000);
