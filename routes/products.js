const express = require('express');
const router = express.Router();
const db = require('../database/db');

// --------------------------------------------------
// หมวดหมู่สินค้า (Categories)
// --------------------------------------------------

// GET /api/products/categories — ดึงหมวดหมู่ทั้งหมด
router.get('/categories', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM product_categories ORDER BY sort_order ASC, id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/products/categories — เพิ่มหมวดหมู่ใหม่
router.post('/categories', async (req, res) => {
    const { name, emoji } = req.body;
    if (!name) return res.status(400).json({ error: 'กรุณาระบุชื่อหมวดหมู่' });

    try {
        const result = await db.query(
            'INSERT INTO product_categories (name, emoji) VALUES ($1, $2) RETURNING id',
            [name, emoji || '📦']
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// สินค้า (Products)
// --------------------------------------------------

// GET /api/products — ดึงรายการสินค้าทั้งหมดที่ยังขายอยู่
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, c.name as category_name 
            FROM products p
            LEFT JOIN product_categories c ON p.category_id = c.id
            WHERE p.is_active = 1
            ORDER BY p.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/products — เพิ่มสินค้าใหม่
router.post('/', async (req, res) => {
    const { category_id, name, emoji, sell_price, cost_price, stock_qty, image_url } = req.body;
    
    if (!name || sell_price === undefined) {
        return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน (ต้องมีชื่อและราคาขาย)' });
    }

    try {
        const result = await db.query(`
            INSERT INTO products (category_id, name, emoji, sell_price, cost_price, stock_qty, image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [
            category_id || null, 
            name, 
            emoji || '🍪', 
            sell_price, 
            cost_price || 0, 
            stock_qty || 0,
            image_url || ''
        ]);
        
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/products/:id — ลบสินค้า (ใช้ซ่อนแทนลบจริง ป้องกันบิลเก่าพัง)
router.delete('/:id', async (req, res) => {
    try {
        await db.query('UPDATE products SET is_active = 0 WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'ลบสินค้าเรียบร้อย' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// PATCH /api/products/:id/stock — เพิ่ม/ลดสต๊อกแบบด่วน
router.patch('/:id/stock', async (req, res) => {
    const { qty } = req.body;
    
    if (qty === undefined || isNaN(qty)) {
        return res.status(400).json({ error: 'กรุณาระบุจำนวนสต๊อกที่ถูกต้อง' });
    }

    try {
        await db.query(`
            UPDATE products 
            SET stock_qty = stock_qty + $1 
            WHERE id = $2
        `, [qty, req.params.id]);
        
        res.json({ success: true, message: 'อัปเดตสต๊อกเรียบร้อย' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;