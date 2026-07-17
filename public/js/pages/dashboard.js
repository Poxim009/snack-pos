// ============================================================
// pages/dashboard.js — หน้าหลัก (สรุปรายวัน)
// ============================================================

async function renderDashboard() {
    const container = document.getElementById('dashboard-content');
    container.innerHTML = '<div class="loading">กำลังโหลดข้อมูล...</div>';

    try {
        // ดึงข้อมูลยอดขายวันนี้
        const data = await API.Sales.getToday();
        
        let html = `
            <div class="summary-grid">
                <div class="summary-box primary">
                    <span class="summary-label">ยอดขายวันนี้</span>
                    <div class="summary-value">${formatCurrency(data.total_sales || 0)}</div>
                </div>
                <div class="summary-box">
                    <span class="summary-label">จำนวนบิล</span>
                    <div class="summary-value">${data.total_bills || 0}</div>
                </div>
            </div>

            <div class="card">
                <h3>🔥 สินค้าขายดีวันนี้</h3>
                ${data.top_items && data.top_items.length > 0 ? `
                    <div class="item-list mt-2">
                        ${data.top_items.map(item => `
                            <div class="item-card">
                                <div>
                                    <div class="item-title">${item.product_name}</div>
                                    <div class="item-subtitle">ขายได้ ${item.total_qty} ชิ้น</div>
                                </div>
                                <div class="item-price">${formatCurrency(item.total_amount)}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="text-muted text-center mt-2">ยังไม่มีรายการขายวันนี้</p>'}
            </div>
        `;
        
        container.innerHTML = html;
        
    } catch (error) {
        container.innerHTML = `<div class="text-danger text-center">โหลดข้อมูลล้มเหลว: ${error.message}</div>`;
    }
}
