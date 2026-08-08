// ============================================================
// pages/debts.js — หน้าลูกหนี้ (ระบบทวงหนี้)
// ============================================================

let debtsCustomers = [];
let allDebtsData = []; // เพิ่มตัวแปรเก็บหนี้ทั้งหมดเพื่อใช้ตอนเปิด Modal ชำระเงิน

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
        debtsCustomers = await API.Customers.getAll();
        allDebtsData = debts; // เก็บหนี้ทั้งหมดลง global
        
        // จัดกลุ่มหนี้ตามลูกค้า
        const customerDebts = {};
        debts.forEach(d => {
            if (!customerDebts[d.customer_id]) {
                customerDebts[d.customer_id] = {
                    customer_id: d.customer_id,
                    display_name: d.display_name,
                    picture_url: d.picture_url,
                    is_line_friend: d.is_line_friend,
                    total_remaining: 0,
                    bills: []
                };
            }
            const remaining = d.amount - d.paid_amount;
            customerDebts[d.customer_id].total_remaining += remaining;
            customerDebts[d.customer_id].bills.push({ ...d, remaining });
        });
        
        const groupedDebts = Object.values(customerDebts);
        
        let html = `
            ${!lineStatus.configured ? `
                <div style="background: var(--warning); color: white; padding: 1rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.9rem;">
                    ⚠️ ยังไม่ได้ตั้งค่า LINE OA ระบบจะไม่สามารถส่งข้อความทวงหนี้ได้
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
                ${groupedDebts.length === 0 ? '<p class="text-center text-muted">ไม่มีหนี้ค้างชำระ เยี่ยมมาก! 🎉</p>' : ''}
                
                ${groupedDebts.map(c => `
                    <div class="card" style="margin-bottom: 0;">
                        <!-- ส่วนหัวของลูกค้า -->
                        <div class="flex justify-between align-center mb-1">
                            <div class="flex align-center gap-2">
                                ${c.picture_url 
                                    ? `<img src="${c.picture_url}" style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover; border: 2px solid #E5E7EB;">` 
                                    : `<div class="item-emoji" style="width: 45px; height: 45px; font-size: 1.5rem; display: flex; align-items: center; justify-content: center;">👤</div>`}
                                <div>
                                    <div class="item-title" style="font-size: 1.1rem;">${c.display_name}</div>
                                    <div class="item-subtitle">
                                        ${c.is_line_friend ? '<span style="color: #00B900;">🟢 ผูก LINE แล้ว</span>' : '⚪️ ยังไม่มี LINE'}
                                        • ค้าง ${c.bills.length} บิล
                                    </div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div style="font-size: 0.8rem; color: var(--text-muted);">รวมยอดค้าง</div>
                                <div class="text-danger" style="font-size: 1.3rem; font-weight: bold;">${formatCurrency(c.total_remaining)}</div>
                            </div>
                        </div>
                        
                        <!-- รายการบิลของคนนี้ -->
                        <div style="background: #F9FAFB; padding: 0.75rem; border-radius: 8px; margin: 10px 0;">
                            ${c.bills.map((b, idx) => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: ${idx < c.bills.length - 1 ? '1px solid #E5E7EB' : 'none'};">
                                    <div style="flex: 1;">
                                        <div style="font-size: 0.85rem; font-weight: 600;">บิล ${idx+1}: ${b.items_description || 'ไม่มีรายละเอียด'}</div>
                                        <div style="font-size: 0.75rem; color: #666;">ค้าง ${formatCurrency(b.remaining)} (จาก ${formatCurrency(b.amount)})</div>
                                    </div>
                                    <div style="display: flex; gap: 4px;">
                                        <button class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 0.75rem; color: var(--danger); border-color: transparent;" onclick="deleteDebt(${b.id})" title="ลบบิลนี้">🗑️</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <!-- ปุ่มดำเนินการ (ชำระเงิน / ทวงหนี้) -->
                        <div class="flex gap-2 mt-2">
                            <button class="btn btn-outline" style="flex: 1; font-weight: 600;" 
                                onclick="showCustomerPayModal(${c.customer_id})">
                                💰 รับชำระเงิน
                            </button>
                            <button class="btn btn-primary" style="flex: 1; background: #00B900; font-size: 0.95rem; font-weight: 600;" 
                                onclick="sendCustomerReminder(${c.customer_id})" 
                                ${!c.is_line_friend || !lineStatus.configured ? 'disabled' : ''}>
                                💬 ทวงผ่าน LINE
                            </button>
                        </div>
                    </div>
                `).join('')}
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
    if (debtsCustomers.length === 0) {
        alert('กรุณาเพิ่มข้อมูลลูกค้าในเมนู "ตั้งค่า" ก่อนครับ');
        return;
    }
    
    // ตั้งค่า default ของ date และ time
    const defaultDate = new Date();
    const dueDateStr = defaultDate.toISOString().split('T')[0];
    
    const html = `
        ${getModalHeader('เพิ่มลูกหนี้')}
        <form id="formAddDebt" onsubmit="submitDebt(event)">
            <div class="form-group">
                <label class="form-label">ลูกค้า</label>
                ${renderCustomCustomerSelect(debtsCustomers, 'customer_id')}
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
        const res = await API.Debts.create(data);
        showToast('บันทึกลูกหนี้เรียบร้อย!');
        
        // ส่งข้อความ LINE ทันที
        if (res && res.id) {
            API.Line.notifyNewDebt(res.id).catch(e => console.error("Line notification failed:", e));
        }
        
        closeModal();
        renderDebts();
    } catch (error) {
        btn.disabled = false;
        btn.textContent = 'บันทึกลูกหนี้';
    }
}

// ------------------------------------------------------------------
// ทวงหนี้ยอดรวมผ่าน LINE
// ------------------------------------------------------------------
async function sendCustomerReminder(customerId) {
    if (!confirm('ยืนยันส่งข้อความสรุปยอดทวงหนี้ผ่าน LINE?')) return;
    
    try {
        await API.Line.sendCustomerReminder(customerId);
        showToast('ส่ง LINE ทวงหนี้รวมเรียบร้อยแล้ว!');
    } catch (error) {
        // error msg จัดการโดย API helper แล้ว
    }
}

// ------------------------------------------------------------------
// ชำระหนี้ (รับเงินคืน) รูปแบบใหม่ (เลือกลายบิล + สร้าง QR)
// ------------------------------------------------------------------
function showCustomerPayModal(customerId) {
    const customerDebts = allDebtsData.filter(d => d.customer_id === customerId);
    if (customerDebts.length === 0) return;
    
    const customerName = customerDebts[0].display_name;
    let billsHtml = '';
    let totalRemaining = 0;
    
    customerDebts.forEach((b, idx) => {
        const remaining = b.amount - b.paid_amount;
        totalRemaining += remaining;
        billsHtml += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border);">
                <div style="display: flex; align-items: flex-start; gap: 10px;">
                    <input type="checkbox" class="debt-bill-checkbox" data-id="${b.id}" data-amount="${remaining}" onchange="updateCustomerPayQR()" checked style="width: 22px; height: 22px; margin-top: 2px;">
                    <div>
                        <div style="font-size: 0.95rem; font-weight: 600;">บิล ${idx+1}: ${b.items_description || 'ไม่มีรายละเอียด'}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">คงเหลือ ฿${remaining}</div>
                    </div>
                </div>
                <div style="font-weight: bold; color: var(--danger); font-size: 1.1rem;">฿${remaining}</div>
            </div>
        `;
    });

    const html = `
        ${getModalHeader('💰 รับชำระเงิน')}
        <form id="formCustomerPay" onsubmit="submitCustomerPay(event, ${customerId})">
            <div style="text-align: center; margin-bottom: 1rem;">
                <p class="text-muted">ลูกค้า: <strong>${customerName}</strong></p>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; padding: 0 5px;">
                <span style="font-weight: 600; font-size: 0.95rem;">เลือกบิลที่ต้องการจ่าย</span>
                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 0.9rem; font-weight: bold;">
                    <input type="checkbox" id="selectAllDebts" checked onchange="toggleAllDebts(this)" style="width: 18px; height: 18px;">
                    เลือกทั้งหมด
                </label>
            </div>
            
            <div style="background: #F9FAFB; padding: 10px; border-radius: 8px; max-height: 220px; overflow-y: auto; margin-bottom: 1rem; border: 1px solid var(--border);">
                ${billsHtml}
            </div>
            
            <div style="text-align: center; margin-bottom: 1rem;">
                <div style="font-size: 1rem; color: var(--text-muted);">ยอดที่ต้องชำระ (ตามบิลที่เลือก)</div>
                <h2 class="text-danger" id="customerPayTotal" style="font-size: 2.2rem; margin: 5px 0;">฿${totalRemaining}</h2>
            </div>
            
            <div id="customerPayQRContainer" style="display: none; text-align: center; margin-bottom: 1rem;">
                <img id="customerPayQRImg" src="" style="width: 200px; height: 200px; border-radius: 12px; border: 2px solid var(--primary); padding: 5px; background: white;">
                <p class="text-muted mt-1 text-sm">ให้ลูกค้าสแกนเพื่อโอนเงินผ่าน PromptPay</p>
            </div>
            
            <button type="submit" class="btn btn-primary" id="btnCustomerPaySubmit" style="width: 100%; font-size: 1.1rem; padding: 12px; background: var(--secondary); border: none;">✅ ยืนยันว่าได้รับเงินแล้ว</button>
        </form>
    `;
    
    openModal(html);
    updateCustomerPayQR(); // เรียกครั้งแรกเพื่อให้โชว์ QR ทันที
}

function toggleAllDebts(checkbox) {
    const checkboxes = document.querySelectorAll('.debt-bill-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
    updateCustomerPayQR();
}

function updateCustomerPayQR() {
    const checkboxes = document.querySelectorAll('.debt-bill-checkbox');
    let total = 0;
    checkboxes.forEach(cb => {
        if (cb.checked) {
            total += parseFloat(cb.getAttribute('data-amount')) || 0;
        }
    });
    
    document.getElementById('customerPayTotal').textContent = '฿' + total;
    
    const qrContainer = document.getElementById('customerPayQRContainer');
    const btnSubmit = document.getElementById('btnCustomerPaySubmit');
    const promptpayId = localStorage.getItem('promptpay_id');
    
    if (total > 0) {
        btnSubmit.disabled = false;
        if (promptpayId) {
            document.getElementById('customerPayQRImg').src = `https://promptpay.io/${promptpayId}/${total}.png`;
            qrContainer.style.display = 'block';
        } else {
            qrContainer.style.display = 'none';
        }
    } else {
        btnSubmit.disabled = true;
        qrContainer.style.display = 'none';
    }
}

