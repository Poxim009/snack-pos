const express = require('express');
const router = express.Router();
const db = require('../database/db');

// เพิ่มคอลัมน์ debt_type ถ้ายังไม่มี (สำหรับฐานข้อมูลเก่า)
(async () => {
    try {
        await db.query(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS debt_type TEXT DEFAULT 'snack'`);
    } catch(e) { /* ไม่สนใจถ้ามีอยู่แล้ว */ }
})();

// --------------------------------------------------
// GET /api/debts/summary — สรุปหนี้
// --------------------------------------------------
router.get('/summary', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                COUNT(*) as pending_count,
                COALESCE(SUM(amount - paid_amount), 0) as pending_total
            FROM debts 
            WHERE status IN ('pending', 'partial')
        `);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// GET /api/debts — ดึงรายการหนี้
// --------------------------------------------------
router.get('/', async (req, res) => {
    const { status, debt_type } = req.query;
    
    let queryStr = `
        SELECT d.*, c.display_name, c.is_line_friend, c.picture_url
        FROM debts d
        JOIN customers c ON d.customer_id = c.id
    `;
    let params = [];
    let conditions = [];

    if (status === 'pending') {
        conditions.push(`d.status IN ('pending', 'partial')`);
    } else if (status === 'paid') {
        conditions.push(`d.status = 'paid'`);
    }

    if (debt_type && debt_type !== 'all') {
        conditions.push(`d.debt_type = '${debt_type}'`);
    }

    if (conditions.length > 0) {
        queryStr += ' WHERE ' + conditions.join(' AND ');
    }
    
    queryStr += ` ORDER BY d.due_date ASC, d.id DESC`;

    try {
        const result = await db.query(queryStr, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// POST /api/debts — ลงบัญชีลูกหนี้ใหม่
// --------------------------------------------------
router.post('/', async (req, res) => {
    const { customer_id, amount, items_description, due_date, auto_remind, remind_frequency, remind_time, evidence_image_url, debt_type } = req.body;

    if (!customer_id || !amount) {
        return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }

    try {
        const result = await db.query(`
            INSERT INTO debts (customer_id, amount, items_description, due_date, auto_remind, remind_frequency, remind_time, evidence_image_url, debt_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `, [
            customer_id, 
            parseFloat(amount), 
            items_description || '', 
            due_date || null,
            auto_remind !== undefined ? auto_remind : 1,
            remind_frequency !== undefined ? remind_frequency : 1,
            remind_time || '10:00',
            evidence_image_url || '',
            debt_type || 'snack'
        ]);
        
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// PUT /api/debts/:id/pay — ชำระหนี้ (รับเงินคืน)
// --------------------------------------------------
router.put('/:id/pay', async (req, res) => {
    const debtId = req.params.id;
    const { pay_amount } = req.body; // จำนวนเงินที่ลูกค้าเอามาจ่าย

    if (!pay_amount || pay_amount <= 0) {
        return res.status(400).json({ error: 'จำนวนเงินไม่ถูกต้อง' });
    }

    try {
        // 1. ดึงข้อมูลหนี้ปัจจุบันมาดู
        const debtResult = await db.query('SELECT * FROM debts WHERE id = $1', [debtId]);
        const debt = debtResult.rows[0];

        if (!debt) return res.status(404).json({ error: 'ไม่พบรายการหนี้' });
        if (debt.status === 'paid') return res.status(400).json({ error: 'หนี้นี้ชำระครบแล้ว' });

        const newPaidAmount = debt.paid_amount + parseFloat(pay_amount);
        let newStatus = 'partial';
        let paidAt = null;

        // 2. เช็คว่าจ่ายครบหรือยัง
        if (newPaidAmount >= debt.amount) {
            newStatus = 'paid';
            paidAt = new Date().toISOString(); // วันที่ชำระครบ
        }

        // 3. อัปเดตข้อมูลหนี้
        await db.query(`
            UPDATE debts 
            SET paid_amount = $1, status = $2, paid_at = $3
            WHERE id = $4
        `, [newPaidAmount, newStatus, paidAt, debtId]);

        res.json({ success: true, message: newStatus === 'paid' ? 'ชำระหนี้ครบถ้วนแล้ว!' : 'บันทึกยอดชำระบางส่วนแล้ว' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// DELETE /api/debts/:id — ลบรายการหนี้
// --------------------------------------------------
router.delete('/:id', async (req, res) => {
    try {
        await db.query('BEGIN');
        
        // ตรวจสอบว่าหนี้นี้เชื่อมกับบิลขาย (sale) หรือไม่
        const debtResult = await db.query('SELECT sale_id FROM debts WHERE id = $1', [req.params.id]);
        if (debtResult.rows.length === 0) {
            throw new Error('ไม่พบข้อมูลหนี้');
        }
        
        const saleId = debtResult.rows[0].sale_id;

        await db.query('DELETE FROM debt_reminders WHERE debt_id = $1', [req.params.id]);
        await db.query('DELETE FROM debts WHERE id = $1', [req.params.id]);
        
        // ถ้ามี sale_id ให้ลบบิลขายและคืนสต๊อก
        if (saleId) {
            const itemsResult = await db.query('SELECT product_id, quantity FROM sale_items WHERE sale_id = $1', [saleId]);
            for (const item of itemsResult.rows) {
                await db.query(`UPDATE products SET stock_qty = stock_qty + $1 WHERE id = $2`, [item.quantity, item.product_id]);
            }
            await db.query('DELETE FROM sale_items WHERE sale_id = $1', [saleId]);
            await db.query('DELETE FROM sales WHERE id = $1', [saleId]);
        }

        await db.query('COMMIT');
        res.json({ success: true, message: 'ลบรายการหนี้สำเร็จ' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;