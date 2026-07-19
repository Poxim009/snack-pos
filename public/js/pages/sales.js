// ============================================================
// pages/sales.js — หน้าขายสินค้า (POS)
// ============================================================

let currentCart = [];
let allProducts = [];
let salesCustomers = [];

async function renderSales() {
    const container = document.getElementById('sales-content');
    container.innerHTML = '<div class="loading">กำลังโหลดสินค้า...</div>';

    try {
        // โหลดสินค้าที่ขายอยู่ทั้งหมด และลูกค้าเผื่อต้องแปะโป้ง
        const [products, customers] = await Promise.all([
            API.Products.getAll(),
            API.Customers.getAll()
        ]);
        
        allProducts = products;
        salesCustomers = customers;
        
        let html = `
            <!-- ตะกร้าสินค้าด้านบน -->
            <div class="card" style="position: sticky; top: var(--header-height); z-index: 30; border: 2px solid var(--primary);">
                <div class="flex justify-between align-center mb-1">
                    <h3>🛒 ตะกร้าปัจจุบัน</h3>
                    <div class="flex align-center gap-1">
                        <button class="btn btn-outline btn-sm" id="btnShowHeldBills" onclick="showHeldBills()" style="padding: 2px 8px; font-size: 0.8rem; display: none;">📋 บิลที่พักไว้ (0)</button>
                        <div class="badge partial" style="font-size: 1rem;" id="cartTotal">฿0</div>
                    </div>
                </div>
                <div id="cartItems" class="item-list mb-2" style="max-height: 150px; overflow-y: auto;">
                    <p class="text-muted text-center" style="font-size: 0.85rem;">ยังไม่ได้เลือกสินค้า (แตะด้านล่างเพื่อเลือก)</p>
                </div>
                <div class="flex gap-1">
                    <button class="btn btn-outline" id="btnHoldBill" onclick="holdCurrentBill()" style="flex: 1;" disabled>⏸️ พักบิล</button>
                    <button class="btn btn-primary" id="btnSubmitSale" onclick="openCheckoutModal()" style="flex: 2;" disabled>คิดเงิน</button>
                </div>
            </div>

            <!-- หมวดหมู่และสินค้า -->
            <div id="productGrid">
                ${renderProductCategories()}
            </div>
        `;
        
        container.innerHTML = html;
        
        // เคลียร์ตะกร้าทุกครั้งที่เข้าหน้าขายใหม่
        currentCart = [];
        updateCartUI();
        
    } catch (error) {
        container.innerHTML = `<div class="text-danger text-center">โหลดสินค้าล้มเหลว: ${error.message}</div>`;
    }
}

// แยกสินค้าตามหมวดหมู่
function renderProductCategories() {
    if (allProducts.length === 0) return '<p class="text-center mt-2">ยังไม่มีสินค้า (ไปเพิ่มที่หน้าตั้งค่า)</p>';

    // จัดกลุ่มตามชื่อหมวดหมู่
    const grouped = {};
    allProducts.forEach(p => {
        const cat = p.category_name || 'ไม่ได้จัดหมวด';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
    });

    let html = '';
    for (const [catName, products] of Object.entries(grouped)) {
        html += `
            <div class="mt-2 mb-2">
                <h3 style="font-size: 1rem; color: var(--text-muted);">${products[0].category_emoji || '📦'} ${catName}</h3>
                <div class="pos-grid">
                    ${products.map(p => {
                        const iconHtml = p.image_url
                            ? `<img src="${p.image_url}" style="width:100%; height:80px; object-fit:cover; border-radius:12px; margin-bottom:5px;">`
                            : `<div class="pos-emoji">${p.emoji}</div>`;
                        return `
                        <div class="pos-item" id="pos-item-${p.id}" onclick="addToCart(${p.id})">
                            ${iconHtml}
                            <div class="pos-name">${p.name}</div>
                            <div class="pos-price">฿${p.sell_price}</div>
                            <div class="pos-qty" id="qty-badge-${p.id}">0</div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    return html;
}

// เพิ่มสินค้าลงตะกร้า
function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const existingItem = currentCart.find(i => i.product_id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        currentCart.push({
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_price: product.sell_price
        });
    }
    updateCartUI();
}

