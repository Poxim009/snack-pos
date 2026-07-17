const express = require('express');
const router = express.Router();
const db = require('../database/db');

// --------------------------------------------------
// GET /api/customers — ดึงรายชื่อลูกค้าทั้งหมด
// --------------------------------------------------
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM customers ORDER BY display_name ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// POST /api/customers — เพิ่มลูกค้าใหม่ (แมนวล)
// ปกติถ้าแอด LINE จะเข้าตารางนี้อัตโนมัติ แต่เผื่ออยากเพิ่มเอง
// --------------------------------------------------
router.post('/', async (req, res) => {
    const { display_name, phone, note } = req.body;
    
    if (!display_name) {
        return res.status(400).json({ error: 'กรุณาระบุชื่อลูกค้า' });
    }

    try {
        const result = await db.query(`
            INSERT INTO customers (display_name, phone, note)
            VALUES ($1, $2, $3)
            RETURNING id
        `, [display_name, phone || '', note || '']);
        
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;