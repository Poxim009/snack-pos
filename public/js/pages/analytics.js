// ============================================================
// pages/analytics.js — หน้าวิเคราะห์/สรุปยอด
// ============================================================

let currentAnalyticsPeriod = 'week';

async function renderAnalytics(period = currentAnalyticsPeriod) {
    currentAnalyticsPeriod = period;
    const container = document.getElementById('analytics-content');
    container.innerHTML = '<div class="loading">กำลังโหลดข้อมูล...</div>';

    try {
        // โหลดข้อมูล 3 อย่างพร้อมกันเพื่อให้เร็วขึ้น
        const [summary, topProducts, dailyData] = await Promise.all([
            API.Analytics.getSummary(period),     // สรุปยอด
            API.Analytics.getTopProducts(period), // สินค้าขายดี
            API.Analytics.getDaily(7)             // กราฟ 7 วัน (ดึง 7 วันเสมอ)
        ]);
        
        const periodTitle = period === 'today' ? 'วันนี้' : period === 'week' ? 'สัปดาห์นี้' : 'เดือนนี้';
        
        let html = `
            <div class="flex justify-between align-center mb-2">
                <h2 style="margin: 0;">📊 สรุป${periodTitle}</h2>
                <div class="flex" style="background: #E5E7EB; padding: 4px; border-radius: var(--radius-sm); gap: 2px;">
                    <button class="btn btn-sm ${period === 'today' ? 'btn-primary' : ''}" style="width: auto; padding: 4px 10px;" onclick="renderAnalytics('today')">วันนี้</button>
                    <button class="btn btn-sm ${period === 'week' ? 'btn-primary' : ''}" style="width: auto; padding: 4px 10px;" onclick="renderAnalytics('week')">สัปดาห์นี้</button>
                    <button class="btn btn-sm ${period === 'month' ? 'btn-primary' : ''}" style="width: auto; padding: 4px 10px;" onclick="renderAnalytics('month')">เดือนนี้</button>
                </div>
            </div>
            
            <div class="summary-grid">
                <div class="summary-box">
                    <span class="summary-label">ยอดขายรวม</span>
                    <div class="summary-value text-success">${formatCurrency(summary.total_sales)}</div>
                </div>
                <div class="summary-box">
                    <span class="summary-label">ต้นทุนสินค้า (ขายแล้ว)</span>
                    <div class="summary-value text-danger">${formatCurrency(summary.total_cogs)}</div>
                </div>
                <div class="summary-box">
                    <span class="summary-label">รายจ่ายอื่นๆ</span>
                    <div class="summary-value text-danger">${formatCurrency(summary.total_expenses)}</div>
                </div>
                <div class="summary-box" style="${summary.profit >= 0 ? 'background: #ECFDF5; border-color: #A7F3D0;' : 'background: #FEF2F2; border-color: #FECACA;'}">
                    <span class="summary-label">กำไรสุทธิ</span>
                    <div class="summary-value" style="color: ${summary.profit >= 0 ? 'var(--secondary)' : 'var(--danger)'};">
                        ${summary.profit >= 0 ? '+' : ''}${formatCurrency(summary.profit)}
                    </div>
                </div>
            </div>

            <div class="card">
                <h3>📈 ยอดขายย้อนหลัง 7 วัน</h3>
                <div style="height: 200px; width: 100%;">
                    <canvas id="dailyChart"></canvas>
                </div>
            </div>
            
            <div class="card mt-2">
                <h3>🏆 สินค้าขายดี 5 อันดับแรก</h3>
                ${topProducts.length === 0 ? '<p class="text-muted text-center mt-2">ยังไม่มีข้อมูล</p>' : ''}
                <div class="item-list mt-2">
                    ${topProducts.map((p, index) => `
                        <div class="item-card">
                            <div class="item-info">
                                <div style="font-size: 1.2rem; font-weight: bold; color: var(--text-muted); width: 25px;">#${index + 1}</div>
                                <div>
                                    <div class="item-title">${p.product_name}</div>
                                    <div class="item-subtitle">ขายได้ ${p.total_qty} ชิ้น</div>
                                </div>
                            </div>
                            <div class="item-price">${formatCurrency(p.total_revenue)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- เพิ่มส่วนประวัติการขาย -->
            <div class="card mt-2">
                <h3>📝 ประวัติการขายล่าสุด (100 บิล)</h3>
                <div id="sales-history-list" class="item-list mt-2">
                    <div class="text-center text-muted">กำลังโหลดประวัติ...</div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // วาดกราฟ
        setTimeout(() => {
            renderDailyChart('dailyChart', dailyData);
        }, 100);

        // โหลดประวัติการขาย
        loadSalesHistory();
        
    } catch (error) {
        container.innerHTML = `<div class="text-danger text-center">โหลดข้อมูลล้มเหลว: ${error.message}</div>`;
    }
}

async function loadSalesHistory() {
    const list = document.getElementById('sales-history-list');
    if (!list) return;

    try {
        const history = await API.Sales.getHistory();
        
        if (history.length === 0) {
            list.innerHTML = '<p class="text-muted text-center">ยังไม่มีประวัติการขาย</p>';
            return;
        }

        list.innerHTML = history.map(h => `
            <div class="item-card" style="align-items: flex-start;">
                <div style="flex: 1;">
                    <div style="font-size: 0.8rem; color: var(--text-muted);">บิล #${h.id} - ${formatDate(h.date)}</div>
                    <div class="item-title text-success">${formatCurrency(h.total_amount)}</div>
                    ${h.note ? `<div style="font-size: 0.85rem; color: #666; margin-top: 4px;">หมายเหตุ: ${h.note}</div>` : ''}
                </div>
                <div>
                    <button class="btn btn-outline btn-sm text-danger" style="padding: 2px 8px; font-size: 0.8rem;" onclick="deleteSaleHistory(${h.id})">🗑 ลบ</button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        list.innerHTML = '<p class="text-danger text-center">ไม่สามารถโหลดประวัติได้</p>';
    }
}

async function deleteSaleHistory(id) {
    if (!confirm('ยืนยันลบบิลนี้?\n(สินค้าจะถูกคืนกลับเข้าสต๊อกอัตโนมัติ)')) return;
    
    try {
        await API.Sales.delete(id);
        showToast('ลบประวัติการขายและคืนสต๊อกแล้ว');
        // รีเฟรชหน้า analytics ใหม่เพื่อให้ยอดรวมอัปเดต
        renderAnalytics(currentAnalyticsPeriod);
    } catch (error) {}
}
