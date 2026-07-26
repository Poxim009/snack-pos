// ============================================================
// pages/personal.js — หน้าบัญชีรายรับ-รายจ่ายส่วนตัว
// ============================================================

let personalCategories = [];
let selectedPersonalMonth = ''; // รูปแบบ YYYY-MM

async function renderPersonal() {
    const container = document.getElementById('personal-content');
    if (!container) return;
    container.innerHTML = '<div class="loading">กำลังโหลด...</div>';

    if (!selectedPersonalMonth) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        selectedPersonalMonth = `${yyyy}-${mm}`;
    }

    try {
        const [categories, summary, transactions] = await Promise.all([
            API.Personal.getCategories(),
            API.Personal.getSummary(selectedPersonalMonth),
            API.Personal.getTransactions(selectedPersonalMonth)
        ]);

        personalCategories = categories;

        const expenseCats = categories.filter(c => c.type === 'expense');
        const incomeCats = categories.filter(c => c.type === 'income');

        let html = `
            <div class="flex justify-between align-center mb-2">
                <h2>👛 บัญชีส่วนตัว</h2>
                <input type="month" id="personal-month-picker" class="form-control" style="width: auto; padding: 4px 8px;" value="${selectedPersonalMonth}" onchange="changePersonalMonth(this.value)">
            </div>

            <!-- สรุปยอดเงินส่วนตัว -->
            <div class="summary-grid mb-3">
                <div class="summary-box" style="background: rgba(16, 185, 129, 0.1); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.2);">
                    <span class="summary-label" style="color: #047857;">รายรับส่วนตัว</span>
                    <div class="summary-value">+${formatCurrency(summary.total_income)}</div>
                </div>
                <div class="summary-box" style="background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.2);">
                    <span class="summary-label" style="color: #B91C1C;">รายจ่ายส่วนตัว</span>
                    <div class="summary-value">-${formatCurrency(summary.total_expense)}</div>
                </div>
                <div class="summary-box" style="background: linear-gradient(135deg, #6366F1, #8B5CF6); color: white; border: none; grid-column: span 2;">
                    <span class="summary-label" style="color: rgba(255,255,255,0.85);">เงินคงเหลือส่วนตัว</span>
                    <div class="summary-value" style="font-size: 1.8rem;">${formatCurrency(summary.balance)}</div>
                </div>
            </div>

            <!-- ปุ่มกดบันทึกด่วนด้วย EMOJI GRID -->
            <div class="card mb-3" style="background: var(--bg-card); border-radius: 12px; padding: 1rem;">
                <h3 class="mb-2" style="font-size: 1rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                    ⚡ บันทึกรายจ่ายส่วนตัวด่วน (กดแล้วใส่เงินได้เลย)
                </h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px;">
                    ${expenseCats.map(c => `
                        <button type="button" onclick="openQuickAddPersonalModal(${c.id})" style="
                            display: flex; flex-direction: column; align-items: center; justify-content: center;
                            padding: 12px 8px; background: rgba(239, 68, 68, 0.05); border: 1.5px solid rgba(239, 68, 68, 0.2);
                            border-radius: 12px; cursor: pointer; transition: all 0.2s ease; outline: none;
                        " onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">
                            <span style="font-size: 1.8rem; margin-bottom: 4px;">${c.emoji}</span>
                            <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-main); text-align: center; line-height: 1.2;">${c.name}</span>
                        </button>
                    `).join('')}
                </div>

                <h3 class="mt-3 mb-2" style="font-size: 1rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                    💵 บันทึกรายรับส่วนตัว
                </h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px;">
                    ${incomeCats.map(c => `
                        <button type="button" onclick="openQuickAddPersonalModal(${c.id})" style="
                            display: flex; flex-direction: column; align-items: center; justify-content: center;
                            padding: 12px 8px; background: rgba(16, 185, 129, 0.05); border: 1.5px solid rgba(16, 185, 129, 0.2);
                            border-radius: 12px; cursor: pointer; transition: all 0.2s ease; outline: none;
                        " onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">
                            <span style="font-size: 1.8rem; margin-bottom: 4px;">${c.emoji}</span>
                            <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-main); text-align: center; line-height: 1.2;">${c.name}</span>
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- รายการประวัติส่วนตัว -->
            <div class="flex justify-between align-center mb-2">
                <h3>📜 ประวัติส่วนตัว</h3>
                <span class="text-muted" style="font-size: 0.85rem;">${transactions.length} รายการ</span>
            </div>

            <div class="item-list">
                ${transactions.length === 0 ? '<p class="text-center text-muted py-3">ยังไม่มีรายการส่วนตัวในเดือนนี้</p>' : ''}
                ${transactions.map(t => {
                    const isIncome = t.type === 'income';
                    return `
                        <div class="item-card" style="padding: 12px 14px;">
                            <div class="item-info">
                                <div class="item-emoji" style="background: ${isIncome ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; font-size: 1.4rem; padding: 8px; border-radius: 10px;">
                                    ${t.category_emoji || (isIncome ? '💰' : '💸')}
                                </div>
                                <div>
                                    <div class="item-title" style="font-weight: 600;">${t.category_name || t.description || 'รายการส่วนตัว'}</div>
                                    <div class="item-subtitle">${formatDate(t.date)} ${t.description ? '• ' + t.description : ''}</div>
                                </div>
                            </div>
                            <div class="text-right flex align-center gap-2">
                                <div>
                                    <div class="item-price" style="font-weight: 700; color: ${isIncome ? '#10B981' : '#EF4444'};">
                                        ${isIncome ? '+' : '-'}${formatCurrency(t.amount)}
                                    </div>
                                </div>
                                <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 6px; color: #888; border-color: transparent;" onclick="deletePersonalTx(${t.id})" title="ลบรายการ">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<div class="text-danger text-center">โหลดข้อมูลล้มเหลว: ${error.message}</div>`;
    }
}

function changePersonalMonth(val) {
    selectedPersonalMonth = val;
    renderPersonal();
}

function openQuickAddPersonalModal(catId) {
    const cat = personalCategories.find(c => c.id === catId);
    if (!cat) return;

    const isIncome = cat.type === 'income';

    const html = `
        ${getModalHeader(`${cat.emoji} ${cat.name}`)}
        <form id="formQuickPersonal" onsubmit="submitPersonalTx(event)">
            <input type="hidden" name="category_id" value="${cat.id}">
            <input type="hidden" name="type" value="${cat.type}">
            
            <div class="form-group text-center">
                <label class="form-label" style="font-size: 0.9rem; color: var(--text-muted);">จำนวนเงิน (${isIncome ? 'รายรับ' : 'รายจ่าย'})</label>
                <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                    <span style="font-size: 1.8rem; font-weight: bold; color: ${isIncome ? '#10B981' : '#EF4444'};">฿</span>
                    <input type="number" name="amount" id="personal-amount-input" class="form-control text-center" 
                        style="font-size: 2rem; font-weight: bold; height: 60px; color: ${isIncome ? '#10B981' : '#EF4444'}; border-color: ${isIncome ? '#10B981' : '#EF4444'};" 
                        required min="0.5" step="0.5" placeholder="0" autofocus>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">หมายเหตุเพิ่มเติม (ถ้ามี)</label>
                <input type="text" name="description" class="form-control" placeholder="เช่น ก๋วยเตี๋ยว / ค่ารถเมล์">
            </div>

            <div class="form-group">
                <label class="form-label">วันที่</label>
                <input type="date" name="date" class="form-control" value="${getTodayString()}" required>
            </div>

            <button type="submit" class="btn" style="
                width: 100%; padding: 12px; font-size: 1.1rem; font-weight: bold; margin-top: 1rem;
                background: ${isIncome ? '#10B981' : '#EF4444'}; color: white; border: none; border-radius: 8px;
            ">
                ✅ บันทึก ${cat.name}
            </button>
        </form>
    `;

    openModal(html);
    setTimeout(() => {
        const input = document.getElementById('personal-amount-input');
        if (input) input.focus();
    }, 100);
}

async function submitPersonalTx(event) {
    event.preventDefault();
    const form = event.target;
    const btn = form.querySelector('button[type="submit"]');

    const data = {
        category_id: parseInt(form.category_id.value),
        type: form.type.value,
        amount: parseFloat(form.amount.value),
        description: form.description.value,
        date: form.date.value
    };

    btn.disabled = true;
    btn.textContent = 'กำลังบันทึก...';

    try {
        await API.Personal.createTransaction(data);
        showToast('บันทึกเรียบร้อย!');
        closeModal();
        renderPersonal();
    } catch (error) {
        btn.disabled = false;
        btn.textContent = 'บันทึก';
    }
}

async function deletePersonalTx(id) {
    if (!confirm('ยืนยันลบรายการนี้?')) return;

    try {
        await API.Personal.deleteTransaction(id);
        showToast('ลบรายการเรียบร้อย');
        renderPersonal();
    } catch (error) {
        // error handling inside fetchAPI
    }
}
