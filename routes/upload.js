const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// เช็คว่ามีการตั้งค่า Cloudinary หรือไม่
const isCloudinaryConfigured = !!process.env.CLOUDINARY_URL;

let upload;

if (isCloudinaryConfigured) {
    const storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: 'snack-pos-evidence',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
        },
    });
    upload = multer({ storage: storage });
} else {
    let uploadsDir = path.join(__dirname, '..', 'uploads', 'evidence');
    const glitchUploadsDir = path.join(__dirname, '..', '.data', 'uploads', 'evidence');
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
            cb(null, 'evidence-' + uniqueSuffix + path.extname(file.originalname));
        }
    });
    upload = multer({ storage: storage });
}

// POST /api/upload — อัปโหลดไฟล์ทั่วไป (เช่น รูปหลักฐานแปะโป้ง)
router.post('/', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'ไม่พบไฟล์รูปภาพ' });
        }
        
        let imageUrl = '';
        if (isCloudinaryConfigured) {
            imageUrl = req.file.path; // ลิงก์รูปจาก Cloudinary
        } else {
            imageUrl = '/uploads/evidence/' + req.file.filename; // ลิงก์รูปในเครื่อง
        }
        
        res.json({ success: true, url: imageUrl, message: 'อัปโหลดรูปภาพเรียบร้อย' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
