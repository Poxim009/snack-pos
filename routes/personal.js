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

            CREATE TABLE IF NOT EXISTS personal_wallets (
                id            SERIAL PRIMARY KEY,
                name          TEXT    NOT NULL,
                emoji         TEXT    DEFAULT '👛',
                initial_balance REAL  NOT NULL DEFAULT 0,
                color         TEXT    DEFAULT '#6366F1',
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS personal_transactions (
                id          SERIAL PRIMARY KEY,
                wallet_id   INTEGER REFERENCES personal_wallets(id) ON DELETE SET NULL,
                category_id INTEGER REFERENCES personal_categories(id) ON DELETE SET NULL,
                type        TEXT    NOT NULL,
                amount      REAL    NOT NULL,
                description TEXT    DEFAULT '',
                date        TEXT    NOT NULL,
                note        TEXT    DEFAULT '',
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // เพิ่มคอลัมน์ wallet_id ถ้ายังไม่มี (สำหรับฐานข้อมูลเก่า)
        try {
            await db.query(`ALTER TABLE personal_transactions ADD COLUMN IF NOT EXISTS wallet_id INTEGER REFERENCES personal_wallets(id) ON DELETE SET NULL`);
        } catch(e) { /* ไม่สนใจถ้ามีอยู่แล้ว */ }

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

        // สร้าง "บัญชีหลัก" ถ้ายังไม่มีกระเป๋าเลย
        const walletCheck = await db.query('SELECT COUNT(*) FROM personal_wallets');
        if (parseInt(walletCheck.rows[0].count) === 0) {
            const defaultWallet = await db.query(`
                INSERT INTO personal_wallets (name, emoji, initial_balance, color)
                VALUES ('บัญชีหลัก', '🏦', 0, '#6366F1') RETURNING id
            `);
            // ย้ายรายการเก่าทั้งหมดเข้าบัญชีหลัก
            await db.query('UPDATE personal_transactions SET wallet_id = $1 WHERE wallet_id IS NULL', [defaultWallet.rows[0].id]);
        }
    } catch (err) {
        console.error('Error initializing personal tables:', err);
    }
}

// เรียกให้สร้างตารางทันทีที่เก็ทเข้าโมดูล
initPersonalTables();

// --------------------------------------------------
// GET /api/personal/wallets — ดึงกระเป๋าเงินทั้งหมด พร้อมยอดคงเหลือ
// --------------------------------------------------
router.get('/wallets', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                w.*,
                COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
                COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense,
                w.initial_balance + COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0)
                    - COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as balance
            FROM personal_wallets w
            LEFT JOIN personal_transactions t ON t.wallet_id = w.id
            GROUP BY w.id
            ORDER BY w.id ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// POST /api/personal/wallets — สร้างกระเป๋าใหม่
// --------------------------------------------------
router.post('/wallets', async (req, res) => {
    const { name, emoji, initial_balance, color } = req.body;
    if (!name) return res.status(400).json({ error: 'กรุณาระบุชื่อกระเป๋า' });
    try {
        const result = await db.query(
            'INSERT INTO personal_wallets (name, emoji, initial_balance, color) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, emoji || '👛', parseFloat(initial_balance) || 0, color || '#6366F1']
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// DELETE /api/personal/wallets/:id — ลบกระเป๋า
// --------------------------------------------------
router.delete('/wallets/:id', async (req, res) => {
    try {
        const count = await db.query('SELECT COUNT(*) FROM personal_wallets');
        if (parseInt(count.rows[0].count) <= 1) {
            return res.status(400).json({ error: 'ไม่สามารถลบกระเป๋าสุดท้ายได้ ต้องมีอย่างน้อย 1 กระเป๋า' });
        }
        await db.query('DELETE FROM personal_wallets WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
        // ยอดตั้งต้นรวมของทุกกระเป๋า (เฉพาะตอนดูภาพรวมทั้งหมด ไม่ filter by date)
        const initialQuery = `SELECT COALESCE(SUM(initial_balance), 0) as total FROM personal_wallets`;

        const incomeRes = await db.query(incomeQuery, params);
        const expenseRes = await db.query(expenseQuery, params);
        const initialRes = await db.query(initialQuery);

        const totalIncome = parseFloat(incomeRes.rows[0].total) || 0;
        const totalExpense = parseFloat(expenseRes.rows[0].total) || 0;
        const totalInitial = (!month && !date) ? (parseFloat(initialRes.rows[0].total) || 0) : 0;
        const balance = totalInitial + totalIncome - totalExpense;

        res.json({
            total_income: totalIncome,
            total_expense: totalExpense,
            total_initial: totalInitial,
            balance: balance
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// GET /api/personal/calendar — ข้อมูลรายวันประจำเดือนสำหรับวาดปฏิทิน
// --------------------------------------------------
router.get('/calendar', async (req, res) => {
    const { year, month } = req.query;
    if (!year || !month) {
        return res.status(400).json({ error: 'กรุณาระบุ year และ month' });
    }
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    try {
        const result = await db.query(`
            SELECT 
                date,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as daily_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as daily_expense
            FROM personal_transactions
            WHERE date LIKE $1
            GROUP BY date
        `, [`${monthStr}%`]);

        const calendarData = {};
        result.rows.forEach(row => {
            const income = parseFloat(row.daily_income) || 0;
            const expense = parseFloat(row.daily_expense) || 0;
            calendarData[row.date] = {
                income,
                expense,
                balance: income - expense
            };
        });

        res.json({ month: monthStr, days: calendarData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// GET /api/personal/daily-details — ดึงรายละเอียดทั้งหมดของเฉพาะวันนั้น
// --------------------------------------------------
router.get('/daily-details', async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ error: 'กรุณาระบุ date' });
    }

    try {
        const itemsRes = await db.query(`
            SELECT t.*, c.name as category_name, c.emoji as category_emoji
            FROM personal_transactions t
            LEFT JOIN personal_categories c ON t.category_id = c.id
            WHERE t.date = $1
            ORDER BY t.created_at ASC, t.id ASC
        `, [date]);

        let totalIncome = 0;
        let totalExpense = 0;

        itemsRes.rows.forEach(t => {
            if (t.type === 'income') totalIncome += parseFloat(t.amount);
            if (t.type === 'expense') totalExpense += parseFloat(t.amount);
        });

        res.json({
            date: date,
            summary: {
                total_income: totalIncome,
                total_expense: totalExpense,
                balance: totalIncome - totalExpense
            },
            items: itemsRes.rows
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
    const { wallet_id, category_id, type, amount, description, date, note } = req.body;

    if (!type || !amount) {
        return res.status(400).json({ error: 'กรุณาระบุประเภทและจำนวนเงิน' });
    }

    const txDate = date || new Date().toISOString().split('T')[0];

    // ถ้าไม่ระบุ wallet_id ให้ใช้กระเป๋าแรกที่มีในระบบ
    let finalWalletId = wallet_id || null;
    if (!finalWalletId) {
        const defaultWallet = await db.query('SELECT id FROM personal_wallets ORDER BY id ASC LIMIT 1');
        if (defaultWallet.rows.length > 0) finalWalletId = defaultWallet.rows[0].id;
    }

    try {
        const result = await db.query(`
            INSERT INTO personal_transactions (wallet_id, category_id, type, amount, description, date, note)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [finalWalletId, category_id || null, type, parseFloat(amount), description || '', txDate, note || '']);

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