// ลบ/ลด สินค้าในตะกร้า
function removeFromCart(productId) {
    const index = currentCart.findIndex(i => i.product_id === productId);
    if (index === -1) return;

    if (currentCart[index].quantity > 1) {
        currentCart[index].quantity -= 1;
    } else {
        currentCart.splice(index, 1);
    }
    updateCartUI();
}

// อัปเดตหน้าตาตะกร้า
function updateCartUI() {
    const cartItemsDiv = document.getElementById('cartItems');
    const cartTotalDiv = document.getElementById('cartTotal');
    const btnSubmit = document.getElementById('btnSubmitSale');
    
    if (!cartItemsDiv || !cartTotalDiv || !btnSubmit) return;

    let total = 0;
    
    // อัปเดต badge บนปุ่มสินค้า
    allProducts.forEach(p => {
        const itemEl = document.getElementById(`pos-item-${p.id}`);
        const badgeEl = document.getElementById(`qty-badge-${p.id}`);
        if (itemEl && badgeEl) {
            const cartItem = currentCart.find(i => i.product_id === p.id);
            if (cartItem) {
                itemEl.classList.add('selected');
                badgeEl.textContent = cartItem.quantity;
            } else {
                itemEl.classList.remove('selected');
            }
        }
    });

    const btnHold = document.getElementById('btnHoldBill');
    
    if (currentCart.length === 0) {
        cartItemsDiv.innerHTML = '<p class="text-muted text-center" style="font-size: 0.85rem;">ยังไม่ได้เลือกสินค้า</p>';
        cartTotalDiv.textContent = '฿0';
        if(btnSubmit) btnSubmit.disabled = true;
        if(btnHold) btnHold.disabled = true;
    } else {
        let html = '';
        currentCart.forEach(item => {
            const subtotal = item.quantity * item.unit_price;
            total += subtotal;
            
            html += `
                <div class="flex justify-between align-center" style="padding: 0.25rem 0; border-bottom: 1px dashed var(--border);">
                    <div class="flex align-center gap-2" style="flex: 1;">
                        <button class="btn btn-sm btn-outline" style="padding: 0 5px;" onclick="removeFromCart(${item.product_id})">-</button>
                        <span style="font-weight: 500;">${item.quantity}</span>
                        <button class="btn btn-sm btn-outline" style="padding: 0 5px;" onclick="addToCart(${item.product_id})">+</button>
                        <span style="font-size: 0.9rem; margin-left: 5px;">${item.product_name}</span>
                    </div>
                    <div style="font-weight: 600;">฿${subtotal}</div>
                </div>
            `;
        });

        cartItemsDiv.innerHTML = html;
        cartTotalDiv.textContent = formatCurrency(total);
        if(btnSubmit) btnSubmit.disabled = false;
        if(btnHold) btnHold.disabled = false;
        
        // เลื่อนตะกร้าลงล่างสุดอัตโนมัติ
        cartItemsDiv.scrollTop = cartItemsDiv.scrollHeight;
    }

    // อัปเดตปุ่มแสดงบิลที่พักไว้
    const heldBills = JSON.parse(localStorage.getItem('held_bills') || '[]');
    const btnShowHeldBills = document.getElementById('btnShowHeldBills');
    if (btnShowHeldBills) {
        if (heldBills.length > 0) {
            btnShowHeldBills.style.display = 'inline-block';
            btnShowHeldBills.textContent = `📋 บิลที่พักไว้ (${heldBills.length})`;
        } else {
            btnShowHeldBills.style.display = 'none';
        }
    }
}