async function submitCustomerPay(event, customerId) {
    event.preventDefault();
    const btn = document.getElementById('btnCustomerPaySubmit');
    const checkboxes = document.querySelectorAll('.debt-bill-checkbox:checked');
    
    if (checkboxes.length === 0) {
        alert('กรุณาเลือกบิลอย่างน้อย 1 รายการ');
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'กำลังบันทึก...';
    
    try {
        const promises = Array.from(checkboxes).map(cb => {
            const billId = cb.getAttribute('data-id');
            const amount = parseFloat(cb.getAttribute('data-amount'));
            return API.Debts.pay(billId, amount);
        });
        
        await Promise.all(promises);
        
        showToast('รับชำระเงินเรียบร้อยแล้ว!');
        closeModal();
        renderDebts();
    } catch (error) {
        btn.disabled = false;
        btn.textContent = '✅ ยืนยันว่าได้รับเงินแล้ว';
    }
}

// ------------------------------------------------------------------
// ลบรายการหนี้ที่ลงผิด
// ------------------------------------------------------------------
async function deleteDebt(debtId) {
    if (!confirm('🗑️ คุณแน่ใจหรือไม่ว่าต้องการ "ลบรายการหนี้นี้"?\n(หากเป็นการลงผิด ระบบจะลบรายการทิ้ง และคืนสต๊อกสินค้าให้ตามเดิม)')) return;
    
    try {
        const res = await fetch(`/api/debts/${debtId}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'ลบข้อมูลล้มเหลว');
        
        showToast('ลบรายการหนี้ และคืนสต๊อกเรียบร้อยแล้ว!');
        renderDebts();
    } catch (error) {
        alert('เกิดข้อผิดพลาด: ' + error.message);
    }
}
