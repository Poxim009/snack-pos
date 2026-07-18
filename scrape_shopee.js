/**
 * ดึงสินค้าจากร้าน Shopee ด้วย Cookie จาก Browser ของคุณ
 * วิธีนี้ผ่าน bot detection ได้ 100%
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

const SHOP_USERNAME = 'khongkwan.bakery';
const SHOP_ID = 347469;

function fetchWithCookies(url, cookies) {
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'th-TH,th;q=0.9',
                'Referer': `https://shopee.co.th/${SHOP_USERNAME}`,
                'Cookie': cookieStr,
                'x-requested-with': 'XMLHttpRequest',
            }
        }, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve(JSON.parse(d)); }
                catch (e) { reject(new Error('JSON parse error: ' + d.slice(0, 300))); }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

async function main() {
    console.log('🌐 กำลังเปิดเบราว์เซอร์เพื่อดึง Cookie...');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 800 },
        args: [
            '--no-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--lang=th-TH,th',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = await browser.newPage();

    // ซ่อน bot signature
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');

    console.log('📖 กำลังเปิดหน้าร้าน Shopee...');
    console.log('⚠️  ถ้ามีหน้า "เข้าสู่ระบบ" โปรด LOGIN ด้วยตัวเองก่อนนะครับ แล้วรอให้หน้าร้านโหลดครับ');

    await page.goto(`https://shopee.co.th/${SHOP_USERNAME}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    // รอให้ผ่านการตรวจสอบ (ให้คนกดเองถ้าโดนถาม)
    console.log('⏳ กำลังรอหน้าร้านโหลด... (รอ 8 วินาที)');
    await new Promise(r => setTimeout(r, 8000));

    // ตรวจว่าหน้าปัจจุบันเป็นหน้าร้านหรือเปล่า
    const currentUrl = page.url();
    console.log('📍 URL ปัจจุบัน:', currentUrl);

    if (currentUrl.includes('verify') || currentUrl.includes('login')) {
        console.log('\n🔑 Shopee ขอให้ Login ก่อน!');
        console.log('👉 โปรด LOGIN บนหน้าต่างเบราว์เซอร์ที่เปิดขึ้นมา');
        console.log('👉 พอ Login เสร็จและหน้าร้านโหลดแล้ว กด Enter ที่ Terminal นี้ครับ');
        await new Promise(resolve => {
            process.stdin.once('data', resolve);
        });
    }

    // ดึง cookies
    const cookies = await page.cookies();
    console.log(`\n🍪 ได้ Cookie มา ${cookies.length} ตัว`);

    await browser.close();

    // ตอนนี้ใช้ cookies เรียก API
    console.log('\n📦 กำลังดึงรายการสินค้าผ่าน API...');
    const allProducts = [];
    let offset = 0;

    while (true) {
        try {
            const apiUrl = `https://shopee.co.th/api/v4/search/search_items?by=pop&limit=30&match_id=${SHOP_ID}&newest=${offset}&order=desc&page_type=shop&scenario=PAGE_OTHERS&version=2`;
            const data = await fetchWithCookies(apiUrl, cookies);

            const items = data?.data?.items || data?.items || [];
            if (items.length === 0) break;

            items.forEach(item => {
                const info = item.item_basic || item;
                const name = info.name || 'ไม่มีชื่อ';
                const imgId = info.image || '';
                const price = info.price ? info.price / 100000 : 0;
                const image = imgId ? `https://down-th.img.susercontent.com/file/${imgId}` : '';
                if (name && image) allProducts.push({ name, image, price });
            });

            console.log(`  → ${allProducts.length} รายการ (offset: ${offset})`);
            offset += 30;
            if (items.length < 30) break;
            await new Promise(r => setTimeout(r, 400));
        } catch (e) {
            console.error('Error:', e.message);
            break;
        }
    }

    if (allProducts.length === 0) {
        console.log('\n⚠️ ยังดึงสินค้าไม่ได้ กำลังลองดึงจากหน้าเว็บโดยตรง...');
        // Fallback: เปิดเบราว์เซอร์อีกครั้งและดึงจากหน้าเว็บ
        await scrapeFromPage(cookies);
        return;
    }

    buildAndOpen(allProducts);
}

async function scrapeFromPage(savedCookies) {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 900 },
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
        ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    await page.setCookie(...savedCookies);

    await page.goto(`https://shopee.co.th/${SHOP_USERNAME}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    // Scroll
    for (let i = 0; i < 10; i++) {
        await page.evaluate(i => window.scrollTo(0, window.innerHeight * (i + 1)), i);
        await new Promise(r => setTimeout(r, 1200));
    }

    const products = await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        document.querySelectorAll('img').forEach(img => {
            const src = img.src || '';
            const alt = img.alt || '';
            if (src && src.includes('susercontent.com') && !seen.has(src) && src.length > 40) {
                seen.add(src);
                results.push({ name: alt || 'สินค้า', image: src, price: 0 });
            }
        });
        return results;
    });

    await browser.close();
    if (products.length > 0) buildAndOpen(products);
    else console.log('❌ ดึงไม่ได้อีกครั้ง');
}

function buildAndOpen(products) {
    console.log(`\n✅ ได้สินค้าทั้งหมด ${products.length} รายการ!`);

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>🍪 ${SHOP_USERNAME} — ${products.length} สินค้า</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Sarabun', sans-serif; background: #fff8f4; }
header { background: linear-gradient(135deg,#ee4d2d,#ff7337); color: white; padding: 2rem; text-align: center; }
header h1 { font-size: 2rem; font-weight: 700; }
header p { opacity: .88; margin-top: .4rem; }
.tb { display:flex; justify-content:space-between; align-items:center; padding:1rem 2rem; background:white; border-bottom:1px solid #eee; position:sticky; top:0; z-index:10; }
.tb input { padding:.6rem 1.2rem; border:2px solid #ddd; border-radius:999px; font-size:1rem; width:280px; font-family:inherit; outline:none; }
.tb input:focus { border-color:#ee4d2d; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:1.2rem; padding:1.5rem 2rem; max-width:1400px; margin:0 auto; }
.card { background:white; border-radius:14px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.07); cursor:pointer; transition:transform .2s,box-shadow .2s; }
.card:hover { transform:translateY(-4px); box-shadow:0 10px 28px rgba(0,0,0,.14); }
.card img { width:100%; height:170px; object-fit:cover; background:#f5f5f5; display:block; }
.card-body { padding:.65rem .8rem .8rem; }
.cn { font-size:.82rem; font-weight:600; color:#333; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.35; min-height:2.3em; }
.cp { color:#ee4d2d; font-weight:700; font-size:.9rem; margin-top:.35rem; }
.cb { width:100%; margin-top:.5rem; padding:.4rem; background:#ee4d2d; color:white; border:none; border-radius:7px; font-family:inherit; font-size:.8rem; font-weight:600; cursor:pointer; }
.cb:hover { background:#c73a1f; }
.mbg { display:none; position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:100; justify-content:center; align-items:center; }
.mbg.show { display:flex; }
.modal { background:white; border-radius:20px; padding:2rem; max-width:500px; width:92%; text-align:center; }
.modal img { width:200px; height:200px; object-fit:cover; border-radius:14px; margin-bottom:1rem; }
.modal h3 { font-size:1.05rem; color:#222; margin-bottom:.3rem; }
.mpr { color:#ee4d2d; font-weight:700; font-size:1.1rem; margin-bottom:1rem; }
.cr { display:flex; gap:.5rem; margin-bottom:.65rem; }
.cr input { flex:1; padding:.5rem .8rem; border:2px solid #eee; border-radius:8px; font-size:.78rem; font-family:inherit; }
.cr button { padding:.5rem .9rem; background:#ee4d2d; color:white; border:none; border-radius:8px; cursor:pointer; font-family:inherit; font-size:.8rem; font-weight:600; }
.cr button.g { background:#10B981; }
.bc { margin-top:.75rem; padding:.5rem 2rem; background:#f0f0f0; color:#555; border:none; border-radius:8px; font-family:inherit; font-size:1rem; cursor:pointer; }
.toast { position:fixed; bottom:2rem; left:50%; transform:translateX(-50%); background:#1a1a1a; color:white; padding:.7rem 2rem; border-radius:999px; font-size:.9rem; opacity:0; transition:opacity .3s; pointer-events:none; z-index:999; }
.toast.show { opacity:1; }
</style>
</head>
<body>
<header>
  <h1>🍪 ${SHOP_USERNAME}</h1>
  <p>พบสินค้า ${products.length} รายการ • คลิกเพื่อก๊อปปี้ชื่อหรือรูป</p>
</header>
<div class="tb">
  <input type="text" id="s" placeholder="🔍 ค้นหาสินค้า..." oninput="filt()">
  <span id="cnt" style="color:#888;font-size:.95rem">แสดง ${products.length} รายการ</span>
</div>
<div class="grid" id="grid">
${products.map((p, i) => `
  <div class="card" data-n="${p.name.toLowerCase().replace(/"/g, '')}" onclick="om(${i})">
    <img src="${p.image}" loading="lazy" onerror="this.style.background='#eee';this.style.height='170px'">
    <div class="card-body">
      <div class="cn">${p.name}</div>
      ${p.price > 0 ? `<div class="cp">฿${p.price.toFixed(0)}</div>` : ''}
      <button class="cb">ก๊อปปี้ชื่อ / รูป</button>
    </div>
  </div>`).join('')}
</div>
<div class="mbg" id="bg" onclick="if(event.target===this)cm()"><div class="modal" id="modal"></div></div>
<div class="toast" id="toast"></div>
<script>
const P=${JSON.stringify(products)};
function filt(){
  const q=document.getElementById('s').value.toLowerCase();
  let n=0;
  document.querySelectorAll('.card').forEach(c=>{const ok=c.dataset.n.includes(q);c.style.display=ok?'':'none';if(ok)n++;});
  document.getElementById('cnt').textContent='แสดง '+n+' รายการ';
}
function om(i){
  const p=P[i];window._p=p;
  document.getElementById('modal').innerHTML=\`
    <img src="\${p.image}" onerror="this.style.background='#f0f0f0'">
    <h3>\${p.name}</h3>
    \${p.price>0?'<div class="mpr">฿'+p.price.toFixed(0)+'</div>':''}
    <div class="cr"><input value="\${p.name}" readonly onclick="this.select()"><button onclick="cp(window._p.name,'ชื่อ')">📝 ชื่อ</button></div>
    <div class="cr"><input value="\${p.image}" readonly onclick="this.select()"><button class="g" onclick="cp(window._p.image,'รูป')">🖼 รูป</button></div>
    <button class="bc" onclick="cm()">✕ ปิด</button>
  \`;
  document.getElementById('bg').classList.add('show');
}
function cm(){document.getElementById('bg').classList.remove('show');}
function cp(t,l){navigator.clipboard.writeText(t).then(()=>ts('✅ ก๊อปปี้ '+l+' แล้ว!'));}
function ts(m){const e=document.getElementById('toast');e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500);}
</script>
</body></html>`;

    const out = path.join(__dirname, 'shopee_products.html');
    fs.writeFileSync(out, html, 'utf8');
    console.log(`📂 บันทึกที่: ${out}`);
    exec(`start "" "${out}"`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