// --------------------------------------------------
// ระบบ Checkout ใหม่ (ส่วนลด + รูปแบบการจ่าย)
// --------------------------------------------------
function openCheckoutModal() {
    if (currentCart.length === 0) return;
    
    let total = 0;
    currentCart.forEach(item => total += item.quantity * item.unit_price);
    
    const html = `
        ${getModalHeader('💰 สรุปการขาย')}
        <div style="text-align: center; margin-bottom: 1rem;">
            <div class="text-muted" style="font-size: 0.9rem;">ยอดรวมสินค้า</div>
            <div style="font-size: 1.5rem; font-weight: bold;">฿<span id="checkout-total">${total}</span></div>
        </div>
        
        <div class="form-group flex align-center justify-between" style="gap: 10px;">
            <label class="form-label mb-0" style="flex: 1;">ส่วนลด (บาท):</label>
            <input type="number" id="checkout-discount" class="form-control text-center" value="0" min="0" max="${total}" style="width: 100px; font-weight: bold;" oninput="updateCheckoutNetTotal()">
        </div>
        
        <hr style="margin: 1rem 0; opacity: 0.2;">
        
        <div class="flex justify-between align-center mb-1">
            <div style="font-size: 1.2rem; font-weight: bold;">ยอดสุทธิ</div>
            <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">฿<span id="checkout-net-total">${total}</span></div>
        </div>
        
        <div id="checkout-qr-container" style="display: none; text-align: center; margin: 1rem 0;">
            <img id="checkout-qr-img" src="" style="width: 200px; height: 200px; border-radius: 12px; border: 2px solid var(--primary); padding: 5px;">
            <p class="text-muted mt-1 text-sm">ให้ลูกค้าสแกน QR Code เพื่อโอนเงิน</p>
        </div>
        
        <div id="checkout-buttons" style="display: flex; gap: 10px; margin-top: 1rem;">
            <button class="btn btn-outline" style="flex: 1;" onclick="showCashPayment()">💵 เงินสด</button>
            <button class="btn btn-primary" style="flex: 1;" onclick="showQRPayment()">📱 สแกน QR</button>
            <button class="btn btn-outline" style="flex: 1; border-color: var(--danger); color: var(--danger);" onclick="showDebtPayment()">📝 ลงบัญชีค้างชำระ</button>
        </div>
        
        <!-- ส่วนรับเงินสด (จะแสดงเมื่อกดปุ่มเงินสด) -->
        <div id="cash-payment-container" style="display: none; margin-top: 1rem;">
            <div class="form-group">
                <label class="form-label text-center">รับเงินมา (บาท)</label>
                <input type="number" id="cash-received" class="form-control text-center" style="font-size: 1.5rem; font-weight: bold; padding: 10px;" oninput="updateChangeDue()">
            </div>
            
            <div class="flex gap-1 justify-center mb-2" id="cash-quick-buttons">
                <!-- ปุมลัดจะถูกเพิ่มด้วย JS -->
            </div>
            
            <div class="card" style="background: var(--background); text-align: center;">
                <div class="text-muted">เงินทอน</div>
                <div id="change-due" style="font-size: 2rem; font-weight: bold; color: var(--danger);">฿0</div>
            </div>
            
            <button id="checkout-cash-confirm-btn" class="btn btn-primary mt-2" style="width: 100%; font-size: 1.2rem; padding: 12px;" onclick="processPayment('cash')">✅ จบบิล (ทอนเงินแล้ว)</button>
        </div>
        
        <!-- ส่วนลงบัญชีค้างชำระ -->
        <div id="debt-payment-container" style="display: none; margin-top: 1rem; text-align: left;">
            <div class="form-group">
                <label class="form-label">เลือกลูกค้าที่ต้องการลงบัญชีค้างชำระ</label>
                ${renderCustomCustomerSelect(salesCustomers, 'debt_customer_id')}
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                    * ลูกค้าจะแอดเพิ่มได้อัตโนมัติเมื่อเขากดเพิ่มเพื่อน LINE OA ของคุณ
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label class="form-label">วันครบกำหนดจ่าย</label>
                    <input type="date" id="debt_due_date" class="form-control" value="${getTodayString()}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">เวลาที่ทวง</label>
                    <input type="time" id="debt_remind_time" class="form-control" value="10:00" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">ความถี่ในการทวงถามอัตโนมัติ</label>
                <select id="debt_remind_frequency" class="form-control">
                    <option value="1">ทุก 1 วัน</option>
                    <option value="2">ทุก 2 วัน</option>
                    <option value="3">ทุก 3 วัน</option>
                    <option value="7">ทุก 7 วัน</option>
                    <option value="0">ไม่ต้องทวงอัตโนมัติ</option>
                </select>
            </div>
            
            <div class="form-group text-center">
                <label class="form-label">ถ่ายรูปหลักฐาน (ส่งพร้อมไลน์ทวงหนี้)</label>
                <input type="hidden" id="pos_debt_evidence_image_url">
                <input type="file" id="pos_debt_evidence_input" accept="image/*" capture="environment" style="display: none;" onchange="uploadEvidenceImage(this, 'pos_debt_evidence_preview', 'pos_debt_evidence_image_url')">
                <button type="button" class="btn btn-outline" style="width: 100%;" onclick="document.getElementById('pos_debt_evidence_input').click()">📸 ถ่ายรูปหลักฐาน / เลือกรูป</button>
                <img id="pos_debt_evidence_preview" src="" style="display: none; width: 100%; max-height: 200px; object-fit: contain; margin-top: 10px; border-radius: 8px; border: 1px solid var(--border);">
            </div>
            
            <button class="btn mt-2" style="width: 100%; font-size: 1.2rem; padding: 12px; background: var(--danger); color: white;" onclick="processPayment('debt')">📝 ลงบัญชีค้างชำระ</button>
        </div>
        
        <button id="checkout-confirm-btn" class="btn btn-primary mt-2" style="display: none; width: 100%;" onclick="processPayment('promptpay')">✅ ยืนยันว่าได้รับเงินแล้ว (ปิดบิล)</button>
    `;
    
    openModal(html);
    
    // ตั้งค่า default due date ให้เป็น 2 วันข้างหน้า
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 2);
    const dateInput = document.getElementById('debt_due_date');
    if(dateInput) dateInput.value = defaultDue.toISOString().split('T')[0];
}

