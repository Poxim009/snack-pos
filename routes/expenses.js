const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../database/db');

// --- ตั้งค่า multer: เก็บรูปไว้ที่ไหน ชื่อไฟล์เป็นอะไร ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const fs = require('fs');
        const glitchUploadsDir = path.join(__dirname, '..', '.data', 'uploads', 'receipts');
        let uploadDir = path.join(__dirname, '..', 'uploads', 'receipts');
        
        if (fs.existsSync(path.join(__dirname, '..', '.data'))) {
            if (!fs.existsSync(glitchUploadsDir)) fs.mkdirSync(glitchUploadsDir, { recursive: true });
            uploadDir = glitchUploadsDir;
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --------------------------------------------------
// หมวดหมู่รายจ่าย (Categories)
// --------------------------------------------------

router.get('/categories', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM expense_categories ORDER BY sort_order ASC, id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/categories', async (req, res) => {
    const { name, emoji } = req.body;
    if (!name) return res.status(400).json({ error: 'กรุณาระบุชื่อหมวดหมู่' });

    try {
        const result = await db.query(
            'INSERT INTO expense_categories (name, emoji) VALUES ($1, $2) RETURNING id',
            [name, emoji || '💸']
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// รายจ่าย (Expenses)
// --------------------------------------------------

router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT e.*, c.name as category_name, c.emoji as category_emoji
            FROM expenses e
            LEFT JOIN expense_categories c ON e.category_id = c.id
            ORDER BY e.date DESC, e.id DESC
            LIMIT 50
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', upload.single('image'), async (req, res) => {
    const { category_id, date, description, amount, note } = req.body;
    
    if (!description || !amount) {
        return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน (ต้องมีรายละเอียดและจำนวนเงิน)' });
    }

    const today = new Date().toISOString().split('T')[0];
    const expenseDate = date || today;
    const imagePath = req.file ? `/uploads/receipts/${req.file.filename}` : '';

    try {
        const result = await db.query(`
            INSERT INTO expenses (category_id, date, description, amount, image_path, note)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [
            category_id || null, 
            expenseDate, 
            description, 
            parseFloat(amount), 
            imagePath, 
            note || ''
        ]);
        
        res.json({ success: true, id: result.rows[0].id, message: 'บันทึกรายจ่ายสำเร็จ' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'ลบรายจ่ายเรียบร้อย' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;