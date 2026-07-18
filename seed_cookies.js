require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.xlsikqxjtbrmpmllsqlj',
    password: '3F%gqkTiqu9-jz&',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const res = await pool.query('SELECT * FROM product_categories WHERE name=$1', ['คุกกี้']);
        let catId;
        if (res.rows.length === 0) {
            const insertRes = await pool.query('INSERT INTO product_categories (name, sort_order) VALUES ($1, $2) RETURNING id', ['คุกกี้', 0]);
            catId = insertRes.rows[0].id;
            console.log('Created category คุกกี้, id:', catId);
        } else {
            catId = res.rows[0].id;
            console.log('Found category คุกกี้, id:', catId);
        }

        const cookies = [
            { name: 'ซอฟท์คุกกี้สอดไส้มาชเมลโล่ยืดๆ มาชเมลโล่ 1 ลูกเต็มๆ', emoji: '🍪', price: 10 },
            { name: 'ซอฟท์คุกกี้ลาวา ไส้ดาร์กช็อกโกแลตไส้เยิ้มๆ', emoji: '🍪', price: 10 },
            { name: 'ซอฟท์คุกกี้ไส้ช็อกโกแลตท็อปปิ้งแน่นๆ อร่อย', emoji: '🍪', price: 14 },
            { name: 'ซอฟท์คุกกี้ดับเบิ้ลช็อกโกแลต เข้มข้นไส้ช็อกแน่นๆ', emoji: '🍫', price: 17 },
            { name: 'ซอฟท์คุกกี้เรทเวลเวทไส้มาชเมลโล่ยืดๆ ราดซอส', emoji: '🍓', price: 14 },
            { name: 'ซอฟท์คุกกี้มัทฉะไวท์ช็อค', emoji: '🍵', price: 15 }
        ];

        for (const c of cookies) {
            // Check if exists
            const existing = await pool.query('SELECT * FROM products WHERE name=$1', [c.name]);
            if (existing.rows.length === 0) {
                await pool.query(
                    'INSERT INTO products (category_id, name, emoji, sell_price, cost_price, stock_qty) VALUES ($1, $2, $3, $4, 0, 100)',
                    [catId, c.name, c.emoji, c.price]
                );
                console.log('Inserted: ' + c.name);
            } else {
                console.log('Skipped (already exists): ' + c.name);
            }
        }
        console.log('Done!');
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

run();
