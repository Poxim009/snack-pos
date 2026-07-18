/**
 * วางสคริปต์นี้ในหน้า Shopee ที่เปิดอยู่ใน Console
 * กด F12 -> Console -> วางทั้งหมดแล้วกด Enter
 */
(async () => {
    const products = [];
    const seen = new Set();

    console.log('🔍 กำลังดึงสินค้า...');

    // Scroll ลงเพื่อโหลดสินค้าให้ครบ
    for (let i = 0; i < 15; i++) {
        window.scrollTo(0, document.body.scrollHeight * (i / 14));
        await new Promise(r => setTimeout(r, 600));
    }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 500));

    // ดึงสินค้าทุกอัน
    document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.getAttribute('src') || img.getAttribute('data-src') || '';
        if (!src || !src.includes('susercontent.com') || seen.has(src)) return;
        if (src.length < 40) return;

        seen.add(src);

        // ดึงชื่อ: หา parent ที่ใกล้ที่สุดที่มีชื่อสินค้า
        let name = img.alt || '';
        let el = img.parentElement;
        for (let i = 0; i < 8 && el; i++) {
            const texts = el.querySelectorAll('[class*="name"], [class*="title"], [class*="label"]');
            if (texts.length > 0) { name = texts[0].textContent.trim(); break; }
            el = el.parentElement;
        }

        // ดึงราคา
        let price = '';
        let pel = img.parentElement;
        for (let i = 0; i < 8 && pel; i++) {
            const priceEl = pel.querySelector('[class*="price"]');
            if (priceEl) { price = priceEl.textContent.trim().replace(/[^0-9฿.,]/g, '').slice(0, 10); break; }
            pel = pel.parentElement;
        }

        products.push({ name: name || 'สินค้า', image: src, price });
    });

    if (products.length === 0) {
        console.log('❌ ไม่พบสินค้า');
        return;
    }

    console.log(`✅ พบสินค้า ${products.length} รายการ กำลังสร้างหน้าแสดงผล...`);

    // สร้างหน้าผลลัพธ์
    const html = `<!DOCTYPE html><html lang="th">
<head><meta charset="UTF-8"><title>🍪 สินค้า Shopee ${products.length} รายการ</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Sarabun',sans-serif;background:#fff8f4}
header{background:linear-gradient(135deg,#ee4d2d,#ff7337);color:white;padding:2rem;text-align:center}
header h1{font-size:2rem;font-weight:700}
header p{opacity:.88;margin-top:.4rem}
.tb{display:flex;justify-content:space-between;align-items:center;padding:1rem 2rem;background:white;border-bottom:1px solid #eee;position:sticky;top:0;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.tb input{padding:.6rem 1.2rem;border:2px solid #ddd;border-radius:999px;font-size:1rem;width:280px;font-family:inherit;outline:none;transition:border-color .2s}
.tb input:focus{border-color:#ee4d2d}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:1.2rem;padding:1.5rem 2rem;max-width:1400px;margin:0 auto}
.card{background:white;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.07);cursor:pointer;transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-4px);box-shadow:0 10px 28px rgba(0,0,0,.14)}
.card img{width:100%;height:170px;object-fit:cover;background:#f5f5f5;display:block}
.card-body{padding:.65rem .8rem .8rem}
.cn{font-size:.82rem;font-weight:600;color:#333;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.35;min-height:2.3em}
.cp{color:#ee4d2d;font-weight:700;font-size:.9rem;margin-top:.35rem}
.cb{width:100%;margin-top:.5rem;padding:.4rem;background:#ee4d2d;color:white;border:none;border-radius:7px;font-family:inherit;font-size:.8rem;font-weight:600;cursor:pointer}
.cb:hover{background:#c73a1f}
.mbg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100;justify-content:center;align-items:center}
.mbg.show{display:flex}
.modal{background:white;border-radius:20px;padding:2rem;max-width:500px;width:92%;text-align:center}
.modal img{width:200px;height:200px;object-fit:cover;border-radius:14px;margin-bottom:1rem}
.modal h3{font-size:1.05rem;color:#222;margin-bottom:.3rem}
.mpr{color:#ee4d2d;font-weight:700;font-size:1.1rem;margin-bottom:1rem}
.cr{display:flex;gap:.5rem;margin-bottom:.65rem}
.cr input{flex:1;padding:.5rem .8rem;border:2px solid #eee;border-radius:8px;font-size:.78rem;font-family:inherit}
.cr button{padding:.5rem .9rem;background:#ee4d2d;color:white;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.8rem;font-weight:600;white-space:nowrap}
.cr button.g{background:#10B981}
.bc{margin-top:.75rem;padding:.5rem 2rem;background:#f0f0f0;color:#555;border:none;border-radius:8px;font-family:inherit;font-size:1rem;cursor:pointer}
.toast{position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:#1a1a1a;color:white;padding:.7rem 2rem;border-radius:999px;font-size:.9rem;opacity:0;transition:opacity .3s;pointer-events:none;z-index:999}
.toast.show{opacity:1}
</style></head><body>
<header><h1>🍪 Khongkwan Bakery</h1><p>พบสินค้า ${products.length} รายการ • คลิกเพื่อก๊อปปี้ชื่อหรือรูป</p></header>
<div class="tb">
  <input type="text" id="s" placeholder="🔍 ค้นหาสินค้า..." oninput="filt()">
  <span id="cnt" style="color:#888;font-size:.95rem">แสดง ${products.length} รายการ</span>
</div>
<div class="grid" id="grid">
${products.map((p, i) => `<div class="card" data-n="${p.name.toLowerCase().replace(/"/g,'')}" onclick="om(${i})">
  <img src="${p.image}" loading="lazy" onerror="this.style.background='#eee';this.style.height='170px'">
  <div class="card-body">
    <div class="cn">${p.name}</div>
    ${p.price ? `<div class="cp">${p.price}</div>` : ''}
    <button class="cb">ก๊อปปี้ชื่อ / รูป</button>
  </div>
