/**
 * สคริปต์สำหรับดาวน์โหลดรูปภาพจากร้าน Shopee ลงคอมพิวเตอร์ (เป็นไฟล์ .jpg)
 * วิธีใช้:
 * 1. เปิดร้าน Shopee ของคุณในคอมพิวเตอร์
 * 2. กด F12 -> เลือกแท็บ Console
 * 3. ก๊อปปี้โค้ดทั้งหมดนี้ไปวาง แล้วกด Enter
 */
(async () => {
    const products = [];
    const seen = new Set();

    console.log('🔍 กำลังเตรียมดาวน์โหลดรูปลงเครื่อง...');

    // Scroll ลงเพื่อโหลดรูปให้ครบ
    for (let i = 0; i < 15; i++) {
        window.scrollTo(0, document.body.scrollHeight * (i / 14));
        await new Promise(r => setTimeout(r, 600));
    }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 500));

    // ดึงข้อมูลรูปภาพ
    document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.getAttribute('src') || img.getAttribute('data-src') || '';
        if (!src || !src.includes('susercontent.com') || seen.has(src)) return;
        if (src.length < 40) return;

        seen.add(src);

        let name = img.alt || 'สินค้า';
        let el = img.parentElement;
        for (let i = 0; i < 8 && el; i++) {
            const texts = el.querySelectorAll('[class*="name"], [class*="title"], [class*="label"]');
            if (texts.length > 0) { name = texts[0].textContent.trim(); break; }
            el = el.parentElement;
        }
        
        // ลบตัวอักษรพิเศษที่อาจทำให้ตั้งชื่อไฟล์ไม่ได้
        name = name.replace(/[\/\\?%*:|"<>]/g, '-').trim();
        products.push({ name, image: src });
    });

    if (products.length === 0) {
        console.log('❌ ไม่พบรูปภาพ โปรดรีเฟรชหน้าเว็บแล้วลองใหม่');
        return;
    }

    console.log(`📦 เจอทั้งหมด ${products.length} รูป กำลังเริ่มดาวน์โหลด...`);
    alert(`เจอทั้งหมด ${products.length} รูป\nเบราว์เซอร์อาจจะขึ้นแจ้งเตือน "อนุญาตให้ดาวน์โหลดหลายไฟล์ (Allow multiple files)"\nรบกวนคุณลูกค้ากด อนุญาต (Allow) ด้วยนะครับ!`);

    // ทยอยดาวน์โหลดทีละไฟล์
    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        try {
            console.log(`กำลังโหลด... ${p.name}`);
            const response = await fetch(p.image);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = p.name + '.jpg'; // ตั้งชื่อไฟล์เป็นชื่อขนม
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            // หน่วงเวลาเล็กน้อยกันเบราว์เซอร์ค้าง
            await new Promise(r => setTimeout(r, 800));
        } catch (err) {
            console.error(`❌ โหลดรูปล้มเหลว: ${p.name}`, err);
        }
    }
    
    console.log('✅ ดาวน์โหลดเสร็จสิ้น! เช็ครูปภาพได้ที่โฟลเดอร์ Downloads ในเครื่องเลยครับ');
    alert('✅ โหลดรูปลงคอมพิวเตอร์เสร็จแล้วครับ! (ไปดูในโฟลเดอร์ Downloads (ดาวน์โหลด) ของเครื่องได้เลย)');
})();
