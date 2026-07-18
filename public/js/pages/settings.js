// ============================================================
// pages/settings.js — หน้าตั้งค่า (จัดการสินค้า, หมวดหมู่)
// ============================================================

async function renderSettings() {
    const container = document.getElementById('settings-content');
    container.innerHTML = '<div class="loading">กำลังโหลด...</div>';

    try {
        const lineStatus = await API.Line.getStatus();
        
        let html = `
            <h2>⚙️ ตั้งค่าระบบ</h2>
            
            <!-- ตั้งค่า LINE -->
            <div class="card">
                <h3>💬 การเชื่อมต่อ LINE OA</h3>
                <div class="flex align-center gap-2 mt-1">
                    <div style="width: 15px; height: 15px; border-radius: 50%; background: ${lineStatus.configured ? '#00B900' : 'var(--danger)'};"></div>
                    <strong>สถานะ:</strong> ${lineStatus.configured ? 'เชื่อมต่อแล้ว' : 'ยังไม่ได้ตั้งค่า'}
                </div>
                ${!lineStatus.configured ? `<p class="text-muted mt-1" style="font-size: 0.85rem;">กรุณาใส่ Channel Access Token ในไฟล์ .env แล้วรีสตาร์ท Server</p>` : ''}
            </div>

            <!-- จัดการสินค้า -->
            <div class="card mt-2">
                <div class="flex justify-between align-center mb-1">
                    <h3>📦 จัดการสินค้า</h3>
                    <button class="btn btn-outline btn-sm" onclick="toggleTemplateGrid()">+ เพิ่มสินค้าแบบด่วน</button>
                </div>
                
                <!-- ตารางเพิ่มสินค้าแบบใหม่ (ซ่อนไว้ก่อน) -->
                <div id="settings-template-grid" style="display: none; margin-top: 1rem; margin-bottom: 1rem;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;" id="cookie-templates-container">
                        <!-- Templates will be injected here -->
                    </div>
                    <div class="mt-2 text-center">
                        <button class="btn btn-outline btn-sm" onclick="showAddProductModal()">+ เพิ่มสินค้าแบบละเอียด (กำหนดเอง)</button>
                    </div>
                    <hr style="margin: 15px 0; opacity: 0.2;">
                </div>

                <div id="settings-products-list" class="item-list mt-2">
                    <div class="text-center text-muted">กำลังโหลดรายการสินค้า...</div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        loadProductsForSettings();
        renderCookieTemplates();
        
    } catch (error) {
        container.innerHTML = `<div class="text-danger text-center">โหลดข้อมูลล้มเหลว: ${error.message}</div>`;
    }
}

// ------------------------------------------------------------------
// เทมเพลตคุกกี้ (Visual Grid)
// ------------------------------------------------------------------
const COOKIE_TEMPLATES = [
    { name: 'คุกกี้ช็อกโกแลตชิป', image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&q=80', defaultPrice: 35 },
    { name: 'คุกกี้เนยสด', image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80', defaultPrice: 40 },
    { name: 'คุกกี้ข้าวโอ๊ต', image: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=400&q=80', defaultPrice: 30 },
    { name: 'บราวนี่คุกกี้', image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80', defaultPrice: 45 }
];

function toggleTemplateGrid() {
    const grid = document.getElementById('settings-template-grid');
    if (grid.style.display === 'none') {
        grid.style.display = 'block';
    } else {
        grid.style.display = 'none';
    }
}

function renderCookieTemplates() {
    const container = document.getElementById('cookie-templates-container');
    if (!container) return;
    
    container.innerHTML = COOKIE_TEMPLATES.map((tpl, index) => `
        <div class="card" style="padding: 10px; display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--border);">
            <div style="height: 100px; border-radius: 8px; overflow: hidden; background: #eee;">
                <img src="${tpl.image}" style="width: 100%; height: 100%; object-fit: cover;" alt="cookie">
            </div>
            <input type="text" id="tpl-name-${index}" class="form-control" value="${tpl.name}" style="font-size: 0.9rem; padding: 4px;" placeholder="ชื่อสินค้า">
            <div class="flex align-center gap-1">
                <button class="btn btn-outline" style="padding: 2px 8px;" onclick="adjustTplPrice(${index}, -5)">-</button>
                <input type="number" id="tpl-price-${index}" class="form-control text-center" value="${tpl.defaultPrice}" style="font-size: 0.9rem; padding: 4px; flex: 1;">
                <button class="btn btn-outline" style="padding: 2px 8px;" onclick="adjustTplPrice(${index}, 5)">+</button>
            </div>
            <button class="btn btn-primary btn-sm mt-1" onclick="addTemplateProduct(${index})">เพิ่มเลย</button>
        </div>
    `).join('');
}

function adjustTplPrice(index, diff) {
    const input = document.getElementById(`tpl-price-${index}`);
    let val = parseInt(input.value) || 0;
    val += diff;
    if (val < 0) val = 0;
    input.value = val;
}

async function addTemplateProduct(index) {
    const tpl = COOKIE_TEMPLATES[index];
    const nameInput = document.getElementById(`tpl-name-${index}`);
    const priceInput = document.getElementById(`tpl-price-${index}`);
    
    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value);
    
    if (!name) return alert('กรุณาใส่ชื่อสินค้า');
    if (isNaN(price)) return alert('กรุณาใส่ราคาให้ถูกต้อง');
    
    try {
        await API.Products.create({
            name: name,
            category_id: null,
            sell_price: price,
            cost_price: 0,
            emoji: '🍪',
            image_url: tpl.image
        });
        showToast('เพิ่ม ' + name + ' เรียบร้อย!');
        loadProductsForSettings();
    } catch (error) {
        alert('เกิดข้อผิดพลาด: ' + error.message);
    }
}

// ------------------------------------------------------------------
// จัดการสินค้า
// ------------------------------------------------------------------
async function loadProductsForSettings() {
    const list = document.getElementById('settings-products-list');
    if (!list) return;
    
    try {
        const products = await API.Products.getAll();
        
        if (products.length === 0) {
            list.innerHTML = '<p class="text-center text-muted">ยังไม่มีสินค้า</p>';
            return;
        }
        
        list.innerHTML = products.map(p => {
            const displayIcon = p.image_url 
                ? `<img src="${p.image_url}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">`
                : `<div class="item-emoji">${p.emoji}</div>`;
                
            return `
            <div class="item-card">
                <div class="item-info">
                    ${displayIcon}
                    <div>
                        <div class="item-title">${p.name}</div>
                        <div class="item-subtitle">ขาย ฿${p.sell_price} (สต๊อก: ${p.stock_qty})</div>
                    </div>
                </div>
                <div class="flex gap-1 align-center">
                    <button class="btn btn-primary btn-sm" style="background: var(--secondary); padding: 0.25rem 0.5rem;" onclick="addStockPrompt(${p.id}, '${p.name}')">+ เติมสต๊อก</button>
                    <button class="btn btn-outline btn-sm" style="padding: 0.25rem 0.5rem;" onclick="deleteProduct(${p.id})">ลบ</button>
                </div>
            </div>
            `;
        }).join('');
        
    } catch (error) {
        list.innerHTML = `<div class="text-danger">โหลดล้มเหลว</div>`;
    }
}

async function showAddProductModal() {
    const categories = await API.Products.getCategories();
    const catOptions = categories.map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');

    const html = `
        ${getModalHeader('📦 เพิ่มสินค้าใหม่')}
        <form id="formAddProduct" onsubmit="submitProduct(event)">
            <div class="form-group">
                <label class="form-label">ชื่อสินค้า</label>
                <input type="text" name="name" class="form-control" required placeholder="เช่น คุกกี้เนยสด">
            </div>
            <div class="form-group">
                <label class="form-label">หมวดหมู่</label>
                <select name="category_id" class="form-control" required>
                    ${catOptions}
                </select>
            </div>
            <div class="flex gap-2">
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">ราคาขาย (บาท)</label>
                    <input type="number" name="sell_price" class="form-control" required min="0">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">ต้นทุน (บาท) <span class="text-muted">(ไม่บังคับ)</span></label>
                    <input type="number" name="cost_price" class="form-control" min="0" value="0">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">อีโมจิ (Emoji) <span class="text-muted">(แสดงถ้าไม่มีรูป)</span></label>
                <input type="text" name="emoji" class="form-control" value="🍪" maxlength="2">
            </div>
            <div class="form-group">
                <label class="form-label">ลิงก์รูปภาพ (Image URL) <span class="text-muted">(ไม่บังคับ)</span></label>
                <input type="url" name="image_url" class="form-control" placeholder="https://...">
            </div>
            
            <button type="submit" class="btn btn-primary" style="margin-top: 1rem;">บันทึกสินค้า</button>
        </form>
    `;
    openModal(html);
}

async function submitProduct(event) {
    event.preventDefault();
    const form = event.target;
    const btn = form.querySelector('button[type="submit"]');
    
    const data = {
        name: form.name.value,
        category_id: form.category_id.value,
        sell_price: parseFloat(form.sell_price.value),
        cost_price: parseFloat(form.cost_price.value),
        emoji: form.emoji.value || '🍪',
        image_url: form.image_url.value || ''
    };
    
    btn.disabled = true;
    
    try {
        await API.Products.create(data);
        showToast('เพิ่มสินค้าเรียบร้อย!');
        closeModal();
        loadProductsForSettings();
    } catch (error) {
        btn.disabled = false;
    }
}

async function deleteProduct(id) {
    if (!confirm('ยืนยันลบสินค้านี้?')) return;
    try {
        await API.Products.delete(id);
        showToast('ลบสินค้าแล้ว');
        loadProductsForSettings();
    } catch (error) {}
}

async function addStockPrompt(id, name) {
    const qtyStr = prompt(`เติมสต๊อกให้ "${name}"\nกรุณาใส่จำนวนที่ต้องการเพิ่ม (เช่น 10):`);
    if (!qtyStr) return;
    
    const qty = parseInt(qtyStr);
    if (isNaN(qty) || qty <= 0) {
        alert('กรุณาใส่ตัวเลขที่มากกว่า 0');
        return;
    }
    
    try {
        await API.Products.addStock(id, qty);
        showToast(`เพิ่มสต๊อก ${name} จำนวน ${qty} ชิ้นเรียบร้อย!`);
        loadProductsForSettings();
    } catch (error) {}
}
