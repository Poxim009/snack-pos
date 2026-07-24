// ============================================================
// api.js — ฟังก์ชันติดต่อกับ Backend
// ============================================================

const API_URL = '/api';

// ฟังก์ชันหลักใช้เรียก API
async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์');
        return data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        showToast(error.message, 'error');
        throw error;
    }
}

// รวมฟังก์ชันทั้งหมดแยกเป็นหมวดหมู่
const API = {
    Products: {
        getAll: () => fetchAPI('/products'),
        getCategories: () => fetchAPI('/products/categories'),
        create: (data) => fetchAPI('/products', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => fetchAPI(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => fetchAPI(`/products/${id}`, { method: 'DELETE' }),
        addCategory: (data) => fetchAPI('/products/categories', { method: 'POST', body: JSON.stringify(data) }),
        addStock: (id, qty) => fetchAPI(`/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ qty }) })
    },
    
    Sales: {
        getToday: () => fetchAPI('/sales/today'),
        create: (data) => fetchAPI('/sales', { method: 'POST', body: JSON.stringify(data) }),
        getHistory: (date) => fetchAPI(date ? `/sales?date=${date}` : '/sales'),
        delete: (id) => fetchAPI(`/sales/${id}`, { method: 'DELETE' })
    },
    
    Expenses: {
        getAll: () => fetchAPI('/expenses'),
        getCategories: () => fetchAPI('/expenses/categories'),
        create: async (formData) => {
            // Expenses มีการส่งไฟล์รูป จึงใช้ fetch ตรงๆ ไม่ผ่าน fetchAPI() แบบปกติ
            try {
                const response = await fetch(`${API_URL}/expenses`, {
                    method: 'POST',
                    body: formData // ส่ง FormData โดยไม่ต้องตั้ง Content-Type
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
                return data;
            } catch (error) {
                showToast(error.message, 'error');
                throw error;
            }
        },
        delete: (id) => fetchAPI(`/expenses/${id}`, { method: 'DELETE' })
    },
    
    Analytics: {
        getSummary: (period = 'today') => fetchAPI(`/analytics/summary?period=${period}`),
        getTopProducts: (period = 'week') => fetchAPI(`/analytics/top-products?period=${period}`),
        getDaily: (days = 7) => fetchAPI(`/analytics/daily?days=${days}`),
        getCalendar: (year, month) => fetchAPI(`/analytics/calendar?year=${year}&month=${month}`),
        getDailyDetails: (date) => fetchAPI(`/analytics/daily-details?date=${date}`)
    },
    
    Debts: {
        getAll: (status = '') => fetchAPI(status ? `/debts?status=${status}` : '/debts'),
        getSummary: () => fetchAPI('/debts/summary'),
        create: (data) => fetchAPI('/debts', { method: 'POST', body: JSON.stringify(data) }),
        pay: (id, amount) => fetchAPI(`/debts/${id}/pay`, { method: 'PUT', body: JSON.stringify({ pay_amount: amount }) }),
        delete: (id) => fetchAPI(`/debts/${id}`, { method: 'DELETE' })
    },
    
    Customers: {
        getAll: () => fetchAPI('/customers'),
        create: (data) => fetchAPI('/customers', { method: 'POST', body: JSON.stringify(data) })
    },
    
    Line: {
        getStatus: () => fetchAPI('/line/status'),
        sendReminder: (debtId) => fetchAPI('/line/send-reminder', { method: 'POST', body: JSON.stringify({ debt_id: debtId }) }),
        sendCustomerReminder: (customerId) => fetchAPI(`/line/remind-customer/${customerId}`, { method: 'POST' }),
        notifyNewDebt: (debtId) => fetchAPI('/line/notify-new-debt', { method: 'POST', body: JSON.stringify({ debt_id: debtId }) })
    }
};
