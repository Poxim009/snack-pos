require('dotenv').config();
const db = require('./database/db');

async function insertUser() {
    try {
        const displayName = 'PPPPPaer';
        const lineUserId = 'U055dfdcf475aaab8595a6292b88f09cf';
        
        console.log(`Inserting ${displayName} with ID ${lineUserId}...`);
        
        // Check if exists
        const check = await db.query('SELECT * FROM customers WHERE line_user_id = $1', [lineUserId]);
        if (check.rows.length > 0) {
            console.log('User already exists in DB:', check.rows[0]);
            // Update name just in case
            await db.query('UPDATE customers SET display_name = $1, is_line_friend = 1 WHERE line_user_id = $2', [displayName, lineUserId]);
            console.log('Updated existing user.');
        } else {
            await db.query(`
                INSERT INTO customers (display_name, line_user_id, is_line_friend)
                VALUES ($1, $2, 1)
            `, [displayName, lineUserId]);
            console.log('Inserted new user successfully.');
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}
insertUser();
