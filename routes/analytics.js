const express = require('express');
const router = express.Router();
const db = require('../database/db');

// --------------------------------------------------
// GET /api/analytics/summary — สรุปยอดรวม
// --------------------------------------------------
router.get('/summary', async (req, res) => {
    const period = req.query.period || 'today';
    const today = new Date().toISOString().split('T')[0];

    let dateFrom, dateTo;

    if (period === 'today') {
        dateFrom = today;
        dateTo = today;
    } else if (period === 'week') {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        dateFrom = monday.toISOString().split('T')[0];
        dateTo = today;
    } else if (period === 'month') {
        dateFrom = today.substring(0, 7) + '-01';
        dateTo = today;
    }

    try {
        const salesResult = await db.query(
            'SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE date BETWEEN $1 AND $2',
            [dateFrom, dateTo]
        );
        const salesTotal = salesResult.rows[0].total;

        const cogsResult = await db.query(`
            SELECT COALESCE(SUM(si.quantity * p.cost_price), 0) as total
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN products p ON si.product_id = p.id
            WHERE s.date BETWEEN $1 AND $2
        `, [dateFrom, dateTo]);
        const cogsTotal = cogsResult.rows[0].total;

        const expensesResult = await db.query(
            'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date BETWEEN $1 AND $2',
            [dateFrom, dateTo]
        );
        const expensesTotal = expensesResult.rows[0].total;

        const totalCosts = cogsTotal + expensesTotal;
        const profit = salesTotal - totalCosts;
        const profitMargin = salesTotal > 0 ? ((profit / salesTotal) * 100).toFixed(1) : 0;

        res.json({
            period,
            date_from: dateFrom,
            date_to: dateTo,
            total_sales: salesTotal,
            total_cogs: cogsTotal,
            total_expenses: expensesTotal,
            total_costs: totalCosts,
            profit,
            profit_margin: profitMargin
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// GET /api/analytics/top-products — สินค้าขายดี TOP 5
// --------------------------------------------------
router.get('/top-products', async (req, res) => {
    const period = req.query.period || 'week';
    const today = new Date().toISOString().split('T')[0];
    let dateFrom;

    if (period === 'today') {
        dateFrom = today;
    } else if (period === 'week') {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        dateFrom = monday.toISOString().split('T')[0];
    } else {
        dateFrom = today.substring(0, 7) + '-01';
    }

    try {
        const result = await db.query(`
            SELECT 
                si.product_name,
                SUM(si.quantity) as total_qty,
                SUM(si.subtotal) as total_revenue
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.date BETWEEN $1 AND $2
            GROUP BY si.product_name
            ORDER BY total_qty DESC
            LIMIT 5
        `, [dateFrom, today]);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// GET /api/analytics/daily — ยอดขายรายวัน (สำหรับกราฟ)
// --------------------------------------------------
router.get('/daily', async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const now = new Date();
    const results = [];
    const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

    try {
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            const salesRes = await db.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE date = $1', [dateStr]);
            const expensesRes = await db.query('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date = $1', [dateStr]);
            const cogsRes = await db.query(`
                SELECT COALESCE(SUM(si.quantity * p.cost_price), 0) as total
                FROM sale_items si
                JOIN sales s ON si.sale_id = s.id
                LEFT JOIN products p ON si.product_id = p.id
                WHERE s.date = $1
            `, [dateStr]);

            const salesTotal = salesRes.rows[0].total;
            const expensesTotal = expensesRes.rows[0].total;
            const cogsTotal = cogsRes.rows[0].total;
            const totalCosts = cogsTotal + expensesTotal;

            results.push({
                date: dateStr,
                day_name: dayNames[d.getDay()],
                sales: salesTotal,
                cogs: cogsTotal,
                expenses: expensesTotal,
                total_costs: totalCosts,
                profit: salesTotal - totalCosts
            });
        }
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// GET /api/analytics/calendar — ดึงข้อมูลรายวันสำหรับปฏิทิน (ทั้งเดือน)
// --------------------------------------------------
router.get('/calendar', async (req, res) => {
    const { year, month } = req.query;
    const now = new Date();
    const y = parseInt(year) || now.getFullYear();
    const m = parseInt(month) || (now.getMonth() + 1);

    // ช่วงวันที่ทั้งเดือน
    const firstDay = `${y}-${String(m).padStart(2,'0')}-01`;
    const lastDay = new Date(y, m, 0).toISOString().split('T')[0];

    try {
        // รวมยอดขายแต่ละวัน
        const salesRes = await db.query(`
            SELECT date, COALESCE(SUM(total_amount),0) as total_sales, COUNT(*) as bill_count
            FROM sales
            WHERE date BETWEEN $1 AND $2
            GROUP BY date
        `, [firstDay, lastDay]);

        // รวมรายจ่ายแต่ละวัน
        const expRes = await db.query(`
            SELECT date, COALESCE(SUM(amount),0) as total_expenses
            FROM expenses
            WHERE date BETWEEN $1 AND $2
            GROUP BY date
        `, [firstDay, lastDay]);

        // รวมข้อมูลเป็น map
        const dataMap = {};
        salesRes.rows.forEach(r => {
            dataMap[r.date] = { ...dataMap[r.date], total_sales: parseFloat(r.total_sales), bill_count: parseInt(r.bill_count) };
        });
        expRes.rows.forEach(r => {
            dataMap[r.date] = { ...dataMap[r.date], total_expenses: parseFloat(r.total_expenses) };
        });

        res.json(dataMap);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// GET /api/analytics/daily-details — ดูรายละเอียดทุกรายการในวันนั้น
// --------------------------------------------------
router.get('/daily-details', async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'กรุณาระบุวันที่' });

    try {
        // บิลขายทั้งหมดของวันนั้น + รายการสินค้าในแต่ละบิล
        const salesRes = await db.query(`
            SELECT s.id, s.total_amount, s.note, s.created_at,
                   JSON_AGG(
                       JSON_BUILD_OBJECT(
                           'product_name', si.product_name,
                           'quantity', si.quantity,
                           'unit_price', si.unit_price,
                           'subtotal', si.subtotal
                       ) ORDER BY si.id
                   ) as items
            FROM sales s
            LEFT JOIN sale_items si ON s.id = si.sale_id
            WHERE s.date = $1
            GROUP BY s.id
            ORDER BY s.created_at ASC
        `, [date]);

        // รายจ่ายของวันนั้น
        const expRes = await db.query(`
            SELECT e.id, e.description, e.amount, e.note, e.created_at,
                   c.name as category_name, c.emoji as category_emoji
            FROM expenses e
            LEFT JOIN expense_categories c ON e.category_id = c.id
            WHERE e.date = $1
            ORDER BY e.created_at ASC
        `, [date]);

        // Peak hour analysis
        const peakRes = await db.query(`
            SELECT EXTRACT(HOUR FROM s.created_at AT TIME ZONE 'Asia/Bangkok') as hour,
                   COUNT(*) as bill_count,
                   COALESCE(SUM(s.total_amount), 0) as total
            FROM sales s
            WHERE s.date = $1
            GROUP BY hour
            ORDER BY total DESC
        `, [date]);

        // Top items of the day
        const topItemsRes = await db.query(`
            SELECT si.product_name, SUM(si.quantity) as total_qty, SUM(si.subtotal) as total_revenue
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.date = $1
            GROUP BY si.product_name
            ORDER BY total_qty DESC
            LIMIT 5
        `, [date]);

        res.json({
            date,
            sales: salesRes.rows,
            expenses: expRes.rows,
            peak_hours: peakRes.rows,
            top_items: topItemsRes.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;