function updateCheckoutNetTotal() {
    let total = 0;
    currentCart.forEach(item => total += item.quantity * item.unit_price);
    
    const discountInput = document.getElementById('checkout-discount');
    let discount = parseFloat(discountInput.value) || 0;
    if (discount < 0) discount = 0;
    if (discount > total) {
        discount = total;
        discountInput.value = discount;
    }
    
    document.getElementById('checkout-net-total').textContent = (total - discount).toString();
    // Update change if cash input is visible
    if (document.getElementById('cash-payment-container').style.display === 'block') {
        updateChangeDue();
    }
}

function showCashPayment() {
    const netTotal = parseFloat(document.getElementById('checkout-net-total').textContent) || 0;
    
    // ซ่อนปุ่มเลือกจ่าย
    document.getElementById('checkout-buttons').style.display = 'none';
    document.getElementById('checkout-discount').disabled = true; // ล็อคส่วนลด
    
    // โชว์หน้าจอรับเงินสด
    document.getElementById('cash-payment-container').style.display = 'block';
    
    // เตรียมปุ่มลัด
    let buttonsHtml = `<button class="btn btn-sm btn-outline" onclick="setCashReceived(${netTotal})">พอดี</button>`;
    
    // หาแบงก์ที่ใหญ่กว่ายอดสุทธิเพื่อทำปุ่มลัด
    const quickAmounts = [100, 500, 1000];
    quickAmounts.forEach(amt => {
        if (amt > netTotal || (amt === 1000 && netTotal < 1000)) {
            buttonsHtml += `<button class="btn btn-sm btn-outline" onclick="setCashReceived(${amt})">฿${amt}</button>`;
        }
    });
    
    document.getElementById('cash-quick-buttons').innerHTML = buttonsHtml;
    
    // โฟกัสช่องรับเงิน
    const cashInput = document.getElementById('cash-received');
    cashInput.focus();
    updateChangeDue();
}

function setCashReceived(amount) {
    const cashInput = document.getElementById('cash-received');
    cashInput.value = amount;
    updateChangeDue();
}

function updateChangeDue() {
    const netTotal = parseFloat(document.getElementById('checkout-net-total').textContent) || 0;
    const cashReceived = parseFloat(document.getElementById('cash-received').value) || 0;
    const changeDueEl = document.getElementById('change-due');
    const confirmBtn = document.getElementById('checkout-cash-confirm-btn');
    
    const change = cashReceived - netTotal;
    
    if (cashReceived >= netTotal) {
        changeDueEl.textContent = '฿' + formatCurrency(change);
        changeDueEl.style.color = 'var(--success)';
        confirmBtn.disabled = false;
    } else {
        changeDueEl.textContent = 'ยอดเงินไม่พอ';
        changeDueEl.style.color = 'var(--danger)';
        confirmBtn.disabled = true;
    }
}

