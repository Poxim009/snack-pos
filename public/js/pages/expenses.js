// ============================================================
// pages/expenses.js — หน้ารายจ่าย
// ============================================================

let expenseCategories = [];

async function renderExpenses() {
    const container = document.getElementById('expenses-content');
    container.innerHTML = '<div class="loading">กำลังโหลด...</div>';

    try {
        expenseCategories = await API.Expenses.getCategories();
        const expenses = await API.Expenses.getAll();
        
        let html = `
            <div class="flex justify-between align-center mb-2">
                <h2>💸 ประวัติรายจ่าย</h2>
                <button class="btn btn-primary btn-sm" onclick="showAddExpenseModal()">+ เพิ่มรายจ่าย</button>
            </div>
            
            <div class="item-list">
                ${expenses.length === 0 ? '<p class="text-center text-muted">ยังไม่มีบันทึกรายจ่าย</p>' : ''}
                ${expenses.map(e => `
                    <div class="item-card">
                        <div class="item-info">
                            <div class="item-emoji">${e.category_emoji || '💸'}</div>
                            <div>
                                <div class="item-title">${e.description}</div>
                                <div class="item-subtitle">${formatDate(e.date)} • ${e.category_name || 'ไม่มีหมวดหมู่'}</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="item-price text-danger">- ${formatCurrency(e.amount)}</div>
                            ${e.image_path ? `<a href="${e.image_path}" target="_blank" style="font-size: 0.75rem;">🖼️ ดูใบเสร็จ</a>` : ''}
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

function showAddExpenseModal() {
    const catOptions = expenseCategories.map(c => 
        `<option value="${c.id}">${c.emoji} ${c.name}</option>`
    ).join('');

    const html = `
        ${getModalHeader('💸 เพิ่มรายจ่าย')}
        <form id="formAddExpense" onsubmit="submitExpense(event)">
            <div class="form-group">
                <label class="form-label">หมวดหมู่</label>
                <select name="category_id" class="form-control" required>
                    ${catOptions}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">รายละเอียด (ซื้ออะไร?)</label>
                <input type="text" name="description" class="form-control" required placeholder="เช่น ซื้อแป้งสาลี">
            </div>
            <div class="form-group">
                <label class="form-label">จำนวนเงิน (บาท)</label>
                <input type="number" name="amount" class="form-control" required min="1" step="0.5">
            </div>
            <div class="form-group">
                <label class="form-label">แนบใบเสร็จ (ถ้ามี)</label>
                <input type="file" name="image" class="form-control" accept="image/*">
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top: 1rem;">บันทึกรายจ่าย</button>
        </form>
    `;
    openModal(html);
}

async function submitExpense(event) {
    event.preventDefault();
    const form = event.target;
    const btn = form.querySelector('button[type="submit"]');
    
    btn.disabled = true;
    btn.textContent = 'กำลังบันทึก...';
    
    // ใช้ FormData เพราะมีส่งไฟล์รูป
    const formData = new FormData(form);
    formData.append('date', getTodayString()); // ใส่วันที่ปัจจุบัน
    
    try {
        await API.Expenses.create(formData);
        showToast('บันทึกรายจ่ายเรียบร้อย!');
        closeModal();
        renderExpenses(); // โหลดข้อมูลใหม่
    } catch (error) {
        btn.disabled = false;
        btn.textContent = 'บันทึกรายจ่าย';
    }
}
