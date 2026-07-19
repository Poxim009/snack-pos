const cron = require('node-cron');
const db = require('./database/db');
require('dotenv').config();

// ใช้ fetch ภายใน Node.js เพื่อเรียก API ตัวเอง
// (ถ้า Node version เก่า อาจจะต้องใช้ axios หรือ node-fetch)
// สมมติว่ารันอยู่บนพอร์ต 3000
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

console.log('⏰ เริ่มต้นระบบ Cron Job เช็คหนี้อัตโนมัติ');

// รันทุกๆ 1 นาที
cron.schedule('* * * * *', async () => {
    try {
        // หาวันที่และเวลาปัจจุบัน แบบ local time (อิงตาม timezone เครื่อง)
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); // HH:MM
        
        // 1. หาหนี้ที่ถึงกำหนดเวลา หรือเลยเวลามาแล้ว และยังไม่ได้ส่งตามความถี่
        // เงื่อนไข:
        // - status in ('pending', 'partial') (ยังค้างจ่าย)
        // - auto_remind = 1 (ต้องการให้ทวงอัตโนมัติ)
        // - ลูกค้ามี line_user_id (สามารถส่ง LINE ได้)
        
        const query = `
            SELECT d.id, d.due_date, d.remind_time, d.remind_frequency, d.last_reminded_at
            FROM debts d
            JOIN customers c ON d.customer_id = c.id
            WHERE d.status IN ('pending', 'partial')
            AND d.auto_remind = 1
            AND c.line_user_id IS NOT NULL
            AND c.line_user_id != ''
        `;
        
        const res = await db.query(query);
        const debts = res.rows;
        
        for (const debt of debts) {
            // เช็คว่าถึงเวลาของวันนี้หรือยัง?
            if (timeStr >= debt.remind_time) {
                
                let shouldSend = false;
                
                if (!debt.last_reminded_at) {
                    // ไม่เคยส่งเลย ส่งเลย
                    shouldSend = true;
                } else {
                    // เคยส่งแล้ว เช็คว่าห่างจากครั้งล่าสุดเท่ากับความถี่ (remind_frequency) หรือยัง
                    const lastReminded = new Date(debt.last_reminded_at);
                    // ตัดเวลาออก คิดเฉพาะวันที่
                    lastReminded.setHours(0,0,0,0);
                    
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    
                    // คำนวณความต่างของวัน
                    const diffTime = Math.abs(today - lastReminded);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays >= debt.remind_frequency) {
                        shouldSend = true;
                    }
                }
                
                if (shouldSend) {
                    console.log(`[Cron] ทวงหนี้ ID ${debt.id} ถึงกำหนดแล้ว`);
                    
                    // เรียก API ภายในเพื่อส่งข้อความ
                    // การเรียก API ภายในจะช่วย reuse โค้ดส่งข้อความใน routes/line.js ได้
                    try {
                        const response = await fetch(`${BASE_URL}/api/line/send-reminder`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ debt_id: debt.id })
                        });
                        const data = await response.json();
                        if (data.success) {
                            console.log(`[Cron] ส่งไลน์สำเร็จ ID ${debt.id}`);
                        } else {
                            console.error(`[Cron] ส่งไลน์ล้มเหลว ID ${debt.id}:`, data.error);
                        }
                    } catch (fetchErr) {
                        console.error(`[Cron] เกิดข้อผิดพลาดตอนเรียก API ภายใน:`, fetchErr.message);
                    }
                }
            }
        }

    } catch (err) {
        console.error('Cron Error:', err);
    }
});