function showQRPayment() {
    const promptpayId = localStorage.getItem('promptpay_id');
    if (!promptpayId) {
        alert('ยังไม่ได้ตั้งค่าเบอร์ PromptPay! กรุณาไปตั้งค่าที่เมนูตั้งค่าระบบก่อนครับ');
        closeModal();
        return;
    }
    
    const netTotal = parseFloat(document.getElementById('checkout-net-total').textContent) || 0;
    
    // สร้าง QR Code ผ่าน PromptPay API
    const qrUrl = `https://promptpay.io/${promptpayId}/${netTotal}.png`;
    
    document.getElementById('checkout-qr-img').src = qrUrl;
    document.getElementById('checkout-qr-container').style.display = 'block';
    
    // ซ่อนปุ่มเลือกจ่าย โชว์ปุ่มยืนยันแทน
    document.getElementById('checkout-buttons').style.display = 'none';
    document.getElementById('checkout-discount').disabled = true; // ล็อคส่วนลดไม่ให้แก้
    document.getElementById('checkout-confirm-btn').style.display = 'block';
}

function showDebtPayment() {
    // ซ่อนปุ่มเลือกจ่าย
    document.getElementById('checkout-buttons').style.display = 'none';
    document.getElementById('checkout-discount').disabled = true; // ล็อคส่วนลด
    
    // โชว์หน้าจอแปะโป้งหนี้
    document.getElementById('debt-payment-container').style.display = 'block';
}

// กดคิดเงินเพื่อจบการขาย
async function processPayment(paymentMethod) {
    if (currentCart.length === 0) return;
    
    const discountInput = document.getElementById('checkout-discount');
    const discount = parseFloat(discountInput ? discountInput.value : 0) || 0;

    // เตรียม payload พื้นฐาน
    const payload = { 
        items: currentCart,
        discount: discount,
        payment_method: paymentMethod
    };

    // ถ้าเป็นการแปะโป้ง (debt) ต้องแนบข้อมูลลูกค้าและเวลาทวง
    if (paymentMethod === 'debt') {
        const customer_id = document.getElementById('hidden_debt_customer_id')?.value;
        if (!customer_id) {
            alert('กรุณาเลือกลูกค้าที่จะลงบัญชีค้างชำระ');
            return;
        }
        payload.customer_id = customer_id;
        payload.due_date = document.getElementById('debt_due_date')?.value;
        payload.remind_time = document.getElementById('debt_remind_time')?.value;
        payload.remind_frequency = parseInt(document.getElementById('debt_remind_frequency')?.value) || 0;
        payload.evidence_image_url = document.getElementById('pos_debt_evidence_image_url')?.value || '';
    }

    const btnSubmit = document.getElementById('checkout-confirm-btn');
    if(btnSubmit && paymentMethod === 'promptpay') {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'กำลังบันทึก...';
    }

    try {
        const res = await API.Sales.create(payload);
        
        let msg = 'บันทึกเรียบร้อย!';
        if (paymentMethod === 'cash') msg = 'รับเงินสดเรียบร้อย!';
        if (paymentMethod === 'promptpay') msg = 'ปิดบิล QR Code เรียบร้อย!';
        if (paymentMethod === 'debt') {
            msg = 'ลงบัญชีค้างชำระเรียบร้อย!';
            // ส่งข้อความ LINE ทันที
            if (res && res.debt_id) {
                API.Line.notifyNewDebt(res.debt_id).catch(e => console.error("Line notification failed:", e));
            }
        }
        
        showToast(msg);
        
        // เคลียร์ตะกร้า
        currentCart = [];
        updateCartUI();
        closeModal();
        
    } catch (error) {
        if(btnSubmit && paymentMethod === 'promptpay') {
            btnSubmit.disabled = false;
            btnSubmit.textContent = '✅ ยืนยันว่าได้รับเงินแล้ว (ปิดบิล)';
        }
        alert('เกิดข้อผิดพลาด: ' + error.message);
    }
}