</div>`).join('')}
</div>
<div class="mbg" id="bg" onclick="if(event.target===this)cm()"><div class="modal" id="modal"></div></div>
<div class="toast" id="toast"></div>
<script>
const P=${JSON.stringify(products)};
function filt(){const q=document.getElementById('s').value.toLowerCase();let n=0;document.querySelectorAll('.card').forEach(c=>{const ok=c.dataset.n.includes(q);c.style.display=ok?'':'none';if(ok)n++;});document.getElementById('cnt').textContent='แสดง '+n+' รายการ';}
function om(i){const p=P[i];window._p=p;document.getElementById('modal').innerHTML=\`<img src="\${p.image}" onerror="this.style.background='#f0f0f0'"><h3>\${p.name}</h3>\${p.price?'<div class="mpr">'+p.price+'</div>':''}<div class="cr"><input value="\${p.name}" readonly onclick="this.select()"><button onclick="cp(window._p.name,'ชื่อ')">📝 ชื่อ</button></div><div class="cr"><input value="\${p.image}" readonly onclick="this.select()"><button class="g" onclick="cp(window._p.image,'รูป')">🖼 รูป</button></div><button class="bc" onclick="cm()">✕ ปิด</button>\`;document.getElementById('bg').classList.add('show');}
function cm(){document.getElementById('bg').classList.remove('show');}
function cp(t,l){navigator.clipboard.writeText(t).then(()=>ts('✅ ก๊อปปี้ '+l+' แล้ว!'));}
function ts(m){const e=document.getElementById('toast');e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500);}
</script></body></html>`;

    // เปิดหน้าใหม่แสดงผล
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    console.log(`🎉 เปิดหน้าต่างใหม่ขึ้นมาแล้ว! มีสินค้า ${products.length} รายการ`);
})();
