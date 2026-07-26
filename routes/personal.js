const express = require('express');
const router = express.Router();
const db = require('../database/db');

// --------------------------------------------------
// ระบบตารางและหมวดหมู่เริ่มต้นอัตโนมัติ
// --------------------------------------------------
async function initPersonalTables() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS personal_categories (
                id         SERIAL PRIMARY KEY,
                name       TEXT    NOT NULL,
                type       TEXT    NOT NULL,
                emoji      TEXT    DEFAULT '👛',
                sort_order INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS personal_transactions (
                id          SERIAL PRIMARY KEY,
                category_id INTEGER REFERENCES personal_categories(id) ON DELETE SET NULL,
                type        TEXT    NOT NULL,
                amount      REAL    NOT NULL,
                description TEXT    DEFAULT '',
                date        TEXT    NOT NULL,
                note        TEXT    DEFAULT '',
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // เช็คว่ามีหมวดหมู่อยู่แล้วหรือไม่ ถ้ายังไม่มีให้สร้างเริ่มต้น
        const catCheck = await db.query('SELECT COUNT(*) FROM personal_categories');
        if (parseInt(catCheck.rows[0].count) === 0) {
            await db.query(`
                INSERT INTO personal_categories (name, type, emoji, sort_order) VALUES
                ('ค่าอาหาร / เครื่องดื่ม', 'expense', '🍔', 1),
                ('ค่าเดินทาง / ค่ารถ', 'expense', '🚗', 2),
                ('เครื่องเขียน / เรียน', 'expense', '📚', 3),
                ('ความบันเทิง / ช้อปปิ้ง', 'expense', '🎮', 4),
                ('ของใช้ส่วนตัว / จิปาถะ', 'expense', '🛍️', 5),
                ('เงินค่าขนม / ผู้ปกครอง', 'income', '💰', 6),
                ('รับจ้าง / งานเสริม', 'income', '💼', 7),
                ('รายรับอื่นๆ', 'income', '🎁', 8);
            `);
        }
    } catch (err) {
        console.error('Error initializing personal tables:', err);
    }
}

// เรียกให้สร้างตารางทันทีที่เก็ทเข้าโมดูล
initPersonalTables();

// --------------------------------------------------
// GET /api/personal/categories — ดึงหมวดหมู่ทั้งหมด
// --------------------------------------------------
router.get('/categories', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM personal_categories ORDER BY sort_order ASC, id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// POST /api/personal/categories — เพิ่มหมวดหมู่ใหม่
// --------------------------------------------------
router.post('/categories', async (req, res) => {
    const { name, type, emoji } = req.body;
    if (!name || !type) {
        return res.status(400).json({ error: 'กรุณาระบุชื่อและประเภทหมวดหมู่' });
    }
    try {
        const result = await db.query(
            'INSERT INTO personal_categories (name, type, emoji) VALUES ($1, $2, $3) RETURNING *',
            [name, type, emoji || '👛']
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// GET /api/personal/summary — สรุปรายรับ รายจ่าย ยอดคงเหลือ
// --------------------------------------------------
router.get('/summary', async (req, res) => {
    const { month, date } = req.query;
    try {
        let whereClause = '';
        let params = [];

        if (date) {
            whereClause = 'WHERE date = $1';
            params.push(date);
        } else if (month) {
            whereClause = 'WHERE date LIKE $1';
            params.push(`${month}%`);
        }

        const incomeQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM personal_transactions ${whereClause ? whereClause + ' AND' : 'WHERE'} type = 'income'`;
        const expenseQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM personal_transactions ${whereClause ? whereClause + ' AND' : 'WHERE'} type = 'expense'`;

        const incomeRes = await db.query(incomeQuery, params);
        const expenseRes = await db.query(expenseQuery, params);

        const totalIncome = parseFloat(incomeRes.rows[0].total) || 0;
        const totalExpense = parseFloat(expenseRes.rows[0].total) || 0;
        const balance = totalIncome - totalExpense;

        res.json({
            total_income: totalIncome,
            total_expense: totalExpense,
            balance: balance
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// GET /api/personal/transactions — ดึงประวัติรายการ
// --------------------------------------------------
router.get('/transactions', async (req, res) => {
    const { month, date } = req.query;
    try {
        let queryStr = `
            SELECT t.*, c.name as category_name, c.emoji as category_emoji
            FROM personal_transactions t
            LEFT JOIN personal_categories c ON t.category_id = c.id
        `;
        let params = [];

        if (date) {
            queryStr += ' WHERE t.date = $1';
            params.push(date);
        } else if (month) {
            queryStr += ' WHERE t.date LIKE $1';
            params.push(`${month}%`);
        }

        queryStr += ' ORDER BY t.date DESC, t.id DESC LIMIT 100';

        const result = await db.query(queryStr, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// POST /api/personal/transactions — บันทึกรายการใหม่
// --------------------------------------------------
router.post('/transactions', async (req, res) => {
    const { category_id, type, amount, description, date, note } = req.body;

    if (!type || !amount) {
        return res.status(400).json({ error: 'กรุณาระบุประเภทและจำนวนเงิน' });
    }

    const txDate = date || new Date().toISOString().split('T')[0];

    try {
        const result = await db.query(`
            INSERT INTO personal_transactions (category_id, type, amount, description, date, note)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [category_id || null, type, parseFloat(amount), description || '', txDate, note || '']);

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// DELETE /api/personal/transactions/:id — ลบรายการ
// --------------------------------------------------
router.delete('/transactions/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM personal_transactions WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'ลบรายการสำเร็จ' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