// --------------------------------------------------
// ระบบ พักบิล (Hold Bill)
// --------------------------------------------------
function holdCurrentBill() {
    if (currentCart.length === 0) return;
    
    const name = prompt('ตั้งชื่อบิลที่ต้องการพักไว้ (เช่น โต๊ะ 1, พี่สมชาย):');
    if (!name) return; // กดยกเลิก
    
    let total = 0;
    currentCart.forEach(item => total += item.quantity * item.unit_price);
    
    const heldBills = JSON.parse(localStorage.getItem('held_bills') || '[]');
    
    const newBill = {
        id: Date.now(), // ใช้ timestamp เป็น ID
        name: name,
        items: [...currentCart],
        total: total,
        time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    };
    
    heldBills.push(newBill);
    localStorage.setItem('held_bills', JSON.stringify(heldBills));
    
    // เคลียร์ตะกร้าปัจจุบัน
    currentCart = [];
    updateCartUI();
    showToast(`พักบิล "${name}" เรียบร้อยแล้ว`);
}

function showHeldBills() {
    const heldBills = JSON.parse(localStorage.getItem('held_bills') || '[]');
    if (heldBills.length === 0) {
        alert('ไม่มีบิลที่พักไว้ครับ');
        return;
    }
    
    let listHtml = '';
    heldBills.forEach(bill => {
        listHtml += `
            <div class="card mb-1 flex justify-between align-center" style="padding: 10px;">
                <div>
                    <div style="font-weight: bold; color: var(--primary);">${bill.name}</div>
                    <div style="font-size: 0.85rem; color: var(--muted);">เวลา: ${bill.time} | ยอด: ฿${bill.total}</div>
                </div>
                <div class="flex gap-1">
                    <button class="btn btn-outline btn-sm" onclick="restoreHeldBill(${bill.id})">เรียกคืน</button>
                    <button class="btn btn-sm" style="background: var(--danger); color: white;" onclick="deleteHeldBill(${bill.id})">ลบ</button>
                </div>
            </div>
        `;
    });
    
    const html = `
        ${getModalHeader('📋 บิลที่พักไว้')}
        <div style="max-height: 60vh; overflow-y: auto;">
            ${listHtml}
        </div>
    `;
    
    openModal(html);
}

function restoreHeldBill(id) {
    if (currentCart.length > 0) {
        if (!confirm('ตะกร้าปัจจุบันมีสินค้าอยู่ หากเรียกคืนบิลนี้ ตะกร้าปัจจุบันจะถูกทับ ต้องการดำเนินการต่อไหม?')) {
            return;
        }
    }
    
    let heldBills = JSON.parse(localStorage.getItem('held_bills') || '[]');
    const billIndex = heldBills.findIndex(b => b.id === id);
    
    if (billIndex === -1) return;
    
    // โหลดสินค้ากลับเข้าตะกร้า
    currentCart = heldBills[billIndex].items;
    
    // ลบออกจาก localStorage
    heldBills.splice(billIndex, 1);
    localStorage.setItem('held_bills', JSON.stringify(heldBills));
    
    updateCartUI();
    closeModal();
    showToast('เรียกคืนบิลเรียบร้อยแล้ว');
}

function deleteHeldBill(id) {
    if (!confirm('ต้องการลบบิลที่พักไว้นี้ทิ้งใช่ไหม?')) return;
    
    let heldBills = JSON.parse(localStorage.getItem('held_bills') || '[]');
    heldBills = heldBills.filter(b => b.id !== id);
    
    localStorage.setItem('held_bills', JSON.stringify(heldBills));
    
    // อัปเดตหน้าต่างถ้ามีบิลเหลือ หรือปิดหน้าต่างถ้าหมดแล้ว
    if (heldBills.length > 0) {
        showHeldBills(); 
    } else {
        closeModal();
    }
    
    updateCartUI(); // อัปเดตปุ่มข้างนอก
    showToast('ลบบิลทิ้งแล้ว');
}
