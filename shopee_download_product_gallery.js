/**
 * สคริปต์สำหรับดาวน์โหลดรูปภาพทั้งหมดในหน้ารายละเอียดสินค้า (Product Page) ของ Shopee
 * วิธีใช้:
 * 1. เปิดหน้ารายละเอียดสินค้านั้นๆ (ที่มีรูปให้เลือกเยอะๆ ตามที่คุณลูกค้าส่งรูปมา)
 * 2. แนะนำให้เลื่อนดูรูปหรือคลิกดูรูปให้ครบก่อน เพื่อให้เว็บโหลดรูปครบ
 * 3. กด F12 -> เลือกแท็บ Console
 * 4. ก๊อปปี้โค้ดนี้ไปวาง แล้วกด Enter
 */
(async () => {
    console.log('🔍 กำลังค้นหารูปภาพทั้งหมดในหน้านี้...');

    // พยายามหาชื่อสินค้าจากหน้าเว็บ เพื่อเอาไปตั้งชื่อไฟล์
    let productName = document.title.replace(' | Shopee Thailand', '').replace(/[\/\\?%*:|"<>]/g, '-').trim();
    if (!productName || productName.length < 2) {
        const h1 = document.querySelector('h1');
        productName = h1 ? h1.textContent.replace(/[\/\\?%*:|"<>]/g, '-').trim() : 'สินค้า_Shopee';
    }

    const uniqueHashes = new Set();
    const downloadQueue = [];

    // ดึงรูปทั้งหมด
    document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.getAttribute('data-src') || '';
        
        // เอาเฉพาะรูปจากเซิร์ฟเวอร์ของ Shopee
        if (!src || !src.includes('susercontent.com/file/')) return;
        
        // สกัดเอาเฉพาะรหัสประจำตัวรูปภาพ (Hash) เพื่อป้องกันการโหลดซ้ำ
        const match = src.match(/\/file\/([a-zA-Z0-9_-]+)/);
        if (!match) return;
        
        let hash = match[1];
        // ถ้าเป็นรูปย่อ (มี _tn ต่อท้าย) ให้ตัดทิ้ง เพื่อไปเอารูปขนาดเต็ม
        if (hash.endsWith('_tn')) {
            hash = hash.slice(0, -3);
        }

        if (!uniqueHashes.has(hash)) {
            uniqueHashes.add(hash);
            // สร้าง URL รูปขนาดเต็ม
            const fullImageUrl = `https://down-th.img.susercontent.com/file/${hash}`;
            downloadQueue.push({
                name: `${productName}_${uniqueHashes.size}`,
                url: fullImageUrl
            });
        }
    });

    if (downloadQueue.length === 0) {
        console.log('❌ ไม่พบรูปภาพ โปรดลองเลื่อนหน้าเว็บ หรือคลิกเปิดรูปก่อนรันสคริปต์');
        alert('❌ ไม่พบรูปภาพเลยครับ ลองคลิกเปิดรูปในเว็บดูก่อนแล้วรันใหม่นะครับ');
        return;
    }

    console.log(`📦 เจอรูปภาพที่ไม่ซ้ำกันทั้งหมด ${downloadQueue.length} รูป! กำลังเริ่มดาวน์โหลด...`);
    alert(`เจอรูปรวมทั้งหมด ${downloadQueue.length} รูป (ตัดรูปซ้ำออกแล้ว)\n\nเบราว์เซอร์อาจจะขึ้นแจ้งเตือน "อนุญาตให้ดาวน์โหลดหลายไฟล์ (Allow multiple files)"\nรบกวนคุณลูกค้ากด อนุญาต (Allow) ด้วยนะครับ!`);

    // ทยอยดาวน์โหลด
    for (let i = 0; i < downloadQueue.length; i++) {
        const p = downloadQueue[i];
        try {
            console.log(`กำลังโหลด... รูปที่ ${i+1}/${downloadQueue.length}`);
            const response = await fetch(p.url);
            
            if (!response.ok) {
                console.warn(`ข้ามรูปลำดับที่ ${i+1} เพราะเซิร์ฟเวอร์ปฏิเสธ (อาจเป็นรูป Profile ไม่ใช่รูปสินค้า)`);
                continue;
            }
            
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = p.name + '.jpg'; // ตั้งชื่อไฟล์เป็นชื่อสินค้า + ตัวเลข
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(objectUrl);
            
            // หน่วงเวลาเล็กน้อย
            await new Promise(r => setTimeout(r, 600));
        } catch (err) {
            console.error(`❌ โหลดรูปล้มเหลว: ${p.name}`, err);
        }
    }
    
    console.log('✅ ดาวน์โหลดเสร็จสิ้น!');
    alert('✅ โหลดรูปลงคอมพิวเตอร์เสร็จแล้วครับ! ไปดูในโฟลเดอร์ Downloads ได้เลยครับ (ได้เฉพาะรูปที่ไม่ซ้ำครับ)');
})();
