const { Pool } = require('pg');

// เราจะเชื่อมต่อกับ Supabase ถ้ามี SUPABASE_DB_URL, ถ้าไม่มีให้เตือน
const connectionString = process.env.SUPABASE_DB_URL;

const pool = new Pool({
    connectionString: connectionString,
    ssl: connectionString && connectionString.includes('supabase') ? { rejectUnauthorized: false } : false
});

// ฟังก์ชัน helper เพื่อจำลองรูปแบบเดิมของ better-sqlite3 เล็กน้อย 
// แต่เราจะใช้ pool.query เป็นหลักในการเรียกใช้งาน
module.exports = {
    query: (text, params) => pool.query(text, params),
    pool: pool
};