const line = require('@line/bot-sdk');
const db = require('./database/db');
require('dotenv').config();

const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

async function check() {
    try {
        console.log('--- LINE Followers ---');
        
        // try to get followers
        const d = new Date();
        d.setDate(d.getDate() - 1); // Get previous day
        const y2 = d.getFullYear();
        const m2 = String(d.getMonth() + 1).padStart(2, '0');
        const d2 = String(d.getDate()).padStart(2, '0');
        const dateStr2 = `${y2}${m2}${d2}`;
        
        try {
            const res = await client.getNumberOfFollowers(dateStr2);
            console.log(`Followers on ${dateStr2}:`, res);
        } catch (e) {
            console.log('Could not get followers from API:', e.message);
        }

        // Get webhook endpoint info
        try {
            const webhookInfo = await client.getWebhookEndpoint();
            console.log('Webhook Endpoint:', webhookInfo);
        } catch (e) {
            console.log('Could not get webhook info:', e.message);
        }

        console.log('\n--- Database ---');
        const dbRes = await db.query('SELECT id, display_name, line_user_id, is_line_friend FROM customers WHERE is_line_friend = 1 OR line_user_id IS NOT NULL');
        console.log('Customers in DB with LINE info:');
        console.table(dbRes.rows);

        process.exit(0);
    } catch(err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}
check();
