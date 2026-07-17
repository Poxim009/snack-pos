const express = require('express');
const router = express.Router();
const line = require('@line/bot-sdk');
const db = require('../database/db');
require('dotenv').config();

// ตั้งค่า LINE
const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET
};

const isLineConfigured = !!(lineConfig.channelAccessToken && lineConfig.channelSecret);
const client = isLineConfigured ? new line.Client(lineConfig) : null;

// --------------------------------------------------
// GET /api/line/status — เช็คว่าตั้งค่า LINE หรือยัง
// --------------------------------------------------
router.get('/status', (req, res) => {
    res.json({ configured: isLineConfigured });
});

const webhookMiddleware = isLineConfigured ? line.middleware(lineConfig) : (req, res, next) => next();

// --------------------------------------------------
// POST /api/line/webhook — รับข้อความ/เหตุการณ์จาก LINE
// --------------------------------------------------
router.post('/webhook', webhookMiddleware, async (req, res) => {
    if (!isLineConfigured) return res.status(400).send('LINE not configured');
    try {
        const events = req.body.events;
        await Promise.all(events.map(handleEvent));
        res.status(200).send('OK');
    } catch (err) {
        console.error('Webhook Error:', err);
        res.status(500).end();
    }
});

// ฟังก์ชันจัดการเหตุการณ์จาก LINE
async function handleEvent(event) {
    if (event.type === 'follow') {
        // เมื่อมีคนแอดเพิ่มเพื่อน
        const userId = event.source.userId;
        const profile = await client.getProfile(userId);
        
        try {
            // เช็คว่ามีในระบบไหม ถ้ามีแค่อัปเดตสถานะ ถ้าไม่มีให้เพิ่มใหม่
            const existingRes = await db.query('SELECT * FROM customers WHERE line_user_id = $1', [userId]);
            const existing = existingRes.rows[0];
            
            if (existing) {
                await db.query(`
                    UPDATE customers 
                    SET is_line_friend = 1, display_name = $1, picture_url = $2 
                    WHERE line_user_id = $3
                `, [profile.displayName, profile.pictureUrl, userId]);
            } else {
                await db.query(`
                    INSERT INTO customers (display_name, line_user_id, picture_url, is_line_friend)
                    VALUES ($1, $2, $3, 1)
                    ON CONFLICT (line_user_id) DO NOTHING
                `, [profile.displayName, userId, profile.pictureUrl]);
            }
            
            // ส่งข้อความต้อนรับ
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: `สวัสดีจ้า 🍪 ยินดีต้อนรับสู่ร้านขนมของเรา ขอบคุณที่แอดเราเป็นเพื่อนนะ!`
            });
        } catch (error) {
            console.error('DB Error on follow:', error);
        }
    } 
    else if (event.type === 'unfollow') {
        const userId = event.source.userId;
        await db.query('UPDATE customers SET is_line_friend = 0 WHERE line_user_id = $1', [userId]);
    }
}

// --------------------------------------------------
// POST /api/line/send-reminder — ทวงหนี้ผ่าน LINE
// --------------------------------------------------
router.post('/send-reminder', async (req, res) => {
    if (!isLineConfigured) return res.status(400).json({ error: 'ยังไม่ได้ตั้งค่า LINE OA' });

    const { debt_id } = req.body;
    
    try {
        const debtRes = await db.query(`
            SELECT d.*, c.line_user_id, c.display_name 
            FROM debts d
            JOIN customers c ON d.customer_id = c.id
            WHERE d.id = $1
        `, [debt_id]);
        
        const debt = debtRes.rows[0];

        if (!debt) return res.status(404).json({ error: 'ไม่พบข้อมูลหนี้' });
        if (!debt.line_user_id) return res.status(400).json({ error: 'ลูกค้านี้ยังไม่ได้เชื่อม LINE' });
        
        const remaining = debt.amount - debt.paid_amount;
        if (remaining <= 0) return res.status(400).json({ error: 'หนี้นี้จ่ายครบแล้ว' });

        // ข้อความทวงหนี้ (แก้คำพูดได้)
        const message = {
            type: 'flex',
            altText: 'บิลเรียกเก็บเงิน 💸',
            contents: {
                type: "bubble",
                header: {
                    type: "box",
                    layout: "vertical",
                    contents: [{
                        type: "text",
                        text: "แจ้งเตือนยอดค้างชำระ",
                        weight: "bold",
                        color: "#ffffff",
                        size: "lg"
                    }],
                    backgroundColor: "#EF4444"
                },
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: `สวัสดีคุณ ${debt.display_name}`, margin: "md" },
                        { type: "text", text: "คุณมียอดค้างชำระกับทางร้าน", margin: "sm" },
                        { type: "text", text: `ยอดค้าง: ฿${remaining}`, weight: "bold", size: "xl", color: "#EF4444", margin: "md" },
                        { type: "text", text: `รายละเอียด: ${debt.items_description || '-'}`, size: "sm", color: "#666666", margin: "sm", wrap: true }
                    ]
                },
                footer: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        {
                            type: "button",
                            style: "primary",
                            color: "#10B981",
                            action: {
                                type: "message",
                                label: "โอนเงินแล้ว",
                                text: "โอนเงินแล้วจ้า"
                            }
                        }
                    ]
                }
            }
        };

        // ส่งข้อความไปหาลูกค้า
        await client.pushMessage(debt.line_user_id, message);

        // อัปเดตเวลาที่ส่งล่าสุดลง Database
        const now = new Date().toISOString();
        await db.query('UPDATE debts SET last_reminded_at = $1 WHERE id = $2', [now, debt_id]);
        
        // บันทึกประวัติ
        await db.query(`
            INSERT INTO debt_reminders (debt_id, type, status) 
            VALUES ($1, 'manual', 'sent')
        `, [debt_id]);

        res.json({ success: true, message: 'ส่งข้อความทวงหนี้ทาง LINE สำเร็จ!' });

    } catch (err) {
        console.error('Send Reminder Error:', err);
        // บันทึกว่าส่งไม่สำเร็จ
        await db.query(`
            INSERT INTO debt_reminders (debt_id, type, status) 
            VALUES ($1, 'manual', 'failed')
        `, [debt_id]);
        
        res.status(500).json({ error: 'ไม่สามารถส่งข้อความได้ กรุณาตรวจสอบการตั้งค่า LINE' });
    }
});

module.exports = router;