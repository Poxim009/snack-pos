const express = require('express');
const router = express.Router();
const db = require('../database/db');

// --------------------------------------------------
// GET /api/sales/today — ดึงยอดขายและข้อมูลวันนี้สำหรับ Dashboard
// --------------------------------------------------
router.get('/today', async (req, res) => {
    // หาวันที่ปัจจุบัน (ตามเวลาท้องถิ่น) -> YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    
    try {
        // 1. ยอดขายรวมวันนี้
        const salesResult = await db.query(
            'SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as bills FROM sales WHERE date = $1',
            [today]
        );
        const sales = salesResult.rows[0];

        // 2. สินค้าขายดีวันนี้ (Top 5)
        const topItemsResult = await db.query(`
            SELECT 
                si.product_name, 
                SUM(si.quantity) as total_qty, 
                SUM(si.subtotal) as total_amount
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.date = $1
            GROUP BY si.product_name
            ORDER BY total_qty DESC
            LIMIT 5
        `, [today]);
        const topItems = topItemsResult.rows;

        res.json({
            date: today,
            total_sales: sales.total,
            total_bills: sales.bills,
            top_items: topItems
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// POST /api/sales — บันทึกการขาย (คิดเงิน)
// --------------------------------------------------
// POST /api/sales — บันทึกการขาย (คิดเงิน)
// --------------------------------------------------
router.post('/', async (req, res) => {
    const { items, note, discount, payment_method } = req.body;
    
    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'ไม่มีสินค้าในตะกร้า' });
    }

    const today = new Date().toISOString().split('T')[0];
    let totalAmount = 0;

    // คำนวณยอดรวมเพื่อความชัวร์ (ไม่เชื่อฝั่งหน้าจอทั้งหมด ป้องกันโดนแฮกค่า)
    items.forEach(item => {
        totalAmount += (item.quantity * item.unit_price);
    });

    // หักส่วนลด
    const finalDiscount = parseFloat(discount) || 0;
    let netTotal = totalAmount - finalDiscount;
    if (netTotal < 0) netTotal = 0;

    const finalPaymentMethod = payment_method || 'cash';

    try {
        await db.query('BEGIN'); // เริ่ม Transaction

        // 1. สร้างบิลใหม่
        const saleResult = await db.query(`
            INSERT INTO sales (date, total_amount, note, discount, payment_method) 
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [today, netTotal, note || '', finalDiscount, finalPaymentMethod]);
        
        const saleId = saleResult.rows[0].id;

        // 2. บันทึกรายละเอียดสินค้าทีละชิ้น และตัดสต๊อก
        for (const item of items) {
            const subtotal = item.quantity * item.unit_price;
            
            // บันทึกรายการลงบิล
            await db.query(`
                INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [saleId, item.product_id, item.product_name, item.quantity, item.unit_price, subtotal]);
            
            // ตัดสต๊อก
            await db.query(`
                UPDATE products 
                SET stock_qty = stock_qty - $1 
                WHERE id = $2
            `, [item.quantity, item.product_id]);
        }

        // 3. ถ้าจ่ายแบบแปะโป้ง (debt) ให้บันทึกหนี้ด้วย
        let debtId = null;
        if (finalPaymentMethod === 'debt') {
            const { customer_id, due_date, remind_time, remind_frequency, evidence_image_url } = req.body;
            if (!customer_id) throw new Error('ไม่พบข้อมูลลูกค้าสำหรับลงบัญชีหนี้');
            
            // สร้างคำอธิบายรวมๆ จากตะกร้าสินค้า
            const itemsDescription = items.map(i => `${i.product_name} x${i.quantity}`).join(', ');
            
            const debtResult = await db.query(`
                INSERT INTO debts (customer_id, sale_id, amount, items_description, due_date, auto_remind, remind_frequency, remind_time, evidence_image_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id
            `, [
                customer_id, 
                saleId,
                netTotal, 
                itemsDescription, 
                due_date || null,
                remind_frequency && remind_frequency !== 0 ? 1 : 0,
                remind_frequency || 1,
                remind_time || '10:00',
                evidence_image_url || ''
            ]);
            debtId = debtResult.rows[0].id;
        }

        await db.query('COMMIT'); // ยืนยัน Transaction
        res.json({ success: true, sale_id: saleId, debt_id: debtId, message: 'บันทึกการขายสำเร็จ' });

    } catch (err) {
        await db.query('ROLLBACK'); // ถ้ายกเลิกกลางคัน ให้ย้อนกลับทั้งหมด
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// GET /api/sales — ดูประวัติการขายทั้งหมด (อาจจะมีส่ง date มากรอง)
// --------------------------------------------------
router.get('/', async (req, res) => {
    const { date } = req.query;
    let queryStr = 'SELECT * FROM sales';
    let params = [];
    
    if (date) {
        queryStr += ' WHERE date = $1';
        params.push(date);
    }
    queryStr += ' ORDER BY id DESC LIMIT 100';

    try {
        const result = await db.query(queryStr, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --------------------------------------------------
// DELETE /api/sales/:id — ลบประวัติการขาย (และคืนสต๊อก)
// --------------------------------------------------
router.delete('/:id', async (req, res) => {
    const saleId = req.params.id;

    try {
        await db.query('BEGIN'); // เริ่ม Transaction

        // 1. ดึงรายการสินค้าในบิลนี้ เพื่อเอาไปคืนสต๊อก
        const itemsResult = await db.query('SELECT product_id, quantity FROM sale_items WHERE sale_id = $1', [saleId]);
        
        // 2. คืนสต๊อกให้สินค้าแต่ละตัว
        for (const item of itemsResult.rows) {
            await db.query(`
                UPDATE products 
                SET stock_qty = stock_qty + $1 
                WHERE id = $2
            `, [item.quantity, item.product_id]);
        }

        // 3. ลบข้อมูลออกจากฐานข้อมูล
        await db.query('DELETE FROM sale_items WHERE sale_id = $1', [saleId]);
        await db.query('DELETE FROM sales WHERE id = $1', [saleId]);

        await db.query('COMMIT'); // ยืนยัน Transaction
        res.json({ success: true, message: 'ลบประวัติการขายและคืนสต๊อกเรียบร้อย' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;