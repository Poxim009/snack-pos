require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
    if (!process.env.SUPABASE_DB_URL) {
        console.error('❌ ไม่พบ SUPABASE_DB_URL ในไฟล์ .env');
        console.error('กรุณาใส่ URL ของฐานข้อมูล Supabase ก่อนรันคำสั่งนี้');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.SUPABASE_DB_URL,
        ssl: { rejectUnauthorized: false } // ป้องกันปัญหา SSL
    });

    console.log('⏳ กำลังเชื่อมต่อกับ Supabase...');
    
    try {
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('⏳ กำลังสร้างตารางในฐานข้อมูล...');
        await pool.query(schemaSql);
        
        console.log('✅ สร้างตารางสำเร็จเรียบร้อยแล้ว!');

        // ใส่ข้อมูลพื้นฐานบางอย่างให้
        await pool.query(`
            INSERT INTO product_categories (name, emoji) VALUES 
            ('ขนมหวาน', '🍰'), ('เครื่องดื่ม', '🥤'), ('ของคาว', '🍱')
            ON CONFLICT DO NOTHING;
            
            INSERT INTO expense_categories (name, emoji) VALUES 
            ('วัตถุดิบ', '🥚'), ('บรรจุภัณฑ์', '🛍️'), ('ค่าเดินทาง', '🛵')
            ON CONFLICT DO NOTHING;
        `);
        console.log('✅ ใส่ข้อมูลหมวดหมู่พื้นฐานเรียบร้อย!');

    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาด:', error.message);
    } finally {
        await pool.end();
        console.log('👋 เสร็จสิ้นการทำงาน');
        process.exit(0);
    }
}

setupDatabase();
