const { Pool } = require('pg');

// รองรับ 2 แบบ:
// แบบ 1: ใช้ SUPABASE_DB_URL (connection string เดิม)
// แบบ 2: ใช้ตัวแปรแยก DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (ปลอดภัยกว่า ไม่มีปัญหา URL encoding)
let poolConfig;

if (process.env.DB_HOST) {
    // แบบ 2: ใช้ตัวแปรแยก (แนะนำ — ไม่มีปัญหา % ในรหัสผ่าน)
    poolConfig = {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'postgres',
        ssl: { rejectUnauthorized: false }
    };
} else if (process.env.SUPABASE_DB_URL) {
    // แบบ 1: ใช้ connection string
    poolConfig = {
        connectionString: process.env.SUPABASE_DB_URL,
        ssl: process.env.SUPABASE_DB_URL.includes('supabase') ? { rejectUnauthorized: false } : false
    };
} else {
    console.warn('⚠️ ไม่พบการตั้งค่าฐานข้อมูล (DB_HOST หรือ SUPABASE_DB_URL)');
    poolConfig = {};
}

const pool = new Pool(poolConfig);

module.exports = {
    query: async (text, params) => {
        try {
            return await pool.query(text, params);
        } catch (e) {
            console.error('DB Query Error:', e);
            if (!e.message) e.message = String(e);
            throw e;
        }
    },
    pool: pool
};