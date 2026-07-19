// ============================================================
// pages/debts.js — หน้าลูกหนี้ (ระบบทวงหนี้)
// ============================================================

let allCustomers = [];

async function renderDebts() {
    const container = document.getElementById('debts-content');
    container.innerHTML = '<div class="loading">กำลังโหลด...</div>';

    try {
        const [summary, debts, lineStatus] = await Promise.all([
            API.Debts.getSummary(),
            API.Debts.getAll('pending'), // โหลดเฉพาะที่ยังค้างจ่าย
            API.Line.getStatus()
        ]);
        
        // โหลดรายชื่อลูกค้าเตรียมไว้สำหรับตอนเพิ่มหนี้
        allCustomers = await API.Customers.getAll();
        
        let html = `
            ${!lineStatus.configured ? `
                <div style="background: var(--warning); color: white; padding: 1rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.9rem;">
                    ⚠️ ยังไม่ได้ตั้งค่า LINE OA ระบบจะไม่สามารถส่งข้อความทวงหนี้ได้ (ไปดูวิธีตั้งค่าในคู่มือ)
                </div>
            ` : ''}
            
            <div class="summary-grid">
                <div class="summary-box primary">
                    <span class="summary-label">ยอดค้างชำระทั้งหมด</span>
                    <div class="summary-value">${formatCurrency(summary.pending_total)}</div>
                </div>
                <div class="summary-box" style="background: var(--danger-light); color: var(--danger); border: none;">
                    <span class="summary-label">จำนวนลูกหนี้ค้าง</span>
                    <div class="summary-value">${summary.pending_count} คน</div>
                </div>
            </div>
            
            <div class="flex justify-between align-center mb-2 mt-2">
                <h2>💳 รายการลูกหนี้</h2>
                <button class="btn btn-primary btn-sm" onclick="showAddDebtModal()">+ ลงบัญชีหนี้</button>
            </div>
            
            <div class="item-list">
                ${debts.length === 0 ? '<p class="text-center text-muted">ไม่มีหนี้ค้างชำระ เยี่ยมมาก! 🎉</p>' : ''}
                
                ${debts.map(d => {
                    const remaining = d.amount - d.paid_amount;
                    return `
                        <div class="card" style="margin-bottom: 0;">
                            <div class="flex justify-between align-center mb-1">
                                <div class="flex align-center gap-2">
                                    ${d.picture_url 
                                        ? `<img src="${d.picture_url}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` 
                                        : `<div class="item-emoji">👤</div>`}
                                    <div>
                                        <div class="item-title">${d.display_name}</div>
                                        <div class="item-subtitle">
                                            ${d.is_line_friend ? '<span style="color: #00B900;">🟢 ผูก LINE แล้ว</span>' : '⚪️ ยังไม่มี LINE'}
                                        </div>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="item-price text-danger">ค้าง ${formatCurrency(remaining)}</div>
                                    <div class="item-subtitle">จากทั้งหมด ${formatCurrency(d.amount)}</div>
                                </div>
                            </div>
                            
                            <div style="background: var(--bg-base); padding: 0.5rem; border-radius: 4px; font-size: 0.85rem; margin-bottom: 1rem;">
                                <strong>รายการ:</strong> ${d.items_description || '-'}<br>
                                <strong>ครบกำหนด:</strong> ${formatDate(d.due_date)}
                            </div>
                            
                            <div class="flex gap-2">
                                <button class="btn btn-outline" style="flex: 1;" onclick="showPayDebtModal(${d.id}, ${remaining})">รับเงินคืน</button>
                                <button class="btn btn-primary" style="flex: 1; background: #00B900;" 
                                    onclick="sendLineReminder(${d.id})" 
                                    ${!d.is_line_friend || !lineStatus.configured ? 'disabled' : ''}>
                                    💬 ทวงผ่าน LINE
                                </button>
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

// ------------------------------------------------------------------
// ลงบัญชีหนี้ใหม่
// ------------------------------------------------------------------
function showAddDebtModal() {
    if (allCustomers.length === 0) {
        alert('กรุณาเพิ่มข้อมูลลูกค้าในเมนู "ตั้งค่า" ก่อนครับ');
        return;
    }
    
    // ตั้งค่าวันครบกำหนดเริ่มต้นเป็น 2 วันข้างหน้า
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 2);
    const dueDateStr = defaultDue.toISOString().split('T')[0];

    const customerOptions = allCustomers.map(c => 
        `<option value="${c.id}">${c.display_name} ${c.is_line_friend ? '(ผูก LINE แล้ว)' : ''}</option>`
    ).join('');

    const html = `
        ${getModalHeader('ลงบัญชีลูกหนี้')}
        <form id="formAddDebt" onsubmit="submitDebt(event)">
            <div class="form-group">
                <label class="form-label">ลูกค้า</label>
                ${renderCustomCustomerSelect(allCustomers, 'customer_id')}
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                    * ลูกค้าจะแอดเพิ่มได้อัตโนมัติเมื่อเขากดเพิ่มเพื่อน LINE OA ของคุณ
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">ยอดเงินที่ค้าง (บาท)</label>
                <input type="number" name="amount" class="form-control" required min="1">
            </div>
            <div class="form-group">
                <label class="form-label">รายการที่ซื้อ (บันทึกกันลืม)</label>
                <input type="text" name="items_description" class="form-control" placeholder="เช่น คุกกี้ 2 ชิ้น, น้ำ 1 ขวด">
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label class="form-label">วันครบกำหนดจ่าย</label>
                    <input type="date" name="due_date" class="form-control" value="${dueDateStr}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">เวลาที่ทวง</label>
                    <input type="time" name="remind_time" class="form-control" value="10:00" required>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">ความถี่ในการทวงถามอัตโนมัติ</label>
                <select name="remind_frequency" class="form-control">
                    <option value="1">ทุก 1 วัน</option>
                    <option value="2">ทุก 2 วัน</option>
                    <option value="3">ทุก 3 วัน</option>
                    <option value="7">ทุก 7 วัน</option>
                    <option value="0">ไม่ต้องทวงอัตโนมัติ</option>
                </select>
            </div>
            
            <div class="form-group text-center">
                <label class="form-label">ถ่ายรูปหลักฐาน (ส่งพร้อมไลน์ทวงหนี้)</label>
                <input type="hidden" name="evidence_image_url" id="debt_evidence_image_url">
                <input type="file" id="debt_evidence_input" accept="image/*" capture="environment" style="display: none;" onchange="uploadEvidenceImage(this, 'debt_evidence_preview', 'debt_evidence_image_url')">
                <button type="button" class="btn btn-outline" style="width: 100%;" onclick="document.getElementById('debt_evidence_input').click()">📸 ถ่ายรูปหลักฐาน / เลือกรูป</button>
                <img id="debt_evidence_preview" src="" style="display: none; width: 100%; max-height: 200px; object-fit: contain; margin-top: 10px; border-radius: 8px; border: 1px solid var(--border);">
            </div>
            
            <button type="submit" class="btn btn-primary" style="margin-top: 1rem;">บันทึกลูกหนี้</button>
        </form>
    `;
    openModal(html);
}

async function submitDebt(event) {
    event.preventDefault();
    const form = event.target;
    const btn = form.querySelector('button[type="submit"]');
    
    // ดึงค่า customer_id จาก input hidden 
    const customer_id = form.customer_id.value;
    if (!customer_id) {
        alert('กรุณาเลือกลูกค้า');
        return;
    }
    
    const data = {
        customer_id: customer_id,
        amount: parseFloat(form.amount.value),
        items_description: form.items_description.value,
        due_date: form.due_date.value,
        remind_time: form.remind_time.value,
        remind_frequency: parseInt(form.remind_frequency.value),
        auto_remind: form.remind_frequency.value !== "0" ? 1 : 0,
        evidence_image_url: form.evidence_image_url?.value || ''
    };
    
    btn.disabled = true;
    btn.textContent = 'กำลังบันทึก...';
    
    try {
        await API.Debts.create(data);
        showToast('บันทึกลูกหนี้เรียบร้อย!');
        closeModal();
        renderDebts();
    } catch (error) {
        btn.disabled = false;
        btn.textContent = 'บันทึกลูกหนี้';
    }
}

// ------------------------------------------------------------------
// ทวงหนี้ผ่าน LINE
// ------------------------------------------------------------------
async function sendLineReminder(debtId) {
    if (!confirm('ยืนยันส่งข้อความทวงหนี้ผ่าน LINE?')) return;
    
    try {
        await API.Line.sendReminder(debtId);
        showToast('ส่ง LINE ทวงหนี้เรียบร้อยแล้ว!');
    } catch (error) {
        // error msg จัดการโดย API helper แล้ว
    }
}

// ------------------------------------------------------------------
// ชำระหนี้ (รับเงินคืน)
// ------------------------------------------------------------------
function showPayDebtModal(id, remainingAmount) {
    const html = `
        ${getModalHeader('รับชำระเงินคืน')}
        <form id="formPayDebt" onsubmit="submitPayDebt(event, ${id})">
            <div style="text-align: center; margin-bottom: 1rem;">
                <p class="text-muted">ยอดค้างชำระทั้งหมด</p>
                <h2 class="text-danger">฿${remainingAmount}</h2>
            </div>
            <div class="form-group">
                <label class="form-label">จำนวนเงินที่ได้รับ (บาท)</label>
                <input type="number" name="pay_amount" class="form-control" required min="1" max="${remainingAmount}" value="${remainingAmount}">
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px;">* หากจ่ายไม่ครบให้ใส่ยอดที่ได้รับจริง</p>
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top: 1rem; background: var(--secondary);">✅ ยืนยันรับเงิน</button>
        </form>
    `;
    openModal(html);
}

async function submitPayDebt(event, debtId) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');
    const payAmount = parseFloat(event.target.pay_amount.value);
    
    btn.disabled = true;
    
    try {
        const res = await API.Debts.pay(debtId, payAmount);
        showToast(res.message);
        closeModal();
        renderDebts();
    } catch (error) {
        btn.disabled = false;
    }
}
