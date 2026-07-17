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
app.use(express.json());                                // รับข้อมูล JSON ได้
app.use(express.urlencoded({ extended: true }));         // รับข้อมูลจาก form ได้
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