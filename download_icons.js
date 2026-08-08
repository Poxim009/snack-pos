const fs = require('fs');
const path = require('path');
const https = require('https');

const icons = [
    'wallet', 'banknote', 'coins', 'piggy-bank', 'credit-card', 'landmark',
    'coffee', 'utensils', 'pizza', 'shopping-bag', 'shopping-cart', 'gamepad-2',
    'ticket', 'car', 'bus', 'briefcase', 'gift', 'star', 'home', 'monitor',
    'heart', 'box', 'smartphone', 'music', 'camera'
];

const baseUrl = 'https://unpkg.com/lucide-static@0.330.0/icons/';
const outputDir = path.join(__dirname, 'public', 'images', 'icons');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function downloadIcon(name) {
    return new Promise((resolve, reject) => {
        const fileUrl = `${baseUrl}${name}.svg`;
        const dest = path.join(outputDir, `${name}.svg`);
        
        const request = https.get(fileUrl, (response) => {
            if (response.statusCode === 200) {
                const file = fs.createWriteStream(dest);
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            } else {
                reject(`Failed to download ${name}: ${response.statusCode}`);
            }
        });
        
        request.on('error', reject);
    });
}

async function run() {
    console.log('Downloading icons...');
    for (const icon of icons) {
        try {
            await downloadIcon(icon);
            console.log(`✅ Downloaded ${icon}.svg`);
        } catch (e) {
            console.error(`❌ Error: ${e}`);
        }
    }
    console.log('Done!');
}

run();
