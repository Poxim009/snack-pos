const express = require('express');
const router = express.Router();
const db = require('../database/db');

// --------------------------------------------------
// หมวดหมู่สินค้า (Categories)
// --------------------------------------------------

// GET /api/products/categories — ดึงหมวดหมู่ทั้งหมด
router.get('/categories', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM product_categories ORDER BY sort_order ASC, id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/products/categories — เพิ่มหมวดหมู่ใหม่
router.post('/categories', async (req, res) => {
    const { name, emoji } = req.body;
    if (!name) return res.status(400).json({ error: 'กรุณาระบุชื่อหมวดหมู่' });

    try {
        const result = await db.query(
            'INSERT INTO product_categories (name, emoji) VALUES ($1, $2) RETURNING id',
            [name, emoji || '📦']
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// สินค้า (Products)
// --------------------------------------------------

// GET /api/products — ดึงรายการสินค้าทั้งหมดที่ยังขายอยู่
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, c.name as category_name 
            FROM products p
            LEFT JOIN product_categories c ON p.category_id = c.id
            WHERE p.is_active = 1
            ORDER BY p.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/products — เพิ่มสินค้าใหม่
router.post('/', async (req, res) => {
    const { category_id, name, emoji, sell_price, cost_price, stock_qty, image_url } = req.body;
    
    if (!name || sell_price === undefined) {
        return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน (ต้องมีชื่อและราคาขาย)' });
    }

    try {
        const result = await db.query(`
            INSERT INTO products (category_id, name, emoji, sell_price, cost_price, stock_qty, image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [
            category_id || null, 
            name, 
            emoji || '🍪', 
            sell_price, 
            cost_price || 0, 
            stock_qty || 0,
            image_url || ''
        ]);
        
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/products/:id — ลบสินค้า (ใช้ซ่อนแทนลบจริง ป้องกันบิลเก่าพัง)
router.delete('/:id', async (req, res) => {
    try {
        await db.query('UPDATE products SET is_active = 0 WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'ลบสินค้าเรียบร้อย' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// PATCH /api/products/:id/stock — เพิ่ม/ลดสต๊อกแบบด่วน
router.patch('/:id/stock', async (req, res) => {
    const { qty } = req.body;
    
    if (qty === undefined || isNaN(qty)) {
        return res.status(400).json({ error: 'กรุณาระบุจำนวนสต๊อกที่ถูกต้อง' });
    }

    try {
        await db.query(`
            UPDATE products 
            SET stock_qty = stock_qty + $1 
            WHERE id = $2
        `, [qty, req.params.id]);
        
        res.json({ success: true, message: 'อัปเดตสต๊อกเรียบร้อย' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// PATCH /api/products/:id/image — แก้ไขรูปภาพ
router.patch('/:id/image', async (req, res) => {
    const { image_url } = req.body;
    
    try {
        await db.query(`
            UPDATE products 
            SET image_url = $1 
            WHERE id = $2
        `, [image_url || '', req.params.id]);
        
        res.json({ success: true, message: 'อัปเดตรูปภาพเรียบร้อย' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/products/:id/name — แก้ไขชื่อสินค้า
router.patch('/:id/name', async (req, res) => {
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'กรุณาระบุชื่อสินค้า' });
    }

    try {
        await db.query(`
            UPDATE products 
            SET name = $1 
            WHERE id = $2
        `, [name.trim(), req.params.id]);
        
        res.json({ success: true, message: 'เปลี่ยนชื่อสินค้าเรียบร้อย' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --------------------------------------------------
// ตั้งค่า Multer & Cloudinary สำหรับอัปโหลดรูป
// --------------------------------------------------
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// เช็คว่ามีการตั้งค่า Cloudinary หรือไม่
const isCloudinaryConfigured = !!process.env.CLOUDINARY_URL;

let upload;

if (isCloudinaryConfigured) {
    // ☁️ ใช้ Cloudinary (สำหรับขึ้น Render)
    const storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: 'snack-pos-uploads',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
        },
    });
    upload = multer({ storage: storage });
    console.log('☁️ ตั้งค่าอัปโหลดรูปภาพผ่าน Cloudinary เรียบร้อย');
} else {
    // 💻 ใช้ Local Storage (สำหรับรันในเครื่องตัวเอง)
    let uploadsDir = path.join(__dirname, '..', 'uploads');
    const glitchUploadsDir = path.join(__dirname, '..', '.data', 'uploads');
    if (fs.existsSync(path.join(__dirname, '..', '.data'))) {
        if (!fs.existsSync(glitchUploadsDir)) fs.mkdirSync(glitchUploadsDir, { recursive: true });
        uploadsDir = glitchUploadsDir;
    } else {
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: function (req, file, cb) { cb(null, uploadsDir); },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
        }
    });
    upload = multer({ storage: storage });
    console.warn('⚠️ Cloudinary ยังไม่ได้ตั้งค่า (รูปภาพจะถูกเซฟในเครื่อง ซึ่งอาจหายได้ถ้ารันบน Render)');
}

// POST /api/products/:id/upload — อัปโหลดรูปภาพสินค้า
router.post('/:id/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'ไม่พบไฟล์รูปภาพ' });
        }
        
        // ถ้าใช้ Cloudinary จะได้ .path หรือ .secure_url, ถ้า Local จะได้ .filename
        let imageUrl = '';
        if (isCloudinaryConfigured) {
            imageUrl = req.file.path; // ลิงก์รูปจาก Cloudinary
        } else {
            imageUrl = '/uploads/' + req.file.filename; // ลิงก์รูปในเครื่อง
        }
        
        await db.query(`
            UPDATE products 
            SET image_url = $1 
            WHERE id = $2
        `, [imageUrl, req.params.id]);
        
        res.json({ success: true, image_url: imageUrl, message: 'อัปโหลดรูปภาพเรียบร้อย' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// POST /api/products/sync-shopee — อัปเดตรูปสินค้าจาก Shopee อัตโนมัติ
router.post('/sync-shopee', async (req, res) => {
    try {
        const { products: shopeeProducts } = req.body;
        if (!shopeeProducts || !Array.isArray(shopeeProducts)) {
            return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
        }

        // ดึงสินค้าทั้งหมดจากฐานข้อมูล
        const dbResult = await db.query('SELECT id, name, image_url FROM products');
        const dbProducts = dbResult.rows;

        let updatedCount = 0;

        for (const dbP of dbProducts) {
            // ถ้ารูปเป็น cloudinary อยู่แล้ว ข้ามได้เลย (ยกเว้นอยากให้อัปเดตทับ)
            // แต่เคสนี้ยอมให้อัปเดตทับถ้าเจอรูปจาก Shopee จะได้รูปสวยๆ

            const dbName = dbP.name.toLowerCase().replace(/\s+/g, '');
            let bestMatch = null;
            let highestScore = 0;

            for (const sp of shopeeProducts) {
                const spName = sp.name.toLowerCase().replace(/\s+/g, '');
                
                let score = 0;
                // ถ้าชื่อมีคำซ้อนกันโดยสมบูรณ์
                if (dbName.includes(spName) || spName.includes(dbName)) {
                    score += 10;
                }
                
                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = sp;
                }
            }

            // ถ้าคะแนนเยอะพอ (เจอคู่ที่ตรงกัน)
            if (bestMatch && highestScore > 0) {
                await db.query(`
                    UPDATE products 
                    SET image_url = $1 
                    WHERE id = $2
                `, [bestMatch.image, dbP.id]);
                updatedCount++;
            }
        }

        res.json({ success: true, updated: updatedCount, message: `อัปเดตรูปสำเร็จ ${updatedCount} รายการ` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;