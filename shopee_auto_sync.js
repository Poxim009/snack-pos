/**
 * วางสคริปต์นี้ในหน้า Shopee ที่เปิดอยู่ใน Console
 * กด F12 -> Console -> วางทั้งหมดแล้วกด Enter
 * สคริปต์นี้จะดึงรูปภาพแล้วส่งเข้าระบบคิดตังของเราอัตโนมัติ
 */
(async () => {
    const products = [];
    const seen = new Set();

    console.log('🔍 กำลังดึงรูปสินค้าเพื่อซิงค์เข้าระบบ...');

    // Scroll ลงเพื่อโหลดรูปให้ครบ
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

        // ดึงชื่อ
        let name = img.alt || '';
        let el = img.parentElement;
        for (let i = 0; i < 8 && el; i++) {
            const texts = el.querySelectorAll('[class*="name"], [class*="title"], [class*="label"]');
            if (texts.length > 0) { name = texts[0].textContent.trim(); break; }
            el = el.parentElement;
        }

        products.push({ name: name || 'สินค้า', image: src });
    });

    if (products.length === 0) {
        console.log('❌ ไม่พบรูปสินค้า กรุณารอหน้าเว็บโหลดเสร็จก่อนแล้วรันใหม่');
        return;
    }
    
    console.log(`📦 พบรูปสินค้า ${products.length} รูป กำลังส่งเข้าระบบคิดตัง...`);

    // ส่งข้อมูลเข้าระบบ (ใช้ localhost:3000 สำหรับในเครื่อง)
    try {
        const response = await fetch('http://localhost:3000/api/products/sync-shopee', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ products })
        });
        
        const result = await response.json();
        if (response.ok) {
            console.log(`✅ สำเร็จ! อัปเดตรูปสินค้าไปทั้งหมด ${result.updated} รายการ!`);
            alert(`✅ ซิงค์รูปร้าน Shopee สำเร็จ! อัปเดตไป ${result.updated} รายการ\nกลับไปรีเฟรชหน้าเว็บระบบคิดตังได้เลยครับ`);
        } else {
            console.error('❌ เกิดข้อผิดพลาดจากเซิร์ฟเวอร์:', result.error);
            alert('❌ พังงงงง: ' + result.error);
        }
    } catch (e) {
        console.error('❌ เชื่อมต่อระบบคิดตังไม่สำเร็จ (อย่าลืมเปิดเซิร์ฟเวอร์ทิ้งไว้นะครับ):', e);
        alert('❌ เชื่อมต่อระบบคิดตังไม่สำเร็จ! คุณเปิดเซิร์ฟเวอร์ (npm start) ทิ้งไว้หรือยังครับ?');
    }
})();
