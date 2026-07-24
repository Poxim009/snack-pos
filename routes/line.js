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

// @line/bot-sdk v11+ ใช้ MessagingApiClient แทน Client เดิม
let client = null;
if (isLineConfigured) {
    try {
        client = new line.messagingApi.MessagingApiClient({
            channelAccessToken: lineConfig.channelAccessToken
        });
    } catch (err) {
        console.error('⚠️ ไม่สามารถสร้าง LINE Client ได้:', err.message);
    }
}

// --------------------------------------------------
// GET /api/line/status — เช็คว่าตั้งค่า LINE หรือยัง
// --------------------------------------------------
router.get('/status', (req, res) => {
    res.json({ configured: isLineConfigured });
});

const webhookMiddleware = isLineConfigured ? line.middleware(lineConfig) : (req, res, next) => next();

// --------------------------------------------------
// POST /api/line/remind-customer/:customerId — ส่งข้อความทวงหนี้รวมทุกบิลของลูกค้า
// --------------------------------------------------
router.post('/remind-customer/:customerId', async (req, res) => {
    try {
        const customerId = req.params.customerId;
        
        // ดึงข้อมูลลูกค้า
        const custResult = await db.query('SELECT * FROM customers WHERE id = $1', [customerId]);
        if (custResult.rows.length === 0) return res.status(404).json({ error: 'ไม่พบข้อมูลลูกค้า' });
        const customer = custResult.rows[0];
        
        if (!customer.line_user_id) return res.status(400).json({ error: 'ลูกค้านี้ยังไม่ได้เชื่อม LINE' });

        // ดึงหนี้ทั้งหมดที่ยังค้าง
        const debtsResult = await db.query(`
            SELECT * FROM debts 
            WHERE customer_id = $1 AND status IN ('pending', 'partial')
            ORDER BY created_at ASC
        `, [customerId]);

        const debts = debtsResult.rows;
        if (debts.length === 0) return res.status(400).json({ error: 'ลูกค้านี้ไม่มีหนี้ค้างชำระ' });

        let totalRemaining = 0;
        let billDetails = [];
        let imageUrls = [];

        debts.forEach((d, index) => {
            const remaining = d.amount - d.paid_amount;
            totalRemaining += remaining;
            billDetails.push(`บิล ${index+1}: ${d.items_description || '-'} (ค้าง ฿${remaining})`);
            if (d.evidence_image_url && imageUrls.length < 4) {
                // เก็บภาพบิลไว้ส่ง (LINE ส่งรูปได้สูงสุด 5 อันต่อครั้งรวมข้อความ)
                imageUrls.push(d.evidence_image_url);
            }
        });

        // ข้อความทวงหนี้รวม
        const message = {
            type: 'flex',
            altText: 'สรุปยอดค้างชำระ 💸',
            contents: {
                type: "bubble",
                header: {
                    type: "box",
                    layout: "vertical",
                    contents: [{
                        type: "text",
                        text: "สรุปยอดค้างชำระทั้งหมด",
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
                        { type: "text", text: `สวัสดีคุณ ${customer.display_name}`, margin: "md" },
                        { type: "text", text: `คุณมียอดค้างชำระรวม ${debts.length} บิล`, margin: "sm" },
                        { type: "text", text: `ยอดค้างทั้งหมด: ฿${totalRemaining}`, weight: "bold", size: "xl", color: "#EF4444", margin: "md" },
                        { type: "text", text: billDetails.join('\n'), size: "sm", color: "#666666", margin: "sm", wrap: true }
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

        const messagesToSend = [message];

        // แถมรูปหลักฐานไปด้วย
        imageUrls.forEach(url => {
            messagesToSend.push({
                type: 'image',
                originalContentUrl: url,
                previewImageUrl: url
            });
        });

        await client.pushMessage({ to: customer.line_user_id, messages: messagesToSend });

        res.json({ success: true, message: 'ส่งข้อความทวงหนี้รวมสำเร็จ' });

    } catch (err) {
        console.error('Error sending customer reminder:', err);
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// POST /api/line/remind/:debtId — ส่งข้อความทวงหนี้รายบิล (อันเก่าเก็บไว้เผื่อใช้)
// --------------------------------------------------
router.post('/remind/:debtId', async (req, res) => {
    try {
        const debtId = req.params.debtId;
        const result = await db.query(`
            SELECT d.*, c.display_name, c.line_user_id
            FROM debts d
            JOIN customers c ON d.customer_id = c.id
            WHERE d.id = $1
        `, [debtId]);

        const debt = result.rows[0];
        if (!debt) return res.status(404).json({ error: 'ไม่พบข้อมูลหนี้' });
        if (!debt.line_user_id) return res.status(400).json({ error: 'ลูกค้านี้ยังไม่ได้เชื่อม LINE' });
        
        const remaining = debt.amount - debt.paid_amount;
        if (remaining <= 0) return res.status(400).json({ error: 'หนี้นี้จ่ายครบแล้ว' });

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

        const messagesToSend = [message];
        if (debt.evidence_image_url) {
            messagesToSend.push({
                type: 'image',
                originalContentUrl: debt.evidence_image_url,
                previewImageUrl: debt.evidence_image_url
            });
        }

        await client.pushMessage({ to: debt.line_user_id, messages: messagesToSend });
        res.json({ success: true, message: 'ส่งข้อความสำเร็จ' });

    } catch (err) {
        console.error('Error sending reminder:', err);
        res.status(500).json({ error: err.message });
    }
});

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
    if (event.type === 'follow' || event.type === 'unfollow') {
        const userId = event.source.userId;
        
        try {
            if (event.type === 'follow') {
                // ระวัง: event จำลองจากการกด Verify อาจจะหา Profile ไม่เจอ
                let profile = { displayName: 'Unknown', pictureUrl: '' };
                try {
                    profile = await client.getProfile(userId);
                } catch (e) {
                    console.warn('⚠️ ไม่สามารถดึงโปรไฟล์ได้ (อาจเป็นการกด Verify Webhook)', e.message);
                }
                
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
                
                // สำหรับ Verify Webhook Token จะเป็นค่าดัมมี่ ส่งข้อความตอบกลับไม่ได้
                if (event.replyToken && event.replyToken !== '00000000000000000000000000000000') {
                    return client.replyMessage({
                        replyToken: event.replyToken,
                        messages: [{
                            type: 'text',
                            text: `สวัสดีจ้า 🍪 ยินดีต้อนรับสู่ร้านขนมของเรา ขอบคุณที่แอดเราเป็นเพื่อนนะ!`
                        }]
                    });
                }
            } else if (event.type === 'unfollow') {
                await db.query('UPDATE customers SET is_line_friend = 0 WHERE line_user_id = $1', [userId]);
            }
        } catch (error) {
            console.error('DB/API Error on LINE event:', error);
        }
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

        const messagesToSend = [message];

        // ถ้ามีรูปหลักฐาน ให้ส่งไปด้วย
        if (debt.evidence_image_url) {
            // เช็คว่าลิงก์เป็น absolute url ไหม (เช่น ขึ้นต้นด้วย http) 
            // กรณีเป็น localhost แบบไม่มี Cloudinary อาจจะไม่สามารถส่งผ่าน LINE ได้ เพราะ LINE ต้องการ public HTTPS url
            // แต่เนื่องจากลูกค้าเลือกทางเลือก A (Cloudinary) ค่าที่ได้จะเป็น https:// ของ Cloudinary แน่นอน
            const imageUrl = debt.evidence_image_url;
            if (imageUrl.startsWith('http')) {
                messagesToSend.push({
                    type: 'image',
                    originalContentUrl: imageUrl,
                    previewImageUrl: imageUrl
                });
            }
        }

        // ส่งข้อความไปหาลูกค้า (v11+ ใช้ object แทน positional args)
        await client.pushMessage({
            to: debt.line_user_id,
            messages: messagesToSend
        });

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

// --------------------------------------------------
// POST /api/line/notify-new-debt — แจ้งเตือนบิลแปะโป้งใหม่
// --------------------------------------------------
router.post('/notify-new-debt', async (req, res) => {
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

        const message = {
            type: 'flex',
            altText: 'รายการค้างชำระใหม่ 📝',
            contents: {
                type: "bubble",
                header: {
                    type: "box",
                    layout: "vertical",
                    contents: [{
                        type: "text",
                        text: "รายการลงบัญชีค้างชำระ 📝",
                        weight: "bold",
                        color: "#ffffff",
                        size: "lg"
                    }],
                    backgroundColor: "#10B981" // สีเขียวแสดงว่าเป็นรายการใหม่
                },
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: `สวัสดีคุณ ${debt.display_name}`, margin: "md" },
                        { type: "text", text: "คุณมีรายการค้างชำระใหม่", margin: "sm" },
                        { type: "text", text: `ยอดหนี้ใหม่: ฿${remaining}`, weight: "bold", size: "xl", color: "#10B981", margin: "md" },
                        { type: "text", text: `รายละเอียด: ${debt.items_description || '-'}`, size: "sm", color: "#666666", margin: "sm", wrap: true }
                    ]
                }
            }
        };

        const messagesToSend = [message];

        // ถ้ามีรูปหลักฐาน ให้ส่งไปด้วย
        if (debt.evidence_image_url) {
            const imageUrl = debt.evidence_image_url;
            if (imageUrl.startsWith('http')) {
                messagesToSend.push({
                    type: 'image',
                    originalContentUrl: imageUrl,
                    previewImageUrl: imageUrl
                });
            }
        }

        await client.pushMessage({
            to: debt.line_user_id,
            messages: messagesToSend
        });

        res.json({ success: true, message: 'ส่งข้อความแจ้งหนี้ใหม่ทาง LINE สำเร็จ!' });

    } catch (err) {
        console.error('Send New Debt Notification Error:', err);
        res.status(500).json({ error: 'ไม่สามารถส่งข้อความแจ้งเตือนได้' });
    }
});

module.exports = router;