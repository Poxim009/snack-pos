// ============================================================
// server.js — สมองหลักของแอป
// ============================================================

// --- โหลดเครื่องมือ ---
require('dotenv').config();         // อ่านไฟล์ .env (รหัส LINE)
const express = require('express'); // สร้าง web server
const cors = require('cors');       // อนุญาตให้ frontend เข้าถึง backend
const path = require('path');       // จัดการ path ไฟล์

// --- สร้าง server ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- ตั้งค่า middleware ---
// middleware = "ตัวกรอง" ที่ทำงานก่อนทุก request
app.use(cors());                                        // อนุญาตทุก domain
app.use((req, res, next) => {
    if (req.originalUrl === '/api/line/webhook') {
        next(); // ปล่อยผ่านให้ LINE SDK จัดการ body เอง
    } else {
        express.json()(req, res, (err) => {
            if (err) return next(err);
            express.urlencoded({ extended: true })(req, res, next);
        });
    }
});
app.use(express.static(path.join(__dirname, 'public'))); // เสิร์ฟไฟล์ frontend

// --- เสิร์ฟรูปที่ upload ---
const fs = require('fs');
const glitchUploadsDir = path.join(__dirname, '.data', 'uploads');
let uploadsDir = path.join(__dirname, 'uploads');

if (fs.existsSync(path.join(__dirname, '.data'))) {
    if (!fs.existsSync(glitchUploadsDir)) fs.mkdirSync(glitchUploadsDir, { recursive: true });
    uploadsDir = glitchUploadsDir;
}

app.use('/uploads', express.static(uploadsDir));

// --- โหลดฐานข้อมูล ---
const db = require('./database/db');
console.log('💾 เชื่อมต่อฐานข้อมูลเรียบร้อย');

// --- โหลด API routes ---
// แต่ละไฟล์จัดการเรื่องแต่ละอย่าง (จะสร้างในสเต็ปถัดไป)
app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/debts', require('./routes/debts'));
app.use('/api/line', require('./routes/line'));

// --- Health Check: เช็คสถานะ DB ---
app.get('/api/health', async (req, res) => {
    const envStatus = {
        DB_HOST: process.env.DB_HOST ? `SET (${process.env.DB_HOST})` : 'NOT SET',
        DB_PORT: process.env.DB_PORT ? `SET (${process.env.DB_PORT})` : 'NOT SET',
        DB_USER: process.env.DB_USER ? `SET (${process.env.DB_USER})` : 'NOT SET',
        DB_PASSWORD: process.env.DB_PASSWORD ? `SET (length: ${process.env.DB_PASSWORD.length})` : 'NOT SET',
        DB_NAME: process.env.DB_NAME ? `SET (${process.env.DB_NAME})` : 'NOT SET',
        SUPABASE_DB_URL: process.env.SUPABASE_DB_URL ? 'SET' : 'NOT SET',
    };

    let dbTest = 'NOT TESTED';
    let tables = [];
    try {
        const result = await db.query('SELECT 1 as ok');
        dbTest = 'CONNECTED OK';
        // Check tables
        const tablesResult = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        tables = tablesResult.rows.map(r => r.table_name);
    } catch (e) {
        dbTest = `FAILED: ${e.message || e.code || JSON.stringify(e)}`;
    }

    res.json({ env: envStatus, db: dbTest, tables });
});

// --- Route หลัก: ส่งหน้า index.html ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- เปิด server ---
app.listen(PORT, () => {
    console.log('');
    console.log('🍪 ========================================');
    console.log('🍪  ระบบคิดตังแบบโหด');
    console.log(`🍪  เปิดแอปที่: http://localhost:${PORT}`);
    console.log('🍪 ========================================');
    console.log('');
});