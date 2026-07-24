// ============================================================
// pages/analytics.js — หน้าวิเคราะห์/สรุปยอด + ปฏิทินย้อนหลัง
// ============================================================

let currentAnalyticsPeriod = 'week';
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth() + 1; // 1-12

async function renderAnalytics(period = currentAnalyticsPeriod) {
    currentAnalyticsPeriod = period;
    const container = document.getElementById('analytics-content');
    container.innerHTML = '<div class="loading">กำลังโหลดข้อมูล...</div>';

    try {
        const [summary, topProducts, dailyData] = await Promise.all([
            API.Analytics.getSummary(period),
            API.Analytics.getTopProducts(period),
            API.Analytics.getDaily(7)
        ]);

        const periodTitle = period === 'today' ? 'วันนี้' : period === 'week' ? 'สัปดาห์นี้' : 'เดือนนี้';

        let html = `
            <!-- Tab switcher: สรุป / ปฏิทิน -->
            <div style="display:flex; gap:0; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid #E5E7EB; margin-bottom: 1rem;">
                <button id="tab-summary" onclick="showAnalyticsTab('summary')" style="flex:1; padding: 0.6rem; background:#fff; border:none; font-weight:600; cursor:pointer; color:var(--primary); border-bottom: 3px solid var(--primary);">
                    📊 สรุปยอด
                </button>
                <button id="tab-calendar" onclick="showAnalyticsTab('calendar')" style="flex:1; padding: 0.6rem; background:#F9FAFB; border:none; font-weight:600; cursor:pointer; color:var(--text-muted); border-bottom: 3px solid transparent;">
                    📅 ปฏิทินย้อนหลัง
                </button>
            </div>

            <!-- แท็บสรุปยอด -->
            <div id="analytics-tab-summary">
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

                <!-- ประวัติการขาย -->
                <div class="card mt-2">
                    <h3>📝 ประวัติการขายล่าสุด (100 บิล)</h3>
                    <div id="sales-history-list" class="item-list mt-2">
                        <div class="text-center text-muted">กำลังโหลดประวัติ...</div>
                    </div>
                </div>
            </div>

            <!-- แท็บปฏิทิน -->
            <div id="analytics-tab-calendar" style="display:none;">
                <div id="calendar-container"></div>
            </div>
        `;

        container.innerHTML = html;

        // วาดกราฟ
        setTimeout(() => { renderDailyChart('dailyChart', dailyData); }, 100);

        // โหลดประวัติการขาย
        loadSalesHistory();

    } catch (error) {
        container.innerHTML = `<div class="text-danger text-center">โหลดข้อมูลล้มเหลว: ${error.message}</div>`;
    }
}

// ------------------------------------------------------------------
// สลับแท็บ สรุป / ปฏิทิน
// ------------------------------------------------------------------
function showAnalyticsTab(tab) {
    const summaryDiv = document.getElementById('analytics-tab-summary');
    const calendarDiv = document.getElementById('analytics-tab-calendar');
    const btnSummary = document.getElementById('tab-summary');
    const btnCalendar = document.getElementById('tab-calendar');

    if (tab === 'summary') {
        summaryDiv.style.display = '';
        calendarDiv.style.display = 'none';
        btnSummary.style.cssText += 'background:#fff; color:var(--primary); border-bottom: 3px solid var(--primary);';
        btnCalendar.style.cssText += 'background:#F9FAFB; color:var(--text-muted); border-bottom: 3px solid transparent;';
    } else {
        summaryDiv.style.display = 'none';
        calendarDiv.style.display = '';
        btnCalendar.style.cssText += 'background:#fff; color:var(--primary); border-bottom: 3px solid var(--primary);';
        btnSummary.style.cssText += 'background:#F9FAFB; color:var(--text-muted); border-bottom: 3px solid transparent;';
        renderCalendar(calendarYear, calendarMonth);
    }
}

