require('dotenv').config();
const db = require('./database/db');

async function check() {
    try {
        console.log('\n--- Database Customers ---');
        const dbRes = await db.query('SELECT * FROM customers ORDER BY created_at DESC LIMIT 20');
        console.table(dbRes.rows);
        process.exit(0);
    } catch(err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}
check();
