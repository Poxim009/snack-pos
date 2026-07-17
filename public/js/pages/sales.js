// ============================================================
// pages/sales.js — หน้าขายสินค้า (POS)
// ============================================================

let currentCart = [];
let allProducts = [];

async function renderSales() {
    const container = document.getElementById('sales-content');
    container.innerHTML = '<div class="loading">กำลังโหลดสินค้า...</div>';

    try {
        // โหลดสินค้าที่ขายอยู่ทั้งหมด
        allProducts = await API.Products.getAll();
        
        let html = `
            <!-- ตะกร้าสินค้าด้านบน -->
            <div class="card" style="position: sticky; top: var(--header-height); z-index: 30; border: 2px solid var(--primary);">
                <div class="flex justify-between align-center mb-1">
                    <h3>🛒 ตะกร้าปัจจุบัน</h3>
                    <div class="badge partial" style="font-size: 1rem;" id="cartTotal">฿0</div>
                </div>
                <div id="cartItems" class="item-list mb-2" style="max-height: 150px; overflow-y: auto;">
                    <p class="text-muted text-center" style="font-size: 0.85rem;">ยังไม่ได้เลือกสินค้า (แตะด้านล่างเพื่อเลือก)</p>
                </div>
                <button class="btn btn-primary" id="btnSubmitSale" onclick="submitSale()" disabled>คิดเงิน</button>
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
                    ${products.map(p => `
                        <div class="pos-item" id="pos-item-${p.id}" onclick="addToCart(${p.id})">
                            <div class="pos-emoji">${p.emoji}</div>
                            <div class="pos-name">${p.name}</div>
                            <div class="pos-price">฿${p.sell_price}</div>
                            <div class="pos-qty" id="qty-badge-${p.id}">0</div>
                        </div>
                    `).join('')}
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

    if (currentCart.length === 0) {
        cartItemsDiv.innerHTML = '<p class="text-muted text-center" style="font-size: 0.85rem;">ยังไม่ได้เลือกสินค้า</p>';
        cartTotalDiv.textContent = '฿0';
        btnSubmit.disabled = true;
        return;
    }

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
    btnSubmit.disabled = false;
    
    // เลื่อนตะกร้าลงล่างสุดอัตโนมัติ
    cartItemsDiv.scrollTop = cartItemsDiv.scrollHeight;
}

// กดคิดเงิน
async function submitSale() {
    if (currentCart.length === 0) return;
    
    const btnSubmit = document.getElementById('btnSubmitSale');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'กำลังบันทึก...';

    try {
        await API.Sales.create({ items: currentCart });
        showToast('บันทึกยอดขายเรียบร้อย!');
        
        // เคลียร์ตะกร้า
        currentCart = [];
        updateCartUI();
        
    } catch (error) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'คิดเงิน';
    }
}