// ------------------------------------------------------------------
// วาดปฏิทิน
// ------------------------------------------------------------------
async function renderCalendar(year, month) {
    calendarYear = year;
    calendarMonth = month;
    const container = document.getElementById('calendar-container');
    container.innerHTML = '<div class="loading">กำลังโหลดปฏิทิน...</div>';

    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const today = new Date().toISOString().split('T')[0];

    try {
        const calData = await API.Analytics.getCalendar(year, month);

        // วันแรกของเดือนตกวันอะไร
        const firstDate = new Date(year, month - 1, 1);
        const startDow = firstDate.getDay(); // 0=อาทิตย์
        const daysInMonth = new Date(year, month, 0).getDate();

        let calHtml = `
            <div class="flex justify-between align-center mb-2">
                <button class="btn btn-sm btn-outline" onclick="renderCalendar(${month === 1 ? year - 1 : year}, ${month === 1 ? 12 : month - 1})">◀</button>
                <h3 style="margin:0;">${monthNames[month - 1]} ${year + 543}</h3>
                <button class="btn btn-sm btn-outline" onclick="renderCalendar(${month === 12 ? year + 1 : year}, ${month === 12 ? 1 : month + 1})">▶</button>
            </div>

            <!-- header วัน -->
            <div style="display:grid; grid-template-columns: repeat(7,1fr); gap:2px; margin-bottom:2px;">
                ${dayNames.map((d, i) => `
                    <div style="text-align:center; font-size:0.75rem; font-weight:600; padding:4px;
                        color:${i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : 'var(--text-muted)'}">
                        ${d}
                    </div>
                `).join('')}
            </div>

            <!-- ช่องวัน -->
            <div style="display:grid; grid-template-columns: repeat(7,1fr); gap:2px;">
        `;

        // เติมช่องว่างก่อนวันที่ 1
        for (let i = 0; i < startDow; i++) {
            calHtml += `<div style="min-height:64px;"></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const d = calData[dateStr] || {};
            const isToday = dateStr === today;
            const hasSales = d.total_sales > 0;
            const hasExp = d.total_expenses > 0;
            const dow = (startDow + day - 1) % 7;
            const isSun = dow === 0;
            const isSat = dow === 6;

            calHtml += `
                <div onclick="openDayDetail('${dateStr}')"
                    style="min-height:64px; border-radius:8px; padding:4px; cursor:pointer;
                           background: ${isToday ? '#EFF6FF' : (hasSales || hasExp ? '#fff' : '#F9FAFB')};
                           border: 2px solid ${isToday ? '#3b82f6' : '#E5E7EB'};
                           transition: box-shadow .15s;"
                    onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,.12)'"
                    onmouseout="this.style.boxShadow='none'">
                    <div style="font-size:0.8rem; font-weight:${isToday ? '700' : '500'};
                         color:${isSun ? '#ef4444' : isSat ? '#3b82f6' : isToday ? '#1d4ed8' : 'var(--text-muted)'}">
                        ${day}
                    </div>
                    ${hasSales ? `<div style="font-size:0.65rem; color:#16a34a; font-weight:600; line-height:1.2;">
                        +${formatCurrencyShort(d.total_sales)}</div>` : ''}
                    ${hasExp ? `<div style="font-size:0.65rem; color:#dc2626; font-weight:600; line-height:1.2;">
                        -${formatCurrencyShort(d.total_expenses)}</div>` : ''}
                    ${d.bill_count > 0 ? `<div style="font-size:0.6rem; color:#9ca3af;">${d.bill_count} บิล</div>` : ''}
                </div>
            `;
        }

        calHtml += `</div>

            <!-- คำอธิบาย legend -->
            <div class="flex gap-2 mt-2" style="font-size:0.75rem; justify-content:center; color:var(--text-muted);">
                <span style="color:#16a34a;">● รายรับ</span>
                <span style="color:#dc2626;">● รายจ่าย</span>
                <span style="color:#3b82f6;">⬜ วันนี้</span>
            </div>
        `;

        container.innerHTML = calHtml;

    } catch (err) {
        container.innerHTML = `<div class="text-danger">โหลดปฏิทินล้มเหลว: ${err.message}</div>`;
    }
}

// ------------------------------------------------------------------
// ฟอร์แมตตัวเงินแบบสั้น สำหรับในช่องปฏิทิน
// ------------------------------------------------------------------
function formatCurrencyShort(n) {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toFixed(0);
}

// ------------------------------------------------------------------
// เปิด Modal รายละเอียดประจำวัน
// ------------------------------------------------------------------
async function openDayDetail(dateStr) {
    // แปลง YYYY-MM-DD เป็นวันภาษาไทย
    const d = new Date(dateStr + 'T00:00:00');
    const thDay = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
    const thMonth = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const dateLabel = `วัน${thDay[d.getDay()]}ที่ ${d.getDate()} ${thMonth[d.getMonth()]} ${d.getFullYear() + 543}`;

    // เปิด modal เปล่าก่อน แสดง loading
    openModal(`
        ${getModalHeader(dateLabel)}
        <div class="loading">กำลังโหลดรายละเอียด...</div>
    `);

    try {
        const data = await API.Analytics.getDailyDetails(dateStr);
        const totalSales = data.sales.reduce((s, r) => s + parseFloat(r.total_amount), 0);
        const totalExp = data.expenses.reduce((s, r) => s + parseFloat(r.amount), 0);
        const profit = totalSales - totalExp;

        // สร้าง timeline: รวม sales + expenses แล้วเรียงตาม created_at
        const timeline = [
            ...data.sales.map(s => ({ ...s, _type: 'sale' })),
            ...data.expenses.map(e => ({ ...e, _type: 'expense' }))
        ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const formatTime = (ts) => {
            if (!ts) return '--:--';
            const t = new Date(ts);
            return t.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
        };

        let modalHtml = `${getModalHeader(dateLabel)}`;

        // Summary strip
        modalHtml += `
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:1rem;">
                <div style="background:#F0FDF4; border-radius:8px; padding:8px; text-align:center;">
                    <div style="font-size:0.7rem; color:#16a34a;">รายรับ</div>
                    <div style="font-weight:700; color:#16a34a;">${formatCurrency(totalSales)}</div>
                </div>
                <div style="background:#FEF2F2; border-radius:8px; padding:8px; text-align:center;">
                    <div style="font-size:0.7rem; color:#dc2626;">รายจ่าย</div>
                    <div style="font-weight:700; color:#dc2626;">${formatCurrency(totalExp)}</div>
                </div>
                <div style="background:${profit >= 0 ? '#F0FDF4' : '#FEF2F2'}; border-radius:8px; padding:8px; text-align:center;">
                    <div style="font-size:0.7rem; color:${profit >= 0 ? '#16a34a' : '#dc2626'};">กำไร</div>
                    <div style="font-weight:700; color:${profit >= 0 ? '#16a34a' : '#dc2626'};">${profit >= 0 ? '+' : ''}${formatCurrency(profit)}</div>
                </div>
            </div>
        `;

        // ปุ่มสรุปข้อมูล
        modalHtml += `
            <button onclick="showDailyInsights(${JSON.stringify(data).replace(/"/g,'&quot;')})"
                style="width:100%; padding:0.6rem; background: linear-gradient(135deg, #6366f1, #8b5cf6);
                       color:white; border:none; border-radius:8px; font-weight:600; cursor:pointer; margin-bottom:1rem; font-size:0.9rem;">
                📊 ดูสรุปช่วงเวลาขายดี & สินค้าฮิต
            </button>
        `;

        // ไทม์ไลน์
        if (timeline.length === 0) {
            modalHtml += `<p class="text-muted text-center">ไม่มีรายการในวันนี้</p>`;
        } else {
            modalHtml += `<div style="font-weight:600; margin-bottom:0.5rem; font-size:0.9rem;">📋 ไทม์ไลน์กิจกรรม</div>`;
            modalHtml += `<div style="position:relative; padding-left:20px;">`;

            timeline.forEach(item => {
                const isSale = item._type === 'sale';
                const time = formatTime(item.created_at);
                const color = isSale ? '#16a34a' : '#dc2626';
                const bg = isSale ? '#F0FDF4' : '#FEF2F2';
                const icon = isSale ? '🟢' : '🔴';
                const label = isSale ? `ขาย +${formatCurrency(item.total_amount)}` : `จ่าย -${formatCurrency(item.amount)}`;
                const detail = isSale
                    ? (item.items || []).filter(x => x.product_name).map(x => `${x.product_name} x${x.quantity}`).join(', ')
                    : `${item.category_emoji || ''} ${item.description}`;

                modalHtml += `
                    <div style="position:relative; margin-bottom:10px;">
                        <div style="position:absolute; left:-20px; top:4px; font-size:0.7rem;">${icon}</div>
                        <div style="background:${bg}; border-radius:8px; padding:8px 10px; border-left: 3px solid ${color};">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div style="font-size:0.75rem; color:var(--text-muted);">${time} น.</div>
                                <div style="font-weight:700; color:${color}; font-size:0.9rem;">${label}</div>
                            </div>
                            ${detail ? `<div style="font-size:0.8rem; color:#4b5563; margin-top:2px;">${detail}</div>` : ''}
                            ${item.note ? `<div style="font-size:0.75rem; color:#9ca3af;">หมายเหตุ: ${item.note}</div>` : ''}
                        </div>
                    </div>
                `;
            });
            modalHtml += `</div>`;
        }

        // Update modal content
        document.getElementById('modalContent').innerHTML = modalHtml;

    } catch (err) {
        document.getElementById('modalContent').innerHTML = `
            ${getModalHeader(dateLabel)}
            <div class="text-danger text-center">โหลดรายละเอียดล้มเหลว: ${err.message}</div>
        `;
    }
}

// ------------------------------------------------------------------
// แสดง Insights: Peak hours + Top items
// ------------------------------------------------------------------
function showDailyInsights(data) {
    const formatTime = (h) => `${String(parseInt(h)).padStart(2,'0')}:00 น.`;

    let html = `${getModalHeader('📊 สรุปข้อมูลยอดขาย')}`;

    // Peak hours
    if (data.peak_hours && data.peak_hours.length > 0) {
        const topHour = data.peak_hours[0];
        html += `
            <div class="card" style="margin-bottom:1rem; background: linear-gradient(135deg, #f0fdf4, #dcfce7); border-color: #86efac;">
                <div style="font-weight:700; font-size:1rem; margin-bottom:0.5rem;">⏰ ช่วงเวลาทอง</div>
                <div style="font-size:1.2rem; font-weight:700; color:#16a34a;">${formatTime(topHour.hour)}</div>
                <div style="font-size:0.85rem; color:#4b5563;">ขายได้สูงสุด ${parseInt(topHour.bill_count)} บิล รวม ${formatCurrency(parseFloat(topHour.total))}</div>
            </div>
        `;

        if (data.peak_hours.length > 1) {
            html += `<div style="font-weight:600; margin-bottom:0.5rem; font-size:0.85rem;">🕐 ยอดขายแยกช่วงเวลา</div>`;
            html += `<div style="display:flex; flex-direction:column; gap:6px; margin-bottom:1rem;">`;
            data.peak_hours.forEach(h => {
                const maxTotal = parseFloat(data.peak_hours[0].total);
                const pct = maxTotal > 0 ? (parseFloat(h.total) / maxTotal * 100) : 0;
                html += `
                    <div>
                        <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:2px;">
                            <span>${formatTime(h.hour)}</span>
                            <span style="color:#16a34a; font-weight:600;">${formatCurrency(parseFloat(h.total))}</span>
                        </div>
                        <div style="height:8px; background:#E5E7EB; border-radius:4px; overflow:hidden;">
                            <div style="height:100%; width:${pct}%; background: linear-gradient(90deg,#16a34a,#4ade80); border-radius:4px; transition:width .3s;"></div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
    } else {
        html += `<p class="text-muted text-center">ไม่มีข้อมูลช่วงเวลา</p>`;
    }

    // Top items
    if (data.top_items && data.top_items.length > 0) {
        html += `<div style="font-weight:600; margin-bottom:0.5rem; font-size:0.85rem;">🏆 สินค้าขายดีวันนี้</div>`;
        html += `<div class="item-list">`;
        data.top_items.forEach((item, i) => {
            const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
            html += `
                <div class="item-card">
                    <div class="item-info">
                        <div style="font-size:1.2rem;">${medals[i] || (i+1)}</div>
                        <div>
                            <div class="item-title">${item.product_name}</div>
                            <div class="item-subtitle">ขายได้ ${parseInt(item.total_qty)} ชิ้น</div>
                        </div>
                    </div>
                    <div class="item-price text-success">${formatCurrency(parseFloat(item.total_revenue))}</div>
                </div>
            `;
        });
        html += `</div>`;
    }

    document.getElementById('modalContent').innerHTML = html;
}

// ------------------------------------------------------------------
// โหลดประวัติการขาย (ใช้ในแท็บสรุป)
// ------------------------------------------------------------------
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
        renderAnalytics(currentAnalyticsPeriod);
    } catch (error) {}
}
